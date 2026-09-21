'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import { OrderExportSchedule } from '../types';

export function useExportSchedules() {
  const [schedules, setSchedules] = useState<OrderExportSchedule[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSchedules = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await api.get<OrderExportSchedule[]>('/v1/orders/export/schedules');
      if (Array.isArray(res)) {
        setSchedules(res);
      }
    } catch (err: any) {
      console.error('Zamanlamalar yüklenemedi:', err);
      setError(err?.message || 'Zamanlanmış görevler yüklenemedi.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSchedules();
  }, [fetchSchedules]);

  const toggleScheduleActive = async (id: string, currentActive: boolean) => {
    try {
      await api.patch(`/v1/orders/export/schedules/${id}`, {
        isActive: !currentActive,
      });
      await fetchSchedules();
    } catch (err: any) {
      setError(err?.message || 'Zamanlama durumu güncellenemedi.');
    }
  };

  const runScheduleNow = async (id: string) => {
    try {
      await api.post(`/v1/orders/export/schedules/${id}/run-now`, {});
      alert('Zamanlanmış görev arka planda başlatıldı. Durumu Geçmiş sekmesinden izleyebilirsiniz.');
    } catch (err: any) {
      setError(err?.message || 'Zamanlama anında çalıştırılamadı.');
    }
  };

  const deleteSchedule = async (id: string) => {
    if (!window.confirm('Bu zamanlanmış görevi silmek istediğinize emin misiniz?')) {
      return;
    }
    try {
      await api.delete(`/v1/orders/export/schedules/${id}`);
      await fetchSchedules();
    } catch (err: any) {
      setError(err?.message || 'Zamanlama silinemedi.');
    }
  };

  const createSchedule = async (data: any) => {
    try {
      await api.post('/v1/orders/export/schedules', data);
      await fetchSchedules();
      return true;
    } catch (err: any) {
      setError(err?.message || 'Zamanlama oluşturulamadı.');
      return false;
    }
  };

  const updateSchedule = async (id: string, data: any) => {
    try {
      await api.patch(`/v1/orders/export/schedules/${id}`, data);
      await fetchSchedules();
      return true;
    } catch (err: any) {
      setError(err?.message || 'Zamanlama güncellenemedi.');
      return false;
    }
  };

  return {
    schedules,
    isLoading,
    error,
    refreshSchedules: fetchSchedules,
    toggleScheduleActive,
    runScheduleNow,
    deleteSchedule,
    createSchedule,
    updateSchedule,
  };
}
