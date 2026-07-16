'use client';

import { useState } from 'react';
import { AvatarUploader } from './AvatarUploader';
import { EditProfileModal } from './EditProfileModal';
import { PencilIcon, MapPinIcon, BriefcaseIcon } from '@heroicons/react/24/outline';

interface ProfileInfoCardProps {
  profile: any;
  onUpdateProfile: (data: any) => Promise<void>;
  onUploadAvatar: (file: File) => Promise<void>;
}

export function ProfileInfoCard({ profile, onUpdateProfile, onUploadAvatar }: ProfileInfoCardProps) {
  const [isEditOpen, setIsEditOpen] = useState(false);

  // Social Icon SVGs
  const renderSocialIcon = (platform: string) => {
    switch (platform) {
      case 'facebook':
        return (
          <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
            <path d="M9 8h-3v4h3v12h5v-12h3.642l.358-4h-4v-1.667c0-.955.192-1.333 1.115-1.333h2.885v-5h-3.808c-3.596 0-5.192 1.583-5.192 4.615v3.385z"/>
          </svg>
        );
      case 'twitter':
        return (
          <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
            <path d="M24 4.557c-.883.392-1.832.656-2.828.775 1.017-.609 1.798-1.574 2.165-2.724-.951.564-2.005.974-3.127 1.195-.897-.957-2.178-1.555-3.594-1.555-3.179 0-5.515 2.966-4.797 6.045-4.091-.205-7.719-2.165-10.148-5.144-1.29 2.213-.669 5.108 1.523 6.574-.806-.026-1.566-.247-2.229-.616-.054 2.281 1.581 4.415 3.949 4.89-.693.188-1.452.232-2.224.084.626 1.956 2.444 3.379 4.6 3.419-2.07 1.623-4.678 2.348-7.29 2.04 2.179 1.397 4.768 2.212 7.548 2.212 9.142 0 14.307-7.721 13.995-14.646.962-.695 1.797-1.562 2.457-2.549z"/>
          </svg>
        );
      case 'linkedin':
        return (
          <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
            <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/>
          </svg>
        );
      case 'instagram':
        return (
          <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
            <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
          </svg>
        );
      default:
        return null;
    }
  };

  const fullName = `${profile.firstName || ''} ${profile.lastName || ''}`.trim() || 'User Profile';

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm relative">
      <button
        onClick={() => setIsEditOpen(true)}
        className="absolute top-6 right-6 p-2 rounded-lg border border-gray-200 text-gray-500 hover:text-indigo-600 hover:border-indigo-600 transition-all flex items-center gap-1.5 text-xs font-semibold"
      >
        <PencilIcon className="w-3.5 h-3.5" />
        Edit
      </button>

      <div className="flex flex-col md:flex-row md:items-start gap-6">
        {/* Avatar Area */}
        <div className="flex-shrink-0">
          <AvatarUploader
            currentAvatar={profile.avatar}
            firstName={profile.firstName || ''}
            lastName={profile.lastName || ''}
            onUpload={onUploadAvatar}
          />
        </div>

        {/* Bio & Details Area */}
        <div className="flex-1 space-y-4">
          <div>
            <h2 className="text-xl font-bold text-gray-900 leading-snug">{fullName}</h2>
            
            <div className="flex flex-wrap gap-x-4 gap-y-2 mt-2">
              <span className="flex items-center text-xs font-medium text-gray-400 gap-1">
                <BriefcaseIcon className="w-3.5 h-3.5" />
                {profile.roleName}
              </span>
              {profile.location && (
                <span className="flex items-center text-xs font-medium text-gray-400 gap-1">
                  <MapPinIcon className="w-3.5 h-3.5" />
                  {profile.location}
                </span>
              )}
            </div>
          </div>

          <p className="text-sm text-gray-600 leading-relaxed max-w-xl">
            {profile.bio || <span className="text-gray-400 italic">No bio written yet. Click Edit to add one.</span>}
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-xl border-t border-gray-100 pt-4 text-sm">
            <div>
              <span className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-0.5">
                First Name
              </span>
              <span className="font-medium text-gray-900">{profile.firstName || '—'}</span>
            </div>
            <div>
              <span className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-0.5">
                Last Name
              </span>
              <span className="font-medium text-gray-900">{profile.lastName || '—'}</span>
            </div>
            <div>
              <span className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-0.5">
                Email Address
              </span>
              <span className="font-medium text-gray-900">{profile.email}</span>
            </div>
            <div>
              <span className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-0.5">
                Phone Number
              </span>
              <span className="font-medium text-gray-900">{profile.phone || '—'}</span>
            </div>
          </div>

          {/* Social Links */}
          <div className="border-t border-gray-100 pt-4 flex gap-3">
            {profile.facebookUrl && (
              <a href={profile.facebookUrl} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-[#1877F2] transition-colors" title="Facebook">
                {renderSocialIcon('facebook')}
              </a>
            )}
            {profile.xUrl && (
              <a href={profile.xUrl} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-[#000000] dark:hover:text-[#FFFFFF] transition-colors" title="X / Twitter">
                {renderSocialIcon('twitter')}
              </a>
            )}
            {profile.linkedinUrl && (
              <a href={profile.linkedinUrl} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-[#0A66C2] transition-colors" title="LinkedIn">
                {renderSocialIcon('linkedin')}
              </a>
            )}
            {profile.instagramUrl && (
              <a href={profile.instagramUrl} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-[#E1306C] transition-colors" title="Instagram">
                {renderSocialIcon('instagram')}
              </a>
            )}
            {!profile.facebookUrl && !profile.xUrl && !profile.linkedinUrl && !profile.instagramUrl && (
              <span className="text-xs text-gray-400 italic">No social media links connected.</span>
            )}
          </div>
        </div>
      </div>

      <EditProfileModal
        isOpen={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        onSave={onUpdateProfile}
        initialData={profile}
      />
    </div>
  );
}
