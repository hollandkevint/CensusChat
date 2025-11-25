'use client';

import React, { useRef, useCallback } from 'react';
import { Download, Image, FileText } from 'lucide-react';

interface ExportControlsProps {
  chartRef: React.RefObject<HTMLDivElement>;
  filename?: string;
}

export default function ExportControls({ chartRef, filename = 'census-chart' }: ExportControlsProps) {
  const exportToPNG = useCallback(async () => {
    if (!chartRef.current) return;

    try {
      // Dynamic import for html2canvas to keep bundle size small
      const html2canvas = (await import('html2canvas')).default;

      const canvas = await html2canvas(chartRef.current, {
        backgroundColor: '#ffffff',
        scale: 2, // Higher quality
      });

      const link = document.createElement('a');
      link.download = `${filename}-${Date.now()}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (error) {
      console.error('Failed to export chart as PNG:', error);
      // Fallback: Try SVG export
      exportToSVG();
    }
  }, [chartRef, filename]);

  const exportToSVG = useCallback(() => {
    if (!chartRef.current) return;

    const svgElement = chartRef.current.querySelector('svg');
    if (!svgElement) {
      console.error('No SVG element found in chart');
      return;
    }

    // Clone the SVG
    const clonedSvg = svgElement.cloneNode(true) as SVGElement;

    // Add white background
    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('width', '100%');
    rect.setAttribute('height', '100%');
    rect.setAttribute('fill', 'white');
    clonedSvg.insertBefore(rect, clonedSvg.firstChild);

    // Serialize and download
    const svgData = new XMLSerializer().serializeToString(clonedSvg);
    const blob = new Blob([svgData], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.download = `${filename}-${Date.now()}.svg`;
    link.href = url;
    link.click();

    URL.revokeObjectURL(url);
  }, [chartRef, filename]);

  return (
    <div className="flex items-center gap-2 mt-4">
      <button
        onClick={exportToPNG}
        className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
        title="Export as PNG"
      >
        <Image className="w-4 h-4" />
        <span>PNG</span>
      </button>
      <button
        onClick={exportToSVG}
        className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
        title="Export as SVG"
      >
        <FileText className="w-4 h-4" />
        <span>SVG</span>
      </button>
    </div>
  );
}
