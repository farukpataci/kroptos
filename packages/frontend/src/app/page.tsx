'use client';

import { useAuth } from '@/lib/auth-context';
import Link from 'next/link';

import Navbar from '@/components/layout/Navbar/Navbar';

import { useLocale } from 'next-intl';

export default function Home() {
  const { isAuthenticated } = useAuth();
  const locale = useLocale();

  const isTr = locale === 'tr';

  return (
    <div className="relative min-h-screen w-full bg-kp-bg-primary text-kp-text-primary font-outfit overflow-hidden transition-colors duration-300">
      {/* Premium Abstract Background Glows */}
      <div className="absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full bg-kp-accent/5 dark:bg-kp-accent/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 translate-x-1/2 translate-y-1/2 w-[400px] h-[400px] rounded-full bg-violet-600/5 dark:bg-violet-600/10 blur-[140px] pointer-events-none" />

      {/* Premium Mega Menu Navbar */}
      <Navbar />

      {/* Main Hero Section */}
      <main className="flex min-h-screen flex-col items-center justify-center px-4 sm:px-6 lg:px-8 pt-[76px]">
        <div className="text-center max-w-3xl space-y-6 animate-fade-in-up">
          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-kp-accent-muted text-kp-accent border border-kp-accent/20">
            <span className="h-1.5 w-1.5 rounded-full bg-kp-accent animate-pulse-dot" />
            {isTr ? 'Alqora v2.0 Şimdi Hazır' : 'Alqora v2.0 is Now Available'}
          </span>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-kp-text-primary leading-tight">
            {isTr ? (
              <>
                E-Ticaret Operasyonlarınızı <br className="hidden sm:inline" />
                <span className="bg-gradient-to-r from-kp-accent via-[#6366f1] to-violet-500 bg-clip-text text-transparent">
                  Tek Merkezden
                </span>{' '}
                Yönetin
              </>
            ) : (
              <>
                Manage E-Commerce Operations <br className="hidden sm:inline" />
                <span className="bg-gradient-to-r from-kp-accent via-[#6366f1] to-violet-500 bg-clip-text text-transparent">
                  From One Center
                </span>
              </>
            )}
          </h1>

          <p className="text-base sm:text-lg text-kp-text-secondary max-w-2xl mx-auto leading-relaxed">
            {isTr
              ? 'Sipariş yönetimi, WMS depo otomasyonu, kargo entegrasyonları ve yapay zeka asistanı ile çok kanallı ticaret süreçlerinizi Alqora ile ölçekleyin.'
              : 'Scale your omnichannel commerce processes with order management, WMS warehouse automation, shipping integrations, and AI assistant using Alqora.'}
          </p>

          <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
            <Link
              href={isAuthenticated ? '/select-tenant' : '/auth/login'}
              className="px-6 py-3 text-sm font-bold rounded-kp-sm bg-kp-accent hover:bg-kp-accent-hover text-white shadow-kp-card hover:shadow-kp-glow transition-all duration-200"
            >
              {isTr ? 'Ücretsiz Deneyin' : 'Start Free Trial'}
            </Link>
            <Link
              href="#features"
              className="px-6 py-3 text-sm font-bold rounded-kp-sm bg-kp-bg-secondary border border-kp-border text-kp-text-primary hover:bg-kp-bg-hover transition-colors"
            >
              {isTr ? 'Özellikleri Keşfet' : 'Explore Features'}
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}

