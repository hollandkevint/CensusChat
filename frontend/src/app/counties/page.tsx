import type { Metadata } from 'next';
import Link from 'next/link';
import { getStateGroups, snapshotMeta } from '@/lib/counties';
import { formatMetric } from '@/lib/formatMetric';

export const metadata: Metadata = {
  title: 'US County Healthcare Demographics | CensusChat',
  description: `Medicare-eligible population, insurance coverage, disability and access measures for all ${snapshotMeta.countyCount} US counties, from the ${snapshotMeta.vintage}.`,
  alternates: { canonical: '/counties' },
};

export default function CountiesIndex() {
  const groups = getStateGroups();

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-8 dark:bg-gray-900">
      <div className="mx-auto max-w-5xl">
        <nav className="text-sm text-gray-500 dark:text-gray-400">
          <Link href="/" className="hover:underline">
            CensusChat
          </Link>
          {' / '}
          <span className="text-gray-700 dark:text-gray-300">Counties</span>
        </nav>

        <h1 className="mt-4 text-4xl font-bold text-gray-900 dark:text-white">
          County healthcare demographics
        </h1>
        <p className="mt-2 max-w-3xl text-gray-600 dark:text-gray-300">
          Medicare-eligible population, insurance coverage, disability, and access measures for all{' '}
          {snapshotMeta.countyCount.toLocaleString('en-US')} US counties. Every figure is a published{' '}
          {snapshotMeta.vintage} estimate with its ACS variable code. No account needed.
        </p>

        <div className="mt-8 space-y-8">
          {groups.map(({ state, counties }) => (
            <section key={state.fips}>
              <h2
                id={state.slug}
                className="scroll-mt-4 border-b border-gray-200 pb-1 text-xl font-semibold text-gray-900 dark:border-gray-700 dark:text-white"
              >
                {state.name}
                <span className="ml-2 text-sm font-normal text-gray-500 dark:text-gray-400">
                  {counties.length} counties · {formatMetric(state.metrics.age65PlusPct, 'percent')} aged 65+
                </span>
              </h2>
              <ul className="mt-2 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2 lg:grid-cols-3">
                {counties.map((c) => (
                  <li key={c.fips}>
                    <Link
                      href={`/counties/${c.stateSlug}/${c.slug}`}
                      className="text-blue-700 hover:underline dark:text-blue-400"
                    >
                      {c.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
