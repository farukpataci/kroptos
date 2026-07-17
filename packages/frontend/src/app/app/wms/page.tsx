'use client';

import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import {
  ChartBarIcon,
  CubeIcon,
  ArrowDownTrayIcon,
  ArrowUturnLeftIcon,
  TruckIcon,
  ArrowsRightLeftIcon,
  CircleStackIcon,
  Cog6ToothIcon,
  ArrowLeftIcon,
} from '@heroicons/react/24/outline';

export default function WmsLauncherPage() {
  const { user } = useAuth();

  const menuItems = [
    {
      title: 'WMS Dashboard',
      description: 'Warehouse statistics, printer status, and pending operations at a glance.',
      href: '/app/wms/dashboard',
      icon: <ChartBarIcon className="h-6 w-6" />,
      color: 'text-kp-accent',
    },
    {
      title: 'Packaging',
      description: 'Pack orders, verify items, and generate shipping labels.',
      href: '/app/wms/packaging',
      icon: <CubeIcon className="h-6 w-6" />,
      color: 'text-kp-warning',
    },
    {
      title: 'Inbound',
      description: 'Receive supplier shipments and count incoming goods.',
      href: '/app/wms/inbound',
      icon: <ArrowDownTrayIcon className="h-6 w-6" />,
      color: 'text-kp-success',
    },
    {
      title: 'Returns',
      description: 'Inspect customer returns and restock approved items.',
      href: '/app/wms/returns',
      icon: <ArrowUturnLeftIcon className="h-6 w-6" />,
      color: 'text-kp-danger',
    },
    {
      title: 'Shipments',
      description: 'Track packed orders ready for courier dispatch.',
      href: '/app/wms/shipments',
      icon: <TruckIcon className="h-6 w-6" />,
      color: 'text-kp-info',
    },
    {
      title: 'Transfers',
      description: 'Create inter-warehouse stock transfer orders.',
      href: '/app/wms/transfers',
      icon: <ArrowsRightLeftIcon className="h-6 w-6" />,
      color: 'text-kp-warning',
    },
    {
      title: 'Stocks',
      description: 'Browse current stock levels, shelf addresses, and update quantities.',
      href: '/app/wms/stocks',
      icon: <CircleStackIcon className="h-6 w-6" />,
      color: 'text-kp-success',
    },
    {
      title: 'Settings',
      description: 'Configure label printers, drivers, label templates, and preview.',
      href: '/app/wms/settings',
      icon: <Cog6ToothIcon className="h-6 w-6" />,
      color: 'text-kp-accent',
    },
    {
      title: 'Back to Panel',
      description: 'Return to the main KroptOS administration panel.',
      href: '/select-tenant',
      icon: <ArrowLeftIcon className="h-6 w-6" />,
      color: 'text-kp-text-tertiary',
    },
  ];

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Hero */}
      <div className="text-center max-w-xl mx-auto">
        <h1 className="text-xl font-semibold text-kp-text-primary">
          Warehouse Management
        </h1>
        <p className="mt-2 text-[13px] text-kp-text-tertiary leading-relaxed">
          Welcome back, {user?.firstName || 'Operator'}. Select a module below to begin your warehouse operations.
        </p>

        {/* Global barcode search */}
        <div className="mt-6 relative max-w-md mx-auto">
          <input
            type="text"
            placeholder="Quick search — scan barcode or type order number…"
            className="w-full rounded-kp-lg border border-kp-border bg-kp-bg-secondary px-4 py-3 pl-10 text-[13px] text-kp-text-primary placeholder-kp-text-tertiary transition-colors focus:border-kp-border-accent focus:outline-none shadow-kp-card"
          />
          <svg className="absolute left-3.5 top-3.5 h-4 w-4 text-kp-text-tertiary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
      </div>

      {/* Grid of Launcher Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {menuItems.map((item) => (
          <Link
            key={item.title}
            href={item.href}
            className="card group flex flex-col p-5 transition-all duration-200 hover:shadow-kp-elevated hover:border-kp-border-accent"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className={`flex h-10 w-10 items-center justify-center rounded-kp-md bg-kp-bg-tertiary ${item.color}`}>
                {item.icon}
              </div>
              <h3 className="text-[14px] font-semibold text-kp-text-primary group-hover:text-kp-accent-hover transition-colors">
                {item.title}
              </h3>
            </div>
            <p className="text-[12px] text-kp-text-tertiary leading-relaxed">{item.description}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
