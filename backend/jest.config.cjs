// const { createDefaultPreset } = require("ts-jest");

// const tsJestTransformCfg = createDefaultPreset().transform;

/** @type {import("jest").Config} **/
module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.ts'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  verbose: true,
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      useESM: true, // move the ESM flag here
      tsconfig: 'tsconfig.jest.json',
    }],
  },
  extensionsToTreatAsEsm: ['.ts'],
  moduleNameMapper: {
    // This regex maps imports without extensions to their corresponding TypeScript files
    "^@/(.+?)\\.js$": "<rootDir>/src/$1.ts",
  },
};