/**
 * Document Generation MCP Tools
 * Wraps existing ExcelExportService for Excel and implements PDF with pdfkit
 * Agent SDK uses these tools for "generate Excel report" / "create PDF" requests
 *
 * IMPORTANT: ExcelExportService has only exportToExcel() - NO exportToPDF() method.
 * PDF generation is implemented directly using pdfkit in this file.
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import PDFDocument from "pdfkit";
import { ExcelExportService } from "../services/excelExportService";
import { QueryResultForExport } from "../models/export.models";

// Schema for document generation input
const DocumentDataSchema = z.object({
  data: z.array(z.record(z.string(), z.unknown())),
  filename: z.string().optional(),
  title: z.string().optional(),
  includeMetadata: z.boolean().optional(),
  columns: z.array(z.string()).optional(),
});

type DocumentData = z.infer<typeof DocumentDataSchema>;

// Result type for document generation (internal use)
interface DocumentResult {
  filename: string;
  mimeType: string;
  size: number;
  buffer: Buffer;
}

/**
 * Register document generation tools on MCP server
 */
export function registerDocumentTools(server: McpServer): void {
  // Excel generation tool
  server.tool(
    "generate_excel_report",
    "Generate an Excel spreadsheet from query results. Returns base64-encoded file content.",
    {
      data: z
        .array(z.record(z.string(), z.unknown()))
        .describe("Array of data records to include in the spreadsheet"),
      filename: z.string().optional().describe("Optional filename (without extension)"),
      title: z.string().optional().describe("Optional title for the report"),
      includeMetadata: z
        .boolean()
        .optional()
        .describe("Whether to include metadata row (default: true)"),
      columns: z
        .array(z.string())
        .optional()
        .describe("Optional list of columns to include (default: all)"),
    },
    async (args) => {
      try {
        const input = DocumentDataSchema.parse(args);
        const result = await generateExcel(input);

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                success: true,
                filename: result.filename,
                mimeType: result.mimeType,
                size: result.size,
                // Base64 encode the buffer for transport
                content: result.buffer.toString("base64"),
              }),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                success: false,
                error:
                  error instanceof Error ? error.message : "Excel generation failed",
              }),
            },
          ],
          isError: true,
        };
      }
    }
  );

  // CSV generation tool (simpler alternative)
  server.tool(
    "generate_csv_report",
    "Generate a CSV file from query results. Returns the CSV content as text.",
    {
      data: z
        .array(z.record(z.string(), z.unknown()))
        .describe("Array of data records to include"),
      filename: z.string().optional().describe("Optional filename (without extension)"),
      columns: z
        .array(z.string())
        .optional()
        .describe("Optional list of columns to include (default: all)"),
    },
    async (args) => {
      try {
        const input = DocumentDataSchema.parse(args);
        const csv = generateCsv(input);

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                success: true,
                filename: (input.filename || "export") + ".csv",
                mimeType: "text/csv",
                content: csv,
              }),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                success: false,
                error:
                  error instanceof Error ? error.message : "CSV generation failed",
              }),
            },
          ],
          isError: true,
        };
      }
    }
  );

  // PDF generation tool
  server.tool(
    "generate_pdf_report",
    "Generate a PDF report from query results. Returns base64-encoded file content.",
    {
      data: z
        .array(z.record(z.string(), z.unknown()))
        .describe("Array of data records to include"),
      title: z.string().optional().describe("Report title"),
      filename: z.string().optional().describe("Optional filename (without extension)"),
      columns: z
        .array(z.string())
        .optional()
        .describe("Optional list of columns to include (default: all)"),
    },
    async (args) => {
      try {
        const input = DocumentDataSchema.parse(args);
        const result = await generatePdf(input);

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                success: true,
                filename: result.filename,
                mimeType: result.mimeType,
                size: result.size,
                content: result.buffer.toString("base64"),
              }),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                success: false,
                error:
                  error instanceof Error ? error.message : "PDF generation failed",
              }),
            },
          ],
          isError: true,
        };
      }
    }
  );

  console.log(
    "[MCP] Registered document generation tools: generate_excel_report, generate_csv_report, generate_pdf_report"
  );
}

/**
 * Generate Excel using existing ExcelExportService
 * Note: This service only has exportToExcel(), not exportToPDF()
 */
async function generateExcel(input: DocumentData): Promise<DocumentResult> {
  const exportService = new ExcelExportService();

  // Prepare data in format expected by ExcelExportService
  const queryResult: QueryResultForExport = {
    success: true,
    message: "Export data",
    data: filterColumns(input.data, input.columns),
    metadata: {
      queryTime: 0,
      totalRecords: input.data.length,
      dataSource: "MCP Export",
      confidenceLevel: 1.0,
      marginOfError: 0,
      queryText: input.title || "Export",
      executedAt: new Date().toISOString(),
    },
  };

  const response = await exportService.exportToExcel(queryResult, {
    queryId: `export-${Date.now()}`,
    format: "excel",
    options: {
      includeMetadata: input.includeMetadata ?? true,
      compression: false,
      maxRows: 100000,
      customFilename: input.filename,
    },
  });

  // ExportResponse returns downloadUrl, not buffer directly
  // The service writes to temp dir, we need to read the file
  const exportFile = await exportService.getExportFile(response.exportId);
  if (!exportFile) {
    throw new Error("Failed to retrieve generated Excel file");
  }

  const fs = await import("fs");
  const buffer = fs.readFileSync(exportFile.filePath);

  return {
    filename: (input.filename || "census_export") + ".xlsx",
    mimeType:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    size: buffer.length,
    buffer,
  };
}

