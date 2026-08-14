'use client';

import { useState, useEffect } from 'react';
import { usePathname, useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { useTranslations } from 'next-intl';
import {
  Squares2X2Icon,
  BuildingStorefrontIcon,
  ShoppingCartIcon,
  TagIcon,
  CubeIcon,
  LinkIcon,
  Cog6ToothIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ArrowRightOnRectangleIcon,
  XMarkIcon,
  LifebuoyIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline';

interface SubNavItem {
  label: string;
  href: string;
  badge?: string;
  badgeType?: 'new' | 'count';
}

interface NavGroup {
  id: string;
  label: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  badge?: string;
  badgeType?: 'new' | 'count';
  href?: string;
  children?: SubNavItem[];
}

interface SidebarProps {
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  isMobileOpen: boolean;
  onCloseMobile: () => void;
}

export default function Sidebar({ isCollapsed, onToggleCollapse, isMobileOpen, onCloseMobile }: SidebarProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const params = useParams();
  const { user, logout, tenantContext, accessibleTenants } = useAuth();
  const t = useTranslations('navigation');

  const currentAgency = accessibleTenants.find((a: any) => a.id === tenantContext.agencyId);
  const tenantPublicId = (params?.tenantPublicId as string) || currentAgency?.publicId || `tn_${tenantContext.agencyId || ''}`;

  const isSpecificBrand = Boolean(tenantContext.storeId);
  const isPlatformAdmin = user?.isPlatformAdmin === true;

  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    marketplaces: true,
    system: true,
  });

  const toggleGroup = (id: string) => {
    setOpenGroups((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const navGroups: NavGroup[] = [
    {
      id: 'dashboard',
      label: t('dashboard'),
      icon: Squares2X2Icon,
      href: `/t/${tenantPublicId}/dashboard`,
    },
    ...(!isSpecificBrand
      ? [
          {
            id: 'marketplaces',
            label: t('marketplaces'),
            icon: BuildingStorefrontIcon,
            children: [
              { label: 'Tüm Markalar (Havuz)', href: `/t/${tenantPublicId}/stores` },
              // Distributor firms sit above every tenant, so only the platform
              // administrator ever sees this entry. The API enforces the same
              // rule on every write.
              ...(isPlatformAdmin
                ? [{ label: 'Dağıtıcı Firmalar', href: `/t/${tenantPublicId}/agencies` }]
                : []),
            ],
          },
        ]
      : []),
    {
      id: 'orders',
      label: t('orders'),
      icon: ShoppingCartIcon,
      badge: '12',
      badgeType: 'count',
      href: `/t/${tenantPublicId}/orders`,
    },
    {
      id: 'products',
      label: t('products'),
      icon: TagIcon,
      href: `/t/${tenantPublicId}/products`,
    },
    {
      id: 'inventory',
      label: t('inventory'),
      icon: CubeIcon,
      href: `/t/${tenantPublicId}/inventory`,
    },
    {
      id: 'integrations',
      label: 'Entegrasyon',
      icon: LinkIcon,
      href: `/t/${tenantPublicId}/integrations`,
    },
    {
      id: 'support',
      label: 'Destek Merkezi',
      icon: LifebuoyIcon,
      href: `/t/${tenantPublicId}/support`,
    },
    {
      id: 'system',
      label: 'Sistem',
      icon: Cog6ToothIcon,
      children: [
        { label: 'Sistem Ayarları', href: `/t/${tenantPublicId}/system?tab=settings` },
        { label: 'Depo Yönetimi', href: `/t/${tenantPublicId}/system?tab=warehouses` },
        { label: 'Sistem Günlüğü', href: `/t/${tenantPublicId}/system?tab=audit_logs` },
      ],
    },
  ];

  const isChildActive = (href: string) => {
    if (href.includes('?')) {
      const [basePath, search] = href.split('?');
      if (pathname !== basePath) return false;
      const targetTab = new URLSearchParams(search).get('tab');
      const currentTab = searchParams?.get('tab') || 'settings';
      return targetTab === currentTab;
    }
    if (href === `/t/${tenantPublicId}/dashboard`) return pathname === `/t/${tenantPublicId}/dashboard`;
    return pathname.startsWith(href);
  };

  const isGroupActive = (group: NavGroup) => {
    if (group.href) return isChildActive(group.href);
    return group.children?.some((child) => isChildActive(child.href)) || false;
  };

  // Auto-expand group if current pathname matches any child route
  useEffect(() => {
    setOpenGroups((prev) => {
      const updated = { ...prev };
      let changed = false;
      navGroups.forEach((group) => {
        if (group.children?.some((child) => isChildActive(child.href))) {
          if (!updated[group.id]) {
            updated[group.id] = true;
            changed = true;
          }
        }
      });
      return changed ? updated : prev;
    });
  }, [pathname, searchParams, tenantPublicId]);

  const sidebarContent = (
    <div className="flex h-full flex-col font-sans">
      {/* Logo */}
      <div className="flex h-header items-center justify-between border-b border-kp-border px-5">
        <Link href={`/t/${tenantPublicId}/dashboard`} prefetch={true} className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-kp-md bg-kp-accent shadow-kp-glow">
            <span className="text-sm font-bold text-white">K</span>
          </div>
          {!isCollapsed && (
            <div className="animate-fade-in">
              <h1 className="text-sm font-bold text-kp-text-primary tracking-tight">KroptOS</h1>
              <p className="text-[0.625rem] font-semibold text-kp-text-tertiary uppercase tracking-widest">Commerce OS</p>
            </div>
          )}
        </Link>

        {/* Close button (mobile) */}
        <button
          onClick={onCloseMobile}
          className="rounded-kp-sm p-1.5 text-kp-text-tertiary hover:bg-kp-bg-tertiary hover:text-kp-text-primary transition-colors lg:hidden"
        >
          <XMarkIcon className="h-5 w-5" />
        </button>

        {/* Collapse button (desktop) */}
        <button
          onClick={onToggleCollapse}
          className="hidden rounded-kp-sm p-1.5 text-kp-text-tertiary hover:bg-kp-bg-tertiary hover:text-kp-text-primary transition-colors lg:block"
        >
          <ChevronLeftIcon className={`h-4 w-4 transition-transform duration-200 ${isCollapsed ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-2 space-y-1 scrollbar-thin">
        {navGroups.map((group) => {
          const isOpen = openGroups[group.id];
          const groupActive = isGroupActive(group);
          const Icon = group.icon;
          const hasChildren = Boolean(group.children && group.children.length > 0);

          if (group.href) {
            const active = isChildActive(group.href);
            return (
              <div key={group.id}>
                <Link
                  href={group.href}
                  prefetch={true}
                  onClick={onCloseMobile}
                  title={isCollapsed ? group.label : undefined}
                  className={`
                    group w-full flex items-center justify-between rounded-lg px-3 py-2 text-sm font-medium
                    transition-all duration-150 text-left
                    ${active
                      ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white font-semibold'
                      : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100/70 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-white'
                    }
                    ${isCollapsed ? 'justify-center' : ''}
                  `}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Icon className={`h-5 w-5 flex-shrink-0 ${active ? 'text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-400 group-hover:text-slate-700 dark:group-hover:text-slate-200'}`} />
                    {!isCollapsed && (
                      <span className="truncate">{group.label}</span>
                    )}
                  </div>

                  {!isCollapsed && group.badge && (
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${
                      group.badgeType === 'new'
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/80 dark:text-emerald-300'
                        : 'bg-blue-100 text-blue-700 dark:bg-blue-900/60 dark:text-blue-300'
                    }`}>
                      {group.badge}
                    </span>
                  )}
                </Link>
              </div>
            );
          }

          return (
            <div key={group.id} className="space-y-0.5">
              {/* Group Header Button */}
              <button
                onClick={() => {
                  if (hasChildren && !isCollapsed) {
                    toggleGroup(group.id);
                  }
                }}
                title={isCollapsed ? group.label : undefined}
                className={`
                  group w-full flex items-center justify-between rounded-lg px-3 py-2 text-sm font-medium
                  transition-all duration-150 text-left
                  ${groupActive
                    ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white font-semibold'
                    : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100/70 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-white'
                  }
                  ${isCollapsed ? 'justify-center' : ''}
                `}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Icon className={`h-5 w-5 flex-shrink-0 ${groupActive ? 'text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-400 group-hover:text-slate-700 dark:group-hover:text-slate-200'}`} />
                  {!isCollapsed && (
                    <span className="truncate">{group.label}</span>
                  )}
                </div>

                {!isCollapsed && (
                  <div className="flex items-center gap-2">
                    {group.badge && (
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${
                        group.badgeType === 'new'
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/80 dark:text-emerald-300'
                          : 'bg-blue-100 text-blue-700 dark:bg-blue-900/60 dark:text-blue-300'
                      }`}>
                        {group.badge}
                      </span>
                    )}
                    {hasChildren && (
                      <ChevronRightIcon
                        className={`h-4 w-4 text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-90 text-slate-700 dark:text-slate-200' : ''}`}
                      />
                    )}
                  </div>
                )}
              </button>

              {/* Sub-Items Collapsible Container */}
              {hasChildren && isOpen && !isCollapsed && (
                <div className="space-y-0.5 py-0.5 animate-fade-in">
                  {group.children!.map((child) => {
                    const active = isChildActive(child.href);
                    return (
                      <Link
                        key={child.href + child.label}
                        href={child.href}
                        prefetch={true}
                        onClick={onCloseMobile}
                        className={`
                          flex items-center justify-between rounded-md py-1.5 px-3 pl-10 text-xs font-medium
                          transition-all duration-150
                          ${active
                            ? 'text-blue-600 dark:text-blue-400 bg-blue-50/60 dark:bg-blue-950/30 font-semibold'
                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/50 dark:hover:bg-slate-800/40'
                          }
                        `}
                      >
                        <span className="truncate">{child.label}</span>
                        {child.badge && (
                          <span className="rounded-full bg-blue-100/80 dark:bg-blue-900/40 px-2 py-0.5 text-xs font-medium text-blue-600 dark:text-blue-300">
                            {child.badge}
                          </span>
                        )}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* Bottom section: User */}
      <div className="border-t border-kp-border p-3.5 space-y-1">
        <div className={`flex items-center gap-3 rounded-xl border border-kp-border-subtle p-3 ${isCollapsed ? 'justify-center' : ''}`}>
          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-kp-accent to-purple-500 text-xs font-bold text-white">
            {user?.firstName?.[0] || 'U'}{user?.lastName?.[0] || ''}
          </div>

          {!isCollapsed && (
            <div className="flex-1 min-w-0">
              <p className="truncate text-[0.8125rem] font-semibold text-kp-text-primary">
                {user?.firstName} {user?.lastName}
              </p>
              <p className="truncate text-[0.6875rem] font-medium text-kp-text-tertiary">{user?.email}</p>
            </div>
          )}

          {!isCollapsed && (
            <button
              onClick={logout}
              title={t('logout')}
              className="rounded-kp-sm p-1.5 text-kp-text-tertiary hover:bg-kp-danger-muted hover:text-kp-danger transition-colors"
            >
              <ArrowRightOnRectangleIcon className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile overlay backdrop */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={onCloseMobile}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed top-0 left-0 z-50 h-screen bg-kp-bg-secondary border-r border-kp-border
          transition-all duration-300 ease-in-out
          ${isCollapsed ? 'w-sidebar-collapsed' : 'w-sidebar'}
          ${isMobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        {sidebarContent}
      </aside>
    </>
  );
}
