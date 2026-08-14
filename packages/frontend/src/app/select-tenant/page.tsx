'use client';

import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { BuildingOfficeIcon, BuildingStorefrontIcon, ArrowRightIcon } from '@heroicons/react/24/outline';

export default function SelectTenantPage() {
  const { user, accessibleTenants, switchTenant, isLoading } = useAuth();
  const router = useRouter();
  const [error, setError] = useState('');
  const [submittingId, setSubmittingId] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/auth/login');
    }
  }, [user, isLoading, router]);

  const handleSelectTenant = async (tenant: any) => {
    setError('');
    setSubmittingId(tenant.id);
    try {
      const tenantPublicId = tenant.publicId || `tn_${tenant.id}`;
      await switchTenant(tenant.agencyId || tenant.id, tenant.clientId || null, tenant.storeId || null);
      router.push(`/t/${tenantPublicId}/dashboard`);
    } catch (err: any) {
      setError(err?.message || 'Firma seçimi başarısız oldu.');
      setSubmittingId(null);
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

  // Separate Agencies and Brands
  const agencies = accessibleTenants.filter((t: any) => t.type === 'agency' || !t.type);
  const brands = accessibleTenants.filter((t: any) => t.type === 'brand');

  return (
    <div className="flex min-h-screen items-center justify-center bg-kp-bg-primary py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-lg w-full space-y-6 bg-kp-bg-secondary p-8 rounded-kp-lg border border-kp-border shadow-kp-glow animate-fade-in">
        <div>
          <div className="flex justify-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-kp-md bg-kp-accent shadow-kp-glow">
              <span className="text-lg font-bold text-white">K</span>
            </div>
          </div>
          <h2 className="mt-6 text-center text-2xl font-extrabold text-kp-text-primary tracking-tight">
            Firma / Tenant Seçin
          </h2>
          <p className="mt-2 text-center text-xs text-kp-text-tertiary">
            Devam etmek için işlem yapmak istediğiniz Dağıtıcı Firma veya Markayı seçin
          </p>
        </div>

        {error && (
          <div className="rounded-kp-md bg-kp-danger/10 border border-kp-danger/20 p-4 text-xs font-medium text-kp-danger animate-shake">
            {error}
          </div>
        )}

        <div className="space-y-6">
          {agencies.length === 0 ? (
            <div className="text-center py-6 text-sm text-kp-text-tertiary">
              Yetkili olduğunuz herhangi bir firma bulunamadı. Lütfen yöneticinizle iletişime geçin.
            </div>
          ) : (
            agencies.map((agency: any) => {
              const agencyBrands = brands.filter((b: any) => b.agencyId === agency.id);

              return (
                <div key={agency.id} className="space-y-3">
                  {/* Agency Header Card */}
                  <div className="flex items-center justify-between p-4 rounded-kp-md bg-kp-bg-primary/80 border border-kp-border">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-kp-sm bg-blue-500/10 text-blue-500">
                        <BuildingOfficeIcon className="h-5 w-5" />
                      </div>
                      <div>
                        <div className="text-[0.625rem] font-semibold text-kp-text-tertiary uppercase tracking-wider">
                          Dağıtıcı Firma
                        </div>
                        <div className="text-sm font-bold text-kp-text-primary">
                          {agency.name}
                        </div>
                        <div className="text-[0.6875rem] text-kp-text-tertiary font-mono">
                          ID: {agency.publicId || agency.id}
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => handleSelectTenant(agency)}
                      disabled={submittingId === agency.id}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-kp-md bg-kp-bg-tertiary hover:bg-kp-accent hover:text-white text-kp-text-secondary transition-all text-xs font-semibold"
                    >
                      Giriş Yap <ArrowRightIcon className="h-3 w-3" />
                    </button>
                  </div>

                  {/* Associated Brands List */}
                  <div className="pl-4 space-y-2 border-l-2 border-kp-border">
                    <div className="text-[0.6875rem] font-semibold text-kp-text-tertiary uppercase tracking-wider">
                      Bağlı Markalar ({agencyBrands.length})
                    </div>

                    {agencyBrands.length === 0 ? (
                      <div className="text-xs text-kp-text-tertiary italic py-2">
                        Bu firmaya henüz bağlı marka bulunmuyor.
                      </div>
                    ) : (
                      agencyBrands.map((brand: any) => (
                        <button
                          key={brand.id}
                          onClick={() => handleSelectTenant(brand)}
                          disabled={submittingId === brand.id}
                          className="w-full flex items-center justify-between p-3.5 border border-kp-border rounded-kp-md bg-kp-bg-primary hover:bg-kp-bg-hover hover:border-kp-accent transition-all text-left group"
                        >
                          <div className="flex items-center gap-3">
                            <div className="flex h-8 w-8 items-center justify-center rounded-kp-sm bg-kp-accent/10 text-kp-accent group-hover:bg-kp-accent group-hover:text-white transition-colors">
                              <BuildingStorefrontIcon className="h-4 w-4" />
                            </div>
                            <div>
                              <div className="text-xs font-bold text-kp-text-primary group-hover:text-kp-accent transition-colors">
                                {brand.name}
                              </div>
                              <div className="text-[0.625rem] text-kp-text-tertiary font-mono">
                                ID: {brand.publicId || brand.id}
                              </div>
                            </div>
                          </div>

                          <div className="text-kp-accent font-semibold text-xs flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                            Markaya Giriş →
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              );
            })
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
