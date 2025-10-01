import Anthropic from '@anthropic-ai/sdk';

export interface QueryAnalysis {
  intent: 'demographics' | 'geography' | 'comparison' | 'unknown';
  entities: {
    locations?: string[];
    demographics?: string[];
    ageGroups?: string[];
    incomeRanges?: string[];
    insuranceTypes?: string[];
  };
  filters: {
    minAge?: number;
    maxAge?: number;
    minIncome?: number;
    maxIncome?: number;
    state?: string;
    counties?: string[];
    zipCodes?: string[];
  };
  outputFormat: 'table' | 'summary' | 'export';
  confidence: number;
}

export interface CensusQueryResponse {
  analysis: QueryAnalysis;
  sqlQuery: string;
  explanation: string;
  suggestedRefinements?: string[];
}

class AnthropicService {
  private client: Anthropic;

  constructor() {
    if (!process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY === 'sk-ant-api03-PLACEHOLDER-ADD-YOUR-KEY-HERE') {
      console.warn('⚠️  Anthropic API key not configured. Using fallback service for demo purposes.');
      this.client = null as any;
      return;
    }

    this.client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
  }

  async analyzeQuery(userQuery: string): Promise<CensusQueryResponse> {
    // Fallback for demo when API key is not configured
    if (!this.client) {
      return this.getFallbackResponse(userQuery);
    }
    const systemPrompt = `You are a Census data expert that converts natural language queries into structured analysis for healthcare demographics.

Your task is to:
1. Parse the user's healthcare demographic query
2. Extract key entities (locations, demographics, age groups, income ranges)
3. Generate appropriate SQL for Census/ACS data
4. Provide clear explanations

Available Database Schema:
- Table name: county_data (NOT census_data)
- Columns: state_name (TEXT), county_name (TEXT), population (INTEGER), median_income (INTEGER), poverty_rate (DOUBLE)
- Geography: All US counties (3,144 rows), 51 states (50 + DC)
- State names: ALWAYS use full names like "California", "Texas", "Florida" (NOT abbreviations like "CA", "TX", "FL")
- State name format: Properly capitalized full names (e.g., "New York", "North Carolina")

Healthcare-specific mappings:
- "Medicare eligible" = Age 65+ (estimate as ~16% of population)
- "Medicare Advantage eligible" = Age 65+ with specific income thresholds
- "Senior care" = Age 65+, especially 75+ for assisted living
- "Health systems" = Population density + age + income analysis

IMPORTANT:
- Use "state_name" column with FULL state names (not "state_code")
- Example: WHERE state_name = 'California' (not state_code = 'CA')
- Table is "county_data" (not "census_data")

Respond with JSON in this exact format:
{
  "analysis": {
    "intent": "demographics|geography|comparison|unknown",
    "entities": {
      "locations": ["Florida", "Miami-Dade County"],
      "demographics": ["seniors", "Medicare eligible"],
      "ageGroups": ["65+"],
      "incomeRanges": ["$50k+"],
      "insuranceTypes": ["Medicare Advantage"]
    },
    "filters": {
      "minAge": 65,
      "minIncome": 50000,
      "state": "Florida",
      "counties": ["Miami-Dade", "Broward", "Palm Beach"]
    },
    "outputFormat": "table",
    "confidence": 0.95
  },
  "sqlQuery": "SELECT county_name, state_name, population, median_income, poverty_rate FROM county_data WHERE state_name = 'Florida' AND median_income > 50000 LIMIT 50",
  "explanation": "This query finds counties in Florida with median household income over $50,000, relevant for Medicare Advantage market analysis with higher-income seniors.",
  "suggestedRefinements": [
    "Add specific insurance penetration rates",
    "Include disability status for care needs assessment",
    "Break down by ZIP codes for service area planning"
  ]
}`;

    try {
      const response = await this.client.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 2048,
        temperature: 0.1,
        system: systemPrompt,
        messages: [{
          role: 'user',
          content: `Analyze this healthcare demographic query and generate the structured response: "${userQuery}"`
        }]
      });

