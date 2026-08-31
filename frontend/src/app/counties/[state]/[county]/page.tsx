import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  countyHref,
  getAllCounties,
  getCounty,
  getPeers,
  getStateNeighbors,
  getStateOf,
  national,
  snapshotMeta,
  type County,
} from '@/lib/counties';
import { MISSING, formatMetric, ordinal, shareOf } from '@/lib/formatMetric';
import { CountyLinkList, MetricTable, StatCard } from '@/components/county/CountyPanels';

/**
 * How many counties to prerender at build time, most populous first.
 *
 * Measured on this repo: prerendering all 3,144 costs only +4.4s of build
 * time (26.1s -> 30.5s), so build time is not the constraint. Output size is.
 * Each page is ~104 KB of .html + .rsc + .meta, so all 3,144 is ~319 MB --
 * and `output: "standalone"` in next.config.ts copies that whole tree into
 * .next/standalone, so the deployed image carries it twice, ~638 MB.
 *
 * 500 covers 76% of the US population for ~51 MB. The other 2,644 counties
 * still resolve: dynamicParams renders them on first request and revalidate
 * caches the result, so every URL in the sitemap returns a full page.
 *
 * Set COUNTY_PAGE_LIMIT=0 to prerender every county, or to a small number to
 * check the template on a subset. An unset or unparseable value takes the
 * default rather than falling through to prerendering everything.
 */
const DEFAULT_LIMIT = 500;
// Read the raw string first: Number('') is 0, not NaN, so an empty
// COUNTY_PAGE_LIMIT= in a .env or CI file would otherwise pass the integer
// check and take the prerender-everything branch. Empty means unset.
const rawLimit = process.env.COUNTY_PAGE_LIMIT?.trim();
const parsedLimit = rawLimit ? Number(rawLimit) : NaN;
// Only an explicit, valid 0 means "prerender everything". A typo must not
// silently opt into the ~638 MB image.
const LIMIT = Number.isInteger(parsedLimit) && parsedLimit >= 0 ? parsedLimit : DEFAULT_LIMIT;

/** Counties outside generateStaticParams render on demand rather than 404. */
export const dynamicParams = true;

/** Regenerate an on-demand page at most weekly; the snapshot is static anyway. */
export const revalidate = 604800;

export async function generateStaticParams() {
  const all = getAllCounties();
  const chosen =
    LIMIT > 0
      ? [...all]
          .sort((a, b) => (b.metrics.population ?? 0) - (a.metrics.population ?? 0))
          .slice(0, LIMIT)
      : all;
  return chosen.map((c) => ({ state: c.stateSlug, county: c.slug }));
}

type Params = Promise<{ state: string; county: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { state, county: countySlug } = await params;
  const county = getCounty(state, countySlug);
  if (!county) return { title: 'County not found' };

  const seniors = county.metrics.age65PlusCount;
  const pct = county.metrics.age65PlusPct;
  const description =
    seniors !== null && pct !== null
      ? `${county.name}, ${county.stateName} has ${seniors.toLocaleString('en-US')} residents aged 65 and over (${pct.toFixed(1)}% of the population). Medicare-eligible population, insurance coverage, disability and access measures from the ${snapshotMeta.vintage}.`
      : `Healthcare demographics for ${county.name}, ${county.stateName} from the ${snapshotMeta.vintage}.`;

  return {
    title: `${county.name}, ${county.stateName} — Healthcare Demographics | CensusChat`,
    description,
    alternates: { canonical: countyHref(county) },
    openGraph: { title: `${county.name}, ${county.stateName} healthcare demographics`, description },
  };
}

function chatQuestions(county: County): string[] {
  const where = `${county.name}, ${county.stateName}`;
  const seniors = county.metrics.age65PlusCount;
  return [
    seniors !== null
      ? `How many of the ${seniors.toLocaleString('en-US')} residents aged 65 and over in ${where} live below the poverty line?`
      : `How many residents aged 65 and over in ${where} live below the poverty line?`,
    `Which block groups in ${where} have the highest share of residents aged 65 and over?`,
    `Compare ${where} with the rest of ${county.stateName} on uninsured rate and median household income.`,
  ];
}

