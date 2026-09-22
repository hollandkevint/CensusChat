import fs from 'fs';
import path from 'path';
import fixtureDocument from './output-evaluation-fixtures.v1.json';
import {
  DEFAULT_JEV_QUESTIONS,
  deriveRoute,
  evaluateOutput,
  validateFixtureDocument,
  type EvaluationFixture,
  type OutputAnswers,
  type OutputEvaluationResult,
} from './output-evaluation';

interface CaseResult {
  id: string;
  group: EvaluationFixture['group'];
  valid_structured_output: boolean;
  expected_route: EvaluationFixture['reference']['route'];
  actual_route?: ReturnType<typeof deriveRoute>;
  expected_answers: OutputAnswers;
  actual_answers?: OutputAnswers;
  judge?: OutputEvaluationResult['judge'];
  model?: string;
  latency_ms?: number;
  usage?: OutputEvaluationResult['usage'];
  error?: string;
  evidence: EvaluationFixture['evidence'];
}

interface EvaluationReport {
  fixture_version: string;
  generated_at: string;
  data_policy: typeof fixtureDocument.data_policy;
  judge: 'jev';
  model?: string;
  cost_basis: {
    input_usd_per_million_tokens: number;
    note: string;
  };
  summary: {
    total_cases: number;
    valid_structured_outputs: number;
    route_agreement: number;
    dimension_agreement: Record<string, number>;
    unsafe_or_unsupported_cases_routed_to_pass: number;
    good_cases_routed_to_review: number;
    good_cases_routed_to_revise: number;
    total_latency_ms: number;
    average_latency_ms: number;
    input_tokens: number;
    output_tokens: number;
    estimated_judge_cost_usd: number;
    disagreement_count: number;
  };
  results: CaseResult[];
  disagreements: Array<{
    id: string;
    expected_route: string;
    actual_route?: string;
    expected_answers: OutputAnswers;
    actual_answers?: OutputAnswers;
    evidence: EvaluationFixture['evidence'];
    error?: string;
  }>;
}

function outputDirectory(args: string[]): string {
  const index = args.indexOf('--output-dir');
  return index >= 0 && args[index + 1]
    ? path.resolve(args[index + 1])
    : path.resolve(__dirname, '../../logs');
}

function answerValues(answers: OutputAnswers): Record<string, string> {
  return {
    sql_safety: answers.sql_safety.value,
    intent_match: answers.intent_match.value,
    result_fidelity: answers.result_fidelity.value,
    evidence_adequacy: answers.evidence_adequacy.value,
  };
}

function compareAnswers(expected: OutputAnswers, actual: OutputAnswers): Record<string, boolean> {
  const expectedValues = answerValues(expected);
  const actualValues = answerValues(actual);
  return Object.fromEntries(
    Object.keys(expectedValues).map((dimension) => [dimension, expectedValues[dimension] === actualValues[dimension]]),
  );
}

function reportMarkdown(report: EvaluationReport): string {
  const { summary } = report;
  const lines = [
    '# CensusChat output evaluation',
    '',
    `- Fixture version: ${report.fixture_version}`,
    `- Data policy: public or synthetic Census data only; clinical data: ${report.data_policy.clinical_data}`,
    `- Judge: ${report.judge}${report.model ? ` (${report.model})` : ''}`,
    `- Generated: ${report.generated_at}`,
    '',
    '## Summary',
    '',
    `- Valid structured outputs: ${summary.valid_structured_outputs}/${summary.total_cases}`,
    `- Route agreement: ${summary.route_agreement}/${summary.total_cases}`,
    `- Unsafe or unsupported cases routed to pass: ${summary.unsafe_or_unsupported_cases_routed_to_pass}`,
    `- Good cases routed to review: ${summary.good_cases_routed_to_review}`,
    `- Good cases routed to revise: ${summary.good_cases_routed_to_revise}`,
    `- Average Jev latency: ${summary.average_latency_ms.toFixed(1)} ms`,
    `- Jev input tokens: ${summary.input_tokens}; output tokens: ${summary.output_tokens}`,
    `- Estimated Jev input cost: $${summary.estimated_judge_cost_usd.toFixed(6)} (${report.cost_basis.note})`,
    '',
    '## Dimension agreement',
    '',
    ...Object.entries(summary.dimension_agreement).map(([dimension, count]) => `- ${dimension}: ${count}/${summary.total_cases}`),
    '',
    `## Disagreements (${report.disagreements.length})`,
    '',
  ];

  if (report.disagreements.length === 0) {
    lines.push('None.');
  } else {
    for (const disagreement of report.disagreements) {
      lines.push(`### ${disagreement.id}`);
      lines.push('');
      lines.push(`- Expected route: ${disagreement.expected_route}`);
      lines.push(`- Actual route: ${disagreement.actual_route || 'no result'}`);
      if (disagreement.error) lines.push(`- Error: ${disagreement.error}`);
      lines.push('- Evidence bundle:');
      lines.push('');
      lines.push('```json');
      lines.push(JSON.stringify(disagreement.evidence, null, 2));
      lines.push('```');
      lines.push('');
    }
  }

  return `${lines.join('\n')}\n`;
}

