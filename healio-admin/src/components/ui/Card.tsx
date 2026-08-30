import { cn } from '@/lib/utils';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

const paddingMap = { none: '', sm: 'p-4', md: 'p-5', lg: 'p-6' };

export function Card({ children, className, padding = 'md', ...props }: CardProps) {
  return (
    <div className={cn(
      'bg-surface rounded-lg border border-border',
      paddingMap[padding],
      className
    )} {...props}>
      {children}
    </div>
  );
}

export function CardHeader({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('flex items-center justify-between mb-4', className)}>
      {children}
    </div>
  );
}

export function CardTitle({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <h3 className={cn('text-sm font-800 text-text', className)}>{children}</h3>
  );
}
