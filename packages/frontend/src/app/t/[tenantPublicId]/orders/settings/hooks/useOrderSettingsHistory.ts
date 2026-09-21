import { useState, useCallback } from 'react';
import { api } from '@/lib/api';
import { SettingChangeLogItem } from '../types';

export function useOrderSettingsHistory() {
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<SettingChangeLogItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [reverting, setReverting] = useState(false);

  const fetchHistory = useCallback(async (targetPage = 1) => {
    setLoading(true);
    try {
      const res = await api.get<{
        items: SettingChangeLogItem[];
        total: number;
        page: number;
        totalPages: number;
      }>(`/api/order-settings/history?page=${targetPage}&limit=15`);

      setItems(res.items || []);
      setTotal(res.total || 0);
      setPage(res.page || 1);
      setTotalPages(res.totalPages || 1);
    } catch (err) {
      // Ignored
    } finally {
      setLoading(false);
    }
  }, []);

  const revertChangeSet = useCallback(
    async (changeSetId: string) => {
      setReverting(true);
      try {
        await api.post(`/api/order-settings/history/${changeSetId}/revert`);
        await fetchHistory(page);
      } catch (err: any) {
        throw err;
      } finally {
        setReverting(false);
      }
    },
    [fetchHistory, page],
  );

  return {
    loading,
    items,
    total,
    page,
    totalPages,
    reverting,
    fetchHistory,
    revertChangeSet,
  };
}
