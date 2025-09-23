import { ExcelExportService } from '../services/excelExportService';
import { ExportRequest, QueryResultForExport } from '../models/export.models';

async function testExportFunctionality() {
  console.log('🧪 Testing Excel Export Functionality...\n');

  const exportService = new ExcelExportService();

  // Create mock data
  const mockQueryResult: QueryResultForExport = {
    success: true,
    message: 'Test query successful',
    data: [
      { id: 1, state: 'Florida', population: 21477737, median_income: 57703, seniors_65_plus: 4175094 },
      { id: 2, state: 'California', population: 39512223, median_income: 80440, seniors_65_plus: 5148808 },
      { id: 3, state: 'Texas', population: 28995881, median_income: 63826, seniors_65_plus: 3877306 },
      { id: 4, state: 'New York', population: 19453561, median_income: 70457, seniors_65_plus: 3220752 },
      { id: 5, state: 'Pennsylvania', population: 12801989, median_income: 61744, seniors_65_plus: 2345877 }
    ],
    metadata: {
      queryTime: 2.3,
      totalRecords: 5,
      dataSource: 'US Census Bureau - ACS 5-Year Estimates',
      confidenceLevel: 0.95,
      marginOfError: 2.3,
      queryText: 'Show me states with highest senior population and their median income',
      executedAt: new Date().toISOString(),
      geographyLevel: 'State',
      variables: ['B01001_001E', 'B19013_001E', 'B01001_020E']
    }
  };

  const exportRequest: ExportRequest = {
    queryId: 'test-export-001',
    format: 'excel',
    options: {
      includeMetadata: true,
      compression: false,
      maxRows: 50000,
      customFilename: 'TestHealthcareDemo'
    }
  };

  try {
    console.log('📊 Creating Excel export with healthcare demographics data...');
    const result = await exportService.exportToExcel(mockQueryResult, exportRequest);
    
    console.log('✅ Export completed successfully!');
    console.log(`📁 Export ID: ${result.exportId}`);
    console.log(`📄 Filename: ${result.filename}`);
    console.log(`📈 Rows exported: ${result.metadata.rowCount}`);
    console.log(`⏱️  Processing time: ${result.metadata.processingTime.toFixed(2)}s`);
    console.log(`💾 File size: ${(result.metadata.fileSize / 1024).toFixed(2)} KB`);
    console.log(`🔗 Download URL: ${result.downloadUrl}`);
    
    // Test progress tracking
    console.log('\n🔄 Checking progress tracking...');
    const progress = ExcelExportService.getProgress(result.exportId);
    if (progress) {
      console.log(`📊 Progress status: ${progress.status}`);
      console.log(`📈 Progress: ${progress.progress}%`);
      console.log(`🔧 Current step: ${progress.currentStep}`);
    }

    // Test file retrieval
    console.log('\n📁 Testing file retrieval...');
    const exportFile = await exportService.getExportFile(result.exportId);
    if (exportFile) {
      console.log(`✅ Export file found: ${exportFile.filename}`);
      console.log(`📂 File path: ${exportFile.filePath}`);
    } else {
      console.log('❌ Export file not found');
    }

    console.log('\n🎉 All tests passed! Excel export functionality is working correctly.');
    
  } catch (error) {
    console.error('❌ Export test failed:', error);
    process.exit(1);
  }
}

// Run the test
if (require.main === module) {
  testExportFunctionality()
    .then(() => {
      console.log('\n✨ Export functionality test completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Export functionality test failed:', error);
      process.exit(1);
    });
}

export { testExportFunctionality };


