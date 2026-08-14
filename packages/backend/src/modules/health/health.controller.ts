import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { readFileSync } from 'fs';
import { join } from 'path';

interface BuildInfo {
  sha: string;
  dirty: boolean;
  branch: string;
  builtAt: string;
}

/**
 * Which build is actually serving.
 *
 * A running Node process keeps the code it loaded at startup, so rebuilding
 * dist/ changes nothing until a restart. That gap has been diagnosed repeatedly
 * by comparing file timestamps against process start times; this endpoint
 * answers it in one request instead.
 *
 * Deliberately unauthenticated: its whole purpose is to be reachable when
 * something looks wrong, and it exposes nothing beyond a commit id that is
 * already visible to anyone with the repository.
 *
 * Read once at module load: the value cannot change without a restart, and a
 * restart is exactly what re-reads it.
 */
const UNKNOWN: BuildInfo = { sha: 'unknown', dirty: false, branch: 'unknown', builtAt: 'unknown' };

function readBuildInfo(): BuildInfo {
  // Set by the deployer (pm2 ecosystem, container env) — wins over the file so
  // an image built elsewhere can still state its own provenance.
  if (process.env.BUILD_SHA) {
    return { ...UNKNOWN, sha: process.env.BUILD_SHA, branch: process.env.BUILD_BRANCH ?? 'unknown' };
  }

  try {
    // Compiled to dist/modules/health/, so dist/ is two levels up. Absent when
    // running from source under ts-jest, which is why this falls back rather
    // than throwing.
    const raw = readFileSync(join(__dirname, '..', '..', 'build-info.json'), 'utf8');
    return { ...UNKNOWN, ...JSON.parse(raw) };
  } catch {
    return UNKNOWN;
  }
}

const BUILD_INFO = readBuildInfo();
const STARTED_AT = new Date().toISOString();

@ApiTags('health')
@Controller('/api')
export class HealthController {
  @Get('health')
  @ApiOperation({ summary: 'Liveness probe and the commit this process is serving' })
  check() {
    return {
      status: 'ok',
      // `sha` is the commit dist/ was built from, NOT the repository's current
      // HEAD. When they differ the process is serving an older build, which is
      // the thing this endpoint exists to reveal.
      sha: BUILD_INFO.sha,
      // dist/ was built from a tree with uncommitted changes, so the SHA alone
      // does not describe what is running.
      dirty: BUILD_INFO.dirty,
      branch: BUILD_INFO.branch,
      builtAt: BUILD_INFO.builtAt,
      startedAt: STARTED_AT,
      uptimeSeconds: Math.floor(process.uptime()),
    };
  }
}
