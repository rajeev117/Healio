'use client';
import { cn } from '@/lib/utils';

interface ToggleProps {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  size?: 'sm' | 'md';
  label?: string;
}

export function Toggle({ checked, onChange, disabled, size = 'md', label }: ToggleProps) {
  return (
    <div className={cn('inline-flex items-center gap-2 select-none', disabled && 'opacity-50')}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => !disabled && onChange(!checked)}
        className={cn(
          'relative inline-flex shrink-0 items-center rounded-full border transition-all duration-200 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface',
          size === 'md' ? 'h-7 w-12 border-[1.5px]' : 'h-5 w-9 border',
          checked
            ? 'border-primary/70 bg-primary shadow-md'
            : 'border-border bg-surface-2 shadow-sm',
          disabled ? 'cursor-not-allowed' : 'cursor-pointer hover:scale-[1.01] active:scale-[0.98]',
        )}
      >
        <span
          className={cn(
            'pointer-events-none absolute rounded-full bg-white transition-transform duration-200 ease-out shadow',
            size === 'md' ? 'left-1 top-1 h-5 w-5' : 'left-0.5 top-0.5 h-4 w-4',
            checked
              ? size === 'md' ? 'translate-x-5' : 'translate-x-4'
              : 'translate-x-0',
          )}
        />
        <span
          className={cn(
            'pointer-events-none absolute inset-0 rounded-full transition-opacity duration-200',
            checked ? 'opacity-100 bg-[radial-gradient(circle_at_30%_30%,rgba(255,255,255,0.28),transparent_45%)]' : 'opacity-0',
          )}
        />
      </button>
      {label && (
        <span className="text-xs font-semibold text-text-secondary">{label}</span>
      )}
    </div>
  );
}
