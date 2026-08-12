/**
 * Single source of truth for the ACS vintage currently loaded in the database.
 *
 * Bump this in lockstep with the `YEAR` constant in the loaders under
 * backend/scripts/ whenever the data is refreshed to a new vintage. It surfaces
 * in the data-freshness subsystem and in query response metadata so the UI can
 * state which ACS release the answers come from.
 */
export const ACS_VINTAGE_LABEL = 'ACS 2024 5-Year';
