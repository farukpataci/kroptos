'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { apiFetch } from './api';

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role?: string | null;
  /**
   * Whether this user may manage distributor firms. Decided by the API, not
   * here — the flag only drives what the UI offers; every agency write is
   * re-checked server-side.
   */
  isPlatformAdmin?: boolean;
  /** Aktif baglamdaki etkin izinler (/auth/me). JWT'den DEGIL. */
  permissions?: string[];
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
  /**
   * Aktif baglamin izinleri; null = henuz yuklenmedi (usePermission fail-closed).
   * accessibleTenants icindeki eslesen girdiden turetilir (baglam degisince aninda),
   * eslesen yoksa user.permissions.
   */
  permissions: string[] | null;
  refreshUserProfile: () => Promise<void>;
  /** Sunucudan gelen oturum yanitini (login / davet kabulu) baglama uygular. */
  applySession: (data: AuthResponse) => void;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken?: string;
  user: User;
  agencies?: any[];
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [accessibleTenants, setAccessibleTenants] = useState<any[]>([]);
  const [permissionsLoaded, setPermissionsLoaded] = useState(false);
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

  // Varsayılan bağlam: JWT'nin kapsamıyla (storeId > clientId > agencyId) eşleşen
  // girdi, yoksa listedeki ilk girdi. Eskiden hep agencies[0] seçiliyordu; mağaza
  // kapsamlı kullanıcıda bu ajans girdisiydi ve her istek 403'e düşüyordu.
  const pickDefaultTenant = (tenants: any[], token: string | null): TenantContext | null => {
    if (!tenants?.length) return null;
    let claims: any = {};
    try {
      claims = JSON.parse(atob(token!.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    } catch (_) {}
    const match =
      (claims.storeId && tenants.find((t) => t.storeId === claims.storeId)) ||
      (claims.clientId && tenants.find((t) => t.clientId === claims.clientId && !t.storeId)) ||
      (claims.agencyId && tenants.find((t) => t.agencyId === claims.agencyId && !t.clientId && !t.storeId)) ||
      tenants[0];
    return { agencyId: match.agencyId || match.id, clientId: match.clientId || null, storeId: match.storeId || null };
  };

  // Restore session and active context from storage on mount
  useEffect(() => {
    const restoreAuth = async () => {
      const stored = localStorage.getItem('auth');
      if (stored) {
        let storedToken: string | null = null;
        try {
          const parsed = JSON.parse(stored);
          storedToken = parsed.accessToken;
          setUser(parsed.user);
          setAccessToken(storedToken);

          // Get active tenant context from storage
          const storedTenant = localStorage.getItem('selected_tenant');
          if (storedTenant) {
            setTenantContextState(JSON.parse(storedTenant));
          }

          // Fetch fresh profile info & accessible tenant contexts
          let meData: any;
          try {
            meData = await apiFetch<any>('/auth/me');
          } catch (error: any) {
            // 401 apiFetch içinde ele alınır (auth silinir, login'e gider) ve
            // 'Unauthorized' ile fırlar. Başka her şey — tipik olarak saklı
            // bağlamın 403'ü — oturumu SİLMEZ: bozuk bağlamı düşür, bağlamsız
            // tekrar dene; o da olmazsa kullanıcı seçim ekranında seçsin.
            if (error?.message === 'Unauthorized') throw error;
            console.warn('Stored tenant context rejected, retrying /auth/me without it:', error?.message);
            localStorage.removeItem('selected_tenant');
            setTenantContextState({ agencyId: null, clientId: null, storeId: null });
            try {
              meData = await apiFetch<any>('/auth/me');
            } catch (retryError: any) {
              if (retryError?.message === 'Unauthorized') throw retryError;
              window.location.href = '/select-tenant';
              return;
            }
          }
          setUser(meData.user);
          setAccessibleTenants(meData.accessibleTenants);
          setPermissionsLoaded(true);

          // Initialize context default if none chosen (or just dropped)
          if (!localStorage.getItem('selected_tenant')) {
            const def = pickDefaultTenant(meData.accessibleTenants, storedToken);
            if (def) setTenantContext(def);
          }
        } catch (error: any) {
          console.error('Failed to restore auth profile:', error);
          // Yalnız 401'de (ya da saklı kayıt bozuksa) temizle.
          if (error?.message === 'Unauthorized' || !storedToken) {
            localStorage.removeItem('auth');
            localStorage.removeItem('selected_tenant');
          }
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
      setPermissionsLoaded(true);
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

    applySession(await response.json());
  };

  // Login ve davet kabulu ayni yanit seklini verir; ikisi de buradan gecer ki
  // varsayilan baglam hep pickDefaultTenant ile secilsin (P2.6 kilitlenmesi).
  const applySession = (data: AuthResponse) => {
    setUser(data.user);
    setAccessToken(data.accessToken);
    localStorage.setItem('auth', JSON.stringify({ user: data.user, accessToken: data.accessToken }));
    setAccessibleTenants(data.agencies || []);
    setPermissionsLoaded(true);
    const def = pickDefaultTenant(data.agencies || [], data.accessToken);
    if (def) setTenantContext(def);
    // Refresh profile in background without blocking navigation
    refreshUserProfile().catch(console.error);
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
    // Sıra kritik: önce token, sonra bağlam. Tersi çalışmıyor çünkü apiFetch
    // x-agency-id'yi selected_tenant'tan okuyor; bağlamı önce yazarsak istek
    // YENİ ajans header'ı + ESKİ JWT ile gider ve TenantMiddleware bunu
    // "tenant context mismatch" diye 403'ler. Yani ajans değiştirmek
    // yapısal olarak imkânsız hale geliyordu. Bu çağrı hâlâ eski bağlamın
    // header'larıyla gittiği için middleware'in eşitlik kontrolünden geçiyor.
    const tokens = await apiFetch<{ accessToken: string; refreshToken: string }>('/auth/switch-tenant', {
      method: 'POST',
      body: JSON.stringify({ agencyId, clientId, storeId }),
    });

    // Önce token'ı yaz: bundan sonra atılacak her istek yeni bağlamın
    // header'larını taşıyacak ve onlara eşlik eden JWT hazır olmalı.
    setAccessToken(tokens.accessToken);
    const stored = localStorage.getItem('auth');
    if (stored) {
      const parsed = JSON.parse(stored);
      parsed.accessToken = tokens.accessToken;
      localStorage.setItem('auth', JSON.stringify(parsed));
    }

    setTenantContext({ agencyId, clientId, storeId });
    // Izinler accessibleTenants'tan turetildigi icin aninda guncellenir; taze liste arka planda.
    refreshUserProfile().catch(console.error);
  };


  const logout = () => {
    setUser(null);
    setAccessToken(null);
    setAccessibleTenants([]);
    setPermissionsLoaded(false);
    setTenantContextState({ agencyId: null, clientId: null, storeId: null });
    localStorage.removeItem('auth');
    localStorage.removeItem('selected_tenant');
  };

  // Aktif baglamin izinleri: accessibleTenants'taki eslesen girdi (switchTenant sonrasi
  // ek istek gerekmez), yoksa user.permissions. Yuklenmediyse null -> can() false.
  const permissions: string[] | null = !permissionsLoaded
    ? null
    : (accessibleTenants.find((t: any) =>
        (t.agencyId || t.id) === tenantContext.agencyId &&
        (t.clientId || null) === (tenantContext.clientId || null) &&
        (t.storeId || null) === (tenantContext.storeId || null),
      )?.permissions ?? user?.permissions ?? []);

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
        permissions,
        refreshUserProfile,
        applySession,
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
