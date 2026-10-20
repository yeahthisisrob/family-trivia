import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import checker from 'vite-plugin-checker';

// A game's server folder serves its own routes at /<folder>/... (docs/decisions/0032).
const serverGames = path.resolve(__dirname, '../backend/features/games');
const gameFolders = readdirSync(serverGames, { withFileTypes: true })
  .filter((e) => e.isDirectory() && existsSync(path.join(serverGames, e.name, 'index.ts')))
  .map((e) => e.name);

export default defineConfig({
  plugins: [
    react(),
    checker({
      typescript: true,
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@family-trivia/shared': path.resolve(__dirname, '../shared/src'),
    },
  },
  server: {
    port: 3000,
    host: true,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      // Forward all Lambda API routes to SAM local (for preview/Claude usage)
      [`^/(${gameFolders.join('|')}|validate-passphrase|members|submit-answer|submit-daily-fact|submit-custom-category|submit-historical-fact|daily-fact|daily-fact-summary|daily-fact-categories|daily-fact-options|generate-question|generate-question-options|recent-shared-questions|user-profile|user-fact-history|user-config|leaderboard|consolidated-leaderboard|catchup-status|question-status|question-gen|can-answer-question|end-of-season-status|app-init|create-custom-category|categories|group-description|update-group-description|suggest-group-description|family-hierarchy|member-summary|timeline-data|fact-comments|trivia-comments|family-feud|trivia-bank|upcoming-birthdays|celebrations|admin|profile)`]:
        {
          target: 'http://localhost:3001',
          changeOrigin: true,
        },
    },
  },
  build: {
    rollupOptions: {
      output: {
        // Vite 8 (Rolldown) takes a function. Vendor code splits into react,
        // mui and the rest; app code stays in one chunk so the chunk graph is
        // one-directional (an init cycle between chunks renders a blank page).
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (/[\\/]node_modules[\\/](\.pnpm[\\/])?(@mui|@emotion)/.test(id)) return 'mui';
          if (
            /[\\/]node_modules[\\/](\.pnpm[\\/])?(react|react-dom|scheduler|react-router)[@\\/]/.test(
              id,
            )
          )
            return 'react';
          return 'vendor';
        },
      },
    },
    chunkSizeWarningLimit: 1500,
  },
});
