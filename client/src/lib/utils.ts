import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Gabungkan class names dengan Tailwind merge agar tidak bentrok. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
