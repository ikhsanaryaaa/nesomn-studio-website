import { clsx, type ClassValue } from 'clsx';

/** Join optional semantic CSS classes. Component variants own their styles. */
export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}
