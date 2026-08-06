'use client';

import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function AdminProfileFallbackRedirect() {
  const { user, tenantContext, accessibleTenants, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;

    if (!user) {
      router.push('/auth/login');
      return;
    }

    const currentAgency = accessibleTenants.find((a: any) => a.id === tenantContext.agencyId);
    const tenantPublicId = currentAgency?.publicId || (tenantContext.agencyId ? `tn_${tenantContext.agencyId}` : '');

    if (tenantPublicId) {
      router.replace(`/t/${tenantPublicId}/admin/profile`);
    } else {
      router.replace('/select-tenant');
    }
  }, [user, tenantContext, accessibleTenants, isLoading, router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-kp-bg-primary">
      <div className="flex flex-col items-center gap-4 animate-pulse">
        <div className="flex h-12 w-12 items-center justify-center rounded-kp-lg bg-kp-accent shadow-kp-glow">
          <span className="text-lg font-bold text-white">K</span>
        </div>
        <p className="text-sm text-kp-text-tertiary">Profil yükleniyor...</p>
      </div>
    </div>
  );
}
