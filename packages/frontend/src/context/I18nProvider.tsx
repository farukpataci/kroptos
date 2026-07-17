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
import pl from '../../messages/pl.json';
import cs from '../../messages/cs.json';
import de from '../../messages/de.json';
import el from '../../messages/el.json';
import es from '../../messages/es.json';
import fr from '../../messages/fr.json';
import it from '../../messages/it.json';
import pt from '../../messages/pt.json';
import ro from '../../messages/ro.json';
import zh from '../../messages/zh.json';

const messagesMap: Record<string, any> = {
  tr,
  en,
  pl,
  cs,
  de,
  el,
  es,
  fr,
  it,
  pt,
  ro,
  zh,
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

  // Extract URL locale if present (e.g. /en-GB/home or /tr/)
  let urlLocale = '';
  if (pathname) {
    const segments = pathname.split('/').filter(Boolean);
    if (segments.length > 0) {
      const firstSegment = segments[0];
      if (firstSegment.length === 2 || (firstSegment.length === 5 && firstSegment.includes('-'))) {
        urlLocale = firstSegment;
      }
    }
  }

  // Extract the language, defaulting to URL path parameter, system settings or fallback
  const rawLocale = urlLocale || settings?.defaultLanguage || fallbackLocale;
  
  // Normalize locale: if 'en-GB', 'en-US' etc., map to 'en'. If 'tr', map to 'tr'.
  const baseLocale = rawLocale.split('-')[0];
  const activeLocale = messagesMap[baseLocale] ? baseLocale : 'en';
  
  // Fallback to English messages if not found
  const messages = messagesMap[activeLocale] || en;

  return (
    <NextIntlClientProvider locale={rawLocale} messages={messages} timeZone="UTC">
      {children}
    </NextIntlClientProvider>
  );
}
