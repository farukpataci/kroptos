'use client';

import { useState } from 'react';
import {
  ChartBarIcon,
  ClipboardDocumentListIcon,
  Cog6ToothIcon,
  BuildingOffice2Icon
} from '@heroicons/react/24/outline';
import AnalyticsPage from '../analytics/page';
import AuditLogsPage from './audit-logs/page';
import SystemSettingsPage from './settings/page';
import WarehousesPage from '../warehouses/page';

type SystemTab = 'analytics' | 'audit_logs' | 'settings' | 'warehouses';

export default function SystemParentPage() {
  const [activeTab, setActiveTab] = useState<SystemTab>('settings'); // Default to settings since it's the main system page

  const TABS = [
    { id: 'settings' as SystemTab, label: 'Sistem Ayarları', icon: Cog6ToothIcon },
    { id: 'warehouses' as SystemTab, label: 'Depo Yönetimi', icon: BuildingOffice2Icon },
    { id: 'analytics' as SystemTab, label: 'Analiz & Raporlar', icon: ChartBarIcon },
    { id: 'audit_logs' as SystemTab, label: 'Sistem Günlüğü', icon: ClipboardDocumentListIcon },
  ];

  return (
    <div className="flex flex-col h-full animate-fade-in">
      {/* Top Tab Menu Bar */}
      <div className="flex border-b border-kp-border px-8 bg-kp-bg-primary/20 flex-shrink-0">
        {TABS.map(({ id, label, icon: Icon }) => {
          const isActive = activeTab === id;
          return (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex items-center gap-2 px-6 py-4 text-[13px] font-semibold border-b-2 transition-all ${
                isActive
                  ? 'border-kp-accent text-kp-accent'
                  : 'border-transparent text-kp-text-tertiary hover:text-kp-text-secondary'
              }`}
            >
              <Icon className={`h-4 w-4 ${isActive ? 'text-kp-accent' : 'text-kp-text-tertiary'}`} />
              <span>{label}</span>
            </button>
          );
        })}
      </div>

      {/* Sub-view Area */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'analytics' && <AnalyticsPage />}
        {activeTab === 'audit_logs' && <AuditLogsPage />}
        {activeTab === 'settings' && <SystemSettingsPage />}
        {activeTab === 'warehouses' && <WarehousesPage />}
      </div>
    </div>
  );
}
