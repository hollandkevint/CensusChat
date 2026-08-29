import Link from 'next/link';
import {
  getMetricMeta,
  type County,
  type CountyMetrics,
  type MetricKey,
  type StateRow,
} from '@/lib/counties';
import { MISSING, MISSING_NOTE, formatDelta, formatMetric } from '@/lib/formatMetric';

export function StatCard({
  label,
  value,
  context,
  source,
}: {
  label: string;
  value: string;
  context?: string;
  source: string;
}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
      <div className="text-sm text-gray-600 dark:text-gray-400">{label}</div>
      <div className="mt-1 text-3xl font-bold tabular-nums text-gray-900 dark:text-white">{value}</div>
      {context ? (
        <div className="mt-1 text-sm text-gray-600 dark:text-gray-400">{context}</div>
      ) : null}
      <div className="mt-2 font-mono text-xs text-gray-400 dark:text-gray-500">{source}</div>
    </div>
  );
}

const DELTA_CLASS = {
  above: 'text-amber-700 dark:text-amber-400',
  below: 'text-sky-700 dark:text-sky-400',
  even: 'text-gray-500 dark:text-gray-400',
  none: 'text-gray-400 dark:text-gray-500',
} as const;

/**
 * One metric per row, each beside its state and national value, its
 * county-to-national difference, and the ACS variable code it came from.
 * The variable code is what lets a reader reproduce the number themselves.
 */
export function MetricTable({
  title,
  intro,
  keys,
  county,
  state,
  national,
}: {
  title: string;
  intro: string;
  keys: MetricKey[];
  county: County;
  state: StateRow | undefined;
  national: CountyMetrics;
}) {
  const rows = keys.map((key) => {
    const meta = getMetricMeta(key);
    return {
      key,
      meta,
      county: county.metrics[key],
      state: state?.metrics[key] ?? null,
      national: national[key],
      delta: formatDelta(county.metrics[key], national[key], meta.unit),
    };
  });
  const anyMissing = rows.some((r) => r.county === null);

  return (
    <section className="mt-8">
      <h2 className="text-xl font-semibold text-gray-900 dark:text-white">{title}</h2>
      <p className="mt-1 max-w-3xl text-sm text-gray-600 dark:text-gray-400">{intro}</p>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[46rem] border-collapse text-sm">
          <thead>
            <tr className="border-b border-gray-300 text-left dark:border-gray-600">
              <th className="py-2 pr-4 font-semibold text-gray-700 dark:text-gray-300">Measure</th>
              <th className="py-2 pr-4 text-right font-semibold text-gray-700 dark:text-gray-300">
                {county.name}
              </th>
              <th className="py-2 pr-4 text-right font-semibold text-gray-700 dark:text-gray-300">
                {county.stateName}
              </th>
              <th className="py-2 pr-4 text-right font-semibold text-gray-700 dark:text-gray-300">
                United States
              </th>
              <th className="py-2 pr-4 text-right font-semibold text-gray-700 dark:text-gray-300">
                vs. U.S.
              </th>
              <th className="py-2 font-semibold text-gray-700 dark:text-gray-300">ACS variable</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.key}
                className="border-b border-gray-100 last:border-0 dark:border-gray-800"
              >
                <td className="py-2 pr-4 text-gray-900 dark:text-gray-100">
                  {row.meta.label}
                  {row.county === null ? (
                    <sup className="ml-0.5 text-gray-400" title={MISSING_NOTE}>
                      †
                    </sup>
                  ) : null}
                </td>
                <td className="py-2 pr-4 text-right font-semibold tabular-nums text-gray-900 dark:text-white">
                  {formatMetric(row.county, row.meta.unit)}
                </td>
                <td className="py-2 pr-4 text-right tabular-nums text-gray-600 dark:text-gray-400">
                  {formatMetric(row.state, row.meta.unit)}
                </td>
                <td className="py-2 pr-4 text-right tabular-nums text-gray-600 dark:text-gray-400">
                  {formatMetric(row.national, row.meta.unit)}
                </td>
                <td
                  className={`py-2 pr-4 text-right tabular-nums ${DELTA_CLASS[row.delta.direction]}`}
                >
                  {row.delta.text}
                </td>
                <td className="py-2 font-mono text-xs text-gray-500 dark:text-gray-400">
                  {row.meta.code}
                  <span className="ml-1 text-gray-400 dark:text-gray-500">({row.meta.table})</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {anyMissing ? (
        <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
          {MISSING} marked † — {MISSING_NOTE} No value is substituted or estimated.
        </p>
      ) : null}
    </section>
  );
}

export function CountyLinkList({
  title,
  description,
  counties,
  metricLabel,
  metricFor,
}: {
  title: string;
  description: string;
  counties: County[];
  metricLabel: string;
  metricFor: (c: County) => string;
}) {
  if (counties.length === 0) return null;
  return (
    <div>
      <h3 className="font-semibold text-gray-900 dark:text-white">{title}</h3>
      <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{description}</p>
      <ul className="mt-2 space-y-1 text-sm">
        {counties.map((c) => (
          <li key={c.fips} className="flex justify-between gap-4">
            <Link
              href={`/counties/${c.stateSlug}/${c.slug}`}
              className="text-blue-700 hover:underline dark:text-blue-400"
            >
              {c.name}, {c.stateName}
            </Link>
            <span className="shrink-0 tabular-nums text-gray-500 dark:text-gray-400">
              {metricFor(c)} {metricLabel}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
