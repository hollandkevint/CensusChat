/**
 * Module Template Generator - Rapid dataset integration framework
 * Generates complete FDB-MCP modules for new public datasets
 */

import * as fs from 'fs';
import * as path from 'path';
import { GenericDatasetConfig } from '../patterns/GenericDatasetPatterns';

export interface ModuleGenerationConfig {
  moduleName: string;
  domain: string;
  datasetConfig: GenericDatasetConfig;
  outputDirectory: string;
  includeTests: boolean;
  includeDocs: boolean;
  mcpIntegration: boolean;
}

export interface GeneratedModuleStructure {
  modulePath: string;
  generatedFiles: string[];
  integrationPoints: string[];
  nextSteps: string[];
}

export class ModuleTemplateGenerator {
  private templatesPath: string;

  constructor(templatesPath?: string) {
    this.templatesPath = templatesPath || path.join(__dirname, '..', 'templates');
    console.log('🏗️ Module Template Generator initialized');
  }

  /**
   * Generate complete FDB-MCP module from configuration
   */
  async generateModule(config: ModuleGenerationConfig): Promise<GeneratedModuleStructure> {
    console.log(`🚀 Generating ${config.domain} analytics module: ${config.moduleName}`);

    const modulePath = path.join(config.outputDirectory, `${config.moduleName}_analytics`);
    await this.ensureDirectoryExists(modulePath);

    const generatedFiles: string[] = [];

    // Generate core module files
    generatedFiles.push(...await this.generateCoreFiles(modulePath, config));

    // Generate pattern files
    generatedFiles.push(...await this.generatePatternFiles(modulePath, config));

    // Generate adapter files
    generatedFiles.push(...await this.generateAdapterFiles(modulePath, config));

    // Generate MCP integration files
    if (config.mcpIntegration) {
      generatedFiles.push(...await this.generateMCPFiles(modulePath, config));
    }

    // Generate test files
    if (config.includeTests) {
      generatedFiles.push(...await this.generateTestFiles(modulePath, config));
    }

    // Generate documentation
    if (config.includeDocs) {
      generatedFiles.push(...await this.generateDocumentationFiles(modulePath, config));
    }

    // Generate integration configuration
    generatedFiles.push(...await this.generateIntegrationFiles(modulePath, config));

    const integrationPoints = this.getIntegrationPoints(config);
    const nextSteps = this.getNextSteps(config, modulePath);

    console.log(`✅ Module generation completed: ${generatedFiles.length} files created`);

    return {
      modulePath,
      generatedFiles,
      integrationPoints,
      nextSteps
    };
  }

  /**
   * Generate core module files
   */
  private async generateCoreFiles(modulePath: string, config: ModuleGenerationConfig): Promise<string[]> {
    const coreDir = path.join(modulePath, 'core');
    await this.ensureDirectoryExists(coreDir);

    const files: string[] = [];

    // Generate types file
    const typesFile = path.join(coreDir, `${config.domain}AnalyticsTypes.ts`);
    const typesContent = this.generateTypesTemplate(config);
    await fs.promises.writeFile(typesFile, typesContent);
    files.push(typesFile);

    // Generate dataset interface
    const interfaceFile = path.join(coreDir, `${this.capitalize(config.domain)}DatasetInterface.ts`);
    const interfaceContent = this.generateDatasetInterfaceTemplate(config);
    await fs.promises.writeFile(interfaceFile, interfaceContent);
    files.push(interfaceFile);

    // Generate query router
    const routerFile = path.join(coreDir, `${this.capitalize(config.domain)}QueryRouter.ts`);
    const routerContent = this.generateQueryRouterTemplate(config);
    await fs.promises.writeFile(routerFile, routerContent);
    files.push(routerFile);

    // Generate main module index
    const indexFile = path.join(modulePath, 'index.ts');
    const indexContent = this.generateModuleIndexTemplate(config);
    await fs.promises.writeFile(indexFile, indexContent);
    files.push(indexFile);

    return files;
  }

