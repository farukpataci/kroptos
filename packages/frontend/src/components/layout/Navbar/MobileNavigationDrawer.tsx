'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { XMarkIcon, ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/24/outline';
import NavCTAButtons from './NavCTAButtons';

interface MobileNavigationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function MobileNavigationDrawer({ isOpen, onClose }: MobileNavigationDrawerProps) {
  const t = useTranslations('marketing.mobileNav');

  const [activeAccordion, setActiveAccordion] = useState<string | null>(null);

  // Body scroll lock
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const toggleAccordion = (name: string) => {
    setActiveAccordion(activeAccordion === name ? null : name);
  };

  if (!isOpen) return null;

  const data = {
    features: {
      title: t('features.title'),
      sections: [
        {
          group: t('features.operations.title'),
          items: [
            t('features.operations.orders'),
            t('features.operations.catalog'),
            t('features.operations.stock'),
            t('features.operations.pricing')
          ]
        },
        {
          group: t('features.logistics.title'),
          items: [
            t('features.logistics.wms'),
            t('features.logistics.shipping'),
            t('features.logistics.returns'),
            t('features.logistics.labels')
          ]
        },
        {
          group: t('features.automation.title'),
          items: [
            t('features.automation.workflow'),
            t('features.automation.ai'),
            t('features.automation.analytics'),
            t('features.automation.b2b')
          ]
        }
      ]
    },
    solutions: {
      title: t('solutions.title'),
      sections: [
        {
          group: t('solutions.bySize.title'),
          items: [
            t('solutions.bySize.startup'),
            t('solutions.bySize.growing'),
            t('solutions.bySize.omnichannel'),
            t('solutions.bySize.enterprise')
          ]
        },
        {
          group: t('solutions.byModel.title'),
          items: [
            t('solutions.byModel.marketplaceSellers'),
            t('solutions.byModel.ownSite'),
            t('solutions.byModel.b2bWholesale'),
            t('solutions.byModel.fulfillment')
          ]
        }
      ]
    },
    resources: {
      title: t('resources.title'),
      sections: [
        {
          group: t('resources.learn.title'),
          items: [
            t('resources.learn.helpCenter'),
            t('resources.learn.academy'),
            t('resources.learn.blog'),
            t('resources.learn.apiDocs')
          ]
        },
        {
          group: t('resources.services.title'),
          items: [
            t('resources.services.setup'),
            t('resources.services.consulting'),
            t('resources.services.support')
          ]
        }
      ]
    }
  };

