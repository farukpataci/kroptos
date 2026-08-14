'use client';

import { useState } from 'react';
import {
  MagnifyingGlassIcon,
  FunnelIcon,
  PlusIcon,
  PencilIcon,
  TrashIcon,
  XMarkIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  SparklesIcon,
  TagIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline';
import { useToast } from '@/components/ui/Toast';

export interface StockRule {
  id: string;
  name: string;
  channel: 'Trendyol' | 'Hepsiburada' | 'Amazon' | 'N11' | 'Shopify' | 'Çiçeksepeti';
  ruleType: 'buffer_stock' | 'percentage_allocation' | 'max_cap' | 'low_stock_hide';
  value: string;
  targetScope: string;
  status: 'active' | 'passive';
  priority: 'high' | 'medium' | 'low';
  updatedAt: string;
}

const INITIAL_MOCK_RULES: StockRule[] = [
  {
    id: 'RULE-101',
    name: 'Trendyol Minimum Emniyet Stoğu',
    channel: 'Trendyol',
    ruleType: 'buffer_stock',
    value: '5 Adet',
    targetScope: 'Tüm Ürünler',
    status: 'active',
    priority: 'high',
    updatedAt: 'Bugün 11:30',
  },
  {
    id: 'RULE-102',
    name: 'Amazon Yüzdesel Kota Alokasyonu',
    channel: 'Amazon',
    ruleType: 'percentage_allocation',
    value: '%80',
    targetScope: 'Elektronik & Bilgisayar',
    status: 'active',
    priority: 'medium',
    updatedAt: 'Dün 16:45',
  },
  {
    id: 'RULE-103',
    name: 'Hepsiburada Maksimum Satış Limiti',
    channel: 'Hepsiburada',
    ruleType: 'max_cap',
    value: '50 Adet Limit',
    targetScope: 'Merkez Lojistik Deposu',
    status: 'active',
    priority: 'medium',
    updatedAt: '22 Tem 2026',
  },
  {
    id: 'RULE-104',
    name: 'N11 Kritik Stokta Kanal Gizleme',
    channel: 'N11',
    ruleType: 'low_stock_hide',
    value: '3 Adet Altı',
    targetScope: 'Tüm Ürünler',
    status: 'passive',
    priority: 'low',
    updatedAt: '20 Tem 2026',
  },
  {
    id: 'RULE-105',
    name: 'Çiçeksepeti Tampon Stok Koruması',
    channel: 'Çiçeksepeti',
    ruleType: 'buffer_stock',
    value: '10 Adet',
    targetScope: 'Hızlı Gönderim Deposu',
    status: 'active',
    priority: 'high',
    updatedAt: '18 Tem 2026',
  },
];

const RULE_TYPE_LABELS: Record<string, { label: string; bgClass: string; textClass: string }> = {
  buffer_stock: {
    label: 'Tampon Stok (Emniyet)',
    bgClass: 'bg-amber-500/10 border-amber-500/20',
    textClass: 'text-amber-600 dark:text-amber-400',
  },
  percentage_allocation: {
    label: 'Yüzdesel Kota (% Alokasyon)',
    bgClass: 'bg-blue-500/10 border-blue-500/20',
    textClass: 'text-blue-600 dark:text-blue-400',
  },
  max_cap: {
    label: 'Maksimum Stok Limiti',
    bgClass: 'bg-indigo-500/10 border-indigo-500/20',
    textClass: 'text-indigo-600 dark:text-indigo-400',
  },
  low_stock_hide: {
    label: 'Kritik Stokta Gizle',
    bgClass: 'bg-rose-500/10 border-rose-500/20',
    textClass: 'text-rose-600 dark:text-rose-400',
  },
};

const CHANNEL_BADGES: Record<string, string> = {
  Trendyol: 'bg-orange-500/10 text-orange-600 border-orange-500/20',
  Hepsiburada: 'bg-amber-600/10 text-amber-700 border-amber-600/20',
  Amazon: 'bg-yellow-500/10 text-yellow-700 border-yellow-500/20',
  N11: 'bg-red-500/10 text-red-600 border-red-500/20',
  Shopify: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
  Çiçeksepeti: 'bg-pink-500/10 text-pink-600 border-pink-500/20',
};

export function MarketplaceStockRulesTable() {
  const toast = useToast();
  const [rules, setRules] = useState<StockRule[]>(INITIAL_MOCK_RULES);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedChannel, setSelectedChannel] = useState<string>('all');
  const [selectedRuleType, setSelectedRuleType] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<StockRule | null>(null);
  const [deletingRule, setDeletingRule] = useState<StockRule | null>(null);

  // Form State
  const [formData, setFormData] = useState<Partial<StockRule>>({
    name: '',
    channel: 'Trendyol',
    ruleType: 'buffer_stock',
    value: '',
    targetScope: 'Tüm Ürünler',
    priority: 'medium',
    status: 'active',
  });

  const filteredRules = rules.filter((r) => {
    const matchesSearch =
      r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.channel.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.targetScope.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesChannel = selectedChannel === 'all' ? true : r.channel === selectedChannel;
    const matchesRuleType = selectedRuleType === 'all' ? true : r.ruleType === selectedRuleType;
    const matchesStatus = selectedStatus === 'all' ? true : r.status === selectedStatus;
    return matchesSearch && matchesChannel && matchesRuleType && matchesStatus;
  });

  const handleOpenAddModal = () => {
    setEditingRule(null);
    setFormData({
      name: '',
      channel: 'Trendyol',
      ruleType: 'buffer_stock',
      value: '5 Adet',
      targetScope: 'Tüm Ürünler',
      priority: 'medium',
      status: 'active',
    });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (rule: StockRule) => {
    setEditingRule(rule);
    setFormData({ ...rule });
    setIsModalOpen(true);
  };

  const handleSaveRule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name?.trim()) return;

    if (editingRule) {
      setRules((prev) =>
        prev.map((r) =>
          r.id === editingRule.id
            ? ({
                ...r,
                ...formData,
                updatedAt: 'Şimdi',
              } as StockRule)
            : r
        )
      );
      toast.success('Stok kuralı başarıyla güncellendi.');
    } else {
      const newRule: StockRule = {
        id: `RULE-${Math.floor(100 + Math.random() * 900)}`,
        name: formData.name || 'Yeni Stok Kuralı',
        channel: formData.channel as any,
        ruleType: formData.ruleType as any,
        value: formData.value || '0',
        targetScope: formData.targetScope || 'Tüm Ürünler',
        priority: formData.priority as any,
        status: formData.status as any,
        updatedAt: 'Şimdi',
      };
      setRules((prev) => [newRule, ...prev]);
      toast.success('Yeni pazaryeri stok kuralı oluşturuldu.');
    }
    setIsModalOpen(false);
  };

  const handleToggleStatus = (ruleId: string) => {
    setRules((prev) =>
      prev.map((r) => {
        if (r.id === ruleId) {
          const nextStatus = r.status === 'active' ? 'passive' : 'active';
          toast.success(`Kural durumu ${nextStatus === 'active' ? 'Aktif' : 'Pasif'} olarak değiştirildi.`);
          return { ...r, status: nextStatus, updatedAt: 'Şimdi' };
        }
        return r;
      })
    );
  };

  const handleDeleteConfirm = () => {
    if (!deletingRule) return;
    setRules((prev) => prev.filter((r) => r.id !== deletingRule.id));
    toast.success('Stok kuralı başarıyla silindi.');
    setDeletingRule(null);
  };

  return (
    <div className="space-y-4">
      {/* Header Info */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-kp-border pb-4 gap-3">
        <div>
          <h3 className="text-lg font-bold text-kp-text-primary flex items-center gap-2">
            <SparklesIcon className="h-5 w-5 text-kp-accent" />
            Pazaryeri Stok Kuralları (Marketplace Stock Rules)
          </h3>
          <p className="text-xs text-kp-text-tertiary mt-0.5">
            Pazaryeri satış kanallarınıza gönderilecek stok kotalarını, tampon korumaları ve emniyet limitlerini otomatikleştirin.
          </p>
        </div>
        <button
          onClick={handleOpenAddModal}
          className="flex items-center justify-center gap-1.5 rounded-kp-md bg-kp-accent hover:bg-kp-accent-hover text-white px-4 py-2 text-xs font-semibold shadow-xs transition-colors"
        >
          <PlusIcon className="h-4 w-4" />
          Yeni Kural Ekle
        </button>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col sm:flex-row items-center gap-3 justify-between">
        <div className="flex flex-1 items-center gap-3 w-full max-w-2xl">
          {/* Search Input */}
          <div className="relative flex-1">
            <input
              type="text"
              placeholder="Kural adı, pazaryeri veya kapsam ara..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-kp-bg-secondary border border-kp-border rounded-kp-md pl-9 pr-3.5 py-1.5 text-xs text-kp-text-primary placeholder:text-kp-text-tertiary focus:outline-hidden focus:border-kp-accent transition-colors"
            />
            <MagnifyingGlassIcon className="absolute left-3 top-2.5 h-3.5 w-3.5 text-kp-text-tertiary" />
          </div>

          {/* Channel Dropdown */}
          <select
            value={selectedChannel}
            onChange={(e) => setSelectedChannel(e.target.value)}
            className="bg-kp-bg-secondary border border-kp-border rounded-kp-md px-3 py-1.5 text-xs text-kp-text-secondary focus:outline-hidden focus:border-kp-accent transition-colors cursor-pointer"
          >
            <option value="all">Tüm Pazaryerleri</option>
            <option value="Trendyol">Trendyol</option>
            <option value="Hepsiburada">Hepsiburada</option>
            <option value="Amazon">Amazon</option>
            <option value="N11">N11</option>
            <option value="Çiçeksepeti">Çiçeksepeti</option>
            <option value="Shopify">Shopify</option>
          </select>

          {/* Rule Type Dropdown */}
          <select
            value={selectedRuleType}
            onChange={(e) => setSelectedRuleType(e.target.value)}
            className="bg-kp-bg-secondary border border-kp-border rounded-kp-md px-3 py-1.5 text-xs text-kp-text-secondary focus:outline-hidden focus:border-kp-accent transition-colors cursor-pointer"
          >
            <option value="all">Tüm Kural Tipleri</option>
            <option value="buffer_stock">Tampon Stok</option>
            <option value="percentage_allocation">Yüzdesel Kota</option>
            <option value="max_cap">Maksimum Limit</option>
            <option value="low_stock_hide">Kritik Stokta Gizle</option>
          </select>

          {/* Status Filter */}
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="bg-kp-bg-secondary border border-kp-border rounded-kp-md px-3 py-1.5 text-xs text-kp-text-secondary focus:outline-hidden focus:border-kp-accent transition-colors cursor-pointer"
          >
            <option value="all">Tüm Durumlar</option>
            <option value="active">Aktif</option>
            <option value="passive">Pasif</option>
          </select>
        </div>

        <div className="text-xs text-kp-text-tertiary">
          Toplam <span className="font-semibold text-kp-text-secondary">{filteredRules.length}</span> kural listeleniyor
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto border border-kp-border rounded-kp-md bg-kp-bg-primary/20">
        <table className="kp-table w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-kp-border text-[0.625rem] font-semibold uppercase tracking-wider text-kp-text-tertiary bg-kp-bg-primary/30">
              <th className="py-3 px-4">Kural Adı</th>
              <th className="py-3 px-4">Pazaryeri</th>
              <th className="py-3 px-4">Kural Tipi</th>
              <th className="py-3 px-4">Değer / Eşik</th>
              <th className="py-3 px-4">Kapsam</th>
              <th className="py-3 px-4 text-center">Öncelik</th>
              <th className="py-3 px-4 text-center">Durum</th>
              <th className="py-3 px-4 text-right">İşlemler</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-kp-border text-kp-text-secondary">
            {filteredRules.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-12 text-center text-kp-text-tertiary">
                  <div className="flex flex-col items-center gap-2">
                    <SparklesIcon className="h-8 w-8 text-kp-text-tertiary animate-pulse" />
                    <p className="font-semibold text-kp-text-secondary text-xs">Stok kuralı bulunamadı</p>
                    <p className="text-[0.6875rem]">Filtreleri değiştirin veya yeni bir kural ekleyin.</p>
                  </div>
                </td>
              </tr>
            ) : (
              filteredRules.map((rule) => {
                const ruleBadge = RULE_TYPE_LABELS[rule.ruleType] || {
                  label: rule.ruleType,
                  bgClass: 'bg-kp-bg-secondary',
                  textClass: 'text-kp-text-secondary',
                };
                const channelClass = CHANNEL_BADGES[rule.channel] || 'bg-kp-bg-secondary text-kp-text-secondary border-kp-border';

                return (
                  <tr key={rule.id} className="hover:bg-kp-bg-hover/30 transition-colors">
                    {/* Name */}
                    <td className="py-3.5 px-4">
                      <div>
                        <p className="font-semibold text-kp-text-primary text-[0.75rem]">{rule.name}</p>
                        <p className="text-[0.625rem] font-mono text-kp-text-tertiary">{rule.id} • Son güncelleme: {rule.updatedAt}</p>
                      </div>
                    </td>

                    {/* Channel */}
                    <td className="py-3.5 px-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[0.625rem] font-bold border ${channelClass}`}>
                        {rule.channel}
                      </span>
                    </td>

                    {/* Rule Type */}
                    <td className="py-3.5 px-4">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-kp-xs text-[0.625rem] font-semibold border ${ruleBadge.bgClass} ${ruleBadge.textClass}`}>
                        {ruleBadge.label}
                      </span>
                    </td>

                    {/* Value */}
                    <td className="py-3.5 px-4 font-mono font-bold text-kp-text-primary text-[0.75rem]">
                      {rule.value}
                    </td>

                    {/* Target Scope */}
                    <td className="py-3.5 px-4">
                      <span className="text-[0.6875rem] font-medium text-kp-text-secondary">
                        {rule.targetScope}
                      </span>
                    </td>

                    {/* Priority */}
                    <td className="py-3.5 px-4 text-center">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded-full text-[0.5625rem] font-bold uppercase tracking-wider ${
                          rule.priority === 'high'
                            ? 'bg-red-500/10 text-red-600'
                            : rule.priority === 'medium'
                            ? 'bg-amber-500/10 text-amber-600'
                            : 'bg-blue-500/10 text-blue-600'
                        }`}
                      >
                        {rule.priority === 'high' ? 'Yüksek' : rule.priority === 'medium' ? 'Orta' : 'Düşük'}
                      </span>
                    </td>

                    {/* Status */}
                    <td className="py-3.5 px-4 text-center">
                      <button
                        onClick={() => handleToggleStatus(rule.id)}
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[0.625rem] font-bold transition-all cursor-pointer ${
                          rule.status === 'active'
                            ? 'bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20'
                            : 'bg-kp-bg-tertiary text-kp-text-tertiary hover:bg-kp-bg-hover'
                        }`}
                      >
                        <span className={`h-1.5 w-1.5 rounded-full ${rule.status === 'active' ? 'bg-emerald-500' : 'bg-kp-text-tertiary'}`} />
                        {rule.status === 'active' ? 'Aktif' : 'Pasif'}
                      </button>
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => handleOpenEditModal(rule)}
                          className="p-1.5 rounded-kp-sm text-kp-text-tertiary hover:text-kp-accent hover:bg-kp-bg-hover transition-colors"
                          title="Düzenle"
                        >
                          <PencilIcon className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => setDeletingRule(rule)}
                          className="p-1.5 rounded-kp-sm text-kp-text-tertiary hover:text-kp-danger hover:bg-kp-bg-hover transition-colors"
                          title="Sil"
                        >
                          <TrashIcon className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Add / Edit Form Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
          <div className="w-full max-w-lg bg-kp-bg-secondary border border-kp-border rounded-kp-lg shadow-kp-elevated overflow-hidden animate-scale-in">
            <div className="flex items-center justify-between px-6 py-4 border-b border-kp-border">
              <h3 className="text-sm font-bold text-kp-text-primary uppercase tracking-wider">
                {editingRule ? 'Stok Kuralını Düzenle' : 'Yeni Pazaryeri Stok Kuralı'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-kp-text-tertiary hover:text-kp-text-primary transition-colors"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveRule}>
              <div className="p-6 space-y-4 text-xs">
                {/* Rule Name */}
                <div>
                  <label className="block text-[0.6875rem] font-semibold text-kp-text-secondary mb-1">
                    Kural Adı *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                    placeholder="örn. Trendyol Minimum Tampon Stok"
                    className="w-full bg-kp-bg-primary border border-kp-border rounded-kp-md px-3 py-2 text-xs text-kp-text-primary focus:outline-hidden focus:border-kp-accent transition-colors"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {/* Channel */}
                  <div>
                    <label className="block text-[0.6875rem] font-semibold text-kp-text-secondary mb-1">
                      Pazaryeri Kanalı *
                    </label>
                    <select
                      value={formData.channel}
                      onChange={(e) => setFormData((prev) => ({ ...prev, channel: e.target.value as any }))}
                      className="w-full bg-kp-bg-primary border border-kp-border rounded-kp-md px-3 py-2 text-xs text-kp-text-primary focus:outline-hidden focus:border-kp-accent transition-colors cursor-pointer"
                    >
                      <option value="Trendyol">Trendyol</option>
                      <option value="Hepsiburada">Hepsiburada</option>
                      <option value="Amazon">Amazon</option>
                      <option value="N11">N11</option>
                      <option value="Çiçeksepeti">Çiçeksepeti</option>
                      <option value="Shopify">Shopify</option>
                    </select>
                  </div>

                  {/* Rule Type */}
                  <div>
                    <label className="block text-[0.6875rem] font-semibold text-kp-text-secondary mb-1">
                      Kural Tipi *
                    </label>
                    <select
                      value={formData.ruleType}
                      onChange={(e) => setFormData((prev) => ({ ...prev, ruleType: e.target.value as any }))}
                      className="w-full bg-kp-bg-primary border border-kp-border rounded-kp-md px-3 py-2 text-xs text-kp-text-primary focus:outline-hidden focus:border-kp-accent transition-colors cursor-pointer"
                    >
                      <option value="buffer_stock">Tampon Stok (Emniyet)</option>
                      <option value="percentage_allocation">Yüzdesel Kota (% Alokasyon)</option>
                      <option value="max_cap">Maksimum Stok Limiti</option>
                      <option value="low_stock_hide">Kritik Stokta Gizle</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {/* Value */}
                  <div>
                    <label className="block text-[0.6875rem] font-semibold text-kp-text-secondary mb-1">
                      Eşik / Kota Değeri *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.value}
                      onChange={(e) => setFormData((prev) => ({ ...prev, value: e.target.value }))}
                      placeholder="örn. 5 Adet veya %80"
                      className="w-full bg-kp-bg-primary border border-kp-border rounded-kp-md px-3 py-2 text-xs text-kp-text-primary font-mono focus:outline-hidden focus:border-kp-accent transition-colors"
                    />
                  </div>

                  {/* Priority */}
                  <div>
                    <label className="block text-[0.6875rem] font-semibold text-kp-text-secondary mb-1">
                      Öncelik Seviyesi
                    </label>
                    <select
                      value={formData.priority}
                      onChange={(e) => setFormData((prev) => ({ ...prev, priority: e.target.value as any }))}
                      className="w-full bg-kp-bg-primary border border-kp-border rounded-kp-md px-3 py-2 text-xs text-kp-text-primary focus:outline-hidden focus:border-kp-accent transition-colors cursor-pointer"
                    >
                      <option value="high">Yüksek (High)</option>
                      <option value="medium">Orta (Medium)</option>
                      <option value="low">Düşük (Low)</option>
                    </select>
                  </div>
                </div>

                {/* Target Scope */}
                <div>
                  <label className="block text-[0.6875rem] font-semibold text-kp-text-secondary mb-1">
                    Uygulanacak Kapsam / Kategori / Depo
                  </label>
                  <input
                    type="text"
                    value={formData.targetScope}
                    onChange={(e) => setFormData((prev) => ({ ...prev, targetScope: e.target.value }))}
                    placeholder="örn. Tüm Ürünler veya Elektronik Kategorisi"
                    className="w-full bg-kp-bg-primary border border-kp-border rounded-kp-md px-3 py-2 text-xs text-kp-text-primary focus:outline-hidden focus:border-kp-accent transition-colors"
                  />
                </div>

                {/* Status Toggle */}
                <div className="flex items-center gap-3 pt-2">
                  <label className="text-[0.6875rem] font-semibold text-kp-text-secondary">
                    Kural Durumu:
                  </label>
                  <button
                    type="button"
                    onClick={() =>
                      setFormData((prev) => ({
                        ...prev,
                        status: prev.status === 'active' ? 'passive' : 'active',
                      }))
                    }
                    className={`px-3 py-1 rounded-full text-xs font-bold transition-all cursor-pointer ${
                      formData.status === 'active'
                        ? 'bg-emerald-500 text-white'
                        : 'bg-kp-bg-tertiary text-kp-text-tertiary'
                    }`}
                  >
                    {formData.status === 'active' ? 'Aktif' : 'Pasif'}
                  </button>
                </div>
              </div>

              <div className="px-6 py-4 border-t border-kp-border bg-kp-bg-primary/20 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-kp-md border border-kp-border px-4 py-2 text-xs font-semibold text-kp-text-secondary hover:text-kp-text-primary transition-colors"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  className="rounded-kp-md bg-kp-accent hover:bg-kp-accent-hover text-white px-5 py-2 text-xs font-semibold transition-colors"
                >
                  {editingRule ? 'Değişiklikleri Kaydet' : 'Kuralı Oluştur'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingRule && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
          <div className="w-full max-w-md bg-kp-bg-secondary border border-kp-border rounded-kp-lg shadow-kp-elevated overflow-hidden animate-scale-in">
            <div className="flex items-center justify-between px-6 py-4 border-b border-kp-border">
              <h3 className="text-sm font-semibold text-kp-text-primary flex items-center gap-2">
                <ExclamationTriangleIcon className="h-5 w-5 text-kp-danger" /> Stok Kuralını Sil
              </h3>
              <button
                onClick={() => setDeletingRule(null)}
                className="text-kp-text-tertiary hover:text-kp-text-primary transition-colors"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>
            <div className="p-6 space-y-2">
              <p className="text-xs text-kp-text-secondary leading-relaxed">
                <span className="font-bold text-kp-text-primary">{deletingRule.name}</span> isimli pazaryeri stok kuralını silmek istediğinize emin misiniz?
              </p>
              <p className="text-[0.6875rem] text-kp-text-tertiary">
                Bu kural silindiğinde ilgili pazaryerindeki stok kotaları varsayılan ayarlara dönecektir.
              </p>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 bg-kp-bg-primary/50 border-t border-kp-border">
              <button
                type="button"
                onClick={() => setDeletingRule(null)}
                className="rounded-kp-md border border-kp-border px-4 py-2 text-xs font-semibold text-kp-text-secondary hover:text-kp-text-primary transition-colors"
              >
                İptal
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                className="flex items-center gap-1.5 rounded-kp-md bg-kp-danger hover:bg-red-600 text-white px-4 py-2 text-xs font-semibold shadow-xs transition-all"
              >
                <TrashIcon className="h-3.5 w-3.5" />
                Kuralı Sil
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
