'use client';

import { useState } from 'react';
import { ConfirmActionModal } from './ConfirmActionModal';
import { ArrowRightOnRectangleIcon, TrashIcon } from '@heroicons/react/24/outline';
import { apiFetch } from '@/lib/api';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';

export function DangerZoneCard() {
  const toast = useToast();
  const [isLogoutConfirmOpen, setIsLogoutConfirmOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const { logout } = useAuth();
  const router = useRouter();

  const handleLogoutAll = async () => {
    try {
      await apiFetch('/profile/logout-all-devices', {
        method: 'POST',
        body: JSON.stringify({}),
      });
      // Perform frontend logout immediately
      logout();
      router.push('/auth/login');
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteAccount = async () => {
    setDeleteError('');
    try {
      await apiFetch('/profile/delete-account', { method: 'DELETE' });
      // Perform local logout
      logout();
      router.push('/auth/login');
    } catch (err: any) {
      setDeleteError(err.message || 'Failed to delete account.');
      // Open modal again if needed or display error
      toast.error(err.message || 'Failed to delete account.');
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-red-100 p-6 shadow-sm">
      <div className="mb-6">
        <h3 className="text-lg font-bold text-red-600">Danger Zone</h3>
        <p className="text-xs text-gray-500 mt-0.5">Sensitive account actions. These changes are immediate and irreversible.</p>
      </div>

      <div className="divide-y divide-red-50 space-y-4">
        {/* Logout all devices */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 gap-4">
          <div className="flex items-start gap-3">
            <ArrowRightOnRectangleIcon className="w-5 h-5 text-red-400 mt-0.5" />
            <div>
              <h4 className="text-sm font-bold text-gray-900">Logout all devices</h4>
              <p className="text-xs text-gray-500 mt-0.5">Sign out from every active session.</p>
            </div>
          </div>
          <button
            onClick={() => setIsLogoutConfirmOpen(true)}
            className="sm:w-auto w-full inline-flex justify-center px-4 py-2 text-xs font-semibold rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition-colors"
          >
            Logout
          </button>
        </div>

        {/* Delete account */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pt-4 gap-4">
          <div className="flex items-start gap-3">
            <TrashIcon className="w-5 h-5 text-red-400 mt-0.5" />
            <div>
              <h4 className="text-sm font-bold text-gray-900">Delete account</h4>
              <p className="text-xs text-gray-500 mt-0.5">Once you delete your account, there is no going back. Please be certain.</p>
            </div>
          </div>
          <button
            onClick={() => setIsDeleteConfirmOpen(true)}
            className="sm:w-auto w-full inline-flex justify-center px-4 py-2 text-xs font-semibold rounded-lg bg-red-600 hover:bg-red-700 text-white shadow transition-colors"
          >
            Delete Account
          </button>
        </div>
      </div>

      <ConfirmActionModal
        isOpen={isLogoutConfirmOpen}
        onClose={() => setIsLogoutConfirmOpen(false)}
        onConfirm={handleLogoutAll}
        title="Logout from all devices"
        message="Are you sure you want to terminate all active sessions? You will be logged out on this device too."
        confirmText="Logout All"
        isDanger={true}
      />

      <ConfirmActionModal
        isOpen={isDeleteConfirmOpen}
        onClose={() => setIsDeleteConfirmOpen(false)}
        onConfirm={handleDeleteAccount}
        title="Delete Your Account"
        message="Are you absolutely sure you want to delete your account? This action cannot be undone. Single Tenant owners cannot delete their profile."
        confirmText="Delete Account"
        requireTextValidation="DELETE"
        isDanger={true}
      />
    </div>
  );
}
