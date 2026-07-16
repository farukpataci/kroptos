'use client';

import { useAuth } from '@/lib/auth-context';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect } from 'react';
import Link from 'next/link';
import {
  Squares2X2Icon,
  ArrowLeftIcon,
  MagnifyingGlassIcon,
} from '@heroicons/react/24/outline';

export default function WmsLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, user, tenantContext } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

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
            <span className="text-lg font-bold text-white">W</span>
          </div>
          <p className="text-sm text-kp-text-tertiary">Loading WMS App...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  const navItems = [
    { label: 'Launcher', href: '/app/wms' },
    { label: 'Dashboard', href: '/app/wms/dashboard' },
    { label: 'Packaging', href: '/app/wms/packaging' },
    { label: 'Inbound', href: '/app/wms/inbound' },
    { label: 'Returns', href: '/app/wms/returns' },
    { label: 'Shipments', href: '/app/wms/shipments' },
    { label: 'Transfers', href: '/app/wms/transfers' },
    { label: 'Stocks', href: '/app/wms/stocks' },
    { label: 'Settings', href: '/app/wms/settings' },
  ];

  return (
    <div className="min-h-screen bg-kp-bg-primary font-outfit antialiased">
      {/* Top Header */}
      <header className="sticky top-0 z-40 flex h-header items-center justify-between border-b border-kp-border bg-kp-bg-primary/80 backdrop-blur-xl px-4 lg:px-6">
        <div className="flex items-center gap-4">
          {/* WMS Logo */}
          <Link href="/app/wms" className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-kp-md bg-kp-accent shadow-kp-glow">
              <Squares2X2Icon className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-sm font-semibold text-kp-text-primary tracking-tight">KroptOS</h1>
              <p className="text-[10px] font-medium text-kp-text-tertiary uppercase tracking-widest">WMS App</p>
            </div>
          </Link>

          <span className="h-5 w-[1px] bg-kp-border hidden md:block" />

          {/* Inline Nav */}
          <nav className="hidden md:flex items-center gap-1">
            {navItems.map((item) => {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`rounded-kp-md px-3 py-1.5 text-[12px] font-medium transition-all duration-150 ${
                    active
                      ? 'bg-kp-bg-active text-kp-accent-hover'
                      : 'text-kp-text-tertiary hover:bg-kp-bg-hover hover:text-kp-text-primary'
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-2">
          {/* Search */}
          <div className="relative hidden sm:block">
            <input
              type="text"
              placeholder="Scan barcode, shelf, order…"
              className="w-56 rounded-kp-md border border-kp-border bg-kp-bg-primary/50 px-3 py-2 pl-8 text-[12px] text-kp-text-secondary placeholder-kp-text-tertiary transition-colors focus:border-kp-border-accent focus:outline-none"
            />
            <MagnifyingGlassIcon className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-kp-text-tertiary" />
          </div>

          {/* Back to Panel */}
          <Link
            href="/dashboard"
            className="flex items-center gap-1.5 rounded-kp-md border border-kp-border bg-kp-bg-primary/50 px-3 py-2 text-[12px] font-medium text-kp-text-secondary transition-all hover:border-kp-border-accent hover:text-kp-text-primary"
          >
            <ArrowLeftIcon className="h-3.5 w-3.5" />
            Back to Panel
          </Link>
        </div>
      </header>

      {/* Main Container */}
      <main className="p-4 lg:p-6 max-w-7xl mx-auto">
        {children}
      </main>
    </div>
  );
}
