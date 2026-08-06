'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';

export default function AdminRedirect() {
  const router = useRouter();
  const { user, isLoading, tenantContext } = useAuth();

  useEffect(() => {
    if (isLoading) return;

    if (!user) {
      router.replace('/auth/login');
      return;
    }

    if (tenantContext?.agencyId) {
      router.replace(`/t/tn_${tenantContext.agencyId}/dashboard`);
    } else {
      router.replace('/select-tenant');
    }
  }, [user, isLoading, tenantContext, router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-kp-bg-primary font-sans">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-kp-accent border-t-transparent" />
        <p className="text-xs font-semibold text-kp-text-tertiary">Yönlendiriliyor...</p>
      </div>
    </div>
  );
}
