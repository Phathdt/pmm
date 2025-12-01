import type { Config } from 'jest'

const config: Config = {
  displayName: 'token',
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
  coverageDirectory: '../../coverage/libs/token',
  moduleNameMapper: {
    '^@optimex-pmm/shared$': '<rootDir>/../shared/src/index.ts',
    '^@optimex-pmm/req$': '<rootDir>/../req/src/index.ts',
    '^@optimex-pmm/custom-config$': '<rootDir>/../custom-config/src/index.ts',
  },
}

export default config
