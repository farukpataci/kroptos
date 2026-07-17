'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { apiFetch } from './api';

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
}

interface TenantContext {
  agencyId: string | null;
  clientId: string | null;
  storeId: string | null;
}

interface AuthContextType {
  user: User | null;
  accessToken: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, firstName: string, lastName: string, agencyName: string) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
  tenantContext: TenantContext;
  setTenantContext: (context: TenantContext) => void;
  switchTenant: (agencyId: string, clientId: string | null, storeId: string | null) => Promise<void>;
  accessibleTenants: any[];
  refreshUserProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [accessibleTenants, setAccessibleTenants] = useState<any[]>([]);
  const [tenantContext, setTenantContextState] = useState<TenantContext>({
    agencyId: null,
    clientId: null,
    storeId: null,
  });

  // Helper to update active tenant context in state and localStorage
  const setTenantContext = (ctx: TenantContext) => {
    setTenantContextState(ctx);
    if (typeof window !== 'undefined') {
      localStorage.setItem('selected_tenant', JSON.stringify(ctx));
    }
  };

  // Restore session and active context from storage on mount
  useEffect(() => {
    const restoreAuth = async () => {
      const stored = localStorage.getItem('auth');
      if (stored) {
        try {
          const { user: storedUser, accessToken: storedToken } = JSON.parse(stored);
          setUser(storedUser);
          setAccessToken(storedToken);

          // Get active tenant context from storage
          const storedTenant = localStorage.getItem('selected_tenant');
          if (storedTenant) {
            setTenantContextState(JSON.parse(storedTenant));
          }

          // Fetch fresh profile info & accessible tenant contexts
          const meData = await apiFetch<any>('/auth/me');
          setUser(meData.user);
          setAccessibleTenants(meData.accessibleTenants);

          // Initialize context default if none chosen
          if (!storedTenant && meData.accessibleTenants?.length > 0) {
            const first = meData.accessibleTenants[0];
            setTenantContext({
              agencyId: first.agencyId,
              clientId: first.clientId || null,
              storeId: first.storeId || null,
            });
          }
        } catch (error) {
          console.error('Failed to restore auth profile:', error);
          localStorage.removeItem('auth');
          localStorage.removeItem('selected_tenant');
        }
      }
      setIsLoading(false);
    };

    restoreAuth();
  }, []);

  const refreshUserProfile = async () => {
    try {
      const meData = await apiFetch<any>('/auth/me');
      setUser(meData.user);
      setAccessibleTenants(meData.accessibleTenants);
    } catch (e) {
      console.error('Failed to refresh user profile:', e);
    }
  };

  const login = async (email: string, password: string) => {
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) throw new Error('Login failed');

    const data = await response.json();
    setUser(data.user);
    setAccessToken(data.accessToken);
    localStorage.setItem('auth', JSON.stringify({ user: data.user, accessToken: data.accessToken }));

    // Populate accessible tenants
    setAccessibleTenants(data.agencies || []);

    // Set first agency as default context
    if (data.agencies && data.agencies.length > 0) {
      const first = data.agencies[0];
      setTenantContext({
        agencyId: first.id,
        clientId: null,
        storeId: null,
      });
    }
  };

  const register = async (
    email: string,
    password: string,
    firstName: string,
    lastName: string,
    agencyName: string,
  ) => {
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, firstName, lastName, agencyName }),
    });

    if (!response.ok) throw new Error('Registration failed');

    const data = await response.json();
    setUser(data.user);
    setAccessToken(data.accessToken);
    localStorage.setItem('auth', JSON.stringify({ user: data.user, accessToken: data.accessToken }));

    if (data.agencies && data.agencies.length > 0) {
      const first = data.agencies[0];
      setTenantContext({
        agencyId: first.id,
        clientId: null,
        storeId: null,
      });
    }
  };

  const switchTenant = async (agencyId: string, clientId: string | null, storeId: string | null) => {
    // Always update the local context immediately so UI reflects the selection
    setTenantContext({ agencyId, clientId, storeId });

    try {
      const tokens = await apiFetch<{ accessToken: string; refreshToken: string }>('/auth/switch-tenant', {
        method: 'POST',
        body: JSON.stringify({ agencyId, clientId, storeId }),
      });

      // Update stored access tokens only if backend returns new tokens
      setAccessToken(tokens.accessToken);
      const stored = localStorage.getItem('auth');
      if (stored) {
        const parsed = JSON.parse(stored);
        parsed.accessToken = tokens.accessToken;
        localStorage.setItem('auth', JSON.stringify(parsed));
      }
    } catch (err: any) {
      // Backend token refresh failed (e.g. no exact UserRole match),
      // but context is already updated above so UI selection persists.
      // API calls use x-agency-id/x-client-id/x-store-id headers which are
      // set from selected_tenant regardless of JWT content.
      console.warn('Tenant switch token refresh failed (non-fatal):', err?.message);
    }
  };


  const logout = () => {
    setUser(null);
    setAccessToken(null);
    setAccessibleTenants([]);
    setTenantContextState({ agencyId: null, clientId: null, storeId: null });
    localStorage.removeItem('auth');
    localStorage.removeItem('selected_tenant');
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        accessToken,
        isLoading,
        login,
        register,
        logout,
        isAuthenticated: !!user,
        tenantContext,
        setTenantContext,
        switchTenant,
        accessibleTenants,
        refreshUserProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
