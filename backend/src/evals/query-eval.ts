/**
 * CensusChat Query Evaluation Framework
 *
 * Best Practices Implementation:
 * - Golden dataset with expected results
 * - Multi-metric evaluation (accuracy, SQL correctness, performance)
 * - LLM-as-judge for quality assessment
 * - Real-world healthcare/census test cases
 * - Automated scoring and reporting
 */

import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import { anthropicService } from '../services/anthropicService';
import { getDuckDBPool } from '../utils/duckdbPool';

interface EvalTestCase {
  id: string;
  category: 'accuracy' | 'geography' | 'filters' | 'aggregation' | 'edge_case';
  query: string;
  expectedSql?: string;
  expectedRowCount?: number | { min: number; max: number };
  expectedDataContains?: Array<{ field: string; value: any }>;
  description: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
}

interface EvalResult {
  testId: string;
  passed: boolean;
  score: number; // 0-1
  metrics: {
    sqlCorrect: boolean;
    dataAccurate: boolean;
    rowCountMatch: boolean;
    responseTime: number;
    anthropicLatency: number;
  };
  actualSql?: string;
  actualRowCount?: number;
  actualData?: any[];
  error?: string;
  llmJudgeScore?: number;
}

interface EvalSummary {
  timestamp: string;
  totalTests: number;
  passed: number;
  failed: number;
  overallScore: number;
  categoryScores: Record<string, number>;
  averageResponseTime: number;
  results: EvalResult[];
}

class QueryEvaluator {
  private baseUrl: string;
  private goldenDataset: EvalTestCase[];
  private results: EvalResult[] = [];

  constructor(baseUrl: string = 'http://localhost:3001/api/v1') {
    this.baseUrl = baseUrl;
    this.goldenDataset = this.loadGoldenDataset();
  }

  private loadGoldenDataset(): EvalTestCase[] {
    const datasetPath = path.join(__dirname, 'golden-dataset.json');

    if (!fs.existsSync(datasetPath)) {
      throw new Error(`Golden dataset not found at ${datasetPath}`);
    }

    const data = JSON.parse(fs.readFileSync(datasetPath, 'utf-8'));
    return data.testCases;
  }

