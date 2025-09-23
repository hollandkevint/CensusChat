'use client';

import React from 'react';
import { ExportProgress as ExportProgressType } from '../types/export.types';
import { Loader2, CheckCircle, XCircle, Clock } from 'lucide-react';

interface ExportProgressProps {
  progress: ExportProgressType;
  onCancel?: () => void;
  className?: string;
}

export const ExportProgress: React.FC<ExportProgressProps> = ({
  progress,
  onCancel,
  className = ''
}) => {
  const getStatusIcon = () => {
    switch (progress.status) {
      case 'queued':
        return <Clock size={16} className="text-gray-500 animate-pulse" />;
      case 'processing':
        return <Loader2 size={16} className="text-blue-600 animate-spin" />;
      case 'completed':
        return <CheckCircle size={16} className="text-green-600" />;
      case 'failed':
        return <XCircle size={16} className="text-red-600" />;
      default:
        return <Clock size={16} className="text-gray-500" />;
    }
  };

  const getStatusColor = () => {
    switch (progress.status) {
      case 'queued':
        return 'text-gray-600';
      case 'processing':
        return 'text-blue-600';
      case 'completed':
        return 'text-green-600';
      case 'failed':
        return 'text-red-600';
      default:
        return 'text-gray-600';
    }
  };

  const getProgressBarColor = () => {
    switch (progress.status) {
      case 'processing':
        return 'bg-blue-600';
      case 'completed':
        return 'bg-green-600';
      case 'failed':
        return 'bg-red-600';
      default:
        return 'bg-gray-400';
    }
  };

  return (
    <div className={`w-full ${className}`}>
      {/* Status Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {getStatusIcon()}
          <span className={`text-sm font-medium capitalize ${getStatusColor()}`}>
            {progress.status}
          </span>
        </div>
        <span className="text-sm text-gray-500">
          {progress.progress}%
        </span>
      </div>

      {/* Progress Bar */}
      <div className="w-full bg-gray-200 rounded-full h-2 mb-3">
        <div
          className={`h-2 rounded-full transition-all duration-300 ${getProgressBarColor()}`}
          style={{ width: `${Math.max(0, Math.min(100, progress.progress))}%` }}
        />
      </div>

      {/* Current Step */}
      <div className="text-sm text-gray-600 mb-2">
        {progress.currentStep}
      </div>

      {/* Time Remaining */}
      {progress.estimatedTimeRemaining && progress.status === 'processing' && (
        <div className="text-xs text-gray-500 mb-2">
          Estimated time remaining: {Math.ceil(progress.estimatedTimeRemaining / 1000)} seconds
        </div>
      )}

      {/* Error Message */}
      {progress.status === 'failed' && progress.error && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md p-2 mb-3">
          {progress.error}
        </div>
      )}

      {/* Cancel Button */}
      {onCancel && (progress.status === 'queued' || progress.status === 'processing') && (
        <div className="flex justify-end">
          <button
            onClick={onCancel}
            className="text-xs px-3 py-1 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded transition-colors"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Success Actions */}
      {progress.status === 'completed' && (
        <div className="flex justify-end">
          <div className="text-xs text-green-600 font-medium">
            Export completed successfully!
          </div>
        </div>
      )}
    </div>
  );
};


