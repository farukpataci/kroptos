'use client';

import { useState, useRef } from 'react';
import { CameraIcon } from '@heroicons/react/24/outline';

interface AvatarUploaderProps {
  currentAvatar: string | null;
  firstName: string;
  lastName: string;
  onUpload: (file: File) => Promise<void>;
}

export function AvatarUploader({ currentAvatar, firstName, lastName, onUpload }: AvatarUploaderProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError('');
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowedTypes.includes(file.type)) {
      setError('Only JPEG, PNG, WEBP, and GIF are allowed.');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError('File size must be less than 5MB.');
      return;
    }

    setIsUploading(true);
    try {
      await onUpload(file);
    } catch (err: any) {
      setError(err.message || 'Failed to upload avatar.');
    } finally {
      setIsUploading(false);
    }
  };

  const triggerInput = () => {
    fileInputRef.current?.click();
  };

  const initials = `${firstName?.[0] || 'U'}${lastName?.[0] || ''}`.toUpperCase();

  return (
    <div className="flex flex-col items-center">
      <div className="relative group">
        <div className="w-24 h-24 rounded-full overflow-hidden border-2 border-indigo-100 flex items-center justify-center bg-gradient-to-br from-indigo-50 to-purple-50 shadow-sm relative">
          {currentAvatar ? (
            <img src={currentAvatar} alt="Avatar" className="w-full h-full object-cover" />
          ) : (
            <span className="text-2xl font-bold text-indigo-700">{initials}</span>
          )}

          {isUploading && (
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={triggerInput}
          disabled={isUploading}
          className="absolute bottom-0 right-0 p-1.5 rounded-full bg-white border border-gray-200 text-gray-500 shadow hover:bg-gray-50 hover:text-indigo-600 transition-colors"
          title="Upload new avatar"
        >
          <CameraIcon className="w-4 h-4" />
        </button>
      </div>

      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        className="hidden"
        accept="image/jpeg,image/png,image/webp,image/gif"
      />

      {error && (
        <span className="text-[0.625rem] font-semibold text-red-500 mt-2 block text-center max-w-[150px]">
          {error}
        </span>
      )}
    </div>
  );
}
