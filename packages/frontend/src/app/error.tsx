'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { ArrowPathIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';

/**
 * Route-level error boundary. The App Router requires one for the client
 * router to recover from a render failure; without it a thrown error leaves
 * the router with no boundary to mount and it retries in a loop instead.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Route error:', error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center p-6 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-kp-lg bg-kp-danger/10 text-kp-danger">
        <ExclamationTriangleIcon className="h-7 w-7" />
      </div>

      <h1 className="mt-5 text-xl font-semibold text-kp-text-primary">Bir şeyler ters gitti</h1>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-kp-text-tertiary">
        Bu sayfa yüklenirken beklenmeyen bir hata oluştu. Tekrar deneyebilir veya panele
        dönebilirsiniz.
      </p>

      {/* The digest is what ties this screen to the server log line. */}
      {error.digest && (
        <p className="mt-3 font-mono text-[0.6875rem] text-kp-text-tertiary">Hata kodu: {error.digest}</p>
      )}

      <div className="mt-6 flex items-center gap-3">
        <button
          type="button"
          onClick={reset}
          className="flex items-center gap-2 rounded-kp-md bg-kp-accent px-5 py-2.5 text-xs font-semibold text-white shadow-xs transition-all hover:bg-kp-accent-hover"
        >
          <ArrowPathIcon className="h-4 w-4" />
          Tekrar Dene
        </button>
        <Link
          href="/"
          className="rounded-kp-md border border-kp-border px-5 py-2.5 text-xs font-semibold text-kp-text-secondary transition-colors hover:text-kp-text-primary"
        >
          Ana Sayfa
        </Link>
      </div>
    </div>
  );
}
