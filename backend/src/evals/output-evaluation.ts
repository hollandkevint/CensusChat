import { z } from 'zod';
import { getSQLValidator, type ValidationResult } from '../validation/sqlValidator';

export const FIXTURE_GROUPS = [
  'straightforward_lookup',
  'comparison_or_ranking',
  'ambiguous_or_underspecified',
  'known_failure_or_adversarial',
] as const;

export const ROUTES = ['pass', 'revise', 'human_review'] as const;

const SQL_SAFETY_VALUES = ['pass', 'fail'] as const;
const INTENT_VALUES = ['match', 'partial', 'mismatch'] as const;
const FIDELITY_VALUES = ['supported', 'partial', 'unsupported'] as const;
const EVIDENCE_VALUES = [
  'sufficient',
  'missing_provenance',
  'missing_caveat',
  'insufficient',
] as const;

const ProbabilityMapSchema = z.record(z.string(), z.number().min(0).max(1));

const ProvenanceSchema = z.object({
  source: z.string().min(1),
  dataset: z.string().min(1),
  vintage: z.string().min(1),
  geography_level: z.string().min(1),
  public_data: z.literal(true),
  clinical_data: z.literal(false),
  caveats: z.array(z.string()),
});

export const EvidenceBundleSchema = z.object({
  question: z.string().min(1),
  generated_sql: z.string().min(1),
  returned_rows: z.array(z.record(z.string(), z.unknown())),
  proposed_answer: z.string().min(1),
  provenance: ProvenanceSchema.optional(),
});

const SQLSafetyAnswerSchema = z.object({
  value: z.enum(SQL_SAFETY_VALUES),
  probabilities: ProbabilityMapSchema,
  matched_rules: z.array(z.string()),
});

const IntentAnswerSchema = z.object({
  value: z.enum(INTENT_VALUES),
  probabilities: ProbabilityMapSchema,
  confidence: z.number().min(0).max(1).optional(),
});

const FidelityAnswerSchema = z.object({
  value: z.enum(FIDELITY_VALUES),
  probabilities: ProbabilityMapSchema,
  confidence: z.number().min(0).max(1).optional(),
});

const EvidenceAnswerSchema = z.object({
  value: z.enum(EVIDENCE_VALUES),
  probabilities: ProbabilityMapSchema,
  confidence: z.number().min(0).max(1).optional(),
});

export const OutputAnswersSchema = z.object({
  sql_safety: SQLSafetyAnswerSchema,
  intent_match: IntentAnswerSchema,
  result_fidelity: FidelityAnswerSchema,
  evidence_adequacy: EvidenceAnswerSchema,
});

const ReferenceSchema = z.object({
  answers: OutputAnswersSchema,
  route: z.enum(ROUTES),
});

export const FixtureSchema = z.object({
  id: z.string().min(1),
  group: z.enum(FIXTURE_GROUPS),
  evidence: EvidenceBundleSchema,
  rubric: z.object({
    required_filters: z.record(z.string(), z.unknown()),
    geography: z.string().min(1),
    time_period: z.string().min(1),
    measures: z.array(z.string().min(1)).min(1),
    expected_result_shape: z.string().min(1),
    acceptable_answer_facts: z.array(z.string().min(1)).min(1),
    required_caveats: z.array(z.string()),
  }),
  reference: ReferenceSchema,
});

export const FixtureDocumentSchema = z.object({
  version: z.string().min(1),
  data_policy: z.object({
    kind: z.literal('public_or_synthetic_census_data'),
    clinical_data: z.literal(false),
    description: z.string().min(1),
  }),
  cases: z.array(FixtureSchema),
});

export type EvaluationState = z.infer<typeof EvidenceBundleSchema>;
export type EvaluationFixture = z.infer<typeof FixtureSchema>;
export type FixtureDocument = z.infer<typeof FixtureDocumentSchema>;
export type Route = (typeof ROUTES)[number];
export type OutputAnswers = z.infer<typeof OutputAnswersSchema>;
export type IntentMatch = (typeof INTENT_VALUES)[number];
export type ResultFidelity = (typeof FIDELITY_VALUES)[number];
export type EvidenceAdequacy = (typeof EVIDENCE_VALUES)[number];

