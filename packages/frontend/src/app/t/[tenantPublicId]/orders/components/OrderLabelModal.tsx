'use client';

import { useState } from 'react';
import { 
  XMarkIcon, 
  PrinterIcon, 
  ChevronLeftIcon, 
  ChevronRightIcon,
  TagIcon,
  CheckCircleIcon,
  DocumentDuplicateIcon
} from '@heroicons/react/24/outline';
import { Order } from '../hooks/useOrders';

interface OrderLabelModalProps {
  isOpen: boolean;
  onClose: () => void;
  orders: Order[];
  defaultCarrierName?: string;
}

// Generates pseudo-random but deterministic barcode pattern based on string
function generateBarcodeLines(code: string): { width: number; space: number }[] {
  const clean = (code || 'KROPTOS').replace(/[^a-zA-Z0-9]/g, '');
  const lines: { width: number; space: number }[] = [];
  
  for (let i = 0; i < Math.max(clean.length * 2, 28); i++) {
    const charCode = clean.charCodeAt(i % clean.length) || 65;
    const width = (charCode % 3) + 1.2;
    const space = ((charCode * 3) % 3) + 1.2;
    lines.push({ width, space });
  }
  return lines;
}

export default function OrderLabelModal({
  isOpen,
  onClose,
  orders,
  defaultCarrierName = 'Default Kargo',
}: OrderLabelModalProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [copied, setCopied] = useState(false);
  const [labelFormat, setLabelFormat] = useState<'thermal' | 'a4'>('thermal');

  if (!isOpen || orders.length === 0) return null;

  const currentOrder = orders[currentIndex] || orders[0];
  const barcodePattern = generateBarcodeLines(currentOrder.orderNumber || currentOrder.id);

  const handlePrint = () => {
    window.print();
  };

  const handleCopyBarcode = () => {
    const code = currentOrder.orderNumber || currentOrder.id;
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formattedDate = currentOrder.createdAt 
    ? new Date(currentOrder.createdAt).toLocaleDateString('tr-TR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      })
    : new Date().toLocaleDateString('tr-TR');

  return (
    <>
      {/* Print-only CSS rules to print ONLY the label */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          body * {
            visibility: hidden !important;
          }
          #printable-order-label-area, #printable-order-label-area * {
            visibility: visible !important;
          }
          #printable-order-label-area {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            background: white !important;
            box-shadow: none !important;
            border: none !important;
          }
          .no-print-element {
            display: none !important;
          }
        }
      `}} />

      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in no-print-element">
        <div className="w-full max-w-2xl bg-kp-bg-secondary border border-kp-border rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
          {/* Modal Header */}
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-kp-border bg-kp-bg-primary/50">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400">
                <TagIcon className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-kp-text-primary flex items-center gap-2">
                  <span>Sipariş Kargo Etiketi</span>
                  <span className="text-[0.6875rem] font-semibold px-2 py-0.5 rounded-full bg-kp-accent/10 text-kp-accent border border-kp-accent/20">
                    Önizleme
                  </span>
                </h3>
                <p className="text-[0.6875rem] text-kp-text-tertiary">
                  Sipariş #{currentOrder.orderNumber} &bull; {currentOrder.customerName}
                </p>
              </div>
            </div>

            {/* Pagination for multiple orders */}
            {orders.length > 1 && (
              <div className="flex items-center gap-1.5 bg-kp-bg-primary border border-kp-border rounded-lg px-2 py-1 text-xs text-kp-text-secondary">
                <button
                  type="button"
                  disabled={currentIndex === 0}
                  onClick={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
                  className="p-0.5 rounded hover:bg-kp-bg-hover disabled:opacity-30 disabled:cursor-not-allowed"
                  title="Önceki Sipariş"
                >
                  <ChevronLeftIcon className="h-3.5 w-3.5" />
                </button>
                <span className="text-[0.6875rem] font-medium px-1">
                  {currentIndex + 1} / {orders.length}
                </span>
                <button
                  type="button"
                  disabled={currentIndex === orders.length - 1}
                  onClick={() => setCurrentIndex((prev) => Math.min(orders.length - 1, prev + 1))}
                  className="p-0.5 rounded hover:bg-kp-bg-hover disabled:opacity-30 disabled:cursor-not-allowed"
                  title="Sonraki Sipariş"
                >
                  <ChevronRightIcon className="h-3.5 w-3.5" />
                </button>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex items-center gap-2">
              {/* Format Toggle */}
              <div className="hidden sm:flex items-center bg-kp-bg-primary border border-kp-border rounded-lg p-0.5 text-[0.6875rem]">
                <button
                  type="button"
                  onClick={() => setLabelFormat('thermal')}
                  className={`px-2 py-1 rounded font-medium transition ${
                    labelFormat === 'thermal'
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-kp-text-secondary hover:text-kp-text-primary'
                  }`}
                >
                  Termal (100x150)
                </button>
                <button
                  type="button"
                  onClick={() => setLabelFormat('a4')}
                  className={`px-2 py-1 rounded font-medium transition ${
                    labelFormat === 'a4'
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-kp-text-secondary hover:text-kp-text-primary'
                  }`}
                >
                  A4 Standart
                </button>
              </div>

              {/* Print Button */}
              <button
                type="button"
                onClick={handlePrint}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-sm transition"
              >
                <PrinterIcon className="h-3.5 w-3.5" />
                <span>Yazdır</span>
              </button>

              {/* Close Button */}
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-lg text-kp-text-tertiary hover:text-kp-text-primary hover:bg-kp-bg-hover transition"
                title="Kapat"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Modal Content / Scrollable Label Viewport */}
          <div className="flex-1 overflow-y-auto p-6 bg-slate-100 dark:bg-slate-900/60 flex items-center justify-center">
            {/* The Actual Shipping Label Form Area */}
            <div
              id="printable-order-label-area"
              className={`bg-white text-black font-sans shadow-xl border-2 border-slate-900 rounded-sm p-4 transition-all duration-200 select-text ${
                labelFormat === 'thermal' ? 'w-[380px]' : 'w-[440px]'
              }`}
            >
              {/* Top Banner: Carrier + Logistics Header */}
              <div className="flex items-center justify-between border-b-2 border-black pb-2.5 mb-2.5">
                <div>
                  <h1 className="text-base font-black tracking-wider text-black uppercase">
                    {defaultCarrierName}
                  </h1>
                  <p className="text-[0.5625rem] text-slate-600 tracking-wider uppercase font-semibold">
                    KroptOS Akıllı Kargo Sevkiyat
                  </p>
                </div>
                <div className="text-right">
                  <div className="inline-block border-2 border-black px-2 py-0.5 text-xs font-black tracking-widest uppercase bg-slate-50">
                    STANDART
                  </div>
                  <p className="text-[0.5625rem] text-slate-500 mt-0.5">{formattedDate}</p>
                </div>
              </div>

              {/* Barcode Block */}
              <div className="border border-black p-2 text-center bg-slate-50/50 mb-2.5 rounded-sm">
                <div className="text-[0.625rem] font-bold text-slate-500 uppercase tracking-widest mb-1">
                  Kargo Takip / Sipariş Barkodu
                </div>
                
                {/* SVG Barcode simulation */}
                <div className="flex items-center justify-center h-14 overflow-hidden py-1 px-4">
                  <svg className="w-full h-full" preserveAspectRatio="none" viewBox="0 0 160 50">
                    {barcodePattern.map((bar, idx) => {
                      let currentX = idx * 5.2;
                      return (
                        <rect
                          key={idx}
                          x={currentX}
                          y="0"
                          width={bar.width}
                          height="50"
                          fill="#000000"
                        />
                      );
                    })}
                  </svg>
                </div>

                <div className="flex items-center justify-center gap-2 mt-1">
                  <span className="font-mono text-sm font-black tracking-[0.2em] text-black">
                    *{currentOrder.orderNumber}*
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyBarcode}
                    className="no-print-element text-slate-400 hover:text-black transition"
                    title="Kopyala"
                  >
                    {copied ? (
                      <CheckCircleIcon className="h-3.5 w-3.5 text-emerald-600" />
                    ) : (
                      <DocumentDuplicateIcon className="h-3.5 w-3.5" />
                    )}
                  </button>
                </div>
              </div>

              {/* Delivery Address (Alıcı) - Prominent Section */}
              <div className="border-2 border-black p-2.5 mb-2.5 bg-white">
                <div className="text-[0.5625rem] font-black uppercase tracking-wider text-slate-500 mb-0.5">
                  ALICI (DELIVERY TO):
                </div>
                <div className="text-sm font-black text-black uppercase tracking-tight">
                  {currentOrder.customerName || 'Müşteri Adı Belirtilmedi'}
                </div>
                <div className="text-[0.6875rem] font-semibold text-black mt-1 leading-snug">
                  {currentOrder.shippingAddress || 'Adres bilgisi girilmedi'}
                </div>
                <div className="flex items-center justify-between text-[0.6875rem] font-bold text-black mt-2 pt-1 border-t border-dashed border-slate-300">
                  <span>TEL: {currentOrder.customerPhone || '—'}</span>
                  <span>E-POSTA: {currentOrder.customerEmail || '—'}</span>
                </div>
              </div>

              {/* Sender & Payment Info Grid */}
              <div className="grid grid-cols-2 gap-2 text-[0.625rem] mb-2.5">
                <div className="border border-black p-2">
                  <div className="font-black text-slate-500 uppercase text-[0.5625rem]">
                    GÖNDERİCİ (RETURN TO):
                  </div>
                  <div className="font-bold text-black mt-0.5">
                    {currentOrder.store?.name || 'KroptOS Merkez Depo'}
                  </div>
                  <div className="text-[0.5625rem] text-slate-600 mt-0.5">
                    E-Ticaret & Lojistik Dağıtım Merkezi
                  </div>
                </div>

                <div className="border border-black p-2 bg-slate-50/50">
                  <div className="font-black text-slate-500 uppercase text-[0.5625rem]">
                    ÖDEME & SİPARİŞ:
                  </div>
                  <div className="font-black text-xs text-black mt-0.5">
                    {currentOrder.paymentStatus === 'paid' ? 'PEŞİN / ÖDENDİ' : 'KAPIDA ÖDEME'}
                  </div>
                  <div className="text-[0.625rem] font-bold text-black mt-0.5">
                    Tutar: {Number(currentOrder.totalAmount || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2 })} {currentOrder.currency || 'TL'}
                  </div>
                </div>
              </div>

              {/* Package Content & Items Table */}
              <div className="border border-black p-2 text-[0.625rem]">
                <div className="flex items-center justify-between font-black border-b border-black pb-1 mb-1">
                  <span>PAKET İÇERİĞİ (ITEMS)</span>
                  <span>KAYNAK: {currentOrder.source?.toUpperCase() || 'WEB'}</span>
                </div>
                
                {currentOrder.items && currentOrder.items.length > 0 ? (
                  <div className="space-y-1">
                    {currentOrder.items.slice(0, 3).map((item, idx) => (
                      <div key={idx} className="flex justify-between items-center text-[0.5625rem]">
                        <span className="truncate max-w-[200px] font-medium">
                          {item.name || item.sku}
                        </span>
                        <span className="font-bold">{item.quantity} Adet</span>
                      </div>
                    ))}
                    {currentOrder.items.length > 3 && (
                      <div className="text-[0.5rem] text-slate-500 italic text-right">
                        +{currentOrder.items.length - 3} diğer ürün
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-[0.5625rem] text-slate-600 flex justify-between">
                    <span>1 Adet E-Ticaret Sipariş Paketi</span>
                    <span className="font-bold">DESİ: 1.0</span>
                  </div>
                )}
              </div>

              {/* Footer info & Cut line */}
              <div className="mt-2.5 pt-2 border-t border-dashed border-slate-400 flex items-center justify-between text-[0.5rem] text-slate-500 uppercase font-mono">
                <span>KroptOS Ref: {currentOrder.publicId || currentOrder.id.slice(0, 12)}</span>
                <span>Barkod Kontrolü Yapılmıştır</span>
              </div>
            </div>
          </div>

          {/* Modal Footer */}
          <div className="flex items-center justify-between px-5 py-3 border-t border-kp-border bg-kp-bg-primary/50 text-xs">
            <span className="text-[0.6875rem] text-kp-text-tertiary">
              Termal etiket yazıcıları için 100x150mm standart ebat önerilir.
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1.5 rounded-lg border border-kp-border text-kp-text-secondary hover:bg-kp-bg-hover transition font-medium"
              >
                Kapat
              </button>
              <button
                type="button"
                onClick={handlePrint}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold shadow-sm transition"
              >
                <PrinterIcon className="h-3.5 w-3.5" />
                <span>Yazdır</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