/**
 * Generate CSV from data
 */
function generateCsv(input: DocumentData): string {
  const data = filterColumns(input.data, input.columns);
  if (data.length === 0) return "";

  const columns = input.columns || Object.keys(data[0]);

  // Header row
  const lines = [columns.map(escapeCSV).join(",")];

  // Data rows
  for (const row of data) {
    const values = columns.map((col) => escapeCSV(String(row[col] ?? "")));
    lines.push(values.join(","));
  }

  return lines.join("\n");
}

/**
 * Generate PDF report using pdfkit directly
 * IMPORTANT: ExcelExportService does NOT have exportToPDF() - we implement it here
 */
async function generatePdf(input: DocumentData): Promise<DocumentResult> {
  return new Promise((resolve, reject) => {
    try {
      const data = filterColumns(input.data, input.columns);
      const columns =
        input.columns || (data.length > 0 ? Object.keys(data[0]) : []);

      // Create PDF document
      const doc = new PDFDocument({
        size: "A4",
        margin: 50,
        bufferPages: true,
      });

      // Collect buffer chunks
      const chunks: Buffer[] = [];
      doc.on("data", (chunk: Buffer) => chunks.push(chunk));
      doc.on("end", () => {
        const buffer = Buffer.concat(chunks);
        resolve({
          filename: (input.filename || "census_report") + ".pdf",
          mimeType: "application/pdf",
          size: buffer.length,
          buffer,
        });
      });
      doc.on("error", reject);

      // Title
      doc
        .fontSize(20)
        .font("Helvetica-Bold")
        .text(input.title || "Census Data Report", { align: "center" });

      doc.moveDown();

      // Metadata
      doc
        .fontSize(10)
        .font("Helvetica")
        .text(`Generated: ${new Date().toLocaleString()}`, { align: "right" })
        .text(`Total Records: ${data.length}`, { align: "right" });

      doc.moveDown(2);

      // Table header
      if (columns.length > 0) {
        const colWidth =
          (doc.page.width - 100) / Math.min(columns.length, 5);
        let y = doc.y;

        // Draw header row
        doc.font("Helvetica-Bold").fontSize(9);
        columns.slice(0, 5).forEach((col, i) => {
          doc.text(truncateText(String(col), 15), 50 + i * colWidth, y, {
            width: colWidth - 5,
            align: "left",
          });
        });

        doc.moveDown();
        y = doc.y;

        // Draw header line
        doc
          .moveTo(50, y)
          .lineTo(doc.page.width - 50, y)
          .stroke();

        doc.moveDown(0.5);

        // Draw data rows
        doc.font("Helvetica").fontSize(8);

        const maxRows = 50; // Limit rows per page for readability
        const displayData = data.slice(0, maxRows);

        for (const row of displayData) {
          y = doc.y;

          // Check for page break
          if (y > doc.page.height - 100) {
            doc.addPage();
            y = 50;
          }

          columns.slice(0, 5).forEach((col, i) => {
            const value = row[col];
            const displayValue =
              value === null || value === undefined
                ? ""
                : typeof value === "number"
                  ? value.toLocaleString()
                  : String(value);

            doc.text(truncateText(displayValue, 20), 50 + i * colWidth, y, {
              width: colWidth - 5,
              align: "left",
            });
          });

          doc.moveDown(0.8);
        }

        // Note if truncated
        if (data.length > maxRows) {
          doc.moveDown();
          doc
            .font("Helvetica-Oblique")
            .fontSize(9)
            .text(
              `... and ${data.length - maxRows} more records (truncated for display)`
            );
        }
      } else {
        doc.text("No data available");
      }

      // Footer with page numbers
      const pageCount = doc.bufferedPageRange().count;
      for (let i = 0; i < pageCount; i++) {
        doc.switchToPage(i);
        doc
          .fontSize(8)
          .text(`Page ${i + 1} of ${pageCount}`, 50, doc.page.height - 50, {
            align: "center",
          });
      }

      // Finalize
      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Filter data to only include specified columns
 */
function filterColumns(
  data: Record<string, unknown>[],
  columns?: string[]
): Record<string, unknown>[] {
  if (!columns || columns.length === 0) return data;

  return data.map((row) => {
    const filtered: Record<string, unknown> = {};
    for (const col of columns) {
      if (col in row) {
        filtered[col] = row[col];
      }
    }
    return filtered;
  });
}

/**
 * Escape value for CSV
 */
function escapeCSV(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * Truncate text for PDF display
 */
function truncateText(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.substring(0, maxLen - 1) + "...";
}