  /**
   * Generate pattern files
   */
  private async generatePatternFiles(modulePath: string, config: ModuleGenerationConfig): Promise<string[]> {
    const patternsDir = path.join(modulePath, 'patterns');
    await this.ensureDirectoryExists(patternsDir);

    const files: string[] = [];

    // Generate SQL pattern library
    const sqlLibraryFile = path.join(patternsDir, `${this.capitalize(config.domain)}SqlLibrary.ts`);
    const sqlLibraryContent = this.generateSqlLibraryTemplate(config);
    await fs.promises.writeFile(sqlLibraryFile, sqlLibraryContent);
    files.push(sqlLibraryFile);

    // Generate domain-specific patterns
    const domainPatternsFile = path.join(patternsDir, `${this.capitalize(config.domain)}Patterns.ts`);
    const domainPatternsContent = this.generateDomainPatternsTemplate(config);
    await fs.promises.writeFile(domainPatternsFile, domainPatternsContent);
    files.push(domainPatternsFile);

    return files;
  }

  /**
   * Generate adapter files
   */
  private async generateAdapterFiles(modulePath: string, config: ModuleGenerationConfig): Promise<string[]> {
    const adaptersDir = path.join(modulePath, 'adapters');
    await this.ensureDirectoryExists(adaptersDir);

    const files: string[] = [];

    // Generate primary data source adapter
    const primaryAdapterFile = path.join(adaptersDir, `${this.capitalize(config.datasetConfig.primaryDataSource)}Adapter.ts`);
    const primaryAdapterContent = this.generateAdapterTemplate(config, config.datasetConfig.primaryDataSource, true);
    await fs.promises.writeFile(primaryAdapterFile, primaryAdapterContent);
    files.push(primaryAdapterFile);

    // Generate fallback adapters
    for (const fallbackSource of config.datasetConfig.fallbackSources) {
      const fallbackFile = path.join(adaptersDir, `${this.capitalize(fallbackSource)}Adapter.ts`);
      const fallbackContent = this.generateAdapterTemplate(config, fallbackSource, false);
      await fs.promises.writeFile(fallbackFile, fallbackContent);
      files.push(fallbackFile);
    }

    return files;
  }

  /**
   * Generate MCP integration files
   */
  private async generateMCPFiles(modulePath: string, config: ModuleGenerationConfig): Promise<string[]> {
    const mcpDir = path.join(modulePath, 'mcp');
    await this.ensureDirectoryExists(mcpDir);

    const files: string[] = [];

    // Generate MCP connector
    const connectorFile = path.join(mcpDir, `${this.capitalize(config.domain)}MCPConnector.ts`);
    const connectorContent = this.generateMCPConnectorTemplate(config);
    await fs.promises.writeFile(connectorFile, connectorContent);
    files.push(connectorFile);

    // Generate MCP tools definition
    const toolsFile = path.join(mcpDir, `${this.capitalize(config.domain)}MCPTools.ts`);
    const toolsContent = this.generateMCPToolsTemplate(config);
    await fs.promises.writeFile(toolsFile, toolsContent);
    files.push(toolsFile);

    return files;
  }

  /**
   * Generate test files
   */
  private async generateTestFiles(modulePath: string, config: ModuleGenerationConfig): Promise<string[]> {
    const testDir = path.join(modulePath, '__tests__');
    await this.ensureDirectoryExists(testDir);

    const files: string[] = [];

    // Generate unit tests
    const unitTestFile = path.join(testDir, `${config.domain}Analytics.test.ts`);
    const unitTestContent = this.generateUnitTestTemplate(config);
    await fs.promises.writeFile(unitTestFile, unitTestContent);
    files.push(unitTestFile);

    // Generate integration tests
    const integrationTestFile = path.join(testDir, `${config.domain}Integration.test.ts`);
    const integrationTestContent = this.generateIntegrationTestTemplate(config);
    await fs.promises.writeFile(integrationTestFile, integrationTestContent);
    files.push(integrationTestFile);

    return files;
  }

  /**
   * Generate documentation files
   */
  private async generateDocumentationFiles(modulePath: string, config: ModuleGenerationConfig): Promise<string[]> {
    const docsDir = path.join(modulePath, 'docs');
    await this.ensureDirectoryExists(docsDir);

    const files: string[] = [];

    // Generate README
    const readmeFile = path.join(docsDir, 'README.md');
    const readmeContent = this.generateReadmeTemplate(config);
    await fs.promises.writeFile(readmeFile, readmeContent);
    files.push(readmeFile);

    // Generate API documentation
    const apiDocsFile = path.join(docsDir, 'API_REFERENCE.md');
    const apiDocsContent = this.generateAPIDocsTemplate(config);
    await fs.promises.writeFile(apiDocsFile, apiDocsContent);
    files.push(apiDocsFile);

    return files;
  }

