'use client';

import { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  XMarkIcon,
  PlusIcon,
  TrashIcon,
  SparklesIcon,
  TagIcon,
  ExclamationTriangleIcon,
  ArrowPathIcon,
  PhotoIcon,
  InformationCircleIcon,
  BanknotesIcon,
  TruckIcon,
  LinkIcon,
} from '@heroicons/react/24/outline';
import { useTranslations } from 'next-intl';
import { Product, Category, ProductPayload } from '../hooks/useProducts';
import { useToast } from '@/components/ui/Toast';

interface BundleItemInput {
  productId: string;
  quantity: number;
  size?: string;
  color?: string;
  variantNote?: string;
}

interface CrossSellBundleModalProps {
  bundle?: any;
  products: Product[];
  categories: Category[];
  onClose: () => void;
  onSubmit: (bundlePayload: ProductPayload) => Promise<void>;
}

type BundleTab = 'bundle' | 'basic' | 'pricing' | 'images' | 'dimensions';

const TABS: { value: BundleTab; labelKey: string; icon: any }[] = [
  { value: 'bundle', labelKey: 'tabs.bundle', icon: SparklesIcon },
  { value: 'basic', labelKey: 'tabs.basic', icon: InformationCircleIcon },
  { value: 'pricing', labelKey: 'tabs.pricing', icon: BanknotesIcon },
  { value: 'images', labelKey: 'tabs.images', icon: PhotoIcon },
  { value: 'dimensions', labelKey: 'tabs.dimensions', icon: TruckIcon },
];

