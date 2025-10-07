'use client';

import React, { useState } from 'react';
import { RefreshCw, CheckCircle, AlertCircle, Clock } from 'lucide-react';

interface DataRefreshStatus {
  status: 'idle' | 'refreshing' | 'success' | 'error';
  duration?: number;
  recordsUpdated?: number;
  estimatedTimeRemaining?: number;
  error?: string;
}

interface DataRefreshButtonProps {
  onRefresh?: () => Promise<void>;
  disabled?: boolean;
  size?: 'small' | 'medium' | 'large';
  className?: string;
}

export function DataRefreshButton({
  onRefresh,
  disabled = false,
  size = 'medium',
  className = ''
}: DataRefreshButtonProps) {
  const [refreshStatus, setRefreshStatus] = useState<DataRefreshStatus>({ status: 'idle' });
  const [showConfirmation, setShowConfirmation] = useState(false);

  const sizeClasses = {
    small: 'px-3 py-1 text-sm',
    medium: 'px-4 py-2',
    large: 'px-6 py-3 text-lg'
  };

  const handleRefreshClick = () => {
    if (refreshStatus.status === 'refreshing') return;
    setShowConfirmation(true);
  };

  const handleConfirmRefresh = async () => {
    setShowConfirmation(false);
    setRefreshStatus({ status: 'refreshing', estimatedTimeRemaining: 30 });

    // Simulate countdown timer
    const countdown = setInterval(() => {
      setRefreshStatus(prev => ({
        ...prev,
        estimatedTimeRemaining: Math.max(0, (prev.estimatedTimeRemaining || 30) - 1)
      }));
    }, 1000);

    try {
      const startTime = Date.now();

      if (onRefresh) {
        await onRefresh();
      } else {
        // Default refresh implementation - call the API
        const response = await fetch('/api/data/refresh', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        });

        if (!response.ok) {
          throw new Error(`Refresh failed: ${response.statusText}`);
        }

        const result = await response.json();

        clearInterval(countdown);
        setRefreshStatus({
          status: 'success',
          duration: Date.now() - startTime,
          recordsUpdated: result.recordsUpdated || 0
        });
      }
    } catch (error) {
      clearInterval(countdown);
      setRefreshStatus({
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      });
    }

    // Auto-reset to idle after 5 seconds on success/error
    setTimeout(() => {
      setRefreshStatus({ status: 'idle' });
    }, 5000);
  };

  const handleCancelConfirmation = () => {
    setShowConfirmation(false);
  };

  const renderIcon = () => {
    switch (refreshStatus.status) {
      case 'refreshing':
        return <RefreshCw className="animate-spin" size={size === 'small' ? 14 : size === 'large' ? 20 : 16} />;
      case 'success':
        return <CheckCircle size={size === 'small' ? 14 : size === 'large' ? 20 : 16} className="text-green-500" />;
      case 'error':
        return <AlertCircle size={size === 'small' ? 14 : size === 'large' ? 20 : 16} className="text-red-500" />;
      default:
        return <RefreshCw size={size === 'small' ? 14 : size === 'large' ? 20 : 16} />;
    }
  };

  const renderButtonText = () => {
    switch (refreshStatus.status) {
      case 'refreshing':
        return `Refreshing... (${refreshStatus.estimatedTimeRemaining}s)`;
      case 'success':
        return `Updated ${refreshStatus.recordsUpdated?.toLocaleString()} records`;
      case 'error':
        return 'Refresh Failed';
      default:
        return 'Refresh Data';
    }
  };

  const getButtonColor = () => {
    switch (refreshStatus.status) {
      case 'refreshing':
        return 'bg-blue-500 hover:bg-blue-600';
      case 'success':
        return 'bg-green-500 hover:bg-green-600';
      case 'error':
        return 'bg-red-500 hover:bg-red-600';
      default:
        return 'bg-gray-600 hover:bg-gray-700';
    }
  };

  return (
    <>
      {/* Main Refresh Button */}
      <button
        onClick={handleRefreshClick}
        disabled={disabled || refreshStatus.status === 'refreshing'}
        className={`
          ${sizeClasses[size]}
          ${getButtonColor()}
          text-white rounded-lg font-medium
          disabled:opacity-50 disabled:cursor-not-allowed
          transition-all duration-200 ease-in-out
          flex items-center space-x-2
          ${className}
        `}
        title={
          refreshStatus.status === 'error'
            ? refreshStatus.error
            : 'Refresh healthcare data from latest sources'
        }
      >
        {renderIcon()}
        <span>{renderButtonText()}</span>
      </button>

      {/* Confirmation Modal */}
      {showConfirmation && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md mx-4 shadow-2xl">
            <div className="flex items-center space-x-3 mb-4">
              <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
                <RefreshCw className="text-blue-600 dark:text-blue-400" size={20} />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Refresh Healthcare Data
              </h3>
            </div>

            <p className="text-gray-600 dark:text-gray-300 mb-6">
              This will update all healthcare demographic data from the latest sources.
              The process typically takes 15-30 seconds to complete.
            </p>

            <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400 mb-6">
              <div className="flex items-center space-x-2">
                <Clock size={14} />
                <span>Estimated time: 30 seconds</span>
              </div>
            </div>

            <div className="flex space-x-3">
              <button
                onClick={handleCancelConfirmation}
                className="flex-1 px-4 py-2 text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmRefresh}
                className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-medium"
              >
                Start Refresh
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default DataRefreshButton;