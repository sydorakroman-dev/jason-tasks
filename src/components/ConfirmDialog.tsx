import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Trash2 } from 'lucide-react';

interface DialogProps {
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}

function ConfirmDialog({ title, message, onConfirm, onCancel }: DialogProps) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
      if (e.key === 'Enter') onConfirm();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onConfirm, onCancel]);

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center"
      onClick={onCancel}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Icon */}
        <div className="flex justify-center pt-7 pb-4">
          <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center">
            <Trash2 size={24} className="text-red-500" />
          </div>
        </div>

        {/* Text */}
        <div className="text-center px-6 pb-6">
          <h3 className="text-base font-semibold text-gray-900 mb-1.5">{title}</h3>
          <p className="text-sm text-gray-500 leading-relaxed">{message}</p>
        </div>

        {/* Actions */}
        <div className="flex border-t border-gray-100">
          <button
            autoFocus
            onClick={onCancel}
            className="flex-1 py-3.5 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors border-r border-gray-100"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-3.5 text-sm font-semibold text-red-600 hover:bg-red-50 transition-colors"
          >
            Delete
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

type ConfirmState = { title: string; message: string; onConfirm: () => void } | null;

export function useConfirm() {
  const [state, setState] = useState<ConfirmState>(null);

  const ask = (title: string, message: string, onConfirm: () => void) => {
    setState({ title, message, onConfirm });
  };

  const dialog = state ? (
    <ConfirmDialog
      title={state.title}
      message={state.message}
      onConfirm={() => { state.onConfirm(); setState(null); }}
      onCancel={() => setState(null)}
    />
  ) : null;

  return { ask, dialog };
}
