/**
 * Agent Service Tests
 * Tests Zod schema validation without requiring live Anthropic API
 */
import { QueryResponseSchema, QueryResponse } from "../../agent/schemas";

describe("QueryResponseSchema", () => {
  it("validates correct response structure", () => {
    const validResponse: QueryResponse = {
      success: true,
      data: [
        { county_name: "Miami-Dade", population: 2716940 },
        { county_name: "Broward", population: 1944375 },
      ],
      metadata: {
        rowCount: 2,
        hasMore: false,
        tables: ["county_data"],
        columns: ["county_name", "population"],
      },
      explanation: "Found 2 counties in Florida",
    };

    const result = QueryResponseSchema.safeParse(validResponse);
    expect(result.success).toBe(true);
  });

  it("rejects response missing required fields", () => {
    const invalidResponse = {
      success: true,
      data: [],
      // missing metadata and explanation
    };

    const result = QueryResponseSchema.safeParse(invalidResponse);
    expect(result.success).toBe(false);
  });

  it("accepts optional suggestedRefinements", () => {
    const responseWithRefinements: QueryResponse = {
      success: true,
      data: [],
      metadata: {
        rowCount: 0,
        hasMore: false,
        tables: [],
        columns: [],
      },
      explanation: "No results found",
      suggestedRefinements: [
        "Try a broader search",
        "Include neighboring counties",
      ],
    };

    const result = QueryResponseSchema.safeParse(responseWithRefinements);
    expect(result.success).toBe(true);
  });

  it("validates flexible data records", () => {
    const responseWithMixedData: QueryResponse = {
      success: true,
      data: [
        { county: "Test", population: 1000, rate: 0.15, active: true },
      ],
      metadata: {
        rowCount: 1,
        hasMore: false,
        tables: ["test"],
        columns: ["county", "population", "rate", "active"],
      },
      explanation: "Mixed data types in records",
    };

    const result = QueryResponseSchema.safeParse(responseWithMixedData);
    expect(result.success).toBe(true);
  });

  it("accepts optional executionTimeMs in metadata", () => {
    const responseWithTiming: QueryResponse = {
      success: true,
      data: [],
      metadata: {
        rowCount: 0,
        hasMore: false,
        tables: [],
        columns: [],
        executionTimeMs: 42,
      },
      explanation: "Query completed",
    };

    const result = QueryResponseSchema.safeParse(responseWithTiming);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.metadata.executionTimeMs).toBe(42);
    }
  });

  it("rejects invalid metadata structure", () => {
    const invalidMetadata = {
      success: true,
      data: [],
      metadata: {
        rowCount: "not a number", // should be number
        hasMore: false,
        tables: [],
        columns: [],
      },
      explanation: "Invalid metadata",
    };

    const result = QueryResponseSchema.safeParse(invalidMetadata);
    expect(result.success).toBe(false);
  });
});
