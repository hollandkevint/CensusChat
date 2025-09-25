/**
 * MCP Response Formatter
 * Standardized response formatting for external MCP protocol consumption
 */

import { MCP_HEALTHCARE_PROTOCOL_VERSION } from '../services/mcpHealthcareService';

// Standard MCP Response Envelope
export interface MCPResponseEnvelope<T = any> {
  // Protocol Information
  protocol: {
    version: string;
    timestamp: string;
    requestId?: string;
    correlationId?: string;
  };

  // Tool Information
  tool: {
    name: string;
    version: string;
    executionTime: number;
  };

  // Response Status
  status: {
    success: boolean;
    code: number;
    message?: string;
  };

  // Data Payload
  data?: T;

  // Metadata
  metadata: {
    recordCount: number;
    sources: string[];
    confidenceLevel: number;
    queryPattern?: string;
    cacheInfo?: {
      cached: boolean;
      ttl?: number;
    };
  };

  // Error Information (if applicable)
  error?: {
    code: string;
    message: string;
    details?: any;
    retryable: boolean;
  };

  // Links and Navigation
  links?: {
    self?: string;
    next?: string;
    documentation?: string;
    relatedTools?: string[];
  };
}

// Healthcare-Specific Response Types
export interface HealthcareMCPResponse extends MCPResponseEnvelope {
  data: {
    analytics: any[];
    summary?: {
      totalRecords: number;
      geographicCoverage: string[];
      keyInsights: string[];
      recommendations?: string[];
    };
    chartData?: {
      type: 'bar' | 'line' | 'pie' | 'scatter' | 'heatmap';
      categories: string[];
      series: any[];
    };
  };
}

// Error Response Codes
export enum MCPErrorCode {
  // Client Errors (4xx)
  INVALID_PARAMETERS = 'MCP_400_INVALID_PARAMETERS',
  AUTHENTICATION_REQUIRED = 'MCP_401_AUTHENTICATION_REQUIRED',
  AUTHORIZATION_FAILED = 'MCP_403_AUTHORIZATION_FAILED',
  TOOL_NOT_FOUND = 'MCP_404_TOOL_NOT_FOUND',
  RATE_LIMIT_EXCEEDED = 'MCP_429_RATE_LIMIT_EXCEEDED',

  // Server Errors (5xx)
  INTERNAL_SERVER_ERROR = 'MCP_500_INTERNAL_SERVER_ERROR',
  SERVICE_UNAVAILABLE = 'MCP_503_SERVICE_UNAVAILABLE',
  TIMEOUT = 'MCP_504_TIMEOUT',
  DATA_SOURCE_ERROR = 'MCP_550_DATA_SOURCE_ERROR'
}

export class MCPResponseFormatter {
  static formatSuccess<T>(
    toolName: string,
    data: T,
    metadata: {
      executionTime: number;
      recordCount: number;
      sources: string[];
      confidenceLevel: number;
      queryPattern?: string;
      requestId?: string;
      correlationId?: string;
    }
  ): MCPResponseEnvelope<T> {
    return {
      protocol: {
        version: MCP_HEALTHCARE_PROTOCOL_VERSION,
        timestamp: new Date().toISOString(),
        requestId: metadata.requestId,
        correlationId: metadata.correlationId
      },
      tool: {
        name: toolName,
        version: MCP_HEALTHCARE_PROTOCOL_VERSION,
        executionTime: metadata.executionTime
      },
      status: {
        success: true,
        code: 200,
        message: 'Analysis completed successfully'
      },
      data,
      metadata: {
        recordCount: metadata.recordCount,
        sources: metadata.sources,
        confidenceLevel: metadata.confidenceLevel,
        queryPattern: metadata.queryPattern,
        cacheInfo: {
          cached: false // Will be updated by caching layer
        }
      },
      links: {
        self: `/api/v1/mcp/tools/${toolName}`,
        documentation: `/api/v1/mcp/docs/${toolName}`,
        relatedTools: MCPResponseFormatter.getRelatedTools(toolName)
      }
    };
  }

  static formatError(
    toolName: string,
    errorCode: MCPErrorCode,
    message: string,
    details?: any,
    metadata?: {
      executionTime: number;
      requestId?: string;
      correlationId?: string;
    }
  ): MCPResponseEnvelope {
    const statusCode = parseInt(errorCode.split('_')[1]) || 500;
    const retryable = statusCode >= 500 && statusCode !== 501; // Server errors are generally retryable

    return {
      protocol: {
        version: MCP_HEALTHCARE_PROTOCOL_VERSION,
        timestamp: new Date().toISOString(),
        requestId: metadata?.requestId,
        correlationId: metadata?.correlationId
      },
      tool: {
        name: toolName,
        version: MCP_HEALTHCARE_PROTOCOL_VERSION,
        executionTime: metadata?.executionTime || 0
      },
      status: {
        success: false,
        code: statusCode,
        message: 'Analysis failed'
      },
      metadata: {
        recordCount: 0,
        sources: [],
        confidenceLevel: 0
      },
      error: {
        code: errorCode,
        message,
        details,
        retryable
      },
      links: {
        documentation: `/api/v1/mcp/docs/${toolName}`,
        self: `/api/v1/mcp/tools/${toolName}`
      }
    };
  }

