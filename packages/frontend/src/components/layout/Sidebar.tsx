'use client';

import { usePathname, useParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { useTranslations } from 'next-intl';
import {
  HomeIcon,
  UserGroupIcon,
  BuildingStorefrontIcon,
  ShoppingCartIcon,
  TagIcon,
  CubeIcon,
  LinkIcon,
  CpuChipIcon,
  TruckIcon,
  BuildingOffice2Icon,
  SparklesIcon,
  ChartBarIcon,
  ClipboardDocumentListIcon,
  Cog6ToothIcon,
  ChevronLeftIcon,
  ArrowRightOnRectangleIcon,
  XMarkIcon,
  ExclamationTriangleIcon,
  LifebuoyIcon,
} from '@heroicons/react/24/outline';

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  badge?: string;
  statusDot?: 'active' | 'warning' | 'error' | 'syncing';
}

interface NavSection {
  title: string;
  items: NavItem[];
}

interface SidebarProps {
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  isMobileOpen: boolean;
  onCloseMobile: () => void;
}

export default function Sidebar({ isCollapsed, onToggleCollapse, isMobileOpen, onCloseMobile }: SidebarProps) {
  const pathname = usePathname();
  const params = useParams();
  const { user, logout, tenantContext, accessibleTenants } = useAuth();
  const t = useTranslations('navigation');

  const currentAgency = accessibleTenants.find((a: any) => a.id === tenantContext.agencyId);
  const tenantPublicId = (params?.tenantPublicId as string) || currentAgency?.publicId || `tn_${tenantContext.agencyId || ''}`;

  const isActive = (href: string) => {
    if (href === `/t/${tenantPublicId}/dashboard`) return pathname === `/t/${tenantPublicId}/dashboard`;
    return pathname.startsWith(href);
  };

  const navigation: NavSection[] = [
    {
      title: t('main'),
      items: [
        { label: t('dashboard'), href: `/t/${tenantPublicId}/dashboard`, icon: HomeIcon },
        { label: t('clients'), href: `/t/${tenantPublicId}/clients`, icon: UserGroupIcon },
        { label: t('stores'), href: `/t/${tenantPublicId}/stores`, icon: BuildingStorefrontIcon },
      ],
    },
    {
      title: t('commerce'),
      items: [
        { label: t('orders'), href: `/t/${tenantPublicId}/orders`, icon: ShoppingCartIcon, badge: '12' },
        { label: t('products'), href: `/t/${tenantPublicId}/products`, icon: TagIcon },
        { label: t('inventory'), href: `/t/${tenantPublicId}/inventory`, icon: CubeIcon },
      ],
    },
    {
      title: 'Entegrasyon',
      items: [
        { label: 'Entegrasyon', href: `/t/${tenantPublicId}/integrations`, icon: LinkIcon },
      ],
    },
    {
      title: 'Destek',
      items: [
        { label: 'Destek', href: `/t/${tenantPublicId}/support`, icon: LifebuoyIcon },
      ],
    },
    {
      title: 'Sistem',
      items: [
        { label: 'Sistem', href: `/t/${tenantPublicId}/system`, icon: Cog6ToothIcon },
      ],
    },
  ];

  const sidebarContent = (
    <div className="flex h-full flex-col">
      {/* Logo */}
      <div className="flex h-header items-center justify-between border-b border-kp-border px-5">
        <Link href={`/t/${tenantPublicId}/dashboard`} className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-kp-md bg-kp-accent shadow-kp-glow">
            <span className="text-sm font-bold text-white">K</span>
          </div>
          {!isCollapsed && (
            <div className="animate-fade-in">
              <h1 className="text-sm font-semibold text-kp-text-primary tracking-tight">KroptOS</h1>
              <p className="text-[10px] font-medium text-kp-text-tertiary uppercase tracking-widest">Commerce OS</p>
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
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {navigation.map((section) => (
          <div key={section.title}>
            <ul className="space-y-0.5">
              {section.items.map((item) => {
                const active = isActive(item.href);
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={onCloseMobile}
                      title={isCollapsed ? item.label : undefined}
                      className={`
                        group relative flex items-center gap-3 rounded-kp-md px-3 py-2.5 text-[13px] font-medium
                        transition-all duration-150
                        ${active
                          ? 'bg-kp-bg-active text-kp-accent-hover'
                          : 'text-kp-text-secondary hover:bg-kp-bg-hover hover:text-kp-text-primary'
                        }
                        ${isCollapsed ? 'justify-center' : ''}
                      `}
                    >
                      {/* Active indicator bar */}
                      {active && (
                        <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-kp-accent" />
                      )}

                      <Icon className={`h-[18px] w-[18px] flex-shrink-0 ${active ? 'text-kp-accent' : 'text-kp-text-tertiary group-hover:text-kp-text-secondary'}`} />

                      {!isCollapsed && (
                        <>
                          <span className="flex-1 truncate">{item.label}</span>

                          {/* Badge */}
                          {item.badge && (
                            <span className="badge badge--accent text-[10px]">
                              {item.badge}
                            </span>
                          )}

                          {/* Status Dot */}
                          {item.statusDot && (
                            <span className={`status-dot status-dot--${item.statusDot}`} />
                          )}
                        </>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Bottom section: User */}
      <div className="border-t border-kp-border p-3 space-y-1">
        {/* User Card */}
        <div className={`mt-2 flex items-center gap-3 rounded-kp-md border border-kp-border-subtle p-3 ${isCollapsed ? 'justify-center' : ''}`}>
          {/* Avatar */}
          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-kp-accent to-purple-500 text-xs font-bold text-white">
            {user?.firstName?.[0] || 'U'}{user?.lastName?.[0] || ''}
          </div>

          {!isCollapsed && (
            <div className="flex-1 min-w-0">
              <p className="truncate text-[13px] font-medium text-kp-text-primary">
                {user?.firstName} {user?.lastName}
              </p>
              <p className="truncate text-[11px] text-kp-text-tertiary">{user?.email}</p>
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
