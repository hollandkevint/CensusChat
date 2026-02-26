'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import {
  getShare,
  SharedQuery,
  formatExpiresAt
} from '../../../services/sharingService';
import {
  Share2,
  Clock,
  Eye,
  Calendar,
  Table,
  ArrowLeft,
  Loader2,
  AlertCircle,
  Stethoscope,
  BarChart3,
  Users,
  MapPin
} from 'lucide-react';
import Link from 'next/link';

const categoryIcons: Record<string, React.ReactNode> = {
  healthcare: <Stethoscope className="w-4 h-4" />,
  marketing: <BarChart3 className="w-4 h-4" />,
  demographics: <Users className="w-4 h-4" />,
  geographic: <MapPin className="w-4 h-4" />
};

const categoryColors: Record<string, string> = {
  healthcare: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  marketing: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  demographics: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  geographic: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  custom: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
};

export default function SharedQueryPage() {
  const params = useParams();
  const shareId = params.shareId as string;

  const [share, setShare] = useState<SharedQuery | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadShare() {
      if (!shareId) return;

      setLoading(true);
      const result = await getShare(shareId);

      if (result.success && result.share) {
        setShare(result.share);
      } else {
        setError(result.error || 'Share not found or expired');
      }
      setLoading(false);
    }

    loadShare();
  }, [shareId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">Loading shared query...</p>
        </div>
      </div>
    );
  }

  if (error || !share) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center max-w-md mx-4">
          <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-red-500" />
          </div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            Share Not Found
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            {error || 'This shared link may have expired or been deleted.'}
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
          >
            <ArrowLeft className="w-4 h-4" />
            Go to CensusChat
          </Link>
        </div>
      </div>
    );
  }

  const formattedDate = new Date(share.createdAt).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link
              href="/"
              className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="text-sm">Back to CensusChat</span>
            </Link>
            <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
              <Share2 className="w-4 h-4" />
              <span>Shared Query</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Title & Meta */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h1 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                {share.title || 'Shared Census Query'}
              </h1>
              {share.description && (
                <p className="text-gray-600 dark:text-gray-400 mb-4">
                  {share.description}
                </p>
              )}
            </div>
            {share.category && (
              <span className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-sm ${categoryColors[share.category]}`}>
                {categoryIcons[share.category]}
                <span className="capitalize">{share.category}</span>
              </span>
            )}
          </div>

          {/* Query Text */}
          <div className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg mb-4">
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Query</p>
            <p className="text-gray-900 dark:text-white">{share.queryText}</p>
          </div>

          {/* Meta Info */}
          <div className="flex flex-wrap gap-4 text-sm text-gray-500 dark:text-gray-400">
            <span className="flex items-center gap-1.5">
              <Calendar className="w-4 h-4" />
              Created {formattedDate}
            </span>
            <span className="flex items-center gap-1.5">
              <Clock className="w-4 h-4" />
              {formatExpiresAt(share.expiresAt)}
            </span>
            <span className="flex items-center gap-1.5">
              <Eye className="w-4 h-4" />
              {share.viewCount} view{share.viewCount !== 1 ? 's' : ''}
            </span>
            <span className="flex items-center gap-1.5">
              <Table className="w-4 h-4" />
              {share.queryResult.rowCount} rows
            </span>
          </div>
        </div>

        {/* Results Table */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="font-medium text-gray-900 dark:text-white">
              Query Results
            </h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700/50">
                <tr>
                  {share.queryResult.columns.map((column) => (
                    <th
                      key={column}
                      className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
                    >
                      {column}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {share.queryResult.data.slice(0, 100).map((row, rowIndex) => (
                  <tr
                    key={rowIndex}
                    className="hover:bg-gray-50 dark:hover:bg-gray-700/50"
                  >
                    {share.queryResult.columns.map((column) => (
                      <td
                        key={`${rowIndex}-${column}`}
                        className="px-4 py-3 text-sm text-gray-900 dark:text-white whitespace-nowrap"
                      >
                        {formatCellValue(row[column])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {share.queryResult.rowCount > 100 && (
            <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 text-center">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Showing 100 of {share.queryResult.rowCount} rows
              </p>
            </div>
          )}
        </div>

        {/* SQL Preview (if available) */}
        {share.queryResult.sql && (
          <div className="mt-6 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="font-medium text-gray-900 dark:text-white">
                Generated SQL
              </h2>
            </div>
            <div className="p-6">
              <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-sm">
                <code>{share.queryResult.sql}</code>
              </pre>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="max-w-7xl mx-auto px-4 py-8 text-center">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Powered by{' '}
          <Link href="/" className="text-blue-500 hover:underline">
            CensusChat
          </Link>
          {' '}- Natural Language Interface for US Census Data
        </p>
      </footer>
    </div>
  );
}

function formatCellValue(value: unknown): string {
  if (value === null || value === undefined) {
    return '-';
  }
  if (typeof value === 'number') {
    // Format numbers with commas
    return value.toLocaleString();
  }
  return String(value);
}
