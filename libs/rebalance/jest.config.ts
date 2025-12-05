import type { Config } from 'jest'

const config: Config = {
  displayName: 'rebalance',
  testEnvironment: 'node',
  rootDir: '.',
  roots: ['<rootDir>/src'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      {
        tsconfig: '<rootDir>/tsconfig.json',
      },
    ],
  },
  testMatch: ['**/*.spec.ts', '**/*.test.ts'],
  collectCoverageFrom: ['src/**/*.ts', '!src/**/*.spec.ts', '!src/index.ts'],
  coverageDirectory: '../../coverage/libs/rebalance',
  moduleNameMapper: {
    '^@optimex-pmm/database$': '<rootDir>/../database/src/index.ts',
    '^@optimex-pmm/custom-config$': '<rootDir>/../custom-config/src/index.ts',
    '^@optimex-pmm/custom-logger$': '<rootDir>/../custom-logger/src/index.ts',
    '^@optimex-pmm/req$': '<rootDir>/../req/src/index.ts',
    '^@optimex-pmm/token$': '<rootDir>/../token/src/index.ts',
    '^@optimex-pmm/notification$': '<rootDir>/../notification/src/index.ts',
  },
}

export default config
