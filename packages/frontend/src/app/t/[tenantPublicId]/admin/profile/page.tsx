'use client';

import useSWR from 'swr';
import { apiFetch } from '@/lib/api';
import { useToast } from '@/components/ui/Toast';
import { ProfileInfoCard } from './components/ProfileInfoCard';
import { AddressCard } from './components/AddressCard';
import { SecurityCard } from './components/SecurityCard';
import { DangerZoneCard } from './components/DangerZoneCard';

const fetcher = (url: string) => apiFetch(url);

export default function ProfilePage() {
  const toast = useToast();
  const { data: profile, error, mutate } = useSWR<any>('/profile', fetcher);

  const handleUpdateProfile = async (formData: any) => {
    try {
      const updated = await apiFetch<any>('/profile', {
        method: 'PUT',
        body: JSON.stringify(formData),
      });
      mutate(updated);
    } catch (err: any) {
      toast.error(err.message || 'Failed to update profile');
      throw err;
    }
  };

  const handleUpdateAddress = async (formData: any) => {
    try {
      const updated = await apiFetch<any>('/profile/address', {
        method: 'PUT',
        body: JSON.stringify(formData),
      });
      mutate(updated);
    } catch (err: any) {
      toast.error(err.message || 'Failed to update address');
      throw err;
    }
  };

  const handleChangePassword = async (formData: any) => {
    try {
      await apiFetch<any>('/profile/change-password', {
        method: 'POST',
        body: JSON.stringify(formData),
      });
      toast.success('Password changed successfully.');
    } catch (err: any) {
      throw err;
    }
  };

  const handleUploadAvatar = async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await apiFetch<any>('/profile/avatar', {
        method: 'POST',
        body: formData,
        headers: {}, // Do not enforce JSON content-type since it is a FormData
      });
      mutate({ ...profile, avatar: res.avatarUrl });
    } catch (err: any) {
      toast.error(err.message || 'Failed to upload avatar image');
      throw err;
    }
  };

  if (error) {
    return (
      <div className="flex-1 p-4 md:p-8 pt-6">
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center max-w-lg mx-auto">
          <h3 className="text-red-800 font-bold">Failed to load profile settings</h3>
          <p className="text-red-600 text-xs mt-1">Please confirm you are logged in and try again.</p>
        </div>
      </div>
    );
  }

  if (!profile) {
    // Premium Loading Skeletons
    return (
      <div className="flex-1 space-y-6 p-4 md:p-8 pt-6 max-w-4xl mx-auto">
        <div className="space-y-2 animate-pulse">
          <div className="h-8 bg-gray-200 rounded-md w-48"></div>
          <div className="h-4 bg-gray-200 rounded-md w-72"></div>
        </div>

        <div className="card space-y-4 animate-pulse">
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 bg-gray-200 rounded-full"></div>
            <div className="space-y-2 flex-1">
              <div className="h-5 bg-gray-200 rounded w-1/3"></div>
              <div className="h-4 bg-gray-200 rounded w-1/4"></div>
            </div>
          </div>
          <div className="h-4 bg-gray-200 rounded w-full"></div>
          <div className="h-4 bg-gray-200 rounded w-5/6"></div>
        </div>

        <div className="card space-y-3 animate-pulse">
          <div className="h-5 bg-gray-200 rounded w-1/4"></div>
          <div className="h-4 bg-gray-200 rounded w-3/4"></div>
          <div className="h-10 bg-gray-100 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 space-y-6 p-4 md:p-8 pt-6 max-w-4xl mx-auto animate-fade-in-up">
      <div className="flex flex-col space-y-1">
        <h2 className="text-2xl font-bold tracking-tight text-gray-900 font-outfit">Profile Settings</h2>
        <p className="text-xs text-gray-500">Configure your personal profiles, addresses, security, and account preferences.</p>
      </div>

      <div className="space-y-6">
        <ProfileInfoCard
          profile={profile}
          onUpdateProfile={handleUpdateProfile}
          onUploadAvatar={handleUploadAvatar}
        />

        <AddressCard
          profile={profile}
          onUpdateAddress={handleUpdateAddress}
        />

        <SecurityCard
          profile={profile}
          onRefresh={async () => { await mutate(); }}
          onChangePassword={handleChangePassword}
        />

        <DangerZoneCard />
      </div>
    </div>
  );
}
