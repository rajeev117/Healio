'use client';
import { cn } from '@/lib/utils';

type Variant = 'success' | 'warning' | 'danger' | 'info' | 'primary' | 'muted';

const variantStyles: Record<Variant, string> = {
  success: 'bg-success-soft text-success',
  warning: 'bg-warning-soft text-warning',
  danger:  'bg-danger-soft text-danger',
  info:    'bg-info-soft text-info',
  primary: 'bg-primary-soft text-primary',
  muted:   'bg-surface-3 text-text-secondary',
};

interface BadgeProps {
  variant?: Variant;
  children: React.ReactNode;
  className?: string;
  dot?: boolean;
}

export function Badge({ variant = 'muted', children, className, dot }: BadgeProps) {
  return (
    <span className={cn(
      'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-700 whitespace-nowrap',
      variantStyles[variant],
      className
    )}>
      {dot && (
        <span className={cn('w-1.5 h-1.5 rounded-full', {
          'bg-success': variant === 'success',
          'bg-warning': variant === 'warning',
          'bg-danger': variant === 'danger',
          'bg-info': variant === 'info',
          'bg-primary': variant === 'primary',
          'bg-text-muted': variant === 'muted',
        })} />
      )}
      {children}
    </span>
  );
}
