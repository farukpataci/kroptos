'use client';
import PageStub from '@/components/ui/PageStub';
import { Cog6ToothIcon } from '@heroicons/react/24/outline';

export default function SettingsPage() {
  return (
    <PageStub
      title="System Settings"
      description="Configure users, roles, permissions, and system preferences"
      icon={<Cog6ToothIcon />}
    />
  );
}
