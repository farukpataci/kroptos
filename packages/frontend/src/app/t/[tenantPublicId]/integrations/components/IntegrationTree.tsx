'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { apiFetch } from '@/lib/api';
import { 
  LinkIcon,
  CpuChipIcon,
  TruckIcon,
  ArrowPathIcon
} from '@heroicons/react/24/outline';

interface Integration {
  id: string;
  name: string;
  provider: string;
  providerType: string;
  status: string;
}

export function IntegrationTree() {
  const t = useTranslations('integrations.tree');
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchIntegrations = async () => {
    try {
      const data = await apiFetch<Integration[]>('/integrations');
      setIntegrations(data || []);
    } catch (err) {
      console.error('Failed to fetch integrations for tree', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchIntegrations();

    const handleRefreshTree = () => {
      fetchIntegrations();
    };

    window.addEventListener('refresh-integration-tree', handleRefreshTree);
    return () => {
      window.removeEventListener('refresh-integration-tree', handleRefreshTree);
    };
  }, []);

  if (isLoading) {
    return (
      <div className="w-full bg-white rounded-2xl p-8 border border-kp-border shadow-xs flex items-center justify-center min-h-[220px]">
        <div className="flex flex-col items-center gap-2">
          <ArrowPathIcon className="h-6 w-6 text-kp-accent animate-spin" />
          <span className="text-xs text-kp-text-tertiary">{t('loading')}</span>
        </div>
      </div>
    );
  }

  // Render each active integration side-by-side (marketplaces, ERPs, shipping, etc.)
  const activeNodes = integrations.map((m) => {
    const provider = m.provider.toLowerCase();
    const type = m.providerType.toLowerCase();

    // Icon assignment
    let Icon = LinkIcon;
    if (type === 'erp') {
      Icon = CpuChipIcon;
    } else if (type === 'shipping') {
      Icon = TruckIcon;
    }

    // Color theme assignment
    let theme = 'text-indigo-600 bg-indigo-50 border-indigo-100 hover:border-indigo-300';
    if (provider === 'trendyol') {
      theme = 'text-orange-600 bg-orange-50 border-orange-100 hover:border-orange-300';
    } else if (provider === 'hepsiburada') {
      theme = 'text-amber-600 bg-amber-50 border-amber-100 hover:border-amber-300';
    } else if (provider === 'amazon') {
      theme = 'text-slate-700 bg-slate-50 border-slate-200 hover:border-slate-350';
    } else if (provider === 'shopify') {
      theme = 'text-green-600 bg-green-50 border-green-100 hover:border-green-300';
    } else if (provider === 'woocommerce') {
      theme = 'text-purple-600 bg-purple-50 border-purple-100 hover:border-purple-300';
    } else if (provider === 'logo') {
      theme = 'text-sky-600 bg-sky-50 border-sky-100 hover:border-sky-300';
    } else if (provider === 'n11') {
      theme = 'text-red-600 bg-red-50 border-red-100 hover:border-red-300';
    } else if (provider === 'ciceksepeti') {
      theme = 'text-blue-600 bg-blue-50 border-blue-100 hover:border-blue-300';
    }

    return {
      id: m.id,
      provider: m.provider.toUpperCase(),
      name: m.name,
      icon: Icon,
      theme
    };
  });

  // Render empty state if no active integrations configured
  if (activeNodes.length === 0) {
    return (
      <div className="w-full select-none animate-fade-in">
        <div className="bg-white rounded-2xl p-6 border border-kp-border shadow-xs relative overflow-hidden flex flex-col items-center">
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#f1f5f9_1px,transparent_1px),linear-gradient(to_bottom,#f1f5f9_1px,transparent_1px)] bg-[size:20px_20px] opacity-60 pointer-events-none" />
          
          <div className="bg-kp-accent text-white px-6 py-2 rounded-xl font-bold font-mono shadow-kp-glow text-sm tracking-widest relative z-10">
            kroptos.
          </div>
          <div className="h-6 w-0.5 border-l border-dashed border-slate-200 mt-1 relative z-10"></div>
          <div className="bg-kp-bg-secondary border border-kp-border rounded-xl px-6 py-4 text-center max-w-sm relative z-10">
            <p className="text-xs font-semibold text-kp-text-secondary">{t('emptyTitle')}</p>
            <p className="text-[10px] text-kp-text-tertiary mt-1">{t('emptyDesc')}</p>
          </div>
        </div>
      </div>
    );
  }

  const nodeCount = activeNodes.length;

  // Calculate dynamic percents for horizontal line span
  const leftPercent = 100 / (2 * nodeCount);
  const rightPercent = 100 / (2 * nodeCount);

  return (
    <div className="w-full overflow-x-auto pb-2 scrollbar-thin select-none animate-fade-in">
      <div className="min-w-[800px] bg-white rounded-2xl p-6 border border-kp-border shadow-xs relative overflow-hidden select-none">
        
        {/* Soft Decorative Grid Lines */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#f1f5f9_1px,transparent_1px),linear-gradient(to_bottom,#f1f5f9_1px,transparent_1px)] bg-[size:20px_20px] opacity-60 pointer-events-none" />

        {/* Central Master Node */}
        <div className="flex flex-col items-center justify-center relative z-10">
          <div className="bg-kp-accent text-white px-6 py-2 rounded-xl font-bold font-mono shadow-kp-glow text-sm tracking-widest relative group transition-all duration-300 hover:scale-105">
            kroptos.
            <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
          </div>
          
          {/* Main Connector Line Down */}
          <div className="h-6 w-0.5 border-l border-dashed border-slate-200 mt-1"></div>
        </div>

        {/* Horizontal Connector Line (Spans only if N > 1) */}
        {nodeCount > 1 && (
          <div className="relative z-0 h-px">
            <div 
              className="absolute top-0 border-t border-dashed border-slate-200"
              style={{
                left: `${leftPercent}%`,
                right: `${rightPercent}%`
              }}
            />
          </div>
        )}

        {/* Dynamic Nodes Grid */}
        <div 
          className="grid gap-6 relative z-10 text-center mx-auto"
          style={{
            gridTemplateColumns: `repeat(${nodeCount}, minmax(0, 1fr))`,
            maxWidth: `${nodeCount * 280}px`
          }}
        >
          {activeNodes.map((node) => (
            <div key={node.id} className="flex flex-col items-center group/card animate-scale-in">
              {/* Individual vertical drop line */}
              <div className="h-6 w-0.5 border-l border-dashed border-slate-200 transition-colors duration-200 group-hover/card:border-kp-accent"></div>
              
              {/* Card Container */}
              <div className="w-full bg-kp-bg-secondary border border-kp-border rounded-2xl p-5 transition-all duration-300 shadow-xs flex flex-col items-center justify-between min-h-[120px] hover:border-kp-accent hover:bg-white hover:shadow-kp-glow">
                
                {/* Icon and Provider Info */}
                <div className="flex flex-col items-center gap-2">
                  <div className="flex h-9 w-9 items-center justify-center rounded-kp-md bg-kp-accent/5 text-kp-accent">
                    <LinkIcon className="h-4.5 w-4.5" />
                  </div>
                  <div className="text-[12px] font-bold text-kp-text-primary uppercase tracking-wider font-mono">
                    {node.provider}
                  </div>
                </div>
                
                {/* Custom Name Capsule Badge */}
                <div className={`mt-3 text-[10px] font-semibold border px-3.5 py-1 rounded-full whitespace-nowrap overflow-hidden text-ellipsis max-w-full transition-all duration-300 ${node.theme}`}>
                  {node.name}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
