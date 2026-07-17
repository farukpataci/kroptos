'use client';

import { useState, useEffect } from 'react';
import { apiFetch } from '@/lib/api';

interface TwoFactorSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function TwoFactorSetupModal({ isOpen, onClose, onSuccess }: TwoFactorSetupModalProps) {
  const [step, setStep] = useState(1);
  const [secret, setSecret] = useState('');
  const [qrCode, setQrCode] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setStep(1);
      setSecret('');
      setQrCode('');
      setCode('');
      setError('');
      loadSetupData();
    }
  }, [isOpen]);

  const loadSetupData = async () => {
    setIsLoading(true);
    try {
      const data = await apiFetch<any>('/profile/2fa/setup', { method: 'POST' });
      setSecret(data.secret);
      setQrCode(data.qrCode);
      setStep(2);
    } catch (err: any) {
      setError(err.message || 'Failed to initialize 2FA setup');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyAndEnable = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      await apiFetch<any>('/profile/2fa/enable', {
        method: 'POST',
        body: JSON.stringify({ secret, code }),
      });
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Invalid verification code');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-fade-in backdrop-blur-sm">
      <div className="w-full max-w-md bg-white rounded-2xl p-6 shadow-xl border border-gray-100">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg font-bold text-gray-900">Setup Two-Factor Authentication (2FA)</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            ✕
          </button>
        </div>

        {error && (
          <div className="rounded-lg bg-red-50 p-3 text-xs font-semibold text-red-700 mb-4">
            {error}
          </div>
        )}

        {step === 1 && isLoading && (
          <div className="flex flex-col items-center justify-center py-12 space-y-3">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            <p className="text-sm text-gray-500">Initializing 2FA context...</p>
          </div>
        )}

        {step === 2 && (
          <form onSubmit={handleVerifyAndEnable} className="space-y-6">
            <div className="space-y-4">
              <p className="text-sm text-gray-500">
                1. Scan this QR code using Google Authenticator, Authy, or another TOTP app:
              </p>
              <div className="flex justify-center border border-gray-100 rounded-xl p-3 bg-gray-50 max-w-[220px] mx-auto">
                {qrCode ? (
                  <img src={qrCode} alt="2FA QR Code" className="w-[200px] h-[200px]" />
                ) : (
                  <div className="w-[200px] h-[200px] bg-gray-200 animate-pulse rounded-lg"></div>
                )}
              </div>

              <div className="text-center">
                <span className="text-xs text-gray-400 block mb-1">Or enter this secret key manually:</span>
                <code className="text-sm font-mono font-bold bg-gray-100 px-3 py-1 rounded border text-indigo-700 tracking-wider">
                  {secret}
                </code>
              </div>

              <div className="border-t border-gray-100 pt-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  2. Enter the 6-digit verification code from your authenticator app:
                </label>
                <input
                  type="text"
                  maxLength={6}
                  required
                  placeholder="123456"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  className="w-full rounded-lg border-gray-200 text-center font-mono text-xl tracking-[0.3em] font-bold shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-semibold rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isLoading}
                className="px-4 py-2 text-sm font-semibold rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {isLoading ? 'Verifying...' : 'Enable 2FA'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
