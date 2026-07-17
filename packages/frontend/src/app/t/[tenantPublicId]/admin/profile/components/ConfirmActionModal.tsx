'use client';

import { useState, useEffect } from 'react';

interface ConfirmActionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  title: string;
  message: string;
  confirmText?: string;
  requireTextValidation?: string; // e.g. "DELETE"
  isDanger?: boolean;
}

export function ConfirmActionModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  requireTextValidation,
  isDanger = false,
}: ConfirmActionModalProps) {
  const [typedText, setTypedText] = useState('');
  const [isConfirming, setIsConfirming] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setTypedText('');
      setIsConfirming(false);
    }
  }, [isOpen]);

  const handleConfirm = async () => {
    setIsConfirming(true);
    try {
      await onConfirm();
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setIsConfirming(false);
    }
  };

  const isButtonDisabled = isConfirming || (requireTextValidation && typedText !== requireTextValidation);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-fade-in backdrop-blur-sm">
      <div className="w-full max-w-md bg-white rounded-2xl p-6 shadow-xl border border-gray-100">
        <div className="flex justify-between items-center mb-4">
          <h3 className={`text-lg font-bold ${isDanger ? 'text-red-600' : 'text-gray-900'}`}>{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            ✕
          </button>
        </div>

        <p className="text-sm text-gray-500 mb-6">{message}</p>

        {requireTextValidation && (
          <div className="mb-6">
            <label className="block text-xs font-semibold text-gray-400 uppercase mb-2">
              Type <strong className="text-gray-700">{requireTextValidation}</strong> to confirm:
            </label>
            <input
              type="text"
              value={typedText}
              onChange={(e) => setTypedText(e.target.value)}
              className="w-full rounded-lg border-gray-200 text-center font-bold tracking-wider text-sm shadow-sm focus:border-red-500 focus:ring-red-500"
              placeholder={requireTextValidation}
            />
          </div>
        )}

        <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-semibold rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!!isButtonDisabled}
            onClick={handleConfirm}
            className={`px-4 py-2 text-sm font-semibold rounded-lg text-white disabled:opacity-50 ${
              isDanger ? 'bg-red-600 hover:bg-red-700' : 'bg-indigo-600 hover:bg-indigo-700'
            }`}
          >
            {isConfirming ? 'Processing...' : confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