export interface JevChoiceQuestion {
  type: 'choice';
  instructions: string;
  criteria: Record<string, string>;
}

export type JudgeQuestions = Record<
  'intent_match' | 'result_fidelity' | 'evidence_adequacy',
  JevChoiceQuestion
>;

export const DEFAULT_JEV_QUESTIONS: JudgeQuestions = {
  intent_match: {
    type: 'choice',
    instructions:
      'Does the generated SQL and its result shape answer the user question, including the requested geography, period, filters, and measure?',
    criteria: {
      match: 'All material parts of the question are answered by the SQL and returned result shape.',
      partial: 'The result is directionally useful but omits or broadens a material part of the question.',
      mismatch: 'The SQL or result answers a different question, uses the wrong geography or period, or cannot answer the question.',
    },
  },
  result_fidelity: {
    type: 'choice',
    instructions:
      'Does the proposed natural-language answer state only facts supported by the returned rows and avoid unsupported numbers or conclusions?',
    criteria: {
      supported: 'The answer is fully supported by the returned rows.',
      partial: 'The answer is partly supported but overstates, omits, or weakly interprets some result facts.',
      unsupported: 'A material claim or number is not supported by the returned rows.',
    },
  },
  evidence_adequacy: {
    type: 'choice',
    instructions:
      'Is the evidence bundle sufficient for a reviewer to understand the source, dataset, vintage, geography, and necessary caveats for this answer?',
    criteria: {
      sufficient: 'Provenance and the caveats needed to interpret this public Census result are present.',
      missing_provenance: 'The source, dataset, vintage, or geography provenance is absent or too incomplete to verify.',
      missing_caveat: 'A material limitation or interpretation caveat is missing even though provenance is present.',
      insufficient: 'The evidence is too incomplete or ambiguous for a reviewer to assess the answer.',
    },
  },
};

interface JevAnswer {
  type: 'choice';
  choice: string;
  probabilities: Record<string, number>;
  confidence?: number;
}

interface JevResponse {
  model: string;
  answers: Record<string, JevAnswer>;
  usage?: {
    input_tokens: number;
    output_tokens: number;
  };
}

export interface OutputEvaluationResult {
  answers: OutputAnswers;
  judge: 'jev';
  model: string;
  usage?: JevResponse['usage'];
  latency_ms: number;
}

export interface EvaluateOutputOptions {
  apiKey?: string;
  endpoint?: string;
  model?: string;
  fetchImpl?: typeof fetch;
  validator?: Pick<ReturnType<typeof getSQLValidator>, 'validateSQL'>;
}

const JevResponseSchema = z.object({
  model: z.string().min(1),
  answers: z.record(
    z.string(),
    z.object({
      type: z.literal('choice'),
      choice: z.string().min(1),
      probabilities: ProbabilityMapSchema,
      confidence: z.number().min(0).max(1).optional(),
    }),
  ),
  usage: z
    .object({
      input_tokens: z.number().int().nonnegative(),
      output_tokens: z.number().int().nonnegative(),
    })
    .optional(),
});

const questionChoices = {
  intent_match: INTENT_VALUES,
  result_fidelity: FIDELITY_VALUES,
  evidence_adequacy: EVIDENCE_VALUES,
} as const;

function normalizeChoiceAnswer<K extends keyof typeof questionChoices>(
  questionId: K,
  answer: JevAnswer,
): {
  value: (typeof questionChoices)[K][number];
  probabilities: Record<string, number>;
  confidence?: number;
} {
  const choices = questionChoices[questionId] as readonly string[];
  if (!choices.includes(answer.choice)) {
    throw new Error(`Jev returned an invalid ${questionId} choice: ${answer.choice}`);
  }

  const probabilities = Object.fromEntries(
    choices.map((choice) => [choice, answer.probabilities[choice] ?? 0]),
  );
  return {
    value: answer.choice as (typeof questionChoices)[K][number],
    probabilities,
    confidence: answer.confidence,
  };
}

function parseJevResponse(payload: unknown): JevResponse {
  const parsed = JevResponseSchema.safeParse(payload);
  if (!parsed.success) {
    throw new Error(`Jev response schema validation failed: ${parsed.error.message}`);
  }
  return parsed.data;
}

