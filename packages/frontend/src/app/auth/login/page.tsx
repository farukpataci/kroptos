'use client';

import { useAuth } from '@/lib/auth-context';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import Link from 'next/link';

export default function LoginPage() {
  const { login, user, isLoading } = useAuth();
  const router = useRouter();
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const t = useTranslations('login');

  const navigateToDashboardOrTenant = () => {
    if (typeof window !== 'undefined') {
      const storedTenant = localStorage.getItem('selected_tenant');
      if (storedTenant) {
        try {
          const parsed = JSON.parse(storedTenant);
          const agencyId = parsed.agencyId;
          if (agencyId) {
            router.replace(`/t/tn_${agencyId}/dashboard`);
            return;
          }
        } catch {}
      }
    }
    router.replace('/select-tenant');
  };

  useEffect(() => {
    if (!isLoading && user) {
      navigateToDashboardOrTenant();
    }
  }, [user, isLoading]);

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    const formData = new FormData(e.currentTarget);
    const emailVal = (formData.get('email') as string) || '';
    const passwordVal = (formData.get('password') as string) || '';

    try {
      await login(emailVal, passwordVal);
      if (rememberMe) {
        localStorage.setItem('remember_email', emailVal);
      } else {
        localStorage.removeItem('remember_email');
      }
      navigateToDashboardOrTenant();
    } catch (err: any) {
      setError(err.message || 'Invalid email or password');
      setSubmitting(false);
    }
  };

  // If restoring auth session, show a premium layout loader
  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F9FAFB]">
        <div className="flex flex-col items-center gap-2">
          <p className="text-2xl font-black tracking-wide text-[#171B59] animate-pulse">Alqora</p>
          <p className="text-xs font-semibold text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col md:flex-row bg-white text-gray-900">
      
      {/* LEFT COLUMN (Login Form) - 50% width, strictly white background */}
      <div className="flex flex-1 flex-col justify-between p-8 sm:p-12 md:p-16 lg:max-w-2xl xl:max-w-3xl bg-white text-gray-900">
        
        {/* Back Button */}
        <div>
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors"
          >
            <span>←</span> {t('backToWebsite')}
          </Link>
        </div>

        {/* Center: Login Form content */}
        <div className="mx-auto my-auto w-full max-w-md py-12">
          <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
            {t('welcomeBack')}
          </h2>
          <p className="mt-3 text-sm text-gray-500 leading-relaxed">
            {t('subtitle')}
          </p>

          <form className="mt-8 space-y-5" onSubmit={handleLogin}>
            {error && (
              <div className="rounded-[12px] bg-red-50 border border-red-200 p-4 text-xs font-medium text-red-700 animate-shake">
                {error}
              </div>
            )}

            <div>
              <label htmlFor="email" className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5">
                {t('emailLabel')}
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                defaultValue={typeof window !== 'undefined' ? localStorage.getItem('remember_email') || '' : ''}
                className="block w-full rounded-[12px] border border-gray-200 bg-white text-gray-900 px-4 py-3 text-sm shadow-sm focus:border-[#171B59] focus:outline-none focus:ring-1 focus:ring-[#171B59] transition-all"
                placeholder="name@company.com"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5">
                {t('passwordLabel')}
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className="block w-full rounded-[12px] border border-gray-200 bg-white text-gray-900 px-4 py-3 text-sm shadow-sm focus:border-[#171B59] focus:outline-none focus:ring-1 focus:ring-[#171B59] transition-all"
                placeholder="••••••••"
              />
            </div>

            <div className="flex items-center justify-between text-xs font-medium">
              <label className="flex items-center gap-2 cursor-pointer select-none text-gray-600">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-[#171B59] focus:ring-[#171B59]"
                />
                <span>{t('rememberMe')}</span>
              </label>

              <Link
                href="/auth/forgot-password"
                className="text-[#171B59] hover:underline"
              >
                {t('forgotPassword')}
              </Link>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="flex w-full justify-center items-center gap-2 rounded-[12px] bg-[#171B59] hover:bg-[#0f113a] px-4 py-3 text-sm font-semibold text-white shadow transition-all duration-200 disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  <span>{t('signingInButton')}</span>
                </>
              ) : (
                <span>{t('signInButton')}</span>
              )}
            </button>
          </form>

          {/* Social Logins */}
          <div className="mt-8">
            <div className="relative flex items-center justify-center">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-200"></div>
              </div>
              <span className="relative bg-white px-4 text-xs font-medium text-gray-400">
                {t('orSignInWith')}
              </span>
            </div>

            <div className="mt-6 grid grid-cols-3 gap-3">
              {/* Google */}
              <button
                type="button"
                className="flex items-center justify-center gap-2 rounded-[12px] border border-gray-200 bg-white py-2.5 text-xs font-semibold text-gray-600 shadow-sm hover:bg-gray-50 transition-colors"
                title="Google"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24">
                  <path fill="#EA4335" d="M12 5.04c1.62 0 3.08.56 4.22 1.65l3.15-3.15C17.45 1.77 14.93 1 12 1 7.37 1 3.4 3.63 1.45 7.45l3.82 2.96C6.18 7.33 8.87 5.04 12 5.04z" />
                  <path fill="#4285F4" d="M23.49 12.27c0-.81-.07-1.59-.2-2.36H12v4.51h6.46c-.28 1.47-1.11 2.72-2.36 3.56l3.67 2.84c2.15-1.98 3.38-4.9 3.38-8.55z" />
                  <path fill="#FBBC05" d="M5.27 14.51c-.24-.72-.38-1.49-.38-2.28s.14-1.56.38-2.28L1.45 7.45C.52 9.27 0 11.29 0 12.43s.52 3.16 1.45 4.98l3.82-2.9z" />
                  <path fill="#34A853" d="M12 23c3.24 0 5.97-1.07 7.96-2.91l-3.67-2.84c-1.1.74-2.51 1.18-4.29 1.18-3.13 0-5.82-2.29-6.73-5.37L1.45 15.99C3.4 19.82 7.37 22.43 12 22.43z" />
                </svg>
                <span className="hidden sm:inline">Google</span>
              </button>

              {/* Microsoft */}
              <button
                type="button"
                className="flex items-center justify-center gap-2 rounded-[12px] border border-gray-200 bg-white py-2.5 text-xs font-semibold text-gray-600 shadow-sm hover:bg-gray-50 transition-colors"
                title="Microsoft"
              >
                <svg className="h-4 w-4" viewBox="0 0 23 23">
                  <path fill="#f35325" d="M0 0h11v11H0z" />
                  <path fill="#80a300" d="M12 0h11v11H12z" />
                  <path fill="#00a1f1" d="M0 12h11v11H0z" />
                  <path fill="#ffb900" d="M12 12h11v11H12z" />
                </svg>
                <span className="hidden sm:inline">Microsoft</span>
              </button>

              {/* Apple */}
              <button
                type="button"
                className="flex items-center justify-center gap-2 rounded-[12px] border border-gray-200 bg-white py-2.5 text-xs font-semibold text-gray-600 shadow-sm hover:bg-gray-50 transition-colors"
                title="Apple"
              >
                <svg className="h-4 w-4 fill-current text-gray-900" viewBox="0 0 24 24">
                  <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-.1 3.81 1.5 1.28 1.05 2.25 2.5 2.25 4.9-2.07.86-2.5 3.51-.43 4.95-.8 1.24-1.8 2.31-3.03 3.4M15.97 4.17c.66-.81 1.11-1.93.99-3.06-1 .04-2.22.67-2.94 1.5-.63.73-1.19 1.87-1.04 2.98 1.1.09 2.23-.55 2.99-1.42" />
                </svg>
                <span className="hidden sm:inline">Apple</span>
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center text-xs font-medium text-gray-400 py-4">
          <span>{t('noAccount')}{' '}</span>
          <Link
            href="/auth/register"
            className="text-[#171B59] hover:underline font-semibold"
          >
            {t('registerLink')}
          </Link>
        </div>

      </div>

      {/* RIGHT COLUMN (Enterprise Branding Pane) - 50% width, hidden on mobile */}
      <div className="hidden lg:flex flex-1 flex-col justify-between bg-[#171B59] text-[#E4E7EC] p-16 relative overflow-hidden">
        {/* Subtle grid and geometric squares patterns */}
        <div className="absolute inset-0 opacity-10 bg-[linear-gradient(to_right,#ffffff_1px,transparent_1px),linear-gradient(to_bottom,#ffffff_1px,transparent_1px)] bg-[size:40px_40px]"></div>
        <div className="absolute top-[20%] left-[10%] h-[300px] w-[300px] rounded-full bg-blue-500/20 blur-[120px] pointer-events-none"></div>
        <div className="absolute bottom-[20%] right-[10%] h-[300px] w-[300px] rounded-full bg-indigo-500/20 blur-[120px] pointer-events-none"></div>

        {/* Top: Small tag */}
        <div className="flex justify-end z-10">
          <span className="rounded-full bg-white/10 px-3.5 py-1 text-xs font-medium border border-white/5 uppercase tracking-wider backdrop-blur-md">
            WMS Platform
          </span>
        </div>

        {/* Middle: Brand and slogan */}
        <div className="my-auto max-w-xl z-10 space-y-6">
          <h1 className="text-5xl sm:text-6xl font-extrabold tracking-tight text-white Outfit">
            Alqora
          </h1>
          <p className="text-lg font-medium text-white/90">
            {t('enterpriseWms')}
          </p>
          <div className="h-px bg-white/10 my-4"></div>
          <p className="text-sm font-medium text-white/70 tracking-wide leading-relaxed">
            {t('wmsSlogan')}
          </p>
        </div>

        {/* Bottom Slogan */}
        <div className="flex items-center justify-between text-xs font-medium text-white/50 z-10 border-t border-white/10 pt-6">
          <span>{t('builtForHighVolume')}</span>
          <span>© {new Date().getFullYear()}</span>
        </div>

      </div>

    </div>
  );
}