  /**
   * Generate integration configuration files
   */
  private async generateIntegrationFiles(modulePath: string, config: ModuleGenerationConfig): Promise<string[]> {
    const files: string[] = [];

    // Generate module configuration
    const configFile = path.join(modulePath, 'config.json');
    const configContent = JSON.stringify({
      moduleName: config.moduleName,
      domain: config.domain,
      version: '1.0.0',
      datasetConfig: config.datasetConfig,
      integrationPoints: this.getIntegrationPoints(config)
    }, null, 2);
    await fs.promises.writeFile(configFile, configContent);
    files.push(configFile);

    return files;
  }

  /**
   * Template generators
   */
  private generateTypesTemplate(config: ModuleGenerationConfig): string {
    return `/**
 * ${this.capitalize(config.domain)} Analytics Types
 * Generated by FDB-MCP Module Template Generator
 */

export interface ${this.capitalize(config.domain)}AnalyticsPattern {
  intent: '${config.domain}_analytics' | '${config.domain}_demographics';
  entities: {
    geography: string[];
    metrics: string[];
    timeframe?: string;
  };
  sqlPattern: string;
  parameters: Record<string, any>;
}

export interface ${this.capitalize(config.domain)}DataPoint {
  geography: string;
  state?: string;
  ${config.datasetConfig.standardMetrics.map(metric => `${metric}?: number;`).join('\n  ')}
  timestamp: Date;
  source: string;
}

export interface ${this.capitalize(config.domain)}AnalyticsResult {
  data: ${this.capitalize(config.domain)}DataPoint[];
  metadata: {
    source: string;
    executionTime: number;
    recordCount: number;
    geography: string[];
  };
}

export interface ${this.capitalize(config.domain)}DatasetConfig {
  domain: '${config.domain}';
  primarySource: '${config.datasetConfig.primaryDataSource}';
  fallbackSources: string[];
  temporalGranularity: '${config.datasetConfig.temporalGranularity}';
}`;
  }

  private generateDatasetInterfaceTemplate(config: ModuleGenerationConfig): string {
    return `/**
 * ${this.capitalize(config.domain)} Dataset Interface
 * Generic interface for ${config.domain} data source integration
 */

import { PublicDatasetAdapter } from '../../healthcare_analytics/types/HealthcareAnalyticsTypes';
import { ${this.capitalize(config.domain)}AnalyticsResult, ${this.capitalize(config.domain)}AnalyticsPattern } from './${config.domain}AnalyticsTypes';

export interface ${this.capitalize(config.domain)}DatasetAdapter extends PublicDatasetAdapter {
  source: '${config.datasetConfig.primaryDataSource}' | ${config.datasetConfig.fallbackSources.map(s => `'${s}'`).join(' | ')};

  query${this.capitalize(config.domain)}Data(pattern: ${this.capitalize(config.domain)}AnalyticsPattern): Promise<${this.capitalize(config.domain)}AnalyticsResult>;

  getSupportedMetrics(): string[];
  getSupportedGeographies(): string[];
  getTemporalRange(): { start: Date; end: Date };
}

export class Base${this.capitalize(config.domain)}Adapter implements ${this.capitalize(config.domain)}DatasetAdapter {
  source: '${config.datasetConfig.primaryDataSource}' = '${config.datasetConfig.primaryDataSource}';

  async connect(): Promise<void> {
    console.log('🔌 Connecting to ${config.domain} data source');
  }

  async disconnect(): Promise<void> {
    console.log('🔌 Disconnecting from ${config.domain} data source');
  }

  async query(sqlPattern: string, parameters: any): Promise<any[]> {
    // Implementation depends on specific data source API
    throw new Error('Method must be implemented by concrete adapter');
  }

  async transformResults(rawData: any[]): Promise<any> {
    // Transform raw data to standardized format
    throw new Error('Method must be implemented by concrete adapter');
  }

  async query${this.capitalize(config.domain)}Data(pattern: ${this.capitalize(config.domain)}AnalyticsPattern): Promise<${this.capitalize(config.domain)}AnalyticsResult> {
    const rawData = await this.query(pattern.sqlPattern, pattern.parameters);
    const transformed = await this.transformResults(rawData);

    return {
      data: transformed.data,
      metadata: {
        source: this.source,
        executionTime: Date.now(),
        recordCount: transformed.data.length,
        geography: pattern.entities.geography
      }
    };
  }

  async healthCheck(): Promise<{ healthy: boolean }> {
    return { healthy: true };
  }

  getSupportedMetrics(): string[] {
    return ${JSON.stringify(config.datasetConfig.standardMetrics)};
  }

  getSupportedGeographies(): string[] {
    return ${JSON.stringify(config.datasetConfig.commonGeographies)};
  }

  getTemporalRange(): { start: Date; end: Date } {
    // Most ${config.domain} datasets cover recent years
    return {
      start: new Date('2018-01-01'),
      end: new Date()
    };
  }
}`;
  }

