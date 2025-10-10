#!/usr/bin/env node

/**
 * Census Data Loader for CensusChat
 * Standalone script to download and load real Census data into DuckDB
 * Perfect for build-in-public demos and getting real data quickly
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

// Configuration
const CONFIG = {
  CENSUS_API_KEY: process.env.CENSUS_API_KEY, // Required: Set in .env file
  CENSUS_API_BASE: 'https://api.census.gov/data',
  DUCKDB_PATH: path.join(__dirname, '..', 'data', 'census.duckdb'),
  DATA_DIR: path.join(__dirname, '..', 'data'),
  TEMP_DIR: path.join(__dirname, '..', 'temp'),
  YEAR: '2022',
  DATASET: 'acs/acs5'
};

// Healthcare-focused Census variables for demos (verified ACS 5-year variables)
const HEALTHCARE_VARIABLES = {
  // Basic Demographics
  'B01003_001E': 'Total Population',
  'B25001_001E': 'Total Housing Units',
  'B19013_001E': 'Median Household Income',

  // Age Demographics (Healthcare focused)
  'B01001_020E': 'Male 65-66 years',
  'B01001_021E': 'Male 67-69 years',
  'B01001_022E': 'Male 70-74 years',
  'B01001_023E': 'Male 75-79 years',
  'B01001_024E': 'Male 80-84 years',
  'B01001_025E': 'Male 85+ years',
  'B01001_044E': 'Female 65-66 years',
  'B01001_045E': 'Female 67-69 years',
  'B01001_046E': 'Female 70-74 years',
  'B01001_047E': 'Female 75-79 years',
  'B01001_048E': 'Female 80-84 years',
  'B01001_049E': 'Female 85+ years',

  // Health Insurance Coverage (simplified - valid variables)
  'B27001_001E': 'Total for Health Insurance Coverage',
  'B27010_001E': 'Uninsured Population',

  // Disability Status (valid variables)
  'B18101_001E': 'Total Civilian Population for Disability',
  'B18101_004E': 'Under 18 with disability',
  'B18101_013E': '18-64 with disability',
  'B18101_022E': '65+ with disability'
};

// Target geographies for healthcare analysis
const TARGET_GEOGRAPHIES = [
  { type: 'state', codes: ['*'], label: 'All States' },
  { type: 'county', codes: ['*'], in: 'state:06,12,48,36,17,42,39,13,37,26', label: 'Major State Counties' }
];

class CensusDataLoader {
  constructor() {
    this.totalRequests = 0;
    this.completedRequests = 0;
    this.errors = [];
    this.startTime = Date.now();
  }

  log(message, type = 'info') {
    const timestamp = new Date().toISOString().substr(11, 8);
    const prefix = {
      info: '🔍',
      success: '✅',
      error: '❌',
      progress: '📊',
      warning: '⚠️'
    }[type] || 'ℹ️';

    console.log(`${prefix} [${timestamp}] ${message}`);
  }

  async ensureDirectories() {
    const dirs = [CONFIG.DATA_DIR, CONFIG.TEMP_DIR];
    for (const dir of dirs) {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        this.log(`Created directory: ${dir}`);
      }
    }
  }

  async fetchCensusData(variables, geography) {
    const variableList = variables.join(',');
    let url = `${CONFIG.CENSUS_API_BASE}/${CONFIG.YEAR}/${CONFIG.DATASET}?get=${variableList}&for=${geography.type}:${geography.codes.join(',')}`;

    if (geography.in) {
      url += `&in=${geography.in}`;
    }

    if (CONFIG.CENSUS_API_KEY) {
      url += `&key=${CONFIG.CENSUS_API_KEY}`;
    }

    this.log(`Fetching: ${geography.label} (${variables.length} variables)`, 'progress');

    return new Promise((resolve, reject) => {
      https.get(url, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          try {
            if (res.statusCode === 200) {
              const jsonData = JSON.parse(data);
              this.completedRequests++;
              resolve({
                geography: geography.label,
                variables: variables,
                data: jsonData,
                timestamp: new Date().toISOString()
              });
            } else {
              throw new Error(`HTTP ${res.statusCode}: ${data}`);
            }
          } catch (error) {
            this.errors.push({ url, error: error.message });
            reject(error);
          }
        });
      }).on('error', (error) => {
        this.errors.push({ url, error: error.message });
        reject(error);
      });
    });
  }

  async saveDataToFiles(datasets) {
    // Save raw JSON data
    const rawDataPath = path.join(CONFIG.DATA_DIR, 'census-raw-data.json');
    fs.writeFileSync(rawDataPath, JSON.stringify(datasets, null, 2));
    this.log(`Saved raw data to: ${rawDataPath}`, 'success');

    // Create CSV files for easy import into DuckDB
    const csvFiles = [];

    for (const dataset of datasets) {
      const fileName = `census-${dataset.geography.replace(/\s+/g, '_').toLowerCase()}-${CONFIG.YEAR}.csv`;
      const csvPath = path.join(CONFIG.DATA_DIR, fileName);

      if (dataset.data && dataset.data.length > 1) {
        const headers = dataset.data[0];
        const rows = dataset.data.slice(1);

        // Create CSV content
        const csvContent = [
          headers.join(','),
          ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
        ].join('\n');

        fs.writeFileSync(csvPath, csvContent);
        csvFiles.push({ path: csvPath, geography: dataset.geography, records: rows.length });
        this.log(`Created CSV: ${fileName} (${rows.length} records)`, 'success');
      }
    }

    return csvFiles;
  }

  async createDuckDBLoadScript(csvFiles) {
    const sqlCommands = [
      '-- CensusChat Census Data Loading Script',
      '-- Generated: ' + new Date().toISOString(),
      '',
      '-- Create main census data table',
      'CREATE TABLE IF NOT EXISTS census_data (',
      '  geography_type VARCHAR,',
      '  geography_code VARCHAR,',
      '  geography_name VARCHAR,',
      '  variable_code VARCHAR,',
      '  variable_name VARCHAR,',
      '  value BIGINT,',
      '  dataset VARCHAR,',
      '  year INTEGER,',
      '  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP',
      ');',
      '',
      '-- Create healthcare metrics view',
      'CREATE VIEW IF NOT EXISTS healthcare_metrics AS',
      'SELECT ',
      '  geography_type,',
      '  geography_code,',
      '  geography_name,',
      '  SUM(CASE WHEN variable_code LIKE \'B01001_0%\' THEN value ELSE 0 END) as total_population,',
      '  SUM(CASE WHEN variable_code IN (\'B01001_020E\',\'B01001_021E\',\'B01001_022E\',\'B01001_023E\',\'B01001_024E\',\'B01001_025E\',\'B01001_044E\',\'B01001_045E\',\'B01001_046E\',\'B01001_047E\',\'B01001_048E\',\'B01001_049E\') THEN value ELSE 0 END) as seniors_65_plus,',
      '  SUM(CASE WHEN variable_code = \'B27001_060E\' THEN value ELSE 0 END) as seniors_with_insurance,',
      '  SUM(CASE WHEN variable_code = \'B27001_063E\' THEN value ELSE 0 END) as seniors_without_insurance,',
      '  SUM(CASE WHEN variable_code = \'B18101_022E\' THEN value ELSE 0 END) as seniors_with_disability,',
      '  AVG(CASE WHEN variable_code = \'B19013_001E\' THEN value ELSE NULL END) as median_household_income',
      'FROM census_data ',
      'WHERE year = ' + CONFIG.YEAR,
      'GROUP BY geography_type, geography_code, geography_name;',
      ''
    ];

    // Add INSERT statements for each CSV file
    for (const file of csvFiles) {
      const relativePath = path.relative(path.dirname(CONFIG.DUCKDB_PATH), file.path);
      sqlCommands.push(`-- Load ${file.geography} data`);
      sqlCommands.push(`COPY census_data FROM '${relativePath}' (AUTO_DETECT TRUE);`);
      sqlCommands.push('');
    }

    // Add demo queries
    sqlCommands.push(
      '-- Demo Queries for Build-in-Public',
      '-- 1. Top 10 states by senior population',
      '-- SELECT geography_name, seniors_65_plus, total_population, ',
      '--        ROUND(100.0 * seniors_65_plus / total_population, 2) as senior_percentage',
      '-- FROM healthcare_metrics ',
      '-- WHERE geography_type = \'state\'',
      '-- ORDER BY seniors_65_plus DESC LIMIT 10;',
      '',
      '-- 2. Healthcare coverage analysis',
      '-- SELECT geography_name, seniors_with_insurance, seniors_without_insurance,',
      '--        ROUND(100.0 * seniors_with_insurance / (seniors_with_insurance + seniors_without_insurance), 2) as coverage_rate',
      '-- FROM healthcare_metrics',
      '-- WHERE geography_type = \'state\' AND seniors_with_insurance > 0',
      '-- ORDER BY coverage_rate DESC;',
      '',
      '-- 3. Market opportunity analysis',
      '-- SELECT geography_name, seniors_65_plus, median_household_income,',
      '--        seniors_with_disability, seniors_without_insurance',
      '-- FROM healthcare_metrics',
      '-- WHERE geography_type = \'state\' AND median_household_income > 50000',
      '-- ORDER BY seniors_65_plus DESC;'
    );

    const scriptPath = path.join(CONFIG.DATA_DIR, 'load-census-data.sql');
    fs.writeFileSync(scriptPath, sqlCommands.join('\n'));
    this.log(`Created DuckDB loading script: ${scriptPath}`, 'success');

    return scriptPath;
  }

  async generateSummaryReport(datasets, csvFiles) {
    const endTime = Date.now();
    const duration = (endTime - this.startTime) / 1000;

    const report = {
      summary: {
        duration_seconds: duration,
        total_requests: this.totalRequests,
        completed_requests: this.completedRequests,
        errors: this.errors.length,
        datasets_created: datasets.length,
        csv_files: csvFiles.length
      },
      datasets: datasets.map(d => ({
        geography: d.geography,
        variables: d.variables.length,
        records: d.data ? d.data.length - 1 : 0
      })),
      csvFiles: csvFiles.map(f => ({
        file: path.basename(f.path),
        geography: f.geography,
        records: f.records
      })),
      errors: this.errors,
      nextSteps: [
        "1. Install DuckDB CLI: brew install duckdb (Mac) or download from duckdb.org",
        "2. Load data: duckdb " + CONFIG.DUCKDB_PATH + " < " + path.join(CONFIG.DATA_DIR, 'load-census-data.sql'),
        "3. Query data: duckdb " + CONFIG.DUCKDB_PATH + " -c \"SELECT * FROM healthcare_metrics LIMIT 10;\"",
        "4. Use in CensusChat: Start the Docker containers with the loaded DuckDB file"
      ]
    };

    const reportPath = path.join(CONFIG.DATA_DIR, 'census-data-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

    this.log(`\n📊 Census Data Loading Complete!`, 'success');
    this.log(`⏱️  Duration: ${duration.toFixed(1)} seconds`, 'info');
    this.log(`📁 Files created in: ${CONFIG.DATA_DIR}`, 'info');
    this.log(`🗄️  CSV files: ${csvFiles.length}`, 'info');
    this.log(`📈 Total records: ${csvFiles.reduce((sum, f) => sum + f.records, 0)}`, 'info');

    if (this.errors.length > 0) {
      this.log(`⚠️  Errors encountered: ${this.errors.length}`, 'warning');
    }

    return report;
  }

  async loadCensusData() {
    this.log('🚀 Starting Census Data Loading for CensusChat', 'info');
    this.log(`🔑 API Key: ${CONFIG.CENSUS_API_KEY ? 'Configured' : 'Not configured (rate limited)'}`, 'info');

    await this.ensureDirectories();

    const datasets = [];
    const variables = Object.keys(HEALTHCARE_VARIABLES);

    // Calculate total requests
    this.totalRequests = TARGET_GEOGRAPHIES.length;

    // Fetch data for each geography
    for (const geography of TARGET_GEOGRAPHIES) {
      try {
        const dataset = await this.fetchCensusData(variables, geography);
        datasets.push(dataset);

        // Add delay to respect rate limits
        await new Promise(resolve => setTimeout(resolve, 500));

      } catch (error) {
        this.log(`Failed to fetch ${geography.label}: ${error.message}`, 'error');
      }
    }

    if (datasets.length === 0) {
      throw new Error('No data was successfully fetched from Census API');
    }

    // Save data to files
    const csvFiles = await this.saveDataToFiles(datasets);

    // Create DuckDB loading script
    await this.createDuckDBLoadScript(csvFiles);

    // Generate summary report
    const report = await this.generateSummaryReport(datasets, csvFiles);

    return report;
  }
}

// Run if called directly
if (require.main === module) {
  const loader = new CensusDataLoader();

  loader.loadCensusData()
    .then((report) => {
      console.log('\n✨ Census data loading completed successfully!');
      console.log('📝 Check the report file for details and next steps.');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Census data loading failed:');
      console.error(error.message);
      process.exit(1);
    });
}

module.exports = CensusDataLoader;