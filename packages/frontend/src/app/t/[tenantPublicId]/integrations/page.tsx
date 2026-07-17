'use client';

import { useState } from 'react';
import {
  LinkIcon,
  CpuChipIcon,
  TruckIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline';
import MarketplacePage from './marketplace/page';
import ErpPage from './erp/page';
import ShippingPage from '../shipping/page';
import IntegrationErrorsPage from './errors/page';
import { IntegrationTree } from './components/IntegrationTree';

type IntegrationTab = 'marketplace' | 'erp' | 'shipping' | 'errors';

export default function IntegrationsParentPage() {
  const [activeTab, setActiveTab] = useState<IntegrationTab>('marketplace'); // Default to marketplace

  const TABS = [
    { id: 'marketplace' as IntegrationTab, label: 'Pazaryerleri', icon: LinkIcon },
    { id: 'erp' as IntegrationTab, label: 'ERP Ayarları', icon: CpuChipIcon },
    { id: 'shipping' as IntegrationTab, label: 'Kargo Yönetimi', icon: TruckIcon },
    { id: 'errors' as IntegrationTab, label: 'Entegrasyon Hataları', icon: ExclamationTriangleIcon },
  ];

  return (
    <div className="flex flex-col h-full animate-fade-in p-6 space-y-6">
      {/* Integration Schema Map */}
      <IntegrationTree />

      {/* Top Tab Menu Bar */}
      <div className="flex border-b border-kp-border px-4 bg-kp-bg-primary/20 flex-shrink-0">
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
        {activeTab === 'marketplace' && <MarketplacePage />}
        {activeTab === 'erp' && <ErpPage />}
        {activeTab === 'shipping' && <ShippingPage />}
        {activeTab === 'errors' && <IntegrationErrorsPage />}
      </div>
    </div>
  );
}
