#!/usr/bin/env ts-node

/**
 * Test script to diagnose DataLoadingOrchestrator initialization issues
 * This helps us understand what's causing the startup crash when data loading routes are enabled.
 */

console.log('🔍 Testing DataLoadingOrchestrator initialization...');

async function testDataLoadingComponents() {
  try {
    console.log('1. Testing configuration manager...');
    const { configurationManager } = await import('../data-loading/utils/LoadingConfiguration');
    const config = configurationManager.getConfiguration();
    console.log('✅ Configuration manager loaded successfully');
    console.log('   - Max concurrent jobs:', config.maxConcurrentJobs);
    console.log('   - API rate limit:', config.apiRateLimit.perSecond);

    console.log('\n2. Testing priority definitions...');
    const { LOADING_PHASES } = await import('../data-loading/utils/PriorityDefinitions');
    console.log('✅ Priority definitions loaded successfully');
    console.log('   - Available phases:', LOADING_PHASES.length);

    console.log('\n3. Testing DataLoadingOrchestrator import...');
    const { DataLoadingOrchestrator } = await import('../data-loading/orchestration/DataLoadingOrchestrator');
    console.log('✅ DataLoadingOrchestrator class imported successfully');

    console.log('\n4. Testing DataLoadingOrchestrator instantiation...');
    const orchestrator = new DataLoadingOrchestrator();
    console.log('✅ DataLoadingOrchestrator instance created successfully');

    console.log('\n5. Testing basic operations...');
    const progress = orchestrator.getProgress();
    console.log('✅ Progress retrieved successfully');
    console.log('   - Status:', progress.status);
    console.log('   - Total jobs:', progress.totalJobs);

    const context = orchestrator.getContext();
    console.log('✅ Context retrieved successfully');
    console.log('   - Queue depth:', context.queueDepth);
    console.log('   - Active jobs:', context.activeJobs.length);

    console.log('\n🎉 All tests passed! DataLoadingOrchestrator is working correctly.');

  } catch (error) {
    console.error('❌ Test failed:', error);
    console.error('Stack trace:', error instanceof Error ? error.stack : 'Unknown error');
    process.exit(1);
  }
}

// Run the tests
testDataLoadingComponents();