export default function CrossSellBundleModal({
  bundle,
  products,
  categories,
  onClose,
  onSubmit,
}: CrossSellBundleModalProps) {
  const t = useTranslations('products.bundleModal');
  const tc = useTranslations('common');
  const toast = useToast();
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const [activeTab, setActiveTab] = useState<BundleTab>('bundle');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Single products available to add
  const singleProducts = useMemo(() => products.filter((p) => !p.isBundle), [products]);

  // Form State
  const [name, setName] = useState(bundle?.name || '');
  const [sku, setSku] = useState(bundle?.sku || `BNDL-${Math.floor(1000 + Math.random() * 9000)}`);
  const [barcode, setBarcode] = useState(bundle?.barcode || '');
  const [description, setDescription] = useState(bundle?.description || '');
  const [categoryId, setCategoryId] = useState(bundle?.categoryId || categories[0]?.id || '');
  const [discountRate, setDiscountRate] = useState<number>(bundle?.discountRate || 15);
  const [status, setStatus] = useState<string>(bundle?.status || 'active');
  const [currency, setCurrency] = useState(bundle?.currency || 'TRY');
  const [taxRate, setTaxRate] = useState(bundle?.taxRate?.toString() || '20');

  // Images state
  const [images, setImages] = useState<string[]>(bundle?.image ? [bundle.image] : []);
  const [imageUrlInput, setImageUrlInput] = useState('');

  // Physical dimensions state
  const [weight, setWeight] = useState(bundle?.weight?.toString() || '');
  const [width, setWidth] = useState(bundle?.width?.toString() || '');
  const [height, setHeight] = useState(bundle?.height?.toString() || '');
  const [depth, setDepth] = useState(bundle?.depth?.toString() || '');

  // Bundle Component Items
  const [bundleItems, setBundleItems] = useState<BundleItemInput[]>(
    bundle?.items || (singleProducts.length > 0 ? [{ productId: singleProducts[0].id, quantity: 1 }] : [])
  );

  // Calculate regular total price of selected items
  const regularTotal = useMemo(() => {
    return bundleItems.reduce((total, item) => {
      const prod = singleProducts.find((p) => p.id === item.productId);
      return total + (prod ? prod.price * item.quantity : 0);
    }, 0);
  }, [bundleItems, singleProducts]);

  // Calculated discounted bundle price
  const bundlePrice = useMemo(() => {
    const discounted = regularTotal * (1 - discountRate / 100);
    return Math.max(0, Math.round(discounted * 100) / 100);
  }, [regularTotal, discountRate]);

  // Calculate available producible bundle stock based on lowest component stock
  const producibleStock = useMemo(() => {
    if (bundleItems.length === 0) return 0;
    let minStock = Infinity;
    bundleItems.forEach((item) => {
      const prod = singleProducts.find((p) => p.id === item.productId);
      if (prod) {
        const possible = Math.floor((prod.stockQuantity || 0) / item.quantity);
        if (possible < minStock) minStock = possible;
      }
    });
    return minStock === Infinity ? 0 : minStock;
  }, [bundleItems, singleProducts]);

  // Calculated Desi
  const desi = useMemo(() => {
    const w = parseFloat(width) || 0;
    const h = parseFloat(height) || 0;
    const d = parseFloat(depth) || 0;
    if (!w || !h || !d) return null;
    return ((w * h * d) / 3000).toFixed(2);
  }, [width, height, depth]);

  const handleAddItem = () => {
    const unusedProduct = singleProducts.find(
      (p) => !bundleItems.some((item) => item.productId === p.id)
    );
    if (unusedProduct) {
      setBundleItems((prev) => [...prev, { productId: unusedProduct.id, quantity: 1 }]);
    } else if (singleProducts.length > 0) {
      setBundleItems((prev) => [...prev, { productId: singleProducts[0].id, quantity: 1 }]);
    }
  };

  const handleRemoveItem = (index: number) => {
    setBundleItems((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleItemChange = (
    index: number,
    field: keyof BundleItemInput,
    value: any
  ) => {
    setBundleItems((prev) =>
      prev.map((item, idx) => {
        if (idx === index) {
          return {
            ...item,
            [field]: field === 'quantity' ? Math.max(1, parseInt(value) || 1) : value,
          };
        }
        return item;
      })
    );
  };

  const handleAddImageUrl = () => {
    if (!imageUrlInput.trim()) return;
    setImages((prev) => [...prev, imageUrlInput.trim()]);
    setImageUrlInput('');
  };

  const handleRemoveImage = (idx: number) => {
    setImages((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setActiveTab('basic');
      setError(t('errors.nameRequired'));
      return;
    }
    if (!sku.trim()) {
      setActiveTab('basic');
      setError(t('errors.skuRequired'));
      return;
    }
    if (bundleItems.length < 1) {
      setActiveTab('bundle');
      setError(t('errors.itemsRequired'));
      return;
    }

    setIsSubmitting(true);
    setError(null);

    const payload: ProductPayload = {
      name: name.trim(),
      sku: sku.trim(),
      barcode: barcode.trim() || undefined,
      categoryId: categoryId || undefined,
      description: description.trim() || t('defaultDescription', { rate: discountRate }),
      price: bundlePrice,
      basePrice: regularTotal > 0 ? regularTotal : bundlePrice,
      currency,
      stockQuantity: producibleStock,
      status,
      isBundle: true,
      taxRate: parseFloat(taxRate) || 20,
      image: images.length > 0 ? images[0] : undefined,
      weight: parseFloat(weight) || undefined,
      width: parseFloat(width) || undefined,
      height: parseFloat(height) || undefined,
      depth: parseFloat(depth) || undefined,
      bundleItems: bundleItems.map((item) => {
        const prod = singleProducts.find((p) => p.id === item.productId);
        return {
          productId: item.productId,
          childProductId: item.productId,
          productName: prod?.name || '',
          quantity: item.quantity,
          unitPrice: prod?.price || 0,
          size: item.size || undefined,
          color: item.color || undefined,
          variantNote: item.variantNote || undefined,
          variantAttributes: (item.size || item.color) ? {
            ...(item.size ? { Beden: item.size } : {}),
            ...(item.color ? { Renk: item.color } : {}),
          } : undefined,
        };
      }),
    };

    try {
      await onSubmit(payload);
      toast.success(t('saveSuccess'));
      onClose();
    } catch (err: any) {
      setError(err.message || t('saveFailed'));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[70] bg-kp-bg-secondary flex flex-col h-screen w-screen overflow-hidden animate-fade-in">
      {/* Header Bar */}
      <div className="flex items-center justify-between px-8 py-5 border-b border-kp-border bg-kp-bg-primary/20 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-kp-md bg-kp-accent/10 text-kp-accent">
            <SparklesIcon className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-kp-text-primary">
              {bundle ? t('editTitle') : t('createTitle')}
            </h3>
            <p className="text-xs text-kp-text-tertiary mt-0.5">
              {t('subtitle')}
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="rounded-kp-md p-1.5 hover:bg-kp-bg-hover text-kp-text-tertiary hover:text-kp-text-primary transition-colors cursor-pointer"
        >
          <XMarkIcon className="h-5 w-5" />
        </button>
      </div>

      {/* Tab Navigation */}
      <div className="flex border-b border-kp-border px-8 bg-kp-bg-primary/10 flex-shrink-0 overflow-x-auto">
        {TABS.map(({ value, labelKey, icon: Icon }) => {
          const isActive = activeTab === value;
          return (
            <button
              key={value}
              type="button"
              onClick={() => setActiveTab(value)}
              className={`flex items-center gap-2 px-5 py-4 text-xs font-semibold border-b-2 transition-all whitespace-nowrap cursor-pointer ${
                isActive
                  ? 'border-kp-accent text-kp-accent bg-kp-accent/5'
                  : 'border-transparent text-kp-text-tertiary hover:text-kp-text-secondary hover:bg-kp-bg-hover/50'
              }`}
            >
              <Icon className={`h-4 w-4 ${isActive ? 'text-kp-accent' : 'text-kp-text-tertiary'}`} />
              <span>{t(labelKey)}</span>
            </button>
          );
        })}
      </div>

      {/* Form Container */}
      <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden">
        {/* Scrollable Content Body */}
        <div className="flex-1 overflow-y-auto p-8 space-y-6 text-xs max-w-7xl mx-auto w-full">
          {error && (
            <div className="flex items-center gap-2 p-3.5 text-xs border rounded-kp-md bg-kp-danger/10 border-kp-danger/20 text-kp-danger">
              <ExclamationTriangleIcon className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* TAB 1: BUNDLE CONTENT */}
          {activeTab === 'bundle' && (
            <div className="space-y-5 animate-fade-in">
              <div className="flex items-center justify-between border-b border-kp-border pb-3">
                <div>
                  <h4 className="text-xs font-bold text-kp-text-primary flex items-center gap-1.5 uppercase tracking-wider">
                    <SparklesIcon className="h-4 w-4 text-kp-accent" />
                    {t('bundleTab.title')}
                  </h4>
                  <p className="text-[0.6875rem] text-kp-text-tertiary mt-0.5">
                    {t('bundleTab.desc')}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleAddItem}
                  className="flex items-center gap-1 text-xs font-semibold text-white bg-kp-accent hover:bg-kp-accent-hover px-3.5 py-2 rounded-kp-md shadow-xs transition-colors cursor-pointer"
                >
                  <PlusIcon className="h-4 w-4" />
                  {t('bundleTab.addComponent')}
                </button>
              </div>

              {/* Items List */}
              <div className="space-y-4">
                {bundleItems.map((item, index) => {
                  const selectedProd = singleProducts.find((p) => p.id === item.productId);
                  return (
                    <div key={index} className="bg-kp-bg-primary/50 border border-kp-border rounded-kp-lg p-4 space-y-3">
                      <div className="flex items-center justify-between border-b border-kp-border/50 pb-2">
                        <label className="text-xs font-bold text-kp-text-primary flex items-center gap-2">
                          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-kp-accent/10 text-kp-accent text-[0.6875rem]">
                            #{index + 1}
                          </span>
                          {t('bundleTab.componentNo', { no: index + 1 })}
                        </label>
                        {bundleItems.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(index)}
                            className="text-kp-text-tertiary hover:text-kp-danger transition-colors p-1 flex items-center gap-1 text-xs cursor-pointer"
                            title={tc('actions.delete')}
                          >
                            <TrashIcon className="h-4 w-4" />
                            <span>{tc('actions.delete')}</span>
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-12 gap-3 items-end">
                        {/* Bileşen Ürün Seçimi */}
                        <div className="col-span-12 lg:col-span-5">
                          <label className="block text-[0.6875rem] font-semibold text-kp-text-secondary mb-1">
                            Bileşen Ürün
                          </label>
                          <select
                            value={item.productId}
                            onChange={(e) => handleItemChange(index, 'productId', e.target.value)}
                            className="w-full bg-kp-bg-primary border border-kp-border rounded-kp-md px-3 py-2 text-xs text-kp-text-primary focus:outline-hidden focus:border-kp-accent cursor-pointer"
                          >
                            {singleProducts.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name} ({p.sku}) - ₺{p.price} [{t('bundleTab.stock')}: {p.stockQuantity}]
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Beden / Variant Seçimi */}
                        <div className="col-span-6 sm:col-span-3 lg:col-span-2">
                          <label className="block text-[0.6875rem] font-semibold text-kp-text-secondary mb-1">
                            Beden / Varyant
                          </label>
                          <select
                            value={item.size || ''}
                            onChange={(e) => handleItemChange(index, 'size', e.target.value)}
                            className="w-full bg-kp-bg-primary border border-kp-border rounded-kp-md px-2.5 py-2 text-xs text-kp-text-primary focus:outline-hidden focus:border-kp-accent cursor-pointer"
                          >
                            <option value="">Tüm Bedenler (Standart)</option>
                            <option value="XS">XS</option>
                            <option value="S">S</option>
                            <option value="M">M</option>
                            <option value="L">L</option>
                            <option value="XL">XL</option>
                            <option value="2XL">2XL</option>
                            <option value="3XL">3XL</option>
                            <option value="36">36</option>
                            <option value="38">38</option>
                            <option value="40">40</option>
                            <option value="42">42</option>
                            <option value="44">44</option>
                            <option value="46">46</option>
                          </select>
                        </div>

                        {/* Renk Seçimi */}
                        <div className="col-span-6 sm:col-span-3 lg:col-span-2">
                          <label className="block text-[0.6875rem] font-semibold text-kp-text-secondary mb-1">
                            Renk Seçeneği
                          </label>
                          <select
                            value={item.color || ''}
                            onChange={(e) => handleItemChange(index, 'color', e.target.value)}
                            className="w-full bg-kp-bg-primary border border-kp-border rounded-kp-md px-2.5 py-2 text-xs text-kp-text-primary focus:outline-hidden focus:border-kp-accent cursor-pointer"
                          >
                            <option value="">Tüm Renkler (Varsayılan)</option>
                            <option value="Siyah">Siyah</option>
                            <option value="Beyaz">Beyaz</option>
                            <option value="Lacivert">Lacivert</option>
                            <option value="Mavi">Mavi</option>
                            <option value="Kırmızı">Kırmızı</option>
                            <option value="Yeşil">Yeşil</option>
                            <option value="Gri">Gri</option>
                            <option value="Sarı">Sarı</option>
                            <option value="Pembe">Pembe</option>
                            <option value="Kahverengi">Kahverengi</option>
                          </select>
                        </div>

                        {/* Adet */}
                        <div className="col-span-6 lg:col-span-1">
                          <label className="block text-[0.6875rem] font-semibold text-kp-text-secondary mb-1">
                            {t('bundleTab.quantity')}
                          </label>
                          <input
                            type="number"
                            min={1}
                            value={item.quantity}
                            onChange={(e) => handleItemChange(index, 'quantity', e.target.value)}
                            className="w-full bg-kp-bg-primary border border-kp-border rounded-kp-md px-2.5 py-2 text-xs font-mono text-center text-kp-text-primary focus:outline-hidden focus:border-kp-accent"
                          />
                        </div>

                        {/* Bileşen Toplamı */}
                        <div className="col-span-6 lg:col-span-2 text-right">
                          <label className="block text-[0.6875rem] font-semibold text-kp-text-secondary mb-1">
                            {t('bundleTab.componentTotal')}
                          </label>
                          <span className="font-mono text-xs font-bold text-kp-text-primary block py-2">
                            ₺{((selectedProd?.price || 0) * item.quantity).toFixed(2)}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Price & Discount Calculation Box */}
              <div className="bg-kp-accent/5 border border-kp-accent/30 rounded-kp-lg p-5 grid grid-cols-3 gap-6">
                <div>
                  <span className="text-[0.6875rem] font-semibold text-kp-text-tertiary block mb-1">{t('bundleTab.componentsTotal')}</span>
                  <span className="text-base font-bold font-mono text-kp-text-primary line-through">
                    ₺{regularTotal.toFixed(2)}
                  </span>
                </div>

                <div>
                  <label className="text-[0.6875rem] font-bold text-kp-accent block mb-1">{t('bundleTab.discount')}</label>
                  <input
                    type="number"
                    min={0}
                    max={99}
                    value={discountRate}
                    onChange={(e) => setDiscountRate(Math.max(0, Math.min(99, parseInt(e.target.value) || 0)))}
                    className="w-full bg-kp-bg-primary border border-kp-accent/50 rounded-kp-md px-3 py-1.5 text-xs font-mono font-extrabold text-kp-accent focus:outline-hidden"
                  />
                </div>

                <div>
                  <span className="text-[0.6875rem] font-semibold text-emerald-600 block mb-1">{t('bundleTab.netPrice')}</span>
                  <span className="text-xl font-extrabold font-mono text-emerald-600">
                    ₺{bundlePrice.toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Producible Bundle Stock Card */}
              <div className="bg-kp-bg-primary/50 border border-kp-border rounded-kp-lg p-4 flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-kp-text-primary block">{t('bundleTab.producibleStock')}</span>
                  <span className="text-[0.6875rem] text-kp-text-tertiary">
                    {t('bundleTab.producibleStockDesc')}
                  </span>
                </div>
                <span className="text-base font-extrabold font-mono text-kp-accent bg-kp-accent/10 px-3.5 py-1.5 rounded-full border border-kp-accent/30">
                  {t('bundleTab.packageCount', { count: producibleStock })}
                </span>
              </div>
            </div>
          )}

          {/* TAB 2: BASIC INFO */}
          {activeTab === 'basic' && (
            <div className="space-y-4 animate-fade-in">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-[0.6875rem] font-semibold text-kp-text-secondary mb-1">
                    {t('basic.nameLabel')}
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={t('basic.namePlaceholder')}
                    className="w-full bg-kp-bg-primary border border-kp-border rounded-kp-md px-3 py-2 text-xs text-kp-text-primary focus:outline-hidden focus:border-kp-accent transition-colors"
                  />
                </div>

                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-[0.6875rem] font-semibold text-kp-text-secondary mb-1">
                    {t('basic.skuLabel')}
                  </label>
                  <input
                    type="text"
                    required
                    value={sku}
                    onChange={(e) => setSku(e.target.value)}
                    placeholder="BNDL-1001"
                    className="w-full bg-kp-bg-primary border border-kp-border rounded-kp-md px-3 py-2 text-xs text-kp-text-primary font-mono focus:outline-hidden focus:border-kp-accent transition-colors"
                  />
                </div>

                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-[0.6875rem] font-semibold text-kp-text-secondary mb-1">
                    {t('basic.barcodeLabel')}
                  </label>
                  <input
                    type="text"
                    value={barcode}
                    onChange={(e) => setBarcode(e.target.value)}
                    placeholder="8690000000000"
                    className="w-full bg-kp-bg-primary border border-kp-border rounded-kp-md px-3 py-2 text-xs text-kp-text-primary font-mono focus:outline-hidden focus:border-kp-accent transition-colors"
                  />
                </div>

                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-[0.6875rem] font-semibold text-kp-text-secondary mb-1">
                    {t('basic.categoryLabel')}
                  </label>
                  <select
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                    className="w-full bg-kp-bg-primary border border-kp-border rounded-kp-md px-3 py-2 text-xs text-kp-text-primary focus:outline-hidden focus:border-kp-accent transition-colors cursor-pointer"
                  >
                    <option value="">{t('basic.selectCategory')}</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-[0.6875rem] font-semibold text-kp-text-secondary mb-1">
                    {t('basic.statusLabel')}
                  </label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    className="w-full bg-kp-bg-primary border border-kp-border rounded-kp-md px-3 py-2 text-xs text-kp-text-primary focus:outline-hidden focus:border-kp-accent transition-colors cursor-pointer"
                  >
                    <option value="active">{t('basic.statusActive')}</option>
                    <option value="draft">{t('basic.statusDraft')}</option>
                    <option value="passive">{t('basic.statusPassive')}</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[0.6875rem] font-semibold text-kp-text-secondary mb-1">
                  {t('basic.descriptionLabel')}
                </label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={t('basic.descriptionPlaceholder')}
                  className="w-full bg-kp-bg-primary border border-kp-border rounded-kp-md px-3 py-2 text-xs text-kp-text-primary focus:outline-hidden focus:border-kp-accent transition-colors resize-none"
                />
              </div>
            </div>
          )}

          {/* TAB 3: PRICING */}
          {activeTab === 'pricing' && (
            <div className="space-y-4 animate-fade-in">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-[0.6875rem] font-semibold text-kp-text-secondary mb-1">
                    {t('pricing.regularPriceLabel')}
                  </label>
                  <input
                    type="text"
                    disabled
                    value={`₺${regularTotal.toFixed(2)}`}
                    className="w-full bg-kp-bg-primary/50 border border-kp-border rounded-kp-md px-3 py-2 text-xs font-mono font-bold text-kp-text-tertiary cursor-not-allowed"
                  />
                  <p className="text-[0.625rem] text-kp-text-tertiary mt-1">
                    {t('pricing.regularPriceDesc')}
                  </p>
                </div>

                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-[0.6875rem] font-semibold text-kp-accent mb-1">
                    {t('pricing.bundlePriceLabel')}
                  </label>
                  <input
                    type="text"
                    disabled
                    value={`₺${bundlePrice.toFixed(2)}`}
                    className="w-full bg-kp-accent/10 border border-kp-accent/40 rounded-kp-md px-3 py-2 text-xs font-mono font-extrabold text-kp-accent cursor-not-allowed"
                  />
                  <p className="text-[0.625rem] text-kp-text-tertiary mt-1">
                    {t('pricing.bundlePriceDesc', { rate: discountRate })}
                  </p>
                </div>

                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-[0.6875rem] font-semibold text-kp-text-secondary mb-1">
                    {t('pricing.currencyLabel')}
                  </label>
                  <select
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                    className="w-full bg-kp-bg-primary border border-kp-border rounded-kp-md px-3 py-2 text-xs text-kp-text-primary focus:outline-hidden focus:border-kp-accent"
                  >
                    <option value="TRY">TRY (₺)</option>
                    <option value="USD">USD ($)</option>
                    <option value="EUR">EUR (€)</option>
                  </select>
                </div>

                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-[0.6875rem] font-semibold text-kp-text-secondary mb-1">
                    {t('pricing.taxRateLabel')}
                  </label>
                  <select
                    value={taxRate}
                    onChange={(e) => setTaxRate(e.target.value)}
                    className="w-full bg-kp-bg-primary border border-kp-border rounded-kp-md px-3 py-2 text-xs text-kp-text-primary focus:outline-hidden focus:border-kp-accent"
                  >
                    <option value="20">%20</option>
                    <option value="10">%10</option>
                    <option value="1">%1</option>
                    <option value="0">%0</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: IMAGES */}
          {activeTab === 'images' && (
            <div className="space-y-4 animate-fade-in">
              <div className="flex gap-2">
                <input
                  type="url"
                  value={imageUrlInput}
                  onChange={(e) => setImageUrlInput(e.target.value)}
                  placeholder={t('images.urlPlaceholder')}
                  className="flex-1 bg-kp-bg-primary border border-kp-border rounded-kp-md px-3 py-2 text-xs text-kp-text-primary focus:outline-hidden focus:border-kp-accent"
                />
                <button
                  type="button"
                  onClick={handleAddImageUrl}
                  className="px-4 py-2 bg-kp-accent text-white rounded-kp-md text-xs font-semibold hover:bg-kp-accent-hover transition-colors"
                >
                  {t('images.addUrl')}
                </button>
              </div>

              {images.length === 0 ? (
                <div className="border-2 border-dashed border-kp-border rounded-kp-lg p-8 text-center text-kp-text-tertiary space-y-2">
                  <PhotoIcon className="h-10 w-10 mx-auto text-kp-text-tertiary/60" />
                  <p className="text-xs font-semibold">{t('images.emptyTitle')}</p>
                  <p className="text-[0.6875rem] text-kp-text-tertiary/80">
                    {t('images.emptyDesc')}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-4 gap-4">
                  {images.map((img, idx) => (
                    <div key={idx} className="relative group rounded-kp-md border border-kp-border overflow-hidden bg-kp-bg-primary aspect-square">
                      <img src={img} alt={`Bundle image ${idx + 1}`} className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => handleRemoveImage(idx)}
                        className="absolute top-2 right-2 p-1 bg-kp-danger/80 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                        title={tc('actions.delete')}
                      >
                        <XMarkIcon className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 5: DIMENSIONS */}
          {activeTab === 'dimensions' && (
            <div className="space-y-4 animate-fade-in">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div>
                  <label className="block text-[0.6875rem] font-semibold text-kp-text-secondary mb-1">{t('dimensions.weight')}</label>
                  <input
                    type="number"
                    step="0.01"
                    value={weight}
                    onChange={(e) => setWeight(e.target.value)}
                    placeholder="0.5"
                    className="w-full bg-kp-bg-primary border border-kp-border rounded-kp-md px-3 py-2 text-xs font-mono text-kp-text-primary focus:outline-hidden focus:border-kp-accent"
                  />
                </div>
                <div>
                  <label className="block text-[0.6875rem] font-semibold text-kp-text-secondary mb-1">{t('dimensions.width')}</label>
                  <input
                    type="number"
                    step="0.1"
                    value={width}
                    onChange={(e) => setWidth(e.target.value)}
                    placeholder="20"
                    className="w-full bg-kp-bg-primary border border-kp-border rounded-kp-md px-3 py-2 text-xs font-mono text-kp-text-primary focus:outline-hidden focus:border-kp-accent"
                  />
                </div>
                <div>
                  <label className="block text-[0.6875rem] font-semibold text-kp-text-secondary mb-1">{t('dimensions.height')}</label>
                  <input
                    type="number"
                    step="0.1"
                    value={height}
                    onChange={(e) => setHeight(e.target.value)}
                    placeholder="15"
                    className="w-full bg-kp-bg-primary border border-kp-border rounded-kp-md px-3 py-2 text-xs font-mono text-kp-text-primary focus:outline-hidden focus:border-kp-accent"
                  />
                </div>
                <div>
                  <label className="block text-[0.6875rem] font-semibold text-kp-text-secondary mb-1">{t('dimensions.depth')}</label>
                  <input
                    type="number"
                    step="0.1"
                    value={depth}
                    onChange={(e) => setDepth(e.target.value)}
                    placeholder="10"
                    className="w-full bg-kp-bg-primary border border-kp-border rounded-kp-md px-3 py-2 text-xs font-mono text-kp-text-primary focus:outline-hidden focus:border-kp-accent"
                  />
                </div>
              </div>

              {desi && (
                <div className="p-3 bg-kp-bg-primary/50 border border-kp-border rounded-kp-md text-xs">
                  <span className="font-semibold text-kp-text-secondary">{t('dimensions.desiLabel')} </span>
                  <span className="font-mono font-bold text-kp-accent">{desi} Desi</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Buttons */}
        <div className="flex items-center justify-end gap-3 px-8 py-4 border-t border-kp-border bg-kp-bg-primary/20 flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="rounded-kp-md border border-kp-border px-4 py-2 text-xs font-semibold text-kp-text-secondary hover:text-kp-text-primary transition-colors cursor-pointer"
          >
            {tc('actions.cancel')}
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex items-center gap-1.5 rounded-kp-md bg-kp-accent hover:bg-kp-accent-hover text-white px-5 py-2 text-xs font-semibold shadow-xs transition-all disabled:opacity-50 cursor-pointer"
          >
            {isSubmitting && <ArrowPathIcon className="h-3.5 w-3.5 animate-spin" />}
            {bundle ? t('updateBundle') : t('saveBundle')}
          </button>
        </div>
      </form>
    </div>,
    document.body
  );
}
