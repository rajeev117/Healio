'use client';
import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
}

export function Modal({ open, onClose, title, children, footer, size = 'md' }: ModalProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div
        ref={ref}
        className={cn(
          'relative z-10 bg-surface border border-border rounded-2xl shadow-2xl flex flex-col max-h-[90vh] w-full',
          size === 'sm' && 'max-w-sm',
          size === 'md' && 'max-w-lg',
          size === 'lg' && 'max-w-2xl',
        )}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <h2 className="text-sm font-800 text-text">{title}</h2>
          <button onClick={onClose} className="p-1.5 rounded-md hover:bg-surface-2 text-text-muted transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
        {footer && (
          <div className="px-6 py-4 border-t border-border shrink-0 flex items-center justify-end gap-3">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

interface ConfirmModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  confirmVariant?: 'danger' | 'primary' | 'success';
  loading?: boolean;
}

export function ConfirmModal({
  open, onClose, onConfirm, title, message,
  confirmLabel = 'Confirm', confirmVariant = 'danger', loading = false,
}: ConfirmModalProps) {
  return (
    <Modal open={open} onClose={onClose} title={title} size="sm"
      footer={
        <>
          <button onClick={onClose} disabled={loading}
            className="px-4 py-2 text-xs font-700 text-text-secondary hover:text-text border border-border rounded-lg transition-colors">
            Cancel
          </button>
          <button onClick={onConfirm} disabled={loading}
            className={cn(
              'px-4 py-2 text-xs font-700 text-white rounded-lg transition-colors',
              confirmVariant === 'danger' && 'bg-danger hover:bg-danger/90',
              confirmVariant === 'primary' && 'bg-primary hover:bg-primary-hover',
              confirmVariant === 'success' && 'bg-success hover:bg-success/90',
              loading && 'opacity-60 cursor-not-allowed',
            )}>
            {loading ? 'Processing…' : confirmLabel}
          </button>
        </>
      }>
      <p className="text-sm text-text-secondary leading-relaxed">{message}</p>
    </Modal>
  );
}

interface TextInputModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (value: string) => void;
  title: string;
  label: string;
  placeholder?: string;
  confirmLabel?: string;
  confirmVariant?: 'danger' | 'primary' | 'success';
  loading?: boolean;
  value: string;
  onChange: (v: string) => void;
}

export function TextInputModal({
  open, onClose, onConfirm, title, label, placeholder,
  confirmLabel = 'Submit', confirmVariant = 'primary', loading = false,
  value, onChange,
}: TextInputModalProps) {
  return (
    <Modal open={open} onClose={onClose} title={title} size="sm"
      footer={
        <>
          <button onClick={onClose} disabled={loading}
            className="px-4 py-2 text-xs font-700 text-text-secondary hover:text-text border border-border rounded-lg transition-colors">
            Cancel
          </button>
          <button onClick={() => onConfirm(value)} disabled={loading || !value.trim()}
            className={cn(
              'px-4 py-2 text-xs font-700 text-white rounded-lg transition-colors',
              confirmVariant === 'danger' && 'bg-danger hover:bg-danger/90',
              confirmVariant === 'primary' && 'bg-primary hover:bg-primary-hover',
              confirmVariant === 'success' && 'bg-success hover:bg-success/90',
              (loading || !value.trim()) && 'opacity-60 cursor-not-allowed',
            )}>
            {loading ? 'Processing…' : confirmLabel}
          </button>
        </>
      }>
      <label className="block text-xs font-700 text-text mb-2">{label}</label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={3}
        className="w-full px-3 py-2 bg-surface-2 border border-border rounded-lg text-xs text-text placeholder:text-text-muted focus:outline-none focus:border-primary resize-none"
      />
    </Modal>
  );
}
