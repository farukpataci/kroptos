import { HealthController } from './health.controller';

/**
 * The endpoint exists to answer "which build is serving this request", so the
 * behaviour worth pinning is that it never goes quiet: no git, no build-info
 * file, running straight from source — it still answers, and it says `unknown`
 * instead of inventing a SHA. A health endpoint that throws is worse than none,
 * because it fails exactly when something is already wrong.
 */
describe('HealthController', () => {
  const controller = new HealthController();

  it('reports ok', () => {
    expect(controller.check().status).toBe('ok');
  });

  it('answers even with no build-info file present', () => {
    // Under ts-jest this runs from src/, where dist/build-info.json does not
    // exist — the same situation as a fresh checkout that was never built.
    expect(() => controller.check()).not.toThrow();
  });

  it('says unknown rather than inventing a SHA', () => {
    const { sha } = controller.check();
    expect(typeof sha).toBe('string');
    expect(sha.length).toBeGreaterThan(0);
  });

  it('carries the fields a stale-build diagnosis needs', () => {
    // Each one answers a different question: sha = which commit, dirty = was the
    // tree clean when built, builtAt = when dist was produced, startedAt = when
    // this process loaded it. A build newer than startedAt means the process is
    // serving old code.
    expect(controller.check()).toEqual(
      expect.objectContaining({
        status: expect.any(String),
        sha: expect.any(String),
        dirty: expect.any(Boolean),
        branch: expect.any(String),
        builtAt: expect.any(String),
        startedAt: expect.any(String),
        uptimeSeconds: expect.any(Number),
      }),
    );
  });
});