  static formatHealthcareResponse(
    toolName: string,
    analyticsData: any[],
    metadata: {
      executionTime: number;
      recordCount: number;
      sources: string[];
      confidenceLevel: number;
      requestId?: string;
      correlationId?: string;
    },
    includeChartData = true
  ): HealthcareMCPResponse {
    const summary = this.generateSummary(analyticsData, toolName);
    const chartData = includeChartData ? this.generateChartData(analyticsData, toolName) : undefined;

    return {
      protocol: {
        version: MCP_HEALTHCARE_PROTOCOL_VERSION,
        timestamp: new Date().toISOString(),
        requestId: metadata.requestId,
        correlationId: metadata.correlationId
      },
      tool: {
        name: toolName,
        version: MCP_HEALTHCARE_PROTOCOL_VERSION,
        executionTime: metadata.executionTime
      },
      status: {
        success: true,
        code: 200,
        message: 'Healthcare analysis completed successfully'
      },
      data: {
        analytics: analyticsData,
        summary,
        chartData
      },
      metadata: {
        recordCount: metadata.recordCount,
        sources: metadata.sources,
        confidenceLevel: metadata.confidenceLevel,
        cacheInfo: {
          cached: false
        }
      },
      links: {
        self: `/api/v1/mcp/tools/${toolName}`,
        documentation: `/api/v1/mcp/docs/${toolName}`,
        relatedTools: this.getRelatedTools(toolName)
      }
    };
  }

  private static generateSummary(data: any[], toolName: string): any {
    if (!data || data.length === 0) {
      return {
        totalRecords: 0,
        geographicCoverage: [],
        keyInsights: ['No data available for analysis']
      };
    }

    const geographicCoverage = [...new Set(data.map(row =>
      row.state || row.county || row.geography || 'Unknown'
    ))];

    let keyInsights: string[] = [];
    let recommendations: string[] = [];

    switch (toolName) {
      case 'medicare_eligibility_analysis':
        keyInsights = this.generateMedicareInsights(data);
        recommendations = this.generateMedicareRecommendations(data);
        break;

      case 'population_health_assessment':
        keyInsights = this.generateHealthInsights(data);
        recommendations = this.generateHealthRecommendations(data);
        break;

      case 'facility_adequacy_calculator':
        keyInsights = this.generateFacilityInsights(data);
        recommendations = this.generateFacilityRecommendations(data);
        break;

      default:
        keyInsights = [`Analysis completed for ${data.length} records across ${geographicCoverage.length} geographic areas`];
    }

    return {
      totalRecords: data.length,
      geographicCoverage,
      keyInsights,
      recommendations
    };
  }

  private static generateMedicareInsights(data: any[]): string[] {
    const insights: string[] = [];

    const avgEligibilityRate = data.reduce((sum, row) => sum + (row.medicare_eligible_rate || 0), 0) / data.length;
    insights.push(`Average Medicare eligibility rate: ${avgEligibilityRate.toFixed(1)}%`);

    const highEligibilityAreas = data.filter(row => (row.medicare_eligible_rate || 0) > 20).length;
    if (highEligibilityAreas > 0) {
      insights.push(`${highEligibilityAreas} areas have high senior populations (>20% eligibility rate)`);
    }

    const totalBeneficiaries = data.reduce((sum, row) => sum + (row.estimated_medicare_beneficiaries || 0), 0);
    insights.push(`Total estimated Medicare beneficiaries: ${totalBeneficiaries.toLocaleString()}`);

    return insights;
  }

  private static generateHealthInsights(data: any[]): string[] {
    const insights: string[] = [];

    const highRiskAreas = data.filter(row => (row.composite_risk_score || 0) >= 9).length;
    if (highRiskAreas > 0) {
      insights.push(`${highRiskAreas} areas identified as high health risk`);
    }

    const avgRiskScore = data.reduce((sum, row) => sum + (row.composite_risk_score || 0), 0) / data.length;
    insights.push(`Average health risk score: ${avgRiskScore.toFixed(1)} out of 15`);

    return insights;
  }

  private static generateFacilityInsights(data: any[]): string[] {
    const insights: string[] = [];

    const underservedAreas = data.filter(row =>
      (row.adequacy_rating || '').toLowerCase().includes('underserved')
    ).length;

    if (underservedAreas > 0) {
      insights.push(`${underservedAreas} areas identified as underserved for healthcare facilities`);
    }

    const avgFacilitiesPerArea = data.reduce((sum, row) => sum + (row.facilities_count || 0), 0) / data.length;
    insights.push(`Average facilities per area: ${avgFacilitiesPerArea.toFixed(1)}`);

    return insights;
  }

