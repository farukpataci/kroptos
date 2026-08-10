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
  // Supplying moduleNameMapper here replaces the one `next/jest` derives from
  // tsconfig, so the tsconfig aliases have to be restated rather than assumed.
  moduleNameMapper: {
    // The workspace package ships compiled JS; point Jest at the source so a
    // test does not silently run against a stale `dist` build.
    '^@kroptos/shared$': '<rootDir>/../shared/src/index.ts',
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@components/(.*)$': '<rootDir>/src/components/$1',
  },
};

module.exports = createJestConfig(config);