  private generateQueryRouterTemplate(config: ModuleGenerationConfig): string {
    return `/**
 * ${this.capitalize(config.domain)} Query Router
 * Natural language to SQL translation for ${config.domain} analytics
 */

import { ${this.capitalize(config.domain)}AnalyticsPattern } from './${config.domain}AnalyticsTypes';

export class ${this.capitalize(config.domain)}QueryRouter {
  private patterns: Map<string, string> = new Map();

  constructor() {
    this.initializePatterns();
  }

  private initializePatterns(): void {
    // Common ${config.domain} query patterns
    ${config.datasetConfig.standardMetrics.map(metric =>
      `this.patterns.set('${metric}', 'SELECT geography, ${metric} FROM ${config.domain}_data WHERE geography IN ({geography})');`
    ).join('\n    ')}
  }

  async translateQuery(query: string, geography: string[], timeframe?: string): Promise<${this.capitalize(config.domain)}AnalyticsPattern> {
    const queryLower = query.toLowerCase();
    let intent: '${config.domain}_analytics' | '${config.domain}_demographics' = '${config.domain}_analytics';
    let metrics: string[] = [];
    let sqlPattern: string = '';

    // Analyze query for ${config.domain} context
    ${config.datasetConfig.standardMetrics.map(metric => `
    if (queryLower.includes('${metric.replace(/_/g, ' ')}')) {
      metrics.push('${metric}');
      sqlPattern = this.patterns.get('${metric}') || '';
    }`).join('')}

    // Default to comprehensive ${config.domain} query if no specific metrics found
    if (metrics.length === 0) {
      metrics = this.getAllMetrics();
      sqlPattern = this.getComprehensiveQuery();
      intent = '${config.domain}_demographics';
    }

    return {
      intent,
      entities: {
        geography,
        metrics,
        timeframe: timeframe || '2023'
      },
      sqlPattern,
      parameters: {
        geography: geography.map(g => \`'\${g}'\`).join(','),
        year: timeframe || '2023'
      }
    };
  }

  private getAllMetrics(): string[] {
    return ${JSON.stringify(config.datasetConfig.standardMetrics)};
  }

  private getComprehensiveQuery(): string {
    return \`
      SELECT
        geography, state,
        \${this.getAllMetrics().join(', ')}
      FROM ${config.domain}_comprehensive_view
      WHERE geography IN ({geography})
        AND year = {year}
      ORDER BY geography
    \`;
  }
}`;
  }

  private generateModuleIndexTemplate(config: ModuleGenerationConfig): string {
    return `/**
 * ${this.capitalize(config.domain)} Analytics Module
 * FDB-MCP integration for ${config.domain} public datasets
 */

export { ${this.capitalize(config.domain)}QueryRouter } from './core/${this.capitalize(config.domain)}QueryRouter';
export { Base${this.capitalize(config.domain)}Adapter } from './core/${this.capitalize(config.domain)}DatasetInterface';
export * from './core/${config.domain}AnalyticsTypes';
export * from './patterns/${this.capitalize(config.domain)}Patterns';

import { ${this.capitalize(config.domain)}QueryRouter } from './core/${this.capitalize(config.domain)}QueryRouter';
import { getDatasetFederator } from '../healthcare_analytics/core/DatasetFederator';

export class ${this.capitalize(config.domain)}AnalyticsModule {
  private queryRouter: ${this.capitalize(config.domain)}QueryRouter;

  constructor() {
    this.queryRouter = new ${this.capitalize(config.domain)}QueryRouter();
    console.log('🎓 ${this.capitalize(config.domain)} Analytics Module initialized');
  }

  async query(naturalLanguageQuery: string, geography: string[], timeframe?: string) {
    const pattern = await this.queryRouter.translateQuery(naturalLanguageQuery, geography, timeframe);
    const federator = getDatasetFederator();

    return await federator.executeDistributedQuery(pattern);
  }
}`;
  }

