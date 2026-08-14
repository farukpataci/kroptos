'use client';

import { useEffect, useState } from 'react';

/**
 * Shows which build is on screen, and which build the API is serving.
 *
 * Both halves are needed, and this is the reason: the frontend runs from a
 * prebuilt bundle that `next start` never recompiles, and the backend runs code
 * Node loaded at process start. Either one can be older than the repository
 * while everything looks healthy — "the code is committed" and "the code is
 * being served" are separate facts, and they have been confused repeatedly.
 * Showing the two SHAs side by side answers it at a glance instead of through
 * file-timestamp archaeology.
 *
 * The API half is best-effort: if /api/health cannot be reached it simply stays
 * hidden. A diagnostic aid must never itself become a source of errors.
 */
export function BuildStamp() {
  const uiSha = process.env.NEXT_PUBLIC_BUILD_SHA || 'unknown';
  const [apiSha, setApiSha] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

    fetch(`${base}/health`)
      .then((response) => (response.ok ? response.json() : null))
      .then((body) => {
        if (cancelled || !body?.sha) return;
        setApiSha(body.dirty ? `${body.sha}-dirty` : body.sha);
      })
      .catch(() => {
        // Backend down or unreachable: the UI half is still worth showing.
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // Matching SHAs are the normal case and need no emphasis; a mismatch means one
  // side is serving an older build, so it is called out rather than left for the
  // reader to spot by comparing two hashes.
  const mismatch = apiSha !== null && apiSha !== uiSha;

  return (
    <footer className="px-4 pb-4 pt-2 md:px-6 lg:px-8">
      <p className="text-right font-mono text-[0.6875rem] text-slate-400 dark:text-slate-600">
        <span title="Bu sayfayı üreten frontend build'i">build {uiSha}</span>
        {apiSha && (
          <>
            <span className="mx-1.5">·</span>
            <span
              title="Çalışan backend sürecinin servis ettiği build"
              className={mismatch ? 'text-amber-600 dark:text-amber-500' : undefined}
            >
              api {apiSha}
            </span>
          </>
        )}
        {mismatch && (
          <span className="ml-1.5 text-amber-600 dark:text-amber-500" title="Arayüz ve API farklı build çalıştırıyor">
            ⚠ farklı build
          </span>
        )}
      </p>
    </footer>
  );
}
