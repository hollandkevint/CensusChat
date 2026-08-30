import Link from 'next/link';
import ChatInterface from '@/components/ChatInterface';
import { snapshotMeta } from '@/lib/counties';

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 py-6 px-4">
      <div className="max-w-7xl mx-auto">
        <header className="mb-6 text-center">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
            CensusChat
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-300">
            Natural Language Healthcare Demographics & Analytics
          </p>
          <div className="mt-4 flex justify-center gap-4 text-sm text-gray-500 dark:text-gray-400">
            <span>🏥 Healthcare-Focused</span>
            <span>📊 Real Census Data</span>
            <span>🤖 AI-Powered</span>
          </div>
          <p className="mt-3 text-sm text-gray-600 dark:text-gray-400">
            Or browse{' '}
            <Link href="/counties" className="text-blue-700 hover:underline dark:text-blue-400">
              healthcare demographics for all {snapshotMeta.countyCount.toLocaleString('en-US')} US counties
            </Link>{' '}
            — no account needed.
          </p>
        </header>

        <ChatInterface />

        <footer className="mt-8 text-center text-sm text-gray-500 dark:text-gray-400">
          <p>Built with US Census Bureau API • Powered by Anthropic Claude</p>
          <p className="mt-2">© 2025 CensusChat • Healthcare Analytics Made Simple</p>
        </footer>
      </div>
    </div>
  );
}
