import type { MetricMeta } from './counties';

/** Rendered for any metric the Census Bureau does not publish for a county. */
export const MISSING = '—';

export const MISSING_NOTE =
  'The Census Bureau does not publish this estimate for this county.';

export function formatMetric(value: number | null, unit: MetricMeta['unit']): string {
  if (value === null) return MISSING;
  switch (unit) {
    case 'count':
      return value.toLocaleString('en-US');
    case 'usd':
      return `$${value.toLocaleString('en-US')}`;
    case 'percent':
      return `${value.toFixed(1)}%`;
    case 'years':
      return value.toFixed(1);
  }
}

/**
 * County-versus-national difference, as a signed string with no valence.
 *
 * Deliberately not colored good/bad: "above national" is desirable for
 * broadband and income and undesirable for uninsured and poverty, and which
 * way a reader wants disability or limited-English to run depends on whether
 * they are sizing need or sizing risk. The sign is the signal.
 *
 * Raw counts get no difference -- one county's senior headcount against the
 * national total is not a comparison a reader can use. Shares and dollars do.
 */
export function formatDelta(
  value: number | null,
  reference: number | null,
  unit: MetricMeta['unit']
): string {
  if (unit === 'count' || value === null || reference === null) return MISSING;
  const diff = value - reference;
  const sign = diff > 0 ? '+' : diff < 0 ? '−' : '';
  const magnitude = Math.abs(diff);
  if (unit === 'usd') return `${sign}$${Math.round(magnitude).toLocaleString('en-US')}`;
  if (unit === 'years') return `${sign}${magnitude.toFixed(1)}`;
  return `${sign}${magnitude.toFixed(1)} pts`;
}

/** "1st", "2nd", "3rd", "4th" ... */
export function ordinal(n: number): string {
  const rem100 = n % 100;
  if (rem100 >= 11 && rem100 <= 13) return `${n.toLocaleString('en-US')}th`;
  switch (n % 10) {
    case 1:
      return `${n.toLocaleString('en-US')}st`;
    case 2:
      return `${n.toLocaleString('en-US')}nd`;
    case 3:
      return `${n.toLocaleString('en-US')}rd`;
    default:
      return `${n.toLocaleString('en-US')}th`;
  }
}

/**
 * Share of one figure in another, as a percentage string.
 * Derived from two figures of the same vintage -- never an estimate.
 */
export function shareOf(part: number | null, whole: number | null): string {
  if (part === null || whole === null || whole === 0) return MISSING;
  return `${((part / whole) * 100).toFixed(1)}%`;
}
