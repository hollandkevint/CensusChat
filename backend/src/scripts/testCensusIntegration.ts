#!/usr/bin/env ts-node

/**
 * Test script for Census API integration
 * Run with: npx ts-node src/scripts/testCensusIntegration.ts
 */

import { censusApiService } from '../services/censusApiService';
import { censusDataLoader } from '../utils/censusDataLoader';
import { censusDataModel } from '../models/CensusData';

async function testCensusIntegration() {
  console.log('🚀 Starting Census API Integration Test\n');
  
  try {
    // Test 1: Check API connectivity and knowledge base
    console.log('📋 Test 1: API Connectivity and Knowledge Base');
    console.log('===============================================');
    
    const rateLimit = censusApiService.getRateLimitInfo();
    console.log(`✅ Rate Limit Info: ${rateLimit.dailyLimit} (Has Key: ${rateLimit.hasKey})`);
    
    const datasets = await censusApiService.getAvailableDatasets();
    console.log(`✅ Available Datasets: ${Object.keys(datasets).join(', ')}`);
    
    const testQueries = await censusApiService.getTestQueries();
    console.log(`✅ Test Queries Available: ${Object.keys(testQueries).join(', ')}\n`);
    
    // Test 2: Execute test queries
    console.log('🎯 Test 2: Execute Test Queries');
    console.log('===============================');
    
    console.log('Testing ZIP5 ACS5 query...');
    const zip5Response = await censusApiService.executeTestQuery('zip5_acs5');
    console.log(`✅ ZIP5 Query: ${zip5Response.rowCount} records received`);
    console.log(`   Sample: ${zip5Response.data[1]?.[0] || 'No data'}`);
    
    console.log('Testing Block Group ACS5 query...');
    const blockGroupResponse = await censusApiService.executeTestQuery('blockgroup_acs5');
    console.log(`✅ Block Group Query: ${blockGroupResponse.rowCount} records received`);
    console.log(`   Sample: ${blockGroupResponse.data[1]?.[0] || 'No data'}\n`);
    
    // Test 3: Load data into DuckDB
    console.log('💾 Test 3: Load Data into DuckDB');
    console.log('=================================');
    
    const loadResult = await censusDataLoader.loadAllTestData();
    
    if (loadResult.summary.allSuccessful) {
      console.log('✅ All test data loaded successfully!');
      console.log(`   Total Records: ${loadResult.summary.totalRecords}`);
      console.log(`   Duration: ${loadResult.summary.totalDuration}ms`);
    } else {
      console.log('⚠️  Data loading completed with some errors');
      console.log(`   Total Records: ${loadResult.summary.totalRecords}`);
      console.log(`   Duration: ${loadResult.summary.totalDuration}ms`);
      console.log('   Errors:');
      [
        ...loadResult.variables.errors,
        ...loadResult.zip5.errors,
        ...loadResult.blockGroup.errors
      ].forEach(error => console.log(`     - ${error}`));
    }
    
    // Test 4: Query stored data
    console.log('\n📊 Test 4: Query Stored Data');
    console.log('============================');
    
    await censusDataLoader.showDataStats();
    
    // Test specific queries
    console.log('\nTesting specific data queries...');
    
    const populationData = await censusDataModel.queryCensusData({
      variables: ['B01003_001E'],
      geographyLevel: ['zip code tabulation area'],
      limit: 5
    });
    
    if (populationData.length > 0) {
      console.log('\n✅ ZIP Population Sample:');
      populationData.forEach(record => {
        console.log(`   ${record.geography_name}: ${record.variable_value?.toLocaleString()} people`);
      });
    }
    
    const housingData = await censusDataModel.queryCensusData({
      variables: ['B25001_001E'],
      geographyLevel: ['block group'],
      limit: 3
    });
    
    if (housingData.length > 0) {
      console.log('\n✅ Block Group Housing Sample:');
      housingData.forEach(record => {
        console.log(`   ${record.geography_name}: ${record.variable_value?.toLocaleString()} units`);
      });
    }
    
    console.log('\n🎉 All tests completed successfully!');
    console.log('\n📚 API Endpoints Available:');
    console.log('   GET  /api/v1/census/test-connection');
    console.log('   GET  /api/v1/census/test-queries');
    console.log('   POST /api/v1/census/execute-test/:testName');
    console.log('   GET  /api/v1/census/acs5/zip?state=06');
    console.log('   GET  /api/v1/census/acs5/block-group?state=06&county=075');
    console.log('   POST /api/v1/census/load-test-data');
    console.log('   GET  /api/v1/census/data/stats');
    console.log('   GET  /api/v1/census/data/query');
    console.log('   POST /api/v1/census/validate-variables');
    console.log('   GET  /api/v1/census/counties/:state');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    
    if (error instanceof Error) {
      console.error('Error details:', error.message);
      if (error.stack) {
        console.error('Stack trace:', error.stack);
      }
    }
    
    process.exit(1);
  } finally {
    // Clean up database connection
    censusDataModel.close();
  }
}

// Run the test if this script is executed directly
if (require.main === module) {
  testCensusIntegration()
    .then(() => {
      console.log('\n✨ Test completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Test failed:', error);
      process.exit(1);
    });
}

export { testCensusIntegration };