'use client';

import { useState } from 'react';
import { 
  MagnifyingGlassIcon, 
  FunnelIcon, 
  ChevronLeftIcon, 
  ChevronRightIcon,
  ChevronDownIcon,
  StarIcon,
  FlagIcon,
  EnvelopeIcon,
  DocumentIcon,
  PrinterIcon,
  TruckIcon,
  Bars3Icon,
  ArrowsUpDownIcon,
  CheckIcon
} from '@heroicons/react/24/outline';
import { useTranslations } from 'next-intl';
import { Order, OrderFilters } from '../hooks/useOrders';
import { OrderStatusBadge, PaymentStatusBadge, FulfillmentStatusBadge, SourceBadge, OrderModeBadge } from './OrderStatusBadge';
import { pageWindow } from '@/lib/pagination';

interface OrdersTableProps {
  orders: Order[];
  isLoading: boolean;
  filters: OrderFilters;
  totalFiltered: number;
  currentPage: number;
  totalPages: number;
  pageSize: number;
  onFilterChange: (filters: OrderFilters) => void;
  onPageChange: (page: number) => void;
  onRowClick: (order: Order) => void;
  onCreateOrder?: () => void;
}

export default function OrdersTable({
  orders,
  isLoading,
  filters,
  totalFiltered,
  currentPage,
  totalPages,
  pageSize,
  onFilterChange,
  onPageChange,
  onRowClick,
  onCreateOrder,
}: OrdersTableProps) {
  const t = useTranslations('orders.table');
  const totalOnPage = orders.length;
  const startIdx = (currentPage - 1) * pageSize + 1;
  const endIdx = Math.min(startIdx + totalOnPage - 1, totalFiltered);

  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const toggleSelectAll = () => {
    if (selectedOrderIds.length === orders.length) {
      setSelectedOrderIds([]);
    } else {
      setSelectedOrderIds(orders.map((o) => o.id));
    }
  };

  const toggleSelectOrder = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (selectedOrderIds.includes(id)) {
      setSelectedOrderIds(selectedOrderIds.filter((item) => item !== id));
    } else {
      setSelectedOrderIds([...selectedOrderIds, id]);
    }
  };

  const showToast = (message: string) => {
    setToastMessage(message);
    setTimeout(() => {
      setToastMessage(null);
    }, 3000);
  };

  const handleAction = (actionName: string, appliesToAll = false) => {
    if (selectedOrderIds.length === 0 && !appliesToAll) {
      showToast(t('toolbar.selectFirst'));
      setActiveDropdown(null);
      return;
    }

    const count = appliesToAll ? totalFiltered : selectedOrderIds.length;
    showToast(t('toolbar.actionStarted', { count, action: actionName }));
    setActiveDropdown(null);
  };

  return (
    <div className="relative w-full">
      {/* Dropdown Backdrop to close on click outside */}
      {activeDropdown && (
        <div className="fixed inset-0 z-40 bg-transparent" onClick={() => setActiveDropdown(null)} />
      )}

      {/* Replicated Screenshot Action Toolbar */}
      <div className="flex flex-wrap items-center gap-1.5 px-4 py-2 bg-kp-bg-primary/20 border-b border-kp-border z-40 relative">
        {/* Checkbox Options */}
        <div className="relative">
            <button
              onClick={() => setActiveDropdown(activeDropdown === 'select' ? null : 'select')}
              className="flex items-center gap-1 px-2 py-1.5 rounded border border-kp-border bg-kp-bg-primary hover:bg-kp-bg-hover text-kp-text-secondary hover:text-kp-text-primary transition-all text-xs"
            >
              <input
                type="checkbox"
                checked={orders.length > 0 && selectedOrderIds.length === orders.length}
                ref={(el) => {
                  if (el) {
                    el.indeterminate = selectedOrderIds.length > 0 && selectedOrderIds.length < orders.length;
                  }
                }}
                onChange={toggleSelectAll}
                onClick={(e) => e.stopPropagation()}
                className="rounded border-kp-border text-kp-accent focus:ring-0 cursor-pointer h-3.5 w-3.5 bg-kp-bg-primary"
              />
              <ChevronDownIcon className="h-3 w-3" />
            </button>
            {activeDropdown === 'select' && (
              <div className="absolute left-0 mt-1 w-40 rounded border border-kp-border bg-kp-bg-primary shadow-lg z-50 py-1 text-[0.6875rem]">
                <button
                  onClick={() => { setSelectedOrderIds(orders.map(o => o.id)); setActiveDropdown(null); }}
                  className="w-full text-left px-3 py-1.5 hover:bg-kp-bg-hover text-kp-text-secondary hover:text-kp-text-primary"
                >
                  {t('toolbar.selectAll')}
                </button>
                <button
                  onClick={() => { setSelectedOrderIds([]); setActiveDropdown(null); }}
                  className="w-full text-left px-3 py-1.5 hover:bg-kp-bg-hover text-kp-text-secondary hover:text-kp-text-primary"
                >
                  {t('toolbar.clearSelection')}
                </button>
              </div>
            )}
          </div>

          {/* Star Options */}
          <div className="relative">
            <button
              onClick={() => setActiveDropdown(activeDropdown === 'star' ? null : 'star')}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded border border-kp-border bg-kp-bg-primary hover:bg-kp-bg-hover text-kp-text-secondary hover:text-kp-text-primary transition-all text-xs"
              title={t('toolbar.starTitle')}
            >
              <StarIcon className="h-3.5 w-3.5 text-kp-text-secondary" />
              <ChevronDownIcon className="h-3 w-3" />
            </button>
            {activeDropdown === 'star' && (
              <div className="absolute left-0 mt-1 w-40 rounded border border-kp-border bg-kp-bg-primary shadow-lg z-50 py-1 text-[0.6875rem]">
                <button
                  onClick={() => handleAction(t('toolbar.addStar'))}
                  className="w-full text-left px-3 py-1.5 hover:bg-kp-bg-hover text-kp-text-secondary hover:text-kp-text-primary"
                >
                  {t('toolbar.addStar')}
                </button>
                <button
                  onClick={() => handleAction(t('toolbar.removeStar'))}
                  className="w-full text-left px-3 py-1.5 hover:bg-kp-bg-hover text-kp-text-secondary hover:text-kp-text-primary"
                >
                  {t('toolbar.removeStar')}
                </button>
              </div>
            )}
          </div>

          {/* Flag Options */}
          <div className="relative">
            <button
              onClick={() => setActiveDropdown(activeDropdown === 'flag' ? null : 'flag')}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded border border-kp-border bg-kp-bg-primary hover:bg-kp-bg-hover text-kp-text-secondary hover:text-kp-text-primary transition-all text-xs"
              title={t('toolbar.flagTitle')}
            >
              <FlagIcon className="h-3.5 w-3.5 text-kp-text-secondary" />
              <ChevronDownIcon className="h-3 w-3" />
            </button>
            {activeDropdown === 'flag' && (
              <div className="absolute left-0 mt-1 w-44 rounded border border-kp-border bg-kp-bg-primary shadow-lg z-50 py-1 text-[0.6875rem]">
                <button
                  onClick={() => handleAction(t('toolbar.redFlag'))}
                  className="w-full text-left px-3 py-1.5 hover:bg-kp-bg-hover text-kp-text-secondary hover:text-kp-text-primary flex items-center gap-2"
                >
                  <span className="h-2 w-2 rounded-full bg-red-500"></span> {t('toolbar.redFlag')}
                </button>
                <button
                  onClick={() => handleAction(t('toolbar.blueFlag'))}
                  className="w-full text-left px-3 py-1.5 hover:bg-kp-bg-hover text-kp-text-secondary hover:text-kp-text-primary flex items-center gap-2"
                >
                  <span className="h-2 w-2 rounded-full bg-blue-500"></span> {t('toolbar.blueFlag')}
                </button>
                <button
                  onClick={() => handleAction(t('toolbar.greenFlag'))}
                  className="w-full text-left px-3 py-1.5 hover:bg-kp-bg-hover text-kp-text-secondary hover:text-kp-text-primary flex items-center gap-2"
                >
                  <span className="h-2 w-2 rounded-full bg-green-500"></span> {t('toolbar.greenFlag')}
                </button>
                <hr className="border-kp-border my-1" />
                <button
                  onClick={() => handleAction(t('toolbar.removeFlag'))}
                  className="w-full text-left px-3 py-1.5 hover:bg-kp-bg-hover text-kp-text-secondary hover:text-kp-text-primary"
                >
                  {t('toolbar.removeFlag')}
                </button>
              </div>
            )}
          </div>

          {/* Envelope/Message */}
          <div className="relative">
            <button
              onClick={() => setActiveDropdown(activeDropdown === 'envelope' ? null : 'envelope')}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded border border-kp-border bg-kp-bg-primary hover:bg-kp-bg-hover text-kp-text-secondary hover:text-kp-text-primary transition-all text-xs"
              title={t('toolbar.messageTitle')}
            >
              <EnvelopeIcon className="h-3.5 w-3.5 text-kp-text-secondary" />
              <ChevronDownIcon className="h-3 w-3" />
            </button>
            {activeDropdown === 'envelope' && (
              <div className="absolute left-0 mt-1 w-48 rounded border border-kp-border bg-kp-bg-primary shadow-lg z-50 py-1 text-[0.6875rem]">
                <button
                  onClick={() => handleAction(t('toolbar.sendEmail'))}
                  className="w-full text-left px-3 py-1.5 hover:bg-kp-bg-hover text-kp-text-secondary hover:text-kp-text-primary"
                >
                  {t('toolbar.sendEmail')}
                </button>
                <button
                  onClick={() => handleAction(t('toolbar.sendSms'))}
                  className="w-full text-left px-3 py-1.5 hover:bg-kp-bg-hover text-kp-text-secondary hover:text-kp-text-primary"
                >
                  {t('toolbar.sendSms')}
                </button>
                <button
                  onClick={() => handleAction(t('toolbar.sendWhatsapp'))}
                  className="w-full text-left px-3 py-1.5 hover:bg-kp-bg-hover text-kp-text-secondary hover:text-kp-text-primary"
                >
                  {t('toolbar.sendWhatsapp')}
                </button>
              </div>
            )}
          </div>

          {/* Document/Export */}
          <div className="relative">
            <button
              onClick={() => setActiveDropdown(activeDropdown === 'document' ? null : 'document')}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded border border-kp-border bg-kp-bg-primary hover:bg-kp-bg-hover text-kp-text-secondary hover:text-kp-text-primary transition-all text-xs"
              title={t('toolbar.documentTitle')}
            >
              <DocumentIcon className="h-3.5 w-3.5 text-kp-text-secondary" />
              <ChevronDownIcon className="h-3 w-3" />
            </button>
            {activeDropdown === 'document' && (
              <div className="absolute left-0 mt-1 w-52 rounded border border-kp-border bg-kp-bg-primary shadow-lg z-50 py-1 text-[0.6875rem]">
                <button
                  onClick={() => handleAction(t('toolbar.bulkInvoicePdf'))}
                  className="w-full text-left px-3 py-1.5 hover:bg-kp-bg-hover text-kp-text-secondary hover:text-kp-text-primary"
                >
                  {t('toolbar.bulkInvoicePdf')}
                </button>
                <button
                  onClick={() => handleAction(t('toolbar.exportSelected'))}
                  className="w-full text-left px-3 py-1.5 hover:bg-kp-bg-hover text-kp-accent font-semibold"
                >
                  {t('toolbar.exportSelected')}
                </button>
                <button
                  onClick={() => handleAction(t('toolbar.exportAll'), true)}
                  className="w-full text-left px-3 py-1.5 hover:bg-kp-bg-hover text-kp-text-secondary hover:text-kp-text-primary"
                >
                  {t('toolbar.exportAll')}
                </button>
              </div>
            )}
          </div>

          {/* Printer */}
          <div className="relative">
            <button
              onClick={() => setActiveDropdown(activeDropdown === 'printer' ? null : 'printer')}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded border border-kp-border bg-kp-bg-primary hover:bg-kp-bg-hover text-kp-text-secondary hover:text-kp-text-primary transition-all text-xs"
              title={t('toolbar.printTitle')}
            >
              <PrinterIcon className="h-3.5 w-3.5 text-kp-text-secondary" />
              <ChevronDownIcon className="h-3 w-3" />
            </button>
            {activeDropdown === 'printer' && (
              <div className="absolute left-0 mt-1 w-48 rounded border border-kp-border bg-kp-bg-primary shadow-lg z-50 py-1 text-[0.6875rem]">
                <button
                  onClick={() => handleAction(t('toolbar.printInvoices'))}
                  className="w-full text-left px-3 py-1.5 hover:bg-kp-bg-hover text-kp-text-secondary hover:text-kp-text-primary"
                >
                  {t('toolbar.printInvoices')}
                </button>
                <button
                  onClick={() => handleAction(t('toolbar.printLabels'))}
                  className="w-full text-left px-3 py-1.5 hover:bg-kp-bg-hover text-kp-text-secondary hover:text-kp-text-primary"
                >
                  {t('toolbar.printLabels')}
                </button>
                <button
                  onClick={() => handleAction(t('toolbar.printPackingList'))}
                  className="w-full text-left px-3 py-1.5 hover:bg-kp-bg-hover text-kp-text-secondary hover:text-kp-text-primary"
                >
                  {t('toolbar.printPackingList')}
                </button>
              </div>
            )}
          </div>

          {/* AWB Blue Button */}
          <button
            onClick={() => handleAction(t('toolbar.createAwb'))}
            className="flex items-center justify-center h-[28px] w-[32px] rounded bg-blue-600 hover:bg-blue-500 text-white transition-all shadow-sm"
            title={t('toolbar.createAwb')}
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </button>

          {/* Carrier/Truck */}
          <div className="relative">
            <button
              onClick={() => setActiveDropdown(activeDropdown === 'truck' ? null : 'truck')}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded border border-kp-border bg-kp-bg-primary hover:bg-kp-bg-hover text-kp-text-secondary hover:text-kp-text-primary transition-all text-xs"
              title={t('toolbar.carriersTitle')}
            >
              <TruckIcon className="h-3.5 w-3.5 text-kp-text-secondary" />
              <ChevronDownIcon className="h-3 w-3" />
            </button>
            {activeDropdown === 'truck' && (
              <div className="absolute left-0 mt-1 w-52 rounded border border-kp-border bg-kp-bg-primary shadow-lg z-50 py-1 text-[0.6875rem]">
                <button
                  onClick={() => handleAction('DPD Romania')}
                  className="w-full text-left px-3 py-1.5 hover:bg-kp-bg-hover text-kp-text-secondary hover:text-kp-text-primary flex items-center justify-between"
                >
                  <span>DPD Romania</span>
                  <span className="text-[0.5625rem] bg-kp-accent/20 text-kp-accent rounded px-1.5 font-bold">{t('toolbar.defaultCarrier')}</span>
                </button>
                <button
                  onClick={() => handleAction('Yurtiçi Kargo')}
                  className="w-full text-left px-3 py-1.5 hover:bg-kp-bg-hover text-kp-text-secondary hover:text-kp-text-primary"
                >
                  Yurtiçi Kargo
                </button>
                <button
                  onClick={() => handleAction('MNG Kargo')}
                  className="w-full text-left px-3 py-1.5 hover:bg-kp-bg-hover text-kp-text-secondary hover:text-kp-text-primary"
                >
                  MNG Kargo
                </button>
                <button
                  onClick={() => handleAction('Aras Kargo')}
                  className="w-full text-left px-3 py-1.5 hover:bg-kp-bg-hover text-kp-text-secondary hover:text-kp-text-primary"
                >
                  Aras Kargo
                </button>
              </div>
            )}
          </div>

          {/* Bulk Actions */}
          <div className="relative">
            <button
              onClick={() => setActiveDropdown(activeDropdown === 'more' ? null : 'more')}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded border border-kp-border bg-kp-bg-primary hover:bg-kp-bg-hover text-kp-text-secondary hover:text-kp-text-primary transition-all text-xs"
              title={t('toolbar.bulkTitle')}
            >
              <Bars3Icon className="h-3.5 w-3.5 text-kp-text-secondary" />
              <ChevronDownIcon className="h-3 w-3" />
            </button>
            {activeDropdown === 'more' && (
              <div className="absolute left-0 mt-1 w-44 rounded border border-kp-border bg-kp-bg-primary shadow-lg z-50 py-1 text-[0.6875rem]">
                <button
                  onClick={() => handleAction(t('toolbar.bulkStatusChange'))}
                  className="w-full text-left px-3 py-1.5 hover:bg-kp-bg-hover text-kp-text-secondary hover:text-kp-text-primary"
                >
                  {t('toolbar.bulkStatusChange')}
                </button>
                <button
                  onClick={() => handleAction(t('toolbar.archive'))}
                  className="w-full text-left px-3 py-1.5 hover:bg-kp-bg-hover text-kp-text-secondary hover:text-kp-text-primary"
                >
                  {t('toolbar.archive')}
                </button>
                <hr className="border-kp-border my-1" />
                <button
                  onClick={() => handleAction(t('toolbar.deleteSelected'))}
                  className="w-full text-left px-3 py-1.5 hover:bg-kp-bg-hover text-red-500 font-semibold"
                >
                  {t('toolbar.deleteSelected')}
                </button>
              </div>
            )}
          </div>

          {/* Sort Columns */}
          <div className="relative">
            <button
              onClick={() => setActiveDropdown(activeDropdown === 'sort' ? null : 'sort')}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded border border-kp-border bg-kp-bg-primary hover:bg-kp-bg-hover text-kp-text-secondary hover:text-kp-text-primary transition-all text-xs"
              title={t('toolbar.sortTitle')}
            >
              <ArrowsUpDownIcon className="h-3.5 w-3.5 text-kp-text-secondary" />
            </button>
            {activeDropdown === 'sort' && (
              <div className="absolute right-0 mt-1 w-48 rounded border border-kp-border bg-kp-bg-primary shadow-lg z-50 py-1 text-[0.6875rem]">
                <button
                  onClick={() => { onFilterChange({ ...filters, dateRange: 'all' }); showToast(t('toolbar.sortedByDate')); setActiveDropdown(null); }}
                  className="w-full text-left px-3 py-1.5 hover:bg-kp-bg-hover text-kp-text-secondary hover:text-kp-text-primary"
                >
                  {t('toolbar.sortByDate')}
                </button>
                <button
                  onClick={() => { showToast(t('toolbar.sortedByOrderNo')); setActiveDropdown(null); }}
                  className="w-full text-left px-3 py-1.5 hover:bg-kp-bg-hover text-kp-text-secondary hover:text-kp-text-primary"
                >
                  {t('toolbar.sortByOrderNo')}
                </button>
                <button
                  onClick={() => { showToast(t('toolbar.sortedByAmount')); setActiveDropdown(null); }}
                  className="w-full text-left px-3 py-1.5 hover:bg-kp-bg-hover text-kp-text-secondary hover:text-kp-text-primary"
                >
                  {t('toolbar.sortByAmount')}
                </button>
              </div>
            )}
          </div>

          {/* Selected Counter */}
          {selectedOrderIds.length > 0 && (
            <span className="text-[0.6875rem] text-kp-accent font-semibold ml-2 animate-fade-in">
              {t('selectedCount', { count: selectedOrderIds.length })}
            </span>
          )}

          {/* Create Order Button */}
          {onCreateOrder && (
            <button
              onClick={onCreateOrder}
              className="ml-auto flex items-center justify-center gap-1.5 rounded bg-kp-accent hover:bg-kp-accent-hover text-white px-3 py-1.5 text-[0.6875rem] font-bold shadow-sm transition-all h-[28px]"
            >
              <span className="text-sm leading-none">+</span>
              {t('createOrder')}
            </button>
          )}
        </div>


      {/* Table */}
      <div className="overflow-x-auto">
        <table className="kp-table w-full text-left border-collapse text-xs text-kp-text-secondary">
          <thead>
            <tr className="border-b border-kp-border text-[0.625rem] font-semibold uppercase tracking-wider text-kp-text-tertiary bg-kp-bg-primary/30">
              <th className="py-3 px-4 w-10">
                <input
                  type="checkbox"
                  checked={orders.length > 0 && selectedOrderIds.length === orders.length}
                  onChange={toggleSelectAll}
                  className="rounded border-kp-border text-kp-accent focus:ring-0 cursor-pointer h-3.5 w-3.5 bg-kp-bg-primary"
                />
              </th>
              <th className="py-3 px-4">{t('columns.kroptosId')}</th>
              <th className="py-3 px-4">{t('columns.orderNo')}</th>
              <th className="py-3 px-4">{t('columns.customer')}</th>
              <th className="py-3 px-4">{t('columns.products')}</th>
              <th className="py-3 px-4">{t('columns.orderStatus')}</th>
              <th className="py-3 px-4">{t('columns.payment')}</th>
              <th className="py-3 px-4">{t('columns.fulfillment')}</th>
              <th className="py-3 px-4 text-right">{t('columns.amount')}</th>
              <th className="py-3 px-4">{t('columns.date')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-kp-border">
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}>
                  <td className="py-4 px-4 w-10">
                    <div className="h-3.5 w-3.5 rounded bg-kp-bg-tertiary animate-pulse" />
                  </td>
                  {Array.from({ length: 9 }).map((_, j) => (
                    <td key={j} className="py-4 px-4">
                      <div className="h-3 rounded bg-kp-bg-tertiary animate-pulse" style={{ width: `${60 + Math.random() * 40}%` }} />
                    </td>
                  ))}
                </tr>
              ))
            ) : orders.length === 0 ? (
              <tr>
                <td colSpan={10} className="py-16 text-center">
                  <div className="flex flex-col items-center gap-2">
                    <span className="text-3xl">📦</span>
                    <p className="text-sm font-medium text-kp-text-secondary">{t('empty.title')}</p>
                    <p className="text-xs text-kp-text-tertiary">
                      {filters.search || filters.status !== 'all' || filters.dateRange !== 'all'
                        ? t('empty.filtered')
                        : t('empty.noOrders')}
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              orders.map((order) => (
                <tr
                  key={order.id}
                  onClick={() => onRowClick(order)}
                  className="hover:bg-kp-bg-hover/40 transition-colors cursor-pointer group"
                >
                  <td className="py-3.5 px-4 w-10" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selectedOrderIds.includes(order.id)}
                      onChange={(e) => toggleSelectOrder(order.id, e as any)}
                      className="rounded border-kp-border text-kp-accent focus:ring-0 cursor-pointer h-3.5 w-3.5 bg-kp-bg-primary"
                    />
                  </td>
                  <td className="py-3.5 px-4">
                    <span className="font-mono text-[0.6875rem] text-kp-text-secondary">
                      {order.publicId || '—'}
                    </span>
                  </td>
                  <td className="py-3.5 px-4">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          showToast(t('addedToFavorites'));
                        }}
                        className="text-kp-text-tertiary hover:text-yellow-400 transition-colors"
                        title={t('toolbar.addStar')}
                      >
                        <StarIcon className="h-3.5 w-3.5" />
                      </button>
                      <span className="font-mono text-[0.6875rem] font-semibold text-kp-text-primary group-hover:text-kp-accent transition-colors">
                        {order.orderNumber}
                      </span>
                    </div>
                  </td>
                  <td className="py-3.5 px-4">
                    <div>
                      <p className="font-medium text-kp-text-primary text-[0.75rem]">
                        {order.customerName || 'Walk-in'}
                      </p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className={`inline-flex items-center justify-center text-[0.5rem] font-bold text-white rounded-full h-3.5 w-3.5 ${
                          order.source === 'trendyol' ? 'bg-orange-500' : 'bg-slate-500'
                        }`}>
                          {order.source === 'trendyol' ? 'T' : 'M'}
                        </span>
                        <span className="text-[0.625rem] text-kp-text-tertiary font-semibold">
                          {order.source === 'trendyol' ? 'Trendyol Magros' : t('manualStore')}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td className="py-3.5 px-4 max-w-xs truncate">
                    {order.items && order.items.length > 0 ? (
                      <span className="text-[0.6875rem] text-kp-text-secondary font-medium">
                        {order.items.map(item => `${item.quantity}x ${item.name}`).join(', ')}
                      </span>
                    ) : (
                      <span className="text-[0.6875rem] text-kp-text-tertiary">-</span>
                    )}
                  </td>
                  <td className="py-3.5 px-4">
                    <div className="flex flex-col items-start gap-1">
                      <OrderStatusBadge status={order.status} />
                      <OrderModeBadge isPoolOrder={order.isPoolOrder} logoSyncStatus={order.logoSyncStatus} />
                    </div>
                  </td>
                  <td className="py-3.5 px-4">
                    <PaymentStatusBadge status={order.paymentStatus} />
                  </td>
                  <td className="py-3.5 px-4">
                    <FulfillmentStatusBadge status={order.fulfillmentStatus} />
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    <span className="font-semibold text-kp-text-primary text-[0.75rem]">
                      {parseFloat(order.totalAmount.toString()).toLocaleString('tr-TR', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                      {' '}
                      {order.currency === 'TRY' ? '₺' : order.currency === 'USD' ? '$' : order.currency === 'EUR' ? '€' : order.currency}
                    </span>
                  </td>
                  <td className="py-3.5 px-4">
                    <div>
                      <p className="text-[0.6875rem] text-kp-text-secondary">
                        {new Date(order.createdAt).toLocaleDateString('tr-TR', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </p>
                      <p className="text-[0.625rem] text-kp-text-tertiary">
                        {new Date(order.createdAt).toLocaleTimeString('tr-TR', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {!isLoading && totalFiltered > 0 && (
        <div className="flex items-center justify-between border-t border-kp-border px-4 py-3 bg-kp-bg-primary/10">
          <p className="text-[0.6875rem] text-kp-text-tertiary font-medium">
            <span className="font-semibold text-kp-text-secondary">{startIdx}–{endIdx}</span>
            {' '}{t('paginationSummary', { total: totalFiltered })}
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => onPageChange(currentPage - 1)}
              disabled={currentPage <= 1}
              className="flex h-7 w-7 items-center justify-center rounded border border-kp-border text-kp-text-tertiary hover:bg-kp-bg-hover hover:text-kp-text-primary disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeftIcon className="h-3.5 w-3.5" />
            </button>
            {pageWindow(currentPage, totalPages).map((page) => {
              return (
                <button
                  key={page}
                  onClick={() => onPageChange(page)}
                  className={`flex h-7 w-7 items-center justify-center rounded text-[0.6875rem] font-semibold transition-colors ${
                    currentPage === page
                      ? 'bg-kp-accent text-white shadow-sm'
                      : 'border border-kp-border text-kp-text-tertiary hover:bg-kp-bg-hover hover:text-kp-text-primary'
                  }`}
                >
                  {page}
                </button>
              );
            })}
            <button
              onClick={() => onPageChange(currentPage + 1)}
              disabled={currentPage >= totalPages}
              className="flex h-7 w-7 items-center justify-center rounded border border-kp-border text-kp-text-tertiary hover:bg-kp-bg-hover hover:text-kp-text-primary disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRightIcon className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Premium Notification Toast */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-[9999] flex items-center gap-2 rounded border border-kp-accent bg-kp-bg-primary px-4 py-3 shadow-2xl animate-fade-in transition-all duration-300">
          <div className="flex h-5 w-5 items-center justify-center rounded-full bg-kp-accent/15 text-kp-accent">
            <CheckIcon className="h-3.5 w-3.5" />
          </div>
          <span className="text-xs font-semibold text-kp-text-primary">{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
