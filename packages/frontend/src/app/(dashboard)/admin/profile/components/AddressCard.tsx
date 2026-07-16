'use client';

import { useState } from 'react';
import { EditAddressModal } from './EditAddressModal';
import { PencilIcon } from '@heroicons/react/24/outline';

interface AddressCardProps {
  profile: any;
  onUpdateAddress: (data: any) => Promise<void>;
}

export function AddressCard({ profile, onUpdateAddress }: AddressCardProps) {
  const [isEditOpen, setIsEditOpen] = useState(false);

  const hasAddressInfo =
    profile.country ||
    profile.city ||
    profile.state ||
    profile.postalCode ||
    profile.taxId ||
    profile.fullAddress;

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm relative">
      <button
        onClick={() => setIsEditOpen(true)}
        className="absolute top-6 right-6 p-2 rounded-lg border border-gray-200 text-gray-500 hover:text-indigo-600 hover:border-indigo-600 transition-all flex items-center gap-1.5 text-xs font-semibold"
      >
        <PencilIcon className="w-3.5 h-3.5" />
        Edit
      </button>

      <div className="mb-4">
        <h3 className="text-lg font-bold text-gray-900">Address Details</h3>
        <p className="text-xs text-gray-500 mt-0.5">Manage your billing address and tax identification details.</p>
      </div>

      {!hasAddressInfo ? (
        <div className="py-8 text-center text-gray-400 italic text-sm border border-dashed border-gray-200 rounded-xl">
          No address details added. Click Edit to add address info.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4 text-sm mt-4">
          <div>
            <span className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-0.5">
              Country
            </span>
            <span className="font-medium text-gray-900">{profile.country || '—'}</span>
          </div>
          <div>
            <span className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-0.5">
              City / State
            </span>
            <span className="font-medium text-gray-900">
              {profile.city || profile.state ? `${profile.city || ''} / ${profile.state || ''}`.replace(/^\s*\/\s*|\s*\/\s*$/, '') : '—'}
            </span>
          </div>
          <div>
            <span className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-0.5">
              Postal Code
            </span>
            <span className="font-medium text-gray-900">{profile.postalCode || '—'}</span>
          </div>
          <div>
            <span className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-0.5">
              TAX ID
            </span>
            <span className="font-medium text-gray-900">{profile.taxId || '—'}</span>
          </div>
          <div className="md:col-span-2 border-t border-gray-50 pt-3">
            <span className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-0.5">
              Full Address
            </span>
            <span className="font-medium text-gray-900 block whitespace-pre-line leading-relaxed">
              {profile.fullAddress || '—'}
            </span>
          </div>
        </div>
      )}

      <EditAddressModal
        isOpen={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        onSave={onUpdateAddress}
        initialData={profile}
      />
    </div>
  );
}
