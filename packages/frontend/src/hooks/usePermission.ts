'use client';

import { useCallback } from 'react';
import { useAuth } from '@/lib/auth-context';

/**
 * Yalnizca UX: buton/menu gizler. Guvenlik siniri BACKEND guard'lari.
 * Izinler yuklenmediyse (null) can() FALSE doner - fail-closed; isLoading ile
 * flicker onlenir (yuklenene kadar gate'li ogeler hic cizilmez).
 */
export function usePermission() {
  const { permissions, isLoading: authLoading } = useAuth();
  const isLoading = authLoading || permissions === null;

  const can = useCallback(
    (key: string): boolean => {
      if (!permissions) return false;
      return permissions.includes('*:*') || permissions.includes(key);
    },
    [permissions],
  );
  const canAny = useCallback((keys: string[]) => keys.some(can), [can]);
  const canAll = useCallback((keys: string[]) => keys.every(can), [can]);

  return { can, canAny, canAll, isLoading, permissions };
}
