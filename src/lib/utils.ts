import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { format, parseISO } from 'date-fns';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—';
  const crore = value / 10000000;
  const lakh = value / 100000;
  if (crore >= 1) return `₹${crore.toFixed(2)} Cr`;
  if (lakh >= 1) return `₹${lakh.toFixed(2)} L`;
  return `₹${value.toLocaleString('en-IN')}`;
}

export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  try {
    return format(parseISO(dateStr), 'dd MMM yyyy');
  } catch {
    return dateStr;
  }
}

export function getDaysUntilDue(dueDate: string | null): number | null {
  if (!dueDate) return null;
  const due = new Date(dueDate);
  const now = new Date();
  const diff = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  return diff;
}

export function getDueDateColor(dueDate: string | null): string {
  const days = getDaysUntilDue(dueDate);
  if (days === null) return 'text-muted-foreground';
  if (days < 0) return 'text-destructive';
  if (days <= 3) return 'text-red-600';
  if (days <= 7) return 'text-orange-500';
  if (days <= 14) return 'text-yellow-600';
  return 'text-green-600';
}
