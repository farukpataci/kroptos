/**
 * The suites that need the live Postgres from packages/backend/.env.
 *
 * Kept out of the default `jest` run on purpose: `*.integration-spec.ts` does
 * not match the main config's `.*\.spec\.ts$`, so `pnpm test` stays green on a
 * machine with no database, and these run only when asked for:
 *
 *   pnpm test:integration
 *
 * They are not weaker tests — they are the ones that prove what a mocked Prisma
 * cannot (the real unique index, the real guard chain, real HTTP).
 */
module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: 'src',
  testRegex: '.*\.integration-spec\.ts$',
  transform: { '^.+\.(t|j)s$': 'ts-jest' },
  testEnvironment: 'node',
  moduleNameMapper: {
    '^@common/(.*)$': '<rootDir>/common/$1',
    '^@modules/(.*)$': '<rootDir>/modules/$1',
    '^@config/(.*)$': '<rootDir>/config/$1',
    '^@/(.*)$': '<rootDir>/$1',
  },
};
