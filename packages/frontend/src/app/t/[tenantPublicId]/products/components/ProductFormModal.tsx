'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { XMarkIcon, ArrowPathIcon, ExclamationTriangleIcon, PhotoIcon, InformationCircleIcon, BanknotesIcon, TruckIcon, LinkIcon, ArrowsRightLeftIcon } from '@heroicons/react/24/outline';
import { Product, Category, ProductPayload } from '../hooks/useProducts';
import { apiFetch } from '@/lib/api';
import ProductMarketplaceSettings from './ProductMarketplaceSettings';

interface ProductFormModalProps {
  product?: Product | null; // null = create mode
  categories: Category[];
  onClose: () => void;
  onSubmit: (payload: ProductPayload) => Promise<void>;
}

type FormTab = 'url_import' | 'basic' | 'pricing' | 'dimensions' | 'images' | 'variants' | 'bundle' | 'cross_sell' | 'accounting' | 'integrations';

const TABS: { value: FormTab; label: string }[] = [
  { value: 'url_import', label: 'Link ile Yükle' },
  { value: 'basic', label: 'Temel Bilgiler' },
  { value: 'pricing', label: 'Fiyatlandırma' },
  { value: 'dimensions', label: 'Boyut & Ağırlık' },
  { value: 'images', label: 'Görseller' },
  { value: 'variants', label: 'Varyasyonlar (Beden)' },
  { value: 'bundle', label: 'Paket İçeriği (Bundle)' },
  { value: 'cross_sell', label: 'Çapraz Satış' },
  { value: 'accounting', label: 'Muhasebe Eşleştirme' },
  { value: 'integrations', label: 'Pazaryeri Entegrasyonu' },
];

const DEFAULT_FORM = {
  categoryId: '',
  sku: '',
  name: '',
  description: '',
  price: '',
  basePrice: '',
  costPrice: '',
  barcode: '',
  currency: 'TRY',
  stockQuantity: '0',
  status: 'active',
  weight: '',
  width: '',
  height: '',
  depth: '',
  erpCode: '',
  erpId: '',
  taxRate: '20',
  type: 'SIMPLE',
};

function calcMargin(price: string, costPrice: string): string | null {
  const p = parseFloat(price);
  const c = parseFloat(costPrice);
  if (!p || !c || p <= 0) return null;
  const margin = ((p - c) / p) * 100;
  return margin.toFixed(1);
}

