import React from 'react';
import { Trash2, X, AlertTriangle } from 'lucide-react';

const hexToRgba = (hex: string, alpha: number) => {
  const r = parseInt(hex.slice(1, 3), 16) || 0;
  const g = parseInt(hex.slice(3, 5), 16) || 0;
  const b = parseInt(hex.slice(5, 7), 16) || 0;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  panelTint?: string;
};

export const ConfirmModal = ({ isOpen, onClose, onConfirm, title, message, confirmText = "Confirm", cancelText = "Cancel", panelTint = "#0f172a" }: Props) => {
  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 backdrop-blur-sm transition-opacity"
      style={{ background: hexToRgba(panelTint, 0.75) }}
      onClick={onClose}
    >
      <div 
        className="modal-pop w-full max-w-sm rounded-3xl border border-white/10 p-6 shadow-2xl backdrop-blur-xl"
        style={{ backgroundColor: panelTint ? hexToRgba(panelTint, 0.9) : "rgba(15, 23, 42, 0.9)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-500/10 text-rose-400 mb-4 mx-auto">
          <AlertTriangle className="h-6 w-6" />
        </div>
        
        <h3 className="text-xl font-bold text-white text-center mb-2">{title}</h3>
        <p className="text-sm text-slate-400 text-center mb-6">
          {message}
        </p>
        
        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 rounded-2xl border border-white/10 bg-white/5 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/10"
          >
            {cancelText}
          </button>
          <button
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className="flex-1 rounded-2xl bg-rose-500 py-3 text-sm font-semibold text-white shadow-lg shadow-rose-500/25 transition-all hover:bg-rose-400 active:scale-95"
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};