  private static generateMedicareRecommendations(data: any[]): string[] {
    const recommendations: string[] = [];

    const highOpportunityAreas = data.filter(row =>
      (row.growth_opportunity_count || 0) > 1000
    ).length;

    if (highOpportunityAreas > 0) {
      recommendations.push(`Focus Medicare Advantage expansion on ${highOpportunityAreas} high-opportunity markets`);
    }

    recommendations.push('Consider dual-eligible special needs plans for low-income senior populations');

    return recommendations;
  }

  private static generateHealthRecommendations(data: any[]): string[] {
    const recommendations: string[] = [];

    const highRiskAreas = data.filter(row => (row.composite_risk_score || 0) >= 9);
    if (highRiskAreas.length > 0) {
      recommendations.push('Prioritize community health programs in high-risk areas');
      recommendations.push('Consider social determinants interventions for vulnerable populations');
    }

    return recommendations;
  }

  private static generateFacilityRecommendations(data: any[]): string[] {
    const recommendations: string[] = [];

    const criticallyUnderserved = data.filter(row =>
      (row.adequacy_rating || '').toLowerCase().includes('critically')
    );

    if (criticallyUnderserved.length > 0) {
      recommendations.push('Immediate facility investment needed in critically underserved areas');
      recommendations.push('Consider telemedicine solutions for remote area coverage');
    }

    return recommendations;
  }

  private static generateChartData(data: any[], toolName: string): any {
    if (!data || data.length === 0) return null;

    switch (toolName) {
      case 'medicare_eligibility_analysis':
        return {
          type: 'bar' as const,
          categories: data.map(row => row.county || row.state || row.geography || 'Unknown'),
          series: [{
            name: 'Medicare Eligibility Rate (%)',
            data: data.map(row => row.medicare_eligible_rate || 0)
          }]
        };

      case 'population_health_assessment':
        return {
          type: 'scatter' as const,
          categories: ['Risk Score vs Income'],
          series: data.map(row => ({
            name: row.county || row.geography || 'Unknown',
            x: row.median_household_income || 0,
            y: row.composite_risk_score || 0
          }))
        };

      case 'facility_adequacy_calculator':
        return {
          type: 'heatmap' as const,
          categories: data.map(row => row.county || row.geography || 'Unknown'),
          series: [{
            name: 'Facility Adequacy Score',
            data: data.map(row => row.facility_adequacy_score || 0)
          }]
        };

      default:
        return null;
    }
  }

  private static getRelatedTools(toolName: string): string[] {
    const toolRelationships: Record<string, string[]> = {
      'medicare_eligibility_analysis': [
        'population_health_assessment',
        'facility_adequacy_calculator'
      ],
      'population_health_assessment': [
        'medicare_eligibility_analysis',
        'facility_adequacy_calculator'
      ],
      'facility_adequacy_calculator': [
        'medicare_eligibility_analysis',
        'population_health_assessment'
      ],
      'healthcare_dashboard_composite': [
        'medicare_eligibility_analysis',
        'population_health_assessment',
        'facility_adequacy_calculator'
      ]
    };

    return toolRelationships[toolName] || [];
  }

  // Protocol Version Management
  static getProtocolInfo() {
    return {
      version: MCP_HEALTHCARE_PROTOCOL_VERSION,
      supportedVersions: ['v1.0.0'],
      deprecated: [],
      features: {
        'v1.0.0': [
          'medicare_eligibility_analysis',
          'population_health_assessment',
          'facility_adequacy_calculator',
          'healthcare_dashboard_composite',
          'standardized_response_format',
          'chart_data_generation',
          'summary_insights',
          'error_handling'
        ]
      },
      migration: {
        // Future migration guides will be added here
      }
    };
  }

  // Response Validation
  static validateResponse(response: MCPResponseEnvelope): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!response.protocol?.version) {
      errors.push('Protocol version is required');
    }

    if (!response.protocol?.timestamp) {
      errors.push('Protocol timestamp is required');
    }

    if (!response.tool?.name) {
      errors.push('Tool name is required');
    }

    if (typeof response.status?.success !== 'boolean') {
      errors.push('Status success boolean is required');
    }

    if (!response.status?.code) {
      errors.push('Status code is required');
    }

    if (!response.metadata) {
      errors.push('Metadata is required');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}

// Convenience Functions
export function createSuccessResponse<T>(
  toolName: string,
  data: T,
  metadata: any
): MCPResponseEnvelope<T> {
  return MCPResponseFormatter.formatSuccess(toolName, data, metadata);
}

export function createErrorResponse(
  toolName: string,
  errorCode: MCPErrorCode,
  message: string,
  details?: any,
  metadata?: any
): MCPResponseEnvelope {
  return MCPResponseFormatter.formatError(toolName, errorCode, message, details, metadata);
}

export function createHealthcareResponse(
  toolName: string,
  data: any[],
  metadata: any,
  includeChartData = true
): HealthcareMCPResponse {
  return MCPResponseFormatter.formatHealthcareResponse(toolName, data, metadata, includeChartData);
}