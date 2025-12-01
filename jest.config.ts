import type { Config } from 'jest'

const config: Config = {
  projects: ['<rootDir>/apps/api-server', '<rootDir>/libs/token', '<rootDir>/libs/trade'],
  collectCoverageFrom: ['**/*.ts', '!**/*.spec.ts', '!**/node_modules/**', '!**/dist/**'],
  coverageDirectory: '<rootDir>/coverage',
  coverageReporters: ['text', 'lcov', 'html'],
}

export default config
