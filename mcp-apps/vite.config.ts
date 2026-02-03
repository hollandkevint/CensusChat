import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { resolve } from 'path';
import { renameSync, existsSync, rmSync } from 'fs';

/**
 * Custom plugin to flatten output structure
 * Moves nested index.html to data-table.html in root
 */
function flattenOutput() {
  return {
    name: 'flatten-output',
    closeBundle() {
      const srcPath = resolve(__dirname, '../backend/src/mcp/mcpApps/src/data-table/index.html');
      const destPath = resolve(__dirname, '../backend/src/mcp/mcpApps/data-table.html');
      const srcDir = resolve(__dirname, '../backend/src/mcp/mcpApps/src');

      if (existsSync(srcPath)) {
        renameSync(srcPath, destPath);
        // Clean up empty directories
        rmSync(srcDir, { recursive: true, force: true });
      }
    },
  };
}

/**
 * Vite configuration for MCP Apps
 * Produces single-file HTML bundles with all CSS/JS inlined
 * Output goes to backend/src/mcp/mcpApps/ for serving via MCP resources
 */
export default defineConfig({
  plugins: [react(), viteSingleFile(), flattenOutput()],
  build: {
    target: 'esnext',
    // Inline all assets - no external chunks
    assetsInlineLimit: 100000000,
    // Don't split CSS into separate files
    cssCodeSplit: false,
    // Output to backend MCP apps directory
    outDir: '../backend/src/mcp/mcpApps',
    // Don't clean output on build - preserve other apps
    emptyOutDir: false,
    rollupOptions: {
      input: {
        'data-table': resolve(__dirname, 'src/data-table/index.html'),
      },
    },
  },
});
