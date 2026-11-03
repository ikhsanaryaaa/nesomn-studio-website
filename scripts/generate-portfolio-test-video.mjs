import { spawnSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
mkdirSync('tests/fixtures/portfolio', { recursive: true });
for (const ext of ['mp4', 'webm']) {
  const args = [
    '-hide_banner',
    '-loglevel',
    'error',
    '-y',
    '-f',
    'lavfi',
    '-i',
    'color=c=orange:s=64x64:r=10',
    '-t',
    '0.4',
    '-an',
    ...(ext === 'mp4'
      ? ['-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-movflags', '+faststart']
      : ['-c:v', 'libvpx-vp9']),
    'tests/fixtures/portfolio/sample.' + ext,
  ];
  const r = spawnSync('ffmpeg', args, { stdio: 'inherit', windowsHide: true });
  if (r.status !== 0) throw Error('FFmpeg required to regenerate original test clips.');
}
