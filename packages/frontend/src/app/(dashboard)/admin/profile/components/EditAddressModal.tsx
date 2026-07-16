'use client';

import { useState, useEffect } from 'react';

interface EditAddressModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: any) => Promise<void>;
  initialData: any;
}

export function EditAddressModal({ isOpen, onClose, onSave, initialData }: EditAddressModalProps) {
  const [formData, setFormData] = useState({
    country: '',
    city: '',
    state: '',
    postalCode: '',
    taxId: '',
    fullAddress: '',
  });
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (initialData) {
      setFormData({
        country: initialData.country || '',
        city: initialData.city || '',
        state: initialData.state || '',
        postalCode: initialData.postalCode || '',
        taxId: initialData.taxId || '',
        fullAddress: initialData.fullAddress || '',
      });
    }
  }, [initialData, isOpen]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await onSave(formData);
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-fade-in backdrop-blur-sm">
      <div className="w-full max-w-lg bg-white rounded-2xl p-6 shadow-xl border border-gray-100 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg font-bold text-gray-900">Edit Address Details</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Country</label>
              <input
                type="text"
                name="country"
                value={formData.country}
                onChange={handleChange}
                className="w-full rounded-lg border-gray-200 text-sm shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">City</label>
              <input
                type="text"
                name="city"
                value={formData.city}
                onChange={handleChange}
                className="w-full rounded-lg border-gray-200 text-sm shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">State / Province</label>
              <input
                type="text"
                name="state"
                value={formData.state}
                onChange={handleChange}
                className="w-full rounded-lg border-gray-200 text-sm shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Postal Code</label>
              <input
                type="text"
                name="postalCode"
                value={formData.postalCode}
                onChange={handleChange}
                className="w-full rounded-lg border-gray-200 text-sm shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">TAX ID / Tax Number</label>
            <input
              type="text"
              name="taxId"
              value={formData.taxId}
              onChange={handleChange}
              className="w-full rounded-lg border-gray-200 text-sm shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
              placeholder="e.g. 1234567890"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Full Address</label>
            <textarea
              name="fullAddress"
              value={formData.fullAddress}
              onChange={handleChange}
              rows={4}
              className="w-full rounded-lg border-gray-200 text-sm shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
              placeholder="Write your complete street address here..."
            />
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
              disabled={isSaving}
              className="px-4 py-2 text-sm font-semibold rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {isSaving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
