'use client';

import { useState } from 'react';
import { ChangePasswordModal } from './ChangePasswordModal';
import { TwoFactorSetupModal } from './TwoFactorSetupModal';
import { ConfirmActionModal } from './ConfirmActionModal';
import { KeyIcon, ShieldCheckIcon } from '@heroicons/react/24/outline';
import { apiFetch } from '@/lib/api';

interface SecurityCardProps {
  profile: any;
  onRefresh: () => Promise<void>;
  onChangePassword: (data: any) => Promise<void>;
}

export function SecurityCard({ profile, onRefresh, onChangePassword }: SecurityCardProps) {
  const [isPasswordOpen, setIsPasswordOpen] = useState(false);
  const [is2faSetupOpen, setIs2faSetupOpen] = useState(false);
  const [isDisableConfirmOpen, setIsDisableConfirmOpen] = useState(false);

  const handle2faToggle = () => {
    if (profile.twoFactorEnabled) {
      setIsDisableConfirmOpen(true);
    } else {
      setIs2faSetupOpen(true);
    }
  };

  const handleDisable2fa = async () => {
    try {
      await apiFetch('/profile/2fa/disable', { method: 'POST' });
      await onRefresh();
    } catch (err) {
      console.error(err);
    }
  };

  const handle2faSuccess = async () => {
    await onRefresh();
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
      <div className="mb-6">
        <h3 className="text-lg font-bold text-gray-900">Security Settings</h3>
        <p className="text-xs text-gray-500 mt-0.5">Control your account credentials and multi-factor authentication.</p>
      </div>

      <div className="divide-y divide-gray-100 space-y-4">
        {/* Change Password row */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 gap-4">
          <div className="flex items-start gap-3">
            <KeyIcon className="w-5 h-5 text-gray-400 mt-0.5" />
            <div>
              <h4 className="text-sm font-bold text-gray-900">Change Password</h4>
              <p className="text-xs text-gray-500 mt-0.5">Receive real-time notifications and team alerts.</p>
            </div>
          </div>
          <button
            onClick={() => setIsPasswordOpen(true)}
            className="sm:w-auto w-full inline-flex justify-center px-4 py-2 text-xs font-semibold rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Change Password
          </button>
        </div>

        {/* 2FA row */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pt-4 gap-4">
          <div className="flex items-start gap-3">
            <ShieldCheckIcon className="w-5 h-5 text-gray-400 mt-0.5" />
            <div>
              <h4 className="text-sm font-bold text-gray-900">Two-factor authentication (2FA)</h4>
              <p className="text-xs text-gray-500 mt-0.5">Keep your account secure by enabling 2FA.</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className={`text-xs font-semibold ${profile.twoFactorEnabled ? 'text-emerald-600' : 'text-gray-400'}`}>
              {profile.twoFactorEnabled ? 'Enabled' : 'Disabled'}
            </span>
            <button
              onClick={handle2faToggle}
              className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                profile.twoFactorEnabled ? 'bg-indigo-600' : 'bg-gray-200'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  profile.twoFactorEnabled ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>
      </div>

      <ChangePasswordModal
        isOpen={isPasswordOpen}
        onClose={() => setIsPasswordOpen(false)}
        onSave={onChangePassword}
      />

      <TwoFactorSetupModal
        isOpen={is2faSetupOpen}
        onClose={() => setIs2faSetupOpen(false)}
        onSuccess={handle2faSuccess}
      />

      <ConfirmActionModal
        isOpen={isDisableConfirmOpen}
        onClose={() => setIsDisableConfirmOpen(false)}
        onConfirm={handleDisable2fa}
        title="Disable Two-Factor Authentication"
        message="Are you sure you want to disable 2FA? This will reduce the security level of your account."
        confirmText="Disable 2FA"
        isDanger={true}
      />
    </div>
  );
}
