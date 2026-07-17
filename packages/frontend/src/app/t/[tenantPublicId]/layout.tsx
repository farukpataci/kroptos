'use client';

import DashboardLayout from '@/components/layout/DashboardLayout';
import { useAuth } from '@/lib/auth-context';
import { useRouter, useParams } from 'next/navigation';
import { useEffect } from 'react';

export default function DashboardGroupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isAuthenticated, isLoading, tenantContext, accessibleTenants, switchTenant } = useAuth();
  const router = useRouter();
  const params = useParams();
  const tenantPublicId = params?.tenantPublicId as string;

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/auth/login');
    }
  }, [isAuthenticated, isLoading, router]);

  // Auto-switch active tenant context if URL parameters change
  useEffect(() => {
    if (isLoading || !isAuthenticated || !tenantPublicId) return;

    const matchedAgency = accessibleTenants.find(
      (a: any) => a.publicId === tenantPublicId || a.id === tenantPublicId
    );

    if (matchedAgency) {
      if (tenantContext.agencyId !== matchedAgency.id) {
        console.log(`Auto-switching active tenant context to matched agency ID: ${matchedAgency.id}`);
        switchTenant(matchedAgency.id, null, null);
      }
    } else if (accessibleTenants.length > 0) {
      // User is not authorized to access this tenantPublicId, redirect to select-tenant
      console.warn(`Unauthorized access attempt to tenantPublicId: ${tenantPublicId}`);
      router.push('/select-tenant');
    }
  }, [tenantPublicId, accessibleTenants, tenantContext.agencyId, isAuthenticated, isLoading]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-kp-bg-primary">
        <div className="flex flex-col items-center gap-4 animate-pulse">
          <div className="flex h-12 w-12 items-center justify-center rounded-kp-lg bg-kp-accent shadow-kp-glow">
            <span className="text-lg font-bold text-white">K</span>
          </div>
          <p className="text-sm text-kp-text-tertiary">Loading KroptOS...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return <DashboardLayout>{children}</DashboardLayout>;
}
