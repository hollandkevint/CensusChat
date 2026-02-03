/**
 * Region Analyzer Configuration
 * Configuration for analyzing demographic data in a specific region
 * Used for parallel region comparisons
 */
import { z } from "zod";
import { CENSUS_TOOLS } from "../mcpConfig";

/**
 * Schema for region analysis results (used in comparisons)
 */
export const RegionAnalysisResultSchema = z.object({
  region_name: z.string(),
  total_population: z.number(),
  seniors_65_plus: z.number().optional(),
  median_income: z.number().optional(),
  key_metrics: z.record(z.string(), z.unknown()).optional(),
});

export type RegionAnalysisResult = z.infer<typeof RegionAnalysisResultSchema>;

/**
 * Configuration for region analyzer agent
 */
export const regionAnalyzerConfig = {
  description:
    "Analyzes demographic data for a specific geographic region using Census data",
  systemPrompt: `You are a census data analyst specializing in regional demographics.

When given a region (city, county, or metro area), you will:
1. Query the census database for key demographic metrics
2. Focus on: population, age distribution (especially 65+), income levels, and healthcare access indicators
3. Return structured data suitable for comparison

Use the execute_query tool to run SQL queries against the census database.
Available tables: county_data, block_group_data_expanded

For city/metro area queries, search by county_name patterns (e.g., "Tampa" matches counties in Tampa Bay area).

Always return results in JSON format with:
- region_name: The region analyzed
- total_population: Total population
- seniors_65_plus: Population aged 65+
- median_income: Median household income
- key_metrics: Object with additional relevant metrics`,
  tools: [...CENSUS_TOOLS],
  model: "claude-sonnet-4-20250514",
};
