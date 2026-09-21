'use client';

import React, { useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  PencilSquareIcon,
  DocumentDuplicateIcon,
  PlayIcon,
  BeakerIcon,
  ClockIcon,
  TrashIcon,
  EllipsisVerticalIcon,
  ChevronUpIcon,
  ChevronDownIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  BoltIcon,
} from '@heroicons/react/24/outline';
import { AutomationRule } from '../types';

interface RulesTabProps {
  rules: AutomationRule[];
  isLoading: boolean;
  canManage: boolean;
  onEdit: (rule: AutomationRule) => void;
  onToggle: (rule: AutomationRule, nextState: boolean) => Promise<any>;
  onDuplicate: (ruleId: string) => Promise<any>;
  onRunManually: (ruleId: string) => Promise<any>;
  onTest: (rule: AutomationRule) => void;
  onVersions: (rule: AutomationRule) => void;
  onDelete: (rule: AutomationRule) => Promise<any>;
  onReorder: (ruleIds: string[]) => Promise<any>;
}

export default function RulesTab({
  rules,
  isLoading,
  canManage,
  onEdit,
  onToggle,
  onDuplicate,
  onRunManually,
  onTest,
  onVersions,
  onDelete,
  onReorder,
}: RulesTabProps) {
  const t = useTranslations('orderAutomation');
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [activatingRule, setActivatingRule] = useState<AutomationRule | null>(null);
  const [runningRuleId, setRunningRuleId] = useState<string | null>(null);

  const handleMove = async (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === rules.length - 1) return;

    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    const reordered = [...rules];
    const temp = reordered[index];
    reordered[index] = reordered[targetIndex];
    reordered[targetIndex] = temp;

    await onReorder(reordered.map((r) => r.id));
  };

  const handleToggleClick = (rule: AutomationRule) => {
    if (!rule.isActive) {
      // Activating: Show confirmation modal explaining scope
      setActivatingRule(rule);
    } else {
      // Deactivating: directly toggle
      onToggle(rule, false);
    }
  };

  const handleConfirmActivation = async () => {
    if (!activatingRule) return;
    await onToggle(activatingRule, true);
    setActivatingRule(null);
  };

  const handleManualRun = async (ruleId: string) => {
    setRunningRuleId(ruleId);
    try {
      await onRunManually(ruleId);
    } finally {
      setRunningRuleId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-kp-xl border border-kp-border bg-kp-surface shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-kp-border bg-kp-bg/50 text-[11px] uppercase tracking-wider text-kp-text-tertiary">
              <tr>
                <th className="px-4 py-3 w-12 text-center">Sıra</th>
                <th className="px-4 py-3">Kural</th>
                <th className="px-4 py-3">Tetikleyici</th>
                <th className="px-4 py-3">Koşullar & Aksiyonlar</th>
                <th className="px-4 py-3 text-center">Durum</th>
                <th className="px-4 py-3">Son Çalışma & İstatistik (24s)</th>
                <th className="px-4 py-3 text-right">İşlemler</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-kp-border">
              {isLoading && rules.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-xs text-kp-text-tertiary">
                    Yükleniyor...
                  </td>
                </tr>
              ) : rules.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center">
                    <div className="flex flex-col items-center justify-center space-y-2">
                      <BoltIcon className="h-8 w-8 text-kp-text-tertiary" />
                      <div className="text-xs font-semibold text-kp-text-secondary">
                        Henüz otomasyon kuralı bulunmuyor
                      </div>
                      <div className="text-[11px] text-kp-text-tertiary">
                        Yeni bir kural oluşturun veya "Hazır Tarifler" sekmesinden şablon seçin.
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                rules.map((rule, idx) => (
                  <tr key={rule.id} className="transition-colors hover:bg-kp-surface-hover">
                    {/* Priority & Reorder Controls */}
                    <td className="px-4 py-3 text-center whitespace-nowrap">
                      <div className="flex items-center justify-center gap-1">
                        <span className="font-mono text-xs font-bold text-kp-text-tertiary">
                          #{rule.priority}
                        </span>
                        {canManage && (
                          <div className="flex flex-col">
                            <button
                              type="button"
                              onClick={() => handleMove(idx, 'up')}
                              disabled={idx === 0}
                              className="text-kp-text-tertiary hover:text-kp-text-primary disabled:opacity-20"
                            >
                              <ChevronUpIcon className="h-3 w-3" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleMove(idx, 'down')}
                              disabled={idx === rules.length - 1}
                              className="text-kp-text-tertiary hover:text-kp-text-primary disabled:opacity-20"
                            >
                              <ChevronDownIcon className="h-3 w-3" />
                            </button>
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Rule Name & Description */}
                    <td className="px-4 py-3">
                      <div className="font-bold text-kp-text-primary">{rule.name}</div>
                      {rule.description && (
                        <div className="mt-0.5 text-[11px] text-kp-text-tertiary line-clamp-1">
                          {rule.description}
                        </div>
                      )}
                      <div className="mt-1 flex items-center gap-1.5 text-[10px] text-kp-text-tertiary">
                        <span>v{rule.version}</span>
                        {rule.stopProcessing && (
                          <span className="rounded-kp-xs bg-kp-warning-muted px-1 text-kp-warning font-medium">
                            Durdurur
                          </span>
                        )}
                        {rule.runOncePerOrder && (
                          <span className="rounded-kp-xs bg-kp-bg px-1 text-kp-text-secondary">
                            1x Sipariş
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Trigger Badge */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="inline-flex items-center rounded-kp-xs bg-kp-bg px-2 py-0.5 font-mono text-[11px] font-semibold text-kp-text-secondary">
                        {rule.triggerType}
                      </span>
                    </td>

                    {/* Conditions and Actions chips */}
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center gap-1 text-[11px]">
                        <span className="rounded-kp-xs bg-kp-bg px-1.5 py-0.5 font-medium text-kp-text-secondary border border-kp-border">
                          {rule.conditions?.conditions?.length || 0} Koşul ({rule.conditions?.operator?.toUpperCase() || 'AND'})
                        </span>
                        <span className="text-kp-text-tertiary">→</span>
                        <span className="rounded-kp-xs bg-kp-accent-muted px-1.5 py-0.5 font-medium text-kp-accent">
                          {rule.actions?.length || 0} Aksiyon
                        </span>
                      </div>
                    </td>

                    {/* Active Toggle */}
                    <td className="px-4 py-3 text-center whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => handleToggleClick(rule)}
                        disabled={!canManage}
                        className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none disabled:opacity-50 ${
                          rule.isActive ? 'bg-kp-success' : 'bg-kp-border'
                        }`}
                      >
                        <span
                          className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-xs ring-0 transition duration-200 ease-in-out ${
                            rule.isActive ? 'translate-x-4' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </td>

                    {/* Last Run & 24h Stats */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="text-[11px] text-kp-text-secondary">
                        {rule.lastRunAt
                          ? new Date(rule.lastRunAt).toLocaleString('tr-TR', {
                              day: '2-digit',
                              month: '2-digit',
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : 'Henüz çalışmadı'}
                      </div>
                      <div className="mt-1 flex items-center gap-2 text-[10px]">
                        <span className="text-kp-text-tertiary">
                          Eşleşme: <strong className="text-kp-text-primary">{rule.matchCount}</strong>
                        </span>
                        {rule.errors24hCount !== undefined && rule.errors24hCount > 0 ? (
                          <span className="inline-flex items-center gap-0.5 rounded-kp-xs bg-kp-danger-muted px-1.5 py-0.2 font-bold text-kp-danger">
                            <ExclamationCircleIcon className="h-3 w-3" />
                            {rule.errors24hCount} Hata (24s)
                          </span>
                        ) : null}
                      </div>
                    </td>

                    {/* Actions Menu */}
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <div className="relative inline-block text-left">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => onEdit(rule)}
                            className="rounded-kp-md p-1 text-kp-text-secondary hover:bg-kp-surface-hover hover:text-kp-text-primary transition-colors"
                            title="Düzenle"
                          >
                            <PencilSquareIcon className="h-4 w-4" />
                          </button>

                          <button
                            type="button"
                            onClick={() => onTest(rule)}
                            className="rounded-kp-md p-1 text-kp-accent hover:bg-kp-surface-hover transition-colors"
                            title="Test Et (Simülasyon)"
                          >
                            <BeakerIcon className="h-4 w-4" />
                          </button>

                          {canManage && (
                            <button
                              type="button"
                              onClick={() => handleManualRun(rule.id)}
                              disabled={runningRuleId === rule.id || !rule.isActive}
                              className="rounded-kp-md p-1 text-kp-text-secondary hover:bg-kp-surface-hover hover:text-kp-text-primary transition-colors disabled:opacity-30"
                              title={rule.isActive ? 'Mevcut siparişlerde elle çalıştır' : 'Önce kuralı aktifleştirin'}
                            >
                              <PlayIcon className={`h-4 w-4 ${runningRuleId === rule.id ? 'animate-spin' : ''}`} />
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => setActiveMenuId(activeMenuId === rule.id ? null : rule.id)}
                            className="rounded-kp-md p-1 text-kp-text-tertiary hover:bg-kp-surface-hover hover:text-kp-text-primary transition-colors"
                          >
                            <EllipsisVerticalIcon className="h-4 w-4" />
                          </button>
                        </div>

                        {/* Dropdown Menu */}
                        {activeMenuId === rule.id && (
                          <div className="absolute right-0 z-20 mt-1 w-44 rounded-kp-md border border-kp-border bg-kp-surface p-1 shadow-lg">
                            <button
                              type="button"
                              onClick={() => {
                                onDuplicate(rule.id);
                                setActiveMenuId(null);
                              }}
                              className="flex w-full items-center gap-2 rounded-kp-xs px-2.5 py-1.5 text-xs text-kp-text-secondary hover:bg-kp-surface-hover hover:text-kp-text-primary"
                            >
                              <DocumentDuplicateIcon className="h-3.5 w-3.5" />
                              <span>Kopyala</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                onVersions(rule);
                                setActiveMenuId(null);
                              }}
                              className="flex w-full items-center gap-2 rounded-kp-xs px-2.5 py-1.5 text-xs text-kp-text-secondary hover:bg-kp-surface-hover hover:text-kp-text-primary"
                            >
                              <ClockIcon className="h-3.5 w-3.5" />
                              <span>Versiyon Geçmişi</span>
                            </button>

                            {canManage && (
                              <button
                                type="button"
                                onClick={() => {
                                  if (window.confirm(`"${rule.name}" kuralı silinsin mi?`)) {
                                    onDelete(rule);
                                  }
                                  setActiveMenuId(null);
                                }}
                                className="flex w-full items-center gap-2 rounded-kp-xs px-2.5 py-1.5 text-xs text-kp-danger hover:bg-kp-danger-muted"
                              >
                                <TrashIcon className="h-3.5 w-3.5" />
                                <span>Sil</span>
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Activation Confirmation Modal */}
      {activatingRule && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-kp-xl border border-kp-border bg-kp-surface p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-kp-success-muted text-kp-success">
                <CheckCircleIcon className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-kp-text-primary">
                  Kuralı Etkinleştir
                </h3>
                <p className="text-xs text-kp-text-tertiary">
                  "{activatingRule.name}" kuralı aktif duruma getirilecek.
                </p>
              </div>
            </div>

            <div className="rounded-kp-md bg-kp-bg p-3.5 text-xs text-kp-text-secondary leading-relaxed">
              Bu kural <strong>bundan sonra oluşan veya tetiklenen yeni siparişlere</strong> otomatik olarak uygulanacaktır. Geçmiş siparişlerinizi güncellemek için kural satırındaki <strong>"Elle Çalıştır"</strong> seçeneğini kullanabilirsiniz.
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setActivatingRule(null)}
                className="rounded-kp-md border border-kp-border bg-kp-surface px-3 py-1.5 text-xs font-semibold text-kp-text-secondary hover:bg-kp-surface-hover"
              >
                Vazgeç
              </button>
              <button
                type="button"
                onClick={handleConfirmActivation}
                className="rounded-kp-md bg-kp-success px-4 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-kp-success/90"
              >
                Etkinleştir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
