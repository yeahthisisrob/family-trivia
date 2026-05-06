import path from 'path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import checker from 'vite-plugin-checker';

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
      '^/(validate-passphrase|members|submit-answer|submit-daily-fact|submit-custom-category|submit-historical-fact|daily-fact|daily-fact-summary|daily-fact-categories|daily-fact-options|generate-question|generate-question-options|recent-shared-questions|user-profile|user-fact-history|user-config|leaderboard|consolidated-leaderboard|catchup-status|question-status|question-gen|can-answer-question|end-of-season-status|app-init|create-custom-category|categories|group-description|update-group-description|suggest-group-description|family-hierarchy|member-summary|timeline-data|fact-comments|trivia-comments|casino-rush|slot-machine|family-feud|trivia-bank|upcoming-birthdays|celebrations|admin|profile)': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          mui: ['@mui/material', '@mui/icons-material'],
          router: ['react-router-dom'],
        },
      },
    },
    chunkSizeWarningLimit: 1000,
  },
});
