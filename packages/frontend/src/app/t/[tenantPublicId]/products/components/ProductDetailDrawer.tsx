'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  XMarkIcon,
  ArrowPathIcon,
  PencilIcon,
  TrashIcon,
  PhotoIcon,
  LinkIcon,
  InformationCircleIcon,
} from '@heroicons/react/24/outline';
import { useTranslations } from 'next-intl';
import { Product, Category } from '../hooks/useProducts';
import { ProductStatusBadge, StockBadge, MarginBadge, getProductImage } from './ProductStatusBadge';
import ProductMarketplaceSettings from './ProductMarketplaceSettings';

interface ProductDetailDrawerProps {
  product: Product | null;
  categories: Category[];
  onClose: () => void;
  onEdit: (product: Product) => void;
  onDelete: (product: Product) => void;
  getIntegrationLogs: (productId: string) => Promise<any[]>;
  lowStockThreshold: number;
}

type DrawerTab = 'details' | 'integrations';

const currencySymbol = (c: string) => (c === 'TRY' ? '₺' : c === 'USD' ? '$' : '€');

export default function ProductDetailDrawer({
  product,
  categories,
  onClose,
  onEdit,
  onDelete,
  getIntegrationLogs,
  lowStockThreshold,
}: ProductDetailDrawerProps) {
  const t = useTranslations('products.detail');
  const tc = useTranslations('common');
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const [activeTab, setActiveTab] = useState<DrawerTab>('details');
  const [integrationLogs, setIntegrationLogs] = useState<any[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);

  useEffect(() => {
    if (!product) return;
    setActiveTab('details');
    setIntegrationLogs([]);
  }, [product?.id]);

  const handleTabChange = async (tab: DrawerTab) => {
    setActiveTab(tab);
    if (tab === 'integrations' && product && integrationLogs.length === 0) {
      setLogsLoading(true);
      const logs = await getIntegrationLogs(product.id);
      setIntegrationLogs(logs);
      setLogsLoading(false);
    }
  };

  if (!product) return null;

  const sym = currencySymbol(product.currency);
  const category = categories.find((c) => c.id === product.categoryId);
  const hasDimensions = product.width || product.height || product.depth || product.weight;
  const desi =
    product.width && product.height && product.depth
      ? ((product.width * product.height * product.depth) / 3000).toFixed(2)
      : null;

  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[60] bg-kp-bg-secondary flex flex-col h-screen w-screen overflow-hidden animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between px-8 py-5 border-b border-kp-border bg-kp-bg-primary/20 flex-shrink-0">
        <div className="flex items-center gap-3">
          {getProductImage(product.image) ? (
            <img
              src={getProductImage(product.image)}
              alt={product.name}
              className="h-12 w-12 rounded-kp-md border border-kp-border object-cover flex-shrink-0"
              onError={(e) => (e.currentTarget.style.display = 'none')}
            />
          ) : (
            <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-kp-md border border-kp-border bg-kp-bg-primary">
              <PhotoIcon className="h-6 w-6 text-kp-text-tertiary" />
            </div>
          )}
          <div>
            <h3 className="text-base font-bold text-kp-text-primary leading-snug">{product.name}</h3>
            <p className="text-xs text-kp-text-tertiary font-mono mt-0.5">{product.sku}</p>
          </div>
        </div>
        <button onClick={onClose} className="rounded-kp-md p-1.5 hover:bg-kp-bg-hover text-kp-text-tertiary hover:text-kp-text-primary transition-colors">
          <XMarkIcon className="h-5 w-5" />
        </button>
      </div>

      {/* Horizontal Tabs at the top */}
      <div className="flex border-b border-kp-border px-8 bg-kp-bg-primary/10 flex-shrink-0">
        {[
          { value: 'details' as DrawerTab, label: t('tabDetails'), Icon: InformationCircleIcon },
          { value: 'integrations' as DrawerTab, label: t('tabIntegrations'), Icon: LinkIcon },
        ].map(({ value, label, Icon }) => {
          const isActive = activeTab === value;
          return (
            <button
              key={value}
              type="button"
              onClick={() => handleTabChange(value)}
              className={`flex items-center gap-2 px-5 py-4 text-xs font-semibold border-b-2 transition-all ${
                isActive
                  ? 'border-kp-accent text-kp-accent'
                  : 'border-transparent text-kp-text-tertiary hover:text-kp-text-secondary'
              }`}
            >
              <Icon className={`h-4 w-4 ${isActive ? 'text-kp-accent' : 'text-kp-text-tertiary'}`} />
              <span>{label}</span>
              {value === 'integrations' && integrationLogs.length > 0 && (
                <span className="rounded-full bg-kp-bg-tertiary px-1.5 text-[9px] font-bold text-kp-text-tertiary">
                  {integrationLogs.length}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="flex-1 overflow-y-auto p-8">
        <div className="max-w-4xl mx-auto w-full space-y-6">
          {/* Price + Status Banner */}
          <div className="flex items-center justify-between p-4 bg-kp-accent/5 border border-kp-border rounded-kp-lg flex-shrink-0 mb-4">
            <div className="flex items-center gap-3">
              <ProductStatusBadge status={product.status} />
              <StockBadge quantity={product.stockQuantity} threshold={lowStockThreshold} />
              {product.costPrice && (
                <MarginBadge price={product.price} costPrice={product.costPrice} />
              )}
            </div>
            <div className="text-right">
              <p className="text-[10px] text-kp-text-tertiary">{t('salePrice')}</p>
              <p className="text-lg font-bold text-kp-text-primary">
                {sym}{parseFloat(product.price.toString()).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
              </p>
            </div>
          </div>

          {/* ── DETAILS TAB ── */}
          {activeTab === 'details' && (
            <>
              {/* Product info */}
              <div>
                <h4 className="text-[10px] font-bold text-kp-text-tertiary uppercase tracking-widest mb-3">{t('productInfo')}</h4>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <p className="text-kp-text-tertiary text-[10px] uppercase tracking-wider">{t('category')}</p>
                    <p className="font-medium text-kp-text-primary mt-0.5">{category?.name || '—'}</p>
                  </div>
                  <div>
                    <p className="text-kp-text-tertiary text-[10px] uppercase tracking-wider">{t('barcode')}</p>
                    <p className="font-mono text-kp-text-secondary mt-0.5">{product.barcode || '—'}</p>
                  </div>
                  <div>
                    <p className="text-kp-text-tertiary text-[10px] uppercase tracking-wider">{t('erpMapping')}</p>
                    <p className="font-mono mt-0.5 text-xs">
                      {product.erpCode ? (
                        <span className="inline-flex items-center gap-1.5 font-bold text-kp-accent">
                          <span className="inline-block h-1.5 w-1.5 rounded-full bg-kp-accent animate-pulse" />
                          🔗 {product.erpCode}
                        </span>
                      ) : (
                        <span className="text-kp-text-tertiary font-normal italic">{t('noMapping')}</span>
                      )}
                    </p>
                  </div>
                  {product.description && (
                    <div className="col-span-2">
                      <p className="text-kp-text-tertiary text-[10px] uppercase tracking-wider">{t('description')}</p>
                      <p className="text-kp-text-secondary mt-0.5 text-[11px] leading-relaxed">{product.description}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Inventory & Shipping */}
              <div className="border-t border-kp-border pt-4">
                <h4 className="text-[10px] font-bold text-kp-text-tertiary uppercase tracking-widest mb-3">{t('inventoryLogistics')}</h4>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <p className="text-kp-text-tertiary text-[10px] uppercase tracking-wider">{t('stockQuantity')}</p>
                    <p className="font-medium text-kp-text-primary mt-0.5">{t('units', { count: product.stockQuantity })}</p>
                  </div>
                  <div>
                    <p className="text-kp-text-tertiary text-[10px] uppercase tracking-wider">{t('costPrice')}</p>
                    <p className="font-medium text-kp-text-primary mt-0.5">
                      {product.costPrice
                        ? `${sym}${parseFloat(product.costPrice.toString()).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}`
                        : '—'}
                    </p>
                  </div>
                  <div>
                    <p className="text-kp-text-tertiary text-[10px] uppercase tracking-wider">{t('basePrice')}</p>
                    <p className="font-medium text-kp-text-primary mt-0.5">
                      {sym}{parseFloat(product.basePrice.toString()).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                  <div>
                    <p className="text-kp-text-tertiary text-[10px] uppercase tracking-wider">{t('currency')}</p>
                    <p className="font-medium text-kp-text-primary mt-0.5 font-mono">{product.currency}</p>
                  </div>
                </div>
              </div>

              {/* Warehouse Location & Addressing */}
              <div className="border-t border-kp-border pt-4">
                <h4 className="text-[10px] font-bold text-kp-text-tertiary uppercase tracking-widest mb-3">{t('warehouseInfo')}</h4>
                <div className="grid grid-cols-2 gap-3 text-xs bg-kp-bg-primary/30 p-3.5 rounded-kp-md border border-kp-border">
                  <div>
                    <p className="text-kp-text-tertiary text-[10px] uppercase tracking-wider">{t('locationCode')}</p>
                    <div className="mt-0.5">
                      {product.locationCode ? (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-kp-accent/10 text-kp-accent border border-kp-accent/20 font-mono font-bold text-xs">
                          🏷️ {product.locationCode}
                        </span>
                      ) : (
                        <span className="text-kp-text-tertiary font-normal italic">{t('notAssigned')}</span>
                      )}
                    </div>
                  </div>
                  <div>
                    <p className="text-kp-text-tertiary text-[10px] uppercase tracking-wider">{t('warehouseName')}</p>
                    <p className="font-medium text-kp-text-primary mt-0.5">{product.warehouseName || '—'}</p>
                  </div>
                  <div>
                    <p className="text-kp-text-tertiary text-[10px] uppercase tracking-wider">{t('warehouseZone')}</p>
                    <p className="font-medium text-kp-text-primary mt-0.5">{product.zoneName || '—'}</p>
                  </div>
                  <div>
                    <p className="text-kp-text-tertiary text-[10px] uppercase tracking-wider">{t('locationBarcode')}</p>
                    <p className="font-mono text-kp-text-secondary mt-0.5">{product.locationBarcode || '—'}</p>
                  </div>
                </div>
              </div>

              {/* Physical dimensions */}
              {(product.weight || product.width || product.height || product.depth) && (
                <div className="border-t border-kp-border pt-4">
                  <h4 className="text-[10px] font-bold text-kp-text-tertiary uppercase tracking-widest mb-3">{t('dimensionsWeight')}</h4>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <p className="text-kp-text-tertiary text-[10px] uppercase tracking-wider">{t('weight')}</p>
                      <p className="font-medium text-kp-text-primary mt-0.5">{product.weight ? `${product.weight} kg` : '—'}</p>
                    </div>
                    <div>
                      <p className="text-kp-text-tertiary text-[10px] uppercase tracking-wider">{t('dimensions')}</p>
                      <p className="font-medium text-kp-text-primary mt-0.5">
                        {product.width || '—'} × {product.height || '—'} × {product.depth || '—'} cm
                      </p>
                    </div>
                    {desi && (
                      <div className="col-span-2">
                        <p className="text-kp-text-tertiary text-[10px] uppercase tracking-wider">{t('desiValue')}</p>
                        <p className="font-medium text-kp-text-primary mt-0.5">{desi} desi</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Product Images Preview */}
              {product.image && (
                <div className="border-t border-kp-border pt-4">
                  <h4 className="text-[10px] font-bold text-kp-text-tertiary uppercase tracking-widest mb-3">{t('allImages')}</h4>
                  <div className="flex flex-wrap gap-2">
                    {(() => {
                      let list: string[] = [];
                      if (product.image.startsWith('[')) {
                        try {
                          list = JSON.parse(product.image);
                        } catch (_) {
                          list = [product.image];
                        }
                      } else {
                        list = [product.image];
                      }
                      return list.map((img, idx) => (
                        <div key={idx} className="h-16 w-16 rounded-kp-md border border-kp-border overflow-hidden bg-kp-bg-primary">
                          <img src={img} alt={`Görsel ${idx + 1}`} className="h-full w-full object-cover" />
                        </div>
                      ));
                    })()}
                  </div>
                </div>
              )}
            </>
          )}

          {/* ── INTEGRATIONS TAB ── */}
          {activeTab === 'integrations' && (
            <div className="space-y-8 divide-y divide-kp-border">
              <ProductMarketplaceSettings productId={product.id} />
              
              <div className="pt-6 space-y-4">
                <h4 className="text-xs font-bold text-kp-text-primary uppercase tracking-wider">{t('syncHistory')}</h4>
                {logsLoading ? (
                  <div className="flex h-32 items-center justify-center gap-2">
                    <ArrowPathIcon className="h-5 w-5 text-kp-accent animate-spin" />
                    <span className="text-xs text-kp-text-tertiary">{tc('loading')}</span>
                  </div>
                ) : integrationLogs.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center gap-2">
                    <LinkIcon className="h-8 w-8 text-kp-text-tertiary" />
                    <p className="text-sm font-medium text-kp-text-secondary">{t('noIntegrationLogs')}</p>
                    <p className="text-xs text-kp-text-tertiary">{t('noIntegrationLogsDesc')}</p>
                  </div>
                ) : (
                  <div className="border border-kp-border rounded-kp-md overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-kp-bg-primary/40 text-[10px] font-semibold uppercase text-kp-text-tertiary border-b border-kp-border">
                        <tr>
                          <th className="py-2 px-3">{t('logDate')}</th>
                          <th className="py-2 px-3">{t('logProvider')}</th>
                          <th className="py-2 px-3">{t('logOperation')}</th>
                          <th className="py-2 px-3">{t('logStatus')}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-kp-border text-kp-text-secondary">
                        {integrationLogs.map((log) => (
                          <tr key={log.id}>
                            <td className="py-2.5 px-3 text-[10px]">{new Date(log.createdAt).toLocaleString('tr-TR')}</td>
                            <td className="py-2.5 px-3 font-medium capitalize">{log.provider}</td>
                            <td className="py-2.5 px-3 text-[10px]">{log.operation}</td>
                            <td className="py-2.5 px-3">
                              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-bold ${
                                log.status === 'success' ? 'bg-emerald-500/10 text-emerald-400' :
                                log.status === 'failed' ? 'bg-red-500/10 text-red-400' :
                                'bg-blue-500/10 text-blue-400'
                              }`}>
                                {log.status?.toUpperCase()}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-kp-border bg-kp-bg-primary/30 flex-shrink-0">
        <div className="max-w-4xl mx-auto w-full flex items-center gap-3 px-8 py-4">
          <button
            onClick={() => onEdit(product)}
            className="flex flex-1 items-center justify-center gap-2 rounded-kp-md border border-kp-border px-4 py-2 text-xs font-semibold text-kp-text-secondary hover:text-kp-accent hover:border-kp-accent/30 bg-kp-bg-secondary transition-colors"
          >
            <PencilIcon className="h-3.5 w-3.5" />
            {tc('actions.edit')}
          </button>
          <button
            onClick={() => onDelete(product)}
            className="flex flex-1 items-center justify-center gap-2 rounded-kp-md border border-kp-border px-4 py-2 text-xs font-semibold text-kp-text-secondary hover:text-kp-danger hover:border-kp-danger/30 bg-kp-bg-secondary transition-colors"
          >
            <TrashIcon className="h-3.5 w-3.5" />
            {tc('actions.delete')}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
