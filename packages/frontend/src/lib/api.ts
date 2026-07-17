'use client';

export interface RequestOptions extends RequestInit {
  useTenantHeaders?: boolean;
  params?: Record<string, any>;
}

export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
  
  // Clean paths starting with /api
  const cleanPath = path.startsWith('/api') ? path.substring(4) : path;
  let url = `${baseUrl}${cleanPath}`;

  if (options.params) {
    const searchParams = new URLSearchParams();
    Object.entries(options.params).forEach(([key, val]) => {
      if (val !== undefined && val !== null) {
        searchParams.append(key, String(val));
      }
    });
    const qs = searchParams.toString();
    if (qs) {
      url += (url.includes('?') ? '&' : '?') + qs;
    }
  }

  const headers = new Headers(options.headers || {});
  
  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  // Get active session
  const stored = typeof window !== 'undefined' ? localStorage.getItem('auth') : null;
  let token = '';
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      token = parsed.accessToken;
    } catch (_) {}
  }

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  // Inject tenant context headers if enabled
  if (options.useTenantHeaders !== false) {
    const selectedTenant = typeof window !== 'undefined' ? localStorage.getItem('selected_tenant') : null;
    if (selectedTenant) {
      try {
        const { agencyId, clientId, storeId } = JSON.parse(selectedTenant);
        if (agencyId) headers.set('x-agency-id', agencyId);
        if (clientId) headers.set('x-client-id', clientId);
        if (storeId) headers.set('x-store-id', storeId);
      } catch (_) {}
    }
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    if (
      typeof window !== 'undefined' &&
      window.location.pathname !== '/auth/login' &&
      window.location.pathname !== '/'
    ) {
      localStorage.removeItem('auth');
      window.location.href = '/auth/login';
    }
    throw new Error('Unauthorized');
  }

  if (!response.ok) {
    let errorMessage = `API Request failed (${response.status})`;
    try {
      const errorData = await response.json();
      errorMessage = errorData.message || errorMessage;
    } catch (_) {}

    throw new Error(errorMessage);

  }

  // Support 204 No Content
  if (response.status === 204) {
    return {} as T;
  }

  return response.json() as Promise<T>;
}

export const api = {
  get: <T = any>(url: string, options?: RequestOptions) => apiFetch<T>(url, { ...options, method: 'GET' }),
  post: <T = any>(url: string, body?: any, options?: RequestOptions) => apiFetch<T>(url, { ...options, method: 'POST', body: body ? JSON.stringify(body) : undefined }),
  put: <T = any>(url: string, body?: any, options?: RequestOptions) => apiFetch<T>(url, { ...options, method: 'PUT', body: body ? JSON.stringify(body) : undefined }),
  delete: <T = any>(url: string, options?: RequestOptions) => apiFetch<T>(url, { ...options, method: 'DELETE' }),
};
