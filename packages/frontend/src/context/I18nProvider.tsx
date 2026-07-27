'use client';

import { NextIntlClientProvider } from 'next-intl';
import useSWR from 'swr';
import { apiFetch } from '@/lib/api';
import { usePathname } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

const fetcher = (url: string) => apiFetch<any>(url);

// Import translation messages (15 regional dictionaries)
import tr from '../../messages/tr.json';
import pl from '../../messages/pl.json';
import cs from '../../messages/cs.json';
import de from '../../messages/de.json';
import el from '../../messages/el.json';
import fr from '../../messages/fr.json';
import it from '../../messages/it.json';
import ro from '../../messages/ro.json';
import zh from '../../messages/zh.json';
import enUS from '../../messages/en-US.json';
import enGB from '../../messages/en-GB.json';
import enIN from '../../messages/en-IN.json';
import esAR from '../../messages/es-AR.json';
import esMX from '../../messages/es-MX.json';
import ptBR from '../../messages/pt-BR.json';

/**
 * Only `tr` is fully populated; the other dictionaries carry a handful of
 * sections each. next-intl is handed one dictionary and errors on anything it
 * cannot resolve, so a locale is layered over `tr` and then `en-US` rather than
 * used on its own. A key missing from, say, `de` resolves to the English string
 * if one exists and to Turkish otherwise — which is what those screens already
 * rendered before they were migrated to message keys.
 */
function deepMerge(base: any, override: any): any {
  if (!override) return base;
  const merged: Record<string, any> = { ...base };
  for (const [key, value] of Object.entries(override)) {
    const existing = merged[key];
    const bothPlainObjects =
      value && typeof value === 'object' && !Array.isArray(value) &&
      existing && typeof existing === 'object' && !Array.isArray(existing);
    merged[key] = bothPlainObjects ? deepMerge(existing, value) : value;
  }
  return merged;
}

const messagesMap: Record<string, any> = {
  tr,
  pl,
  cs,
  de,
  el,
  fr,
  it,
  ro,
  zh,
  'en-US': enUS,
  'en-GB': enGB,
  'en-IN': enIN,
  'es-AR': esAR,
  'es-MX': esMX,
  'pt-BR': ptBR,
};

// Bare base codes coming from storage/backend map to a default regional variant
const baseLocaleDefaults: Record<string, string> = {
  en: 'en-US',
  es: 'es-MX',
  pt: 'pt-BR',
};

/**
 * Resolve a raw locale value (e.g. 'en-GB', 'en', 'es-ar', 'tr') to one of
 * the 15 dictionary keys. Falls back to 'en-US' when nothing matches.
 */
function resolveLocale(rawLocale: string): string {
  if (!rawLocale) return 'en-US';
  // 1) Exact match (normalize casing: 'en-gb' -> 'en-GB')
  const [base, region] = rawLocale.split('-');
  const normalized = region ? `${base.toLowerCase()}-${region.toUpperCase()}` : base.toLowerCase();
  if (messagesMap[normalized]) return normalized;
  // 2) Bare base code -> default regional variant (en -> en-US)
  const baseCode = base.toLowerCase();
  if (baseLocaleDefaults[baseCode]) return baseLocaleDefaults[baseCode];
  // 3) Base dictionary exists (e.g. 'de-AT' -> 'de')
  if (messagesMap[baseCode]) return baseCode;
  // 4) Ultimate fallback
  return 'en-US';
}

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

  // Resolve to one of the 15 dictionaries (exact variant first, then defaults)
  const activeLocale = resolveLocale(rawLocale);
  const messages = useMemo(
    () => deepMerge(deepMerge(tr, enUS), messagesMap[activeLocale]),
    [activeLocale]
  );

  return (
    <NextIntlClientProvider locale={activeLocale} messages={messages} timeZone="UTC">
      {children}
    </NextIntlClientProvider>
  );
}
