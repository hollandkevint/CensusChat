import dotenv from 'dotenv';
import { DataLoadingOrchestrator } from '../data-loading/orchestration/DataLoadingOrchestrator';
import { LoadingConfiguration } from '../data-loading/utils/LoadingConfiguration';

// Load environment variables
dotenv.config();

async function initializeFoundationData() {
  console.log('🚀 Starting CensusChat Foundation Data Loading');
  console.log('===============================================');

  try {
    // Check if Census API key is configured
    const hasApiKey = !!process.env.CENSUS_API_KEY;
    console.log(`📊 API Key Status: ${hasApiKey ? 'Configured' : 'Not configured (using limits)'}`);

    // Initialize the loading configuration
    const config = new LoadingConfiguration();
    console.log(`🔧 Configuration loaded for ${config.apiRateLimit.dailyLimit} calls/day`);

    // Initialize the orchestrator
    const orchestrator = new DataLoadingOrchestrator(config);

    // Set up progress monitoring
    orchestrator.on('progress', (progress) => {
      const { completedJobs, totalJobs, currentPhase } = progress;
      const percentage = totalJobs > 0 ? ((completedJobs / totalJobs) * 100).toFixed(1) : '0';
      console.log(`📈 Progress: ${completedJobs}/${totalJobs} (${percentage}%) - Phase: ${currentPhase}`);
    });

    orchestrator.on('phaseComplete', (data) => {
      console.log(`✅ Phase completed: ${data.phase} (${data.jobsCompleted} jobs)`);
    });

    orchestrator.on('error', (error) => {
      console.error('❌ Loading error:', error.message);
    });

    // Start the foundation phase loading
    console.log('🏗️  Starting foundation phase...');
    await orchestrator.startPriorityLoading(['foundation']);

    console.log('🎉 Foundation data loading completed successfully!');
    console.log('');
    console.log('Next steps:');
    console.log('1. Start the backend server: npm run dev');
    console.log('2. Start the frontend server: cd ../frontend && npm run dev');
    console.log('3. Open http://localhost:3000 to test the interactive chat');
    console.log('4. Add your Anthropic API key to backend/.env for AI-powered queries');

  } catch (error) {
    console.error('💥 Foundation data loading failed:');
    console.error(error);
    
    if (error.message?.includes('ANTHROPIC_API_KEY')) {
      console.log('');
      console.log('🔑 To enable AI-powered query processing:');
      console.log('1. Get an API key from https://console.anthropic.com/');
      console.log('2. Add ANTHROPIC_API_KEY=your_key_here to backend/.env');
      console.log('3. Restart the backend server');
    }
    
    if (error.message?.includes('CENSUS_API_KEY')) {
      console.log('');
      console.log('📊 To enable full Census data loading:');
      console.log('1. Get an API key from https://api.census.gov/data/key_signup.html');
      console.log('2. Add CENSUS_API_KEY=your_key_here to backend/.env');
      console.log('3. Run this script again');
    }

    process.exit(1);
  }

  process.exit(0);
}

// Run the initialization
initializeFoundationData();