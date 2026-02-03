/**
 * MCP Session Manager
 * Manages HTTP transport sessions for StreamableHTTPServerTransport
 * Provides session lifecycle: create, get, delete, cleanup
 */

import { randomUUID } from 'node:crypto';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { createMcpServer } from './mcpServer';

interface McpSession {
  transport: StreamableHTTPServerTransport;
  server: McpServer;
  createdAt: Date;
  lastAccess: Date;
}

// Session TTL: 30 minutes
const SESSION_TTL_MS = 30 * 60 * 1000;
// Cleanup interval: 5 minutes
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;

export class McpSessionManager {
  private sessions: Map<string, McpSession> = new Map();
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.startCleanupTimer();
  }

  /**
   * Create a new MCP session
   * Returns the session ID, transport, and server
   */
  createSession(): { sessionId: string; transport: StreamableHTTPServerTransport; server: McpServer } {
    const sessionId = randomUUID();

    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => sessionId,
    });

    const server = createMcpServer(sessionId);

    // Register cleanup on transport close
    transport.onclose = () => {
      this.deleteSession(sessionId);
    };

    const session: McpSession = {
      transport,
      server,
      createdAt: new Date(),
      lastAccess: new Date(),
    };

    this.sessions.set(sessionId, session);

    console.log(`[MCP] Session created: ${sessionId} (total: ${this.sessions.size})`);

    return { sessionId, transport, server };
  }

  /**
   * Get an existing session by ID
   * Updates lastAccess timestamp
   */
  getSession(sessionId: string): { transport: StreamableHTTPServerTransport; server: McpServer } | undefined {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return undefined;
    }

    // Update last access time
    session.lastAccess = new Date();
    return { transport: session.transport, server: session.server };
  }

  /**
   * Delete a session and cleanup resources
   */
  deleteSession(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return false;
    }

    // Close the server connection
    session.server.close().catch((err) => {
      console.error(`[MCP] Error closing server for session ${sessionId}:`, err);
    });

    this.sessions.delete(sessionId);
    console.log(`[MCP] Session deleted: ${sessionId} (remaining: ${this.sessions.size})`);
    return true;
  }

  /**
   * Get the count of active sessions
   */
  getSessionCount(): number {
    return this.sessions.size;
  }

  /**
   * Clean up expired sessions
   */
  private cleanupExpiredSessions(): void {
    const now = Date.now();
    const expiredSessions: string[] = [];

    for (const [sessionId, session] of this.sessions) {
      const age = now - session.lastAccess.getTime();
      if (age > SESSION_TTL_MS) {
        expiredSessions.push(sessionId);
      }
    }

    for (const sessionId of expiredSessions) {
      console.log(`[MCP] Session expired: ${sessionId}`);
      this.deleteSession(sessionId);
    }

    if (expiredSessions.length > 0) {
      console.log(`[MCP] Cleaned up ${expiredSessions.length} expired sessions`);
    }
  }

  /**
   * Start the periodic cleanup timer
   */
  private startCleanupTimer(): void {
    if (this.cleanupInterval) {
      return;
    }

    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredSessions();
    }, CLEANUP_INTERVAL_MS);

    // Don't keep process alive just for cleanup
    this.cleanupInterval.unref();
  }

  /**
   * Stop the cleanup timer and close all sessions
   */
  async shutdown(): Promise<void> {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    // Close all sessions
    const sessionIds = Array.from(this.sessions.keys());
    for (const sessionId of sessionIds) {
      this.deleteSession(sessionId);
    }

    console.log('[MCP] Session manager shut down');
  }
}

// Singleton instance
let sessionManagerInstance: McpSessionManager | null = null;

/**
 * Get the singleton session manager instance
 */
export function getSessionManager(): McpSessionManager {
  if (!sessionManagerInstance) {
    sessionManagerInstance = new McpSessionManager();
  }
  return sessionManagerInstance;
}

/**
 * Shutdown the session manager (for graceful shutdown)
 */
export async function shutdownSessionManager(): Promise<void> {
  if (sessionManagerInstance) {
    await sessionManagerInstance.shutdown();
    sessionManagerInstance = null;
  }
}
