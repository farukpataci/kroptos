'use client';

import { useState, useEffect, useRef } from 'react';
import { ChevronDownIcon } from '@heroicons/react/20/solid';
import { useLocale } from 'next-intl';

interface Language {
  code: string;       // Locale code (e.g. 'en-GB')
  flagCode: string;   // flagcdn country code (e.g. 'gb')
  name: string;       // Native name
  descTr: string;     // Turkish description
  descEn: string;     // English description
}

const LANGUAGES: Language[] = [
  { code: 'tr', flagCode: 'tr', name: 'Türkçe', descTr: 'Türkçe', descEn: 'Turkish' },
  { code: 'pl', flagCode: 'pl', name: 'Polski', descTr: 'Lehçe', descEn: 'Polish' },
  { code: 'en-US', flagCode: 'us', name: 'English (US)', descTr: 'İngilizce (ABD)', descEn: 'US English' },
  { code: 'en-GB', flagCode: 'gb', name: 'English (GB)', descTr: 'İngilizce (İngiltere)', descEn: 'UK English' },
  { code: 'en-IN', flagCode: 'in', name: 'English (IN)', descTr: 'İngilizce (Hindistan)', descEn: 'Indian English' },
  { code: 'cs', flagCode: 'cz', name: 'Čeština', descTr: 'Çekçe', descEn: 'Czech' },
  { code: 'de', flagCode: 'de', name: 'Deutsch', descTr: 'Almanca', descEn: 'German' },
  { code: 'el', flagCode: 'gr', name: 'Ελληνικά', descTr: 'Yunanca', descEn: 'Greek' },
  { code: 'es-AR', flagCode: 'ar', name: 'Español (AR)', descTr: 'İspanyolca (Arjantin)', descEn: 'Argentine Spanish' },
  { code: 'es-MX', flagCode: 'mx', name: 'Español (MX)', descTr: 'İspanyolca (Meksika)', descEn: 'Mexican Spanish' },
  { code: 'fr', flagCode: 'fr', name: 'Français', descTr: 'Fransızca', descEn: 'French' },
  { code: 'it', flagCode: 'it', name: 'Italiano', descTr: 'İtalyanca', descEn: 'Italian' },
  { code: 'pt-BR', flagCode: 'br', name: 'Português (BR)', descTr: 'Portekizce (Brezilya)', descEn: 'Brazilian Portuguese' },
  { code: 'ro', flagCode: 'ro', name: 'Română', descTr: 'Romence', descEn: 'Romanian' },
  { code: 'zh', flagCode: 'cn', name: '中文', descTr: 'Çince', descEn: 'Chinese' }
];

export default function LanguageSwitcher() {
  const [currentLangCode, setCurrentLangCode] = useState('tr');
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  const activeLocale = useLocale();
  const isTr = activeLocale === 'tr';

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
    <div className="relative inline-block text-left h-full" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        type="button"
        className={`flex items-center gap-1.5 px-3 py-2 rounded-kp-sm text-sm font-semibold transition-all duration-200 ${
          isOpen
            ? 'text-kp-text-primary bg-kp-bg-active'
            : 'text-kp-text-secondary hover:text-kp-text-primary hover:bg-kp-bg-hover'
        }`}
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        <span className="flex items-center gap-1.5">
          <img 
            src={`https://flagcdn.com/24x18/${activeLang.flagCode}.png`} 
            className="h-3 w-4.5 object-cover rounded-sm border border-black/10 flex-shrink-0" 
            alt={activeLang.name} 
          />
          {activeLang.name}
        </span>
        <ChevronDownIcon className={`h-4 w-4 text-kp-text-tertiary transition-transform duration-200 ${isOpen ? 'rotate-180 text-kp-accent' : ''}`} aria-hidden="true" />
      </button>

      {isOpen && (
        <div className="absolute right-0 z-50 mt-2 w-72 sm:w-[580px] origin-top-right rounded-kp-md bg-kp-bg-secondary border border-kp-border p-4 shadow-kp-dropdown focus:outline-none backdrop-blur-md animate-scale-in">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
            {LANGUAGES.map((lang) => {
              const desc = isTr ? lang.descTr : lang.descEn;
              return (
                <button
                  key={lang.code}
                  onClick={() => handleLangChange(lang)}
                  className={`group flex gap-4 p-2.5 rounded-kp-md transition-all duration-200 text-left ${
                    currentLangCode === lang.code
                      ? 'bg-kp-accent/10'
                      : 'hover:bg-kp-bg-hover'
                  }`}
                >
                  {/* Flag container matching Resources icon style */}
                  <div className="flex-shrink-0 h-10 w-10 flex items-center justify-center rounded-kp-sm bg-kp-bg-tertiary border border-kp-border-subtle group-hover:border-kp-border-accent group-hover:bg-kp-accent-muted transition-all">
                    <img 
                      src={`https://flagcdn.com/24x18/${lang.flagCode}.png`} 
                      className="h-3.5 w-5 object-cover rounded-sm border border-black/10 flex-shrink-0" 
                      alt={lang.name} 
                    />
                  </div>
                  {/* Text details matching Resources details style */}
                  <div className="space-y-0.5">
                    <p className={`text-sm font-semibold transition-colors ${
                      currentLangCode === lang.code ? 'text-kp-accent' : 'text-kp-text-primary group-hover:text-kp-accent'
                    }`}>
                      {lang.name}
                    </p>
                    <p className="text-xs text-kp-text-tertiary leading-normal line-clamp-1">
                      {desc}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
