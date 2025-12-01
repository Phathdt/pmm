import type { Config } from 'jest'

const config: Config = {
  displayName: 'api-server',
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
  collectCoverageFrom: ['src/**/*.ts', '!src/**/*.spec.ts', '!src/main.ts'],
  coverageDirectory: '../../coverage/apps/api-server',
  moduleNameMapper: {
    '^@optimex-pmm/shared$': '<rootDir>/../../libs/shared/src/index.ts',
    '^@optimex-pmm/database$': '<rootDir>/../../libs/database/src/index.ts',
    '^@optimex-pmm/custom-logger$': '<rootDir>/../../libs/custom-logger/src/index.ts',
    '^@optimex-pmm/req$': '<rootDir>/../../libs/req/src/index.ts',
    '^@optimex-pmm/queue$': '<rootDir>/../../libs/queue/src/index.ts',
    '^@optimex-pmm/blockchain$': '<rootDir>/../../libs/blockchain/src/index.ts',
    '^@optimex-pmm/notification$': '<rootDir>/../../libs/notification/src/index.ts',
    '^@optimex-pmm/token$': '<rootDir>/../../libs/token/src/index.ts',
    '^@optimex-pmm/trade$': '<rootDir>/../../libs/trade/src/index.ts',
    '^@optimex-pmm/quote$': '<rootDir>/../../libs/quote/src/index.ts',
    '^@optimex-pmm/settlement$': '<rootDir>/../../libs/settlement/src/index.ts',
  },
}

export default config
