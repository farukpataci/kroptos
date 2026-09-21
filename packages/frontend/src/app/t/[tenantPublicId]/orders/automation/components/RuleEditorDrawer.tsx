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
  InformationCircleIcon,
  BeakerIcon,
  ArrowUturnLeftIcon,
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
  catalog,
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
    const triggerLabelMap: Record<string, string> = {
      ORDER_CREATED: 'Sipariş oluşturulduğunda',
      ORDER_STATUS_CHANGED: `Sipariş durumu ${triggerConfig.toStatus ? `"${triggerConfig.toStatus}"` : ''} olarak değiştiğinde`,
      PAYMENT_RECEIVED: 'Ödeme tahsil edildiğinde',
      SHIPMENT_CREATED: 'Kargo gönderisi oluşturulduğunda',
      SHIPMENT_DELIVERED: 'Kargo teslim edildiğinde',
      SHIPMENT_EXCEPTION: 'Kargo teslimat istisnası bildirildiğinde',
      RETURN_REQUESTED: 'İade talebi oluşturulduğunda',
      ORDER_CANCELLED: 'Sipariş iptal edildiğinde',
      STOCK_INSUFFICIENT: 'Yetersiz stok oluştuğunda',
      ORDER_IDLE: `${triggerConfig.idleStatus || 'Bekleyen'} durumunda ${triggerConfig.idleHours || 'X'} saattir hareketsiz kaldığında`,
      SCHEDULED: 'Zamanlanmış periyotta',
    };

    const triggerPart = triggerLabelMap[triggerType] || triggerType;

    let conditionPart = '';
    if (conditions.length === 0) {
      conditionPart = 'herhangi bir koşul aranmaksızın';
    } else {
      const condStrs = conditions.map((c) => `${c.field} ${c.operator} ${JSON.stringify(c.value ?? '')}`);
      conditionPart = condStrs.join(conditionOperator === 'and' ? ' VE ' : ' VEYA ');
    }

    let actionPart = '';
    if (actions.length === 0) {
      actionPart = 'hiçbir işlem yapma';
    } else {
      const actStrs = actions.map((a) => {
        switch (a.type) {
          case 'SET_ORDER_STATUS':
            return `durumu "${a.config?.status || ''}" yap`;
          case 'ADD_TAG':
            return `"${a.config?.tag || ''}" etiketi ekle`;
          case 'REMOVE_TAG':
            return `"${a.config?.tag || ''}" etiketini kaldır`;
          case 'SET_PRIORITY':
            return `önceliği "${a.config?.priority || ''}" yap`;
          case 'HOLD_ORDER':
            return `siparişi beklemeye al (${a.config?.reason || 'bekletildi'})`;
          case 'RELEASE_HOLD':
            return 'beklemeyi kaldır';
          case 'ASSIGN_CARRIER':
            return `kargo firmasını "${a.config?.carrierName || a.config?.carrierId || ''}" yap`;
          case 'ASSIGN_WAREHOUSE':
            return `depoyu "${a.config?.warehouseName || a.config?.warehouseId || ''}" yap`;
          case 'CREATE_INVOICE':
            return 'e-fatura oluştur';
          case 'SEND_NOTIFICATION':
            return `${a.config?.channel || 'dahili'} bildirim gönder`;
          case 'ADD_ORDER_NOTE':
            return `not ekle ("${a.config?.note || ''}")`;
          case 'CALL_WEBHOOK':
            return `webhook çağır (${a.config?.url || ''})`;
          case 'WAIT':
            return `${a.config?.minutes || 10} dakika beklet`;
          default:
            return a.type;
        }
      });
      actionPart = actStrs.join(', ');
    }

    return `${triggerPart} ve ${conditionPart} ise → ${actionPart}.`;
  }, [triggerType, triggerConfig, conditions, conditionOperator, actions]);

  // Handle Conditions
  const addCondition = () => {
    const firstField = catalog?.fields[0]?.key || 'totalAmount';
    const firstOp = catalog?.fields[0]?.operators[0] || 'gte';
    setConditions((prev) => [...prev, { field: firstField, operator: firstOp, value: '' }]);
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
  const addAction = () => {
    const firstAction = catalog?.actions[0]?.key || 'ADD_TAG';
    setActions((prev) => [...prev, { type: firstAction, config: {} }]);
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
      setError('En az bir aksiyon eklemelisiniz.');
      return;
    }

    // Sanitize conditions
    const formattedConditions: ConditionTree = {
      version: 1,
      operator: conditionOperator,
      conditions: conditions.map((c) => {
        let val = c.value;
        // Parse numbers if numeric field
        const fldDef = catalog?.fields.find((f) => f.key === c.field);
        if (fldDef?.type === 'number' && typeof val === 'string' && val.trim()) {
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

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-xs transition-opacity">
      <div className="flex h-full w-full max-w-4xl flex-col bg-kp-surface shadow-2xl border-l border-kp-border">
        {/* Drawer Header */}
        <div className="flex items-center justify-between border-b border-kp-border px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-kp-md bg-kp-accent/10 text-kp-accent">
              <BoltIcon className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-kp-text-primary">
                {rule ? 'Otomasyon Kuralını Düzenle' : 'Yeni Otomasyon Kuralı Oluştur'}
              </h2>
              <p className="text-xs text-kp-text-tertiary">
                Tetikleyici, filtre koşulları ve uygulanacak aksiyonları yapılandırın.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Tabs */}
            <div className="flex items-center rounded-kp-md border border-kp-border bg-kp-bg/50 p-1 mr-2 text-xs">
              <button
                type="button"
                onClick={() => setActiveTab('editor')}
                className={`rounded-kp-sm px-3 py-1 font-medium transition-all ${
                  activeTab === 'editor'
                    ? 'bg-kp-surface text-kp-accent font-semibold shadow-xs'
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
                    ? 'bg-kp-surface text-kp-accent font-semibold shadow-xs'
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
                      ? 'bg-kp-surface text-kp-accent font-semibold shadow-xs'
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
              className="rounded-kp-md p-1.5 text-kp-text-tertiary hover:bg-kp-surface-hover hover:text-kp-text-primary transition-colors"
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Live Natural Language Summary Banner */}
        <div className="border-b border-kp-border bg-kp-bg/40 px-6 py-3">
          <div className="flex items-start gap-2 text-xs">
            <SparklesIcon className="h-4 w-4 text-kp-accent shrink-0 mt-0.5" />
            <div className="text-kp-text-secondary">
              <span className="font-semibold text-kp-text-primary">Özet: </span>
              <span className="italic">{naturalLanguageSummary}</span>
            </div>
          </div>
        </div>

        {/* Drawer Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {error && (
            <div className="rounded-kp-md bg-kp-danger-muted p-3 text-xs text-kp-danger">
              {error}
            </div>
          )}

          {activeTab === 'editor' && (
            <div className="space-y-6">
              {/* SECTION 1: Ne Zaman? (Tetikleyici) */}
              <div className="rounded-kp-xl border border-kp-border bg-kp-surface p-5 shadow-xs space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-kp-accent/10 text-xs font-bold text-kp-accent">
                      1
                    </span>
                    <h3 className="text-sm font-bold text-kp-text-primary">
                      Ne zaman? (Tetikleyici Olay)
                    </h3>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-semibold text-kp-text-secondary mb-1">
                      Tetikleyici Seçimi
                    </label>
                    <select
                      value={triggerType}
                      onChange={(e) => setTriggerType(e.target.value as TriggerType)}
                      className="w-full rounded-kp-md border border-kp-border bg-kp-surface px-3 py-2 text-xs text-kp-text-primary focus:border-kp-accent focus:outline-none"
                    >
                      {catalog?.triggers.map((trig) => (
                        <option key={trig.key} value={trig.key}>
                          {trig.key}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Trigger Configs */}
                  {triggerType === 'ORDER_STATUS_CHANGED' && (
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[11px] text-kp-text-tertiary mb-1">Eski Durum (İsteğe Bağlı)</label>
                        <input
                          type="text"
                          value={triggerConfig.fromStatus || ''}
                          onChange={(e) => setTriggerConfig((p) => ({ ...p, fromStatus: e.target.value }))}
                          placeholder="Örn: PENDING"
                          className="w-full rounded-kp-md border border-kp-border bg-kp-surface px-2.5 py-2 text-xs text-kp-text-primary"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] text-kp-text-tertiary mb-1">Yeni Durum</label>
                        <input
                          type="text"
                          value={triggerConfig.toStatus || ''}
                          onChange={(e) => setTriggerConfig((p) => ({ ...p, toStatus: e.target.value }))}
                          placeholder="Örn: CONFIRMED"
                          className="w-full rounded-kp-md border border-kp-border bg-kp-surface px-2.5 py-2 text-xs text-kp-text-primary"
                        />
                      </div>
                    </div>
                  )}

                  {triggerType === 'ORDER_IDLE' && (
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[11px] text-kp-text-tertiary mb-1">Beklenen Durum</label>
                        <input
                          type="text"
                          value={triggerConfig.idleStatus || ''}
                          onChange={(e) => setTriggerConfig((p) => ({ ...p, idleStatus: e.target.value }))}
                          placeholder="CONFIRMED / SHIPPED"
                          className="w-full rounded-kp-md border border-kp-border bg-kp-surface px-2.5 py-2 text-xs text-kp-text-primary"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] text-kp-text-tertiary mb-1">Hareketsiz Süre (Saat)</label>
                        <input
                          type="number"
                          value={triggerConfig.idleHours || ''}
                          onChange={(e) => setTriggerConfig((p) => ({ ...p, idleHours: Number(e.target.value) }))}
                          placeholder="24"
                          className="w-full rounded-kp-md border border-kp-border bg-kp-surface px-2.5 py-2 text-xs text-kp-text-primary"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* SECTION 2: Eğer... (Koşul Oluşturucu) */}
              <div className="rounded-kp-xl border border-kp-border bg-kp-surface p-5 shadow-xs space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-kp-accent/10 text-xs font-bold text-kp-accent">
                      2
                    </span>
                    <h3 className="text-sm font-bold text-kp-text-primary">
                      Eğer... (Filtre Koşulları)
                    </h3>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs text-kp-text-tertiary">Mantık:</span>
                    <div className="flex rounded-kp-md border border-kp-border bg-kp-bg/50 p-0.5 text-xs">
                      <button
                        type="button"
                        onClick={() => setConditionOperator('and')}
                        className={`rounded-kp-sm px-2.5 py-0.5 font-bold transition-all ${
                          conditionOperator === 'and'
                            ? 'bg-kp-accent text-white shadow-xs'
                            : 'text-kp-text-secondary hover:text-kp-text-primary'
                        }`}
                      >
                        VE (AND)
                      </button>
                      <button
                        type="button"
                        onClick={() => setConditionOperator('or')}
                        className={`rounded-kp-sm px-2.5 py-0.5 font-bold transition-all ${
                          conditionOperator === 'or'
                            ? 'bg-kp-accent text-white shadow-xs'
                            : 'text-kp-text-secondary hover:text-kp-text-primary'
                        }`}
                      >
                        VEYA (OR)
                      </button>
                    </div>
                  </div>
                </div>

                {conditions.length === 0 ? (
                  <div className="rounded-kp-md border border-dashed border-kp-border p-6 text-center">
                    <p className="text-xs text-kp-text-tertiary">
                      Henüz özel bir koşul eklenmedi. Kural bu tetikleyicideki <strong>tüm siparişlere</strong> uygulanacaktır.
                    </p>
                    <button
                      type="button"
                      onClick={addCondition}
                      className="mt-3 inline-flex items-center gap-1 rounded-kp-md border border-kp-border bg-kp-surface px-3 py-1.5 text-xs font-semibold text-kp-accent hover:bg-kp-surface-hover"
                    >
                      <PlusIcon className="h-3.5 w-3.5" />
                      İlk Koşulu Ekle
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {conditions.map((cond, idx) => {
                      const fldDef = catalog?.fields.find((f) => f.key === cond.field);
                      const availableOps = fldDef?.operators || ['eq', 'neq'];

                      return (
                        <div
                          key={idx}
                          className="flex flex-wrap items-center gap-2 rounded-kp-md border border-kp-border bg-kp-bg/20 p-2.5"
                        >
                          {/* Field Selector */}
                          <div className="w-48">
                            <select
                              value={cond.field}
                              onChange={(e) => {
                                const newField = e.target.value;
                                const newFieldDef = catalog?.fields.find((f) => f.key === newField);
                                updateCondition(idx, {
                                  field: newField,
                                  operator: (newFieldDef?.operators[0] as ConditionOperator) || 'eq',
                                  value: '',
                                });
                              }}
                              className="w-full rounded-kp-md border border-kp-border bg-kp-surface px-2.5 py-1.5 text-xs text-kp-text-primary focus:border-kp-accent focus:outline-none"
                            >
                              {catalog?.fields.map((f) => (
                                <option key={f.key} value={f.key}>
                                  {f.key} ({f.type})
                                </option>
                              ))}
                            </select>
                          </div>

                          {/* Operator Selector */}
                          <div className="w-36">
                            <select
                              value={cond.operator}
                              onChange={(e) =>
                                updateCondition(idx, { operator: e.target.value as ConditionOperator })
                              }
                              className="w-full rounded-kp-md border border-kp-border bg-kp-surface px-2.5 py-1.5 text-xs text-kp-text-primary focus:border-kp-accent focus:outline-none font-mono"
                            >
                              {availableOps.map((op) => (
                                <option key={op} value={op}>
                                  {op}
                                </option>
                              ))}
                            </select>
                          </div>

                          {/* Value Input (Smart by Field Type) */}
                          <div className="flex-1 min-w-[160px]">
                            {cond.operator === 'is_empty' || cond.operator === 'is_not_empty' ? (
                              <span className="text-xs text-kp-text-tertiary italic px-2">
                                Değer gerekmez
                              </span>
                            ) : fldDef?.options ? (
                              <select
                                value={cond.value || ''}
                                onChange={(e) => updateCondition(idx, { value: e.target.value })}
                                className="w-full rounded-kp-md border border-kp-border bg-kp-surface px-2.5 py-1.5 text-xs text-kp-text-primary focus:border-kp-accent focus:outline-none"
                              >
                                <option value="">Seçiniz...</option>
                                {fldDef.options.map((opt) => (
                                  <option key={opt.value} value={opt.value}>
                                    {opt.value}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <input
                                type={fldDef?.type === 'number' ? 'number' : 'text'}
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
                                    ? 'Virgülle ayırın (İstanbul, Bursa)'
                                    : 'Değer girin...'
                                }
                                className="w-full rounded-kp-md border border-kp-border bg-kp-surface px-2.5 py-1.5 text-xs text-kp-text-primary focus:border-kp-accent focus:outline-none"
                              />
                            )}
                          </div>

                          {/* Delete Row Button */}
                          <button
                            type="button"
                            onClick={() => removeCondition(idx)}
                            className="rounded-kp-md p-1.5 text-kp-danger hover:bg-kp-danger-muted transition-colors"
                          >
                            <TrashIcon className="h-4 w-4" />
                          </button>
                        </div>
                      );
                    })}

                    <button
                      type="button"
                      onClick={addCondition}
                      className="inline-flex items-center gap-1 rounded-kp-md border border-kp-border bg-kp-surface px-3 py-1.5 text-xs font-semibold text-kp-accent hover:bg-kp-surface-hover"
                    >
                      <PlusIcon className="h-3.5 w-3.5" />
                      + Koşul Ekle
                    </button>
                  </div>
                )}
              </div>

              {/* SECTION 3: O Zaman... (Sıralı Aksiyonlar) */}
              <div className="rounded-kp-xl border border-kp-border bg-kp-surface p-5 shadow-xs space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-kp-accent/10 text-xs font-bold text-kp-accent">
                      3
                    </span>
                    <h3 className="text-sm font-bold text-kp-text-primary">
                      O zaman... (Sıralı Aksiyonlar)
                    </h3>
                  </div>

                  <button
                    type="button"
                    onClick={addAction}
                    className="inline-flex items-center gap-1 rounded-kp-md bg-kp-accent px-3 py-1 text-xs font-semibold text-white shadow-xs hover:bg-kp-accent/90"
                  >
                    <PlusIcon className="h-3.5 w-3.5" />
                    Aksiyon Ekle
                  </button>
                </div>

                <div className="space-y-3">
                  {actions.map((action, idx) => {
                    const actDef = catalog?.actions.find((a) => a.key === action.type);

                    return (
                      <div
                        key={idx}
                        className="rounded-kp-lg border border-kp-border bg-kp-surface p-3.5 shadow-xs space-y-3"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-kp-bg text-[10px] font-bold text-kp-text-secondary">
                              {idx + 1}
                            </span>
                            <select
                              value={action.type}
                              onChange={(e) =>
                                updateAction(idx, { type: e.target.value as ActionType, config: {} })
                              }
                              className="rounded-kp-md border border-kp-border bg-kp-surface px-2.5 py-1 text-xs font-bold text-kp-text-primary focus:border-kp-accent focus:outline-none"
                            >
                              {catalog?.actions.map((act) => (
                                <option key={act.key} value={act.key}>
                                  {act.key}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => moveAction(idx, 'up')}
                              disabled={idx === 0}
                              className="rounded-kp-sm p-1 text-kp-text-tertiary hover:bg-kp-surface-hover disabled:opacity-30"
                            >
                              <ChevronUpIcon className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => moveAction(idx, 'down')}
                              disabled={idx === actions.length - 1}
                              className="rounded-kp-sm p-1 text-kp-text-tertiary hover:bg-kp-surface-hover disabled:opacity-30"
                            >
                              <ChevronDownIcon className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => removeAction(idx)}
                              className="rounded-kp-sm p-1 text-kp-danger hover:bg-kp-danger-muted"
                            >
                              <TrashIcon className="h-4 w-4" />
                            </button>
                          </div>
                        </div>

                        {/* Action Config Form */}
                        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 pt-1 border-t border-kp-border/40">
                          {actDef?.configFields.map((field) => (
                            <div key={field.name} className="space-y-1">
                              <label className="block text-[11px] font-medium text-kp-text-tertiary">
                                {field.name} {field.required && <span className="text-kp-danger">*</span>}
                              </label>
                              {field.type === 'enum' && field.options ? (
                                <select
                                  value={action.config?.[field.name] || ''}
                                  onChange={(e) =>
                                    updateAction(idx, {
                                      config: { ...action.config, [field.name]: e.target.value },
                                    })
                                  }
                                  className="w-full rounded-kp-md border border-kp-border bg-kp-surface px-2.5 py-1.5 text-xs text-kp-text-primary"
                                >
                                  <option value="">Seçiniz...</option>
                                  {field.options.map((opt) => (
                                    <option key={opt.value} value={opt.value}>
                                      {opt.value}
                                    </option>
                                  ))}
                                </select>
                              ) : field.type === 'number' ? (
                                <input
                                  type="number"
                                  value={action.config?.[field.name] ?? ''}
                                  onChange={(e) =>
                                    updateAction(idx, {
                                      config: { ...action.config, [field.name]: Number(e.target.value) },
                                    })
                                  }
                                  className="w-full rounded-kp-md border border-kp-border bg-kp-surface px-2.5 py-1.5 text-xs text-kp-text-primary"
                                />
                              ) : field.type === 'boolean' ? (
                                <label className="flex items-center gap-2 text-xs text-kp-text-secondary pt-1">
                                  <input
                                    type="checkbox"
                                    checked={!!action.config?.[field.name]}
                                    onChange={(e) =>
                                      updateAction(idx, {
                                        config: { ...action.config, [field.name]: e.target.checked },
                                      })
                                    }
                                    className="h-4 w-4 rounded border-kp-border text-kp-accent"
                                  />
                                  <span>Evet</span>
                                </label>
                              ) : (
                                <input
                                  type="text"
                                  value={action.config?.[field.name] || ''}
                                  onChange={(e) =>
                                    updateAction(idx, {
                                      config: { ...action.config, [field.name]: e.target.value },
                                    })
                                  }
                                  className="w-full rounded-kp-md border border-kp-border bg-kp-surface px-2.5 py-1.5 text-xs text-kp-text-primary"
                                />
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* SECTION 4: Ayarlar (Genel Yapılandırma) */}
              <div className="rounded-kp-xl border border-kp-border bg-kp-surface p-5 shadow-xs space-y-4">
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-kp-accent/10 text-xs font-bold text-kp-accent">
                    4
                  </span>
                  <h3 className="text-sm font-bold text-kp-text-primary">
                    Ayarlar & Tanımlamalar
                  </h3>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-kp-text-secondary mb-1">
                      Kural Adı <span className="text-kp-danger">*</span>
                    </label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Örn: Kapıda Ödeme Teyit Kuralı"
                      className="w-full rounded-kp-md border border-kp-border bg-kp-surface px-3 py-2 text-xs text-kp-text-primary focus:border-kp-accent focus:outline-none"
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
                      placeholder="Kuralın ne amaçla oluşturulduğunu belirtin..."
                      className="w-full rounded-kp-md border border-kp-border bg-kp-surface px-3 py-2 text-xs text-kp-text-primary focus:border-kp-accent focus:outline-none"
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
                      className="w-full rounded-kp-md border border-kp-border bg-kp-surface px-3 py-2 text-xs text-kp-text-primary"
                    />
                    <p className="mt-1 text-[11px] text-kp-text-tertiary">
                      Düşük sayılar (ör. 10) yüksek sayılardan (ör. 100) önce çalıştırılır.
                    </p>
                  </div>

                  <div className="space-y-3 pt-2">
                    <label className="flex items-center gap-2 text-xs text-kp-text-primary cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={stopProcessing}
                        onChange={(e) => setStopProcessing(e.target.checked)}
                        className="h-4 w-4 rounded border-kp-border text-kp-accent focus:ring-kp-accent"
                      />
                      <span>Sonraki kuralları durdur (stopProcessing)</span>
                    </label>

                    <label className="flex items-center gap-2 text-xs text-kp-text-primary cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={runOncePerOrder}
                        onChange={(e) => setRunOncePerOrder(e.target.checked)}
                        className="h-4 w-4 rounded border-kp-border text-kp-accent focus:ring-kp-accent"
                      />
                      <span>Her siparişte yalnız bir kez çalış (runOncePerOrder)</span>
                    </label>

                    <label className="flex items-center gap-2 text-xs text-kp-text-primary cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={isActive}
                        onChange={(e) => setIsActive(e.target.checked)}
                        className="h-4 w-4 rounded border-kp-border text-kp-accent focus:ring-kp-accent"
                      />
                      <span className="font-semibold">Kuralı Etkinleştir (Aktif)</span>
                    </label>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'test' && (
            <div className="space-y-6">
              {/* Dry-Run Panel */}
              <div className="rounded-kp-xl border border-kp-border bg-kp-surface p-5 shadow-xs space-y-4">
                <div className="flex items-center gap-2">
                  <BeakerIcon className="h-5 w-5 text-kp-accent" />
                  <h3 className="text-sm font-bold text-kp-text-primary">
                    Tekil Sipariş Simülasyonu (Dry-Run)
                  </h3>
                </div>
                <p className="text-xs text-kp-text-tertiary">
                  Veritabanında herhangi bir değişiklik yapmadan, bu kuralın belirtilen siparişte eşleşip eşleşmeyeceğini ve hangi aksiyonları planlayacağını anlık olarak simüle edin.
                </p>

                <div className="flex items-center gap-3">
                  <input
                    type="text"
                    value={testOrderId}
                    onChange={(e) => setTestOrderId(e.target.value)}
                    placeholder="Sipariş ID girin (UUID veya Order No)"
                    className="flex-1 rounded-kp-md border border-kp-border bg-kp-surface px-3 py-2 text-xs text-kp-text-primary focus:border-kp-accent focus:outline-none"
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
                  <div className="rounded-kp-md border border-kp-border bg-kp-bg/40 p-4 space-y-3 font-mono text-xs">
                    <div className="flex items-center gap-2 font-bold font-sans text-sm">
                      <span>Simülasyon Sonucu:</span>
                      {testResult.matched ? (
                        <span className="text-kp-success flex items-center gap-1">
                          <CheckCircleIcon className="h-5 w-5" /> Eşleşti (Uygulanır)
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
                          <div>{c.matched ? '✓ Eşleşti' : '✗ Eşleşmedi'}</div>
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
                          className="rounded-kp-xs border border-kp-border bg-kp-surface p-2 text-xs flex items-center justify-between"
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
                <div className="rounded-kp-xl border border-kp-border bg-kp-surface p-5 shadow-xs space-y-4">
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
                      className="rounded-kp-md border border-kp-border bg-kp-surface px-3 py-2 text-xs text-kp-text-primary"
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
                      className="flex items-center gap-1.5 rounded-kp-md border border-kp-border bg-kp-surface px-4 py-2 text-xs font-semibold text-kp-text-primary hover:bg-kp-surface-hover transition-colors disabled:opacity-50"
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
                    <div className="rounded-kp-md border border-kp-border bg-kp-bg/40 p-4 space-y-3">
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
                    className="flex items-center justify-between rounded-kp-lg border border-kp-border bg-kp-surface p-4 shadow-xs"
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
                        className="flex items-center gap-1 rounded-kp-md border border-kp-border bg-kp-surface px-3 py-1.5 text-xs font-semibold text-kp-text-secondary hover:bg-kp-surface-hover hover:text-kp-text-primary transition-colors"
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
        <div className="flex items-center justify-between border-t border-kp-border px-6 py-4 bg-kp-bg/30">
          <button
            type="button"
            onClick={onClose}
            className="rounded-kp-md border border-kp-border bg-kp-surface px-4 py-2 text-xs font-semibold text-kp-text-secondary hover:bg-kp-surface-hover hover:text-kp-text-primary transition-colors"
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
