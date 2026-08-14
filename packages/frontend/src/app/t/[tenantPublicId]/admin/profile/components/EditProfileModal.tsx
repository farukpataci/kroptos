'use client';

import { useState, useEffect } from 'react';

interface EditProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: any) => Promise<void>;
  initialData: any;
}

export function EditProfileModal({ isOpen, onClose, onSave, initialData }: EditProfileModalProps) {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    bio: '',
    location: '',
    facebookUrl: '',
    xUrl: '',
    linkedinUrl: '',
    instagramUrl: '',
  });
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (initialData) {
      setFormData({
        firstName: initialData.firstName || '',
        lastName: initialData.lastName || '',
        phone: initialData.phone || '',
        bio: initialData.bio || '',
        location: initialData.location || '',
        facebookUrl: initialData.facebookUrl || '',
        xUrl: initialData.xUrl || '',
        linkedinUrl: initialData.linkedinUrl || '',
        instagramUrl: initialData.instagramUrl || '',
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
          <h3 className="text-lg font-bold text-gray-900">Edit Profile</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">First Name</label>
              <input
                type="text"
                name="firstName"
                value={formData.firstName}
                onChange={handleChange}
                className="w-full rounded-lg border-gray-200 text-sm shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Last Name</label>
              <input
                type="text"
                name="lastName"
                value={formData.lastName}
                onChange={handleChange}
                className="w-full rounded-lg border-gray-200 text-sm shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Email Address (Read-only)</label>
            <input
              type="text"
              value={initialData?.email || ''}
              readOnly
              className="w-full rounded-lg border-gray-200 bg-gray-50 text-gray-400 text-sm shadow-sm cursor-not-allowed"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Phone</label>
              <input
                type="text"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                className="w-full rounded-lg border-gray-200 text-sm shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Location</label>
              <input
                type="text"
                name="location"
                value={formData.location}
                onChange={handleChange}
                className="w-full rounded-lg border-gray-200 text-sm shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                placeholder="e.g. Istanbul, Turkey"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Bio</label>
            <textarea
              name="bio"
              value={formData.bio}
              onChange={handleChange}
              rows={3}
              className="w-full rounded-lg border-gray-200 text-sm shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
              placeholder="Tell us about yourself..."
            />
          </div>

          <div className="border-t border-gray-100 pt-4">
            <h4 className="text-sm font-bold text-gray-700 mb-3">Social Links</h4>
            <div className="space-y-3">
              <div>
                <label className="block text-[0.625rem] font-semibold text-gray-400 uppercase mb-0.5">Facebook URL</label>
                <input
                  type="url"
                  name="facebookUrl"
                  value={formData.facebookUrl}
                  onChange={handleChange}
                  className="w-full rounded-lg border-gray-200 text-sm shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                  placeholder="https://facebook.com/username"
                />
              </div>
              <div>
                <label className="block text-[0.625rem] font-semibold text-gray-400 uppercase mb-0.5">X / Twitter URL</label>
                <input
                  type="url"
                  name="xUrl"
                  value={formData.xUrl}
                  onChange={handleChange}
                  className="w-full rounded-lg border-gray-200 text-sm shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                  placeholder="https://x.com/username"
                />
              </div>
              <div>
                <label className="block text-[0.625rem] font-semibold text-gray-400 uppercase mb-0.5">LinkedIn URL</label>
                <input
                  type="url"
                  name="linkedinUrl"
                  value={formData.linkedinUrl}
                  onChange={handleChange}
                  className="w-full rounded-lg border-gray-200 text-sm shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                  placeholder="https://linkedin.com/in/username"
                />
              </div>
              <div>
                <label className="block text-[0.625rem] font-semibold text-gray-400 uppercase mb-0.5">Instagram URL</label>
                <input
                  type="url"
                  name="instagramUrl"
                  value={formData.instagramUrl}
                  onChange={handleChange}
                  className="w-full rounded-lg border-gray-200 text-sm shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                  placeholder="https://instagram.com/username"
                />
              </div>
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
