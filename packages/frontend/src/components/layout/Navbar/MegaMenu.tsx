'use client';

import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import {
  ShoppingBagIcon,
  FolderOpenIcon,
  CircleStackIcon,
  BanknotesIcon,
  BuildingOfficeIcon,
  TruckIcon,
  ArrowPathIcon,
  TagIcon,
  CpuChipIcon,
  SparklesIcon,
  ChartBarIcon,
  UserGroupIcon,
  ArrowRightIcon,
  CommandLineIcon,
  DocumentTextIcon,
  AcademicCapIcon,
  QuestionMarkCircleIcon,
  ChatBubbleLeftRightIcon,
  BriefcaseIcon,
  WrenchScrewdriverIcon,
  PresentationChartLineIcon,
  LifebuoyIcon
} from '@heroicons/react/24/outline';

// ----------------------------------------------------
// PLATFORM FEATURES MENU
// ----------------------------------------------------
export function PlatformFeaturesMenu() {
  const t = useTranslations('marketing.megaMenu.features');

  const data = {
    col1: {
      title: t('operations.title'),
      items: [
        {
          name: t('operations.orders.name'),
          desc: t('operations.orders.desc'),
          icon: ShoppingBagIcon,
          href: '#orders'
        },
        {
          name: t('operations.catalog.name'),
          desc: t('operations.catalog.desc'),
          icon: FolderOpenIcon,
          href: '#catalog'
        },
        {
          name: t('operations.stock.name'),
          desc: t('operations.stock.desc'),
          icon: CircleStackIcon,
          href: '#stock'
        },
        {
          name: t('operations.pricing.name'),
          desc: t('operations.pricing.desc'),
          icon: BanknotesIcon,
          href: '#pricing-rules'
        }
      ]
    },
    col2: {
      title: t('logistics.title'),
      items: [
        {
          name: t('logistics.wms.name'),
          desc: t('logistics.wms.desc'),
          icon: BuildingOfficeIcon,
          href: '#wms'
        },
        {
          name: t('logistics.shipping.name'),
          desc: t('logistics.shipping.desc'),
          icon: TruckIcon,
          href: '#shipping'
        },
        {
          name: t('logistics.returns.name'),
          desc: t('logistics.returns.desc'),
          icon: ArrowPathIcon,
          href: '#returns'
        },
        {
          name: t('logistics.labels.name'),
          desc: t('logistics.labels.desc'),
          icon: TagIcon,
          href: '#labels'
        }
      ]
    },
    col3: {
      title: t('automation.title'),
      items: [
        {
          name: t('automation.workflow.name'),
          desc: t('automation.workflow.desc'),
          icon: CpuChipIcon,
          href: '#automation'
        },
        {
          name: t('automation.ai.name'),
          desc: t('automation.ai.desc'),
          icon: SparklesIcon,
          href: '#ai'
        },
        {
          name: t('automation.analytics.name'),
          desc: t('automation.analytics.desc'),
          icon: ChartBarIcon,
          href: '#analytics'
        },
        {
          name: t('automation.b2b.name'),
          desc: t('automation.b2b.desc'),
          icon: UserGroupIcon,
          href: '#b2b'
        }
      ]
    },
    banner: {
      title: t('banner.title'),
      desc: t('banner.desc'),
      cta: t('banner.cta')
    }
  };

  return (
    <div className="w-full flex flex-col">
      {/* 3 Columns Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 p-8 bg-kp-bg-secondary border-b border-kp-border">
        {[data.col1, data.col2, data.col3].map((col, idx) => (
          <div key={idx} className="space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-kp-text-tertiary border-b border-kp-border-subtle pb-2">
              {col.title}
            </h3>
            <ul className="space-y-2">
              {col.items.map((item, i) => {
                const Icon = item.icon;
                return (
                  <li key={i}>
                    <Link
                      href={item.href}
                      className="group flex gap-4 p-2.5 rounded-kp-md hover:bg-kp-bg-hover transition-all duration-200"
                    >
                      <div className="flex-shrink-0 h-10 w-10 flex items-center justify-center rounded-kp-sm bg-kp-bg-tertiary border border-kp-border-subtle group-hover:border-kp-border-accent group-hover:bg-kp-accent-muted text-kp-text-tertiary group-hover:text-kp-accent transition-all">
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="space-y-0.5">
                        <p className="text-sm font-semibold text-kp-text-primary group-hover:text-kp-accent transition-colors">
                          {item.name}
                        </p>
                        <p className="text-xs text-kp-text-tertiary leading-normal line-clamp-1">
                          {item.desc}
                        </p>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>

      {/* Spotlight Bottom Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-6 bg-kp-bg-tertiary/40 hover:bg-kp-bg-tertiary/70 transition-colors">
        <div className="space-y-1">
          <h4 className="text-sm font-semibold text-kp-text-primary flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-kp-success animate-pulse-dot" />
            {data.banner.title}
          </h4>
          <p className="text-xs text-kp-text-tertiary">
            {data.banner.desc}
          </p>
        </div>
        <Link
          href="#features"
          className="group inline-flex items-center gap-1.5 text-xs font-semibold text-kp-accent hover:text-kp-accent-hover transition-colors"
        >
          <span>{data.banner.cta}</span>
          <ArrowRightIcon className="h-3.5 w-3.5 group-hover:translate-x-1 transition-transform" />
        </Link>
      </div>
    </div>
  );
}

// ----------------------------------------------------
// SOLUTIONS MENU
// ----------------------------------------------------
export function SolutionsMenu() {
  const locale = useLocale();
  const t = useTranslations('marketing.megaMenu.solutions');

  const data = {
    col1: {
      title: t('bySize.title'),
      items: [
        t('bySize.startup'),
        t('bySize.growing'),
        t('bySize.omnichannel'),
        t('bySize.enterprise')
      ]
    },
    col2: {
      title: t('byModel.title'),
      items: [
        t('byModel.marketplaceSellers'),
        t('byModel.ownSite'),
        t('byModel.b2bWholesale'),
        t('byModel.dropshipping'),
        t('byModel.fulfillment')
      ]
    },
    col3: {
      title: t('byIndustry.title'),
      items: [
        t('byIndustry.fashion'),
        t('byIndustry.cosmetics'),
        t('byIndustry.electronics'),
        t('byIndustry.homeAndLiving'),
        t('byIndustry.automotive'),
        t('byIndustry.foodAndFmcg')
      ]
    },
    promo: {
      tag: 'Alqora Enterprise',
      title: t('promo.title'),
      desc: t('promo.desc'),
      cta: t('promo.cta')
    }
  };

  return (
    <div className="w-full grid grid-cols-1 lg:grid-cols-4 bg-kp-bg-secondary">
      {/* 3 Links Columns */}
      <div className="lg:col-span-3 grid grid-cols-1 sm:grid-cols-3 gap-8 p-8 border-r border-kp-border">
        {[data.col1, data.col2, data.col3].map((col, idx) => (
          <div key={idx} className="space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-kp-text-tertiary border-b border-kp-border-subtle pb-2">
              {col.title}
            </h3>
            <ul className="space-y-3">
              {col.items.map((item, i) => {
                let href = `#solutions-${idx}-${i}`;
                if (idx === 2) {
                  const slugs = [
                    'fashion-and-apparel',
                    'cosmetics-and-personal-care',
                    'electronics',
                    'home-and-garden',
                    'automotive-spare-parts',
                    'food-and-fmcg'
                  ];
                  href = `/${locale}/industry/${slugs[i]}`;
                }
                return (
                  <li key={i}>
                    <Link
                      href={href}
                      className="text-sm text-kp-text-secondary hover:text-kp-accent hover:underline transition-all block py-0.5"
                    >
                      {item}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>

      {/* Dynamic Theme Promo Card */}
      <div className="p-8 bg-gradient-to-br from-indigo-50 to-indigo-100/30 dark:from-[#0b0e22] dark:to-neutral-950 flex flex-col justify-between space-y-6">
        <div className="space-y-3">
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[0.625rem] font-bold tracking-wider uppercase bg-kp-accent-muted text-kp-accent border border-kp-accent/20">
            {data.promo.tag}
          </span>
          <h4 className="text-base font-bold text-kp-text-primary leading-snug">
            {data.promo.title}
          </h4>
          <p className="text-xs text-kp-text-tertiary leading-relaxed">
            {data.promo.desc}
          </p>
        </div>
        <Link
          href="#contact"
          className="group inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-kp-sm bg-kp-accent hover:bg-kp-accent-hover text-white transition-all shadow-kp-card hover:shadow-kp-glow"
        >
          <span>{data.promo.cta}</span>
          <ArrowRightIcon className="h-3.5 w-3.5 group-hover:translate-x-1 transition-transform" />
        </Link>
      </div>
    </div>
  );
}

// ----------------------------------------------------
// RESOURCES MENU
// ----------------------------------------------------
export function ResourcesMenu() {
  const t = useTranslations('marketing.megaMenu.resources');

  const data = {
    col1: {
      title: t('learn.title'),
      items: [
        {
          name: t('learn.helpCenter.name'),
          desc: t('learn.helpCenter.desc'),
          icon: QuestionMarkCircleIcon,
          href: '#help'
        },
        {
          name: t('learn.academy.name'),
          desc: t('learn.academy.desc'),
          icon: AcademicCapIcon,
          href: '#academy'
        },
        {
          name: t('learn.blog.name'),
          desc: t('learn.blog.desc'),
          icon: ChatBubbleLeftRightIcon,
          href: '#blog'
        },
        {
          name: t('learn.apiDocs.name'),
          desc: t('learn.apiDocs.desc'),
          icon: CommandLineIcon,
          href: '#api-docs'
        },
        {
          name: t('learn.integrationGuides.name'),
          desc: t('learn.integrationGuides.desc'),
          icon: DocumentTextIcon,
          href: '#guides'
        }
      ]
    },
    col2: {
      title: t('services.title'),
      items: [
        {
          name: t('services.setup.name'),
          desc: t('services.setup.desc'),
          icon: BriefcaseIcon,
          href: '#setup'
        },
        {
          name: t('services.consulting.name'),
          desc: t('services.consulting.desc'),
          icon: PresentationChartLineIcon,
          href: '#consulting'
        },
        {
          name: t('services.analysis.name'),
          desc: t('services.analysis.desc'),
          icon: WrenchScrewdriverIcon,
          href: '#analysis'
        },
        {
          name: t('services.support.name'),
          desc: t('services.support.desc'),
          icon: LifebuoyIcon,
          href: '#support'
        },
        {
          name: t('services.contact.name'),
          desc: t('services.contact.desc'),
          icon: ChatBubbleLeftRightIcon,
          href: '#contact'
        }
      ]
    },
    footer: {
      text: t('footer.text'),
      cta: t('footer.cta')
    }
  };

  return (
    <div className="w-full flex flex-col">
      {/* 2 Columns Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 p-8 bg-kp-bg-secondary border-b border-kp-border">
        {[data.col1, data.col2].map((col, idx) => (
          <div key={idx} className="space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-kp-text-tertiary border-b border-kp-border-subtle pb-2">
              {col.title}
            </h3>
            <ul className="space-y-2">
              {col.items.map((item, i) => {
                const Icon = item.icon;
                return (
                  <li key={i}>
                    <Link
                      href={item.href}
                      className="group flex gap-4 p-2.5 rounded-kp-md hover:bg-kp-bg-hover transition-all duration-200"
                    >
                      <div className="flex-shrink-0 h-10 w-10 flex items-center justify-center rounded-kp-sm bg-kp-bg-tertiary border border-kp-border-subtle group-hover:border-kp-border-accent group-hover:bg-kp-accent-muted text-kp-text-tertiary group-hover:text-kp-accent transition-all">
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="space-y-0.5">
                        <p className="text-sm font-semibold text-kp-text-primary group-hover:text-kp-accent transition-colors">
                          {item.name}
                        </p>
                        <p className="text-xs text-kp-text-tertiary leading-normal line-clamp-1">
                          {item.desc}
                        </p>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>

      {/* Footer Vurgu */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-6 bg-kp-accent-muted/10 hover:bg-kp-accent-muted/20 transition-colors border-t border-kp-border">
        <p className="text-xs text-kp-text-primary font-medium">
          📊 {data.footer.text}
        </p>
        <Link
          href="#calculator"
          className="inline-flex items-center justify-center px-4 py-2 text-xs font-bold rounded-kp-sm bg-kp-accent-muted text-kp-accent border border-kp-accent/25 hover:bg-kp-accent hover:text-white transition-all active:scale-95"
        >
          {data.footer.cta}
        </Link>
      </div>
    </div>
  );
}
