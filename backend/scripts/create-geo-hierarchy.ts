/**
 * Geographic Hierarchy Metadata Creator
 *
 * Creates and populates the geo_hierarchy table with parent-child relationships
 * for all geographic levels: State → County → Tract → Block Group
 *
 * This enables:
 * - Hierarchical navigation and rollups
 * - Cross-level queries
 * - Geographic relationship lookups
 */

import * as duckdb from 'duckdb';
import * as path from 'path';
import dotenv from 'dotenv';

dotenv.config();

const DB_PATH = path.join(__dirname, '../data/census.duckdb');

interface GeoHierarchy {
  geo_type: 'state' | 'county' | 'tract' | 'block_group';
  geoid: string;
  parent_geoid: string | null;
  geo_name: string;
  population: number;
  land_area_sqmi: number | null;
}

function createHierarchyTable(db: duckdb.Database): Promise<void> {
  return new Promise((resolve, reject) => {
    db.run(`
      CREATE TABLE IF NOT EXISTS geo_hierarchy (
        geo_type VARCHAR(20),           -- 'state', 'county', 'tract', 'block_group'
        geoid VARCHAR(15),              -- Full GEOID for this geography
        parent_geoid VARCHAR(15),       -- GEOID of parent geography (NULL for states)
        geo_name VARCHAR(200),          -- Human-readable name
        population BIGINT,              -- Total population
        land_area_sqmi DOUBLE,          -- Land area in square miles (optional)
        PRIMARY KEY (geo_type, geoid)
      );

      -- Create indexes for fast lookups
      CREATE INDEX IF NOT EXISTS idx_geo_hierarchy_geoid ON geo_hierarchy(geoid);
      CREATE INDEX IF NOT EXISTS idx_geo_hierarchy_parent ON geo_hierarchy(parent_geoid);
      CREATE INDEX IF NOT EXISTS idx_geo_hierarchy_type ON geo_hierarchy(geo_type);
    `, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

function populateStateHierarchy(db: duckdb.Database): Promise<void> {
  return new Promise((resolve, reject) => {
    db.run(`
      INSERT INTO geo_hierarchy (geo_type, geoid, parent_geoid, geo_name, population, land_area_sqmi)
      SELECT
        'state' as geo_type,
        geoid,
        NULL as parent_geoid,
        state_name as geo_name,
        population,
        NULL as land_area_sqmi
      FROM state_data
      ON CONFLICT (geo_type, geoid) DO UPDATE SET
        geo_name = EXCLUDED.geo_name,
        population = EXCLUDED.population
    `, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

function populateCountyHierarchy(db: duckdb.Database): Promise<void> {
  return new Promise((resolve, reject) => {
    db.run(`
      INSERT INTO geo_hierarchy (geo_type, geoid, parent_geoid, geo_name, population, land_area_sqmi)
      SELECT
        'county' as geo_type,
        state || county as geoid,
        state as parent_geoid,
        county_name as geo_name,
        population,
        NULL as land_area_sqmi
      FROM county_data
      ON CONFLICT (geo_type, geoid) DO UPDATE SET
        geo_name = EXCLUDED.geo_name,
        population = EXCLUDED.population
    `, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

function populateTractHierarchy(db: duckdb.Database): Promise<void> {
  return new Promise((resolve, reject) => {
    db.run(`
      INSERT INTO geo_hierarchy (geo_type, geoid, parent_geoid, geo_name, population, land_area_sqmi)
      SELECT
        'tract' as geo_type,
        geoid,
        state_fips || county_fips as parent_geoid,
        tract_name as geo_name,
        population,
        NULL as land_area_sqmi
      FROM tract_data
      ON CONFLICT (geo_type, geoid) DO UPDATE SET
        geo_name = EXCLUDED.geo_name,
        population = EXCLUDED.population
    `, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

function populateBlockGroupHierarchy(db: duckdb.Database): Promise<void> {
  return new Promise((resolve, reject) => {
    db.run(`
      INSERT INTO geo_hierarchy (geo_type, geoid, parent_geoid, geo_name, population, land_area_sqmi)
      SELECT
        'block_group' as geo_type,
        geoid,
        state_fips || county_fips || tract_fips as parent_geoid,
        'Block Group ' || block_group as geo_name,
        population,
        NULL as land_area_sqmi
      FROM block_group_data_expanded
      ON CONFLICT (geo_type, geoid) DO UPDATE SET
        geo_name = EXCLUDED.geo_name,
        population = EXCLUDED.population
    `, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

function getHierarchyStats(db: duckdb.Database): Promise<any> {
  return new Promise((resolve, reject) => {
    db.all(`
      SELECT
        geo_type,
        COUNT(*) as count,
        SUM(population) as total_population
      FROM geo_hierarchy
      GROUP BY geo_type
      ORDER BY
        CASE geo_type
          WHEN 'state' THEN 1
          WHEN 'county' THEN 2
          WHEN 'tract' THEN 3
          WHEN 'block_group' THEN 4
        END
    `, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

async function createGeoHierarchy(): Promise<void> {
  console.log('🗺️  Creating Geographic Hierarchy Metadata...\n');

  const db = new duckdb.Database(DB_PATH);

  try {
    // Create table
    console.log('📋 Creating geo_hierarchy table...');
    await createHierarchyTable(db);
    console.log('✅ Table created\n');

    // Populate from each level
    console.log('📊 Populating hierarchy from existing data...\n');

    console.log('  → Loading states...');
    await populateStateHierarchy(db);

    console.log('  → Loading counties...');
    await populateCountyHierarchy(db);

    console.log('  → Loading tracts...');
    await populateTractHierarchy(db);

    console.log('  → Loading block groups...');
    await populateBlockGroupHierarchy(db);

    console.log('\n✅ Hierarchy populated!\n');

    // Get stats
    const stats = await getHierarchyStats(db);

    console.log('📈 Geographic Hierarchy Summary:');
    console.log('================================\n');

    stats.forEach((row: any) => {
      const geoTypeFormatted = row.geo_type.replace('_', ' ').toUpperCase();
      const countFormatted = row.count.toLocaleString();
      const popFormatted = row.total_population.toLocaleString();
      console.log(`  ${geoTypeFormatted.padEnd(12)} ${countFormatted.padStart(10)} geographies  |  ${popFormatted.padStart(15)} total pop`);
    });

    console.log('\n================================\n');

    // Example queries
    console.log('🔍 Example Hierarchy Queries:\n');
    console.log('1. Find parent geography:');
    console.log('   SELECT parent_geoid, geo_name FROM geo_hierarchy WHERE geoid = \'06075\';\n');

    console.log('2. Find all children of a geography:');
    console.log('   SELECT geoid, geo_name FROM geo_hierarchy WHERE parent_geoid = \'06\';\n');

    console.log('3. Get full hierarchy path:');
    console.log('   WITH RECURSIVE hierarchy AS (');
    console.log('     SELECT geo_type, geoid, parent_geoid, geo_name, 1 as level');
    console.log('     FROM geo_hierarchy WHERE geoid = \'060750145001\'');
    console.log('     UNION ALL');
    console.log('     SELECT h.geo_type, h.geoid, h.parent_geoid, h.geo_name, p.level + 1');
    console.log('     FROM geo_hierarchy h JOIN hierarchy p ON h.geoid = p.parent_geoid');
    console.log('   ) SELECT * FROM hierarchy ORDER BY level DESC;\n');

    db.close();

    console.log('✨ Geographic hierarchy complete!\n');

  } catch (error) {
    console.error('❌ Error creating hierarchy:', error);
    db.close();
    throw error;
  }
}

if (require.main === module) {
  createGeoHierarchy()
    .then(() => {
      console.log('✅ Success!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Failed:', error);
      process.exit(1);
    });
}

export { createGeoHierarchy, GeoHierarchy };
