'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import {
  XMarkIcon,
  PlusIcon,
  TrashIcon,
  ChevronUpIcon,
  ChevronDownIcon,
  SparklesIcon,
  BoltIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  ArrowPathIcon,
  BeakerIcon,
  ArrowUturnLeftIcon,
  AdjustmentsHorizontalIcon,
  InformationCircleIcon,
  TagIcon,
  TruckIcon,
  BuildingStorefrontIcon,
  CurrencyDollarIcon,
  DocumentTextIcon,
  PauseCircleIcon,
} from '@heroicons/react/24/outline';
import {
  AutomationCatalog,
  AutomationRule,
  ConditionNode,
  ConditionOperator,
  ConditionTree,
  DryRunResult,
  BacktestResult,
  RuleAction,
  TriggerType,
  ActionType,
} from '../types';
import {
  TRIGGER_METADATA,
  FIELD_METADATA,
  OPERATOR_METADATA,
  ACTION_METADATA,
  FALLBACK_CATALOG,
  generateNaturalLanguageSummary,
} from '../constants/automationCatalog';

interface RuleEditorDrawerProps {
  catalog: AutomationCatalog | null;
  rule?: AutomationRule | null;
  initialTemplate?: any | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (payload: any) => Promise<any>;
  onDryRun?: (payload: any) => Promise<DryRunResult>;
  onBacktest?: (id: string, days?: number) => Promise<BacktestResult>;
  onRestoreVersion?: (ruleId: string, version: number) => Promise<any>;
}