export default async function CountyPage({ params }: { params: Params }) {
  const { state: stateSlug, county: countySlug } = await params;
  const county = getCounty(stateSlug, countySlug);
  if (!county) notFound();

  const state = getStateOf(county);
  const m = county.metrics;
  const peers = getPeers(county);
  const neighbors = getStateNeighbors(county);
  const questions = chatQuestions(county);

  const seniorRank = county.ranks.age65PlusPct;
  const seniorCountRank = county.ranks.age65PlusCount;

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-8 dark:bg-gray-900">
      <div className="mx-auto max-w-5xl">
        <nav className="text-sm text-gray-500 dark:text-gray-400">
          <Link href="/" className="hover:underline">
            CensusChat
          </Link>
          {' / '}
          <Link href="/counties" className="hover:underline">
            Counties
          </Link>
          {' / '}
          <span className="text-gray-700 dark:text-gray-300">
            {county.name}, {county.stateName}
          </span>
        </nav>

        <header className="mt-4">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white">
            {county.name}, {county.stateName}
          </h1>
          <p className="mt-2 max-w-3xl text-gray-600 dark:text-gray-300">
            Healthcare-relevant demographics for {county.name}. Every figure below is a published
            estimate from the {snapshotMeta.vintage}, shown beside the {county.stateName} and
            national value so the county reads in context. FIPS {county.fips}.
          </p>
        </header>

        {/* Medicare-eligible market ------------------------------------- */}
        <section className="mt-8">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Medicare-eligible population
          </h2>
          <p className="mt-1 max-w-3xl text-sm text-gray-600 dark:text-gray-400">
            The 65-and-over population is the addressable Medicare market. The 75-and-over share of
            that cohort indicates acuity: older seniors drive materially higher utilization.
          </p>
          <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Residents 65 and over"
              value={formatMetric(m.age65PlusCount, 'count')}
              context={
                seniorCountRank
                  ? `${ordinal(seniorCountRank)} largest senior population of ${snapshotMeta.rankedOnAge65PlusCount.toLocaleString('en-US')} counties`
                  : undefined
              }
              source="DP05_0024E"
            />
            <StatCard
              label="Share of population 65 and over"
              value={formatMetric(m.age65PlusPct, 'percent')}
              context={
                seniorRank
                  ? `${ordinal(seniorRank)} highest of ${snapshotMeta.rankedOnAge65PlusPct.toLocaleString('en-US')} counties · U.S. ${formatMetric(national.age65PlusPct, 'percent')}`
                  : `U.S. ${formatMetric(national.age65PlusPct, 'percent')}`
              }
              source="DP05_0024PE"
            />
            <StatCard
              label="Residents 75 and over"
              value={formatMetric(m.age75PlusCount, 'count')}
              context={`${shareOf(m.age75PlusCount, m.age65PlusCount)} of the 65+ cohort`}
              source="S0101_C01_031E"
            />
            <StatCard
              label="Median age"
              value={formatMetric(m.medianAge, 'years')}
              context={`U.S. ${formatMetric(national.medianAge, 'years')}`}
              source="DP05_0018E"
            />
          </div>
          <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
            The 75-and-over share of the 65-and-over cohort is derived from the two published counts
            above. Ranks are computed across all{' '}
            {snapshotMeta.countyCount.toLocaleString('en-US')} counties in this snapshot.
          </p>
        </section>

        <MetricTable
          title="Coverage and clinical need"
          intro="Uninsured and disability rates by age. The 65-and-over uninsured rate is low nationally because of Medicare, so a county well above it signals an enrollment gap rather than a market."
          keys={[
            'uninsuredPct',
            'uninsured19to64Pct',
            'uninsured65PlusPct',
            'disabilityPct',
            'disability65to74Pct',
            'disability75PlusPct',
          ]}
          county={county}
          state={state}
          national={national}
        />

        <MetricTable
          title="Economic and access barriers"
          intro="Measures that predict whether a population can reach and pay for care: income, poverty, transport, connectivity for telehealth, and language access."
          keys={[
            'medianHouseholdIncome',
            'povertyPct',
            'noVehiclePct',
            'broadbandPct',
            'limitedEnglishPct',
            'bachelorsPlusPct',
            'population',
          ]}
          county={county}
          state={state}
          national={national}
        />

        {/* Comparison ---------------------------------------------------- */}
        <section className="mt-10 grid gap-6 md:grid-cols-2">
          <CountyLinkList
            title="Comparable counties nationally"
            description="Closest in Medicare-eligible population size, anywhere in the country. Similar market scale, different geography."
            counties={peers}
            metricLabel="seniors"
            metricFor={(c) => formatMetric(c.metrics.age65PlusCount, 'count')}
          />
          <CountyLinkList
            title={`Nearby scale in ${county.stateName}`}
            description={`Counties in ${county.stateName} closest in total population.`}
            counties={neighbors}
            metricLabel="residents"
            metricFor={(c) => formatMetric(c.metrics.population, 'count')}
          />
        </section>
        <p className="mt-4 text-sm">
          <Link
            href={`/counties#${county.stateSlug}`}
            className="text-blue-700 hover:underline dark:text-blue-400"
          >
            All counties in {county.stateName} →
          </Link>
        </p>

        {/* Chat CTA ------------------------------------------------------ */}
        <section className="mt-10 rounded-lg border border-blue-200 bg-blue-50 p-5 dark:border-blue-900 dark:bg-blue-950">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Ask a follow-up about {county.name}
          </h2>
          <p className="mt-1 text-sm text-gray-700 dark:text-gray-300">
            This page is a snapshot. CensusChat queries block-group and tract detail underneath it.
          </p>
          <ul className="mt-3 space-y-2">
            {questions.map((q) => (
              <li key={q}>
                <Link
                  href={`/?q=${encodeURIComponent(q)}`}
                  className="block rounded border border-blue-300 bg-white px-3 py-2 text-sm text-blue-800 hover:bg-blue-100 dark:border-blue-800 dark:bg-gray-800 dark:text-blue-300 dark:hover:bg-gray-700"
                >
                  {q}
                </Link>
              </li>
            ))}
          </ul>
        </section>

        {/* Provenance ---------------------------------------------------- */}
        <section className="mt-10 border-t border-gray-200 pt-5 text-sm text-gray-600 dark:border-gray-700 dark:text-gray-400">
          <h2 className="font-semibold text-gray-900 dark:text-white">Source and vintage</h2>
          <p className="mt-2 max-w-3xl">
            All estimates on this page come from the {snapshotMeta.vintage}, published by the{' '}
            {snapshotMeta.source}. Dataset <code className="font-mono">{snapshotMeta.dataset}</code>,
            county-level Data Profile and Subject tables, retrieved from{' '}
            <a
              href={snapshotMeta.sourceUrl}
              className="text-blue-700 hover:underline dark:text-blue-400"
              rel="noopener noreferrer"
            >
              api.census.gov
            </a>{' '}
            on {snapshotMeta.generatedOn}. The ACS variable code beside each measure identifies the
            exact published cell, so any figure here can be reproduced against the Census API.
          </p>
          <p className="mt-2 max-w-3xl">
            Values are 5-year estimates and carry sampling error; the Census Bureau publishes a
            margin of error for each. Nothing on this page is modeled, interpolated, or imputed. A
            measure the Census Bureau does not publish for this county is shown as {MISSING} rather
            than filled in.
          </p>
        </section>
      </div>
    </div>
  );
}
