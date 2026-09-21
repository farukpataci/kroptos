'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import { OrderImportJob } from '../types';

export function useImportJobs() {
  const [jobs, setJobs] = useState<OrderImportJob[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const fetchJobs = useCallback(async (p = 1) => {
    setIsLoading(true);
    try {
      const res = await api.get<{ items: OrderImportJob[]; total: number }>(
        `/order-imports?page=${p}&limit=${limit}`,
      );
      if (res?.items) {
        setJobs(res.items);
        setTotal(res.total);
        setPage(p);
      }
    } catch (err: any) {
      console.error('İçe aktarma geçmişi yüklenemedi:', err);
    } finally {
      setIsLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    fetchJobs(page);
  }, [fetchJobs, page]);

  const rollbackJob = async (jobId: string) => {
    setActionLoadingId(jobId);
    try {
      await api.post(`/order-imports/${jobId}/rollback`, {});
      await fetchJobs(page);
    } catch (err: any) {
      alert(err.message || 'Geri alma başlatılamadı.');
    } finally {
      setActionLoadingId(null);
    }
  };

  const deleteJob = async (jobId: string) => {
    if (!confirm('Bu içe aktarma kaydını silmek istediğinize emin misiniz?')) return;
    setActionLoadingId(jobId);
    try {
      await api.delete(`/order-imports/${jobId}`);
      await fetchJobs(page);
    } catch (err: any) {
      alert(err.message || 'İş silinemedi.');
    } finally {
      setActionLoadingId(null);
    }
  };

  const downloadErrorReport = (jobId: string) => {
    const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
    const stored = typeof window !== 'undefined' ? localStorage.getItem('auth') : null;
    let token = '';
    if (stored) {
      try {
        token = JSON.parse(stored).accessToken;
      } catch {}
    }

    const tenant = typeof window !== 'undefined' ? localStorage.getItem('selected_tenant') : null;
    let agencyId = '';
    let storeId = '';
    if (tenant) {
      try {
        const parsed = JSON.parse(tenant);
        agencyId = parsed.agencyId || '';
        storeId = parsed.storeId || '';
      } catch {}
    }

    const url = `${baseUrl}/order-imports/${jobId}/error-report`;
    // Fetch with auth headers and trigger download
    fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        'x-agency-id': agencyId,
        'x-store-id': storeId,
      },
    })
      .then((res) => {
        if (!res.ok) throw new Error('Hata raporu indirilemedi.');
        return res.blob();
      })
      .then((blob) => {
        const blobUrl = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = `hata-raporu-${jobId}.xlsx`;
        document.body.appendChild(a);
        a.click();
        a.remove();
      })
      .catch((err) => alert(err.message));
  };

  return {
    jobs,
    isLoading,
    total,
    page,
    setPage,
    actionLoadingId,
    fetchJobs,
    rollbackJob,
    deleteJob,
    downloadErrorReport,
  };
}
