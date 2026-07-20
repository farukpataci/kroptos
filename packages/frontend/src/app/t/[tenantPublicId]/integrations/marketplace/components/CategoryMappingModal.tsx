'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { useToast } from '@/components/ui/Toast';
import {
  XMarkIcon,
  PlusIcon,
  TrashIcon,
  ArrowPathIcon,
  FolderIcon,
  Cog6ToothIcon
} from '@heroicons/react/24/outline';

interface CategoryMappingModalProps {
  isOpen: boolean;
  onClose: () => void;
  integrationId: string;
  integrationName: string;
}

interface LocalCategory {
  id: string;
  name: string;
}

interface TrendyolCategory {
  id: number;
  name: string;
  parentId: number | null;
  subCategories?: TrendyolCategory[];
}

interface AttributeValue {
  id: number;
  name: string;
}

interface TrendyolAttribute {
  required: boolean;
  allowCustom: boolean;
  attribute: {
    id: number;
    name: string;
  };
  variability: string; // VARIANTS, UNIFIED
  attributeValues: AttributeValue[];
}

interface MappingRecord {
  id: string;
  categoryId: string;
  marketplaceCategoryId: string;
  marketplaceCategoryName: string;
  attributesMapping: Record<string, { type: 'field' | 'variant' | 'static'; value: string }>;
  category: {
    name: string;
  };
}

