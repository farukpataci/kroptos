'use client';

import React, { useState, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { useParams } from 'next/navigation';
import {
  Cog6ToothIcon,
  ClockIcon,
  DocumentDuplicateIcon,
  ArrowPathIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
} from '@heroicons/react/24/outline';
import { SubPageShell } from '@/components/layout/SubPageShell';
import { useOrderSettings } from './hooks/useOrderSettings';
import { OrderSettingsSidebar } from './components/OrderSettingsSidebar';
import { SettingField } from './components/SettingField';
import { OrderNumberPreview } from './components/OrderNumberPreview';
import { DirtyActionBar } from './components/DirtyActionBar';
import { ImpactModal } from './components/ImpactModal';
import { HistoryDrawer } from './components/HistoryDrawer';
import { CopySettingsModal } from './components/CopySettingsModal';
import { SettingImpact } from './types';

export default function OrderSettingsPage() {
  const t = useTranslations('orderSubPages');
  const params = useParams();
  const tenantPublicId = params.tenantPublicId as string;

  const {
    loading,
    saving,
    error,
    sections,
    settings,
    dirtyChanges,
    changeCount,
    updateDraft,
    discardDraft,
    checkImpact,
    saveChanges,
    resetKeys,
    lockKeys,
    refresh,
  } = useOrderSettings();

  const [activeSectionId, setActiveSectionId] = useState<string>('general');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isCopyOpen, setIsCopyOpen] = useState(false);
  const [isImpactOpen, setIsImpactOpen] = useState(false);
  const [pendingImpact, setPendingImpact] = useState<SettingImpact | null>(null);

  // Map of all effective settings values for dependsOn evaluation
  const allSettingsMap = useMemo(() => {
    const map = new Map<string, any>();
    for (const s of settings) {
      const draft = dirtyChanges[s.key];
      map.set(s.key, draft !== undefined ? draft : s.value);
    }
    return map;
  }, [settings, dirtyChanges]);

  // Active section details
  const activeSection = sections.find((s) => s.id === activeSectionId) || sections[0];

  // Filtered settings list (by section or search query)
  const filteredSettings = useMemo(() => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      return settings.filter(
        (s) =>
          s.key.toLowerCase().includes(q) ||
          s.definition.labelKey.toLowerCase().includes(q) ||
          s.definition.descriptionKey.toLowerCase().includes(q),
      );
    }
    return settings.filter((s) => s.definition.section === activeSectionId);
  }, [settings, activeSectionId, searchQuery]);

  // Handle Save Click
  const handleInitiateSave = async () => {
    try {
      const impact = await checkImpact();
      if (impact.summary.length > 0) {
        setPendingImpact(impact);
        setIsImpactOpen(true);
      } else {
        await saveChanges();
      }
    } catch (err: any) {
      alert(err?.message || 'Değişiklikler kaydedilemedi.');
    }
  };

  const handleConfirmSave = async (reason: string) => {
    try {
      await saveChanges(reason);
      setIsImpactOpen(false);
      setPendingImpact(null);
    } catch (err: any) {
      alert(err?.message || 'Kaydetme başarısız oldu.');
    }
  };

  return (
    <SubPageShell
      title="Sipariş Ayarları"
      subtitle="Sipariş yaşam döngüsü, numaralandırma, stok, ödeme, kargo, fatura ve veri saklama kuralları"
      icon={Cog6ToothIcon}
      actions={
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsCopyOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 shadow-sm transition"
          >
            <DocumentDuplicateIcon className="w-4 h-4 text-indigo-500" />
            <span>Kopyala & Aktar</span>
          </button>

          <button
            type="button"
            onClick={() => setIsHistoryOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 shadow-sm transition"
          >
            <ClockIcon className="w-4 h-4 text-slate-500" />
            <span>Geçmiş</span>
          </button>
        </div>
      }
    >
      {loading && settings.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-slate-400 gap-3">
          <ArrowPathIcon className="w-7 h-7 animate-spin text-indigo-600" />
          <span className="text-sm font-medium">Sipariş ayarları yükleniyor...</span>
        </div>
      ) : error ? (
        <div className="p-4 rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300 flex items-center gap-2 text-sm">
          <ExclamationCircleIcon className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      ) : (
        <div className="flex flex-col lg:flex-row gap-6 items-start pb-24">
          {/* Left Sidebar Navigation */}
          <OrderSettingsSidebar
            sections={sections}
            activeSectionId={activeSectionId}
            onSelectSection={setActiveSectionId}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            scopeLabel={`Kiracı (${tenantPublicId})`}
          />

          {/* Main Content Form Area */}
          <main className="flex-1 w-full space-y-4">
            {/* Section Header */}
            {!searchQuery && activeSection && (
              <div className="pb-3 border-b border-slate-200 dark:border-slate-800">
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                  {activeSection.label}
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {activeSection.description}
                </p>
              </div>
            )}

            {searchQuery && (
              <div className="pb-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                  Arama Sonuçları: &ldquo;{searchQuery}&rdquo;
                </h2>
                <span className="text-xs text-slate-500">
                  {filteredSettings.length} ayar bulundu
                </span>
              </div>
            )}

            {/* Special Widget: Order Number Preview for Numbering Section */}
            {(activeSectionId === 'numbering' || searchQuery.toLowerCase().includes('numara')) && (
              <OrderNumberPreview
                pattern={allSettingsMap.get('order.numbering.pattern')}
                prefix={allSettingsMap.get('order.numbering.prefix')}
                padding={allSettingsMap.get('order.numbering.padding')}
                resetPeriod={allSettingsMap.get('order.numbering.resetPeriod')}
              />
            )}

            {/* Fields List */}
            {filteredSettings.length === 0 ? (
              <div className="text-center py-16 text-slate-400 text-sm">
                Eşleşen ayar bulunamadı.
              </div>
            ) : (
              <div className="space-y-3">
                {filteredSettings.map((s) => (
                  <SettingField
                    key={s.key}
                    setting={s}
                    draftValue={dirtyChanges[s.key]}
                    isDirty={dirtyChanges[s.key] !== undefined}
                    onUpdate={(val) => updateDraft(s.key, val)}
                    onReset={() => resetKeys([s.key])}
                    onToggleLock={(locked) => lockKeys([s.key], locked)}
                    canLock={true}
                    allSettingsMap={allSettingsMap}
                  />
                ))}
              </div>
            )}
          </main>
        </div>
      )}

      {/* Sticky Bottom Action Bar when changes exist */}
      <DirtyActionBar
        changeCount={changeCount}
        saving={saving}
        onSave={handleInitiateSave}
        onDiscard={discardDraft}
      />

      {/* Impact Analysis Modal before saving risky changes */}
      <ImpactModal
        isOpen={isImpactOpen}
        impact={pendingImpact}
        saving={saving}
        onConfirm={handleConfirmSave}
        onCancel={() => setIsImpactOpen(false)}
      />

      {/* History Slide-over Drawer */}
      <HistoryDrawer
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        onReverted={() => {
          refresh();
        }}
      />

      {/* Copy / Export-Import Settings Modal */}
      <CopySettingsModal
        isOpen={isCopyOpen}
        activeStoreId={tenantPublicId}
        onClose={() => setIsCopyOpen(false)}
        onSuccess={() => refresh()}
      />
    </SubPageShell>
  );
}
