import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number, currency = '₹') {
  return `${currency}${amount.toLocaleString('en-IN')}`;
}

export function formatNumber(n: number) {
  if (n >= 10_000_000) return `${(n / 10_000_000).toFixed(1)}Cr`;
  if (n >= 100_000) return `${(n / 100_000).toFixed(1)}L`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

export function timeAgo(date: Date | string) {
  const d = typeof date === 'string' ? new Date(date) : date;
  const secs = Math.floor((Date.now() - d.getTime()) / 1000);
  if (secs < 60) return `${secs}s ago`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  return `${Math.floor(secs / 86400)}d ago`;
}

export function initials(name: string) {
  return name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
}

export function statusColor(status: string): string {
  const map: Record<string, string> = {
    active: 'success', online: 'success', confirmed: 'success', completed: 'success', approved: 'success',
    pending: 'warning', processing: 'warning', on_leave: 'warning', trial: 'warning',
    suspended: 'danger', banned: 'danger', rejected: 'danger', overdue: 'danger',
    inactive: 'muted', expired: 'muted', cancelled: 'muted',
  };
  return map[status.toLowerCase()] ?? 'muted';
}
