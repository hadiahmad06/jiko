// jest.config.cjs
const { defaults } = require('ts-jest');

module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.ts'], // Directly test .ts files
  moduleFileExtensions: ['ts', 'js', 'json'],
  moduleNameMapper: {
    // Map @/ alias to src directory
    "^(\\.{1,2}/.*)\\.js$": "$1",
  },
  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      {
        ...defaults,
        tsconfig: 'tsconfig.jest.json', // Use Jest-specific tsconfig
        useESM: false, // Use CJS mode unless you have a reason to use ESM
      },
    ],
  },
};