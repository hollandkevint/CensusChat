import fixtureDocument from '../../evals/output-evaluation-fixtures.v1.json';
import {
  DEFAULT_JEV_QUESTIONS,
  deriveRoute,
  evaluateOutput,
  validateFixtureDocument,
  type OutputAnswers,
} from '../../evals/output-evaluation';

function answers(overrides: Partial<OutputAnswers> = {}): OutputAnswers {
  return {
    sql_safety: {
      value: 'pass',
      probabilities: { pass: 1, fail: 0 },
      matched_rules: [],
    },
    intent_match: {
      value: 'match',
      probabilities: { match: 1, partial: 0, mismatch: 0 },
    },
    result_fidelity: {
      value: 'supported',
      probabilities: { supported: 1, partial: 0, unsupported: 0 },
    },
    evidence_adequacy: {
      value: 'sufficient',
      probabilities: {
        sufficient: 1,
        missing_provenance: 0,
        missing_caveat: 0,
        insufficient: 0,
      },
    },
    ...overrides,
  };
}

describe('CensusChat output evaluation contract', () => {
  it('accepts the versioned 20-case fixture set and its four groups', () => {
    const fixtures = validateFixtureDocument(fixtureDocument);
    const counts = fixtures.reduce<Record<string, number>>((result, fixture) => {
      result[fixture.group] = (result[fixture.group] || 0) + 1;
      return result;
    }, {});

    expect(fixtures).toHaveLength(20);
    expect(counts).toEqual({
      straightforward_lookup: 5,
      comparison_or_ranking: 5,
      ambiguous_or_underspecified: 5,
      known_failure_or_adversarial: 5,
    });
    expect(fixtures.filter((fixture) => fixture.evidence.provenance).every((fixture) => fixture.evidence.provenance!.clinical_data === false)).toBe(true);
    expect(fixtures.find((fixture) => fixture.id === 'failure-005')?.evidence.provenance).toBeUndefined();
  });

  it('rejects a fixture document with a missing evidence bundle', () => {
    expect(() => validateFixtureDocument({ ...fixtureDocument, cases: [{}] })).toThrow();
  });

  it('derives pass only when every required check is satisfied', () => {
    expect(deriveRoute(answers())).toBe('pass');
  });

  it.each([
    ['unsafe SQL', { sql_safety: { value: 'fail', probabilities: { pass: 0, fail: 1 }, matched_rules: ['BLOCKED_PATTERN'] } }],
    ['intent mismatch', { intent_match: { value: 'mismatch', probabilities: { match: 0, partial: 0, mismatch: 1 } } }],
    ['unsupported result', { result_fidelity: { value: 'unsupported', probabilities: { supported: 0, partial: 0, unsupported: 1 } } }],
  ])('derives revise for %s', (_label, override) => {
    expect(deriveRoute(answers(override))).toBe('revise');
  });

  it.each([
    ['partial intent', { intent_match: { value: 'partial', probabilities: { match: 0, partial: 1, mismatch: 0 } } }],
    ['partial result support', { result_fidelity: { value: 'partial', probabilities: { supported: 0, partial: 1, unsupported: 0 } } }],
    ['missing provenance', { evidence_adequacy: { value: 'missing_provenance', probabilities: { sufficient: 0, missing_provenance: 1, missing_caveat: 0, insufficient: 0 } } }],
    ['missing caveat', { evidence_adequacy: { value: 'missing_caveat', probabilities: { sufficient: 0, missing_provenance: 0, missing_caveat: 1, insufficient: 0 } } }],
    ['insufficient evidence', { evidence_adequacy: { value: 'insufficient', probabilities: { sufficient: 0, missing_provenance: 0, missing_caveat: 0, insufficient: 1 } } }],
  ])('derives human_review for %s', (_label, override) => {
    expect(deriveRoute(answers(override))).toBe('human_review');
  });

  it('keeps revise higher priority than human review', () => {
    expect(deriveRoute(answers({
      sql_safety: { value: 'fail', probabilities: { pass: 0, fail: 1 }, matched_rules: ['UNAUTHORIZED_TABLE'] },
      evidence_adequacy: { value: 'missing_provenance', probabilities: { sufficient: 0, missing_provenance: 1, missing_caveat: 0, insufficient: 0 } },
    }))).toBe('revise');
  });

  it('keeps the approved reference route deterministic without calling a judge', () => {
    const fixtures = validateFixtureDocument(fixtureDocument);
    for (const fixture of fixtures) {
      expect(deriveRoute(fixture.reference.answers)).toBe(fixture.reference.route);
    }
  });

  it('keeps the Jev request and response behind the stable evaluation seam', async () => {
    const fixture = validateFixtureDocument(fixtureDocument)[0];
    let requestBody: Record<string, unknown> | undefined;
    const fetchImpl: typeof fetch = async (_input, init) => {
      requestBody = JSON.parse(String(init?.body));
      return {
        ok: true,
        status: 200,
        json: async () => ({
          model: 'jev-test',
          answers: {
            intent_match: { type: 'choice', choice: 'match', probabilities: { match: 1, partial: 0, mismatch: 0 }, confidence: 1 },
            result_fidelity: { type: 'choice', choice: 'supported', probabilities: { supported: 1, partial: 0, unsupported: 0 }, confidence: 1 },
            evidence_adequacy: { type: 'choice', choice: 'sufficient', probabilities: { sufficient: 1, missing_provenance: 0, missing_caveat: 0, insufficient: 0 }, confidence: 1 },
          },
          usage: { input_tokens: 10, output_tokens: 5 },
        }),
      } as Response;
    };

    const result = await evaluateOutput(fixture.evidence, DEFAULT_JEV_QUESTIONS, {
      apiKey: 'test-only',
      fetchImpl,
    });

    expect(requestBody).toMatchObject({ model: 'jev-latest', questions: DEFAULT_JEV_QUESTIONS });
    expect((requestBody?.state as Record<string, unknown>).question).toBe(fixture.evidence.question);
    expect(result.judge).toBe('jev');
    expect(result.model).toBe('jev-test');
    expect(result.answers.sql_safety.value).toBe('pass');
    expect(deriveRoute(result.answers)).toBe('pass');
  });
});
