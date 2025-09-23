import { Worksheet } from 'exceljs';
import { ExcelFormatting, VariableDefinition } from '../models/export.models';

export class ExcelFormattingUtils {
  static getDefaultFormatting(): ExcelFormatting {
    return {
      headerStyle: {
        font: { bold: true, color: { argb: 'FFFFFF' } },
        fill: { 
          type: 'pattern', 
          pattern: 'solid', 
          fgColor: { argb: '366092' } 
        },
        border: {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' }
        }
      },
      dataStyle: {
        font: { size: 10 },
        alignment: { horizontal: 'left' as const, vertical: 'middle' as const }
      },
      numberFormat: '#,##0'
    };
  }

  static applyHeaderFormatting(worksheet: Worksheet, headerRow: number, columnCount: number): void {
    const formatting = this.getDefaultFormatting();
    
    for (let col = 1; col <= columnCount; col++) {
      const cell = worksheet.getCell(headerRow, col);
      cell.font = formatting.headerStyle.font;
      cell.fill = formatting.headerStyle.fill;
      cell.border = formatting.headerStyle.border;
    }
  }

  static applyDataFormatting(worksheet: Worksheet, startRow: number, endRow: number, columnCount: number): void {
    const formatting = this.getDefaultFormatting();
    
    for (let row = startRow; row <= endRow; row++) {
      for (let col = 1; col <= columnCount; col++) {
        const cell = worksheet.getCell(row, col);
        cell.font = formatting.dataStyle.font;
        cell.alignment = formatting.dataStyle.alignment;
        
        // Apply number formatting to numeric columns
        if (this.isNumericValue(cell.value)) {
          cell.numFmt = formatting.numberFormat;
        }
      }
    }
  }

  static autoSizeColumns(worksheet: Worksheet): void {
    worksheet.columns.forEach((column) => {
      let maxLength = 0;
      
      if (column && column.eachCell) {
        column.eachCell({ includeEmpty: false }, (cell) => {
          const cellValue = cell.value?.toString() || '';
          maxLength = Math.max(maxLength, cellValue.length);
        });
      }
      
      // Set column width with reasonable min/max bounds
      const width = Math.min(Math.max(maxLength + 2, 10), 50);
      if (column) {
        column.width = width;
      }
    });
  }

  static formatMetadataSheet(worksheet: Worksheet, metadata: any): void {
    // Title formatting
    const titleCell = worksheet.getCell('A1');
    titleCell.value = 'CensusChat Export Information';
    titleCell.font = { bold: true, size: 16, color: { argb: '366092' } };
    titleCell.alignment = { horizontal: 'left', vertical: 'middle' };
    
    // Metadata rows
    const metadataRows = [
      ['Query Text:', metadata.queryText || 'N/A'],
      ['Executed At:', metadata.executedAt || new Date().toISOString()],
      ['Data Source:', metadata.dataSource || 'US Census Bureau'],
      ['Total Records:', metadata.rowCount || 0],
      ['Geography Level:', metadata.geographyLevel || 'N/A'],
      ['Query Time (seconds):', metadata.queryTime || 'N/A'],
      ['Confidence Level:', metadata.confidenceLevel || 'N/A'],
      ['Margin of Error:', metadata.marginOfError || 'N/A']
    ];

    metadataRows.forEach((row, index) => {
      const rowNum = index + 3; // Start from row 3 (after title and blank row)
      worksheet.getCell(`A${rowNum}`).value = row[0];
      worksheet.getCell(`B${rowNum}`).value = row[1];
      
      // Format labels
      worksheet.getCell(`A${rowNum}`).font = { bold: true };
      worksheet.getCell(`A${rowNum}`).alignment = { horizontal: 'left' };
    });

    // Auto-size columns
    worksheet.getColumn('A').width = 20;
    worksheet.getColumn('B').width = 50;
  }

  static createDataDictionarySheet(worksheet: Worksheet, variables: VariableDefinition[]): void {
    // Headers
    const headers = ['Variable Code', 'Label', 'Concept', 'Description', 'Data Type', 'Universe'];
    headers.forEach((header, index) => {
      const cell = worksheet.getCell(1, index + 1);
      cell.value = header;
    });

    // Apply header formatting
    this.applyHeaderFormatting(worksheet, 1, headers.length);

    // Add variable data
    variables.forEach((variable, index) => {
      const row = index + 2;
      worksheet.getCell(row, 1).value = variable.code;
      worksheet.getCell(row, 2).value = variable.label;
      worksheet.getCell(row, 3).value = variable.concept;
      worksheet.getCell(row, 4).value = variable.description;
      worksheet.getCell(row, 5).value = variable.dataType;
      worksheet.getCell(row, 6).value = variable.universe;
    });

    // Apply data formatting
    if (variables.length > 0) {
      this.applyDataFormatting(worksheet, 2, variables.length + 1, headers.length);
    }

    // Auto-size columns
    this.autoSizeColumns(worksheet);
  }

  private static isNumericValue(value: any): boolean {
    if (value === null || value === undefined) return false;
    if (typeof value === 'number') return true;
    if (typeof value === 'string') {
      // Check if string represents a number
      const num = parseFloat(value.replace(/,/g, ''));
      return !isNaN(num) && isFinite(num);
    }
    return false;
  }

  static addConditionalFormatting(worksheet: Worksheet, dataRange: string): void {
    // Add zebra striping for better readability
    worksheet.addConditionalFormatting({
      ref: dataRange,
      rules: [
        {
          type: 'expression',
          priority: 1,
          formulae: ['MOD(ROW(),2)=0'],
          style: {
            fill: {
              type: 'pattern',
              pattern: 'solid',
              bgColor: { argb: 'F8F9FA' }
            }
          }
        }
      ]
    });
  }

  static generateFilename(queryType: string = 'Query', customFilename?: string): string {
    const timestamp = new Date().toISOString()
      .replace(/:/g, '')
      .replace(/\./g, '')
      .replace('T', '_')
      .slice(0, 15);
    
    if (customFilename) {
      return `${customFilename}_${timestamp}.xlsx`;
    }
    
    return `CensusChat_Export_${queryType}_${timestamp}.xlsx`;
  }
}
