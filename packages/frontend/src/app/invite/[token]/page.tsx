'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { ArrowPathIcon, CheckCircleIcon, ExclamationTriangleIcon, ShieldCheckIcon } from '@heroicons/react/24/outline';
import { PASSWORD_MIN_LENGTH, passwordProblem } from '@kroptos/shared';
import { useAuth, type AuthResponse } from '@/lib/auth-context';

/**
 * Tenant DISI public rota: /invite/[token]. Oturum zorunlulugu YOK; token path
 * param'da kalir, localStorage/query'ye tasinmaz. Hata durumlarinda e-posta ve
 * ajans adi GOSTERILMEZ (davetin varligi sizmaz).
 */
interface Preview {
  email: string;
  agency: { name: string; publicId: string | null };
  role: { key: string; name: string } | null;
  storeId: string | null;
  clientId: string | null;
  expiresAt: string;
  userExists: boolean;
}

type State =
  | { kind: 'loading' }
  | { kind: 'ready'; preview: Preview }
  | { kind: 'gone' } // 410: suresi gecmis / iptal / kullanilmis
  | { kind: 'error' }; // bulunamadi / ag hatasi -> generic

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

export default function InvitePage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const t = useTranslations('invite');
  const tc = useTranslations('common');
  const { user, isAuthenticated, isLoading: authLoading, applySession, logout } = useAuth();

  const [state, setState] = useState<State>({ kind: 'loading' });
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API}/invitations/${encodeURIComponent(token)}`);
        if (cancelled) return;
        if (res.ok) setState({ kind: 'ready', preview: await res.json() });
        else if (res.status === 410) setState({ kind: 'gone' });
        else setState({ kind: 'error' });
      } catch {
        if (!cancelled) setState({ kind: 'error' });
      }
    })();
    return () => { cancelled = true; };
  }, [token]);

  const preview = state.kind === 'ready' ? state.preview : null;
  const needsPassword = !!preview && !preview.userExists;
  const pwProblem = needsPassword ? passwordProblem(password) : null;
  const pwMismatch = needsPassword && password2.length > 0 && password !== password2;
  // Giris yapmis biri baska hesabin davetine tikladiysa: acikca soyle, oturumu sessizce degistirme.
  const otherAccount = !!preview && isAuthenticated && !!user?.email && user.email.toLowerCase() !== preview.email.toLowerCase();

  const accept = async () => {
    if (!preview || submitting) return; // cift tiklama: ikinci accept 410 uretmesin
    if (needsPassword && (pwProblem || password !== password2)) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch(`${API}/invitations/${encodeURIComponent(token)}/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(needsPassword ? { password, firstName: firstName.trim() || undefined, lastName: lastName.trim() || undefined } : {}),
      });
      if (res.status === 410) { setState({ kind: 'gone' }); return; }
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setSubmitError(body?.message || tc('unknownError'));
        return;
      }
      const data: AuthResponse = await res.json();
      // P2.6: varsayilan baglam pickDefaultTenant ile (applySession icinde) - magaza kapsamli
      // davetli "ilk girdi = ajans" tuzagina dusmesin.
      applySession(data);
      setDone(true);
      const tenants = data.agencies ?? [];
      if (tenants.length === 1) {
        const only = tenants[0];
        router.replace(`/t/${only.publicId || `tn_${only.id}`}/dashboard`);
      } else {
        router.replace('/select-tenant');
      }
    } catch {
      setSubmitError(tc('unknownError'));
    } finally {
      setSubmitting(false);
    }
  };

  const shell = (children: React.ReactNode) => (
    <div className="flex min-h-screen flex-col md:flex-row bg-kp-bg-primary text-kp-text-primary">
      <div className="flex flex-1 flex-col justify-between p-8 sm:p-12 md:p-16 lg:max-w-2xl xl:max-w-3xl">
        <Link href="/auth/login" className="inline-flex items-center gap-2 text-sm font-medium text-kp-text-tertiary hover:text-kp-text-primary transition-colors">
          ← {t('backToLogin')}
        </Link>
        <div className="mx-auto my-auto w-full max-w-md py-12">{children}</div>
        <p className="text-xs text-kp-text-tertiary">© {new Date().getFullYear()} KroptOS</p>
      </div>
      <div className="hidden md:flex flex-1 items-center justify-center bg-kp-accent text-white p-16">
        <div className="max-w-md space-y-4">
          <ShieldCheckIcon className="h-12 w-12 opacity-90" />
          <h1 className="text-4xl font-black tracking-tight">KroptOS</h1>
          <p className="text-sm opacity-80">{t('sideText')}</p>
        </div>
      </div>
    </div>
  );

  if (state.kind === 'loading' || authLoading) {
    return shell(<div className="flex items-center gap-3 text-sm text-kp-text-tertiary"><ArrowPathIcon className="h-4 w-4 animate-spin" /> {t('checking')}</div>);
  }

  if (state.kind === 'gone') {
    return shell(
      <div className="space-y-4">
        <ExclamationTriangleIcon className="h-10 w-10 text-amber-400" />
        <h2 className="text-2xl font-bold">{t('goneTitle')}</h2>
        <p className="text-sm text-kp-text-secondary">{t('goneDesc')}</p>
        <Link href="/auth/login" className="inline-block rounded-kp-md bg-kp-accent px-4 py-2 text-sm font-semibold text-white hover:bg-kp-accent-hover">{t('goToLogin')}</Link>
      </div>,
    );
  }

  if (state.kind === 'error' || !preview) {
    return shell(
      <div className="space-y-4">
        <ExclamationTriangleIcon className="h-10 w-10 text-kp-danger" />
        <h2 className="text-2xl font-bold">{t('errorTitle')}</h2>
        <p className="text-sm text-kp-text-secondary">{t('errorDesc')}</p>
        <Link href="/auth/login" className="inline-block rounded-kp-md bg-kp-accent px-4 py-2 text-sm font-semibold text-white hover:bg-kp-accent-hover">{t('goToLogin')}</Link>
      </div>,
    );
  }

  if (done) {
    return shell(<div className="flex items-center gap-3 text-sm text-kp-success"><CheckCircleIcon className="h-5 w-5" /> {t('accepted')}</div>);
  }

  if (otherAccount) {
    return shell(
      <div className="space-y-5">
        <h2 className="text-2xl font-bold">{t('otherAccountTitle')}</h2>
        <p className="text-sm text-kp-text-secondary">
          {t.rich('otherAccountDesc', { current: user!.email, invited: preview.email, strong: (c) => <strong className="text-kp-text-primary">{c}</strong> })}
        </p>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => logout()}
            className="rounded-kp-md bg-kp-accent px-4 py-2 text-sm font-semibold text-white hover:bg-kp-accent-hover"
          >
            {t('logoutAndContinue')}
          </button>
          <Link href="/select-tenant" className="rounded-kp-md border border-kp-border px-4 py-2 text-sm font-semibold text-kp-text-secondary hover:text-kp-text-primary">{tc('actions.cancel')}</Link>
        </div>
      </div>,
    );
  }

  const inputCls = 'w-full rounded-kp-md border border-kp-border bg-kp-bg-secondary px-3 py-2 text-sm text-kp-text-primary focus:outline-hidden focus:border-kp-accent';
  return shell(
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">{t('title')}</h2>
        <p className="mt-3 text-sm text-kp-text-secondary leading-relaxed">
          {t.rich('invitedTo', { agency: preview.agency.name, role: preview.role?.name ?? '—', strong: (c) => <strong className="text-kp-text-primary">{c}</strong> })}
        </p>
        <p className="mt-1 text-xs text-kp-text-tertiary">{preview.email}</p>
      </div>

      {submitError && (
        <div className="rounded-kp-md bg-kp-danger/10 border border-kp-danger/20 p-3 text-xs font-medium text-kp-danger">{submitError}</div>
      )}

      {needsPassword ? (
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); accept(); }}>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[0.6875rem] font-bold uppercase tracking-wider text-kp-text-tertiary">{t('firstName')}</label>
              <input value={firstName} onChange={(e) => setFirstName(e.target.value)} className={inputCls} autoComplete="given-name" />
            </div>
            <div className="space-y-1">
              <label className="text-[0.6875rem] font-bold uppercase tracking-wider text-kp-text-tertiary">{t('lastName')}</label>
              <input value={lastName} onChange={(e) => setLastName(e.target.value)} className={inputCls} autoComplete="family-name" />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-[0.6875rem] font-bold uppercase tracking-wider text-kp-text-tertiary">{t('password')}</label>
            <input type="password" required minLength={PASSWORD_MIN_LENGTH} value={password} onChange={(e) => setPassword(e.target.value)} className={inputCls} autoComplete="new-password" />
            <p className={`text-[0.6875rem] ${password && pwProblem ? 'text-kp-danger' : 'text-kp-text-tertiary'}`}>{t('passwordRule', { min: PASSWORD_MIN_LENGTH })}</p>
          </div>
          <div className="space-y-1">
            <label className="text-[0.6875rem] font-bold uppercase tracking-wider text-kp-text-tertiary">{t('passwordRepeat')}</label>
            <input type="password" required value={password2} onChange={(e) => setPassword2(e.target.value)} className={inputCls} autoComplete="new-password" />
            {pwMismatch && <p className="text-[0.6875rem] text-kp-danger">{t('passwordMismatch')}</p>}
          </div>
          <button type="submit" disabled={submitting || !!pwProblem || password !== password2} className="flex w-full items-center justify-center gap-2 rounded-kp-md bg-kp-accent px-4 py-2.5 text-sm font-semibold text-white hover:bg-kp-accent-hover disabled:opacity-50">
            {submitting && <ArrowPathIcon className="h-4 w-4 animate-spin" />}
            {t('createAndJoin')}
          </button>
        </form>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-kp-text-secondary">{t('existingUserNote')}</p>
          <button type="button" onClick={accept} disabled={submitting} className="flex w-full items-center justify-center gap-2 rounded-kp-md bg-kp-accent px-4 py-2.5 text-sm font-semibold text-white hover:bg-kp-accent-hover disabled:opacity-50">
            {submitting && <ArrowPathIcon className="h-4 w-4 animate-spin" />}
            {t('join')}
          </button>
        </div>
      )}
    </div>,
  );
}