async function requestJev(
  state: EvaluationState,
  questions: JudgeQuestions,
  options: EvaluateOutputOptions,
): Promise<JevResponse & { latency_ms: number }> {
  const apiKey = options.apiKey || process.env.JEV_API_KEY || process.env.TYPESAFE_API_KEY;
  if (!apiKey) {
    throw new Error('Jev API key is required; set JEV_API_KEY or TYPESAFE_API_KEY.');
  }

  const fetchImpl = options.fetchImpl || globalThis.fetch;
  if (!fetchImpl) {
    throw new Error('This Node.js runtime does not provide fetch.');
  }

  const startedAt = Date.now();
  const response = await fetchImpl(options.endpoint || 'https://api.typesafe.ai/v1/systemone', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      state,
      model: options.model || 'jev-latest',
      questions,
    }),
  });
  const payload = await response.json();

  if (!response.ok) {
    throw new Error(`Jev API request failed (${response.status}): ${JSON.stringify(payload)}`);
  }

  return { ...parseJevResponse(payload), latency_ms: Date.now() - startedAt };
}

function sqlSafetyAnswer(validation: ValidationResult): OutputAnswers['sql_safety'] {
  const value = validation.valid ? 'pass' : 'fail';
  return {
    value,
    probabilities: { pass: value === 'pass' ? 1 : 0, fail: value === 'fail' ? 1 : 0 },
    matched_rules: validation.errors.map((error) => error.type),
  };
}

export function deriveRoute(answers: OutputAnswers): Route {
  if (
    answers.sql_safety.value === 'fail' ||
    answers.intent_match.value === 'mismatch' ||
    answers.result_fidelity.value === 'unsupported'
  ) {
    return 'revise';
  }

  if (
    answers.intent_match.value === 'partial' ||
    answers.result_fidelity.value === 'partial' ||
    answers.evidence_adequacy.value !== 'sufficient'
  ) {
    return 'human_review';
  }

  return 'pass';
}

export function validateFixtureDocument(input: unknown): EvaluationFixture[] {
  const document = FixtureDocumentSchema.parse(input);
  if (document.cases.length !== 20) {
    throw new Error(`Expected 20 fixtures, received ${document.cases.length}`);
  }

  const ids = new Set<string>();
  const counts = new Map<string, number>();
  for (const fixture of document.cases) {
    if (ids.has(fixture.id)) {
      throw new Error(`Duplicate fixture id: ${fixture.id}`);
    }
    ids.add(fixture.id);
    counts.set(fixture.group, (counts.get(fixture.group) || 0) + 1);
    if (deriveRoute(fixture.reference.answers) !== fixture.reference.route) {
      throw new Error(`Reference route disagrees with routing rules: ${fixture.id}`);
    }
  }

  for (const group of FIXTURE_GROUPS) {
    if (counts.get(group) !== 5) {
      throw new Error(`Expected 5 fixtures in ${group}, received ${counts.get(group) || 0}`);
    }
  }

  return document.cases;
}

export async function evaluateOutput(
  state: EvaluationState,
  questions: JudgeQuestions = DEFAULT_JEV_QUESTIONS,
  options: EvaluateOutputOptions = {},
): Promise<OutputEvaluationResult> {
  const parsedState = EvidenceBundleSchema.parse(state);
  const validator = options.validator || getSQLValidator();
  const [validation, judged] = await Promise.all([
    validator.validateSQL(parsedState.generated_sql),
    requestJev(parsedState, questions, options),
  ]);

  const intentMatch = normalizeChoiceAnswer('intent_match', judged.answers.intent_match);
  const resultFidelity = normalizeChoiceAnswer('result_fidelity', judged.answers.result_fidelity);
  const evidenceAdequacy = normalizeChoiceAnswer('evidence_adequacy', judged.answers.evidence_adequacy);

  return {
    answers: {
      sql_safety: sqlSafetyAnswer(validation),
      intent_match: intentMatch,
      result_fidelity: resultFidelity,
      evidence_adequacy: evidenceAdequacy,
    },
    judge: 'jev',
    model: judged.model,
    usage: judged.usage,
    latency_ms: judged.latency_ms,
  };
}
