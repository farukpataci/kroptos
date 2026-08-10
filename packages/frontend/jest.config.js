const nextJest = require('next/jest');

// `next/jest` wires up the SWC transform, CSS/asset stubs and the `@/` alias
// from tsconfig, so the config below only has to describe what is specific to
// this package.
const createJestConfig = nextJest({ dir: './' });

/** @type {import('jest').Config} */
const config = {
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testPathIgnorePatterns: ['<rootDir>/.next/', '<rootDir>/node_modules/'],
  moduleNameMapper: {
    // The workspace package ships compiled JS; point Jest at the source so a
    // test does not silently run against a stale `dist` build.
    '^@kroptos/shared$': '<rootDir>/../shared/src/index.ts',
  },
};

module.exports = createJestConfig(config);
