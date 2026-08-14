'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';

export default function StandaloneStoresPage() {
  const router = useRouter();
  const { tenantContext, accessibleTenants } = useAuth();

  useEffect(() => {
    const currentAgency = accessibleTenants.find((a: any) => a.id === tenantContext?.agencyId);
    const tenantPublicId = currentAgency?.publicId || (tenantContext?.agencyId ? `tn_${tenantContext.agencyId}` : '');
    
    if (tenantPublicId) {
      router.replace(`/t/${tenantPublicId}/stores`);
    } else {
      router.replace('/auth/login');
    }
  }, [tenantContext, accessibleTenants, router]);

  return (
    <div className="flex h-screen w-full items-center justify-center bg-kp-bg-primary">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-kp-accent border-t-transparent" />
        <p className="text-sm font-medium text-kp-text-secondary">Yönlendiriliyor...</p>
      </div>
    </div>
  );
}
