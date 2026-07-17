'use client';

import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { useLocale } from 'next-intl';
import LanguageSwitcher from './LanguageSwitcher';

interface NavCTAButtonsProps {
  className?: string;
  showLanguageSwitcher?: boolean;
}

export default function NavCTAButtons({ className = '', showLanguageSwitcher = true }: NavCTAButtonsProps) {
  const { isAuthenticated } = useAuth();
  const locale = useLocale();

  const isTr = locale === 'tr';

  const loginText = isTr ? 'Giriş Yap' : 'Log In';
  const registerText = isTr ? 'Ücretsiz Başla' : 'Get Started';

  return (
    <div className={`flex items-center gap-4 ${className}`}>
      {showLanguageSwitcher && <LanguageSwitcher />}

      <Link
        href={isAuthenticated ? '/select-tenant' : '/auth/login'}
        className="text-sm font-semibold text-kp-text-secondary hover:text-kp-text-primary transition-colors duration-200 px-3 py-1.5 rounded-kp-sm hover:bg-kp-bg-hover"
      >
        {loginText}
      </Link>

      <Link
        href={isAuthenticated ? '/select-tenant' : '/auth/login'}
        className="inline-flex items-center justify-center text-sm font-semibold tracking-wide rounded-kp-sm px-4 py-2 bg-kp-accent hover:bg-kp-accent-hover text-white shadow-kp-card hover:shadow-kp-glow transition-all duration-200 active:scale-95"
      >
        {registerText}
      </Link>
    </div>
  );
}
