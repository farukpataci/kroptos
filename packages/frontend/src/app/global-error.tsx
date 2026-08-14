'use client';

import { useEffect } from 'react';

/**
 * Last-resort boundary for failures in the root layout itself. It replaces the
 * whole document, so it has to render its own <html> and <body> — none of the
 * providers or the stylesheet from the root layout are available here, which
 * is why the styling below is inline rather than token-based.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Global error:', error);
  }, [error]);

  return (
    <html lang="tr">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
          background: '#F9FAFB',
          color: '#101828',
        }}
      >
        <div style={{ maxWidth: 420, padding: 24, textAlign: 'center' }}>
          <h1 style={{ fontSize: 20, fontWeight: 600, margin: 0 }}>Uygulama başlatılamadı</h1>
          <p style={{ marginTop: 8, fontSize: 14, lineHeight: 1.6, color: '#667085' }}>
            Beklenmeyen bir hata nedeniyle sayfa yüklenemedi. Lütfen tekrar deneyin.
          </p>
          {error.digest && (
            <p style={{ marginTop: 12, fontSize: 11, color: '#98A2B3' }}>
              Hata kodu: {error.digest}
            </p>
          )}
          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: 24,
              padding: '10px 20px',
              fontSize: 13,
              fontWeight: 600,
              color: '#fff',
              background: '#465FFF',
              border: 'none',
              borderRadius: 10,
              cursor: 'pointer',
            }}
          >
            Tekrar Dene
          </button>
        </div>
      </body>
    </html>
  );
}
