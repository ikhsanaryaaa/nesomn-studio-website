import { validateUpload } from '../../lib/upload-validation.ts';
function boxes(
  bytes: Buffer,
  from = 0,
  end = bytes.length,
): { type: string; start: number; end: number }[] {
  const result = [];
  while (from < end) {
    if (from + 8 > end) throw Error('Truncated MP4');
    let size = bytes.readUInt32BE(from),
      header = 8;
    if (size === 1) {
      if (from + 16 > end) throw Error('Truncated MP4');
      const large = bytes.readBigUInt64BE(from + 8);
      if (large > BigInt(Number.MAX_SAFE_INTEGER)) throw Error('Invalid MP4 size');
      size = Number(large);
      header = 16;
    }
    if (size === 0) size = end - from;
    if (size < header || from + size > end) throw Error('Invalid MP4 box');
    result.push({
      type: bytes.toString('ascii', from + 4, from + 8),
      start: from + header,
      end: from + size,
    });
    from += size;
  }
  return result;
}
function ebml(bytes: Buffer, from: number, end: number) {
  const entries: { id: number; start: number; end: number }[] = [];
  function vint(at: number, keep: boolean) {
    if (at >= end || !bytes[at]) throw Error('Invalid EBML');
    let n = 1;
    while (n <= 8 && !(bytes[at]! & (1 << (8 - n)))) n++;
    if (n > 8 || at + n > end || (keep && n > 4)) throw Error('Invalid EBML length');
    let value = keep ? bytes[at]! : bytes[at]! & ((1 << (8 - n)) - 1);
    let unknown = !keep && value === (1 << (8 - n)) - 1;
    for (let i = 1; i < n; i++) {
      value = value * 256 + bytes[at + i]!;
      unknown = unknown && bytes[at + i] === 255;
    }
    if (!unknown && !Number.isSafeInteger(value)) throw Error('Unsafe EBML size');
    return { value, n, unknown };
  }
  while (from < end) {
    const id = vint(from, true),
      size = vint(from + id.n, false),
      start = from + id.n + size.n;
    const stop = size.unknown ? end : start + size.value;
    if (stop > end || stop < start) throw Error('Invalid EBML bounds');
    entries.push({ id: id.value, start, end: stop });
    from = stop;
  }
  return entries;
}
/** Container checks only; no codec transcoding or promise every device can decode. */
export async function validatePortfolioUpload(bytes: Uint8Array, name: string, claimed: string) {
  const checked = await validateUpload(bytes, name, claimed, 'file'),
    b = Buffer.from(bytes);
  if (['image/png', 'image/jpeg', 'image/webp'].includes(checked.mime)) return checked;
  if (checked.mime === 'video/mp4') {
    const root = boxes(b),
      ftyp = root.find((box) => box.type === 'ftyp'),
      moov = root.find((box) => box.type === 'moov');
    if (
      !ftyp ||
      ftyp.end - ftyp.start < 8 ||
      !moov ||
      !root.some((box) => box.type === 'mdat' && box.end > box.start)
    )
      throw Error('Incomplete MP4');
    let hasVideo = false;
    for (const track of boxes(b, moov.start, moov.end).filter((box) => box.type === 'trak'))
      for (const mdia of boxes(b, track.start, track.end).filter((box) => box.type === 'mdia'))
        for (const h of boxes(b, mdia.start, mdia.end).filter((box) => box.type === 'hdlr'))
          if (h.end - h.start >= 12 && b.toString('ascii', h.start + 8, h.start + 12) === 'vide')
            hasVideo = true;
    if (!hasVideo) throw Error('A video track is required');
    return checked;
  }
  if (checked.mime === 'video/webm') {
    const root = ebml(b, 0, b.length),
      head = root.find((e) => e.id === 0x1a45dfa3),
      segment = root.find((e) => e.id === 0x18538067);
    if (
      !head ||
      !segment ||
      !ebml(b, head.start, head.end).some(
        (e) => e.id === 0x4282 && b.toString('ascii', e.start, e.end) === 'webm',
      )
    )
      throw Error('Invalid WebM');
    const parts = ebml(b, segment.start, segment.end),
      tracks = parts.find((e) => e.id === 0x1654ae6b);
    if (!tracks || !parts.some((e) => e.id === 0x1f43b675)) throw Error('Incomplete WebM');
    const video = ebml(b, tracks.start, tracks.end)
      .filter((e) => e.id === 0xae)
      .some((track) => {
        const fields = ebml(b, track.start, track.end);
        return (
          fields.some((e) => e.id === 0x83 && e.end - e.start === 1 && b[e.start] === 1) &&
          fields.some(
            (e) =>
              e.id === 0x86 &&
              ['V_VP8', 'V_VP9', 'V_AV1'].includes(b.toString('ascii', e.start, e.end)),
          )
        );
      });
    if (!video) throw Error('A supported video track is required');
    return checked;
  }
  throw Error('Unsupported portfolio format');
}
