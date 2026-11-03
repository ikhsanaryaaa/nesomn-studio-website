/** A single bounded HTTP byte range. Multipart ranges are deliberately unsupported. */
export function byteRange(
  value: string | null,
  size: number,
): { start: number; end: number } | null | 'invalid' {
  if (value === null) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(value);
  if (!match || (!match[1] && !match[2]) || !size) return 'invalid';
  const a = match[1] ? Number(match[1]) : null,
    b = match[2] ? Number(match[2]) : null;
  if ((a !== null && !Number.isSafeInteger(a)) || (b !== null && !Number.isSafeInteger(b)))
    return 'invalid';
  const start = a === null ? Math.max(0, size - (b ?? 0)) : a,
    end = a === null ? size - 1 : Math.min(b ?? size - 1, size - 1);
  if (start >= size || start > end || (a === null && b === 0)) return 'invalid';
  return { start, end };
}
