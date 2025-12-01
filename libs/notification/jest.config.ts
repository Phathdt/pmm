import type { Config } from 'jest'

const config: Config = {
  displayName: 'notification',
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
  coverageDirectory: '../../coverage/libs/notification',
  moduleNameMapper: {
    '^@optimex-pmm/custom-config$': '<rootDir>/../custom-config/src/index.ts',
    '^@optimex-pmm/custom-logger$': '<rootDir>/../custom-logger/src/index.ts',
    '^@optimex-pmm/req$': '<rootDir>/../req/src/index.ts',
    '^@optimex-pmm/shared$': '<rootDir>/../shared/src/index.ts',
  },
}

export default config
