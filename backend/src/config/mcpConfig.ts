export interface MCPServerConfig {
  name: string;
  description: string;
  version: string;
  security: {
    require_auth: boolean;
    allowed_operations: string[];
    data_classification: Record<string, string>;
    audit_retention_days: number;
  };
  capabilities: {
    resources: boolean;
    tools: boolean;
    prompts: boolean;
  };
  server: {
    host: string;
    port: number;
    timeout: number;
  };
  resources: {
    demographics: {
      uri: string;
      description: string;
      classification: string;
    };
    medicare_eligibility: {
      uri: string;
      description: string;
      classification: string;
    };
    population_health: {
      uri: string;
      description: string;
      classification: string;
    };
    facility_data: {
      uri: string;
      description: string;
      classification: string;
    };
  };
}

// CensusChat MCP Server Configuration for Healthcare Analytics
export const mcpServerConfig: MCPServerConfig = {
  name: "censuschat_server",
  description: "Healthcare demographics and analytics data server",
  version: "1.0.0",
  security: {
    require_auth: false, // For MVP - should be true in production
    allowed_operations: ["read", "query", "list"],
    data_classification: {
      PHI: "restricted",        // Protected Health Information - never expose
      Demographics: "internal", // Internal use only
      Aggregated: "public"      // Aggregated statistics - safe for external use
    },
    audit_retention_days: 2555 // 7 years for HIPAA compliance
  },
  capabilities: {
    resources: true,
    tools: true,
    prompts: true
  },
  server: {
    host: process.env.MCP_SERVER_HOST || 'localhost',
    port: parseInt(process.env.MCP_SERVER_PORT || '8080', 10),
    timeout: parseInt(process.env.MCP_TIMEOUT || '2000', 10) // 2-second timeout requirement
  },
  resources: {
    demographics: {
      uri: 'data://tables/demographics',
      description: 'County-level demographic data with Medicare eligibility metrics',
      classification: 'Aggregated'
    },
    medicare_eligibility: {
      uri: 'data://views/medicare_eligibility',
      description: 'Medicare eligibility rates and analysis by geography',
      classification: 'Aggregated'
    },
    population_health: {
      uri: 'data://views/population_health',
      description: 'Population health metrics and risk stratification',
      classification: 'Aggregated'
    },
    facility_data: {
      uri: 'data://views/facility_adequacy',
      description: 'Healthcare facility adequacy and access metrics',
      classification: 'Aggregated'
    }
  }
};

// MCP Client Configuration for External Connections
export interface MCPClientConfig {
  name: string;
  enabled: boolean;
  endpoint: string;
  timeout: number;
  retries: number;
  authentication?: {
    type: 'oauth' | 'apikey';
    credentials: Record<string, string>;
  };
}

export const mcpClientConfigs: Record<string, MCPClientConfig> = {
  census_api: {
    name: 'Census Bureau API',
    enabled: process.env.ENABLE_CENSUS_MCP === 'true',
    endpoint: process.env.CENSUS_MCP_ENDPOINT || 'https://api.census.gov/mcp',
    timeout: 2000,
    retries: 2,
    authentication: {
      type: 'apikey',
      credentials: {
        api_key: process.env.CENSUS_API_KEY || ''
      }
    }
  },
  medicare_api: {
    name: 'CMS Medicare Data',
    enabled: process.env.ENABLE_MEDICARE_MCP === 'true',
    endpoint: process.env.MEDICARE_MCP_ENDPOINT || 'https://api.medicare.gov/mcp',
    timeout: 2000,
    retries: 2,
    authentication: {
      type: 'oauth',
      credentials: {
        client_id: process.env.MEDICARE_CLIENT_ID || '',
        client_secret: process.env.MEDICARE_CLIENT_SECRET || ''
      }
    }
  }
};

// Healthcare Analytics Tools Configuration
export const healthcareAnalyticsTools = {
  calculate_medicare_eligibility: {
    name: 'Medicare Eligibility Calculator',
    description: 'Calculate Medicare eligibility rates for specified geographic areas',
    parameters: {
      type: 'object',
      properties: {
        geography_type: {
          type: 'string',
          enum: ['state', 'county', 'zipcode'],
          description: 'Geographic level for analysis'
        },
        geography_codes: {
          type: 'array',
          items: { type: 'string' },
          description: 'List of geographic codes (FIPS, ZIP, etc.)'
        },
        year: {
          type: 'integer',
          minimum: 2020,
          maximum: new Date().getFullYear(),
          description: 'Data year for analysis'
        }
      },
      required: ['geography_type', 'geography_codes']
    }
  },
  population_health_risk: {
    name: 'Population Health Risk Assessment',
    description: 'Assess population health risk factors and generate risk scores',
    parameters: {
      type: 'object',
      properties: {
        geography_type: {
          type: 'string',
          enum: ['state', 'county'],
          description: 'Geographic level for analysis'
        },
        geography_codes: {
          type: 'array',
          items: { type: 'string' },
          description: 'List of geographic codes'
        },
        risk_factors: {
          type: 'array',
          items: {
            type: 'string',
            enum: ['income', 'insurance', 'education', 'age', 'comorbidity']
          },
          description: 'Risk factors to include in assessment'
        }
      },
      required: ['geography_type', 'geography_codes', 'risk_factors']
    }
  },
  facility_adequacy: {
    name: 'Healthcare Facility Adequacy Analysis',
    description: 'Analyze healthcare facility adequacy and access metrics',
    parameters: {
      type: 'object',
      properties: {
        geography_type: {
          type: 'string',
          enum: ['state', 'county'],
          description: 'Geographic level for analysis'
        },
        geography_codes: {
          type: 'array',
          items: { type: 'string' },
          description: 'List of geographic codes'
        },
        facility_type: {
          type: 'string',
          enum: ['hospital', 'clinic', 'pharmacy', 'all'],
          description: 'Type of healthcare facility to analyze'
        }
      },
      required: ['geography_type', 'geography_codes']
    }
  }
};

console.log('🔧 MCP Configuration loaded:', {
  server: mcpServerConfig.name,
  version: mcpServerConfig.version,
  resources: Object.keys(mcpServerConfig.resources).length,
  tools: Object.keys(healthcareAnalyticsTools).length,
  clients: Object.keys(mcpClientConfigs).filter(k => mcpClientConfigs[k].enabled).length
});