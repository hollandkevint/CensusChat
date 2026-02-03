/**
 * MCP HTTP Transport Routes
 * Implements Streamable HTTP transport endpoints for MCP protocol
 * POST /mcp - Handle JSON-RPC requests
 * GET /mcp - SSE stream for server-initiated messages
 * DELETE /mcp - Terminate session
 */

import { Router, Request, Response } from 'express';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import { getSessionManager } from './mcpSessionManager';

const router = Router();

/**
 * POST /mcp - Handle MCP JSON-RPC requests
 * Creates new session on initialize, routes to existing session otherwise
 */
router.post('/', async (req: Request, res: Response) => {
  const sessionId = req.headers['mcp-session-id'] as string | undefined;
  const manager = getSessionManager();

  try {
    // Existing session - route request to it
    if (sessionId) {
      const session = manager.getSession(sessionId);
      if (session) {
        await session.transport.handleRequest(req, res, req.body);
        return;
      }

      // Session not found
      res.status(400).json({
        jsonrpc: '2.0',
        error: { code: -32600, message: 'Invalid session ID' },
        id: req.body?.id ?? null,
      });
      return;
    }

    // New session initialization
    if (isInitializeRequest(req.body)) {
      const { transport, server } = manager.createSession();

      // Connect server to transport
      await server.connect(transport);

      // Handle the initialize request (transport adds Mcp-Session-Id header)
      await transport.handleRequest(req, res, req.body);
      return;
    }

    // Invalid request - no session ID and not an initialize request
    res.status(400).json({
      jsonrpc: '2.0',
      error: { code: -32600, message: 'Missing session ID or not an initialize request' },
      id: req.body?.id ?? null,
    });
  } catch (error) {
    console.error('[MCP] POST handler error:', error);
    res.status(500).json({
      jsonrpc: '2.0',
      error: { code: -32603, message: 'Internal error' },
      id: req.body?.id ?? null,
    });
  }
});

/**
 * GET /mcp - SSE stream for server-initiated messages
 * Requires existing session ID
 */
router.get('/', async (req: Request, res: Response) => {
  const sessionId = req.headers['mcp-session-id'] as string | undefined;

  if (!sessionId) {
    res.status(400).json({ error: 'Missing Mcp-Session-Id header' });
    return;
  }

  const session = getSessionManager().getSession(sessionId);
  if (!session) {
    res.status(400).json({ error: 'Invalid session ID' });
    return;
  }

  try {
    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Prevent Nginx buffering

    await session.transport.handleRequest(req, res);
  } catch (error) {
    console.error('[MCP] GET handler error:', error);
    // Can't send JSON error if headers already sent
    if (!res.headersSent) {
      res.status(500).json({ error: 'SSE connection failed' });
    }
  }
});

/**
 * DELETE /mcp - Terminate session
 * Cleans up server and transport resources
 */
router.delete('/', async (req: Request, res: Response) => {
  const sessionId = req.headers['mcp-session-id'] as string | undefined;

  if (!sessionId) {
    res.status(400).json({ error: 'Missing Mcp-Session-Id header' });
    return;
  }

  const deleted = getSessionManager().deleteSession(sessionId);
  if (!deleted) {
    res.status(404).json({ error: 'Session not found' });
    return;
  }

  res.status(204).send();
});

export { router as mcpTransportRouter };
