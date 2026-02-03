import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { resolve } from 'path';
import { renameSync, existsSync, rmSync } from 'fs';

/**
 * App entry points for multi-app build
 */
const APP_ENTRIES = ['data-table', 'bar-chart', 'line-chart'] as const;

/**
 * Custom plugin to flatten output structure
 * Moves nested index.html files to {app-name}.html in root
 */
function flattenOutput() {
  return {
    name: 'flatten-output',
    closeBundle() {
      const outDir = resolve(__dirname, '../backend/src/mcp/mcpApps');

      for (const appName of APP_ENTRIES) {
        const srcPath = resolve(outDir, `src/${appName}/index.html`);
        const destPath = resolve(outDir, `${appName}.html`);

        if (existsSync(srcPath)) {
          renameSync(srcPath, destPath);
        }
      }

      // Clean up empty src directory
      const srcDir = resolve(outDir, 'src');
      if (existsSync(srcDir)) {
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
      input: Object.fromEntries(
        APP_ENTRIES.map(name => [name, resolve(__dirname, `src/${name}/index.html`)])
      ),
    },
  },
});
