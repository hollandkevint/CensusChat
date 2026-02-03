import { getDuckDBPool } from './duckdbPool';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

export interface QueryProfile {
  query: string;
  executionTimeMs: number;
  cpuTimeUs?: number;
  operatorTimings?: Array<{
    operator: string;
    timeUs: number;
    cardinality: number;
  }>;
  rowsReturned: number;
  timestamp: Date;
}

export interface ProfiledQueryResult<T> {
  result: T[];
  profile: QueryProfile;
}

// Store recent profiles in memory (last N queries)
const recentProfiles: QueryProfile[] = [];
const MAX_STORED_PROFILES = 100;

export async function queryWithProfiling<T = Record<string, unknown>>(
  sql: string,
  options: { storeProfile?: boolean } = { storeProfile: true }
): Promise<ProfiledQueryResult<T>> {
  const pool = getDuckDBPool();
  const conn = await pool.acquire();
  const startTime = Date.now();

  try {
    // Generate unique profile output path
    const profilePath = path.join(os.tmpdir(), `duckdb_profile_${Date.now()}.json`);

    // Enable JSON profiling
    await conn.run(`SET profiling_output = '${profilePath}'`);
    await conn.run(`SET enable_profiling = 'json'`);
    await conn.run(`SET custom_profiling_settings = '{"CPU_TIME": "true", "OPERATOR_TIMING": "true", "OPERATOR_CARDINALITY": "true"}'`);

    // Execute query
    const reader = await conn.runAndReadAll(sql);
    const result = reader.getRowObjects() as T[];

    // Read profile data
    let profileData: {
      cpu_time?: number;
      children?: Array<{
        name: string;
        timing: number;
        cardinality: number;
      }>;
    } = {};
    try {
      const profileContent = await fs.readFile(profilePath, 'utf-8');
      profileData = JSON.parse(profileContent);
      await fs.unlink(profilePath); // Cleanup
    } catch (e) {
      console.warn('Could not read profile data:', e);
    }

    // Disable profiling
    await conn.run(`SET enable_profiling = 'no_output'`);

    const profile: QueryProfile = {
      query: sql.substring(0, 500), // Truncate long queries
      executionTimeMs: Date.now() - startTime,
      cpuTimeUs: profileData.cpu_time,
      operatorTimings: profileData.children?.map((op) => ({
        operator: op.name,
        timeUs: op.timing,
        cardinality: op.cardinality
      })),
      rowsReturned: result.length,
      timestamp: new Date()
    };

    if (options.storeProfile) {
      storeProfile(profile);
    }

    return { result, profile };
  } finally {
    pool.release(conn);
  }
}

function storeProfile(profile: QueryProfile): void {
  recentProfiles.unshift(profile);
  if (recentProfiles.length > MAX_STORED_PROFILES) {
    recentProfiles.pop();
  }
}

export function getRecentProfiles(limit: number = 10): QueryProfile[] {
  return recentProfiles.slice(0, limit);
}

export function clearProfiles(): void {
  recentProfiles.length = 0;
}

export function getProfileStats(): {
  totalQueries: number;
  avgExecutionTimeMs: number;
  slowestQueryMs: number;
  totalRowsReturned: number;
} {
  if (recentProfiles.length === 0) {
    return {
      totalQueries: 0,
      avgExecutionTimeMs: 0,
      slowestQueryMs: 0,
      totalRowsReturned: 0
    };
  }

  const totalTime = recentProfiles.reduce((sum, p) => sum + p.executionTimeMs, 0);
  const slowest = Math.max(...recentProfiles.map(p => p.executionTimeMs));
  const totalRows = recentProfiles.reduce((sum, p) => sum + p.rowsReturned, 0);

  return {
    totalQueries: recentProfiles.length,
    avgExecutionTimeMs: Math.round(totalTime / recentProfiles.length),
    slowestQueryMs: slowest,
    totalRowsReturned: totalRows
  };
}