  /**
   * Execute a single test case
   */
  private async executeTest(testCase: EvalTestCase): Promise<EvalResult> {
    const startTime = Date.now();

    try {
      // Execute query against API
      const response = await axios.post(
        `${this.baseUrl}/queries`,
        { query: testCase.query },
        { timeout: 35000 }
      );

      const endTime = Date.now();
      const responseTime = endTime - startTime;

      const { success, data, metadata, message } = response.data;

      if (!success) {
        return {
          testId: testCase.id,
          passed: false,
          score: 0,
          metrics: {
            sqlCorrect: false,
            dataAccurate: false,
            rowCountMatch: false,
            responseTime,
            anthropicLatency: metadata?.queryTime || 0
          },
          error: message
        };
      }

      // Check SQL correctness (if expected SQL provided)
      const sqlCorrect = testCase.expectedSql
        ? this.compareSql(metadata?.analysis?.sqlQuery || '', testCase.expectedSql)
        : true;

      // Check row count
      const actualRowCount = data.length;
      const rowCountMatch = this.checkRowCount(actualRowCount, testCase.expectedRowCount);

      // Check data accuracy
      const dataAccurate = this.checkDataAccuracy(data, testCase.expectedDataContains);

      // Calculate score
      const metrics = {
        sqlCorrect,
        dataAccurate,
        rowCountMatch,
        responseTime,
        anthropicLatency: metadata?.queryTime || 0
      };

      const score = this.calculateScore(metrics);
      const passed = score >= 0.7; // 70% threshold

      return {
        testId: testCase.id,
        passed,
        score,
        metrics,
        actualSql: metadata?.analysis?.sqlQuery,
        actualRowCount,
        actualData: data.slice(0, 3) // Store first 3 rows for inspection
      };

    } catch (error) {
      return {
        testId: testCase.id,
        passed: false,
        score: 0,
        metrics: {
          sqlCorrect: false,
          dataAccurate: false,
          rowCountMatch: false,
          responseTime: Date.now() - startTime,
          anthropicLatency: 0
        },
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Compare SQL queries (normalize and check similarity)
   */
  private compareSql(actual: string, expected: string): boolean {
    const normalize = (sql: string) =>
      sql.toLowerCase()
        .replace(/\s+/g, ' ')
        .replace(/["']/g, '')
        .trim();

    const actualNorm = normalize(actual);
    const expectedNorm = normalize(expected);

    // Check if expected is substring of actual (allows for additional clauses)
    return actualNorm.includes(expectedNorm) ||
           this.calculateSimilarity(actualNorm, expectedNorm) > 0.8;
  }

  /**
   * Calculate string similarity (Levenshtein distance)
   */
  private calculateSimilarity(s1: string, s2: string): number {
    const longer = s1.length > s2.length ? s1 : s2;
    const shorter = s1.length > s2.length ? s2 : s1;

    if (longer.length === 0) return 1.0;

    const editDistance = this.levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }

  /**
   * Levenshtein distance algorithm
   */
  private levenshteinDistance(s1: string, s2: string): number {
    const costs: number[] = [];
    for (let i = 0; i <= s1.length; i++) {
      let lastValue = i;
      for (let j = 0; j <= s2.length; j++) {
        if (i === 0) {
          costs[j] = j;
        } else if (j > 0) {
          let newValue = costs[j - 1];
          if (s1.charAt(i - 1) !== s2.charAt(j - 1)) {
            newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
          }
          costs[j - 1] = lastValue;
          lastValue = newValue;
        }
      }
      if (i > 0) costs[s2.length] = lastValue;
    }
    return costs[s2.length];
  }

  /**
   * Check row count matches expectation
   */
  private checkRowCount(actual: number, expected?: number | { min: number; max: number }): boolean {
    if (!expected) return true;

    if (typeof expected === 'number') {
      return actual === expected;
    }

    return actual >= expected.min && actual <= expected.max;
  }

  /**
   * Check if actual data contains expected fields/values
   */
  private checkDataAccuracy(
    actualData: any[],
    expectedContains?: Array<{ field: string; value: any }>
  ): boolean {
    if (!expectedContains || expectedContains.length === 0) return true;
    if (actualData.length === 0) return false;

    return expectedContains.every(({ field, value }) => {
      return actualData.some(row => {
        const actualValue = row[field];

        // Handle different comparison types
        if (typeof value === 'string') {
          return String(actualValue).toLowerCase().includes(value.toLowerCase());
        }

        if (typeof value === 'number') {
          // Allow 5% tolerance for numeric values
          const tolerance = value * 0.05;
          return Math.abs(Number(actualValue) - value) <= tolerance;
        }

        return actualValue === value;
      });
    });
  }

  /**
   * Calculate overall score from metrics
   */
  private calculateScore(metrics: EvalResult['metrics']): number {
    const weights = {
      sqlCorrect: 0.3,
      dataAccurate: 0.4,
      rowCountMatch: 0.2,
      performance: 0.1
    };

    let score = 0;

    if (metrics.sqlCorrect) score += weights.sqlCorrect;
    if (metrics.dataAccurate) score += weights.dataAccurate;
    if (metrics.rowCountMatch) score += weights.rowCountMatch;

    // Performance score (< 10s = 1.0, > 30s = 0.0)
    const performanceScore = Math.max(0, Math.min(1, (30000 - metrics.responseTime) / 20000));
    score += performanceScore * weights.performance;

    return score;
  }

  /**
   * Use LLM as judge to evaluate response quality
   */
  private async llmJudgeEvaluation(
    query: string,
    response: any,
    expectedDescription: string
  ): Promise<number> {
    const prompt = `Evaluate the quality of this census data query response on a scale of 0-10.

Original Query: "${query}"
Expected: ${expectedDescription}

Response Data Sample: ${JSON.stringify(response.slice(0, 3), null, 2)}
Row Count: ${response.length}

Consider:
1. Does the data match what was requested?
2. Is the data complete and accurate?
3. Are the results reasonable for the query?

Respond with just a number 0-10.`;

    try {
      const analysis = await anthropicService.analyzeQuery(prompt);
      const scoreMatch = analysis.explanation?.match(/(\d+(?:\.\d+)?)/);
      return scoreMatch ? parseFloat(scoreMatch[1]) / 10 : 0.5;
    } catch (error) {
      console.error('LLM judge evaluation failed:', error);
      return 0.5; // Default score if LLM fails
    }
  }

  /**
   * Run all evaluations
   */
  async runEvaluation(): Promise<EvalSummary> {
    console.log('🧪 Starting CensusChat Query Evaluation...\n');
    console.log(`📋 Running ${this.goldenDataset.length} test cases\n`);

    const startTime = Date.now();
    this.results = [];

    // Run tests by priority
    const criticalTests = this.goldenDataset.filter(t => t.priority === 'critical');
    const highTests = this.goldenDataset.filter(t => t.priority === 'high');
    const otherTests = this.goldenDataset.filter(t => ['medium', 'low'].includes(t.priority));

    const orderedTests = [...criticalTests, ...highTests, ...otherTests];

    for (const testCase of orderedTests) {
      console.log(`Testing [${testCase.id}]: ${testCase.query}`);
      const result = await this.executeTest(testCase);

      // Add LLM judge score for critical tests
      if (testCase.priority === 'critical' && result.passed) {
        result.llmJudgeScore = await this.llmJudgeEvaluation(
          testCase.query,
          result.actualData || [],
          testCase.description
        );
      }

      this.results.push(result);

      const status = result.passed ? '✅ PASS' : '❌ FAIL';
      console.log(`  ${status} (score: ${(result.score * 100).toFixed(0)}%)\n`);
    }

    const endTime = Date.now();

    // Calculate summary
    const passed = this.results.filter(r => r.passed).length;
    const failed = this.results.length - passed;
    const overallScore = this.results.reduce((sum, r) => sum + r.score, 0) / this.results.length;
    const avgResponseTime = this.results.reduce((sum, r) => sum + r.metrics.responseTime, 0) / this.results.length;

    // Category scores
    const categoryScores: Record<string, number> = {};
    const categories = [...new Set(this.goldenDataset.map(t => t.category))];

    for (const category of categories) {
      const categoryResults = this.results.filter(r => {
        const test = this.goldenDataset.find(t => t.id === r.testId);
        return test?.category === category;
      });
      categoryScores[category] = categoryResults.reduce((sum, r) => sum + r.score, 0) / categoryResults.length;
    }

    const summary: EvalSummary = {
      timestamp: new Date().toISOString(),
      totalTests: this.results.length,
      passed,
      failed,
      overallScore,
      categoryScores,
      averageResponseTime: avgResponseTime,
      results: this.results
    };

    // Save results
    this.saveResults(summary);

    // Print summary
    this.printSummary(summary, endTime - startTime);

    return summary;
  }

  /**
   * Save evaluation results to file
   */
  private saveResults(summary: EvalSummary): void {
    const logsDir = path.join(__dirname, '../../logs');
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }

    const resultsPath = path.join(logsDir, 'eval-results.json');

    // Append to existing results
    let allResults: EvalSummary[] = [];
    if (fs.existsSync(resultsPath)) {
      allResults = JSON.parse(fs.readFileSync(resultsPath, 'utf-8'));
    }

    allResults.push(summary);
    fs.writeFileSync(resultsPath, JSON.stringify(allResults, null, 2));

    console.log(`\n📊 Results saved to: ${resultsPath}`);
  }

  /**
   * Print evaluation summary
   */
  private printSummary(summary: EvalSummary, totalTime: number): void {
    console.log('\n' + '='.repeat(60));
    console.log('📊 EVALUATION SUMMARY');
    console.log('='.repeat(60));
    console.log(`\n⏱️  Total Time: ${(totalTime / 1000).toFixed(1)}s`);
    console.log(`📋 Tests Run: ${summary.totalTests}`);
    console.log(`✅ Passed: ${summary.passed} (${((summary.passed / summary.totalTests) * 100).toFixed(1)}%)`);
    console.log(`❌ Failed: ${summary.failed} (${((summary.failed / summary.totalTests) * 100).toFixed(1)}%)`);
    console.log(`📈 Overall Score: ${(summary.overallScore * 100).toFixed(1)}%`);
    console.log(`⚡ Avg Response Time: ${summary.averageResponseTime.toFixed(0)}ms`);

    console.log('\n📊 Category Scores:');
    Object.entries(summary.categoryScores).forEach(([category, score]) => {
      console.log(`  ${category}: ${(score * 100).toFixed(1)}%`);
    });

    console.log('\n' + '='.repeat(60));

    // Print failures
    const failures = this.results.filter(r => !r.passed);
    if (failures.length > 0) {
      console.log('\n❌ FAILED TESTS:');
      failures.forEach(f => {
        const test = this.goldenDataset.find(t => t.id === f.testId);
        console.log(`\n  [${f.testId}] ${test?.query}`);
        console.log(`  Error: ${f.error || 'Metrics did not meet threshold'}`);
        console.log(`  Score: ${(f.score * 100).toFixed(0)}%`);
      });
    }
  }
}

// Run evaluation
async function main() {
  const evaluator = new QueryEvaluator();

  try {
    const summary = await evaluator.runEvaluation();

    // Exit with error code if tests failed
    if (summary.overallScore < 0.7) {
      console.error('\n❌ Evaluation failed: Score below 70% threshold');
      process.exit(1);
    }

    console.log('\n✅ Evaluation passed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Evaluation error:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

export { QueryEvaluator, EvalTestCase, EvalResult, EvalSummary };