export default function ProductFormModal({ product, categories, onClose, onSubmit }: ProductFormModalProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const isEdit = !!product;
  const [activeTab, setActiveTab] = useState<FormTab>(isEdit ? 'basic' : 'url_import');
  const [form, setForm] = useState(DEFAULT_FORM);
  const [images, setImages] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);
  const [scrapingUrl, setScrapingUrl] = useState('');
  const [isScraping, setIsScraping] = useState(false);
  const [erpSearchQuery, setErpSearchQuery] = useState('');
  const [erpSearchResults, setErpSearchResults] = useState<any[]>([]);
  const [isSearchingErp, setIsSearchingErp] = useState(false);

  // Variant, Bundle, and Cross-Sell States
  const [allProductsList, setAllProductsList] = useState<any[]>([]);
  const [variantList, setVariantList] = useState<any[]>([]);
  const [bundleItemsList, setBundleItemsList] = useState<any[]>([]);
  const [crossSellList, setCrossSellList] = useState<any[]>([]);

  useEffect(() => {
    const fetchAllProducts = async () => {
      try {
        const data = await apiFetch<any[]>('/products');
        setAllProductsList(data || []);
      } catch (err) {
        console.error('Failed to load products list:', err);
      }
    };
    fetchAllProducts();
  }, [product]);

  useEffect(() => {
    if (product) {
      setForm({
        categoryId: product.categoryId || '',
        sku: product.sku || '',
        name: product.name || '',
        description: product.description || '',
        price: product.price?.toString() || '',
        basePrice: product.basePrice?.toString() || '',
        costPrice: product.costPrice?.toString() || '',
        barcode: product.barcode || '',
        currency: product.currency || 'TRY',
        stockQuantity: product.stockQuantity?.toString() || '0',
        status: product.status || 'active',
        weight: product.weight?.toString() || '',
        width: product.width?.toString() || '',
        height: product.height?.toString() || '',
        depth: product.depth?.toString() || '',
        erpCode: product.erpCode || '',
        erpId: product.erpId || '',
        taxRate: product.taxRate?.toString() || '20',
        type: (product as any).type || 'SIMPLE',
      });

      // Populate variantList:
      if ((product as any).variants && (product as any).variants.length > 0) {
        setVariantList(
          (product as any).variants.map((v: any) => ({
            sku: v.sku,
            price: v.price?.toString() || '0.00',
            stockQuantity: v.stockQuantity?.toString() || '0',
            size: v.variantAttributes?.Beden || '',
            color: v.variantAttributes?.Renk || '',
          }))
        );
      } else {
        setVariantList([]);
      }

      // Populate bundleItemsList:
      if ((product as any).bundleItems && (product as any).bundleItems.length > 0) {
        setBundleItemsList(
          (product as any).bundleItems.map((item: any) => ({
            childProductId: item.childProductId,
            name: item.childProduct?.name || 'Ürün',
            sku: item.childProduct?.sku || '',
            price: item.childProduct?.price?.toString() || '0.00',
            quantity: item.quantity,
            discountRate: item.discountRate?.toString() || '0',
          }))
        );
      } else {
        setBundleItemsList([]);
      }

      // Populate crossSellList:
      if ((product as any).crossSellSources && (product as any).crossSellSources.length > 0) {
        setCrossSellList(
          (product as any).crossSellSources.map((item: any) => ({
            targetProductId: item.targetProductId,
            name: item.targetProduct?.name || 'Ürün',
            sku: item.targetProduct?.sku || '',
            price: item.targetProduct?.price?.toString() || '0.00',
            displayOrder: item.displayOrder,
          }))
        );
      } else {
        setCrossSellList([]);
      }

      // Parse images list
      let imgList: string[] = [];
      if (product.image) {
        if (product.image.startsWith('[')) {
          try {
            imgList = JSON.parse(product.image);
          } catch (_) {
            imgList = [product.image];
          }
        } else {
          imgList = [product.image];
        }
      }
      setImages(imgList);
    } else {
      setForm(DEFAULT_FORM);
      setImages([]);
      setVariantList([]);
      setBundleItemsList([]);
      setCrossSellList([]);
      setErpSearchQuery('');
      setErpSearchResults([]);
    }
  }, [product]);

  useEffect(() => {
    if (activeTab !== 'accounting') return;

    const delayDebounceFn = setTimeout(async () => {
      setIsSearchingErp(true);
      try {
        const results = await apiFetch<any[]>(`/products/erp-search?q=${encodeURIComponent(erpSearchQuery)}`);
        setErpSearchResults(results);
      } catch (err) {
        console.error('Failed to search ERP items:', err);
      } finally {
        setIsSearchingErp(false);
      }
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [erpSearchQuery, activeTab]);

  const margin = calcMargin(form.price, form.costPrice);

  const set = (key: keyof typeof form, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleAddImageSlot = () => {
    setImages([...images, '']);
  };

  const handleRemoveImage = (idx: number) => {
    setImages(images.filter((_, i) => i !== idx));
  };

  const handleDragStart = (e: React.DragEvent, idx: number) => {
    setDraggedIdx(idx);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, targetIdx: number) => {
    e.preventDefault();
    if (draggedIdx === null || draggedIdx === targetIdx) return;
    const reordered = [...images];
    const [draggedItem] = reordered.splice(draggedIdx, 1);
    reordered.splice(targetIdx, 0, draggedItem);
    setImages(reordered);
  };

  const handleDragEnd = () => {
    setDraggedIdx(null);
  };

  const handleScrapeProduct = async () => {
    if (!scrapingUrl.trim()) return;
    setIsScraping(true);
    setError(null);
    try {
      const data = await apiFetch<any>('/products/parse-url', {
        method: 'POST',
        body: JSON.stringify({ url: scrapingUrl.trim() }),
      });

      setForm((prev) => ({
        ...prev,
        name: data.name || prev.name,
        sku: data.sku || prev.sku,
        description: data.description || prev.description,
        price: data.price?.toString() || prev.price,
        basePrice: data.basePrice?.toString() || prev.basePrice,
      }));

      if (data.images && data.images.length > 0) {
        setImages(data.images);
      }

      setScrapingUrl('');
      setActiveTab('basic');
    } catch (err: any) {
      setError(err.message || 'Ürün bilgileri URL\'den alınamadı. Lütfen geçerli bir URL girin.');
    } finally {
      setIsScraping(false);
    }
  };

  const handleImageUploadAt = (e: React.ChangeEvent<HTMLInputElement>, idx: number) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Lütfen geçerli bir görsel dosyası seçin.');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError('Görsel boyutu en fazla 5MB olabilir.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        const newImages = [...images];
        newImages[idx] = reader.result;
        setImages(newImages);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleImageURLAt = (url: string, idx: number) => {
    if (!url.trim()) return;
    const newImages = [...images];
    newImages[idx] = url.trim();
    setImages(newImages);
  };

  const handleAddVariantRow = () => {
    setVariantList([
      ...variantList,
      { sku: `${form.sku}-VAR-${variantList.length + 1}`, price: form.price || '0.00', stockQuantity: '0', size: '', color: '' }
    ]);
  };

  const handleAddBundleItem = (productId: string) => {
    if (!productId) return;
    if (bundleItemsList.some((item) => item.childProductId === productId)) return;
    const prod = allProductsList.find((p) => p.id === productId);
    setBundleItemsList([
      ...bundleItemsList,
      { childProductId: productId, name: prod?.name, sku: prod?.sku, price: prod?.price?.toString() || '0.00', quantity: 1, discountRate: '0' }
    ]);
  };

  const handleAddCrossSellItem = (productId: string) => {
    if (!productId) return;
    if (crossSellList.some((item) => item.targetProductId === productId)) return;
    const prod = allProductsList.find((p) => p.id === productId);
    setCrossSellList([
      ...crossSellList,
      { targetProductId: productId, name: prod?.name, sku: prod?.sku, price: prod?.price?.toString() || '0.00', displayOrder: crossSellList.length }
    ]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { setError('Ürün adı zorunludur.'); setActiveTab('basic'); return; }
    if (!form.sku.trim()) { setError('SKU kodu zorunludur.'); setActiveTab('basic'); return; }
    if (!form.price || parseFloat(form.price) <= 0) { setError('Geçerli bir satış fiyatı giriniz.'); setActiveTab('pricing'); return; }
    if (!form.basePrice || parseFloat(form.basePrice) <= 0) { setError('Geçerli bir taban fiyat giriniz.'); setActiveTab('pricing'); return; }

    setError(null);
    setIsSubmitting(true);

    const payload: ProductPayload = {
      categoryId: form.categoryId || undefined,
      sku: form.sku.trim(),
      name: form.name.trim(),
      description: form.description || undefined,
      price: parseFloat(form.price),
      basePrice: parseFloat(form.basePrice),
      costPrice: form.costPrice ? parseFloat(form.costPrice) : undefined,
      barcode: form.barcode || undefined,
      currency: form.currency,
      stockQuantity: parseInt(form.stockQuantity, 10) || 0,
      status: form.status,
      weight: form.weight ? parseFloat(form.weight) : undefined,
      width: form.width ? parseFloat(form.width) : undefined,
      height: form.height ? parseFloat(form.height) : undefined,
      depth: form.depth ? parseFloat(form.depth) : undefined,
      image: images.filter(Boolean).length > 0 ? JSON.stringify(images.filter(Boolean)) : undefined,
      erpCode: form.erpCode || undefined,
      erpId: form.erpId || undefined,
      taxRate: form.taxRate ? parseInt(form.taxRate, 10) : 20,
      type: form.type,
      bundleItems: form.type === 'BUNDLE' ? bundleItemsList.map((item) => ({
        childProductId: item.childProductId,
        quantity: item.quantity,
        discountRate: item.discountRate ? parseFloat(item.discountRate) : undefined,
      })) : undefined,
      crossSellProducts: crossSellList.map((item) => ({
        targetProductId: item.targetProductId,
        displayOrder: item.displayOrder,
      })),
      variants: form.type === 'VARIANT_PARENT' ? variantList.map((v) => ({
        sku: v.sku,
        price: parseFloat(v.price) || 0,
        stockQuantity: parseInt(v.stockQuantity, 10) || 0,
        variantAttributes: { Beden: v.size, Renk: v.color },
      })) : undefined,
    };

    try {
      await onSubmit(payload);
      onClose();
    } catch (err: any) {
      setError(err.message || 'İşlem başarısız oldu.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const inputCls = 'w-full bg-kp-bg-primary border border-kp-border rounded-kp-md px-3.5 py-2 text-xs text-kp-text-primary placeholder:text-kp-text-tertiary focus:outline-none focus:border-kp-accent transition-colors';
  const labelCls = 'block text-[11px] font-medium text-kp-text-secondary mb-1';

  if (!mounted) return null;

  const tabsToRender = TABS.filter((t) => {
    if (t.value === 'url_import' && isEdit) return false;
    if (t.value === 'variants' && form.type !== 'VARIANT_PARENT') return false;
    if (t.value === 'bundle' && form.type !== 'BUNDLE') return false;
    if (t.value === 'integrations' && !isEdit) return false;
    return true;
  });

  return createPortal(
    <div className="fixed inset-0 z-[70] bg-kp-bg-secondary flex flex-col h-screen w-screen overflow-hidden animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between px-8 py-5 border-b border-kp-border bg-kp-bg-primary/20 flex-shrink-0">
        <div>
          <h3 className="text-base font-bold text-kp-text-primary">
            {isEdit ? 'Ürün Düzenle' : 'Yeni Ürün Ekle'}
          </h3>
          <p className="text-xs text-kp-text-tertiary mt-0.5">
            {isEdit ? `SKU: ${product?.sku}` : 'Ürün kataloğuna yeni kayıt ekle'}
          </p>
        </div>
        <button onClick={onClose} className="rounded-kp-md p-1.5 hover:bg-kp-bg-hover text-kp-text-tertiary hover:text-kp-text-primary transition-colors">
          <XMarkIcon className="h-5 w-5" />
        </button>
      </div>

      {/* Horizontal Tabs at the top */}
      <div className="flex border-b border-kp-border px-8 bg-kp-bg-primary/10 flex-shrink-0">
        {tabsToRender.map(({ value, label }) => {
          const isActive = activeTab === value;
          const Icon =
            value === 'url_import' ? LinkIcon :
            value === 'basic' ? InformationCircleIcon :
            value === 'pricing' ? BanknotesIcon :
            value === 'dimensions' ? TruckIcon :
            value === 'accounting' ? ArrowsRightLeftIcon :
            value === 'integrations' ? LinkIcon :
            PhotoIcon;
          return (
            <button
              key={value}
              type="button"
              onClick={() => setActiveTab(value)}
              className={`flex items-center gap-2 px-5 py-4 text-xs font-semibold border-b-2 transition-all ${
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

      <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
        <div className="flex-1 overflow-y-auto p-8">
          <div className="max-w-4xl mx-auto w-full space-y-6">
            {error && (
              <div className="flex items-start gap-2 p-3 text-xs rounded-kp-md bg-kp-danger/10 border border-kp-danger/20 text-kp-danger">
                <ExclamationTriangleIcon className="h-4 w-4 flex-shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {/* ── LINK IMPORT TAB ── */}
            {activeTab === 'url_import' && (
              <div className="space-y-6 max-w-2xl mx-auto py-8">
                <div className="text-center space-y-2">
                  <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-kp-accent/10 text-kp-accent">
                    <LinkIcon className="h-6 w-6" />
                  </div>
                  <h4 className="text-sm font-semibold text-kp-text-primary">URL ile Ürün Bilgilerini Doldur</h4>
                  <p className="text-xs text-kp-text-tertiary max-w-md mx-auto">
                    Desteklenen e-ticaret sitelerinden veya herhangi bir ürün sayfasından bağlantı yapıştırarak tüm alanları (ürün adı, açıklaması, fiyatı ve görselleri) saniyeler içinde otomatik olarak doldurabilirsiniz.
                  </p>
                </div>

                <div className="bg-kp-bg-primary/30 border border-kp-border rounded-kp-lg p-6 space-y-4">
                  <div>
                    <label className={labelCls}>Ürün Bağlantısı (URL)</label>
                    <input
                      type="url"
                      placeholder="https://example.com/product/..."
                      value={scrapingUrl}
                      onChange={(e) => setScrapingUrl(e.target.value)}
                      className={inputCls}
                    />
                  </div>

                  <button
                    type="button"
                    onClick={handleScrapeProduct}
                    disabled={isScraping || !scrapingUrl.trim()}
                    className="w-full flex items-center justify-center gap-2 rounded-kp-md bg-kp-accent hover:bg-kp-accent-hover text-white py-2.5 text-xs font-semibold shadow-sm transition-all disabled:opacity-50"
                  >
                    {isScraping ? (
                      <>
                        <ArrowPathIcon className="h-4 w-4 animate-spin" />
                        <span>Ürün Bilgileri Çekiliyor...</span>
                      </>
                    ) : (
                      <span>Bilgileri Çek ve Formu Doldur</span>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* ── ACCOUNTING MAPPING TAB ── */}
            {activeTab === 'accounting' && (
              <div className="space-y-6 max-w-2xl mx-auto py-4">
                <div className="rounded-kp-md border border-kp-border bg-kp-bg-primary/40 p-4 flex items-center justify-between">
                  <div className="space-y-1">
                    <h4 className="text-xs font-bold text-kp-text-primary uppercase tracking-wider">Aktif Eşleştirme Durumu</h4>
                    <p className="text-[11px] text-kp-text-tertiary">
                      {form.erpCode ? (
                        <>
                          Bu ürün şu anda Muhasebe/ERP kartı <span className="font-semibold text-kp-accent">{form.erpCode}</span> ile bağlıdır.
                        </>
                      ) : (
                        'Bu ürün henüz herhangi bir Muhasebe/ERP kartı ile eşleştirilmemiştir.'
                      )}
                    </p>
                  </div>
                  {form.erpCode && (
                    <button
                      type="button"
                      onClick={() => {
                        set('erpCode', '');
                        set('erpId', '');
                      }}
                      className="rounded-kp-md bg-kp-danger/10 hover:bg-kp-danger text-kp-danger hover:text-white px-3 py-1.5 text-xs font-semibold transition-all"
                    >
                      Eşleştirmeyi Kaldır
                    </button>
                  )}
                </div>

                <div className="space-y-4">
                  <div>
                    <label className={labelCls}>Muhasebe / ERP'de Ürün Ara</label>
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="Ürün adı, Stok Kodu veya Barkod ile arayın..."
                        value={erpSearchQuery}
                        onChange={(e) => setErpSearchQuery(e.target.value)}
                        className={inputCls}
                      />
                      {isSearchingErp && (
                        <div className="absolute right-3 top-2.5">
                          <ArrowPathIcon className="h-4 w-4 animate-spin text-kp-text-tertiary" />
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                    <p className="text-[10px] font-bold text-kp-text-tertiary uppercase tracking-widest">
                      Bulunan Muhasebe Kartları ({erpSearchResults.length})
                    </p>

                    {erpSearchResults.length === 0 ? (
                      <div className="text-center py-8 bg-kp-bg-primary/20 border border-dashed border-kp-border rounded-kp-md">
                        <p className="text-xs text-kp-text-tertiary">Arama kriterine uygun muhasebe kartı bulunamadı.</p>
                      </div>
                    ) : (
                      <div className="grid gap-2">
                        {erpSearchResults.map((item) => {
                          const isMatched = form.erpCode === item.code;
                          return (
                            <div
                              key={item.id}
                              className={`flex items-center justify-between p-3 border rounded-kp-md transition-all ${
                                isMatched
                                  ? 'border-kp-accent bg-kp-accent/5 ring-1 ring-kp-accent'
                                  : 'border-kp-border bg-kp-bg-primary hover:bg-kp-bg-hover'
                              }`}
                            >
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-semibold text-kp-text-primary">{item.name}</span>
                                  <span className="text-[10px] font-mono bg-kp-bg-secondary px-1.5 py-0.5 rounded text-kp-text-secondary">
                                    {item.code}
                                  </span>
                                </div>
                                <div className="flex items-center gap-4 mt-1 text-[10px] text-kp-text-tertiary">
                                  <span>Barkod: {item.barcode}</span>
                                  <span>Mevcut Stok: <strong className="text-kp-text-secondary">{item.stock} ad.</strong></span>
                                  <span>Muhasebe Fiyatı: <strong className="text-kp-text-secondary">{item.price.toLocaleString('tr-TR')} ₺</strong></span>
                                </div>
                              </div>

                              <div className="flex gap-2">
                                {!isMatched && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setForm((prev) => ({
                                        ...prev,
                                        name: item.name,
                                        sku: item.code,
                                        barcode: item.barcode,
                                        price: item.price.toString(),
                                        erpCode: item.code,
                                        erpId: item.id,
                                      }));
                                    }}
                                    className="rounded border border-kp-border bg-kp-bg-primary hover:bg-kp-bg-hover text-kp-text-secondary px-2.5 py-1 text-[11px] font-semibold transition-all"
                                    title="Tüm form alanlarını bu muhasebe kartı bilgileriyle doldurur."
                                  >
                                    Bilgileri Çek
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => {
                                    set('erpCode', item.code);
                                    set('erpId', item.id);
                                  }}
                                  className={`rounded px-3 py-1 text-[11px] font-semibold transition-all ${
                                    isMatched
                                      ? 'bg-kp-accent text-white'
                                      : 'bg-kp-accent/15 text-kp-accent hover:bg-kp-accent/25'
                                  }`}
                                >
                                  {isMatched ? 'Eşleştirildi' : 'Eşleştir'}
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ── BASIC TAB ── */}
            {activeTab === 'basic' && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Ürün Adı <span className="text-kp-danger">*</span></label>
                  <input type="text" required value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="örn. Koşu Ayakkabısı" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>SKU Kodu <span className="text-kp-danger">*</span></label>
                  <input type="text" required value={form.sku} onChange={(e) => set('sku', e.target.value)} placeholder="örn. SHOE-001" className={`${inputCls} font-mono`} />
                </div>
                <div className="col-span-2">
                  <label className={labelCls}>Açıklama</label>
                  <textarea rows={3} value={form.description} onChange={(e) => set('description', e.target.value)} placeholder="Ürün detayları, özellikler..." className={`${inputCls} resize-none`} />
                </div>
                <div>
                  <label className={labelCls}>Kategori</label>
                  <select value={form.categoryId} onChange={(e) => set('categoryId', e.target.value)} className={inputCls}>
                    <option value="">Kategori seçin...</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Durum</label>
                  <select value={form.status} onChange={(e) => set('status', e.target.value)} className={inputCls}>
                    <option value="active">Aktif</option>
                    <option value="draft">Taslak</option>
                    <option value="suspended">Askıda</option>
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Ürün Tipi</label>
                  <select value={form.type} onChange={(e) => set('type', e.target.value)} className={inputCls}>
                    <option value="SIMPLE">Basit Ürün (SIMPLE)</option>
                    <option value="BUNDLE">Ürün Paketi (BUNDLE)</option>
                    <option value="VARIANT_PARENT">Varyantlı Ana Ürün (VARIANT_PARENT)</option>
                    <option value="VARIANT_CHILD">Varyant Alt Ürünü (VARIANT_CHILD)</option>
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Barkod (EAN/UPC)</label>
                  <input type="text" value={form.barcode} onChange={(e) => set('barcode', e.target.value)} placeholder="8680000000000" className={`${inputCls} font-mono`} />
                </div>
                <div>
                  <label className={labelCls}>Para Birimi</label>
                  <select value={form.currency} onChange={(e) => set('currency', e.target.value)} className={inputCls}>
                    <option value="TRY">₺ TRY</option>
                    <option value="USD">$ USD</option>
                    <option value="EUR">€ EUR</option>
                  </select>
                </div>
                <div>
                  <label className={labelCls}>KDV Oranı (%)</label>
                  <select value={form.taxRate} onChange={(e) => set('taxRate', e.target.value)} className={inputCls}>
                    <option value="20">%20</option>
                    <option value="10">%10</option>
                    <option value="1">%1</option>
                    <option value="0">%0</option>
                  </select>
                </div>
              </div>
            )}

            {/* ── VARIANTS TAB ── */}
            {activeTab === 'variants' && (
              <div className="space-y-4 animate-fade-in">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-kp-text-primary uppercase tracking-wider">Ürün Varyasyonları (Beden & Renk)</h4>
                    <p className="text-[11px] text-kp-text-tertiary">Farklı beden, renk veya numara seçeneklerine sahip varyantlar ekleyin.</p>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddVariantRow}
                    className="rounded-kp-md bg-kp-accent hover:bg-kp-accent-hover text-white px-3 py-1.5 text-xs font-semibold transition-all shadow-sm"
                  >
                    + Varyant Ekle
                  </button>
                </div>

                {variantList.length === 0 ? (
                  <div className="text-center py-12 bg-kp-bg-primary/20 border border-dashed border-kp-border rounded-kp-md">
                    <p className="text-xs text-kp-text-tertiary">Henüz varyasyon eklenmedi. Üstteki butondan yeni bir beden/renk varyantı ekleyin.</p>
                  </div>
                ) : (
                  <div className="border border-kp-border rounded-kp-md overflow-hidden bg-kp-bg-primary/40">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-kp-bg-primary border-b border-kp-border text-kp-text-secondary font-semibold">
                          <th className="p-3">Beden (Size)</th>
                          <th className="p-3">Renk (Color)</th>
                          <th className="p-3">SKU Kodu</th>
                          <th className="p-3">Fiyat</th>
                          <th className="p-3">Stok</th>
                          <th className="p-3 text-right">İşlem</th>
                        </tr>
                      </thead>
                      <tbody>
                        {variantList.map((variant, idx) => (
                          <tr key={idx} className="border-b border-kp-border hover:bg-kp-bg-hover transition-colors">
                            <td className="p-2">
                              <input
                                type="text"
                                placeholder="örn. M, L"
                                value={variant.size}
                                onChange={(e) => {
                                  const updated = [...variantList];
                                  updated[idx].size = e.target.value;
                                  setVariantList(updated);
                                }}
                                className={inputCls}
                              />
                            </td>
                            <td className="p-2">
                              <input
                                type="text"
                                placeholder="örn. Siyah"
                                value={variant.color}
                                onChange={(e) => {
                                  const updated = [...variantList];
                                  updated[idx].color = e.target.value;
                                  setVariantList(updated);
                                }}
                                className={inputCls}
                              />
                            </td>
                            <td className="p-2">
                              <input
                                type="text"
                                placeholder="SKU"
                                value={variant.sku}
                                onChange={(e) => {
                                  const updated = [...variantList];
                                  updated[idx].sku = e.target.value;
                                  setVariantList(updated);
                                }}
                                className={`${inputCls} font-mono`}
                              />
                            </td>
                            <td className="p-2">
                              <input
                                type="number"
                                step="0.01"
                                placeholder="0.00"
                                value={variant.price}
                                onChange={(e) => {
                                  const updated = [...variantList];
                                  updated[idx].price = e.target.value;
                                  setVariantList(updated);
                                }}
                                className={inputCls}
                              />
                            </td>
                            <td className="p-2">
                              <input
                                type="number"
                                placeholder="0"
                                value={variant.stockQuantity}
                                onChange={(e) => {
                                  const updated = [...variantList];
                                  updated[idx].stockQuantity = e.target.value;
                                  setVariantList(updated);
                                }}
                                className={inputCls}
                              />
                            </td>
                            <td className="p-2 text-right">
                              <button
                                type="button"
                                onClick={() => setVariantList(variantList.filter((_, i) => i !== idx))}
                                className="text-kp-danger hover:underline text-xs px-2"
                              >
                                Sil
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* ── BUNDLE TAB ── */}
            {activeTab === 'bundle' && (
              <div className="space-y-4 animate-fade-in">
                <div>
                  <h4 className="text-xs font-bold text-kp-text-primary uppercase tracking-wider">Paket (Bundle) İçeriği</h4>
                  <p className="text-[11px] text-kp-text-tertiary">Bu paket satıldığında stoktan düşecek alt bileşen ürünleri ekleyin.</p>
                </div>

                <div className="bg-kp-bg-primary/20 border border-kp-border rounded-kp-md p-4 space-y-4">
                  <div>
                    <label className={labelCls}>Pakete Ürün Ekle</label>
                    <select
                      onChange={(e) => {
                        handleAddBundleItem(e.target.value);
                        e.target.value = '';
                      }}
                      className={inputCls}
                    >
                      <option value="">Katalogdan ürün seçin...</option>
                      {allProductsList
                        .filter((p) => p.id !== product?.id && p.type !== 'BUNDLE')
                        .map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} ({p.sku}) — {p.price.toLocaleString('tr-TR')} ₺
                          </option>
                        ))}
                    </select>
                  </div>

                  {bundleItemsList.length === 0 ? (
                    <div className="text-center py-8 text-xs text-kp-text-tertiary">
                      Pakette henüz hiçbir ürün yok. Yukarıdaki listeden ürün ekleyin.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {bundleItemsList.map((item, idx) => (
                        <div key={idx} className="flex items-center justify-between p-3 border border-kp-border rounded-kp-md bg-kp-bg-primary">
                          <div className="space-y-0.5">
                            <p className="text-xs font-semibold text-kp-text-primary">{item.name}</p>
                            <p className="text-[10px] text-kp-text-tertiary font-mono">SKU: {item.sku} | Fiyat: {item.price} ₺</p>
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="w-24">
                              <label className="text-[9px] font-medium text-kp-text-tertiary block mb-0.5">Adet</label>
                              <input
                                type="number"
                                min="1"
                                value={item.quantity}
                                onChange={(e) => {
                                  const updated = [...bundleItemsList];
                                  updated[idx].quantity = parseInt(e.target.value, 10) || 1;
                                  setBundleItemsList(updated);
                                }}
                                className={inputCls}
                              />
                            </div>
                            <div className="w-24">
                              <label className="text-[9px] font-medium text-kp-text-tertiary block mb-0.5">İndirim (%)</label>
                              <input
                                type="number"
                                min="0"
                                max="100"
                                value={item.discountRate}
                                onChange={(e) => {
                                  const updated = [...bundleItemsList];
                                  updated[idx].discountRate = e.target.value;
                                  setBundleItemsList(updated);
                                }}
                                className={inputCls}
                              />
                            </div>
                            <button
                              type="button"
                              onClick={() => setBundleItemsList(bundleItemsList.filter((_, i) => i !== idx))}
                              className="text-kp-danger hover:underline text-xs mt-3.5"
                            >
                              Kaldır
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── CROSS-SELL TAB ── */}
            {activeTab === 'cross_sell' && (
              <div className="space-y-4 animate-fade-in">
                <div>
                  <h4 className="text-xs font-bold text-kp-text-primary uppercase tracking-wider">Çapraz Satış & İlişkili Ürünler</h4>
                  <p className="text-[11px] text-kp-text-tertiary">Bu ürünle birlikte satın alınabilecek tamamlayıcı veya alternatif ürünleri belirleyin.</p>
                </div>

                <div className="bg-kp-bg-primary/20 border border-kp-border rounded-kp-md p-4 space-y-4">
                  <div>
                    <label className={labelCls}>İlişkili Ürün Ekle</label>
                    <select
                      onChange={(e) => {
                        handleAddCrossSellItem(e.target.value);
                        e.target.value = '';
                      }}
                      className={inputCls}
                    >
                      <option value="">Katalogdan ürün seçin...</option>
                      {allProductsList
                        .filter((p) => p.id !== product?.id)
                        .map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} ({p.sku}) — {p.price.toLocaleString('tr-TR')} ₺
                          </option>
                        ))}
                    </select>
                  </div>

                  {crossSellList.length === 0 ? (
                    <div className="text-center py-8 text-xs text-kp-text-tertiary">
                      Seçilmiş çapraz satış ürünü bulunmuyor. Yukarıdaki listeden ürün ekleyin.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {crossSellList.map((item, idx) => (
                        <div key={idx} className="flex items-center justify-between p-3 border border-kp-border rounded-kp-md bg-kp-bg-primary">
                          <div className="space-y-0.5">
                            <p className="text-xs font-semibold text-kp-text-primary">{item.name}</p>
                            <p className="text-[10px] text-kp-text-tertiary font-mono">SKU: {item.sku} | Fiyat: {item.price} ₺</p>
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="w-24">
                              <label className="text-[9px] font-medium text-kp-text-tertiary block mb-0.5">Görüntü Sırası</label>
                              <input
                                type="number"
                                value={item.displayOrder}
                                onChange={(e) => {
                                  const updated = [...crossSellList];
                                  updated[idx].displayOrder = parseInt(e.target.value, 10) || 0;
                                  setCrossSellList(updated);
                                }}
                                className={inputCls}
                              />
                            </div>
                            <button
                              type="button"
                              onClick={() => setCrossSellList(crossSellList.filter((_, i) => i !== idx))}
                              className="text-kp-danger hover:underline text-xs mt-3.5"
                            >
                              Kaldır
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── PRICING TAB ── */}
            {activeTab === 'pricing' && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>Satış Fiyatı <span className="text-kp-danger">*</span></label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-kp-text-tertiary font-semibold">
                        {form.currency === 'TRY' ? '₺' : form.currency === 'USD' ? '$' : '€'}
                      </span>
                      <input type="number" step="0.01" required value={form.price} onChange={(e) => set('price', e.target.value)} placeholder="0.00" className={`${inputCls} pl-7`} />
                    </div>
                  </div>
                  <div>
                    <label className={labelCls}>Taban Fiyat (MSRP) <span className="text-kp-danger">*</span></label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-kp-text-tertiary font-semibold">
                        {form.currency === 'TRY' ? '₺' : form.currency === 'USD' ? '$' : '€'}
                      </span>
                      <input type="number" step="0.01" required value={form.basePrice} onChange={(e) => set('basePrice', e.target.value)} placeholder="0.00" className={`${inputCls} pl-7`} />
                    </div>
                  </div>
                  <div>
                    <label className={labelCls}>Maliyet Fiyatı</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-kp-text-tertiary font-semibold">
                        {form.currency === 'TRY' ? '₺' : form.currency === 'USD' ? '$' : '€'}
                      </span>
                      <input type="number" step="0.01" value={form.costPrice} onChange={(e) => set('costPrice', e.target.value)} placeholder="0.00" className={`${inputCls} pl-7`} />
                    </div>
                  </div>
                  <div>
                    <label className={labelCls}>Başlangıç Stok</label>
                    <input type="number" min="0" value={form.stockQuantity} onChange={(e) => set('stockQuantity', e.target.value)} placeholder="0" className={inputCls} />
                  </div>
                </div>

                {/* Margin preview */}
                <div className="rounded-kp-md border border-kp-border bg-kp-bg-primary/40 p-4">
                  <p className="text-[10px] font-bold text-kp-text-tertiary uppercase tracking-widest mb-3">Kar Marjı Hesabı</p>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="text-center">
                      <p className="text-[10px] text-kp-text-tertiary">Satış</p>
                      <p className="font-bold text-kp-text-primary text-sm">
                        {form.price ? `${form.currency === 'TRY' ? '₺' : '$'}${parseFloat(form.price).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}` : '—'}
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="text-[10px] text-kp-text-tertiary">Maliyet</p>
                      <p className="font-bold text-kp-text-primary text-sm">
                        {form.costPrice ? `${form.currency === 'TRY' ? '₺' : '$'}${parseFloat(form.costPrice).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}` : '—'}
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="text-[10px] text-kp-text-tertiary">Marj</p>
                      <p className={`font-bold text-lg ${margin ? (parseFloat(margin) >= 30 ? 'text-emerald-400' : parseFloat(margin) >= 15 ? 'text-amber-400' : 'text-red-400') : 'text-kp-text-tertiary'}`}>
                        {margin ? `%${margin}` : '—'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ── DIMENSIONS TAB ── */}
            {activeTab === 'dimensions' && (
              <div className="space-y-4">
                <p className="text-xs text-kp-text-tertiary">
                  Kargo hesaplamaları için boyut ve ağırlık bilgilerini girin.
                </p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>Ağırlık (kg)</label>
                    <input type="number" step="0.001" value={form.weight} onChange={(e) => set('weight', e.target.value)} placeholder="örn. 1.25" className={inputCls} />
                  </div>
                  <div />
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className={labelCls}>Genişlik (cm)</label>
                    <input type="number" step="0.1" value={form.width} onChange={(e) => set('width', e.target.value)} placeholder="0.0" className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Yükseklik (cm)</label>
                    <input type="number" step="0.1" value={form.height} onChange={(e) => set('height', e.target.value)} placeholder="0.0" className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Derinlik (cm)</label>
                    <input type="number" step="0.1" value={form.depth} onChange={(e) => set('depth', e.target.value)} placeholder="0.0" className={inputCls} />
                  </div>
                </div>

                {/* Desi preview */}
                {form.width && form.height && form.depth && (
                  <div className="rounded-kp-md border border-kp-border bg-kp-bg-primary/40 p-4">
                    <p className="text-[10px] font-bold text-kp-text-tertiary uppercase tracking-widest mb-2">Kargo Desi Hesabı</p>
                    <p className="text-sm font-bold text-kp-text-primary">
                      {((parseFloat(form.width) * parseFloat(form.height) * parseFloat(form.depth)) / 3000).toFixed(2)} desi
                    </p>
                    <p className="text-[10px] text-kp-text-tertiary mt-0.5">(En × Boy × Yükseklik) / 3000</p>
                  </div>
                )}
              </div>
            )}

            {/* ── IMAGES TAB ── */}
            {activeTab === 'images' && (
              <div className="space-y-4">
                <p className="text-xs text-kp-text-tertiary">
                  Ürün görsellerini yükleyin veya harici bağlantı ekleyin. İlk görsel ana görsel olacaktır.
                </p>

                <div className="grid grid-cols-4 gap-4">
                  {images.map((img, idx) => (
                    <div
                      key={idx}
                      draggable
                      onDragStart={(e) => handleDragStart(e, idx)}
                      onDragOver={(e) => handleDragOver(e, idx)}
                      onDragEnd={handleDragEnd}
                      onDrop={(e) => handleDrop(e, idx)}
                      className={`relative aspect-square rounded-kp-md border bg-kp-bg-primary overflow-hidden flex flex-col items-center justify-center p-2 cursor-grab active:cursor-grabbing transition-all ${
                        idx === 0 ? 'border-kp-accent ring-2 ring-kp-accent/20' : 'border-kp-border'
                      } ${
                        draggedIdx === idx ? 'opacity-40 border-dashed border-kp-accent' : 'hover:border-kp-accent/40'
                      }`}
                    >
                      {/* Delete Slot Button - Always available */}
                      <button
                        type="button"
                        onClick={() => handleRemoveImage(idx)}
                        className="absolute top-1.5 right-1.5 z-10 p-1 rounded bg-black/10 hover:bg-kp-danger text-kp-text-tertiary hover:text-white transition-colors"
                        title="Görsel Slotunu Sil"
                      >
                        <XMarkIcon className="h-3.5 w-3.5" />
                      </button>

                      {idx === 0 && (
                        <span className="absolute top-1.5 left-1.5 z-10 px-2 py-0.5 rounded-kp-sm text-[9px] font-bold bg-kp-accent text-white uppercase tracking-wider shadow-sm flex items-center gap-1 select-none">
                          ★ Ana Görsel
                        </span>
                      )}

                      {img ? (
                        <>
                          <img src={img} alt={`Görsel ${idx + 1}`} className="h-full w-full object-cover rounded-kp-sm select-none pointer-events-none" />
                        </>
                      ) : (
                        <div className="flex flex-col items-center gap-1.5 text-center w-full select-none">
                          <PhotoIcon className="h-5 w-5 text-kp-text-tertiary" />
                          <label className="text-[10px] font-semibold text-kp-accent hover:text-kp-accent-hover cursor-pointer bg-kp-accent/15 px-2 py-0.5 rounded-kp-sm">
                            Seç
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={(e) => handleImageUploadAt(e, idx)}
                            />
                          </label>
                          <input
                            type="text"
                            placeholder="URL yapıştır..."
                            className="w-full bg-kp-bg-secondary border border-kp-border rounded px-1.5 py-0.5 text-[9px] text-center text-kp-text-primary focus:outline-none focus:border-kp-accent"
                            onBlur={(e) => handleImageURLAt(e.target.value, idx)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                handleImageURLAt(e.currentTarget.value, idx);
                              }
                            }}
                          />
                        </div>
                      )}
                    </div>
                  ))}

                  {/* Add button */}
                  <button
                    type="button"
                    onClick={handleAddImageSlot}
                    className="aspect-square rounded-kp-md border border-dashed border-kp-border bg-kp-bg-primary/20 hover:bg-kp-bg-primary/50 flex flex-col items-center justify-center gap-1 text-kp-text-tertiary hover:text-kp-text-primary transition-colors"
                  >
                    <span className="text-xl font-bold">+</span>
                    <span className="text-[10px] font-medium">Görsel Ekle</span>
                  </button>
                </div>
              </div>
            )}

            {/* ── INTEGRATIONS TAB ── */}
            {activeTab === 'integrations' && product && (
              <div className="card p-6 bg-kp-bg-primary/20 border border-kp-border rounded-kp-md animate-fade-in">
                <ProductMarketplaceSettings productId={product.id} />
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        {activeTab !== 'integrations' && (
          <div className="border-t border-kp-border bg-kp-bg-primary/30 flex-shrink-0">
            <div className="max-w-4xl mx-auto w-full flex items-center justify-end gap-3 px-8 py-4">
              <button type="button" onClick={onClose} className="rounded-kp-md border border-kp-border px-4 py-2 text-xs font-semibold text-kp-text-secondary hover:text-kp-text-primary transition-colors">
                İptal
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex items-center gap-2 rounded-kp-md bg-kp-accent hover:bg-kp-accent-hover text-white px-4 py-2 text-xs font-semibold shadow-sm transition-all disabled:opacity-50"
              >
                {isSubmitting && <ArrowPathIcon className="h-3.5 w-3.5 animate-spin" />}
                {isEdit ? 'Değişiklikleri Kaydet' : 'Ürün Oluştur'}
              </button>
            </div>
          </div>
        )}
      </form>
    </div>,
    document.body
  );
}
