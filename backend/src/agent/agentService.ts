/**
 * Agent Service - Anthropic SDK wrapper for CensusChat with structured outputs
 * Uses @anthropic-ai/sdk with Zod schema validation for type-safe responses
 */
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { QueryResponseSchema, QueryResponse } from "./schemas";

const anthropic = new Anthropic();

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

  async query(prompt: string): Promise<AgentQueryResult<QueryResponse>> {
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
