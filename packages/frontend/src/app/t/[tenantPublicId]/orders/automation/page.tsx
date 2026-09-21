'use client';

import React, { useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import {
  BoltIcon,
  PlusIcon,
  QueueListIcon,
  ClockIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline';
import { SubPageShell, StoreRequired } from '@/components/layout/SubPageShell';
import { useAuth } from '@/lib/auth-context';
import { useAutomationRules } from './hooks/useAutomationRules';
import { AutomationRule, RecipeTemplate } from './types';
import RulesTab from './components/RulesTab';
import RunHistoryTab from './components/RunHistoryTab';
import RecipeCatalog from './components/RecipeCatalog';
import RuleEditorDrawer from './components/RuleEditorDrawer';

const MANAGE_ROLES = new Set([
  'super_admin',
  'Super Admin',
  'agency_owner',
  'agency_admin',
  'client_admin',
  'store_manager',
]);

type TabKey = 'rules' | 'history' | 'recipes';

export default function OrderAutomationPage() {
  const t = useTranslations('orderAutomation');
  const tc = useTranslations('common');
  const { user } = useAuth();

  const [currentTab, setCurrentTab] = useState<TabKey>('rules');

  const {
    rules,
    catalog,
    isLoading,
    error,
    hasStore,
    reload,
    createRule,
    updateRule,
    toggleRule,
    reorderRules,
    duplicateRule,
    deleteRule,
    dryRunTest,
    backtest,
    runRuleManually,
    restoreVersion,
  } = useAutomationRules();

  // Drawer states
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<AutomationRule | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<RecipeTemplate | null>(null);

  // Success / Notice banner
  const [notice, setNotice] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const canManage = MANAGE_ROLES.has(user?.role ?? '');

  const openCreate = useCallback(() => {
    setEditingRule(null);
    setSelectedTemplate(null);
    setIsDrawerOpen(true);
  }, []);

  const openEdit = useCallback((rule: AutomationRule) => {
    setEditingRule(rule);
    setSelectedTemplate(null);
    setIsDrawerOpen(true);
  }, []);

  const openTest = useCallback((rule: AutomationRule) => {
    setEditingRule(rule);
    setSelectedTemplate(null);
    setIsDrawerOpen(true);
  }, []);

  const openVersions = useCallback((rule: AutomationRule) => {
    setEditingRule(rule);
    setSelectedTemplate(null);
    setIsDrawerOpen(true);
  }, []);

  const handleSelectRecipe = useCallback((recipe: RecipeTemplate) => {
    setEditingRule(null);
    setSelectedTemplate(recipe);
    setIsDrawerOpen(true);
  }, []);

  const handleSaveRule = useCallback(
    async (payload: any) => {
      setActionError(null);
      if (editingRule) {
        await updateRule(editingRule.id, payload);
        setNotice('Kural başarıyla güncellendi.');
      } else {
        await createRule(payload);
        setNotice('Yeni kural başarıyla oluşturuldu (varsayılan olarak pasif).');
      }
      setTimeout(() => setNotice(null), 4000);
    },
    [editingRule, updateRule, createRule],
  );

  const handleToggle = useCallback(
    async (rule: AutomationRule, nextState: boolean) => {
      setActionError(null);
      try {
        await toggleRule(rule.id, nextState);
        setNotice(nextState ? `"${rule.name}" kuralı etkinleştirildi.` : `"${rule.name}" kuralı duraklatıldı.`);
        setTimeout(() => setNotice(null), 3000);
      } catch (err: any) {
        setActionError(err?.message || 'Durum değiştirilemedi.');
      }
    },
    [toggleRule],
  );

  const handleManualRun = useCallback(
    async (ruleId: string) => {
      setActionError(null);
      try {
        const result = await runRuleManually(ruleId);
        setNotice(
          `Elle çalıştırma tamamlandı: ${result.applied} uygulandı, ${result.skipped} atlandı, ${result.failed} başarısız.`,
        );
        setTimeout(() => setNotice(null), 5000);
      } catch (err: any) {
        setActionError(err?.message || 'Çalıştırma sırasında bir hata oluştu.');
      }
    },
    [runRuleManually],
  );

  const handleDuplicate = useCallback(
    async (ruleId: string) => {
      setActionError(null);
      try {
        const dup = await duplicateRule(ruleId);
        setNotice(`"${dup.name}" kopyası oluşturuldu.`);
        setTimeout(() => setNotice(null), 3000);
      } catch (err: any) {
        setActionError(err?.message || 'Kopyalama başarısız oldu.');
      }
    },
    [duplicateRule],
  );

  const handleDelete = useCallback(
    async (rule: AutomationRule) => {
      setActionError(null);
      try {
        await deleteRule(rule.id);
        setNotice(`"${rule.name}" kuralı silindi.`);
        setTimeout(() => setNotice(null), 3000);
      } catch (err: any) {
        setActionError(err?.message || 'Silme başarısız oldu.');
      }
    },
    [deleteRule],
  );

  if (!hasStore) {
    return (
      <SubPageShell title={t('title')} subtitle={t('subtitle')} icon={BoltIcon}>
        <StoreRequired
          icon={BoltIcon}
          title={t('storeRequired.title')}
          description={t('storeRequired.desc')}
        />
      </SubPageShell>
    );
  }

  const tabs = [
    {
      key: 'rules' as TabKey,
      label: 'Kurallar',
      icon: QueueListIcon,
      badge: rules.length,
    },
    {
      key: 'history' as TabKey,
      label: 'Çalışma Günlüğü',
      icon: ClockIcon,
    },
    {
      key: 'recipes' as TabKey,
      label: 'Hazır Tarifler',
      icon: SparklesIcon,
    },
  ];

  return (
    <SubPageShell
      title={t('title')}
      subtitle={t('subtitle')}
      icon={BoltIcon}
      error={error ?? actionError}
      onReload={reload}
      isLoading={isLoading}
      reloadLabel={tc('actions.refresh')}
      actions={
        canManage && (
          <button
            type="button"
            onClick={openCreate}
            className="flex items-center gap-1.5 rounded-kp-md bg-kp-accent px-3 py-2 text-xs font-semibold text-white shadow-sm transition-all hover:bg-kp-accent/90"
          >
            <PlusIcon className="h-4 w-4" />
            <span>Yeni Kural</span>
          </button>
        )
      }
    >
      {notice && (
        <div className="rounded-kp-md border border-kp-success/40 bg-kp-success-muted px-4 py-2.5 text-xs text-kp-success font-medium">
          {notice}
        </div>
      )}

      {/* Tabs Navigation Bar */}
      <div className="border-b border-kp-border">
        <nav className="flex space-x-6" aria-label="Tabs">
          {tabs.map((tab) => {
            const isCurrent = currentTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setCurrentTab(tab.key)}
                className={`group flex items-center gap-2 border-b-2 py-3 px-1 text-xs font-semibold transition-all ${
                  isCurrent
                    ? 'border-kp-accent text-kp-accent'
                    : 'border-transparent text-kp-text-secondary hover:border-kp-border hover:text-kp-text-primary'
                }`}
              >
                <tab.icon
                  className={`h-4 w-4 transition-colors ${
                    isCurrent ? 'text-kp-accent' : 'text-kp-text-tertiary group-hover:text-kp-text-secondary'
                  }`}
                />
                <span>{tab.label}</span>
                {tab.badge !== undefined && (
                  <span
                    className={`ml-1 rounded-full px-2 py-0.2 text-[10px] font-bold ${
                      isCurrent
                        ? 'bg-kp-accent text-white'
                        : 'bg-kp-bg text-kp-text-secondary'
                    }`}
                  >
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="mt-4">
        {currentTab === 'rules' && (
          <RulesTab
            rules={rules}
            isLoading={isLoading}
            canManage={canManage}
            onCreate={openCreate}
            onEdit={openEdit}
            onToggle={handleToggle}
            onDuplicate={handleDuplicate}
            onRunManually={handleManualRun}
            onTest={openTest}
            onVersions={openVersions}
            onDelete={handleDelete}
            onReorder={reorderRules}
          />
        )}

        {currentTab === 'history' && <RunHistoryTab />}

        {currentTab === 'recipes' && (
          <RecipeCatalog
            onSelectRecipe={handleSelectRecipe}
            canManage={canManage}
          />
        )}
      </div>

      {/* Rule Editor Drawer (Wizard + Live Summary + Dry-Run Test + Backtest + Versions) */}
      <RuleEditorDrawer
        catalog={catalog}
        rule={editingRule}
        initialTemplate={selectedTemplate}
        isOpen={isDrawerOpen}
        onClose={() => {
          setIsDrawerOpen(false);
          setEditingRule(null);
          setSelectedTemplate(null);
        }}
        onSave={handleSaveRule}
        onDryRun={dryRunTest}
        onBacktest={backtest}
        onRestoreVersion={restoreVersion}
      />
    </SubPageShell>
  );
}
