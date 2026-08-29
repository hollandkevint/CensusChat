/**
 * Typed access to the committed county snapshot.
 *
 * SERVER-ONLY. The snapshot is ~2 MB; importing this module from a file
 * carrying 'use client' ships all of it to the browser. Every consumer today
 * is a server component; keep it that way.
 */

import data from '@/data/counties.json';
import meta from '@/data/counties.meta.json';

/** Every metric is `number | null`. `null` means the Census Bureau does not publish it. */
export interface CountyMetrics {
  population: number | null;
  medianAge: number | null;
  age65PlusCount: number | null;
  age65PlusPct: number | null;
  medianHouseholdIncome: number | null;
  povertyPct: number | null;
  bachelorsPlusPct: number | null;
  broadbandPct: number | null;
  limitedEnglishPct: number | null;
  noVehiclePct: number | null;
  age75PlusCount: number | null;
  uninsuredPct: number | null;
  uninsured19to64Pct: number | null;
  uninsured65PlusPct: number | null;
  disabilityPct: number | null;
  disability65to74Pct: number | null;
  disability75PlusPct: number | null;
}

export type MetricKey = keyof CountyMetrics;

export interface County {
  fips: string;
  stateFips: string;
  countyFips: string;
  name: string;
  stateName: string;
  slug: string;
  stateSlug: string;
  metrics: CountyMetrics;
  ranks: { population?: number; age65PlusPct?: number };
  peerFips: string[];
  stateNeighborFips: string[];
}

export interface StateRow {
  fips: string;
  name: string;
  slug: string;
  metrics: CountyMetrics;
}

export interface MetricMeta {
  key: MetricKey;
  code: string;
  table: string;
  endpoint: string;
  label: string;
  unit: 'count' | 'percent' | 'usd' | 'years';
}

export interface SnapshotMeta {
  vintage: string;
  vintageYear: number;
  dataset: string;
  source: string;
  sourceUrl: string;
  generatedOn: string;
  countyCount: number;
  rankedOnPopulation: number;
  rankedOnAge65PlusPct: number;
  metrics: MetricMeta[];
}

const snapshot = data as unknown as {
  counties: County[];
  states: Record<string, StateRow>;
  national: CountyMetrics;
};

export const snapshotMeta = meta as unknown as SnapshotMeta;
export const national: CountyMetrics = snapshot.national;

const counties: County[] = snapshot.counties;
const byRoute = new Map(counties.map((c) => [`${c.stateSlug}/${c.slug}`, c]));
const byFips = new Map(counties.map((c) => [c.fips, c]));
const metricMetaByKey = new Map(snapshotMeta.metrics.map((m) => [m.key, m]));

if (byRoute.size !== counties.length) {
  throw new Error(
    `County slugs are not unique: ${counties.length} counties produced ${byRoute.size} routes.`
  );
}

export function getAllCounties(): County[] {
  return counties;
}

export function getCounty(stateSlug: string, countySlug: string): County | undefined {
  return byRoute.get(`${stateSlug}/${countySlug}`);
}

export function getStateOf(county: County): StateRow | undefined {
  return snapshot.states[county.stateFips];
}

function resolve(fipsList: string[]): County[] {
  return fipsList.map((f) => byFips.get(f)).filter((c): c is County => c !== undefined);
}

/** Counties nationally closest in senior population. Precomputed by the generator. */
export function getPeers(county: County): County[] {
  return resolve(county.peerFips);
}

/** Same-state counties closest in total population -- not the whole state. */
export function getStateNeighbors(county: County): County[] {
  return resolve(county.stateNeighborFips);
}

/** Every state with its counties, both alphabetical, for the index page. */
export function getStateGroups(): Array<{ state: StateRow; counties: County[] }> {
  const grouped = new Map<string, County[]>();
  for (const c of counties) {
    const group = grouped.get(c.stateFips);
    if (group) group.push(c);
    else grouped.set(c.stateFips, [c]);
  }
  return Object.values(snapshot.states)
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((state) => ({
      state,
      counties: (grouped.get(state.fips) ?? []).sort((a, b) => a.name.localeCompare(b.name)),
    }));
}

export function getMetricMeta(key: MetricKey): MetricMeta {
  const m = metricMetaByKey.get(key);
  if (!m) throw new Error(`No metadata for metric "${key}"`);
  return m;
}

export function countyHref(county: County): string {
  return `/counties/${county.stateSlug}/${county.slug}`;
}