export default function RuleEditorDrawer({
  catalog: rawCatalog,
  rule,
  initialTemplate,
  isOpen,
  onClose,
  onSave,
  onDryRun,
  onBacktest,
  onRestoreVersion,
}: RuleEditorDrawerProps) {
  const t = useTranslations('orderAutomation');
  const tc = useTranslations('common');

  // Use fallback catalog if API catalog is not yet loaded
  const catalog = rawCatalog || FALLBACK_CATALOG;

  // Form State
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [triggerType, setTriggerType] = useState<TriggerType>('ORDER_CREATED');
  const [triggerConfig, setTriggerConfig] = useState<Record<string, any>>({});
  const [conditionOperator, setConditionOperator] = useState<'and' | 'or'>('and');
  const [conditions, setConditions] = useState<ConditionNode[]>([]);
  const [actions, setActions] = useState<RuleAction[]>([]);
  const [priority, setPriority] = useState<number>(100);
  const [stopProcessing, setStopProcessing] = useState(false);
  const [runOncePerOrder, setRunOncePerOrder] = useState(true);
  const [isActive, setIsActive] = useState(false);

  // Active Tab in Drawer: 'editor' | 'test' | 'versions'
  const [activeTab, setActiveTab] = useState<'editor' | 'test' | 'versions'>('editor');

  // Dry run test state
  const [testOrderId, setTestOrderId] = useState('');
  const [testLoading, setTestLoading] = useState(false);
  const [testResult, setTestResult] = useState<DryRunResult | null>(null);
  const [testError, setTestError] = useState<string | null>(null);

  // Backtest state
  const [backtestDays, setBacktestDays] = useState(30);
  const [backtestLoading, setBacktestLoading] = useState(false);
  const [backtestResult, setBacktestResult] = useState<BacktestResult | null>(null);
  const [backtestError, setBacktestError] = useState<string | null>(null);

  // Saving state
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize or Reset form
  useEffect(() => {
    if (!isOpen) return;

    if (rule) {
      setName(rule.name);
      setDescription(rule.description || '');
      setTriggerType(rule.triggerType);
      setTriggerConfig(rule.triggerConfig || {});
      setConditionOperator(rule.conditions?.operator || 'and');
      setConditions(
        (rule.conditions?.conditions || []).filter((c: any) => 'field' in c) as ConditionNode[],
      );
      setActions(rule.actions || []);
      setPriority(rule.priority ?? 100);
      setStopProcessing(!!rule.stopProcessing);
      setRunOncePerOrder(rule.runOncePerOrder !== undefined ? !!rule.runOncePerOrder : true);
      setIsActive(!!rule.isActive);
    } else if (initialTemplate) {
      setName(initialTemplate.name || '');
      setDescription(initialTemplate.description || '');
      setTriggerType(initialTemplate.triggerType || 'ORDER_CREATED');
      setTriggerConfig(initialTemplate.triggerConfig || {});
      setConditionOperator(initialTemplate.conditions?.operator || 'and');
      setConditions(
        (initialTemplate.conditions?.conditions || []).filter((c: any) => 'field' in c) as ConditionNode[],
      );
      setActions(initialTemplate.actions || []);
      setPriority(initialTemplate.priority ?? 50);
      setStopProcessing(!!initialTemplate.stopProcessing);
      setRunOncePerOrder(initialTemplate.runOncePerOrder !== undefined ? !!initialTemplate.runOncePerOrder : true);
      setIsActive(false); // Templates start inactive
    } else {
      setName('');
      setDescription('');
      setTriggerType('ORDER_CREATED');
      setTriggerConfig({});
      setConditionOperator('and');
      setConditions([]);
      setActions([{ type: 'ADD_TAG', config: { tag: '' } }]);
      setPriority(100);
      setStopProcessing(false);
      setRunOncePerOrder(true);
      setIsActive(false);
    }

    setTestResult(null);
    setTestError(null);
    setBacktestResult(null);
    setBacktestError(null);
    setError(null);
    setActiveTab('editor');
  }, [isOpen, rule, initialTemplate]);

  // Live Natural Language Summary
  const naturalLanguageSummary = useMemo(() => {
    return generateNaturalLanguageSummary(
      triggerType,
      triggerConfig,
      conditions,
      conditionOperator,
      actions,
    );
  }, [triggerType, triggerConfig, conditions, conditionOperator, actions]);

  // Handle Conditions
  const addCondition = () => {
    setConditions((prev) => [...prev, { field: 'totalAmount', operator: 'gte', value: '' }]);
  };

  const updateCondition = (index: number, patch: Partial<ConditionNode>) => {
    setConditions((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], ...patch };
      return updated;
    });
  };

  const removeCondition = (index: number) => {
    setConditions((prev) => prev.filter((_, i) => i !== index));
  };

  // Handle Actions
  const addAction = (actionType?: ActionType) => {
    const act = actionType || 'ADD_TAG';
    setActions((prev) => [...prev, { type: act, config: {} }]);
  };

  const updateAction = (index: number, patch: Partial<RuleAction>) => {
    setActions((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], ...patch };
      return updated;
    });
  };

  const moveAction = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === actions.length - 1) return;

    setActions((prev) => {
      const updated = [...prev];
      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      const temp = updated[index];
      updated[index] = updated[targetIndex];
      updated[targetIndex] = temp;
      return updated;
    });
  };

  const removeAction = (index: number) => {
    setActions((prev) => prev.filter((_, i) => i !== index));
  };

  // Handle Submit
  const handleSave = async () => {
    if (!name.trim()) {
      setError('Lütfen kural için bir isim belirleyin.');
      return;
    }
    if (actions.length === 0) {
      setError('En az bir aksiyon belirlemelisiniz.');
      return;
    }

    // Sanitize conditions
    const formattedConditions: ConditionTree = {
      version: 1,
      operator: conditionOperator,
      conditions: conditions.map((c) => {
        let val = c.value;
        const fldMeta = FIELD_METADATA[c.field];
        if (fldMeta?.type === 'number' && typeof val === 'string' && val.trim()) {
          val = Number(val);
        }
        return {
          field: c.field,
          operator: c.operator,
          value: val,
        };
      }),
    };

    const payload = {
      name: name.trim(),
      description: description.trim() || undefined,
      triggerType,
      triggerConfig,
      conditions: formattedConditions,
      actions,
      priority: Number(priority) || 100,
      stopProcessing,
      runOncePerOrder,
      isActive,
    };

    setIsSaving(true);
    setError(null);
    try {
      await onSave(payload);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Kural kaydedilirken bir hata oluştu.');
    } finally {
      setIsSaving(false);
    }
  };

  // Run Dry Run Test
  const handleRunTest = async () => {
    if (!testOrderId.trim()) {
      setTestError('Lütfen test edilecek bir Sipariş ID girin.');
      return;
    }
    if (!onDryRun) return;

    setTestLoading(true);
    setTestResult(null);
    setTestError(null);

    try {
      const formattedConditions: ConditionTree = {
        version: 1,
        operator: conditionOperator,
        conditions,
      };

      const res = await onDryRun({
        orderId: testOrderId.trim(),
        rule: {
          name: name || 'Simülasyon',
          triggerType,
          conditions: formattedConditions,
          actions,
        },
      });
      setTestResult(res);
    } catch (err: any) {
      setTestError(err?.message || 'Simülasyon çalıştırılamadı.');
    } finally {
      setTestLoading(false);
    }
  };

  // Run Backtest
  const handleRunBacktest = async () => {
    if (!rule?.id || !onBacktest) return;

    setBacktestLoading(true);
    setBacktestResult(null);
    setBacktestError(null);

    try {
      const res = await onBacktest(rule.id, backtestDays);
      setBacktestResult(res);
    } catch (err: any) {
      setBacktestError(err?.message || 'Geriye dönük test başarısız oldu.');
    } finally {
      setBacktestLoading(false);
    }
  };

  if (!isOpen) return null;

  const activeTriggerMeta = TRIGGER_METADATA[triggerType] || {
    title: triggerType,
    badge: 'Tetikleyici',
    description: '',
    badgeColor: 'bg-kp-accent/10 text-kp-accent',
  };

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm transition-opacity"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative flex h-full w-full max-w-4xl flex-col bg-white dark:bg-slate-900 shadow-2xl border-l border-kp-border">
        {/* Drawer Header */}
        <div className="flex items-center justify-between border-b border-kp-border px-6 py-4 bg-white dark:bg-slate-900 sticky top-0 z-20">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-kp-lg bg-kp-accent/10 text-kp-accent">
              <BoltIcon className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-kp-text-primary">
                  {rule ? 'Otomasyon Kuralını Düzenle' : 'Yeni Otomasyon Kuralı Oluştur'}
                </h2>
                <span className="rounded-full px-2 py-0.5 text-[10px] font-bold bg-kp-accent/10 text-kp-accent">
                  {rule ? `v${rule.version}` : 'Yeni Taslak'}
                </span>
              </div>
              <p className="text-xs text-kp-text-tertiary">
                Tetikleyici, filtre koşulları ve uygulanacak aksiyonları adım adım yapılandırın.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Tab Switches */}
            <div className="flex items-center rounded-kp-md border border-kp-border bg-slate-100 dark:bg-slate-800 p-1 text-xs">
              <button
                type="button"
                onClick={() => setActiveTab('editor')}
                className={`rounded-kp-sm px-3 py-1 font-medium transition-all ${
                  activeTab === 'editor'
                    ? 'bg-white dark:bg-slate-700 text-kp-accent font-semibold shadow-xs'
                    : 'text-kp-text-secondary hover:text-kp-text-primary'
                }`}
              >
                Kural Editörü
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('test')}
                className={`flex items-center gap-1 rounded-kp-sm px-3 py-1 font-medium transition-all ${
                  activeTab === 'test'
                    ? 'bg-white dark:bg-slate-700 text-kp-accent font-semibold shadow-xs'
                    : 'text-kp-text-secondary hover:text-kp-text-primary'
                }`}
              >
                <BeakerIcon className="h-3.5 w-3.5" />
                <span>Test & Simülasyon</span>
              </button>
              {rule?.versions && rule.versions.length > 0 && (
                <button
                  type="button"
                  onClick={() => setActiveTab('versions')}
                  className={`flex items-center gap-1 rounded-kp-sm px-3 py-1 font-medium transition-all ${
                    activeTab === 'versions'
                      ? 'bg-white dark:bg-slate-700 text-kp-accent font-semibold shadow-xs'
                      : 'text-kp-text-secondary hover:text-kp-text-primary'
                  }`}
                >
                  <ClockIcon className="h-3.5 w-3.5" />
                  <span>Geçmiş ({rule.versions.length})</span>
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={onClose}
              className="rounded-kp-md p-1.5 text-kp-text-tertiary hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-kp-text-primary transition-colors"
              title="Kapat"
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Live Natural Language Summary Banner */}
        <div className="border-b border-kp-border bg-slate-50 dark:bg-slate-800/80 px-6 py-3.5">
          <div className="flex items-start gap-2.5 text-xs">
            <div className="rounded-full bg-kp-accent/15 p-1 text-kp-accent shrink-0 mt-0.5">
              <SparklesIcon className="h-4 w-4" />
            </div>
            <div className="text-kp-text-secondary leading-relaxed">
              <span className="font-bold text-kp-text-primary uppercase tracking-wider text-[11px] mr-1">
                Kural Özeti:
              </span>
              <span className="font-medium text-kp-text-primary">
                {naturalLanguageSummary}
              </span>
            </div>
          </div>
        </div>

        {/* Drawer Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-100/70 dark:bg-slate-950">
          {error && (
            <div className="rounded-kp-md border border-kp-danger/40 bg-kp-danger-muted p-3.5 text-xs text-kp-danger flex items-center gap-2">
              <XCircleIcon className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {activeTab === 'editor' && (
            <div className="space-y-6">
              {/* SECTION 1: Ne Zaman? (Tetikleyici) */}
              <div className="rounded-kp-xl border border-kp-border bg-white dark:bg-slate-900 p-5 shadow-xs space-y-4">
                <div className="flex items-center justify-between border-b border-kp-border/60 pb-3">
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-kp-accent text-xs font-bold text-white shadow-xs">
                      1
                    </span>
                    <h3 className="text-sm font-bold text-kp-text-primary">
                      Ne zaman çalışsın? (Tetikleyici Olay)
                    </h3>
                  </div>
                  <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${activeTriggerMeta.badgeColor}`}>
                    {activeTriggerMeta.badge}
                  </span>
                </div>

                <div className="space-y-3">
                  <label className="block text-xs font-semibold text-kp-text-secondary">
                    Tetikleyici Olayı Seçin
                  </label>
                  <select
                    value={triggerType}
                    onChange={(e) => setTriggerType(e.target.value as TriggerType)}
                    className="w-full rounded-kp-md border border-kp-border bg-white dark:bg-slate-900 px-3 py-2.5 text-xs font-medium text-kp-text-primary focus:border-kp-accent focus:outline-none shadow-xs"
                  >
                    {Object.values(TRIGGER_METADATA).map((trig) => (
                      <option key={trig.key} value={trig.key}>
                        {trig.title}
                      </option>
                    ))}
                  </select>

                  {activeTriggerMeta.description && (
                    <p className="text-[11px] text-kp-text-tertiary flex items-center gap-1.5">
                      <InformationCircleIcon className="h-3.5 w-3.5 text-kp-accent shrink-0" />
                      <span>{activeTriggerMeta.description}</span>
                    </p>
                  )}

                  {/* Trigger Specific Configs */}
                  {triggerType === 'ORDER_STATUS_CHANGED' && (
                    <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3 rounded-kp-md border border-kp-border bg-slate-50 dark:bg-slate-800/60 p-3">
                      <div>
                        <label className="block text-[11px] font-semibold text-kp-text-tertiary mb-1">
                          Eski Durum (İsteğe Bağlı)
                        </label>
                        <select
                          value={triggerConfig.fromStatus || ''}
                          onChange={(e) => setTriggerConfig((p) => ({ ...p, fromStatus: e.target.value }))}
                          className="w-full rounded-kp-md border border-kp-border bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs text-kp-text-primary"
                        >
                          <option value="">Fark etmez (Herhangi biri)</option>
                          <option value="pending">Beklemede (pending)</option>
                          <option value="processing">İşleniyor (processing)</option>
                          <option value="shipped">Kargoda (shipped)</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-kp-text-tertiary mb-1">
                          Yeni Durum <span className="text-kp-danger">*</span>
                        </label>
                        <select
                          value={triggerConfig.toStatus || ''}
                          onChange={(e) => setTriggerConfig((p) => ({ ...p, toStatus: e.target.value }))}
                          className="w-full rounded-kp-md border border-kp-border bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs font-semibold text-kp-text-primary"
                        >
                          <option value="">Hedef durum seçin...</option>
                          <option value="processing">İşleniyor / Onaylandı (processing)</option>
                          <option value="shipped">Kargoya Verildi (shipped)</option>
                          <option value="delivered">Teslim Edildi (delivered)</option>
                          <option value="cancelled">İptal Edildi (cancelled)</option>
                        </select>
                      </div>
                    </div>
                  )}

                  {triggerType === 'ORDER_IDLE' && (
                    <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3 rounded-kp-md border border-kp-border bg-slate-50 dark:bg-slate-800/60 p-3">
                      <div>
                        <label className="block text-[11px] font-semibold text-kp-text-tertiary mb-1">
                          Hareketsiz Kalan Durum
                        </label>
                        <select
                          value={triggerConfig.idleStatus || 'pending'}
                          onChange={(e) => setTriggerConfig((p) => ({ ...p, idleStatus: e.target.value }))}
                          className="w-full rounded-kp-md border border-kp-border bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs text-kp-text-primary"
                        >
                          <option value="pending">Beklemede (pending)</option>
                          <option value="processing">Hazırlanıyor (processing)</option>
                          <option value="shipped">Kargoda (shipped)</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-kp-text-tertiary mb-1">
                          Geçen Süre (Saat)
                        </label>
                        <input
                          type="number"
                          min={1}
                          value={triggerConfig.idleHours ?? 24}
                          onChange={(e) => setTriggerConfig((p) => ({ ...p, idleHours: Number(e.target.value) }))}
                          placeholder="24"
                          className="w-full rounded-kp-md border border-kp-border bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs text-kp-text-primary"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* SECTION 2: Eğer... (Filtre Koşulları) */}
              <div className="rounded-kp-xl border border-kp-border bg-white dark:bg-slate-900 p-5 shadow-xs space-y-4">
                <div className="flex items-center justify-between border-b border-kp-border/60 pb-3">
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-kp-accent text-xs font-bold text-white shadow-xs">
                      2
                    </span>
                    <h3 className="text-sm font-bold text-kp-text-primary">
                      Hangi siparişler için geçerli? (Koşullar)
                    </h3>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs text-kp-text-tertiary">Bağlaç:</span>
                    <div className="flex rounded-kp-md border border-kp-border bg-slate-50 dark:bg-slate-800/60 p-0.5 text-xs font-bold">
                      <button
                        type="button"
                        onClick={() => setConditionOperator('and')}
                        className={`rounded-kp-sm px-2.5 py-1 transition-all ${
                          conditionOperator === 'and'
                            ? 'bg-kp-accent text-white shadow-xs'
                            : 'text-kp-text-secondary hover:text-kp-text-primary'
                        }`}
                      >
                        VE (Hepsi)
                      </button>
                      <button
                        type="button"
                        onClick={() => setConditionOperator('or')}
                        className={`rounded-kp-sm px-2.5 py-1 transition-all ${
                          conditionOperator === 'or'
                            ? 'bg-kp-accent text-white shadow-xs'
                            : 'text-kp-text-secondary hover:text-kp-text-primary'
                        }`}
                      >
                        VEYA (En Az Biri)
                      </button>
                    </div>
                  </div>
                </div>

                {conditions.length === 0 ? (
                  <div className="rounded-kp-lg border-2 border-dashed border-kp-border/70 p-6 text-center bg-slate-50 dark:bg-slate-800/40">
                    <AdjustmentsHorizontalIcon className="h-8 w-8 text-kp-text-tertiary mx-auto mb-2 opacity-60" />
                    <p className="text-xs font-semibold text-kp-text-secondary">
                      Özel bir filtre koşulu eklenmedi
                    </p>
                    <p className="text-[11px] text-kp-text-tertiary mt-1 max-w-md mx-auto">
                      Bu tetikleyici gerçekleştiğinde kural <strong>tüm siparişlere</strong> koşulsuz olarak uygulanacaktır.
                    </p>
                    <button
                      type="button"
                      onClick={addCondition}
                      className="mt-3 inline-flex items-center gap-1.5 rounded-kp-md border border-kp-border bg-white dark:bg-slate-900 px-3.5 py-1.5 text-xs font-semibold text-kp-accent shadow-xs hover:bg-slate-50 dark:hover:bg-slate-800"
                    >
                      <PlusIcon className="h-3.5 w-3.5" />
                      Filtre Koşulu Ekle
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {conditions.map((cond, idx) => {
                      const fMeta = FIELD_METADATA[cond.field] || {
                        label: cond.field,
                        type: 'string',
                      };
                      const opMeta = OPERATOR_METADATA[cond.operator];

                      return (
                        <div
                          key={idx}
                          className="flex flex-wrap items-center gap-2 rounded-kp-lg border border-kp-border bg-white dark:bg-slate-900 p-3 shadow-xs"
                        >
                          {/* Field Selector */}
                          <div className="w-56">
                            <select
                              value={cond.field}
                              onChange={(e) => {
                                const newField = e.target.value;
                                const newFMeta = FIELD_METADATA[newField];
                                const defaultOp = newFMeta?.type === 'number' ? 'gte' : 'eq';
                                updateCondition(idx, {
                                  field: newField,
                                  operator: defaultOp as ConditionOperator,
                                  value: '',
                                });
                              }}
                              className="w-full rounded-kp-md border border-kp-border bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs font-medium text-kp-text-primary focus:border-kp-accent focus:outline-none"
                            >
                              {Object.values(FIELD_METADATA).map((f) => (
                                <option key={f.key} value={f.key}>
                                  {f.label}
                                </option>
                              ))}
                            </select>
                          </div>

                          {/* Operator Selector */}
                          <div className="w-44">
                            <select
                              value={cond.operator}
                              onChange={(e) =>
                                updateCondition(idx, { operator: e.target.value as ConditionOperator })
                              }
                              className="w-full rounded-kp-md border border-kp-border bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs font-semibold text-kp-text-primary focus:border-kp-accent focus:outline-none"
                            >
                              {Object.values(OPERATOR_METADATA).map((op) => (
                                <option key={op.key} value={op.key}>
                                  {op.symbol} {op.label}
                                </option>
                              ))}
                            </select>
                          </div>

                          {/* Value Input (Smart Input based on Field & Operator) */}
                          <div className="flex-1 min-w-[180px]">
                            {cond.operator === 'is_empty' || cond.operator === 'is_not_empty' ? (
                              <div className="rounded-kp-md bg-slate-100 dark:bg-slate-800 px-3 py-1.5 text-xs text-kp-text-tertiary italic">
                                Değer gerekmez (Otomatik kontrol)
                              </div>
                            ) : fMeta.options ? (
                              <select
                                value={cond.value || ''}
                                onChange={(e) => updateCondition(idx, { value: e.target.value })}
                                className="w-full rounded-kp-md border border-kp-border bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs text-kp-text-primary focus:border-kp-accent focus:outline-none"
                              >
                                <option value="">Seçiniz...</option>
                                {fMeta.options.map((opt) => (
                                  <option key={opt.value} value={opt.value}>
                                    {opt.label}
                                  </option>
                                ))}
                              </select>
                            ) : fMeta.type === 'boolean' ? (
                              <select
                                value={String(cond.value)}
                                onChange={(e) => updateCondition(idx, { value: e.target.value === 'true' })}
                                className="w-full rounded-kp-md border border-kp-border bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs text-kp-text-primary focus:border-kp-accent focus:outline-none"
                              >
                                <option value="true">Evet (Doğru)</option>
                                <option value="false">Hayır (Yanlış)</option>
                              </select>
                            ) : (
                              <div className="relative">
                                <input
                                  type={fMeta.type === 'number' ? 'number' : 'text'}
                                  value={
                                    Array.isArray(cond.value)
                                      ? cond.value.join(', ')
                                      : cond.value ?? ''
                                  }
                                  onChange={(e) => {
                                    const raw = e.target.value;
                                    if (cond.operator === 'in' || cond.operator === 'not_in') {
                                      updateCondition(idx, {
                                        value: raw.split(',').map((s) => s.trim()),
                                      });
                                    } else {
                                      updateCondition(idx, { value: raw });
                                    }
                                  }}
                                  placeholder={
                                    cond.operator === 'in' || cond.operator === 'not_in'
                                      ? 'Virgülle ayırarak yazın (Örn: İstanbul, Ankara)'
                                      : fMeta.placeholder || 'Değer girin...'
                                  }
                                  className="w-full rounded-kp-md border border-kp-border bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs text-kp-text-primary focus:border-kp-accent focus:outline-none"
                                />
                                {fMeta.unit && (
                                  <span className="absolute right-2.5 top-1.5 text-[11px] font-bold text-kp-text-tertiary">
                                    {fMeta.unit}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>

                          {/* Delete Condition */}
                          <button
                            type="button"
                            onClick={() => removeCondition(idx)}
                            className="rounded-kp-md p-1.5 text-kp-danger hover:bg-kp-danger-muted transition-colors"
                            title="Koşulu Sil"
                          >
                            <TrashIcon className="h-4 w-4" />
                          </button>
                        </div>
                      );
                    })}

                    <button
                      type="button"
                      onClick={addCondition}
                      className="inline-flex items-center gap-1.5 rounded-kp-md border border-kp-border bg-white dark:bg-slate-900 px-3 py-1.5 text-xs font-semibold text-kp-accent shadow-xs hover:bg-slate-50 dark:hover:bg-slate-800"
                    >
                      <PlusIcon className="h-3.5 w-3.5" />
                      + Başka Bir Koşul Ekle
                    </button>
                  </div>
                )}
              </div>

              {/* SECTION 3: O Zaman... (Sıralı Aksiyonlar) */}
              <div className="rounded-kp-xl border border-kp-border bg-white dark:bg-slate-900 p-5 shadow-xs space-y-4">
                <div className="flex items-center justify-between border-b border-kp-border/60 pb-3">
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-kp-accent text-xs font-bold text-white shadow-xs">
                      3
                    </span>
                    <h3 className="text-sm font-bold text-kp-text-primary">
                      Ne yapılsın? (Sıralı Aksiyonlar)
                    </h3>
                  </div>

                  <button
                    type="button"
                    onClick={() => addAction('ADD_TAG')}
                    className="inline-flex items-center gap-1 rounded-kp-md bg-kp-accent px-3 py-1 text-xs font-semibold text-white shadow-xs hover:bg-kp-accent/90"
                  >
                    <PlusIcon className="h-3.5 w-3.5" />
                    Aksiyon Ekle
                  </button>
                </div>

                <div className="space-y-3">
                  {actions.map((action, idx) => {
                    const actMeta = ACTION_METADATA[action.type] || {
                      title: action.type,
                      badge: 'Aksiyon',
                      description: '',
                      badgeColor: 'bg-kp-accent/10 text-kp-accent',
                    };

                    return (
                      <div
                        key={idx}
                        className="rounded-kp-lg border border-kp-border bg-white dark:bg-slate-900 p-4 shadow-xs space-y-3 transition-all"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2.5">
                            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 text-xs font-bold text-kp-text-secondary border border-kp-border">
                              #{idx + 1}
                            </span>
                            <select
                              value={action.type}
                              onChange={(e) =>
                                updateAction(idx, { type: e.target.value as ActionType, config: {} })
                              }
                              className="rounded-kp-md border border-kp-border bg-white dark:bg-slate-900 px-3 py-1.5 text-xs font-bold text-kp-text-primary focus:border-kp-accent focus:outline-none"
                            >
                              {Object.values(ACTION_METADATA).map((a) => (
                                <option key={a.key} value={a.key}>
                                  {a.title}
                                </option>
                              ))}
                            </select>
                            <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${actMeta.badgeColor}`}>
                              {actMeta.badge}
                            </span>
                          </div>

                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => moveAction(idx, 'up')}
                              disabled={idx === 0}
                              className="rounded-kp-sm p-1 text-kp-text-tertiary hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-30"
                              title="Yukarı Taşı"
                            >
                              <ChevronUpIcon className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => moveAction(idx, 'down')}
                              disabled={idx === actions.length - 1}
                              className="rounded-kp-sm p-1 text-kp-text-tertiary hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-30"
                              title="Aşağı Taşı"
                            >
                              <ChevronDownIcon className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => removeAction(idx)}
                              className="rounded-kp-sm p-1 text-kp-danger hover:bg-kp-danger-muted"
                              title="Aksiyonu Sil"
                            >
                              <TrashIcon className="h-4 w-4" />
                            </button>
                          </div>
                        </div>

                        {actMeta.description && (
                          <p className="text-[11px] text-kp-text-tertiary pl-8">
                            {actMeta.description}
                          </p>
                        )}

                        {/* Action Specific Config Form */}
                        <div className="pt-2 border-t border-kp-border/50 pl-8">
                          {action.type === 'ADD_TAG' && (
                            <div>
                              <label className="block text-[11px] font-semibold text-kp-text-secondary mb-1">
                                Eklenecek Etiket Adı <span className="text-kp-danger">*</span>
                              </label>
                              <input
                                type="text"
                                value={action.config?.tag || ''}
                                onChange={(e) =>
                                  updateAction(idx, { config: { ...action.config, tag: e.target.value } })
                                }
                                placeholder="Örn: teyit-gerekli, buyuk-paket, vip"
                                className="w-full max-w-md rounded-kp-md border border-kp-border bg-white dark:bg-slate-900 px-3 py-1.5 text-xs text-kp-text-primary"
                              />
                            </div>
                          )}

                          {action.type === 'REMOVE_TAG' && (
                            <div>
                              <label className="block text-[11px] font-semibold text-kp-text-secondary mb-1">
                                Kaldırılacak Etiket Adı <span className="text-kp-danger">*</span>
                              </label>
                              <input
                                type="text"
                                value={action.config?.tag || ''}
                                onChange={(e) =>
                                  updateAction(idx, { config: { ...action.config, tag: e.target.value } })
                                }
                                placeholder="Örn: teyit-gerekli"
                                className="w-full max-w-md rounded-kp-md border border-kp-border bg-white dark:bg-slate-900 px-3 py-1.5 text-xs text-kp-text-primary"
                              />
                            </div>
                          )}

                          {action.type === 'HOLD_ORDER' && (
                            <div>
                              <label className="block text-[11px] font-semibold text-kp-text-secondary mb-1">
                                Bekletme Gerekçesi (Açıklama)
                              </label>
                              <input
                                type="text"
                                value={action.config?.reason || ''}
                                onChange={(e) =>
                                  updateAction(idx, { config: { ...action.config, reason: e.target.value } })
                                }
                                placeholder="Örn: Yüksek tutarlı sipariş - telefon onayı bekleniyor"
                                className="w-full rounded-kp-md border border-kp-border bg-white dark:bg-slate-900 px-3 py-1.5 text-xs text-kp-text-primary"
                              />
                            </div>
                          )}

                          {action.type === 'SET_ORDER_STATUS' && (
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                              <div>
                                <label className="block text-[11px] font-semibold text-kp-text-secondary mb-1">
                                  Sipariş Durumu
                                </label>
                                <select
                                  value={action.config?.status || ''}
                                  onChange={(e) =>
                                    updateAction(idx, { config: { ...action.config, status: e.target.value } })
                                  }
                                  className="w-full rounded-kp-md border border-kp-border bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs text-kp-text-primary"
                                >
                                  <option value="">Değiştirme</option>
                                  <option value="pending">Beklemede</option>
                                  <option value="processing">İşleniyor / Onaylandı</option>
                                  <option value="shipped">Kargoda</option>
                                  <option value="delivered">Teslim Edildi</option>
                                  <option value="cancelled">İptal</option>
                                </select>
                              </div>
                              <div>
                                <label className="block text-[11px] font-semibold text-kp-text-secondary mb-1">
                                  Ödeme Durumu
                                </label>
                                <select
                                  value={action.config?.paymentStatus || ''}
                                  onChange={(e) =>
                                    updateAction(idx, { config: { ...action.config, paymentStatus: e.target.value } })
                                  }
                                  className="w-full rounded-kp-md border border-kp-border bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs text-kp-text-primary"
                                >
                                  <option value="">Değiştirme</option>
                                  <option value="paid">Ödendi</option>
                                  <option value="pending">Ödeme Bekliyor</option>
                                  <option value="refunded">İade Edildi</option>
                                </select>
                              </div>
                              <div>
                                <label className="block text-[11px] font-semibold text-kp-text-secondary mb-1">
                                  Hazırlık Durumu
                                </label>
                                <select
                                  value={action.config?.fulfillmentStatus || ''}
                                  onChange={(e) =>
                                    updateAction(idx, { config: { ...action.config, fulfillmentStatus: e.target.value } })
                                  }
                                  className="w-full rounded-kp-md border border-kp-border bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs text-kp-text-primary"
                                >
                                  <option value="">Değiştirme</option>
                                  <option value="fulfilled">Hazırlandı</option>
                                  <option value="unfulfilled">Hazırlanmadı</option>
                                </select>
                              </div>
                            </div>
                          )}

                          {action.type === 'SET_PRIORITY' && (
                            <div>
                              <label className="block text-[11px] font-semibold text-kp-text-secondary mb-1">
                                Atanacak Öncelik Seviyesi
                              </label>
                              <select
                                value={action.config?.priority || 'high'}
                                onChange={(e) =>
                                  updateAction(idx, { config: { ...action.config, priority: e.target.value } })
                                }
                                className="w-full max-w-xs rounded-kp-md border border-kp-border bg-white dark:bg-slate-900 px-3 py-1.5 text-xs font-semibold text-kp-text-primary"
                              >
                                <option value="low">Düşük Öncelik</option>
                                <option value="normal">Normal</option>
                                <option value="high">Yüksek Öncelik</option>
                                <option value="urgent">Kritik / Acil Öncelik</option>
                              </select>
                            </div>
                          )}

                          {action.type === 'ASSIGN_CARRIER' && (
                            <div>
                              <label className="block text-[11px] font-semibold text-kp-text-secondary mb-1">
                                Anlaşmalı Kargo Firması Seçin
                              </label>
                              <select
                                value={action.config?.carrierName || ''}
                                onChange={(e) =>
                                  updateAction(idx, { config: { ...action.config, carrierName: e.target.value } })
                                }
                                className="w-full max-w-xs rounded-kp-md border border-kp-border bg-white dark:bg-slate-900 px-3 py-1.5 text-xs font-semibold text-kp-text-primary"
                              >
                                <option value="">Kargo firması seçin...</option>
                                <option value="Aras Kargo">Aras Kargo</option>
                                <option value="Yurtiçi Kargo">Yurtiçi Kargo</option>
                                <option value="MNG Kargo">MNG Kargo</option>
                                <option value="Sürat Kargo">Sürat Kargo</option>
                                <option value="Trendyol Express">Trendyol Express</option>
                                <option value="HepsiJET">HepsiJET</option>
                                <option value="PTT Kargo">PTT Kargo</option>
                              </select>
                            </div>
                          )}

                          {action.type === 'ASSIGN_WAREHOUSE' && (
                            <div>
                              <label className="block text-[11px] font-semibold text-kp-text-secondary mb-1">
                                Çıkış Deposu Adı
                              </label>
                              <input
                                type="text"
                                value={action.config?.warehouseName || ''}
                                onChange={(e) =>
                                  updateAction(idx, { config: { ...action.config, warehouseName: e.target.value } })
                                }
                                placeholder="Örn: Ana Depo, İstanbul E-Ticaret Deposu"
                                className="w-full max-w-md rounded-kp-md border border-kp-border bg-white dark:bg-slate-900 px-3 py-1.5 text-xs text-kp-text-primary"
                              />
                            </div>
                          )}

                          {action.type === 'SEND_NOTIFICATION' && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <div>
                                <label className="block text-[11px] font-semibold text-kp-text-secondary mb-1">
                                  Kanal
                                </label>
                                <select
                                  value={action.config?.channel || 'sms'}
                                  onChange={(e) =>
                                    updateAction(idx, { config: { ...action.config, channel: e.target.value } })
                                  }
                                  className="w-full rounded-kp-md border border-kp-border bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs text-kp-text-primary"
                                >
                                  <option value="sms">SMS Bildirimi</option>
                                  <option value="email">E-posta</option>
                                  <option value="internal">Dahili Sistem Bildirimi</option>
                                </select>
                              </div>
                              <div>
                                <label className="block text-[11px] font-semibold text-kp-text-secondary mb-1">
                                  Şablon Adı / Kodu
                                </label>
                                <input
                                  type="text"
                                  value={action.config?.template || ''}
                                  onChange={(e) =>
                                    updateAction(idx, { config: { ...action.config, template: e.target.value } })
                                  }
                                  placeholder="Örn: siparis_gecikme_bildirimi"
                                  className="w-full rounded-kp-md border border-kp-border bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs text-kp-text-primary"
                                />
                              </div>
                            </div>
                          )}

                          {action.type === 'ADD_ORDER_NOTE' && (
                            <div>
                              <label className="block text-[11px] font-semibold text-kp-text-secondary mb-1">
                                Eklenecek Not Metni
                              </label>
                              <textarea
                                rows={2}
                                value={action.config?.note || ''}
                                onChange={(e) =>
                                  updateAction(idx, { config: { ...action.config, note: e.target.value } })
                                }
                                placeholder="Siparişe eklenecek otomatik açıklama notu..."
                                className="w-full rounded-kp-md border border-kp-border bg-white dark:bg-slate-900 px-3 py-1.5 text-xs text-kp-text-primary"
                              />
                            </div>
                          )}

                          {action.type === 'CALL_WEBHOOK' && (
                            <div className="space-y-2">
                              <div>
                                <label className="block text-[11px] font-semibold text-kp-text-secondary mb-1">
                                  Hedef Webhook URL'i <span className="text-kp-danger">*</span>
                                </label>
                                <input
                                  type="url"
                                  value={action.config?.url || ''}
                                  onChange={(e) =>
                                    updateAction(idx, { config: { ...action.config, url: e.target.value } })
                                  }
                                  placeholder="https://n8n.sirketiniz.com/webhook/siparis"
                                  className="w-full rounded-kp-md border border-kp-border bg-white dark:bg-slate-900 px-3 py-1.5 text-xs font-mono text-kp-text-primary"
                                />
                              </div>
                            </div>
                          )}

                          {action.type === 'WAIT' && (
                            <div>
                              <label className="block text-[11px] font-semibold text-kp-text-secondary mb-1">
                                Bekleme Süresi (Dakika)
                              </label>
                              <input
                                type="number"
                                min={1}
                                value={action.config?.minutes ?? 10}
                                onChange={(e) =>
                                  updateAction(idx, { config: { ...action.config, minutes: Number(e.target.value) } })
                                }
                                className="w-full max-w-xs rounded-kp-md border border-kp-border bg-white dark:bg-slate-900 px-3 py-1.5 text-xs text-kp-text-primary"
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* SECTION 4: Ayarlar (Genel Yapılandırma) */}
              <div className="rounded-kp-xl border border-kp-border bg-white dark:bg-slate-900 p-5 shadow-xs space-y-4">
                <div className="flex items-center gap-2.5 border-b border-kp-border/60 pb-3">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-kp-accent text-xs font-bold text-white shadow-xs">
                    4
                  </span>
                  <h3 className="text-sm font-bold text-kp-text-primary">
                    Kural Ayarları & Kayıt Bilgileri
                  </h3>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-kp-text-secondary mb-1">
                      Kural Başlığı <span className="text-kp-danger">*</span>
                    </label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Örn: 1500 TL Üzeri Siparişleri Beklemeye Al"
                      className="w-full rounded-kp-md border border-kp-border bg-white dark:bg-slate-900 px-3 py-2 text-xs font-medium text-kp-text-primary focus:border-kp-accent focus:outline-none"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-kp-text-secondary mb-1">
                      Açıklama (İsteğe Bağlı)
                    </label>
                    <textarea
                      rows={2}
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Bu kuralın amacı ve ne zaman devreye girdiği..."
                      className="w-full rounded-kp-md border border-kp-border bg-white dark:bg-slate-900 px-3 py-2 text-xs text-kp-text-primary focus:border-kp-accent focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-kp-text-secondary mb-1">
                      Çalışma Önceliği (Priority)
                    </label>
                    <input
                      type="number"
                      value={priority}
                      onChange={(e) => setPriority(Number(e.target.value))}
                      className="w-full rounded-kp-md border border-kp-border bg-white dark:bg-slate-900 px-3 py-2 text-xs text-kp-text-primary"
                    />
                    <p className="mt-1 text-[11px] text-kp-text-tertiary">
                      Düşük sayılar (ör. 10) yüksek sayılardan (ör. 100) önce çalıştırılır.
                    </p>
                  </div>

                  <div className="space-y-2.5 pt-2">
                    <label className="flex items-center gap-2 text-xs text-kp-text-primary cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={stopProcessing}
                        onChange={(e) => setStopProcessing(e.target.checked)}
                        className="h-4 w-4 rounded border-kp-border text-kp-accent focus:ring-kp-accent"
                      />
                      <span>Eşleşirse sonraki kuralları durdur (stopProcessing)</span>
                    </label>

                    <label className="flex items-center gap-2 text-xs text-kp-text-primary cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={runOncePerOrder}
                        onChange={(e) => setRunOncePerOrder(e.target.checked)}
                        className="h-4 w-4 rounded border-kp-border text-kp-accent focus:ring-kp-accent"
                      />
                      <span>Her siparişte yalnız bir kez çalış (Tekrarı engelle)</span>
                    </label>

                    <label className="flex items-center gap-2 text-xs text-kp-text-primary cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={isActive}
                        onChange={(e) => setIsActive(e.target.checked)}
                        className="h-4 w-4 rounded border-kp-border text-kp-accent focus:ring-kp-accent"
                      />
                      <span className="font-semibold text-kp-accent">Kaydeder kaydetmez kuralı etkinleştir (Aktif)</span>
                    </label>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'test' && (
            <div className="space-y-6">
              {/* Dry-Run Panel */}
              <div className="rounded-kp-xl border border-kp-border bg-white dark:bg-slate-900 p-5 shadow-xs space-y-4">
                <div className="flex items-center gap-2">
                  <BeakerIcon className="h-5 w-5 text-kp-accent" />
                  <h3 className="text-sm font-bold text-kp-text-primary">
                    Tekil Sipariş Simülasyonu (Dry-Run)
                  </h3>
                </div>
                <p className="text-xs text-kp-text-tertiary">
                  Veritabanında herhangi bir kalıcı değişiklik yapmadan, bu kuralın belirtilen siparişte eşleşip eşleşmeyeceğini ve hangi aksiyonları planlayacağını anlık olarak simüle edin.
                </p>

                <div className="flex items-center gap-3">
                  <input
                    type="text"
                    value={testOrderId}
                    onChange={(e) => setTestOrderId(e.target.value)}
                    placeholder="Sipariş ID veya Sipariş Numarası girin..."
                    className="flex-1 rounded-kp-md border border-kp-border bg-white dark:bg-slate-900 px-3 py-2 text-xs text-kp-text-primary focus:border-kp-accent focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleRunTest}
                    disabled={testLoading}
                    className="flex items-center gap-1.5 rounded-kp-md bg-kp-accent px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-kp-accent/90 disabled:opacity-50"
                  >
                    <BeakerIcon className="h-4 w-4" />
                    <span>{testLoading ? 'Simüle Ediliyor...' : 'Simüle Et'}</span>
                  </button>
                </div>

                {testError && (
                  <div className="rounded-kp-md bg-kp-danger-muted p-3 text-xs text-kp-danger">
                    {testError}
                  </div>
                )}

                {testResult && (
                  <div className="rounded-kp-md border border-kp-border bg-slate-50 dark:bg-slate-800/60 p-4 space-y-3 font-mono text-xs">
                    <div className="flex items-center gap-2 font-bold font-sans text-sm">
                      <span>Simülasyon Sonucu:</span>
                      {testResult.matched ? (
                        <span className="text-kp-success flex items-center gap-1">
                          <CheckCircleIcon className="h-5 w-5" /> Eşleşti (Kural Uygulanır)
                        </span>
                      ) : (
                        <span className="text-kp-danger flex items-center gap-1">
                          <XCircleIcon className="h-5 w-5" /> Eşleşmedi (Atlanır)
                        </span>
                      )}
                    </div>

                    {/* Condition Trace Breakdown */}
                    <div className="border-t border-kp-border/60 pt-3 space-y-2">
                      <div className="font-sans font-bold text-xs text-kp-text-secondary">
                        Koşul Değerlendirme Analizi:
                      </div>
                      {testResult.conditionTrace?.children?.map((c, i) => (
                        <div
                          key={i}
                          className={`flex items-center justify-between rounded-kp-xs p-2 text-xs ${
                            c.matched ? 'bg-kp-success-muted/30' : 'bg-kp-danger-muted/30'
                          }`}
                        >
                          <div>
                            {c.field} {c.operator} {JSON.stringify(c.expected)}
                            <div className="text-[11px] text-kp-text-tertiary">
                              Sipariş Değeri: {JSON.stringify(c.actual)}
                            </div>
                          </div>
                          <div className="font-sans font-bold">
                            {c.matched ? '✓ Eşleşti' : '✗ Eşleşmedi'}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Planned Actions */}
                    <div className="border-t border-kp-border/60 pt-3 space-y-2">
                      <div className="font-sans font-bold text-xs text-kp-text-secondary">
                        Planlanan Aksiyonlar ({testResult.plannedActions?.length || 0}):
                      </div>
                      {testResult.plannedActions?.map((act, i) => (
                        <div
                          key={i}
                          className="rounded-kp-xs border border-kp-border bg-white dark:bg-slate-900 p-2 text-xs flex items-center justify-between font-sans"
                        >
                          <div className="font-bold text-kp-text-primary">
                            #{act.index + 1} {act.actionType}
                          </div>
                          <div className="text-kp-text-secondary">{act.description}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Backtest Panel */}
              {rule?.id && (
                <div className="rounded-kp-xl border border-kp-border bg-white dark:bg-slate-900 p-5 shadow-xs space-y-4">
                  <div className="flex items-center gap-2">
                    <ClockIcon className="h-5 w-5 text-kp-accent" />
                    <h3 className="text-sm font-bold text-kp-text-primary">
                      Geriye Dönük Test (Backtest)
                    </h3>
                  </div>
                  <p className="text-xs text-kp-text-tertiary">
                    Bu kural geçmiş günlerdeki gerçek siparişlerinize uygulansaydı kaç siparişte eşleşirdi analiz edin.
                  </p>

                  <div className="flex items-center gap-3">
                    <select
                      value={backtestDays}
                      onChange={(e) => setBacktestDays(Number(e.target.value))}
                      className="rounded-kp-md border border-kp-border bg-white dark:bg-slate-900 px-3 py-2 text-xs text-kp-text-primary"
                    >
                      <option value={7}>Son 7 Gün</option>
                      <option value={15}>Son 15 Gün</option>
                      <option value={30}>Son 30 Gün</option>
                      <option value={60}>Son 60 Gün</option>
                    </select>

                    <button
                      type="button"
                      onClick={handleRunBacktest}
                      disabled={backtestLoading}
                      className="flex items-center gap-1.5 rounded-kp-md border border-kp-border bg-white dark:bg-slate-900 px-4 py-2 text-xs font-semibold text-kp-text-primary hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
                    >
                      <ArrowPathIcon className={`h-4 w-4 ${backtestLoading ? 'animate-spin' : ''}`} />
                      <span>{backtestLoading ? 'Taranıyor...' : 'Geriye Dönük Tara'}</span>
                    </button>
                  </div>

                  {backtestError && (
                    <div className="rounded-kp-md bg-kp-danger-muted p-3 text-xs text-kp-danger">
                      {backtestError}
                    </div>
                  )}

                  {backtestResult && (
                    <div className="rounded-kp-md border border-kp-border bg-slate-50 dark:bg-slate-800/60 p-4 space-y-3">
                      <div className="text-xs font-semibold text-kp-text-primary">
                        Son {backtestDays} günde taranan {backtestResult.totalScanned} siparişten{' '}
                        <span className="text-kp-accent font-bold">{backtestResult.matchedCount}</span> tanesinde eşleşirdi ({backtestResult.matchRatioPercentage}%).
                      </div>

                      {backtestResult.samples?.length > 0 && (
                        <div className="space-y-1.5">
                          <div className="text-[11px] font-bold text-kp-text-tertiary uppercase">
                            Örnek Eşleşen Siparişler (İlk 10):
                          </div>
                          <div className="divide-y divide-kp-border/50 text-xs">
                            {backtestResult.samples.map((s) => (
                              <div key={s.orderId} className="py-1.5 flex items-center justify-between">
                                <span className="font-mono text-kp-accent font-semibold">{s.orderNumber}</span>
                                <span className="text-kp-text-secondary">{s.customerName}</span>
                                <span className="font-semibold text-kp-text-primary">
                                  {s.totalAmount} {s.currency}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {activeTab === 'versions' && rule?.versions && (
            <div className="space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-kp-text-secondary">
                Versiyon Geçmişi & Geri Yükleme
              </h3>
              <div className="space-y-3">
                {rule.versions.map((ver) => (
                  <div
                    key={ver.id}
                    className="flex items-center justify-between rounded-kp-lg border border-kp-border bg-white dark:bg-slate-900 p-4 shadow-xs"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="rounded-kp-xs bg-kp-accent/10 px-2 py-0.5 text-xs font-bold text-kp-accent">
                          v{ver.version}
                        </span>
                        <span className="text-xs text-kp-text-secondary">
                          {new Date(ver.createdAt).toLocaleString('tr-TR')}
                        </span>
                      </div>
                      {ver.changeSummary && (
                        <div className="mt-1 text-xs text-kp-text-tertiary">
                          {ver.changeSummary}
                        </div>
                      )}
                    </div>

                    {onRestoreVersion && ver.version !== rule.version && (
                      <button
                        type="button"
                        onClick={async () => {
                          if (window.confirm(`v${ver.version} sürümüne geri dönülsün mü?`)) {
                            await onRestoreVersion(rule.id, ver.version);
                            onClose();
                          }
                        }}
                        className="flex items-center gap-1 rounded-kp-md border border-kp-border bg-white dark:bg-slate-900 px-3 py-1.5 text-xs font-semibold text-kp-text-secondary hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-kp-text-primary transition-colors"
                      >
                        <ArrowUturnLeftIcon className="h-3.5 w-3.5" />
                        <span>Geri Yükle</span>
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Drawer Footer */}
        <div className="flex items-center justify-between border-t border-kp-border px-6 py-4 bg-white dark:bg-slate-900 shadow-xs">
          <button
            type="button"
            onClick={onClose}
            className="rounded-kp-md border border-kp-border bg-white dark:bg-slate-900 px-4 py-2 text-xs font-semibold text-kp-text-secondary hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-kp-text-primary transition-colors"
          >
            İptal
          </button>

          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-1.5 rounded-kp-md bg-kp-accent px-5 py-2 text-xs font-semibold text-white shadow-sm transition-all hover:bg-kp-accent/90 disabled:opacity-50"
          >
            {isSaving ? (
              <>
                <ArrowPathIcon className="h-4 w-4 animate-spin" />
                <span>Kaydediliyor...</span>
              </>
            ) : (
              <span>{rule ? 'Değişiklikleri Kaydet' : 'Kuralı Kaydet'}</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
