import path, { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { StorybookConfig } from '@storybook/react-vite';

// ESM doesn't expose __dirname; derive from import.meta.url
const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * This function is used to resolve the absolute path of a package.
 * It is needed in projects that use Yarn PnP or are set up within a monorepo.
 */
function getAbsolutePath(value: string) {
  return dirname(fileURLToPath(import.meta.resolve(`${value}/package.json`)));
}

const config: StorybookConfig = {
  stories: ['../src/**/*.mdx', '../src/**/*.stories.@(js|jsx|mjs|ts|tsx)'],
  addons: [
    getAbsolutePath('@storybook/addon-vitest'),
    getAbsolutePath('@storybook/addon-a11y'),
    getAbsolutePath('@storybook/addon-docs'),
  ],
  framework: getAbsolutePath('@storybook/react-vite'),
  async viteFinal(config) {
    return {
      ...config,
      // Pre-bundle dependencies that are only reached from a few stories, so
      // Vite doesn't re-optimize (and reload the test iframe) mid-run.
      optimizeDeps: {
        ...config.optimizeDeps,
        include: [...(config.optimizeDeps?.include ?? []), 'react-markdown', 'remark-gfm'],
      },
      resolve: {
        ...config.resolve,
        alias: {
          ...((config.resolve?.alias as Record<string, string>) ?? {}),
          '@': path.resolve(__dirname, '../src'),
          '@family-trivia/shared': path.resolve(__dirname, '../../shared/src'),
        },
      },
    };
  },
};

export default config;