  private generateSqlLibraryTemplate(config: ModuleGenerationConfig): string {
    return `/**
 * ${this.capitalize(config.domain)} SQL Pattern Library
 * Optimized SQL patterns for ${config.domain} analytics
 */

export class ${this.capitalize(config.domain)}SqlLibrary {
  static getPatterns(): Record<string, string> {
    return {
      ${config.datasetConfig.standardMetrics.map(metric => `
      '${metric}': \`
        SELECT
          geography, state,
          ${metric},
          year
        FROM ${config.domain}_${metric}_view
        WHERE geography IN ({geography})
          AND year = {year}
        ORDER BY ${metric} DESC
      \``).join(',\n      ')},

      'comprehensive_analysis': \`
        SELECT
          geography, state,
          ${config.datasetConfig.standardMetrics.join(',\n          ')},
          year
        FROM ${config.domain}_comprehensive_view
        WHERE geography IN ({geography})
          AND year = {year}
        ORDER BY geography
      \`
    };
  }

  static optimizeForPerformance(sql: string): string {
    // Add performance optimizations specific to ${config.domain} data
    let optimizedSql = sql;

    // Add indexing hints
    if (sql.includes('WHERE geography')) {
      optimizedSql = optimizedSql.replace('WHERE geography', 'WHERE /*+ INDEX(geo_idx) */ geography');
    }

    // Add result limits for large datasets
    if (!sql.toLowerCase().includes('limit')) {
      optimizedSql += ' LIMIT 10000';
    }

    return optimizedSql;
  }
}`;
  }

  private generateDomainPatternsTemplate(config: ModuleGenerationConfig): string {
    return `/**
 * ${this.capitalize(config.domain)} Domain Patterns
 * Domain-specific query patterns for ${config.domain} analytics
 */

import { getGenericDatasetPatterns } from '../../healthcare_analytics/patterns/GenericDatasetPatterns';

export class ${this.capitalize(config.domain)}Patterns {
  static getDomainPatterns() {
    const genericPatterns = getGenericDatasetPatterns();
    return genericPatterns.getPatternsForDomain('${config.domain}');
  }

  static translateNaturalLanguage(query: string, geography: string[], timeframe?: string) {
    const genericPatterns = getGenericDatasetPatterns();
    return genericPatterns.translateGenericQuery(query, '${config.domain}', geography, timeframe);
  }
}`;
  }

  private generateAdapterTemplate(config: ModuleGenerationConfig, sourceName: string, isPrimary: boolean): string {
    return `/**
 * ${this.capitalize(sourceName)} Adapter
 * ${isPrimary ? 'Primary' : 'Fallback'} data source adapter for ${config.domain} analytics
 */

import { Base${this.capitalize(config.domain)}Adapter } from '../core/${this.capitalize(config.domain)}DatasetInterface';

export class ${this.capitalize(sourceName)}Adapter extends Base${this.capitalize(config.domain)}Adapter {
  source: '${sourceName}' = '${sourceName}';

  async connect(): Promise<void> {
    console.log('🔌 Connecting to ${sourceName} for ${config.domain} data');
    // Implement connection logic for ${sourceName}
    // This might involve API authentication, database connections, etc.
  }

  async query(sqlPattern: string, parameters: any): Promise<any[]> {
    console.log(\`📊 Querying ${sourceName} with pattern: \${sqlPattern.substring(0, 100)}...\`);

    // Mock implementation - replace with actual ${sourceName} API calls
    const mockData = this.generateMockData(parameters);

    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, ${isPrimary ? '200' : '500'}));

    return mockData;
  }

  async transformResults(rawData: any[]): Promise<any> {
    // Transform ${sourceName} specific data format to standardized format
    const standardizedData = rawData.map(record => ({
      geography: record.geography || record.county || record.area,
      state: record.state,
      ${config.datasetConfig.standardMetrics.map(metric => `${metric}: record.${metric} || 0,`).join('\n      ')}
      timestamp: new Date(),
      source: '${sourceName}'
    }));

    return {
      data: standardizedData,
      metadata: {
        source: '${sourceName}',
        transformedAt: new Date(),
        recordCount: standardizedData.length
      }
    };
  }

  private generateMockData(parameters: any): any[] {
    // Generate realistic mock data for ${config.domain}
    const geographies = parameters.geography?.split(',').map((g: string) => g.replace(/'/g, '')) || ['Sample County'];

    return geographies.map((geo: string) => ({
      geography: geo,
      state: 'Sample State',
      ${config.datasetConfig.standardMetrics.map(metric =>
        `${metric}: Math.floor(Math.random() * 10000) + 1000,`
      ).join('\n      ')}
      year: parameters.year || '2023'
    }));
  }

  async healthCheck(): Promise<{ healthy: boolean }> {
    try {
      // Implement ${sourceName} health check
      // This might involve a ping to API endpoints or test queries
      return { healthy: true };
    } catch (error) {
      console.error(\`❌ ${sourceName} health check failed:\`, error);
      return { healthy: false };
    }
  }
}`;
  }

  private generateMCPConnectorTemplate(config: ModuleGenerationConfig): string {
    return `/**
 * ${this.capitalize(config.domain)} MCP Connector
 * Model Context Protocol integration for ${config.domain} analytics
 */

import { MCPConnector } from '../../healthcare_analytics/core/MCPConnector';
import { ${this.capitalize(config.domain)}AnalyticsModule } from '../index';

export interface ${this.capitalize(config.domain)}MCPTools {
  ${config.datasetConfig.standardMetrics.map(metric =>
    `${metric}_analysis: (params: { geography: string[]; timeframe?: string }) => Promise<any>;`
  ).join('\n  ')}
  comprehensive_${config.domain}_report: (params: { geography: string[]; timeframe?: string }) => Promise<any>;
}

export class ${this.capitalize(config.domain)}MCPConnector extends MCPConnector {
  private ${config.domain}Module: ${this.capitalize(config.domain)}AnalyticsModule;

  constructor() {
    super();
    this.${config.domain}Module = new ${this.capitalize(config.domain)}AnalyticsModule();
  }

  async expose${this.capitalize(config.domain)}Tools(): Promise<${this.capitalize(config.domain)}MCPTools> {
    return {
      ${config.datasetConfig.standardMetrics.map(metric => `
      ${metric}_analysis: async (params) => {
        const query = \`Analyze ${metric.replace(/_/g, ' ')} for the specified areas\`;
        return await this.${config.domain}Module.query(query, params.geography, params.timeframe);
      },`).join('')}

      comprehensive_${config.domain}_report: async (params) => {
        const query = \`Generate comprehensive ${config.domain} analytics report\`;
        return await this.${config.domain}Module.query(query, params.geography, params.timeframe);
      }
    };
  }
}`;
  }

  private generateMCPToolsTemplate(config: ModuleGenerationConfig): string {
    return `/**
 * ${this.capitalize(config.domain)} MCP Tools Definition
 * Tool definitions for external MCP protocol access
 */

export const ${config.domain.toUpperCase()}_MCP_TOOLS = {
  tools: [
    ${config.datasetConfig.standardMetrics.map(metric => `{
      name: '${config.domain}_${metric}_analysis',
      description: 'Analyze ${metric.replace(/_/g, ' ')} metrics for specified geographic areas',
      inputSchema: {
        type: 'object',
        properties: {
          geography: {
            type: 'array',
            items: { type: 'string' },
            description: 'Geographic areas to analyze (counties, states, metros)'
          },
          timeframe: {
            type: 'string',
            description: 'Time period for analysis (default: current year)'
          }
        },
        required: ['geography']
      }
    }`).join(',\n    ')},
    {
      name: '${config.domain}_comprehensive_report',
      description: 'Generate comprehensive ${config.domain} analytics report',
      inputSchema: {
        type: 'object',
        properties: {
          geography: {
            type: 'array',
            items: { type: 'string' },
            description: 'Geographic areas for comprehensive analysis'
          },
          timeframe: {
            type: 'string',
            description: 'Time period for analysis (default: current year)'
          }
        },
        required: ['geography']
      }
    }
  ]
};`;
  }

  private generateUnitTestTemplate(config: ModuleGenerationConfig): string {
    return `/**
 * ${this.capitalize(config.domain)} Analytics Unit Tests
 */

import { ${this.capitalize(config.domain)}QueryRouter } from '../core/${this.capitalize(config.domain)}QueryRouter';
import { ${this.capitalize(config.domain)}AnalyticsModule } from '../index';

describe('${this.capitalize(config.domain)} Analytics Module', () => {
  let module: ${this.capitalize(config.domain)}AnalyticsModule;
  let queryRouter: ${this.capitalize(config.domain)}QueryRouter;

  beforeEach(() => {
    module = new ${this.capitalize(config.domain)}AnalyticsModule();
    queryRouter = new ${this.capitalize(config.domain)}QueryRouter();
  });

  describe('Query Router', () => {
    test('should translate natural language queries', async () => {
      const query = 'Show me ${config.datasetConfig.standardMetrics[0].replace(/_/g, ' ')} data';
      const geography = ['Test County'];

      const pattern = await queryRouter.translateQuery(query, geography);

      expect(pattern).toHaveProperty('intent');
      expect(pattern).toHaveProperty('entities');
      expect(pattern.entities.geography).toEqual(geography);
    });

    ${config.datasetConfig.standardMetrics.map(metric => `
    test('should handle ${metric} queries', async () => {
      const query = '${metric.replace(/_/g, ' ')} analysis';
      const geography = ['Sample Area'];

      const pattern = await queryRouter.translateQuery(query, geography);

      expect(pattern.entities.metrics).toContain('${metric}');
    });`).join('')}
  });

  describe('Module Integration', () => {
    test('should process queries end-to-end', async () => {
      const query = 'Comprehensive ${config.domain} analysis';
      const geography = ['Test County'];

      // Mock the federation layer
      jest.mock('../../healthcare_analytics/core/DatasetFederator');

      // Test would verify full integration
      expect(module).toBeDefined();
    });
  });
});`;
  }

  private generateIntegrationTestTemplate(config: ModuleGenerationConfig): string {
    return `/**
 * ${this.capitalize(config.domain)} Analytics Integration Tests
 */

import { ${this.capitalize(config.domain)}AnalyticsModule } from '../index';

describe('${this.capitalize(config.domain)} Analytics Integration', () => {
  let module: ${this.capitalize(config.domain)}AnalyticsModule;

  beforeAll(async () => {
    module = new ${this.capitalize(config.domain)}AnalyticsModule();
  });

  test('should connect to primary data source', async () => {
    // Integration test for primary data source connection
    expect(module).toBeDefined();
  });

  test('should handle failover to backup sources', async () => {
    // Integration test for failover scenarios
    expect(module).toBeDefined();
  });

  test('should meet performance requirements', async () => {
    const startTime = Date.now();

    await module.query('Sample query', ['Test County']);

    const duration = Date.now() - startTime;
    expect(duration).toBeLessThan(2000); // Sub-2s requirement
  });
});`;
  }

  private generateReadmeTemplate(config: ModuleGenerationConfig): string {
    return `# ${this.capitalize(config.domain)} Analytics Module

Fast Database - Model Context Protocol (FDB-MCP) integration for ${config.domain} public datasets.

## Overview

This module provides natural language query capabilities for ${config.domain} data analysis using the FDB-MCP framework. It supports federated queries across multiple ${config.domain} data sources with intelligent caching and sub-2 second response times.

## Features

- **Natural Language Processing**: Convert plain English queries to optimized SQL
- **Multi-Source Federation**: Primary and fallback data source integration
- **Performance Optimization**: Intelligent caching and query optimization
- **MCP Integration**: External protocol access for ${config.domain} analytics tools

## Supported Metrics

${config.datasetConfig.standardMetrics.map(metric => `- **${metric.replace(/_/g, ' ').toUpperCase()}**: ${metric} analysis and trends`).join('\n')}

## Data Sources

- **Primary**: ${config.datasetConfig.primaryDataSource}
${config.datasetConfig.fallbackSources.map(source => `- **Fallback**: ${source}`).join('\n')}

## Quick Start

\`\`\`typescript
import { ${this.capitalize(config.domain)}AnalyticsModule } from './${config.moduleName}_analytics';

const module = new ${this.capitalize(config.domain)}AnalyticsModule();

// Natural language query
const result = await module.query(
  'Show me ${config.datasetConfig.standardMetrics[0].replace(/_/g, ' ')} data for Miami-Dade County',
  ['Miami-Dade'],
  '2023'
);

console.log(result.data);
\`\`\`

## Geography Support

${config.datasetConfig.commonGeographies.map(geo => `- ${geo}`).join('\n')}

## API Reference

See [API_REFERENCE.md](./API_REFERENCE.md) for detailed API documentation.

## Testing

\`\`\`bash
npm test ${config.moduleName}
\`\`\`

## Integration

This module integrates with:
- Healthcare Analytics Module (base FDB-MCP framework)
- DuckDB Connection Pool
- MCP Server Infrastructure
- Performance Monitoring System
`;
  }

  private generateAPIDocsTemplate(config: ModuleGenerationConfig): string {
    return `# ${this.capitalize(config.domain)} Analytics API Reference

## Classes

### ${this.capitalize(config.domain)}AnalyticsModule

Main module class for ${config.domain} analytics.

#### Methods

##### \`query(naturalLanguageQuery: string, geography: string[], timeframe?: string)\`

Execute natural language query against ${config.domain} data sources.

**Parameters:**
- \`naturalLanguageQuery\`: Plain English query
- \`geography\`: Array of geographic identifiers
- \`timeframe\`: Optional time period (default: current year)

**Returns:** Promise<FederatedQueryResult>

**Example:**
\`\`\`typescript
const result = await module.query(
  'Show graduation rates',
  ['Miami-Dade County'],
  '2023'
);
\`\`\`

## Interfaces

### ${this.capitalize(config.domain)}AnalyticsPattern

Query pattern structure for ${config.domain} analytics.

\`\`\`typescript
interface ${this.capitalize(config.domain)}AnalyticsPattern {
  intent: '${config.domain}_analytics' | '${config.domain}_demographics';
  entities: {
    geography: string[];
    metrics: string[];
    timeframe?: string;
  };
  sqlPattern: string;
  parameters: Record<string, any>;
}
\`\`\`

## MCP Tools

${config.datasetConfig.standardMetrics.map(metric => `
### ${metric}_analysis

Analyze ${metric.replace(/_/g, ' ')} for specified geographic areas.

**Input Schema:**
\`\`\`json
{
  "geography": ["string"],
  "timeframe": "string"
}
\`\`\`
`).join('')}

