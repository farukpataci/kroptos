'use client';

import { useEffect } from 'react';
import Link from 'next/link';

export default function TenantError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Tenant route error:', error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center p-6 text-center">
      <h1 className="text-xl font-semibold text-slate-900 dark:text-white">Bir şeyler ters gitti</h1>
      <p className="mt-2 text-sm text-slate-500">
        Sayfa yüklenirken bir hata oluştu.
      </p>
      {error.digest && (
        <p className="mt-2 font-mono text-xs text-slate-400">Hata kodu: {error.digest}</p>
      )}
      <div className="mt-5 flex gap-3">
        <button
          type="button"
          onClick={reset}
          className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-blue-700"
        >
          Tekrar Dene
        </button>
        <Link
          href="/"
          className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
        >
          Ana Sayfa
        </Link>
      </div>
    </div>
  );
}
