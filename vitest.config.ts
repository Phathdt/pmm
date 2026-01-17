import { resolve } from 'path'

import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['libs/**/*.spec.ts', 'libs/**/*.test.ts', 'apps/**/*.spec.ts', 'apps/**/*.test.ts'],
    exclude: ['node_modules', 'dist', 'build'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html'],
      reportsDirectory: './coverage',
      include: ['libs/**/src/**/*.ts', 'apps/**/src/**/*.ts'],
      exclude: ['**/*.spec.ts', '**/*.test.ts', '**/index.ts', '**/node_modules/**'],
    },
    passWithNoTests: true,
    testTimeout: 30000,
    hookTimeout: 30000,
    setupFiles: ['reflect-metadata'],
  },
  resolve: {
    alias: {
      '@optimex-pmm/bitcoin': resolve(__dirname, 'libs/bitcoin/src/index.ts'),
      '@optimex-pmm/blockchain': resolve(__dirname, 'libs/blockchain/src/index.ts'),
      '@optimex-pmm/contracts': resolve(__dirname, 'libs/contracts/src/index.ts'),
      '@optimex-pmm/custom-config': resolve(__dirname, 'libs/custom-config/src/index.ts'),
      '@optimex-pmm/custom-logger': resolve(__dirname, 'libs/custom-logger/src/index.ts'),
      '@optimex-pmm/database': resolve(__dirname, 'libs/database/src/index.ts'),
      '@optimex-pmm/near': resolve(__dirname, 'libs/near/src/index.ts'),
      '@optimex-pmm/notification': resolve(__dirname, 'libs/notification/src/index.ts'),
      '@optimex-pmm/queue': resolve(__dirname, 'libs/queue/src/index.ts'),
      '@optimex-pmm/quote': resolve(__dirname, 'libs/quote/src/index.ts'),
      '@optimex-pmm/rebalance': resolve(__dirname, 'libs/rebalance/src/index.ts'),
      '@optimex-pmm/req': resolve(__dirname, 'libs/req/src/index.ts'),
      '@optimex-pmm/settlement': resolve(__dirname, 'libs/settlement/src/index.ts'),
      '@optimex-pmm/shared': resolve(__dirname, 'libs/shared/src/index.ts'),
      '@optimex-pmm/token': resolve(__dirname, 'libs/token/src/index.ts'),
      '@optimex-pmm/trade': resolve(__dirname, 'libs/trade/src/index.ts'),
    },
  },
})