      const content = response.content[0];
      if (content.type === 'text') {
        try {
          return JSON.parse(content.text);
        } catch (parseError) {
          throw new Error(`Failed to parse Anthropic response: ${parseError}`);
        }
      } else {
        throw new Error('Unexpected response type from Anthropic API');
      }
    } catch (error) {
      console.error('Anthropic API error:', error);
      throw new Error(`Query analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async generateFollowUpQuestions(query: string, analysis: QueryAnalysis): Promise<string[]> {
    if (!this.client) {
      return [
        'What are the income levels for this population?',
        'How does this compare to neighboring areas?',
        'What about insurance coverage patterns?'
      ];
    }

    const systemPrompt = `Based on a healthcare demographic query and its analysis, suggest 3 relevant follow-up questions that would provide additional business insights.

Focus on:
- Market sizing opportunities
- Competitive analysis angles  
- Service planning considerations
- Regulatory or compliance aspects

Keep suggestions practical and specific to healthcare strategy teams.`;

    try {
      const response = await this.client.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 512,
        temperature: 0.3,
        system: systemPrompt,
        messages: [{
          role: 'user',
          content: `Original query: "${query}"\nAnalysis: ${JSON.stringify(analysis)}\n\nSuggest 3 follow-up questions:`
        }]
      });

      const content = response.content[0];
      if (content.type === 'text') {
        // Extract questions from the response
        return content.text
          .split('\n')
          .filter(line => line.trim().match(/^\d+\.|\-|\*/))
          .map(line => line.replace(/^\d+\.|\-|\*/, '').trim())
          .slice(0, 3);
      }
      return [];
    } catch (error) {
      console.error('Follow-up generation error:', error);
      return [];
    }
  }

  async explainResults(query: string, data: any[], analysis: QueryAnalysis): Promise<string> {
    if (!this.client) {
      return `Demo Results: Found ${data.length} records for your healthcare demographic query. This is sample data - connect a real Anthropic API key for detailed AI analysis and insights.`;
    }

    const systemPrompt = `You are explaining Census query results to healthcare strategy professionals. 

Provide a clear, business-focused explanation that:
1. Summarizes the key findings
2. Highlights actionable insights for healthcare markets
3. Notes any limitations or considerations
4. Suggests next steps for analysis

Keep it concise and focused on business value.`;

    try {
      const response = await this.client.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 1024,
        temperature: 0.2,
        system: systemPrompt,
        messages: [{
          role: 'user',
          content: `Original query: "${query}"\nQuery analysis: ${JSON.stringify(analysis)}\nResults data sample: ${JSON.stringify(data.slice(0, 3))}\nTotal records: ${data.length}\n\nExplain these results:`
        }]
      });

      const content = response.content[0];
      if (content.type === 'text') {
        return content.text;
      }
      return 'Results analysis completed successfully.';
    } catch (error) {
      console.error('Results explanation error:', error);
      return `Found ${data.length} records matching your query criteria.`;
    }
  }

  private getFallbackResponse(userQuery: string): CensusQueryResponse {
    // Demo fallback that provides reasonable responses for common healthcare queries
    const lowerQuery = userQuery.toLowerCase();

    let mockResponse: CensusQueryResponse = {
      analysis: {
        intent: 'demographics' as const,
        entities: {
          locations: [],
          demographics: [],
          ageGroups: [],
          incomeRanges: []
        },
        filters: {},
        outputFormat: 'table' as const,
        confidence: 0.8
      },
      sqlQuery: 'SELECT * FROM census_demo_data LIMIT 10',
      explanation: 'Demo mode: This query shows sample healthcare demographic data. Connect a real Anthropic API key for full AI analysis.',
      suggestedRefinements: [
        'Try: "Show me Medicare eligible seniors in Florida"',
        'Try: "Population over 65 in California counties"',
        'Try: "Healthcare workers by income in Texas"'
      ]
    };

    // Parse some common patterns
    if (lowerQuery.includes('florida') || lowerQuery.includes('fl')) {
      mockResponse.analysis.entities.locations = ['Florida'];
      mockResponse.analysis.filters.state = 'FL';
    }

    if (lowerQuery.includes('california') || lowerQuery.includes('ca')) {
      mockResponse.analysis.entities.locations = ['California'];
      mockResponse.analysis.filters.state = 'CA';
    }

    if (lowerQuery.includes('senior') || lowerQuery.includes('65') || lowerQuery.includes('medicare')) {
      mockResponse.analysis.entities.demographics = ['seniors', 'Medicare eligible'];
      mockResponse.analysis.entities.ageGroups = ['65+'];
      mockResponse.analysis.filters.minAge = 65;
      mockResponse.explanation = 'Demo mode: Showing Medicare-eligible population (65+) with sample data.';
    }

    if (lowerQuery.includes('income') || lowerQuery.includes('$')) {
      mockResponse.analysis.entities.incomeRanges = ['$50k+'];
      mockResponse.analysis.filters.minIncome = 50000;
    }

    return mockResponse;
  }
}

export const anthropicService = new AnthropicService();