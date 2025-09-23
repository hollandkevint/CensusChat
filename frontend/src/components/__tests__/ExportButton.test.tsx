import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ExportButton } from '../ExportButton';
import * as exportApi from '../../lib/api/exportApi';

// Mock the export API
jest.mock('../../lib/api/exportApi');
const mockExportApi = exportApi as jest.Mocked<typeof exportApi>;

// Mock the useExport hook
jest.mock('../../hooks/useExport', () => ({
  useExport: jest.fn(() => ({
    isExporting: false,
    progress: null,
    error: null,
    exportToExcel: jest.fn(),
    exportToCSV: jest.fn(),
    clearError: jest.fn(),
    cancelExport: jest.fn()
  }))
}));

describe('ExportButton', () => {
  const mockQueryResult = {
    success: true,
    data: [
      { id: 1, name: 'Test 1', value: 100 },
      { id: 2, name: 'Test 2', value: 200 },
      { id: 3, name: 'Test 3', value: 300 }
    ],
    metadata: {
      queryTime: 1.5,
      totalRecords: 3,
      dataSource: 'US Census Bureau',
      confidenceLevel: 0.95,
      marginOfError: 2.3,
      executedAt: new Date().toISOString()
    }
  };

  const defaultProps = {
    queryResult: mockQueryResult,
    queryText: 'Test query for demographics'
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders export button with correct text', () => {
    render(<ExportButton {...defaultProps} />);
    
    expect(screen.getByRole('button', { name: /export/i })).toBeInTheDocument();
  });

  it('does not render when no data is available', () => {
    const emptyQueryResult = {
      ...mockQueryResult,
      data: []
    };

    const { container } = render(
      <ExportButton {...defaultProps} queryResult={emptyQueryResult} />
    );
    
    expect(container.firstChild).toBeNull();
  });

  it('shows dropdown menu when clicked', async () => {
    render(<ExportButton {...defaultProps} />);
    
    const exportButton = screen.getByRole('button', { name: /export/i });
    fireEvent.click(exportButton);

    await waitFor(() => {
      expect(screen.getByText('Excel (.xlsx)')).toBeInTheDocument();
      expect(screen.getByText('CSV (.csv)')).toBeInTheDocument();
    });
  });

  it('displays correct row count in dropdown', async () => {
    render(<ExportButton {...defaultProps} />);
    
    const exportButton = screen.getByRole('button', { name: /export/i });
    fireEvent.click(exportButton);

    await waitFor(() => {
      expect(screen.getByText('Export 3 rows')).toBeInTheDocument();
    });
  });

  it('is disabled when disabled prop is true', () => {
    render(<ExportButton {...defaultProps} disabled={true} />);
    
    const exportButton = screen.getByRole('button', { name: /export/i });
    expect(exportButton).toBeDisabled();
  });

  it('shows exporting state when isExporting is true', () => {
    const mockUseExport = require('../../hooks/useExport').useExport;
    mockUseExport.mockReturnValue({
      isExporting: true,
      progress: null,
      error: null,
      exportToExcel: jest.fn(),
      exportToCSV: jest.fn(),
      clearError: jest.fn(),
      cancelExport: jest.fn()
    });

    render(<ExportButton {...defaultProps} />);
    
    expect(screen.getByText('Exporting...')).toBeInTheDocument();
  });

  it('calls exportToExcel when Excel option is selected', async () => {
    const mockExportToExcel = jest.fn();
    const mockUseExport = require('../../hooks/useExport').useExport;
    mockUseExport.mockReturnValue({
      isExporting: false,
      progress: null,
      error: null,
      exportToExcel: mockExportToExcel,
      exportToCSV: jest.fn(),
      clearError: jest.fn(),
      cancelExport: jest.fn()
    });

    render(<ExportButton {...defaultProps} />);
    
    const exportButton = screen.getByRole('button', { name: /export/i });
    fireEvent.click(exportButton);

    await waitFor(() => {
      const excelOption = screen.getByText('Excel (.xlsx)');
      fireEvent.click(excelOption);
    });

    expect(mockExportToExcel).toHaveBeenCalledWith(
      mockQueryResult,
      {},
      'Test query for demographics'
    );
  });

  it('calls exportToCSV when CSV option is selected', async () => {
    const mockExportToCSV = jest.fn();
    const mockUseExport = require('../../hooks/useExport').useExport;
    mockUseExport.mockReturnValue({
      isExporting: false,
      progress: null,
      error: null,
      exportToExcel: jest.fn(),
      exportToCSV: mockExportToCSV,
      clearError: jest.fn(),
      cancelExport: jest.fn()
    });

    render(<ExportButton {...defaultProps} />);
    
    const exportButton = screen.getByRole('button', { name: /export/i });
    fireEvent.click(exportButton);

    await waitFor(() => {
      const csvOption = screen.getByText('CSV (.csv)');
      fireEvent.click(csvOption);
    });

    expect(mockExportToCSV).toHaveBeenCalledWith(
      mockQueryResult,
      'Test query for demographics'
    );
  });

  it('calls onExportStart callback when export is initiated', async () => {
    const mockOnExportStart = jest.fn();
    const mockExportToExcel = jest.fn();
    const mockUseExport = require('../../hooks/useExport').useExport;
    mockUseExport.mockReturnValue({
      isExporting: false,
      progress: null,
      error: null,
      exportToExcel: mockExportToExcel,
      exportToCSV: jest.fn(),
      clearError: jest.fn(),
      cancelExport: jest.fn()
    });

    render(<ExportButton {...defaultProps} onExportStart={mockOnExportStart} />);
    
    const exportButton = screen.getByRole('button', { name: /export/i });
    fireEvent.click(exportButton);

    await waitFor(() => {
      const excelOption = screen.getByText('Excel (.xlsx)');
      fireEvent.click(excelOption);
    });

    expect(mockOnExportStart).toHaveBeenCalled();
  });

  it('displays error message when export fails', () => {
    const mockError = {
      message: 'Export failed due to network error',
      code: 'NETWORK_ERROR' as const,
      name: 'ExportError'
    };

    const mockUseExport = require('../../hooks/useExport').useExport;
    mockUseExport.mockReturnValue({
      isExporting: false,
      progress: null,
      error: mockError,
      exportToExcel: jest.fn(),
      exportToCSV: jest.fn(),
      clearError: jest.fn(),
      cancelExport: jest.fn()
    });

    render(<ExportButton {...defaultProps} />);
    
    expect(screen.getByText('Export Failed')).toBeInTheDocument();
    expect(screen.getByText('Export failed due to network error')).toBeInTheDocument();
  });

  it('provides fallback CSV option when Excel export fails', () => {
    const mockError = {
      message: 'Excel export failed',
      code: 'FORMAT_ERROR' as const,
      name: 'ExportError'
    };

    const mockUseExport = require('../../hooks/useExport').useExport;
    mockUseExport.mockReturnValue({
      isExporting: false,
      progress: null,
      error: mockError,
      exportToExcel: jest.fn(),
      exportToCSV: jest.fn(),
      clearError: jest.fn(),
      cancelExport: jest.fn()
    });

    render(<ExportButton {...defaultProps} />);
    
    expect(screen.getByText('Try CSV')).toBeInTheDocument();
  });

  it('does not show CSV fallback for data-related errors', () => {
    const mockError = {
      message: 'No data available',
      code: 'NO_DATA' as const,
      name: 'ExportError'
    };

    const mockUseExport = require('../../hooks/useExport').useExport;
    mockUseExport.mockReturnValue({
      isExporting: false,
      progress: null,
      error: mockError,
      exportToExcel: jest.fn(),
      exportToCSV: jest.fn(),
      clearError: jest.fn(),
      cancelExport: jest.fn()
    });

    render(<ExportButton {...defaultProps} />);
    
    expect(screen.queryByText('Try CSV')).not.toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(
      <ExportButton {...defaultProps} className="custom-class" />
    );
    
    expect(container.firstChild).toHaveClass('custom-class');
  });

  it('renders with different sizes', () => {
    const { rerender } = render(<ExportButton {...defaultProps} size="small" />);
    let button = screen.getByRole('button', { name: /export/i });
    expect(button).toHaveClass('px-2', 'py-1', 'text-xs');

    rerender(<ExportButton {...defaultProps} size="large" />);
    button = screen.getByRole('button', { name: /export/i });
    expect(button).toHaveClass('px-4', 'py-3', 'text-base');
  });

  it('closes dropdown when clicking outside', async () => {
    render(<ExportButton {...defaultProps} />);
    
    const exportButton = screen.getByRole('button', { name: /export/i });
    fireEvent.click(exportButton);

    await waitFor(() => {
      expect(screen.getByText('Excel (.xlsx)')).toBeInTheDocument();
    });

    // Click outside the dropdown
    fireEvent.click(document.body);

    await waitFor(() => {
      expect(screen.queryByText('Excel (.xlsx)')).not.toBeInTheDocument();
    });
  });
});


