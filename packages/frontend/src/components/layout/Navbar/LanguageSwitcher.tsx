'use client';

import { useState, useEffect, useRef } from 'react';
import { ChevronDownIcon } from '@heroicons/react/20/solid';

interface Language {
  code: string;       // Locale code (e.g. 'en-GB')
  flagCode: string;   // flagcdn country code (e.g. 'gb')
  name: string;       // Native name
}

const LANGUAGES: Language[] = [
  { code: 'tr', flagCode: 'tr', name: 'Türkçe' },
  { code: 'pl', flagCode: 'pl', name: 'Polski' },
  { code: 'en-US', flagCode: 'us', name: 'English (US)' },
  { code: 'en-GB', flagCode: 'gb', name: 'English (GB)' },
  { code: 'en-IN', flagCode: 'in', name: 'English (IN)' },
  { code: 'cs', flagCode: 'cz', name: 'Čeština' },
  { code: 'de', flagCode: 'de', name: 'Deutsch' },
  { code: 'el', flagCode: 'gr', name: 'Ελληνικά' },
  { code: 'es-AR', flagCode: 'ar', name: 'Español (AR)' },
  { code: 'es-MX', flagCode: 'mx', name: 'Español (MX)' },
  { code: 'fr', flagCode: 'fr', name: 'Français' },
  { code: 'it', flagCode: 'it', name: 'Italiano' },
  { code: 'pt-BR', flagCode: 'br', name: 'Português (BR)' },
  { code: 'ro', flagCode: 'ro', name: 'Română' },
  { code: 'zh', flagCode: 'cn', name: '中文' }
];

// Custom Language/Translation box icon matching the user's reference image
function LanguageBoxIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="16" rx="2.5" />
      <path d="M7 15l2.5-5.5L12 15M8 13.5h3" />
      <path d="M14.5 9.5h3M16 9.5v5.5M14.5 15h3" />
    </svg>
  );
}

export default function LanguageSwitcher() {
  const [currentLangCode, setCurrentLangCode] = useState('tr');
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Sync current language with URL prefix or localStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const pathname = window.location.pathname;
      const segments = pathname.split('/').filter(Boolean);
      let urlLocale = '';
      if (segments.length > 0) {
        const firstSegment = segments[0];
        // Match 2-char or 5-char locale pattern
        if (firstSegment.length === 2 || (firstSegment.length === 5 && firstSegment.includes('-'))) {
          urlLocale = firstSegment;
        }
      }
      const browserLang = navigator.language.startsWith('tr') ? 'tr' : 'en';
      const saved = urlLocale || localStorage.getItem('default_language') || browserLang;
      
      // Try to find matching config language, otherwise match base lang
      const matched = LANGUAGES.find(l => l.code.toLowerCase() === saved.toLowerCase()) || 
                      LANGUAGES.find(l => l.code.split('-')[0] === saved.split('-')[0]) || 
                      LANGUAGES[0];
      setCurrentLangCode(matched.code);
    }
  }, []);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLangChange = (lang: Language) => {
    if (lang.code !== currentLangCode) {
      localStorage.setItem('default_language', lang.code);
      setCurrentLangCode(lang.code);
      
      if (typeof window !== 'undefined') {
        const currentPathname = window.location.pathname;
        const segments = currentPathname.split('/').filter(Boolean);
        
        // Determine if we are on a marketing/home route
        const isMarketingPage = 
          currentPathname === '/' || 
          currentPathname === '/home' ||
          (segments.length > 0 && (
            segments[0].length === 2 || 
            (segments[0].length === 5 && segments[0].includes('-'))
          ));

        if (isMarketingPage) {
          if (segments.length > 0) {
            const firstSegment = segments[0];
            if (firstSegment.length === 2 || (firstSegment.length === 5 && firstSegment.includes('-'))) {
              segments[0] = lang.code;
              window.location.href = '/' + segments.join('/') + window.location.search;
              return;
            }
          }
          // Redirect to path-based locale
          window.location.href = '/' + lang.code + (currentPathname === '/' ? '' : currentPathname) + window.location.search;
          return;
        }
        
        // For dashboard/app pages, reload to apply locale settings
        window.location.reload();
      }
    }
    setIsOpen(false);
  };

  const activeLang = LANGUAGES.find(l => l.code === currentLangCode) || LANGUAGES[0];

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        type="button"
        className="inline-flex items-center gap-x-2 rounded-kp-sm border border-kp-border px-3 py-1.5 text-xs font-semibold bg-kp-bg-secondary text-kp-text-secondary hover:text-kp-text-primary hover:bg-kp-bg-hover transition-all duration-200 shadow-kp-card"
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        <LanguageBoxIcon className="h-4.5 w-4.5 text-kp-text-tertiary" />
        <span className="flex items-center gap-1.5">
          <img 
            src={`https://flagcdn.com/24x18/${activeLang.flagCode}.png`} 
            className="h-3 w-4.5 object-cover rounded-sm border border-black/10" 
            alt={activeLang.name} 
          />
          {activeLang.name}
        </span>
        <ChevronDownIcon className={`h-4 w-4 text-kp-text-tertiary transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>

      {isOpen && (
        <div className="absolute right-0 z-50 mt-2 w-72 sm:w-[480px] origin-top-right rounded-kp-md bg-kp-bg-secondary border border-kp-border p-3 shadow-kp-dropdown focus:outline-none backdrop-blur-md animate-scale-in">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1">
            {LANGUAGES.map((lang) => (
              <button
                key={lang.code}
                onClick={() => handleLangChange(lang)}
                className={`flex items-center gap-3 px-3 py-2 text-xs rounded-kp-sm transition-colors w-full text-left ${
                  currentLangCode === lang.code
                    ? 'bg-kp-accent/15 text-kp-accent font-semibold'
                    : 'text-kp-text-secondary hover:bg-kp-bg-hover hover:text-kp-text-primary'
                }`}
              >
                <img 
                  src={`https://flagcdn.com/24x18/${lang.flagCode}.png`} 
                  className="h-3.5 w-5 object-cover rounded-sm border border-black/10 flex-shrink-0" 
                  alt={lang.name} 
                />
                <span className="truncate">{lang.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
