'use client';

import { useState, useEffect } from 'react';
import NextLink from 'next/link';
import { useTranslations } from 'next-intl';
import { Bars3Icon } from '@heroicons/react/24/outline';
import { useTheme } from '@/context/ThemeContext';
import AnnouncementBar from './AnnouncementBar';
import DesktopNavigation from './DesktopNavigation';
import MobileNavigationDrawer from './MobileNavigationDrawer';
import NavCTAButtons from './NavCTAButtons';
import LanguageSwitcher from './LanguageSwitcher';

export default function Navbar() {
  const t = useTranslations('marketing.nav');
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [hasAnnouncement, setHasAnnouncement] = useState(true);
  const { theme, toggleTheme } = useTheme();

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 20) {
        setIsScrolled(true);
      } else {
        setIsScrolled(false);
      }
    };

    window.addEventListener('scroll', handleScroll);
    handleScroll(); // Check initially

    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleAnnouncementClose = () => {
    setHasAnnouncement(false);
  };

  return (
    <>
      <div className="fixed top-0 left-0 right-0 z-50 flex flex-col">
        {/* 1. Announcement Bar */}
        <AnnouncementBar onClose={handleAnnouncementClose} />

        {/* 2. Main Navigation Bar */}
        <header
          className={`w-full transition-all duration-300 ${
            isScrolled
              ? 'bg-kp-bg-secondary/90 border-b border-kp-border shadow-kp-card text-kp-text-primary backdrop-blur-md py-3 h-[72px] sm:h-[76px]'
              : 'bg-transparent border-b border-transparent py-4 h-[76px] sm:h-[84px] text-kp-text-primary'
          }`}
        >
          <div className="max-w-[1440px] mx-auto h-full px-4 sm:px-6 lg:px-8 flex items-center justify-between">
            
            {/* Logo */}
            <div className="flex items-center gap-3">
              <NextLink href="/" className="flex items-center gap-2.5 group">
                <span className="text-xl font-extrabold tracking-tight text-kp-text-primary">
                  Alqora
                </span>
              </NextLink>
            </div>

            {/* Desktop Navigation Links */}
            <DesktopNavigation />

            {/* Right Action buttons */}
            <div className="hidden lg:flex items-center gap-4">
              <button
                onClick={toggleTheme}
                className="rounded-kp-sm p-2 text-kp-text-tertiary transition-colors hover:bg-kp-bg-hover hover:text-kp-text-primary"
                title={t('toggleTheme')}
              >
                {theme === 'dark' ? '☀️' : '🌙'}
              </button>
              <NavCTAButtons showLanguageSwitcher={true} />
            </div>

            {/* Mobile Actions (Language Switcher, Theme Switcher & Hamburger) */}
            <div className="flex lg:hidden items-center gap-2">
              <button
                onClick={toggleTheme}
                className="rounded-kp-sm p-1.5 text-kp-text-tertiary transition-colors hover:bg-kp-bg-hover hover:text-kp-text-primary"
                title={t('toggleTheme')}
              >
                {theme === 'dark' ? '☀️' : '🌙'}
              </button>
              <LanguageSwitcher />
              
              <button
                onClick={() => setIsMobileMenuOpen(true)}
                type="button"
                className="inline-flex items-center justify-center p-2 rounded-kp-sm text-kp-text-tertiary hover:text-kp-text-primary hover:bg-kp-bg-hover focus:outline-none focus:ring-2 focus:ring-inset focus:ring-kp-accent transition-colors"
                aria-controls="mobile-menu"
                aria-expanded={isMobileMenuOpen}
              >
                <span className="sr-only">{t('openMenu')}</span>
                <Bars3Icon className="h-6 w-6" aria-hidden="true" />
              </button>
            </div>

          </div>
        </header>
      </div>

      {/* 3. Mobile Navigation Drawer */}
      <MobileNavigationDrawer
        isOpen={isMobileMenuOpen}
        onClose={() => setIsMobileMenuOpen(false)}
      />
    </>
  );
}
