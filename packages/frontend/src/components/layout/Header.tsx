'use client';

import { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useRouter, usePathname, useParams } from 'next/navigation';
import { useTheme } from '@/context/ThemeContext';
import { apiFetch } from '@/lib/api';
import { useToast } from '@/components/ui/Toast';
import { useTranslations } from 'next-intl';
import {
  MagnifyingGlassIcon,
  BellIcon,
  ChevronDownIcon,
  Bars3Icon,
  ArrowRightOnRectangleIcon,
  UserCircleIcon,
  BuildingOfficeIcon,
  UserGroupIcon,
  BuildingStorefrontIcon,
  Squares2X2Icon,
} from '@heroicons/react/24/outline';

interface HeaderProps {
  onOpenMobileSidebar: () => void;
}

/* ---- Tenant Switcher Dropdown ---- */
interface TenantSwitcherProps {
  label: string;
  value: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  options: { id: string; name: string }[];
  onChange: (id: string) => void;
  disabled?: boolean;
}

function TenantSwitcher({ label, value, icon: Icon, options, onChange, disabled }: TenantSwitcherProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const tc = useTranslations('common');

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedOption = options.find((opt: any) => opt.id === value || opt.storeId === value);

  return (
    <div ref={dropdownRef} className="relative">
      <button
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`flex items-center gap-2 rounded-kp-md border border-kp-border bg-kp-bg-secondary px-3 py-1.5 text-xs font-medium text-kp-text-primary shadow-kp-sm transition-all hover:bg-kp-bg-hover disabled:opacity-50`}
      >
        <Icon className="h-4 w-4 text-kp-text-tertiary" />
        <span className="text-kp-text-secondary">{label}:</span>
        <span className="truncate max-w-[120px]">{selectedOption?.name || tc('notSelected')}</span>
        <ChevronDownIcon className={`h-3 w-3 text-kp-text-tertiary transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <ul className="absolute left-0 top-full z-50 mt-1 max-h-60 w-56 overflow-y-auto rounded-kp-md border border-kp-border bg-kp-bg-secondary p-1 shadow-kp-dropdown">
          {options.length === 0 ? (
            <li className="px-3 py-2 text-xs text-kp-text-tertiary">{tc('noOptions')}</li>
          ) : (
            options.map((opt) => (
              <li key={opt.id}>
                <button
                  onClick={() => {
                    onChange(opt.id);
                    setIsOpen(false);
                  }}
                  className={`flex w-full items-center rounded-kp-sm px-2.5 py-1.5 text-left text-xs transition-colors hover:bg-kp-bg-hover ${
                    opt.id === value ? 'bg-kp-bg-active text-kp-accent-hover font-semibold' : 'text-kp-text-primary'
                  }`}
                >
                  {opt.name}
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}

/* ---- Main Header ---- */
export default function Header({ onOpenMobileSidebar }: HeaderProps) {
  const { user, logout, tenantContext, switchTenant, accessibleTenants } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const router = useRouter();
  const pathname = usePathname();
  const params = useParams();
  const t = useTranslations('navigation');
  const th = useTranslations('header');
  const toast = useToast();
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // Derived options from accessibleTenants context
  const agencies = accessibleTenants.filter((t: any) => t.type === 'agency' || !t.type);
  const rawStores = accessibleTenants.filter((t: any) => t.type === 'brand');

  const currentAgency = agencies.find((a: any) => a.id === tenantContext.agencyId);
  const agencyPublicId = currentAgency?.publicId || (tenantContext.agencyId ? `tn_${tenantContext.agencyId}` : '');

  // Available stores for current agency context
  const availableStores = tenantContext.agencyId
    ? rawStores.filter((t: any) => t.agencyId === tenantContext.agencyId)
    : rawStores;

  // Add "Tüm Markalar (Havuz)" option at top
  const stores = [
    { id: 'all', name: 'Tüm Markalar (Havuz)', publicId: agencyPublicId },
    ...availableStores,
  ];

  const handleAgencyChange = async (agencyId: string) => {
    const agency = agencies.find((a: any) => a.id === agencyId);
    try {
      await switchTenant(agencyId, null, null);
    } catch (err: any) {
      // Geçiş başarısızsa yönlendirme YAPMA: kullanıcı erişemediği bir bağlamın
      // sayfasına düşerse orada her istek 403 alır ve sebebi görünmez olur.
      toast.error(err?.message || th('tenantSwitchFailed'));
      return;
    }
    if (agency?.publicId) {
      router.push(`/t/${agency.publicId}/dashboard`);
    } else {
      router.refresh();
    }
  };

  const handleStoreChange = async (storeId: string) => {
    if (storeId === 'all') {
      try {
        await switchTenant(tenantContext.agencyId!, null, null);
      } catch (err: any) {
        toast.error(err?.message || th('tenantSwitchFailed'));
        return;
      }
      const isTenantRoute = pathname.startsWith('/t/');
      const subPath = isTenantRoute ? pathname.replace(/^\/t\/[^\/]+/, '') : '/dashboard';
      const targetPath = `/t/${agencyPublicId}${subPath || '/dashboard'}`;
      router.push(targetPath);
      return;
    }

    const store = availableStores.find((s: any) => s.id === storeId || s.storeId === storeId);
    if (!store) return;

    const targetPublicId = store.publicId || `tn_${store.id}`;
    try {
      await switchTenant(store.agencyId || tenantContext.agencyId!, store.clientId || null, store.id || store.storeId);
    } catch (err: any) {
      toast.error(err?.message || th('tenantSwitchFailed'));
      return;
    }

    // Keep current subpath (e.g. /products, /orders) when switching brand inside /t/[tenantPublicId] routes
    const isTenantRoute = pathname.startsWith('/t/');
    const subPath = isTenantRoute ? pathname.replace(/^\/t\/[^\/]+/, '') : '/dashboard';
    const targetPath = `/t/${targetPublicId}${subPath || '/dashboard'}`;
    router.push(targetPath);
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setIsUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = () => {
    logout();
    router.push('/auth/login');
  };

  return (
    <header className="sticky top-0 z-30 flex h-header items-center justify-between border-b border-kp-border bg-kp-bg-primary/80 backdrop-blur-xl px-4 lg:px-6">
      {/* Left: Mobile menu + Tenant switchers */}
      <div className="flex items-center gap-3">
        {/* Mobile menu button */}
        <button
          onClick={onOpenMobileSidebar}
          className="rounded-kp-sm p-2 text-kp-text-tertiary hover:bg-kp-bg-tertiary hover:text-kp-text-primary transition-colors lg:hidden"
        >
          <Bars3Icon className="h-5 w-5" />
        </button>

        {/* Tenant Context Switchers (2-level hierarchy: Dağıtıcı Firma & Marka) */}
        {user && (
          <div className="hidden items-center gap-2.5 sm:flex">
            {/* 1. Dağıtıcı Firma Switcher */}
            <TenantSwitcher
              label={th('agency')}
              value={tenantContext.agencyId || ''}
              icon={BuildingOfficeIcon}
              options={agencies}
              onChange={handleAgencyChange}
            />

            {/* 2. Marka Switcher */}
            <TenantSwitcher
              label={th('client')}
              value={tenantContext.storeId || 'all'}
              icon={BuildingStorefrontIcon}
              options={stores}
              onChange={handleStoreChange}
              disabled={!tenantContext.agencyId}
            />
          </div>
        )}
      </div>

      {/* Right side: Actions & User menu */}
      <div className="flex items-center gap-3">
        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          className="rounded-kp-sm p-2 text-kp-text-tertiary transition-colors hover:bg-kp-bg-tertiary hover:text-kp-text-primary"
          title={th('toggleTheme')}
        >
          {theme === 'dark' ? '☀️' : '🌙'}
        </button>

        {/* WMS App Switcher */}
        <button
          onClick={() => router.push('/app/wms')}
          className="rounded-kp-sm p-2 text-kp-text-tertiary transition-colors hover:bg-kp-bg-tertiary hover:text-kp-text-primary"
          title={th('wms')}
        >
          <Squares2X2Icon className="h-5 w-5" />
        </button>

        {/* Notifications */}
        <button className="relative rounded-kp-sm p-2 text-kp-text-tertiary transition-colors hover:bg-kp-bg-tertiary hover:text-kp-text-primary">
          <BellIcon className="h-5 w-5" />
          <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-kp-danger text-[0.5625rem] font-bold text-white">
            3
          </span>
        </button>

        {/* User Menu */}
        <div ref={userMenuRef} className="relative">
          <button
            onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
            className="flex items-center gap-2 rounded-kp-md p-1.5 transition-colors hover:bg-kp-bg-tertiary"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-kp-accent to-purple-500 text-xs font-bold text-white">
              {user?.firstName?.[0] || 'U'}{user?.lastName?.[0] || ''}
            </div>
            <ChevronDownIcon className={`hidden h-3.5 w-3.5 text-kp-text-tertiary transition-transform sm:block ${isUserMenuOpen ? 'rotate-180' : ''}`} />
          </button>

          {isUserMenuOpen && (
            <div className="absolute right-0 top-full z-50 mt-1.5 w-56 animate-scale-in rounded-kp-md border border-kp-border bg-kp-bg-secondary shadow-kp-dropdown">
              <div className="border-b border-kp-border p-3">
                <p className="text-[0.8125rem] font-medium text-kp-text-primary">
                  {user?.firstName} {user?.lastName}
                </p>
                <p className="text-[0.6875rem] text-kp-text-tertiary">{user?.email}</p>
              </div>
              <div className="p-1.5">
                <button
                  onClick={() => {
                    const currentPublicId = (params?.tenantPublicId as string) || agencyPublicId || (tenantContext.storeId ? `tn_${tenantContext.storeId}` : '');
                    const targetPath = currentPublicId ? `/t/${currentPublicId}/admin/profile` : '/select-tenant';
                    router.push(targetPath);
                    setIsUserMenuOpen(false);
                  }}
                  className="flex w-full items-center gap-2.5 rounded-kp-sm px-2.5 py-2 text-[0.8125rem] text-kp-text-secondary hover:bg-kp-bg-hover hover:text-kp-text-primary transition-colors"
                >
                  <UserCircleIcon className="h-4 w-4" />
                  {t('profile')}
                </button>
                <button
                  onClick={handleLogout}
                  className="flex w-full items-center gap-2.5 rounded-kp-sm px-2.5 py-2 text-[0.8125rem] text-kp-text-secondary hover:bg-kp-danger-muted hover:text-kp-danger transition-colors"
                >
                  <ArrowRightOnRectangleIcon className="h-4 w-4" />
                  {t('logout')}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
