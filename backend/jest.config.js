// jest.unit.config.js
require('dotenv').config();
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  collectCoverage: true,
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/server.ts',
    '!src/tests/**',
    '!src/**/*.test.{js,ts}',
    '!src/error/index.ts',
    '!src/lib/prisma.ts',
    '!src/lambda.ts',
  ],
  coverageReporters: ['json', 'lcov', 'text', 'clover'],
  testTimeout: 30000,
  roots: ['<rootDir>/src', '<rootDir>/tests'],
  transform: {
    '^.+\\.tsx?$': 'ts-jest',
  },
  testMatch: [
    '**/*.test.ts',
  ],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  verbose: true,
  clearMocks: true,
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  moduleDirectories: ['node_modules', 'src'],
  coverageThreshold: {
    global: {
      statements: 85,
      branches: 85,
      functions: 85,
      lines: 85,
    },
  },
};