import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { resolve } from 'path';
import { renameSync, existsSync, rmSync } from 'fs';

/**
 * App entry points for multi-app build
 * Build each separately due to vite-plugin-singlefile inlineDynamicImports limitation
 */
const APP_ENTRIES = ['data-table', 'bar-chart', 'line-chart'] as const;
type AppName = (typeof APP_ENTRIES)[number];

/**
 * Get the app to build from MCP_APP env var or default to data-table
 */
function getAppToBuild(): AppName {
  const app = process.env.MCP_APP as AppName | undefined;
  if (app && APP_ENTRIES.includes(app)) {
    return app;
  }
  // Default to data-table for backward compatibility
  return 'data-table';
}

/**
 * Custom plugin to flatten output structure
 * Moves nested index.html to {app-name}.html in root
 */
function flattenOutput(appName: AppName) {
  return {
    name: 'flatten-output',
    closeBundle() {
      const outDir = resolve(__dirname, '../backend/src/mcp/mcpApps');
      const srcPath = resolve(outDir, `src/${appName}/index.html`);
      const destPath = resolve(outDir, `${appName}.html`);

      if (existsSync(srcPath)) {
        renameSync(srcPath, destPath);
        // Clean up empty directories
        const srcDir = resolve(outDir, 'src');
        if (existsSync(srcDir)) {
          rmSync(srcDir, { recursive: true, force: true });
        }
      }
    },
  };
}

const appToBuild = getAppToBuild();

/**
 * Vite configuration for MCP Apps
 * Produces single-file HTML bundles with all CSS/JS inlined
 * Output goes to backend/src/mcp/mcpApps/ for serving via MCP resources
 *
 * Build specific app: MCP_APP=bar-chart npm run build
 * Build all apps: npm run build:all
 */
export default defineConfig({
  plugins: [react(), viteSingleFile(), flattenOutput(appToBuild)],
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
        [appToBuild]: resolve(__dirname, `src/${appToBuild}/index.html`),
      },
    },
  },
});
