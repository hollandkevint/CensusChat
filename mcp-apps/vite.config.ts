import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

/**
 * Vite configuration for MCP Apps
 * Produces single-file HTML bundles with all CSS/JS inlined
 * Output goes to backend/src/mcp/mcpApps/ for serving via MCP resources
 */
export default defineConfig({
  plugins: [react(), viteSingleFile()],
  build: {
    target: 'esnext',
    // Inline all assets - no external chunks
    assetsInlineLimit: 100000000,
    // Don't split CSS into separate files
    cssCodeSplit: false,
    // Output to backend MCP apps directory
    outDir: '../backend/src/mcp/mcpApps',
    // Clean output directory before build
    emptyOutDir: true,
    rollupOptions: {
      // Future: Configure multiple entry points for different apps
      // input: {
      //   'data-table': 'src/apps/data-table/index.html',
      //   'bar-chart': 'src/apps/bar-chart/index.html',
      // }
    },
  },
});
