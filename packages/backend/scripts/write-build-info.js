#!/usr/bin/env node
/**
 * Records which commit produced dist/, as a `postbuild` step.
 *
 * Why this exists: a running Node process holds the code it loaded at startup.
 * Rebuilding dist/ changes nothing until the process restarts, so "the fix is in
 * the repo" and "the fix is being served" are different facts. Telling them
 * apart used to mean comparing file timestamps by hand; this writes the commit
 * into the build so /api/health can answer it directly.
 *
 * Never fails the build: a missing git binary or a tarball checkout with no .git
 * is not a reason to stop shipping. The SHA degrades to 'unknown', which the
 * health endpoint reports honestly rather than hiding.
 */
const { execSync } = require('child_process');
const { writeFileSync, existsSync, mkdirSync } = require('fs');
const { join } = require('path');

const read = (command, fallback) => {
  try {
    return execSync(command, { cwd: __dirname, stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim();
  } catch {
    return fallback;
  }
};

const sha = read('git rev-parse --short HEAD', 'unknown');
// A dirty tree means dist/ does not correspond to any commit; saying so beats a
// SHA that looks authoritative but does not match what was compiled.
const dirty = read('git status --porcelain', '') !== '';
const branch = read('git rev-parse --abbrev-ref HEAD', 'unknown');

const distDir = join(__dirname, '..', 'dist');
if (!existsSync(distDir)) mkdirSync(distDir, { recursive: true });

const info = {
  sha,
  dirty,
  branch,
  builtAt: new Date().toISOString(),
};

writeFileSync(join(distDir, 'build-info.json'), `${JSON.stringify(info, null, 2)}\n`, 'utf8');

console.log(`build-info: ${sha}${dirty ? '-dirty' : ''} (${branch}) @ ${info.builtAt}`);
