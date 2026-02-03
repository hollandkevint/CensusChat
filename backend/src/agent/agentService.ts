/**
 * Agent Service - Anthropic SDK wrapper for CensusChat with structured outputs
 * Uses @anthropic-ai/sdk with Zod schema validation for type-safe responses
 */
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { QueryResponseSchema, QueryResponse } from "./schemas";
import { regionAnalyzerConfig, RegionAnalysisResultSchema } from "./agents";
import { getMcpConfig, CENSUS_TOOLS } from "./mcpConfig";

const anthropic = new Anthropic();

// Re-export for external use
export { regionAnalyzerConfig, RegionAnalysisResultSchema, getMcpConfig, CENSUS_TOOLS };

export interface AgentQueryOptions {
  model?: string;
  maxTokens?: number;
  systemPrompt?: string;
}

export interface AgentQueryResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  usage?: {
    inputTokens: number;
    outputTokens: number;
  };
}

/**
 * Query with structured output and schema validation
 * Uses Anthropic API with Zod schema converted to JSON Schema
 */
export async function queryWithSchema<T extends z.ZodType>(
  prompt: string,
  schema: T,
  options: AgentQueryOptions = {}
): Promise<AgentQueryResult<z.infer<T>>> {
  const model = options.model || "claude-sonnet-4-20250514";
  const maxTokens = options.maxTokens || 4096;

  // Convert Zod schema to JSON Schema for prompt context
  // Type assertion needed: zod-to-json-schema typed for zod v3, we use v4
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const jsonSchema = zodToJsonSchema(schema as any, {
    name: "response",
    $refStrategy: "none",
  });

  // Build system prompt with schema instruction
  const schemaInstruction = `You are a helpful census data analyst. Always respond with valid JSON matching this schema:
${JSON.stringify(jsonSchema, null, 2)}

Respond ONLY with valid JSON. No markdown code blocks, no explanations outside the JSON.`;

  const systemPrompt = options.systemPrompt
    ? `${options.systemPrompt}\n\n${schemaInstruction}`
    : schemaInstruction;

  try {
    const response = await anthropic.messages.create({
      model,
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
    });

    // Extract text content from response
    const textContent = response.content.find((block) => block.type === "text");
    if (!textContent || textContent.type !== "text") {
      return {
        success: false,
        error: "No text content in response",
      };
    }

    // Parse and validate against schema
    let parsed: unknown;
    try {
      parsed = JSON.parse(textContent.text);
    } catch {
      return {
        success: false,
        error: `Failed to parse JSON response: ${textContent.text.substring(0, 100)}...`,
      };
    }

    const validated = schema.safeParse(parsed);
    if (!validated.success) {
      return {
        success: false,
        error: `Schema validation failed: ${validated.error.message}`,
      };
    }

    return {
      success: true,
      data: validated.data,
      usage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// Comparison response schema
export const ComparisonResponseSchema = z.object({
  success: z.boolean(),
  comparison: z.object({
    regions: z.array(
      z.object({
        region_name: z.string(),
        total_population: z.number(),
        seniors_65_plus: z.number().optional(),
        median_income: z.number().optional(),
        key_metrics: z.record(z.string(), z.unknown()).optional(),
      })
    ),
    summary: z.string(),
    differences: z.array(z.string()).optional(),
  }),
  explanation: z.string(),
});

export type ComparisonResponse = z.infer<typeof ComparisonResponseSchema>;

/**
 * Detect if a query is a comparison request
 */
export function isComparisonQuery(prompt: string): boolean {
  const comparisonPatterns = [
    /\bcompare\b/i,
    /\bvs\.?\b/i,
    /\bversus\b/i,
    /\bdifference between\b/i,
    /\bhow does.*compare\b/i,
    /\bwhich.*better\b/i,
  ];
  return comparisonPatterns.some((pattern) => pattern.test(prompt));
}

/**
 * Compare multiple regions
 * Example: "Compare Tampa Bay vs Phoenix for Medicare eligible population"
 */
export async function queryComparison(
  prompt: string,
  options: AgentQueryOptions = {}
): Promise<AgentQueryResult<ComparisonResponse>> {
  const model = options.model || "claude-sonnet-4-20250514";
  const maxTokens = options.maxTokens || 8192;

  // Convert schema to JSON Schema using zodToJsonSchema (NOT z.toJSONSchema which doesn't exist)
  // Type assertion needed: zod-to-json-schema typed for zod v3, we use v4
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const jsonSchema = zodToJsonSchema(ComparisonResponseSchema as any, {
    name: "comparison_response",
    $refStrategy: "none",
  });

  const systemPrompt = `You are a census data analyst for CensusChat specializing in regional comparisons.

When comparing regions, analyze demographic data and respond with JSON in this exact format:
{
  "success": true/false,
  "comparison": {
    "regions": [
      {
        "region_name": "Region Name",
        "total_population": number,
        "seniors_65_plus": number (optional),
        "median_income": number (optional),
        "key_metrics": { additional metrics }
      }
    ],
    "summary": "Brief comparison summary",
    "differences": ["Notable difference 1", "Notable difference 2"]
  },
  "explanation": "Detailed explanation of comparison"
}

Schema for validation:
${JSON.stringify(jsonSchema, null, 2)}

Respond ONLY with valid JSON. No markdown code blocks.`;

  try {
    const response = await anthropic.messages.create({
      model,
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: `Compare the following regions: ${prompt}`,
        },
      ],
    });

    const textContent = response.content.find((block) => block.type === "text");
    if (!textContent || textContent.type !== "text") {
      return {
        success: false,
        error: "No text content in comparison response",
      };
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(textContent.text);
    } catch {
      return {
        success: false,
        error: `Failed to parse comparison JSON: ${textContent.text.substring(0, 100)}...`,
      };
    }

    const validated = ComparisonResponseSchema.safeParse(parsed);
    if (!validated.success) {
      return {
        success: false,
        error: `Comparison schema validation failed: ${validated.error.message}`,
      };
    }

    return {
      success: true,
      data: validated.data,
      usage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown comparison error",
    };
  }
}

/**
 * Convenience function for census queries with default schema
 */
export async function queryCensus(
  prompt: string,
  options: AgentQueryOptions = {}
): Promise<AgentQueryResult<QueryResponse>> {
  const systemPrompt = `You are a census data analyst for CensusChat.
When answering queries about census data, respond with JSON in this exact format:
{
  "success": true/false,
  "data": [array of data records],
  "metadata": {
    "rowCount": number,
    "hasMore": boolean,
    "tables": ["table names used"],
    "columns": ["column names"]
  },
  "explanation": "Brief explanation of results",
  "suggestedRefinements": ["optional array of follow-up suggestions"]
}`;

  return queryWithSchema(prompt, QueryResponseSchema, {
    ...options,
    systemPrompt,
  });
}

/**
 * AgentService class for stateful usage
 */
export class AgentService {
  private model: string;
  private systemPrompt?: string;

  constructor(options?: { model?: string; systemPrompt?: string }) {
    this.model = options?.model || "claude-sonnet-4-20250514";
    this.systemPrompt = options?.systemPrompt;
  }

  async query(
    prompt: string
  ): Promise<AgentQueryResult<QueryResponse | ComparisonResponse>> {
    // Detect comparison queries and route appropriately
    if (isComparisonQuery(prompt)) {
      return queryComparison(prompt, {
        model: this.model,
      }) as Promise<AgentQueryResult<QueryResponse | ComparisonResponse>>;
    }

    // Standard query
    return queryCensus(prompt, {
      model: this.model,
      systemPrompt: this.systemPrompt,
    });
  }

  async queryWithSchema<T extends z.ZodType>(
    prompt: string,
    schema: T
  ): Promise<AgentQueryResult<z.infer<T>>> {
    return queryWithSchema(prompt, schema, {
      model: this.model,
      systemPrompt: this.systemPrompt,
    });
  }
}
