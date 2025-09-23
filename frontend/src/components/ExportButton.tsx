'use client';

import React, { useState } from 'react';
import { Download, FileSpreadsheet, FileText, X, AlertCircle } from 'lucide-react';
import { useExport } from '../hooks/useExport';
import { ExportProgress } from './ExportProgress';
import { formatFileSize } from '../lib/api/exportApi';
import { ExportButtonProps } from '../types/export.types';

export const ExportButton: React.FC<ExportButtonProps> = ({
  queryResult,
  queryText,
  onExportStart,
  onExportComplete,
  onExportError,
  disabled = false,
  size = 'medium',
  className = ''
}) => {
  const [showDropdown, setShowDropdown] = useState(false);
  const [showProgress, setShowProgress] = useState(false);

  const { 
    isExporting, 
    progress, 
    error, 
    exportToExcel, 
    exportToCSV, 
    clearError, 
    cancelExport 
  } = useExport({
    onSuccess: (response) => {
      setShowProgress(false);
      onExportComplete?.(response);
    },
    onError: (error) => {
      setShowProgress(false);
      onExportError?.(error);
    },
    onProgress: () => {
      if (!showProgress) setShowProgress(true);
    }
  });

  const handleExportToExcel = async () => {
    setShowDropdown(false);
    onExportStart?.();
    await exportToExcel(queryResult, {}, queryText);
  };

  const handleExportToCSV = async () => {
    setShowDropdown(false);
    onExportStart?.();
    await exportToCSV(queryResult, queryText);
  };

  const handleCancelExport = () => {
    cancelExport();
    setShowProgress(false);
  };

  const sizeClasses = {
    small: 'px-2 py-1 text-xs',
    medium: 'px-3 py-2 text-sm',
    large: 'px-4 py-3 text-base'
  };

  const iconSizes = {
    small: 14,
    medium: 16,
    large: 20
  };

  // Don't render if no data
  if (!queryResult?.data || !Array.isArray(queryResult.data) || queryResult.data.length === 0) {
    return null;
  }

  return (
    <div className={`relative inline-block ${className}`}>
      {/* Main Export Button */}
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        disabled={disabled || isExporting}
        className={`
          inline-flex items-center gap-2 rounded-lg font-medium transition-all duration-200
          ${sizeClasses[size]}
          ${disabled || isExporting
            ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
            : 'bg-blue-600 hover:bg-blue-700 text-white shadow-sm hover:shadow-md'
          }
          focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
        `}
      >
        <Download size={iconSizes[size]} />
        {isExporting ? 'Exporting...' : 'Export'}
        {!disabled && !isExporting && (
          <svg
            className={`transition-transform duration-200 ${showDropdown ? 'rotate-180' : ''}`}
            width="12"
            height="12"
            viewBox="0 0 12 12"
            fill="none"
          >
            <path
              d="M3 4.5L6 7.5L9 4.5"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </button>

      {/* Export Options Dropdown */}
      {showDropdown && !isExporting && (
        <div className="absolute top-full left-0 mt-1 w-64 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
          <div className="p-2">
            <div className="text-xs text-gray-500 mb-2 px-2">
              Export {queryResult.data.length.toLocaleString()} rows
            </div>
            
            <button
              onClick={handleExportToExcel}
              className="w-full flex items-center gap-3 px-3 py-2 text-sm text-left hover:bg-gray-50 rounded-md transition-colors"
            >
              <FileSpreadsheet size={16} className="text-green-600" />
              <div>
                <div className="font-medium text-gray-900">Excel (.xlsx)</div>
                <div className="text-xs text-gray-500">
                  Professional format with metadata and formatting
                </div>
              </div>
            </button>

            <button
              onClick={handleExportToCSV}
              className="w-full flex items-center gap-3 px-3 py-2 text-sm text-left hover:bg-gray-50 rounded-md transition-colors"
            >
              <FileText size={16} className="text-blue-600" />
              <div>
                <div className="font-medium text-gray-900">CSV (.csv)</div>
                <div className="text-xs text-gray-500">
                  Simple format for data analysis tools
                </div>
              </div>
            </button>
          </div>
        </div>
      )}

      {/* Progress Modal */}
      {showProgress && progress && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96 max-w-[90vw]">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900">Exporting Data</h3>
              <button
                onClick={handleCancelExport}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <ExportProgress
              progress={progress}
              onCancel={handleCancelExport}
              className="mb-4"
            />

            <div className="text-sm text-gray-600">
              <div className="flex justify-between mb-1">
                <span>Status:</span>
                <span className="capitalize font-medium">{progress.status}</span>
              </div>
              <div className="flex justify-between mb-1">
                <span>Progress:</span>
                <span className="font-medium">{progress.progress}%</span>
              </div>
              {progress.estimatedTimeRemaining && (
                <div className="flex justify-between">
                  <span>Time remaining:</span>
                  <span className="font-medium">
                    {Math.ceil(progress.estimatedTimeRemaining / 1000)}s
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Error Display */}
      {error && !showProgress && (
        <div className="absolute top-full left-0 mt-1 w-80 bg-red-50 border border-red-200 rounded-lg p-3 z-50">
          <div className="flex items-start gap-2">
            <AlertCircle size={16} className="text-red-600 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <div className="text-sm font-medium text-red-800 mb-1">
                Export Failed
              </div>
              <div className="text-xs text-red-700 mb-2">
                {error.message}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={clearError}
                  className="text-xs px-2 py-1 bg-red-100 hover:bg-red-200 text-red-800 rounded transition-colors"
                >
                  Dismiss
                </button>
                {error.code !== 'NO_DATA' && error.code !== 'INVALID_DATA' && (
                  <button
                    onClick={handleExportToCSV}
                    className="text-xs px-2 py-1 bg-blue-100 hover:bg-blue-200 text-blue-800 rounded transition-colors"
                  >
                    Try CSV
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Click outside to close dropdown */}
      {showDropdown && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setShowDropdown(false)}
        />
      )}
    </div>
  );
};


