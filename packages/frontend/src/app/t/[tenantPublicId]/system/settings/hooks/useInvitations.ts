'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';

export interface InvitationRow {
  id: string;
  email: string;
  roleId: string;
  clientId: string | null;
  storeId: string | null;
  status: 'pending' | 'accepted' | 'revoked' | 'expired';
  expiresAt: string;
  acceptedAt: string | null;
  createdAt: string;
  invitedBy: string;
}

/** Bekleyen davetler + create/resend/revoke. Ham token asla API'den donmez. */
export function useInvitations() {
  const [invitations, setInvitations] = useState<InvitationRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchInvitations = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await apiFetch<{ items: InvitationRow[] }>('/api/system/invitations?status=pending&limit=100');
      setInvitations(data.items ?? []);
    } catch (err: any) {
      setError(err?.message || 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInvitations();
  }, [fetchInvitations]);

  const createInvitation = async (payload: { email: string; roleId: string; clientId?: string; storeId?: string }) => {
    const created = await apiFetch<InvitationRow>('/api/system/invitations', { method: 'POST', body: JSON.stringify(payload) });
    await fetchInvitations();
    return created;
  };

  const resend = async (id: string) => {
    await apiFetch(`/api/system/invitations/${id}/resend`, { method: 'POST' });
    await fetchInvitations();
  };

  const revoke = async (id: string) => {
    await apiFetch(`/api/system/invitations/${id}/revoke`, { method: 'POST' });
    await fetchInvitations();
  };

  return { invitations, isLoading, error, refresh: fetchInvitations, createInvitation, resend, revoke };
}
