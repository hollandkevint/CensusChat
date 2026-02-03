/**
 * Query Response Schemas - Zod schemas for census query responses
 * Used with Anthropic SDK for structured output validation
 */
import { z } from "zod";

// Schema for individual data records (flexible for census data)
export const DataRecordSchema = z.record(z.string(), z.unknown());

// Metadata about the query result
export const QueryMetadataSchema = z.object({
  rowCount: z.number(),
  hasMore: z.boolean(),
  tables: z.array(z.string()),
  columns: z.array(z.string()),
  executionTimeMs: z.number().optional(),
});

// Main query response schema
export const QueryResponseSchema = z.object({
  success: z.boolean(),
  data: z.array(DataRecordSchema),
  metadata: QueryMetadataSchema,
  explanation: z.string(),
  suggestedRefinements: z.array(z.string()).optional(),
});

// Type inference from schema
export type QueryResponse = z.infer<typeof QueryResponseSchema>;
export type QueryMetadata = z.infer<typeof QueryMetadataSchema>;
export type DataRecord = z.infer<typeof DataRecordSchema>;