  return (
    <div className="fixed inset-0 z-50 lg:hidden">
      {/* Dark Overlay backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300"
      />

      {/* Drawer Container */}
      <div className="fixed inset-y-0 right-0 z-50 w-full max-w-sm bg-kp-bg-secondary border-l border-kp-border flex flex-col shadow-kp-elevated p-6 overflow-y-auto">

        {/* Drawer Header */}
        <div className="flex items-center justify-between pb-6 border-b border-kp-border">
          <div className="flex items-center gap-2">
            <span className="text-base font-extrabold tracking-tight text-kp-text-primary">
              Alqora
            </span>
          </div>
          <button
            onClick={onClose}
            type="button"
            className="rounded-kp-sm p-1.5 text-kp-text-tertiary hover:text-kp-text-primary hover:bg-kp-bg-hover transition-colors"
            aria-label={t('close')}
          >
            <XMarkIcon className="h-5.5 w-5.5" />
          </button>
        </div>

        {/* Navigation Accordions List */}
        <div className="flex-1 py-6 space-y-3">

          {/* Platform Özellikleri (Accordion) */}
          <div className="border-b border-kp-border pb-3">
            <button
              onClick={() => toggleAccordion('features')}
              className="flex w-full items-center justify-between py-2 text-sm font-semibold text-kp-text-primary hover:text-kp-accent"
            >
              <span>{data.features.title}</span>
              {activeAccordion === 'features' ? (
                <ChevronUpIcon className="h-4 w-4 text-kp-accent" />
              ) : (
                <ChevronDownIcon className="h-4 w-4 text-kp-text-tertiary" />
              )}
            </button>
            {activeAccordion === 'features' && (
              <div className="pl-3 mt-2 space-y-4 animate-fade-in">
                {data.features.sections.map((sec, idx) => (
                  <div key={idx} className="space-y-1.5">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-kp-text-tertiary">{sec.group}</p>
                    <ul className="space-y-1">
                      {sec.items.map((item, i) => (
                        <li key={i}>
                          <Link
                            onClick={onClose}
                            href={`#feature-${i}`}
                            className="text-xs text-kp-text-secondary hover:text-kp-accent py-1 block transition-colors"
                          >
                            • {item}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Çözümler (Accordion) */}
          <div className="border-b border-kp-border pb-3">
            <button
              onClick={() => toggleAccordion('solutions')}
              className="flex w-full items-center justify-between py-2 text-sm font-semibold text-kp-text-primary hover:text-kp-accent"
            >
              <span>{data.solutions.title}</span>
              {activeAccordion === 'solutions' ? (
                <ChevronUpIcon className="h-4 w-4 text-kp-accent" />
              ) : (
                <ChevronDownIcon className="h-4 w-4 text-kp-text-tertiary" />
              )}
            </button>
            {activeAccordion === 'solutions' && (
              <div className="pl-3 mt-2 space-y-4 animate-fade-in">
                {data.solutions.sections.map((sec, idx) => (
                  <div key={idx} className="space-y-1.5">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-kp-text-tertiary">{sec.group}</p>
                    <ul className="space-y-1">
                      {sec.items.map((item, i) => (
                        <li key={i}>
                          <Link
                            onClick={onClose}
                            href={`#solutions-${i}`}
                            className="text-xs text-kp-text-secondary hover:text-kp-accent py-1 block transition-colors"
                          >
                            • {item}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Entegrasyonlar (Direct link) */}
          <div className="border-b border-kp-border pb-3">
            <Link
              onClick={onClose}
              href="/integrations"
              className="flex w-full items-center justify-between py-2 text-sm font-semibold text-kp-text-primary hover:text-kp-accent"
            >
              <span>{t('integrations')}</span>
            </Link>
          </div>

          {/* Fiyatlandırma (Direct link) */}
          <div className="border-b border-kp-border pb-3">
            <Link
              onClick={onClose}
              href="/pricing"
              className="flex w-full py-2 text-sm font-semibold text-kp-text-primary hover:text-kp-accent"
            >
              {t('pricing')}
            </Link>
          </div>

          {/* Kaynaklar (Accordion) */}
          <div className="border-b border-kp-border pb-3">
            <button
              onClick={() => toggleAccordion('resources')}
              className="flex w-full items-center justify-between py-2 text-sm font-semibold text-kp-text-primary hover:text-kp-accent"
            >
              <span>{data.resources.title}</span>
              {activeAccordion === 'resources' ? (
                <ChevronUpIcon className="h-4 w-4 text-kp-accent" />
              ) : (
                <ChevronDownIcon className="h-4 w-4 text-kp-text-tertiary" />
              )}
            </button>
            {activeAccordion === 'resources' && (
              <div className="pl-3 mt-2 space-y-4 animate-fade-in">
                {data.resources.sections.map((sec, idx) => (
                  <div key={idx} className="space-y-1.5">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-kp-text-tertiary">{sec.group}</p>
                    <ul className="space-y-1">
                      {sec.items.map((item, i) => (
                        <li key={i}>
                          <Link
                            onClick={onClose}
                            href={`#resource-${i}`}
                            className="text-xs text-kp-text-secondary hover:text-kp-accent py-1 block transition-colors"
                          >
                            • {item}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

        {/* Drawer Footer Buttons */}
        <div className="pt-6 border-t border-kp-border space-y-4">
          <NavCTAButtons
            className="flex-col w-full !gap-3 *:w-full *:text-center"
            showLanguageSwitcher={true}
          />
        </div>
      </div>
    </div>
  );
}
