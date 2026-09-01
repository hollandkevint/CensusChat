/**
 * Single source of truth for the ACS vintage the loaders TARGET.
 *
 * Every loader under backend/scripts/ imports ACS_VINTAGE_YEAR, so bumping the
 * year here is the whole change — the loaders cannot drift from it.
 *
 * This constant describes the CODE, not the database. For the vintage actually
 * loaded in the DB (which lags until the multi-hour reload runs), use
 * `utils/dataVintage.ts` — the loaders stamp it and the query path reads it.
 */
export const ACS_VINTAGE_YEAR = 2024;

export const ACS_VINTAGE_LABEL = `ACS ${ACS_VINTAGE_YEAR} 5-Year`;
