import AnalyticsDashboard from '@/components/AnalyticsDashboard';

export default function AnalyticsPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 py-6 px-4">
      <div className="max-w-7xl mx-auto">
        <header className="mb-6 text-center">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
            Analytics Dashboard
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-300">
            CensusChat Usage and Performance Metrics
          </p>
        </header>

        <AnalyticsDashboard refreshInterval={60} />

        <footer className="mt-8 text-center text-sm text-gray-500 dark:text-gray-400">
          <p>CensusChat Analytics</p>
        </footer>
      </div>
    </div>
  );
}
