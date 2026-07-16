'use client';

import { NextIntlClientProvider } from 'next-intl';
import useSWR from 'swr';
import { apiFetch } from '@/lib/api';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

const fetcher = (url: string) => apiFetch<any>(url);

// Import translation messages
import tr from '../../messages/tr.json';
import en from '../../messages/en.json';

const messagesMap: Record<string, any> = {
  tr,
  en,
};

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAuthPage = pathname ? pathname.startsWith('/auth') : false;
  
  const [fallbackLocale, setFallbackLocale] = useState('tr');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const browserLang = navigator.language.startsWith('tr') ? 'tr' : 'en';
      const saved = localStorage.getItem('default_language') || browserLang;
      setFallbackLocale(saved);
    }
  }, []);

  // Only fetch system settings if the user is not on the login/register auth pages
  const { data: settings } = useSWR<any>(
    isAuthPage ? null : '/system/settings',
    fetcher,
    {
      shouldRetryOnError: false,
      revalidateOnFocus: false,
    }
  );

  // Extract the language, defaulting to Turkish/English or fallback
  const rawLocale = settings?.defaultLanguage || fallbackLocale;
  
  // Normalize locale: if 'en-GB', 'en-US' etc., map to 'en'. If 'tr', map to 'tr'.
  const baseLocale = rawLocale.split('-')[0];
  const locale = messagesMap[baseLocale] ? baseLocale : 'en';
  
  // Fallback to English messages if not found
  const messages = messagesMap[locale] || en;

  return (
    <NextIntlClientProvider locale={locale} messages={messages} timeZone="UTC">
      {children}
    </NextIntlClientProvider>
  );
}
