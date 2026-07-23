'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { ChevronDownIcon } from '@heroicons/react/20/solid';
import { PlatformFeaturesMenu, SolutionsMenu, ResourcesMenu } from './MegaMenu';

type MenuType = 'features' | 'solutions' | 'resources' | null;

export default function DesktopNavigation() {
  const t = useTranslations('marketing.nav');

  const [activeMenu, setActiveMenu] = useState<MenuType>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Close menu helper
  const closeMenu = () => {
    setActiveMenu(null);
  };

  // Keyboard navigation: Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeMenu();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Outside click logic
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        closeMenu();
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  // Hover delay logic for smooth transition
  const handleMouseEnter = (menu: MenuType) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setActiveMenu(menu);
  };

  const handleMouseLeave = () => {
    timeoutRef.current = setTimeout(() => {
      closeMenu();
    }, 200); // 200ms grace period
  };

  const handleToggle = (menu: MenuType) => {
    if (activeMenu === menu) {
      closeMenu();
    } else {
      setActiveMenu(menu);
    }
  };

  const navLabels = {
    features: t('features'),
    solutions: t('solutions'),
    integrations: t('integrations'),
    pricing: t('pricing'),
    resources: t('resources'),
    integrationsBadge: t('integrationsBadge')
  };

  return (
    <div ref={containerRef} className="hidden lg:flex items-center gap-1.5 h-full">
      {/* 1. Platform Özellikleri (Mega Menu) */}
      <div
        className="relative h-full flex items-center"
        onMouseEnter={() => handleMouseEnter('features')}
        onMouseLeave={handleMouseLeave}
      >
        <button
          onClick={() => handleToggle('features')}
          aria-expanded={activeMenu === 'features'}
          aria-controls="features-mega-menu"
          aria-haspopup="true"
          className={`flex items-center gap-1 px-4 py-2 rounded-kp-sm text-sm font-semibold transition-all duration-200 ${
            activeMenu === 'features'
              ? 'text-kp-text-primary bg-kp-bg-active'
              : 'text-kp-text-secondary hover:text-kp-text-primary hover:bg-kp-bg-hover'
          }`}
        >
          <span>{navLabels.features}</span>
          <ChevronDownIcon
            className={`h-4 w-4 text-kp-text-tertiary transition-transform duration-200 ${
              activeMenu === 'features' ? 'rotate-180 text-kp-accent' : ''
            }`}
          />
        </button>

        {activeMenu === 'features' && (
          <div
            id="features-mega-menu"
            role="menu"
            className="absolute top-[calc(100%-8px)] left-1/2 -translate-x-1/2 z-50 w-[960px] max-w-[90vw] overflow-hidden rounded-kp-lg bg-kp-bg-secondary border border-kp-border shadow-kp-dropdown animate-fade-in-up"
            onMouseEnter={() => handleMouseEnter('features')}
            onMouseLeave={handleMouseLeave}
          >
            <PlatformFeaturesMenu />
          </div>
        )}
      </div>

      {/* 2. Çözümler (Mega Menu) */}
      <div
        className="relative h-full flex items-center"
        onMouseEnter={() => handleMouseEnter('solutions')}
        onMouseLeave={handleMouseLeave}
      >
        <button
          onClick={() => handleToggle('solutions')}
          aria-expanded={activeMenu === 'solutions'}
          aria-controls="solutions-mega-menu"
          aria-haspopup="true"
          className={`flex items-center gap-1 px-4 py-2 rounded-kp-sm text-sm font-semibold transition-all duration-200 ${
            activeMenu === 'solutions'
              ? 'text-kp-text-primary bg-kp-bg-active'
              : 'text-kp-text-secondary hover:text-kp-text-primary hover:bg-kp-bg-hover'
          }`}
        >
          <span>{navLabels.solutions}</span>
          <ChevronDownIcon
            className={`h-4 w-4 text-kp-text-tertiary transition-transform duration-200 ${
              activeMenu === 'solutions' ? 'rotate-180 text-kp-accent' : ''
            }`}
          />
        </button>

        {activeMenu === 'solutions' && (
          <div
            id="solutions-mega-menu"
            role="menu"
            className="absolute top-[calc(100%-8px)] left-1/2 -translate-x-1/2 z-50 w-[840px] max-w-[90vw] overflow-hidden rounded-kp-lg bg-kp-bg-secondary border border-kp-border shadow-kp-dropdown animate-fade-in-up"
            onMouseEnter={() => handleMouseEnter('solutions')}
            onMouseLeave={handleMouseLeave}
          >
            <SolutionsMenu />
          </div>
        )}
      </div>

      {/* 3. Entegrasyonlar (Direct Link) */}
      <div className="h-full flex items-center">
        <Link
          href="/integrations"
          className="flex items-center gap-2 px-4 py-2 rounded-kp-sm text-sm font-semibold text-kp-text-secondary hover:text-kp-text-primary hover:bg-kp-bg-hover transition-all duration-200 group relative"
        >
          <span>{navLabels.integrations}</span>
          <span className="absolute bottom-0 left-4 right-4 h-0.5 bg-kp-accent scale-x-0 group-hover:scale-x-100 transition-transform duration-200 origin-left" />
        </Link>
      </div>

      {/* 4. Fiyatlandırma (Direct Link) */}
      <div className="h-full flex items-center">
        <Link
          href="/pricing"
          className="flex items-center gap-1 px-4 py-2 rounded-kp-sm text-sm font-semibold text-kp-text-secondary hover:text-kp-text-primary hover:bg-kp-bg-hover transition-all duration-200 group relative"
        >
          <span>{navLabels.pricing}</span>
          <span className="absolute bottom-0 left-4 right-4 h-0.5 bg-kp-accent scale-x-0 group-hover:scale-x-100 transition-transform duration-200 origin-left" />
        </Link>
      </div>

      {/* 5. Kaynaklar (Mega Menu) */}
      <div
        className="relative h-full flex items-center"
        onMouseEnter={() => handleMouseEnter('resources')}
        onMouseLeave={handleMouseLeave}
      >
        <button
          onClick={() => handleToggle('resources')}
          aria-expanded={activeMenu === 'resources'}
          aria-controls="resources-mega-menu"
          aria-haspopup="true"
          className={`flex items-center gap-1 px-4 py-2 rounded-kp-sm text-sm font-semibold transition-all duration-200 ${
            activeMenu === 'resources'
              ? 'text-kp-text-primary bg-kp-bg-active'
              : 'text-kp-text-secondary hover:text-kp-text-primary hover:bg-kp-bg-hover'
          }`}
        >
          <span>{navLabels.resources}</span>
          <ChevronDownIcon
            className={`h-4 w-4 text-kp-text-tertiary transition-transform duration-200 ${
              activeMenu === 'resources' ? 'rotate-180 text-kp-accent' : ''
            }`}
          />
        </button>

        {activeMenu === 'resources' && (
          <div
            id="resources-mega-menu"
            role="menu"
            className="absolute top-[calc(100%-8px)] left-1/2 -translate-x-1/2 z-50 w-[720px] max-w-[90vw] overflow-hidden rounded-kp-lg bg-kp-bg-secondary border border-kp-border shadow-kp-dropdown animate-fade-in-up"
            onMouseEnter={() => handleMouseEnter('resources')}
            onMouseLeave={handleMouseLeave}
          >
            <ResourcesMenu />
          </div>
        )}
      </div>
    </div>
  );
}
