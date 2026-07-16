'use client';

import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function Home() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading) {
      if (isAuthenticated) {
        router.replace('/dashboard');
      } else {
        router.replace('/auth/login');
      }
    }
  }, [isAuthenticated, isLoading, router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-kp-bg-primary">
      <div className="flex flex-col items-center gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-kp-lg bg-kp-accent shadow-kp-glow animate-pulse">
          <span className="text-lg font-bold text-white">K</span>
        </div>
        <p className="text-sm text-kp-text-tertiary">Redirecting...</p>
      </div>
    </div>
  );
}
