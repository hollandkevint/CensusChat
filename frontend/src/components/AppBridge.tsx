'use client';

/**
 * AppBridge Component
 * Renders MCP Apps in sandboxed iframes with postMessage communication
 *
 * Security: iframe uses sandbox="allow-scripts" (NOT allow-same-origin)
 * This prevents the app from accessing the parent window's DOM or storage
 */

import { useEffect, useRef, useState, useCallback } from 'react';

/**
 * Parameters for drill-down requests from MCP Apps
 */
export interface DrillDownParams {
  query?: string;
  filters?: Record<string, unknown>;
  groupBy?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  limit?: number;
}

/**
 * Messages received from the iframe app
 */
interface AppMessage {
  type: 'ui/ready' | 'ui/message' | 'ui/drill-down' | 'ui/error';
  payload?: unknown;
}

/**
 * Props for the AppBridge component
 */
interface AppBridgeProps {
  /** UI resource URI (e.g., ui://censuschat/data-table.html) */
  resourceUri: string;
  /** HTML content to render in iframe */
  resourceHtml: string;
  /** Tool result data to pass to the app */
  toolResult: unknown;
  /** Callback for messages from the app */
  onMessage?: (message: unknown) => void;
  /** Callback for drill-down requests */
  onDrillDown?: (params: DrillDownParams) => void;
  /** Additional CSS classes */
  className?: string;
  /** Height of the iframe (default: 24rem) */
  height?: string;
}

/**
 * AppBridge renders an MCP App in a sandboxed iframe
 * Handles bidirectional postMessage communication
 */
export function AppBridge({
  resourceUri,
  resourceHtml,
  toolResult,
  onMessage,
  onDrillDown,
  className = '',
  height = '24rem',
}: AppBridgeProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Send tool result to the iframe when it's ready
   */
  const sendToolResult = useCallback(() => {
    if (!iframeRef.current?.contentWindow) {
      return;
    }

    try {
      iframeRef.current.contentWindow.postMessage(
        {
          type: 'tool-result',
          payload: toolResult,
        },
        '*' // Target origin is '*' because sandboxed iframes have opaque origin
      );
    } catch (err) {
      console.error('[AppBridge] Failed to send tool result:', err);
      setError('Failed to communicate with app');
    }
  }, [toolResult]);

  /**
   * Handle messages from the iframe
   */
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // Verify the message is from our iframe
      if (iframeRef.current && event.source !== iframeRef.current.contentWindow) {
        return;
      }

      const message = event.data as AppMessage;

      if (!message || typeof message.type !== 'string') {
        return;
      }

      switch (message.type) {
        case 'ui/ready':
          console.log('[AppBridge] App ready, sending tool result');
          setIsReady(true);
          sendToolResult();
          break;

        case 'ui/message':
          if (onMessage) {
            onMessage(message.payload);
          }
          break;

        case 'ui/drill-down':
          if (onDrillDown && message.payload) {
            onDrillDown(message.payload as DrillDownParams);
          }
          break;

        case 'ui/error':
          console.error('[AppBridge] App error:', message.payload);
          setError(String(message.payload));
          break;

        default:
          console.warn('[AppBridge] Unknown message type:', message.type);
      }
    };

    window.addEventListener('message', handleMessage);

    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, [sendToolResult, onMessage, onDrillDown]);

  /**
   * Re-send tool result when it changes and app is ready
   */
  useEffect(() => {
    if (isReady) {
      sendToolResult();
    }
  }, [isReady, sendToolResult]);

  if (error) {
    return (
      <div
        className={`flex items-center justify-center bg-red-50 border border-red-200 rounded-lg ${className}`}
        style={{ height }}
      >
        <div className="text-center p-4">
          <p className="text-red-600 font-medium">App Error</p>
          <p className="text-red-500 text-sm mt-1">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative ${className}`}>
      {/* Loading indicator while app initializes */}
      {!isReady && (
        <div
          className="absolute inset-0 flex items-center justify-center bg-gray-50 rounded-lg"
          style={{ height }}
        >
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto" />
            <p className="text-gray-500 text-sm mt-2">Loading app...</p>
          </div>
        </div>
      )}

      {/* Sandboxed iframe for MCP App */}
      <iframe
        ref={iframeRef}
        title={`MCP App: ${resourceUri}`}
        srcDoc={resourceHtml}
        sandbox="allow-scripts"
        className={`w-full border border-gray-200 rounded-lg transition-opacity duration-200 ${
          isReady ? 'opacity-100' : 'opacity-0'
        }`}
        style={{ height }}
      />
    </div>
  );
}

export default AppBridge;