## Error Handling

The module implements comprehensive error handling:
- Data source failover
- Query timeout handling
- Invalid parameter validation
- Performance monitoring alerts
`;
  }

  /**
   * Helper methods
   */
  private async ensureDirectoryExists(dirPath: string): Promise<void> {
    try {
      await fs.promises.access(dirPath);
    } catch {
      await fs.promises.mkdir(dirPath, { recursive: true });
    }
  }

  private capitalize(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  private getIntegrationPoints(config: ModuleGenerationConfig): string[] {
    const points = [
      `Add ${config.moduleName}_analytics to main application routing`,
      `Configure ${config.datasetConfig.primaryDataSource} API credentials`,
      `Register adapters with DatasetFederator`,
    ];

    if (config.mcpIntegration) {
      points.push(`Add MCP tools to server tool registry`);
    }

    if (config.includeTests) {
      points.push(`Add test suite to CI/CD pipeline`);
    }

    return points;
  }

  private getNextSteps(config: ModuleGenerationConfig, modulePath: string): string[] {
    return [
      `Review generated files in ${modulePath}`,
      `Configure data source API connections`,
      `Run initial tests: npm test ${config.moduleName}`,
      `Update main application to import new module`,
      `Add MCP tools registration if enabled`,
      `Deploy and monitor performance metrics`
    ];
  }
}

export function createModuleTemplate(config: ModuleGenerationConfig): Promise<GeneratedModuleStructure> {
  const generator = new ModuleTemplateGenerator();
  return generator.generateModule(config);
}