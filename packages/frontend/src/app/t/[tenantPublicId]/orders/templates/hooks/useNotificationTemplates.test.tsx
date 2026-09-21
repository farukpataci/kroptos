import { act, renderHook, waitFor } from '@testing-library/react';
import { apiFetch } from '@/lib/api';
import { useNotificationTemplates } from './useNotificationTemplates';

jest.mock('@/lib/api', () => ({ apiFetch: jest.fn() }));
const tenant = { agencyId: 'A', clientId: null as string | null, storeId: null as string | null };
jest.mock('@/lib/auth-context', () => ({ useAuth: () => ({ tenantContext: tenant }) }));

const mocked = apiFetch as jest.Mock;

describe('useNotificationTemplates', () => {
  beforeEach(() => {
    mocked.mockReset();
    mocked.mockResolvedValue({ items: [{ id: 'sys:EMAIL:ORDER_CREATED:tr', resolvedFrom: 'SYSTEM' }], level: 'AGENCY', locales: ['tr', 'en'] });
  });

  it('loads the matrix with the default filters and exposes the editing level', async () => {
    const { result } = renderHook(() => useNotificationTemplates());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(mocked).toHaveBeenCalledWith('/api/notification-templates?locale=tr');
    expect(result.current.level).toBe('AGENCY');
    expect(result.current.items).toHaveLength(1);
  });

  it('re-queries when a filter changes and passes it as a query param', async () => {
    const { result } = renderHook(() => useNotificationTemplates());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    act(() => result.current.setFilters((f) => ({ ...f, channel: 'SMS', search: 'kargo' })));
    await waitFor(() => expect(mocked).toHaveBeenLastCalledWith('/api/notification-templates?channel=SMS&locale=tr&search=kargo'));
  });

  it('surfaces a 403 as an error instead of an empty table', async () => {
    mocked.mockRejectedValueOnce(new Error('Forbidden'));
    const { result } = renderHook(() => useNotificationTemplates());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.error).toBe('Forbidden');
    expect(result.current.items).toEqual([]);
  });

  it('preview and testSend post the body to the right endpoints', async () => {
    const { result } = renderHook(() => useNotificationTemplates());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    await result.current.preview({ channel: 'EMAIL', event: 'ORDER_CREATED', subject: 'x' });
    expect(mocked).toHaveBeenLastCalledWith('/api/notification-templates/preview', expect.objectContaining({ method: 'POST', body: JSON.stringify({ channel: 'EMAIL', event: 'ORDER_CREATED', subject: 'x' }) }));
    await result.current.testSend('t1', { recipient: 'a@b.c' });
    expect(mocked).toHaveBeenLastCalledWith('/api/notification-templates/t1/test-send', expect.objectContaining({ method: 'POST' }));
  });
});
