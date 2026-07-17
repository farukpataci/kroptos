'use client';

import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';

export default function SelectTenantPage() {
  const { user, accessibleTenants, switchTenant, isLoading } = useAuth();
  const router = useRouter();
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/auth/login');
    }
  }, [user, isLoading, router]);

  const handleSelectTenant = async (agency: any) => {
    setError('');
    setSubmitting(true);
    try {
      const tenantPublicId = agency.publicId || `tn_${agency.id}`;
      await switchTenant(agency.id, null, null);
      router.push(`/t/${tenantPublicId}/dashboard`);
    } catch (err: any) {
      setError(err?.message || 'Firma seçimi başarısız oldu.');
      setSubmitting(false);
    }
  };

  if (isLoading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-kp-bg-primary">
        <div className="flex flex-col items-center gap-4 animate-pulse">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-kp-accent text-2xl font-bold text-white shadow-lg">
            K
          </div>
          <p className="text-sm font-medium text-kp-text-tertiary">Yükleniyor...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-kp-bg-primary py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 bg-kp-bg-secondary p-8 rounded-kp-lg border border-kp-border shadow-kp-glow animate-fade-in">
        <div>
          <div className="flex justify-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-kp-md bg-kp-accent shadow-kp-glow">
              <span className="text-lg font-bold text-white">K</span>
            </div>
          </div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-kp-text-primary tracking-tight">
            Firma / Tenant Seçin
          </h2>
          <p className="mt-2 text-center text-sm text-kp-text-tertiary">
            Devam etmek için erişim yetkiniz olan bir firma seçin
          </p>
        </div>

        {error && (
          <div className="rounded-kp-md bg-kp-danger/10 border border-kp-danger/20 p-4 text-xs font-medium text-kp-danger animate-shake">
            {error}
          </div>
        )}

        <div className="mt-8 space-y-3">
          {accessibleTenants.length === 0 ? (
            <div className="text-center py-6 text-sm text-kp-text-tertiary">
              Yetkili olduğunuz herhangi bir firma bulunamadı. Lütfen yöneticinizle iletişime geçin.
            </div>
          ) : (
            accessibleTenants.map((agency: any) => (
              <button
                key={agency.id}
                onClick={() => handleSelectTenant(agency)}
                disabled={submitting}
                className="w-full flex items-center justify-between p-4 border border-kp-border rounded-kp-md bg-kp-bg-primary hover:bg-kp-bg-hover hover:border-kp-accent transition-all text-left"
              >
                <div>
                  <div className="text-sm font-semibold text-kp-text-primary">
                    {agency.name}
                  </div>
                  <div className="text-xs text-kp-text-tertiary mt-0.5">
                    ID: {agency.publicId || agency.id}
                  </div>
                </div>
                <div className="text-kp-accent font-semibold text-xs">
                  Giriş Yap →
                </div>
              </button>
            ))
          )}
        </div>

        <div className="text-center pt-4 border-t border-kp-border">
          <Link
            href="/auth/login"
            className="text-xs font-semibold text-kp-text-tertiary hover:text-kp-text-primary transition-all"
          >
            Farklı Hesapla Giriş Yap
          </Link>
        </div>
      </div>
    </div>
  );
}