export default function CategoryMappingModal({
  isOpen,
  onClose,
  integrationId,
  integrationName,
}: CategoryMappingModalProps) {
  const toast = useToast();
  const [localCategories, setLocalCategories] = useState<LocalCategory[]>([]);
  const [trendyolCategories, setTrendyolCategories] = useState<TrendyolCategory[]>([]);
  const [flattenedTrendyolCategories, setFlattenedTrendyolCategories] = useState<Array<{ id: string; fullName: string }>>([]);
  const [mappings, setMappings] = useState<MappingRecord[]>([]);
  
  // Loading states
  const [isLoadingList, setIsLoadingList] = useState(true);
  const [isLoadingAttributes, setIsLoadingAttributes] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeletingId, setIsDeletingId] = useState<string | null>(null);

  // Form states
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedLocalCategoryId, setSelectedLocalCategoryId] = useState('');
  const [selectedTrendyolCategoryId, setSelectedTrendyolCategoryId] = useState('');
  const [selectedTrendyolCategoryName, setSelectedTrendyolCategoryName] = useState('');
  const [categoryAttributes, setCategoryAttributes] = useState<TrendyolAttribute[]>([]);
  
  // Attributes mapping configuration state
  const [attributeMappings, setAttributeMappings] = useState<Record<string, { type: 'field' | 'variant' | 'static'; value: string }>>({});

  // Search filter
  const [trendyolSearchQuery, setTrendyolSearchQuery] = useState('');

  // Fetch initial data
  useEffect(() => {
    if (!isOpen) return;
    
    const loadInitialData = async () => {
      setIsLoadingList(true);
      try {
        // 1. Fetch Local Categories
        const localCats = await apiFetch<LocalCategory[]>('/categories');
        setLocalCategories(localCats || []);

        // 2. Fetch Mappings List
        const maps = await apiFetch<MappingRecord[]>(`/integrations/${integrationId}/categories/mappings`);
        setMappings(maps || []);

        // 3. Fetch Trendyol Categories Tree
        const trendCats = await apiFetch<TrendyolCategory[]>(`/integrations/${integrationId}/categories/trendyol-tree`);
        setTrendyolCategories(trendCats || []);

        // Flatten the tree for easy search selection
        const flat: Array<{ id: string; fullName: string }> = [];
        const traverse = (nodes: TrendyolCategory[], path: string = '') => {
          nodes.forEach((node) => {
            const currentPath = path ? `${path} > ${node.name}` : node.name;
            flat.push({ id: node.id.toString(), fullName: currentPath });
            if (node.subCategories && node.subCategories.length > 0) {
              traverse(node.subCategories, currentPath);
            }
          });
        };
        traverse(trendCats || []);
        setFlattenedTrendyolCategories(flat);
      } catch (err) {
        console.error('Failed to load category mapping data:', err);
      } finally {
        setIsLoadingList(false);
      }
    };

    loadInitialData();
  }, [isOpen, integrationId]);

  // Load attributes when a Trendyol category is selected
  useEffect(() => {
    if (!selectedTrendyolCategoryId) {
      setCategoryAttributes([]);
      setAttributeMappings({});
      return;
    }

    const loadAttributes = async () => {
      setIsLoadingAttributes(true);
      try {
        const res = await apiFetch<{ categoryAttributes: TrendyolAttribute[] }>(
          `/integrations/${integrationId}/categories/trendyol-attributes/${selectedTrendyolCategoryId}`
        );
        const attrs = res?.categoryAttributes || [];
        setCategoryAttributes(attrs);

        // Pre-initialize mappings
        const initialMappings: Record<string, { type: 'field' | 'variant' | 'static'; value: string }> = {};
        attrs.forEach((attr) => {
          // If required and has preset values, default to first value as static, or default field
          initialMappings[attr.attribute.id.toString()] = {
            type: attr.attribute.name.toLowerCase().includes('beden') || attr.attribute.name.toLowerCase().includes('renk') 
              ? 'variant' 
              : 'static',
            value: attr.attributeValues?.length > 0 ? attr.attributeValues[0].name : '',
          };
        });
        setAttributeMappings(initialMappings);
      } catch (err) {
        console.error('Failed to load category attributes:', err);
      } finally {
        setIsLoadingAttributes(false);
      }
    };

    loadAttributes();
  }, [selectedTrendyolCategoryId, integrationId]);

  const handleTrendyolCategorySelect = (id: string, name: string) => {
    setSelectedTrendyolCategoryId(id);
    setSelectedTrendyolCategoryName(name.split(' > ').pop() || name);
    setTrendyolSearchQuery('');
  };

  const handleAttributeMapChange = (attrId: string, field: 'type' | 'value', val: string) => {
    setAttributeMappings((prev) => ({
      ...prev,
      [attrId]: {
        ...prev[attrId],
        [field]: val,
        // Reset value if type changes
        ...(field === 'type' ? { value: '' } : {}),
      },
    }));
  };

  const handleSaveMapping = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLocalCategoryId || !selectedTrendyolCategoryId) {
      toast.warning('Lütfen yerel ve Trendyol kategorilerini seçiniz.');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        categoryId: selectedLocalCategoryId,
        marketplaceCategoryId: selectedTrendyolCategoryId,
        marketplaceCategoryName: selectedTrendyolCategoryName,
        attributesMapping: attributeMappings,
      };

      const newMapping = await apiFetch<MappingRecord>(`/integrations/${integrationId}/categories/mappings`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      // Update mapping list in state
      setMappings((prev) => {
        const filtered = prev.filter((m) => m.categoryId !== selectedLocalCategoryId);
        return [newMapping, ...filtered];
      });

      // Reset form
      setShowAddForm(false);
      setSelectedLocalCategoryId('');
      setSelectedTrendyolCategoryId('');
      setSelectedTrendyolCategoryName('');
      setCategoryAttributes([]);
      setAttributeMappings({});
    } catch (err: any) {
      toast.error(err.message || 'Eşleştirme kaydedilirken hata oluştu.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteMapping = async (mappingId: string) => {
    if (!confirm('Bu kategori eşleştirmesini silmek istediğinize emin misiniz?')) return;
    setIsDeletingId(mappingId);
    try {
      await apiFetch(`/integrations/${integrationId}/categories/mappings/${mappingId}`, {
        method: 'DELETE',
      });
      setMappings((prev) => prev.filter((m) => m.id !== mappingId));
    } catch (err: any) {
      toast.error(err.message || 'Eşleştirme silinemedi.');
    } finally {
      setIsDeletingId(null);
    }
  };

  if (!isOpen) return null;

  // Filter categories based on search
  const filteredTrendyolCats = trendyolSearchQuery
    ? flattenedTrendyolCategories.filter((c) =>
        c.fullName.toLowerCase().includes(trendyolSearchQuery.toLowerCase())
      ).slice(0, 10)
    : [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="relative w-full max-w-4xl max-h-[85vh] bg-kp-bg-secondary border border-kp-border rounded-kp-md shadow-2xl flex flex-col overflow-hidden animate-fade-in">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-kp-border px-6 py-4">
          <div className="flex items-center gap-2.5">
            <FolderIcon className="h-5 w-5 text-kp-accent" />
            <div>
              <h2 className="text-base font-semibold text-kp-text-primary">{integrationName} - Kategori Eşleştirme</h2>
              <p className="text-[11px] text-kp-text-tertiary">Ürünleri Trendyol'a göndermeden önce yerel kategorileri eşleştirin</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-kp-md hover:bg-kp-bg-hover text-kp-text-tertiary hover:text-kp-text-primary transition-colors">
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {isLoadingList ? (
            <div className="flex flex-col items-center justify-center h-48">
              <ArrowPathIcon className="h-7 w-7 text-kp-accent animate-spin" />
              <p className="mt-2 text-xs text-kp-text-tertiary">Kategori verileri yükleniyor...</p>
            </div>
          ) : (
            <>
              {/* Toggle Form / List Actions */}
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-kp-text-tertiary">
                  {showAddForm ? 'Yeni Kategori Eşleştirmesi Ekle' : 'Aktif Kategori Eşleştirmeleri'}
                </h3>
                <button
                  onClick={() => setShowAddForm(!showAddForm)}
                  className="flex items-center gap-1.5 rounded-kp-md bg-kp-accent hover:bg-kp-accent-hover text-white px-3.5 py-2 text-xs font-semibold transition-all"
                >
                  {showAddForm ? 'Eşleştirmelere Geri Dön' : <><PlusIcon className="h-3.5 w-3.5" /> Yeni Eşleştirme Ekle</>}
                </button>
              </div>

              {showAddForm ? (
                /* ADD/EDIT FORM */
                <form onSubmit={handleSaveMapping} className="space-y-6 bg-kp-bg-primary/20 border border-kp-border rounded-kp-md p-5">
                  <div className="grid grid-cols-2 gap-5">
                    
                    {/* Local Category Select */}
                    <div>
                      <label className="block text-[11px] font-semibold text-kp-text-tertiary uppercase tracking-wider mb-2">
                        Yerel Kategori *
                      </label>
                      <select
                        required
                        value={selectedLocalCategoryId}
                        onChange={(e) => setSelectedLocalCategoryId(e.target.value)}
                        className="w-full bg-kp-bg-primary border border-kp-border rounded-kp-md px-3.5 py-2 text-theme-sm text-kp-text-primary focus:outline-hidden focus:border-kp-accent"
                      >
                        <option value="">-- Seçiniz --</option>
                        {localCategories.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Trendyol Category Search/Select */}
                    <div className="relative">
                      <label className="block text-[11px] font-semibold text-kp-text-tertiary uppercase tracking-wider mb-2">
                        Trendyol Kategori Arama *
                      </label>
                      
                      {selectedTrendyolCategoryId ? (
                        <div className="flex items-center justify-between border border-kp-border rounded-kp-md bg-kp-accent/5 px-3.5 py-2 text-theme-sm">
                          <span className="font-medium text-kp-text-primary">{selectedTrendyolCategoryName} (ID: {selectedTrendyolCategoryId})</span>
                          <button
                            type="button"
                            onClick={() => setSelectedTrendyolCategoryId('')}
                            className="text-kp-text-tertiary hover:text-kp-danger"
                          >
                            <XMarkIcon className="h-4 w-4" />
                          </button>
                        </div>
                      ) : (
                        <>
                          <input
                            type="text"
                            value={trendyolSearchQuery}
                            onChange={(e) => setTrendyolSearchQuery(e.target.value)}
                            placeholder="Kategori adı ara (örn: tişört, ayakkabı...)"
                            className="w-full bg-kp-bg-primary border border-kp-border rounded-kp-md px-3.5 py-2 text-theme-sm text-kp-text-primary focus:outline-hidden focus:border-kp-accent"
                          />
                          {filteredTrendyolCats.length > 0 && (
                            <div className="absolute z-10 w-full mt-1.5 bg-kp-bg-secondary border border-kp-border rounded-kp-md shadow-xl max-h-60 overflow-y-auto divide-y divide-kp-border">
                              {filteredTrendyolCats.map((cat) => (
                                <button
                                  key={cat.id}
                                  type="button"
                                  onClick={() => handleTrendyolCategorySelect(cat.id, cat.fullName)}
                                  className="w-full text-left px-4 py-2.5 hover:bg-kp-bg-hover text-xs text-kp-text-secondary hover:text-kp-text-primary transition-colors"
                                >
                                  {cat.fullName}
                                </button>
                              ))}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>

                  {/* Attributes Haritalandırma Panel */}
                  {selectedTrendyolCategoryId && (
                    <div className="space-y-4 border-t border-kp-border pt-5">
                      <div className="flex items-center gap-2">
                        <Cog6ToothIcon className="h-4 w-4 text-kp-accent" />
                        <h4 className="text-xs font-semibold text-kp-text-primary">Trendyol Kategori Özellik Haritası</h4>
                      </div>

                      {isLoadingAttributes ? (
                        <div className="flex items-center justify-center py-8">
                          <ArrowPathIcon className="h-5 w-5 text-kp-accent animate-spin" />
                          <span className="ml-2 text-xs text-kp-text-tertiary">Özellikler çekiliyor...</span>
                        </div>
                      ) : categoryAttributes.length === 0 ? (
                        <p className="text-xs text-kp-text-tertiary italic">Bu kategori için özel bir nitelik gerekmiyor.</p>
                      ) : (
                        <div className="overflow-hidden border border-kp-border rounded-kp-md bg-kp-bg-primary/10">
                          <table className="w-full text-left border-collapse text-xs text-kp-text-secondary">
                            <thead>
                              <tr className="border-b border-kp-border bg-kp-bg-primary/20 text-[10px] font-semibold uppercase tracking-wider text-kp-text-tertiary">
                                <th className="py-2.5 px-4">Trendyol Niteliği</th>
                                <th className="py-2.5 px-4">Zorunluluk</th>
                                <th className="py-2.5 px-4">Eşleştirme Türü</th>
                                <th className="py-2.5 px-4">Eşleşen Alan / Sabit Değer</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-kp-border">
                              {categoryAttributes.map((attr) => {
                                const idStr = attr.attribute.id.toString();
                                const mapConfig = attributeMappings[idStr] || { type: 'static', value: '' };

                                return (
                                  <tr key={attr.attribute.id} className="hover:bg-kp-bg-hover/20">
                                    <td className="py-3 px-4 font-medium text-kp-text-primary">{attr.attribute.name}</td>
                                    <td className="py-3 px-4">
                                      {attr.required ? (
                                        <span className="text-[10px] bg-kp-danger/10 text-kp-danger px-1.5 py-0.5 rounded-sm font-semibold">ZORUNLU</span>
                                      ) : (
                                        <span className="text-[10px] text-kp-text-tertiary">Opsiyonel</span>
                                      )}
                                    </td>
                                    <td className="py-3 px-4">
                                      <select
                                        value={mapConfig.type}
                                        onChange={(e) => handleAttributeMapChange(idStr, 'type', e.target.value as any)}
                                        className="bg-kp-bg-primary border border-kp-border rounded-kp-md px-2 py-1 text-xs focus:outline-hidden"
                                      >
                                        <option value="static">Sabit Değer</option>
                                        <option value="variant">Varyant Özelliği</option>
                                        <option value="field">Ürün Standart Alanı</option>
                                      </select>
                                    </td>
                                    <td className="py-3 px-4">
                                      {mapConfig.type === 'static' ? (
                                        attr.attributeValues && attr.attributeValues.length > 0 ? (
                                          <select
                                            value={mapConfig.value}
                                            onChange={(e) => handleAttributeMapChange(idStr, 'value', e.target.value)}
                                            className="w-full bg-kp-bg-primary border border-kp-border rounded-kp-md px-2 py-1 text-xs focus:outline-hidden"
                                          >
                                            <option value="">-- Seçiniz --</option>
                                            {attr.attributeValues.map((v) => (
                                              <option key={v.id} value={v.name}>{v.name}</option>
                                            ))}
                                          </select>
                                        ) : (
                                          <input
                                            type="text"
                                            value={mapConfig.value}
                                            onChange={(e) => handleAttributeMapChange(idStr, 'value', e.target.value)}
                                            placeholder="Sabit değer giriniz"
                                            className="w-full bg-kp-bg-primary border border-kp-border rounded-kp-md px-2 py-1 text-xs focus:outline-hidden"
                                          />
                                        )
                                      ) : mapConfig.type === 'variant' ? (
                                        <select
                                          value={mapConfig.value}
                                          onChange={(e) => handleAttributeMapChange(idStr, 'value', e.target.value)}
                                          className="w-full bg-kp-bg-primary border border-kp-border rounded-kp-md px-2 py-1 text-xs focus:outline-hidden"
                                        >
                                          <option value="">-- Eşleşecek Varyant --</option>
                                          <option value="Beden">Beden (Size)</option>
                                          <option value="Renk">Renk (Color)</option>
                                          <option value="Boy">Boy (Length)</option>
                                        </select>
                                      ) : (
                                        <select
                                          value={mapConfig.value}
                                          onChange={(e) => handleAttributeMapChange(idStr, 'value', e.target.value)}
                                          className="w-full bg-kp-bg-primary border border-kp-border rounded-kp-md px-2 py-1 text-xs focus:outline-hidden"
                                        >
                                          <option value="">-- Eşleşecek Alan --</option>
                                          <option value="name">Ürün Başlığı</option>
                                          <option value="description">Ürün Açıklaması</option>
                                          <option value="sku">Stok Kodu (SKU)</option>
                                          <option value="barcode">Barkod</option>
                                          <option value="weight">Ağırlık</option>
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

                  {/* Actions */}
                  <div className="flex justify-end gap-3 border-t border-kp-border pt-4">
                    <button
                      type="button"
                      onClick={() => setShowAddForm(false)}
                      className="rounded-kp-md border border-kp-border text-kp-text-secondary hover:bg-kp-bg-hover px-4 py-2 text-xs font-semibold"
                    >
                      Vazgeç
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmitting || !selectedLocalCategoryId || !selectedTrendyolCategoryId}
                      className="flex items-center gap-1.5 rounded-kp-md bg-kp-accent hover:bg-kp-accent-hover text-white px-4 py-2 text-xs font-semibold disabled:opacity-50"
                    >
                      {isSubmitting ? <ArrowPathIcon className="h-4.5 w-4.5 animate-spin" /> : 'Kaydet ve Eşleştir'}
                    </button>
                  </div>
                </form>
              ) : (
                /* MAPPINGS LIST */
                <div className="border border-kp-border rounded-kp-md overflow-hidden">
                  <table className="w-full text-left border-collapse text-theme-sm text-kp-text-secondary">
                    <thead>
                      <tr className="border-b border-kp-border text-[11px] font-semibold uppercase tracking-wider text-kp-text-tertiary bg-kp-bg-primary/20">
                        <th className="py-3 px-4">Yerel Kategori</th>
                        <th className="py-3 px-4">Eşleşen Trendyol Kategorisi</th>
                        <th className="py-3 px-4">Nitelik Mappings (JSON)</th>
                        <th className="py-3 px-4 text-right">İşlemler</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-kp-border">
                      {mappings.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="py-12 text-center text-xs text-kp-text-tertiary">
                            Henüz eşleştirilmiş bir kategori bulunmuyor. Başlamak için sağ üstteki butonla eşleştirme yapabilirsiniz.
                          </td>
                        </tr>
                      ) : (
                        mappings.map((m) => (
                          <tr key={m.id} className="hover:bg-kp-bg-hover/20 transition-colors">
                            <td className="py-3.5 px-4 font-semibold text-kp-text-primary">{m.category?.name || 'Bilinmeyen'}</td>
                            <td className="py-3.5 px-4 text-kp-text-primary">
                              <span className="bg-kp-accent/10 text-kp-accent px-2 py-0.5 rounded-kp-md text-xs font-medium mr-1.5">
                                {m.marketplaceCategoryId}
                              </span>
                              {m.marketplaceCategoryName}
                            </td>
                            <td className="py-3.5 px-4 text-xs">
                              {m.attributesMapping ? (
                                <code className="block max-w-[250px] truncate bg-kp-bg-primary/50 text-[10px] text-kp-text-tertiary px-1.5 py-0.5 rounded-sm">
                                  {JSON.stringify(m.attributesMapping)}
                                </code>
                              ) : (
                                <span className="text-kp-text-tertiary italic">Yok</span>
                              )}
                            </td>
                            <td className="py-3.5 px-4 text-right">
                              <button
                                onClick={() => handleDeleteMapping(m.id)}
                                disabled={isDeletingId === m.id}
                                className="p-1 rounded-kp-md hover:bg-kp-bg-hover text-kp-text-tertiary hover:text-kp-danger transition-colors disabled:opacity-50"
                                title="Eşleştirmeyi Sil"
                              >
                                {isDeletingId === m.id ? (
                                  <ArrowPathIcon className="h-4 w-4 animate-spin" />
                                ) : (
                                  <TrashIcon className="h-4 w-4" />
                                )}
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