export async function runOutputEvaluation(options: {
  apiKey?: string;
  outputDir?: string;
  model?: string;
} = {}): Promise<EvaluationReport> {
  const fixtures = validateFixtureDocument(fixtureDocument);
  if (!(options.apiKey || process.env.JEV_API_KEY || process.env.TYPESAFE_API_KEY)) {
    throw new Error('Jev API key is required for a judge run; use --validate-only for the offline fixture check.');
  }
  const inputCost = Number(process.env.JEV_INPUT_COST_USD_PER_MILLION || '0.042');
  const results: CaseResult[] = [];

  for (const fixture of fixtures) {
    try {
      const evaluation = await evaluateOutput(fixture.evidence, DEFAULT_JEV_QUESTIONS, {
        apiKey: options.apiKey,
        model: options.model,
      });
      results.push({
        id: fixture.id,
        group: fixture.group,
        valid_structured_output: true,
        expected_route: fixture.reference.route,
        actual_route: deriveRoute(evaluation.answers),
        expected_answers: fixture.reference.answers,
        actual_answers: evaluation.answers,
        judge: evaluation.judge,
        model: evaluation.model,
        latency_ms: evaluation.latency_ms,
        usage: evaluation.usage,
        evidence: fixture.evidence,
      });
    } catch (error) {
      results.push({
        id: fixture.id,
        group: fixture.group,
        valid_structured_output: false,
        expected_route: fixture.reference.route,
        expected_answers: fixture.reference.answers,
        error: error instanceof Error ? error.message : String(error),
        evidence: fixture.evidence,
      });
    }
  }

  const validResults = results.filter((result) => result.valid_structured_output && result.actual_answers);
  const dimensionAgreement = Object.fromEntries(
    ['sql_safety', 'intent_match', 'result_fidelity', 'evidence_adequacy'].map((dimension) => [
      dimension,
      validResults.filter((result) => {
        const comparison = compareAnswers(result.expected_answers, result.actual_answers!);
        return comparison[dimension];
      }).length,
    ]),
  );
  const disagreements = results
    .filter((result) => {
      if (!result.actual_answers || !result.actual_route) return true;
      return result.actual_route !== result.expected_route ||
        Object.values(compareAnswers(result.expected_answers, result.actual_answers)).some((matched) => !matched);
    })
    .map((result) => ({
      id: result.id,
      expected_route: result.expected_route,
      actual_route: result.actual_route,
      expected_answers: result.expected_answers,
      actual_answers: result.actual_answers,
      evidence: result.evidence,
      error: result.error,
    }));

  const totalLatency = validResults.reduce((sum, result) => sum + (result.latency_ms || 0), 0);
  const inputTokens = validResults.reduce((sum, result) => sum + (result.usage?.input_tokens || 0), 0);
  const outputTokens = validResults.reduce((sum, result) => sum + (result.usage?.output_tokens || 0), 0);
  const report: EvaluationReport = {
    fixture_version: fixtureDocument.version,
    generated_at: new Date().toISOString(),
    data_policy: fixtureDocument.data_policy,
    judge: 'jev',
    model: validResults.find((result) => result.model)?.model,
    cost_basis: {
      input_usd_per_million_tokens: inputCost,
      note: 'Estimated from configured JEV_INPUT_COST_USD_PER_MILLION; API usage response does not include billing.'
    },
    summary: {
      total_cases: results.length,
      valid_structured_outputs: validResults.length,
      route_agreement: validResults.filter((result) => result.actual_route === result.expected_route).length,
      dimension_agreement: dimensionAgreement,
      unsafe_or_unsupported_cases_routed_to_pass: validResults.filter((result) =>
        result.actual_route === 'pass' &&
        (result.expected_answers.sql_safety.value === 'fail' || result.expected_answers.result_fidelity.value === 'unsupported'),
      ).length,
      good_cases_routed_to_review: validResults.filter((result) =>
        result.expected_route === 'pass' && result.actual_route === 'human_review',
      ).length,
      good_cases_routed_to_revise: validResults.filter((result) =>
        result.expected_route === 'pass' && result.actual_route === 'revise',
      ).length,
      total_latency_ms: totalLatency,
      average_latency_ms: validResults.length ? totalLatency / validResults.length : 0,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      estimated_judge_cost_usd: (inputTokens * inputCost) / 1_000_000,
      disagreement_count: disagreements.length,
    },
    results,
    disagreements,
  };

  const destination = options.outputDir || path.resolve(__dirname, '../../logs');
  fs.mkdirSync(destination, { recursive: true });
  fs.writeFileSync(path.join(destination, 'output-evaluation-jev.json'), `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(path.join(destination, 'output-evaluation-jev.md'), reportMarkdown(report));
  return report;
}

function main(): void {
  const args = process.argv.slice(2);
  if (args.includes('--validate-only')) {
    const fixtures = validateFixtureDocument(fixtureDocument);
    console.log(`Validated ${fixtures.length} output-evaluation fixtures; no judge call made.`);
    return;
  }

  runOutputEvaluation({ outputDir: outputDirectory(args) })
    .then((report) => {
      console.log(`Jev output evaluation complete: ${report.summary.valid_structured_outputs}/${report.summary.total_cases} structured outputs`);
      console.log(`Reports: ${path.join(outputDirectory(args), 'output-evaluation-jev.json')} and output-evaluation-jev.md`);
    })
    .catch((error) => {
      console.error(error instanceof Error ? error.message : error);
      process.exitCode = 1;
    });
}

if (require.main === module) main();

export { reportMarkdown };
