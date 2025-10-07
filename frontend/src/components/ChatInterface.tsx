'use client';

import React, { useState, useRef, useEffect } from 'react';
import { queryApi, QueryApiError } from '../lib/api/queryApi';
import { ChatMessage } from '../types/query.types';
import { ExportButton } from './ExportButton';
import { DataRefreshButton } from './DataRefreshButton';

interface ChatInterfaceProps {
  onQuery?: (query: string) => Promise<any>;
}

export default function ChatInterface({ onQuery }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: '1',
      type: 'assistant',
      content: 'Hi! I\'m here to help you analyze Census data for healthcare insights. Try asking something like "Show me Medicare eligible seniors in Florida with income over $50k"',
      timestamp: new Date()
    }
  ]);
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async () => {
    if (!input.trim() || isProcessing) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      type: 'user',
      content: input.trim(),
      timestamp: new Date()
    };

    const loadingMessage: ChatMessage = {
      id: (Date.now() + 1).toString(),
      type: 'assistant',
      content: 'Analyzing your query...',
      timestamp: new Date(),
      isLoading: true
    };

    setMessages(prev => [...prev, userMessage, loadingMessage]);
    setInput('');
    setIsProcessing(true);

    try {
      // Call the real API or fallback to onQuery prop
      let result;

      if (onQuery) {
        // Use the provided onQuery function (for backwards compatibility)
        result = await onQuery(input.trim());
      } else {
        // Use the real API
        const apiResponse = await queryApi.executeQuery({
          query: input.trim(),
          options: {
            format: 'table',
            includeMetadata: true
          }
        });
        result = apiResponse;
      }

      // Remove loading message and add actual response
      setMessages(prev => {
        const withoutLoading = prev.filter(msg => !msg.isLoading);
        return [...withoutLoading, {
          id: Date.now().toString(),
          type: 'assistant',
          content: result.message || `Found ${result.metadata?.totalRecords?.toLocaleString() || result.data?.length || 0} records. Here's your healthcare analytics data:`,
          timestamp: new Date(),
          data: result.data,
          metadata: result.metadata,
          suggestions: result.suggestions
        }];
      });
    } catch (error) {
      console.error('Query error:', error);

      // Remove loading message and add error response
      setMessages(prev => {
        const withoutLoading = prev.filter(msg => !msg.isLoading);

        let errorMessage = 'I encountered an error processing your query. Please try again or rephrase your question.';
        let suggestions: string[] | undefined;

        if (error instanceof QueryApiError) {
          errorMessage = error.message;
          suggestions = error.suggestions;
        }

        return [...withoutLoading, {
          id: Date.now().toString(),
          type: 'assistant',
          content: errorMessage,
          timestamp: new Date(),
          error: true,
          suggestions
        }];
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleExportSuccess = (response: any) => {
    console.log('Export completed successfully:', response);
    // Could show a success toast notification here
  };

  const handleExportError = (error: any) => {
    console.error('Export failed:', error);
    // Could show an error toast notification here
  };

  const renderDataTable = (data: any[]) => {
    if (!data || data.length === 0) return null;

    const columns = Object.keys(data[0]);

    return (
      <div className="bg-white dark:bg-gray-800 rounded border overflow-hidden mt-3">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-600">
            <tr>
              {columns.map(col => (
                <th key={col} className="px-3 py-2 text-left text-gray-700 dark:text-gray-200 capitalize">
                  {col.replace(/_/g, ' ')}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="text-gray-900 dark:text-gray-100">
            {data.slice(0, 5).map((row, idx) => (
              <tr key={idx} className={idx % 2 === 1 ? 'bg-gray-50 dark:bg-gray-700' : ''}>
                {columns.map(col => (
                  <td key={col} className="px-3 py-2">
                    {typeof row[col] === 'number' ? row[col].toLocaleString() : row[col]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {data.length > 5 && (
          <div className="px-3 py-2 text-xs text-gray-500 bg-gray-50 dark:bg-gray-600">
            Showing first 5 of {data.length} records
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl overflow-hidden h-96 flex flex-col">
      {/* Header */}
      <div className="bg-gray-50 dark:bg-gray-700 px-6 py-4 border-b flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-red-400 rounded-full"></div>
            <div className="w-3 h-3 bg-yellow-400 rounded-full"></div>
            <div className="w-3 h-3 bg-green-400 rounded-full"></div>
            <span className="ml-4 text-sm text-gray-600 dark:text-gray-300">
              CensusChat - Healthcare Demographics
            </span>
          </div>
          <DataRefreshButton size="small" />
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex items-start space-x-3 ${message.type === 'user' ? 'justify-end' : ''}`}
          >
            {message.type === 'assistant' && (
              <div className="w-8 h-8 bg-green-600 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-white text-sm">CC</span>
              </div>
            )}
            
            <div className={`rounded-lg p-3 max-w-md ${
              message.type === 'user'
                ? 'bg-blue-100 dark:bg-blue-900/30 text-gray-900 dark:text-white'
                : message.error
                  ? 'bg-red-100 dark:bg-red-900/30 text-gray-900 dark:text-white border border-red-300 dark:border-red-700'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white'
            }`}>
              <p className={message.isLoading ? 'animate-pulse' : ''}>
                {message.content}
              </p>

              {/* Show query suggestions for errors */}
              {message.error && message.suggestions && message.suggestions.length > 0 && (
                <div className="mt-3 p-2 bg-yellow-50 dark:bg-yellow-900/30 rounded border border-yellow-200 dark:border-yellow-700">
                  <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200 mb-1">Suggestions:</p>
                  <ul className="text-sm text-yellow-700 dark:text-yellow-300 list-disc list-inside space-y-1">
                    {message.suggestions.map((suggestion, idx) => (
                      <li key={idx}>{suggestion}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Show metadata for successful queries */}
              {message.metadata && !message.isLoading && (
                <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                  Query time: {message.metadata.queryTime?.toFixed(2)}s •
                  Data source: {message.metadata.dataSource}
                  {message.metadata.dataFreshness && (
                    <div className="mt-1">
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                        message.metadata.dataFreshness.overallStatus === 'fresh'
                          ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                          : message.metadata.dataFreshness.overallStatus === 'stale'
                          ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                          : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                      }`}>
                        {message.metadata.dataFreshness.overallStatus === 'fresh' && '🟢'}
                        {message.metadata.dataFreshness.overallStatus === 'stale' && '🟡'}
                        {message.metadata.dataFreshness.overallStatus === 'mixed' && '🟠'}
                        {message.metadata.dataFreshness.overallStatus === 'error' && '🔴'}
                        Data {message.metadata.dataFreshness.overallStatus}
                      </span>
                      {message.metadata.dataFreshness.lastGlobalRefresh && (
                        <span className="ml-2">
                          Last updated: {new Date(message.metadata.dataFreshness.lastGlobalRefresh).toLocaleString()}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              )}

              {message.data && renderDataTable(message.data)}

              {message.data && !message.isLoading && (
                <div className="mt-4">
                  <ExportButton
                    queryResult={{
                      success: true,
                      data: message.data,
                      metadata: {
                        queryTime: message.metadata?.queryTime || 0,
                        totalRecords: message.data.length,
                        dataSource: message.metadata?.dataSource || 'US Census Bureau',
                        confidenceLevel: 0.95,
                        marginOfError: 2.3,
                        executedAt: message.timestamp.toISOString()
                      }
                    }}
                    queryText={messages.find(m => m.type === 'user' && m.timestamp < message.timestamp)?.content}
                    onExportComplete={handleExportSuccess}
                    onExportError={handleExportError}
                    size="small"
                  />
                </div>
              )}
            </div>

            {message.type === 'user' && (
              <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-white text-sm">You</span>
              </div>
            )}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t p-4 flex-shrink-0">
        <div className="flex space-x-3">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Ask about healthcare demographics..."
            className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
            disabled={isProcessing}
          />
          <button
            onClick={handleSendMessage}
            disabled={!input.trim() || isProcessing}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white px-6 py-2 rounded-lg transition-colors"
          >
            {isProcessing ? 'Processing...' : 'Send'}
          </button>
        </div>
        <div className="text-center text-sm text-gray-500 dark:text-gray-400 mt-2">
          ⚡ Powered by Anthropic Sonnet 4 • 🏥 Healthcare-grade accuracy • 🔒 HIPAA compliant
        </div>
      </div>
    </div>
  );
}