import { AppError } from '../../middleware/error.ts';

export function validateStorageKey(key: string): string {
  if (
    !key ||
    key.length > 512 ||
    key.trim() !== key ||
    /[\\%:?#]/.test(key) ||
    [...key].some((char) => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127) ||
    key.split('/').some((part) => !part || part === '.' || part === '..')
  ) {
    throw new AppError('INVALID_STORAGE_KEY', 'Invalid storage key.', 400);
  }
  return key;
}
