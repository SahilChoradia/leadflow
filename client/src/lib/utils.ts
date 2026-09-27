import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Combines clsx + tailwind-merge — use everywhere instead of raw classnames */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
