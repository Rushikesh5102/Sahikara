import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: false,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/index.ts'],
    },
    testTimeout: 10_000,
    hookTimeout: 10_000,

    // Run tests in child_process forks rather than worker threads.
    // This makes Vitest use native Node.js CJS/ESM resolution for all imports,
    // which correctly handles 'node:sqlite' and other Node.js built-in modules
    // that Vite's bundler cannot resolve (it strips the 'node:' prefix and looks
    // for an npm package named 'sqlite').
    pool: 'forks',
    poolOptions: {
      forks: {
        execArgv: ['--experimental-vm-modules'],
      },
    },
  },
  resolve: {
    conditions: ['node'],
  },
});
