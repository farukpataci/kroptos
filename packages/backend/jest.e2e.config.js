/**
 * Uçtan uca kiracı izolasyonu (test/*.e2e-spec.ts): ÇALIŞAN API + canlı Postgres + RLS.
 *
 *   API_PORT=3101 CORS_ORIGINS=http://localhost:3100 node dist/main.js
 *   pnpm test:e2e                       # E2E_API_URL=http://host:port/api ile başka adres
 *
 * Varsayılan `jest` koşusuna girmez (testRegex farklı); DATABASE_MIGRATION_URL ister
 * (fixture superuser ile kurulur, uygulama rolü bağlamsız yazamaz).
 */
module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testRegex: 'test/.*\\.e2e-spec\\.ts$',
  transform: { '^.+\\.(t|j)s$': 'ts-jest' },
  testEnvironment: 'node',
  testTimeout: 60000,
  moduleNameMapper: {
    '^@common/(.*)$': '<rootDir>/src/common/$1',
    '^@modules/(.*)$': '<rootDir>/src/modules/$1',
    '^@config/(.*)$': '<rootDir>/src/config/$1',
    '^@/(.*)$': '<rootDir>/src/$1',
  },
};
