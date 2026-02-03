/**
 * Agent Session Manager
 * Tracks session IDs from Agent SDK for conversational context persistence
 * Enables follow-up queries like "Now filter to income > $75K" that reference prior context
 */

export interface SessionContext {
  sessionId: string;
  userId?: string;
  createdAt: Date;
  lastAccessedAt: Date;
  queryCount: number;
  lastQuery?: string;
  lastResult?: unknown;
}

/**
 * In-memory session manager
 * For production, consider Redis persistence
 */
export class AgentSessionManager {
  private sessions: Map<string, SessionContext> = new Map();
  private userToSession: Map<string, string> = new Map();
  private maxSessions: number;
  private sessionTTLMs: number;

  constructor(options?: { maxSessions?: number; sessionTTLMs?: number }) {
    this.maxSessions = options?.maxSessions || 1000;
    this.sessionTTLMs = options?.sessionTTLMs || 30 * 60 * 1000; // 30 minutes default
  }

  /**
   * Get or create session for a user
   * Returns existing session ID if user has active session
   */
  getOrCreateSession(userId: string): string {
    // Check for existing session
    const existingSessionId = this.userToSession.get(userId);
    if (existingSessionId) {
      const session = this.sessions.get(existingSessionId);
      if (session && !this.isExpired(session)) {
        session.lastAccessedAt = new Date();
        return existingSessionId;
      }
      // Expired, clean up
      this.deleteSession(existingSessionId);
    }

    // No session yet - return empty string, will be set after first query
    return "";
  }

  /**
   * Store session ID from Agent SDK response
   */
  storeSession(
    userId: string,
    sessionId: string,
    query?: string,
    result?: unknown
  ): void {
    // Clean up old sessions if at capacity
    if (this.sessions.size >= this.maxSessions) {
      this.cleanupOldestSessions();
    }

    const now = new Date();
    const existing = this.sessions.get(sessionId);

    if (existing) {
      existing.lastAccessedAt = now;
      existing.queryCount++;
      existing.lastQuery = query;
      existing.lastResult = result;
    } else {
      this.sessions.set(sessionId, {
        sessionId,
        userId,
        createdAt: now,
        lastAccessedAt: now,
        queryCount: 1,
        lastQuery: query,
        lastResult: result,
      });
      this.userToSession.set(userId, sessionId);
    }
  }

  /**
   * Get session context
   */
  getSession(sessionId: string): SessionContext | undefined {
    const session = this.sessions.get(sessionId);
    if (session && !this.isExpired(session)) {
      return session;
    }
    return undefined;
  }

  /**
   * Get session ID for user
   */
  getSessionIdForUser(userId: string): string | undefined {
    const sessionId = this.userToSession.get(userId);
    if (sessionId) {
      const session = this.sessions.get(sessionId);
      if (session && !this.isExpired(session)) {
        return sessionId;
      }
    }
    return undefined;
  }

  /**
   * Delete a session
   */
  deleteSession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session?.userId) {
      this.userToSession.delete(session.userId);
    }
    this.sessions.delete(sessionId);
  }

  /**
   * Clear all sessions for a user (logout)
   */
  clearUserSessions(userId: string): void {
    const sessionId = this.userToSession.get(userId);
    if (sessionId) {
      this.deleteSession(sessionId);
    }
  }

  /**
   * Get session stats
   */
  getStats(): { activeSessions: number; totalQueries: number } {
    let totalQueries = 0;
    for (const session of this.sessions.values()) {
      if (!this.isExpired(session)) {
        totalQueries += session.queryCount;
      }
    }
    return {
      activeSessions: this.sessions.size,
      totalQueries,
    };
  }

  private isExpired(session: SessionContext): boolean {
    return Date.now() - session.lastAccessedAt.getTime() > this.sessionTTLMs;
  }

  private cleanupOldestSessions(): void {
    const sorted = [...this.sessions.entries()].sort(
      (a, b) => a[1].lastAccessedAt.getTime() - b[1].lastAccessedAt.getTime()
    );
    // Remove oldest 10%
    const toRemove = Math.ceil(sorted.length * 0.1);
    for (let i = 0; i < toRemove; i++) {
      this.deleteSession(sorted[i][0]);
    }
  }
}

// Singleton instance
let sessionManagerInstance: AgentSessionManager | null = null;

export function getSessionManager(): AgentSessionManager {
  if (!sessionManagerInstance) {
    sessionManagerInstance = new AgentSessionManager();
  }
  return sessionManagerInstance;
}
