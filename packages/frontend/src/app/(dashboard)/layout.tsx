'use client';

import DashboardLayout from '@/components/layout/DashboardLayout';
import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function DashboardGroupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/auth/login');
    }
  }, [isAuthenticated, isLoading, router]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-kp-bg-primary">
        <div className="flex flex-col items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-kp-lg bg-kp-accent shadow-kp-glow animate-pulse">
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
