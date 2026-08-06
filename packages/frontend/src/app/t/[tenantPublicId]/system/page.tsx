'use client';

import { useSearchParams } from 'next/navigation';
import AuditLogsPage from './audit-logs/page';
import SystemSettingsPage from './settings/page';
import WarehousesPage from '../warehouses/page';

type SystemTab = 'settings' | 'warehouses' | 'audit_logs';

export default function SystemParentPage() {
  const searchParams = useSearchParams();

  const tabParam = searchParams.get('tab') as SystemTab | null;
  const activeTab: SystemTab = tabParam && ['settings', 'warehouses', 'audit_logs'].includes(tabParam)
    ? tabParam
    : 'settings';

  return (
    <div className="flex flex-col h-full animate-fade-in font-sans">
      {/* Sub-view Area */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'audit_logs' && <AuditLogsPage />}
        {activeTab === 'settings' && <SystemSettingsPage />}
        {activeTab === 'warehouses' && <WarehousesPage />}
      </div>
    </div>
  );
}
