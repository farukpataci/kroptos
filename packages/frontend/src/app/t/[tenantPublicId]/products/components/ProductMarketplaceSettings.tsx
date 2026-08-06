'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { apiFetch } from '@/lib/api';
import { useToast } from '@/components/ui/Toast';
import {
  ArrowPathIcon,
  CloudArrowUpIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  TrashIcon,
  FolderOpenIcon
} from '@heroicons/react/24/outline';

interface ProductMarketplaceSettingsProps {
  productId: string;
}

interface Integration {
  id: string;
  name: string;
  provider: string;
  status: string;
}

interface TrendyolCategory {
  id: number;
  name: string;
  parentId: number | null;
  subCategories?: TrendyolCategory[];
}

interface TrendyolAttribute {
  required: boolean;
  allowCustom: boolean;
  attribute: {
    id: number;
    name: string;
  };
  variability: string;
  attributeValues: Array<{ id: number; name: string }>;
}

interface ProductMapping {
  id: string;
  integrationId: string;
  marketplaceCategoryId: string;
  marketplaceCategoryName: string;
  attributesMapping: Record<string, { type: 'field' | 'variant' | 'static'; value: string }>;
  status: string;
  errorMessage?: string;
  marketplaceProductId?: string;
}

export default function ProductMarketplaceSettings({ productId }: ProductMarketplaceSettingsProps) {
  const t = useTranslations('products.marketplace');
  const toast = useToast();
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [selectedIntegrationId, setSelectedIntegrationId] = useState('');
  const [mappings, setMappings] = useState<ProductMapping[]>([]);
  const [activeMapping, setActiveMapping] = useState<ProductMapping | null>(null);

  // Categories & Attributes states
  const [flattenedCategories, setFlattenedCategories] = useState<Array<{ id: string; fullName: string }>>([]);
  const [categoryAttributes, setCategoryAttributes] = useState<TrendyolAttribute[]>([]);
  
  // Search & loading states
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isLoadingAttributes, setIsLoadingAttributes] = useState(false);
  const [categorySearchQuery, setCategorySearchQuery] = useState('');

  // Form states
  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const [selectedCategoryName, setSelectedCategoryName] = useState('');
  const [attributeMappings, setAttributeMappings] = useState<Record<string, { type: 'field' | 'variant' | 'static'; value: string }>>({});

  // Fetch initial integrations and mappings
  useEffect(() => {
    const init = async () => {
      setIsLoading(true);
      try {
        const allInts = await apiFetch<Integration[]>('/integrations');
        const marketInts = (allInts || []).filter((i) => i.provider.toLowerCase() === 'trendyol');
        setIntegrations(marketInts);

        if (marketInts.length > 0) {
          const defaultInt = marketInts[0];
          setSelectedIntegrationId(defaultInt.id);
          await loadIntegrationData(defaultInt.id);
        }
      } catch (err) {
        console.error('Failed to init marketplace settings:', err);
      } finally {
        setIsLoading(false);
      }
    };
    init();
  }, [productId]);

  const loadIntegrationData = async (integrationId: string) => {
    try {
      // 1. Fetch current mappings for this product
      const productMaps = await apiFetch<ProductMapping[]>(`/integrations/products/${productId}/mappings`);
      setMappings(productMaps || []);
      const currentMap = (productMaps || []).find((m) => m.integrationId === integrationId) || null;
      setActiveMapping(currentMap);

      if (currentMap) {
        setSelectedCategoryId(currentMap.marketplaceCategoryId);
        setSelectedCategoryName(currentMap.marketplaceCategoryName);
        setAttributeMappings(currentMap.attributesMapping || {});
      } else {
        setSelectedCategoryId('');
        setSelectedCategoryName('');
        setAttributeMappings({});
      }

      // 2. Fetch Category Tree for search autocompletion
      const tree = await apiFetch<TrendyolCategory[]>(`/integrations/${integrationId}/categories/trendyol-tree`);
      const flat: Array<{ id: string; fullName: string }> = [];
      const traverse = (nodes: TrendyolCategory[], path: string = '') => {
        nodes.forEach((node) => {
          const currentPath = path ? `${path} > ${node.name}` : node.name;
          // Format as requested: (ID, category tree)
          flat.push({ id: node.id.toString(), fullName: `(${node.id}) ${currentPath}` });
          if (node.subCategories && node.subCategories.length > 0) {
            traverse(node.subCategories, currentPath);
          }
        });
      };
      traverse(tree || []);
      setFlattenedCategories(flat);
    } catch (err) {
      console.error('Failed to load integration specific mapping data:', err);
    }
  };

  // Load category attributes when a category is chosen
  useEffect(() => {
    if (!selectedCategoryId || !selectedIntegrationId) {
      setCategoryAttributes([]);
      return;
    }

    const loadAttrs = async () => {
      setIsLoadingAttributes(true);
      try {
        const res = await apiFetch<{ categoryAttributes: TrendyolAttribute[] }>(
          `/integrations/${selectedIntegrationId}/categories/trendyol-attributes/${selectedCategoryId}`
        );
        const attrs = res?.categoryAttributes || [];
        setCategoryAttributes(attrs);

        // Pre-fill attributes mapping configs if not already set
        if (!activeMapping || activeMapping.marketplaceCategoryId !== selectedCategoryId) {
          const initialMap: Record<string, { type: 'field' | 'variant' | 'static'; value: string }> = {};
          attrs.forEach((attr) => {
            const isVar = attr.attribute.name.toLowerCase().includes('beden') || attr.attribute.name.toLowerCase().includes('renk');
            initialMap[attr.attribute.id.toString()] = {
              type: isVar ? 'variant' : 'static',
              value: attr.attributeValues?.length > 0 ? attr.attributeValues[0].name : '',
            };
          });
          setAttributeMappings(initialMap);
        }
      } catch (err) {
        console.error('Failed to load category attributes:', err);
      } finally {
        setIsLoadingAttributes(false);
      }
    };
    loadAttrs();
  }, [selectedCategoryId, selectedIntegrationId]);

  const handleCategorySelect = (id: string, fullName: string) => {
    setSelectedCategoryId(id);
    // Extract name part without (ID) prefix
    const pathOnly = fullName.substring(fullName.indexOf(') ') + 2);
    setSelectedCategoryName(pathOnly);
    setCategorySearchQuery('');
  };

  const handleAttributeChange = (attrId: string, key: 'type' | 'value', val: string) => {
    setAttributeMappings((prev) => ({
      ...prev,
      [attrId]: {
        ...prev[attrId],
        [key]: val,
        ...(key === 'type' ? { value: '' } : {}),
      },
    }));
  };

  const handleSaveAndPush = async () => {
    if (!selectedCategoryId || !selectedIntegrationId) return;
    setIsSyncing(true);
    try {
      const payload = {
        integrationId: selectedIntegrationId,
        marketplaceCategoryId: selectedCategoryId,
        marketplaceCategoryName: selectedCategoryName,
        attributesMapping: attributeMappings,
      };

      const updatedMap = await apiFetch<ProductMapping>(`/integrations/products/${productId}/mappings`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      setMappings((prev) => {
        const filtered = prev.filter((m) => m.integrationId !== selectedIntegrationId);
        return [updatedMap, ...filtered];
      });
      setActiveMapping(updatedMap);
      toast.success(t('saveSuccess'));
    } catch (err: any) {
      toast.error(err.message || t('saveFailed'));
    } finally {
      setIsSyncing(false);
    }
  };

  const handleRemoveMapping = async () => {
    if (!activeMapping) return;
    if (!confirm(t('removeConfirm'))) return;
    setIsSyncing(true);
    try {
      await apiFetch(`/integrations/products/${productId}/mappings/${activeMapping.id}`, {
        method: 'DELETE',
      });
      setMappings((prev) => prev.filter((m) => m.id !== activeMapping.id));
      setActiveMapping(null);
      setSelectedCategoryId('');
      setSelectedCategoryName('');
      setAttributeMappings({});
      setCategoryAttributes([]);
    } catch (err: any) {
      toast.error(err.message || t('removeFailed'));
    } finally {
      setIsSyncing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-12">
        <ArrowPathIcon className="h-6 w-6 text-kp-accent animate-spin" />
        <span className="ml-2 text-xs text-kp-text-tertiary">{t('loading')}</span>
      </div>
    );
  }

  if (integrations.length === 0) {
    return (
      <div className="rounded-kp-md border border-kp-border bg-kp-bg-primary/10 p-5 text-center">
        <ExclamationTriangleIcon className="h-6 w-6 text-kp-text-tertiary mx-auto mb-2" />
        <p className="text-xs font-semibold text-kp-text-secondary">{t('noIntegration.title')}</p>
        <p className="text-[0.6875rem] text-kp-text-tertiary mt-1">
          {t('noIntegration.desc')}
        </p>
      </div>
    );
  }

  const filteredCats = categorySearchQuery
    ? flattenedCategories.filter((c) => c.fullName.toLowerCase().includes(categorySearchQuery.toLowerCase())).slice(0, 8)
    : [];

  return (
    <div className="space-y-6">
      {/* Integration Selector */}
      <div className="flex items-center justify-between border-b border-kp-border pb-4">
        <div>
          <h4 className="text-xs font-bold text-kp-text-primary uppercase tracking-wider">{t('title')}</h4>
          <p className="text-[0.6875rem] text-kp-text-tertiary">{t('subtitle')}</p>
        </div>
        <select
          value={selectedIntegrationId}
          onChange={(e) => {
            setSelectedIntegrationId(e.target.value);
            loadIntegrationData(e.target.value);
          }}
          className="bg-kp-bg-secondary border border-kp-border rounded-kp-md text-xs px-3.5 py-1.5 focus:outline-hidden"
        >
          {integrations.map((i) => (
            <option key={i.id} value={i.id}>
              {i.name} ({i.provider.toUpperCase()})
            </option>
          ))}
        </select>
      </div>

      {/* Sync Status Banner */}
      {activeMapping && (
        <div className={`flex items-center justify-between p-3.5 border rounded-kp-md text-xs ${
          activeMapping.status === 'synced' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' :
          activeMapping.status === 'error' ? 'bg-red-500/10 border-red-500/20 text-red-400' :
          'bg-blue-500/10 border-blue-500/20 text-blue-400'
        }`}>
          <div className="flex items-center gap-2">
            {activeMapping.status === 'synced' ? <CheckCircleIcon className="h-4.5 w-4.5" /> : <ArrowPathIcon className="h-4.5 w-4.5" />}
            <div>
              <p className="font-semibold capitalize">{t('syncStatus')}: {activeMapping.status}</p>
              {activeMapping.errorMessage && (
                <p className="text-[0.625rem] text-red-300 mt-0.5">{activeMapping.errorMessage}</p>
              )}
            </div>
          </div>
          {activeMapping.marketplaceProductId && (
            <span className="font-mono text-[0.625rem] bg-white/5 px-2 py-0.5 rounded-sm">
              ID: {activeMapping.marketplaceProductId}
            </span>
          )}
        </div>
      )}

      {/* Categories Mappings Select Form */}
      <div className="space-y-4">
        <div className="relative">
          <label className="block text-[0.625rem] font-bold text-kp-text-tertiary uppercase tracking-wider mb-1.5">
            {t('categoryMapping')}
          </label>
          
          {selectedCategoryId ? (
            <div className="flex items-center justify-between border border-kp-border rounded-kp-md bg-kp-accent/5 px-3.5 py-2.5 text-xs">
              <span className="font-semibold text-kp-text-primary">
                ({selectedCategoryId}) {selectedCategoryName}
              </span>
              <button
                onClick={() => setSelectedCategoryId('')}
                className="text-kp-text-tertiary hover:text-kp-danger transition-colors"
                type="button"
              >
                {t('change')}
              </button>
            </div>
          ) : (
            <>
              <div className="relative">
                <input
                  type="text"
                  value={categorySearchQuery}
                  onChange={(e) => setCategorySearchQuery(e.target.value)}
                  placeholder={t('categorySearchPlaceholder')}
                  className="w-full bg-kp-bg-secondary border border-kp-border rounded-kp-md px-3.5 py-2 text-xs text-kp-text-primary focus:outline-hidden focus:border-kp-accent"
                />
                <FolderOpenIcon className="absolute right-3.5 top-2.5 h-4 w-4 text-kp-text-tertiary" />
              </div>
              
              {filteredCats.length > 0 && (
                <div className="absolute z-10 w-full mt-1.5 bg-kp-bg-secondary border border-kp-border rounded-kp-md shadow-xl max-h-60 overflow-y-auto divide-y divide-kp-border">
                  {filteredCats.map((cat) => (
                    <button
                      key={cat.id}
                      onClick={() => handleCategorySelect(cat.id, cat.fullName)}
                      className="w-full text-left px-4 py-2.5 hover:bg-kp-bg-hover text-xs text-kp-text-secondary hover:text-kp-text-primary transition-colors"
                      type="button"
                    >
                      {cat.fullName}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* Dynamic Attributes Mapping */}
        {selectedCategoryId && (
          <div className="space-y-3.5 border-t border-kp-border pt-4">
            <h5 className="text-[0.625rem] font-bold text-kp-text-tertiary uppercase tracking-wider">{t('attributesTitle')}</h5>
            
            {isLoadingAttributes ? (
              <div className="flex items-center justify-center py-6">
                <ArrowPathIcon className="h-4.5 w-4.5 text-kp-accent animate-spin" />
                <span className="ml-2 text-xs text-kp-text-tertiary">{t('loadingAttributes')}</span>
              </div>
            ) : categoryAttributes.length === 0 ? (
              <p className="text-xs text-kp-text-tertiary italic">{t('noAttributes')}</p>
            ) : (
              <div className="overflow-hidden border border-kp-border rounded-kp-md bg-kp-bg-primary/10">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-kp-border bg-kp-bg-primary/20 text-[0.625rem] font-semibold uppercase text-kp-text-tertiary">
                      <th className="py-2.5 px-3.5">{t('columns.attribute')}</th>
                      <th className="py-2.5 px-3.5">{t('columns.type')}</th>
                      <th className="py-2.5 px-3.5">{t('columns.value')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-kp-border text-kp-text-secondary">
                    {categoryAttributes.map((attr) => {
                      const idStr = attr.attribute.id.toString();
                      const config = attributeMappings[idStr] || { type: 'static', value: '' };

                      return (
                        <tr key={attr.attribute.id} className="hover:bg-kp-bg-hover/10">
                          <td className="py-2.5 px-3.5 font-medium text-kp-text-primary">
                            {attr.attribute.name} {attr.required && <span className="text-kp-danger ml-0.5">*</span>}
                          </td>
                          <td className="py-2.5 px-3.5">
                            <select
                              value={config.type}
                              onChange={(e) => handleAttributeChange(idStr, 'type', e.target.value)}
                              className="bg-kp-bg-secondary border border-kp-border rounded-kp-md px-1.5 py-0.5 text-xs focus:outline-hidden"
                            >
                              <option value="static">{t('typeStatic')}</option>
                              <option value="variant">{t('typeVariant')}</option>
                              <option value="field">{t('typeField')}</option>
                            </select>
                          </td>
                          <td className="py-2.5 px-3.5">
                            {config.type === 'static' ? (
                              attr.attributeValues && attr.attributeValues.length > 0 ? (
                                <select
                                  value={config.value}
                                  onChange={(e) => handleAttributeChange(idStr, 'value', e.target.value)}
                                  className="w-full bg-kp-bg-secondary border border-kp-border rounded-kp-md px-1.5 py-0.5 text-xs focus:outline-hidden"
                                >
                                  <option value="">{t('selectValue')}</option>
                                  {attr.attributeValues.map((v) => (
                                    <option key={v.id} value={v.name}>{v.name}</option>
                                  ))}
                                </select>
                              ) : (
                                <input
                                  type="text"
                                  value={config.value}
                                  onChange={(e) => handleAttributeChange(idStr, 'value', e.target.value)}
                                  className="w-full bg-kp-bg-secondary border border-kp-border rounded-kp-md px-2 py-0.5 text-xs focus:outline-hidden"
                                />
                              )
                            ) : config.type === 'variant' ? (
                              <select
                                value={config.value}
                                onChange={(e) => handleAttributeChange(idStr, 'value', e.target.value)}
                                className="w-full bg-kp-bg-secondary border border-kp-border rounded-kp-md px-1.5 py-0.5 text-xs focus:outline-hidden"
                              >
                                <option value="">{t('selectVariant')}</option>
                                <option value="Beden">{t('variantSize')}</option>
                                <option value="Renk">{t('variantColor')}</option>
                                <option value="Boy">{t('variantLength')}</option>
                              </select>
                            ) : (
                              <select
                                value={config.value}
                                onChange={(e) => handleAttributeChange(idStr, 'value', e.target.value)}
                                className="w-full bg-kp-bg-secondary border border-kp-border rounded-kp-md px-1.5 py-0.5 text-xs focus:outline-hidden"
                              >
                                <option value="">{t('selectField')}</option>
                                <option value="name">{t('fieldName')}</option>
                                <option value="description">{t('fieldDescription')}</option>
                                <option value="sku">{t('fieldSku')}</option>
                                <option value="barcode">{t('fieldBarcode')}</option>
                              </select>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex items-center justify-between border-t border-kp-border pt-5">
        <div>
          {activeMapping && (
            <button
              onClick={handleRemoveMapping}
              disabled={isSyncing}
              className="flex items-center gap-1.5 rounded-kp-md border border-kp-border hover:border-kp-danger/30 hover:text-kp-danger text-kp-text-tertiary px-3.5 py-2 text-xs font-semibold transition-all disabled:opacity-50"
            >
              <TrashIcon className="h-3.5 w-3.5" />
              {t('removeMapping')}
            </button>
          )}
        </div>
        
        <button
          onClick={handleSaveAndPush}
          disabled={isSyncing || !selectedCategoryId}
          className="flex items-center gap-2 rounded-kp-md bg-kp-accent hover:bg-kp-accent-hover text-white px-5 py-2.5 text-xs font-semibold shadow-sm transition-all disabled:opacity-40"
        >
          {isSyncing ? (
            <ArrowPathIcon className="h-4 w-4 animate-spin" />
          ) : (
            <CloudArrowUpIcon className="h-4 w-4" />
          )}
          {t('pushToMarketplace')}
        </button>
      </div>
    </div>
  );
}
