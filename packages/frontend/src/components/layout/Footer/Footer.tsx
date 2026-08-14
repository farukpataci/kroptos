'use client';

import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';

export default function Footer() {
  const locale = useLocale();
  const t = useTranslations('marketing.footer');

  const data = {
    bio: t('bio'),
    columns: [
      {
        title: t('columns.product.title'),
        links: [
          { label: t('columns.product.features'), href: `/${locale}#features` },
          { label: t('columns.product.integrations'), href: `/${locale}#integrations` },
          { label: t('columns.product.pricing'), href: `/${locale}#pricing` },
          { label: t('columns.product.workflowAutomation'), href: `/${locale}#features` }
        ]
      },
      {
        title: t('columns.industries.title'),
        links: [
          { label: t('columns.industries.homeAndGarden'), href: `/${locale}/industry/home-and-garden` },
          { label: t('columns.industries.fashionAndApparel'), href: `/${locale}/industry/fashion-and-apparel` },
          { label: t('columns.industries.cosmetics'), href: `/${locale}/industry/cosmetics-and-personal-care` },
          { label: t('columns.industries.electronics'), href: `/${locale}/industry/electronics` }
        ]
      },
      {
        title: t('columns.company.title'),
        links: [
          { label: t('columns.company.about'), href: `/${locale}` },
          { label: t('columns.company.contact'), href: `/${locale}#contact` },
          { label: t('columns.company.careers'), href: `/${locale}` },
          { label: t('columns.company.partnership'), href: `/${locale}` }
        ]
      },
      {
        title: t('columns.legal.title'),
        links: [
          { label: t('columns.legal.terms'), href: `/${locale}` },
          { label: t('columns.legal.privacy'), href: `/${locale}` },
          { label: t('columns.legal.kvkk'), href: `/${locale}` },
          { label: t('columns.legal.cookies'), href: `/${locale}` }
        ]
      }
    ]
  };

  return (
    <footer className="w-full bg-kp-bg-secondary border-t border-kp-border text-kp-text-primary py-12 sm:py-16 transition-colors duration-300">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        {/* Top Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
          {/* Logo & Bio Column */}
          <div className="lg:col-span-4 space-y-4 text-left">
            <Link href="/" className="flex items-center gap-2.5 group">
              <span className="text-2xl font-extrabold tracking-tight text-kp-text-primary">
                Alqora
              </span>
            </Link>
            <p className="text-xs sm:text-sm text-kp-text-secondary leading-relaxed max-w-sm">
              {data.bio}
            </p>
            {/* Social Icons */}
            <div className="flex items-center gap-4 pt-2">
              {/* LinkedIn */}
              <a href="https://linkedin.com" target="_blank" rel="noopener noreferrer" className="text-kp-text-tertiary hover:text-kp-accent transition-colors" aria-label="LinkedIn">
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/>
                </svg>
              </a>
              {/* X / Twitter */}
              <a href="https://x.com" target="_blank" rel="noopener noreferrer" className="text-kp-text-tertiary hover:text-kp-accent transition-colors" aria-label="X">
                <svg className="h-4.5 w-4.5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                </svg>
              </a>
              {/* YouTube */}
              <a href="https://youtube.com" target="_blank" rel="noopener noreferrer" className="text-kp-text-tertiary hover:text-kp-accent transition-colors" aria-label="YouTube">
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M23.498 6.163a3.003 3.003 0 0 0-2.11-2.11C19.518 3.545 12 3.545 12 3.545s-7.518 0-9.388.508a3.003 3.003 0 0 0-2.11 2.11C0 8.033 0 12 0 12s0 3.967.502 5.837a3.003 3.003 0 0 0 2.11 2.11c1.87.508 9.388.508 9.388.508s7.518 0 9.388-.508a3.003 3.003 0 0 0 2.11-2.11C24 15.967 24 12 24 12s0-3.967-.502-5.837zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                </svg>
              </a>
            </div>
          </div>

          {/* Links Columns Grid */}
          <div className="lg:col-span-8 grid grid-cols-2 sm:grid-cols-4 gap-8">
            {data.columns.map((col, idx) => (
              <div key={idx} className="space-y-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-kp-text-tertiary border-b border-kp-border-subtle pb-2">
                  {col.title}
                </h3>
                <ul className="space-y-2.5">
                  {col.links.map((link, i) => (
                    <li key={i}>
                      <Link
                        href={link.href}
                        className="text-xs sm:text-sm text-kp-text-secondary hover:text-kp-accent transition-colors block py-0.5"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom Section */}
        <div className="border-t border-kp-border-subtle pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-kp-text-tertiary">
          <p>
            © {new Date().getFullYear()} Alqora Technologies. {t('allRightsReserved')}
          </p>
          <div className="flex items-center gap-6">
            <span>{t('secureInfrastructure')} SSL</span>
            <span>WMS v2.0.4</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
