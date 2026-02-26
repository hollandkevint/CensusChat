'use client';

import React, { useState, useEffect } from 'react';
import {
  createShare,
  copyShareUrl,
  getShareUrl,
  formatExpiration,
  ExpirationOption,
  QueryResult
} from '../services/sharingService';
import {
  Share2,
  Copy,
  Check,
  X,
  Clock,
  Link2,
  ExternalLink,
  Loader2
} from 'lucide-react';

interface ShareDialogProps {
  isOpen: boolean;
  onClose: () => void;
  queryText: string;
  queryResult: QueryResult;
  category?: 'healthcare' | 'marketing' | 'demographics' | 'geographic' | 'custom';
}

export default function ShareDialog({
  isOpen,
  onClose,
  queryText,
  queryResult,
  category
}: ShareDialogProps) {
  const [expiration, setExpiration] = useState<ExpirationOption>('7d');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [shareId, setShareId] = useState<string | null>(null);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset state when dialog opens
  useEffect(() => {
    if (isOpen) {
      setShareId(null);
      setShareUrl(null);
      setCopied(false);
      setError(null);
      setTitle('');
      setDescription('');
      setExpiration('7d');
    }
  }, [isOpen]);

  const handleCreate = async () => {
    setIsCreating(true);
    setError(null);

    const result = await createShare(queryText, queryResult, {
      expiration,
      category,
      title: title || undefined,
      description: description || undefined
    });

    setIsCreating(false);

    if (result.success && result.shareId) {
      setShareId(result.shareId);
      setShareUrl(getShareUrl(result.shareId));
    } else {
      setError(result.error || 'Failed to create share');
    }
  };

  const handleCopy = async () => {
    if (shareId) {
      const success = await copyShareUrl(shareId);
      if (success) {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    }
  };

  const handleOpenInNewTab = () => {
    if (shareUrl) {
      window.open(shareUrl, '_blank');
    }
  };

  if (!isOpen) return null;

  const expirationOptions: { value: ExpirationOption; label: string }[] = [
    { value: '1h', label: '1 hour' },
    { value: '24h', label: '24 hours' },
    { value: '7d', label: '7 days' },
    { value: '30d', label: '30 days' },
    { value: 'never', label: 'Never' }
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <Share2 className="w-5 h-5 text-blue-500" />
            <h2 className="font-semibold text-gray-900 dark:text-white">
              Share Query Results
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {!shareId ? (
            <>
              {/* Query Preview */}
              <div className="bg-gray-50 dark:bg-gray-700/50 p-3 rounded-lg">
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Query</p>
                <p className="text-sm text-gray-900 dark:text-white line-clamp-2">
                  {queryText}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                  {queryResult.rowCount} rows
                </p>
              </div>

              {/* Title (optional) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Title (optional)
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Give your share a name..."
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* Description (optional) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Description (optional)
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Add context about this query..."
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                />
              </div>

              {/* Expiration */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  <Clock className="w-4 h-4 inline mr-1" />
                  Link Expiration
                </label>
                <div className="grid grid-cols-5 gap-2">
                  {expirationOptions.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => setExpiration(option.value)}
                      className={`px-2 py-1.5 text-xs rounded-lg border transition-colors ${
                        expiration === option.value
                          ? 'bg-blue-500 text-white border-blue-500'
                          : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:border-blue-400'
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Error */}
              {error && (
                <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 p-2 rounded">
                  {error}
                </div>
              )}
            </>
          ) : (
            <>
              {/* Success State */}
              <div className="text-center py-4">
                <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Check className="w-6 h-6 text-green-600 dark:text-green-400" />
                </div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-1">
                  Link Created!
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Expires {formatExpiration(expiration)}
                </p>
              </div>

              {/* Share URL */}
              <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-700/50 p-3 rounded-lg">
                <Link2 className="w-4 h-4 text-gray-400 flex-shrink-0" />
                <input
                  type="text"
                  readOnly
                  value={shareUrl || ''}
                  className="flex-1 bg-transparent text-sm text-gray-900 dark:text-white outline-none truncate"
                />
                <button
                  onClick={handleCopy}
                  className={`p-1.5 rounded transition-colors ${
                    copied
                      ? 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400'
                      : 'hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-300'
                  }`}
                  title={copied ? 'Copied!' : 'Copy to clipboard'}
                >
                  {copied ? (
                    <Check className="w-4 h-4" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </button>
                <button
                  onClick={handleOpenInNewTab}
                  className="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-300"
                  title="Open in new tab"
                >
                  <ExternalLink className="w-4 h-4" />
                </button>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-4 py-3 border-t border-gray-200 dark:border-gray-700">
          {!shareId ? (
            <>
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={isCreating}
                className="px-4 py-2 text-sm bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isCreating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Share2 className="w-4 h-4" />
                    Create Link
                  </>
                )}
              </button>
            </>
          ) : (
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm bg-blue-500 text-white rounded-lg hover:bg-blue-600"
            >
              Done
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
