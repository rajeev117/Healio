'use client';
import { cn, initials } from '@/lib/utils';

const sizeMap = { sm: 'w-7 h-7 text-xs', md: 'w-9 h-9 text-sm', lg: 'w-11 h-11 text-base', xl: 'w-14 h-14 text-lg' };

interface AvatarProps {
  name: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  online?: boolean;
}

export function Avatar({ name, size = 'md', className, online }: AvatarProps) {
  return (
    <span className="relative inline-flex shrink-0">
      <span className={cn(
        'rounded-full bg-primary-soft text-primary font-800 flex items-center justify-center select-none',
        sizeMap[size], className
      )}>
        {initials(name)}
      </span>
      {online !== undefined && (
        <span className={cn(
          'absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-surface',
          online ? 'bg-success' : 'bg-border-strong'
        )} />
      )}
    </span>
  );
}
