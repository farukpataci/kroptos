'use client';

import { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useRouter, usePathname } from 'next/navigation';
import { useTheme } from '@/context/ThemeContext';
import { apiFetch } from '@/lib/api';
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

  const selectedOption = options.find((opt) => opt.id === value);

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
  const { user, logout, tenantContext, switchTenant } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const router = useRouter();
  const pathname = usePathname();
  const t = useTranslations('navigation');
  const th = useTranslations('header');
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // Live options loaded from API
  const [agencies, setAgencies] = useState<{ id: string; name: string }[]>([]);
  const [clients, setClients] = useState<{ id: string; name: string }[]>([]);
  const [stores, setStores] = useState<{ id: string; name: string }[]>([]);

  // 1. Fetch available agencies, clients, stores
  useEffect(() => {
    const fetchSwitchersData = async () => {
      try {
        const agencyList = await apiFetch<{ id: string; name: string }[]>('/agencies');
        setAgencies(agencyList || []);
      } catch (err: any) {
        console.error('Failed to load agencies context switcher list:', err.message);
      }

      try {
        const clientList = await apiFetch<{ id: string; name: string }[]>('/clients');
        setClients(clientList || []);
      } catch (err: any) {
        console.error('Failed to load clients context switcher list:', err.message);
      }

      try {
        const storeList = await apiFetch<{ id: string; name: string }[]>('/stores');
        setStores(storeList || []);
      } catch (err: any) {
        console.error('Failed to load stores context switcher list:', err.message);
      }
    };

    if (user) {
      fetchSwitchersData();
    }
  }, [user, tenantContext.agencyId, tenantContext.clientId, tenantContext.storeId, pathname]);



  // Filters option lists based on parent relationships if possible
  const filteredClients = clients; // Backend list handles user permissions; we show all authorized.
  const filteredStores = tenantContext.clientId
    ? stores.filter((s: any) => s.clientId === tenantContext.clientId)
    : stores;



  const handleAgencyChange = async (agencyId: string) => {
    // Reset child context when parent changes to avoid invalid settings
    await switchTenant(agencyId, null, null);
    router.refresh();
  };

  const handleClientChange = async (clientId: string) => {
    // Attempt to auto-select first store belonging to client
    const matchingStore = stores.find((s: any) => s.clientId === clientId);
    await switchTenant(tenantContext.agencyId!, clientId, matchingStore?.id || null);
    router.refresh();
  };

  const handleStoreChange = async (storeId: string) => {
    const store = stores.find((s) => s.id === storeId) as any;
    await switchTenant(tenantContext.agencyId!, store?.clientId || null, storeId);
    router.refresh();
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

        {/* Tenant Context Switchers (Only when authenticated) */}
        {user && (
          <div className="hidden items-center gap-2.5 sm:flex">
            {/* Agency Switcher */}
            <TenantSwitcher
              label={th('agency')}
              value={tenantContext.agencyId || ''}
              icon={BuildingOfficeIcon}
              options={agencies}
              onChange={handleAgencyChange}
            />

            {/* Client Switcher */}
            <TenantSwitcher
              label={th('client')}
              value={tenantContext.clientId || ''}
              icon={UserGroupIcon}
              options={filteredClients}
              onChange={handleClientChange}
              disabled={!tenantContext.agencyId}
            />

            {/* Store Switcher */}
            <TenantSwitcher
              label={th('marketplace')}
              value={tenantContext.storeId || ''}
              icon={BuildingStorefrontIcon}
              options={filteredStores}
              onChange={handleStoreChange}
              disabled={!tenantContext.clientId}
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
          <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-kp-danger text-[9px] font-bold text-white">
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
                <p className="text-[13px] font-medium text-kp-text-primary">
                  {user?.firstName} {user?.lastName}
                </p>
                <p className="text-[11px] text-kp-text-tertiary">{user?.email}</p>
              </div>
              <div className="p-1.5">
                <button
                  onClick={() => {
                    router.push('/admin/profile');
                    setIsUserMenuOpen(false);
                  }}
                  className="flex w-full items-center gap-2.5 rounded-kp-sm px-2.5 py-2 text-[13px] text-kp-text-secondary hover:bg-kp-bg-hover hover:text-kp-text-primary transition-colors"
                >
                  <UserCircleIcon className="h-4 w-4" />
                  {t('profile')}
                </button>
                <button
                  onClick={handleLogout}
                  className="flex w-full items-center gap-2.5 rounded-kp-sm px-2.5 py-2 text-[13px] text-kp-text-secondary hover:bg-kp-danger-muted hover:text-kp-danger transition-colors"
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
