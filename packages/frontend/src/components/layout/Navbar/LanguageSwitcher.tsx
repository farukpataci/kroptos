'use client';

import { useState, useEffect, useRef } from 'react';
import { ChevronDownIcon } from '@heroicons/react/20/solid';

export default function LanguageSwitcher() {
  const [currentLang, setCurrentLang] = useState('tr');
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const pathname = window.location.pathname;
      const segments = pathname.split('/').filter(Boolean);
      let urlLocale = '';
      if (segments.length > 0) {
        const firstSegment = segments[0];
        if (firstSegment.length === 2 || (firstSegment.length === 5 && firstSegment.includes('-'))) {
          urlLocale = firstSegment;
        }
      }
      const browserLang = navigator.language.startsWith('tr') ? 'tr' : 'en';
      const saved = urlLocale || localStorage.getItem('default_language') || browserLang;
      setCurrentLang(saved.split('-')[0] === 'tr' ? 'tr' : 'en');
    }
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLangChange = (lang: string) => {
    if (lang !== currentLang) {
      localStorage.setItem('default_language', lang);
      setCurrentLang(lang);
      
      if (typeof window !== 'undefined') {
        const currentPathname = window.location.pathname;
        const segments = currentPathname.split('/').filter(Boolean);
        
        // Determine if they are on a marketing/home route
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
              segments[0] = lang;
              window.location.href = '/' + segments.join('/') + window.location.search;
              return;
            }
          }
          // Redirect to path-based locale
          window.location.href = '/' + lang + (currentPathname === '/' ? '' : currentPathname) + window.location.search;
          return;
        }
        
        // For dashboard/app pages, reload to apply locale settings
        window.location.reload();
      }
    }
    setIsOpen(false);
  };

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        type="button"
        className="inline-flex items-center gap-x-1.5 rounded-kp-sm px-2.5 py-1.5 text-xs font-semibold text-kp-text-tertiary hover:text-kp-text-primary hover:bg-kp-bg-hover transition-all duration-200"
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        <span className="uppercase">{currentLang}</span>
        <ChevronDownIcon className="h-4 w-4 text-kp-text-tertiary transition-transform duration-200" aria-hidden="true" />
      </button>

      {isOpen && (
        <div className="absolute right-0 z-50 mt-1.5 w-28 origin-top-right rounded-kp-md bg-kp-bg-secondary border border-kp-border p-1 shadow-kp-dropdown focus:outline-none backdrop-blur-md animate-scale-in">
          <button
            onClick={() => handleLangChange('tr')}
            className={`flex w-full items-center px-3 py-2 text-xs rounded-kp-sm transition-colors ${
              currentLang === 'tr'
                ? 'bg-kp-accent/15 text-kp-accent font-semibold'
                : 'text-kp-text-secondary hover:bg-kp-bg-hover hover:text-kp-text-primary'
            }`}
          >
            Türkçe (TR)
          </button>
          <button
            onClick={() => handleLangChange('en')}
            className={`flex w-full items-center px-3 py-2 text-xs rounded-kp-sm transition-colors ${
              currentLang === 'en'
                ? 'bg-kp-accent/15 text-kp-accent font-semibold'
                : 'text-kp-text-secondary hover:bg-kp-bg-hover hover:text-kp-text-primary'
            }`}
          >
            English (EN)
          </button>
        </div>
      )}
    </div>
  );
}
