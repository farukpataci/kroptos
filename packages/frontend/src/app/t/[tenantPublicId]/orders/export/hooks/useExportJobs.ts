'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import { OrderExportJob } from '../types';

export function useExportJobs() {
  const [jobs, setJobs] = useState<OrderExportJob[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(15);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const fetchJobs = useCallback(async () => {
    setIsLoading(true);
    setActionError(null);
    try {
      let query = `page=${page}&limit=${limit}`;
      if (statusFilter) query += `&status=${statusFilter}`;

      const res = await api.get<{
        items: OrderExportJob[];
        total: number;
        page: number;
        limit: number;
      }>(`/v1/orders/export/jobs?${query}`);

      if (res?.items) {
        setJobs(res.items);
        setTotal(res.total || 0);
      }
    } catch (err: any) {
      console.error('İşler yüklenemedi:', err);
      setActionError(err?.message || 'Geçmiş işler yüklenirken bir hata oluştu');
    } finally {
      setIsLoading(false);
    }
  }, [page, limit, statusFilter]);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  const downloadJob = async (id: string) => {
    try {
      const res = await api.post<{ token: string }>(
        `/v1/orders/export/jobs/${id}/download-token`,
        {},
      );
      if (res?.token) {
        const downloadUrl = `/api/v1/orders/export/download/${id}?token=${res.token}`;
        window.location.href = downloadUrl;
      }
    } catch (err: any) {
      setActionError(err?.message || 'İndirme bağlantısı oluşturulamadı.');
    }
  };

  const cancelJob = async (id: string) => {
    try {
      await api.post(`/v1/orders/export/jobs/${id}/cancel`, {});
      await fetchJobs();
    } catch (err: any) {
      setActionError(err?.message || 'İş iptal edilemedi.');
    }
  };

  const rerunJob = async (id: string) => {
    try {
      await api.post(`/v1/orders/export/jobs/${id}/rerun`, {});
      await fetchJobs();
    } catch (err: any) {
      setActionError(err?.message || 'İş yeniden başlatılamadı.');
    }
  };

  const deleteJob = async (id: string) => {
    if (!window.confirm('Bu dışa aktarma işini ve dosyasını silmek istediğinize emin misiniz?')) {
      return;
    }
    try {
      await api.delete(`/v1/orders/export/jobs/${id}`);
      await fetchJobs();
    } catch (err: any) {
      setActionError(err?.message || 'İş silinemedi.');
    }
  };

  return {
    jobs,
    total,
    page,
    setPage,
    limit,
    statusFilter,
    setStatusFilter,
    isLoading,
    actionError,
    refreshJobs: fetchJobs,
    downloadJob,
    cancelJob,
    rerunJob,
    deleteJob,
  };
}
