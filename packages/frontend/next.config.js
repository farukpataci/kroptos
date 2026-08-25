/**
 * Which commit this bundle was built from.
 *
 * `next start` serves a prebuilt bundle and never recompiles, so a change can be
 * committed and still not be on screen. That gap has been diagnosed repeatedly
 * by comparing .next/BUILD_ID's timestamp against source files; baking the SHA
 * in makes the footer answer it instead.
 *
 * Read at build time — `env` values are inlined into the bundle, so this runs on
 * the build machine, not in the browser. Never fails the build: no git binary or
 * no .git directory degrades to 'unknown', which is reported honestly.
 */
function buildSha() {
  if (process.env.BUILD_SHA) return process.env.BUILD_SHA;
  try {
    const { execSync } = require('child_process');
    const sha = execSync('git rev-parse --short HEAD', {
      cwd: __dirname,
      stdio: ['ignore', 'pipe', 'ignore'],
    })
      .toString()
      .trim();
    // A dirty tree means the bundle matches no commit; marking it beats a SHA
    // that looks authoritative but does not describe what was compiled.
    const dirty =
      execSync('git status --porcelain', { cwd: __dirname, stdio: ['ignore', 'pipe', 'ignore'] })
        .toString()
        .trim() !== '';
    return dirty ? `${sha}-dirty` : sha;
  } catch {
    return 'unknown';
  }
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  experimental: {
    /**
     * Renders `getStaticPaths` in a worker THREAD instead of a forked process.
     *
     * `next dev` forks a full Node.js child process for every App Router
     * request whose route has a dynamic segment — base-server.js does it under
     * `if (isAppPath && isDynamic)`, with no check for whether the route
     * actually exports `generateStaticParams`. No route here does, so the fork
     * computes an empty list and exits. Measured cost of one: ~140MB.
     *
     * This machine has 6GB and sits around 400MB free with the backend, the
     * dev server and Postgres up. When the fork cannot get its memory it dies,
     * and because Next gives that worker `maxRetries: 1` the browser shows
     * "Jest worker encountered 2 child process exceptions, exceeding retry
     * limit" — the real error is never surfaced, which is why `next build`
     * passing says nothing about it.
     *
     * A thread shares the process rather than duplicating it. The flag also
     * switches the static-generation worker `next build` uses; the build was
     * re-run after this to confirm it still passes.
     */
    workerThreads: true,
  },
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api',
    NEXT_PUBLIC_BUILD_SHA: buildSha(),
    NEXT_PUBLIC_BUILD_AT: new Date().toISOString(),
  },
  async rewrites() {

    return [
      {
        source: '/:locale([a-zA-Z]{2}(?:-[a-zA-Z]{2})?)/home',
        destination: '/:locale',
      },
      {
        source: '/sektorler/ev-ve-bahce',
        destination: '/tr/industry/home-and-garden',
      },
      {
        source: '/:locale([a-zA-Z]{2}(?:-[a-zA-Z]{2})?)/sektorler/ev-ve-bahce',
        destination: '/:locale/industry/home-and-garden',
      },
      {
        source: '/industries/home-and-garden',
        destination: '/en/industry/home-and-garden',
      },
      {
        source: '/:locale([a-zA-Z]{2}(?:-[a-zA-Z]{2})?)/industries/home-and-garden',
        destination: '/:locale/industry/home-and-garden',
      },
    ];
  },
};

module.exports = nextConfig;
