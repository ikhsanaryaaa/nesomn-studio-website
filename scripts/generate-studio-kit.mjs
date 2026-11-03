import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
const require = createRequire(import.meta.url),
  sharp = require('../api/node_modules/sharp');
const folder = 'client/public/demo/portfolio/studio-kit';
mkdirSync(folder, { recursive: true });
const paper = '#f2eee4',
  ink = '#20201d',
  orange = '#df5b24';
const type = 'font-family="Arial,sans-serif"';
function poster(width = 400, height = 580) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 400 580"><rect width="400" height="580" fill="${paper}"/><text x="32" y="45" ${type} font-size="13" font-weight="700" fill="${ink}">NESOMN / STUDIO KIT</text><text x="30" y="152" ${type} font-size="77" font-weight="900" letter-spacing="-5" fill="${ink}">STUDIO</text><text x="30" y="220" ${type} font-size="77" font-weight="900" letter-spacing="-5" fill="${ink}">KIT.</text><g transform="translate(282 350) rotate(-26)" fill="none" stroke="${orange}" stroke-width="20"><ellipse rx="188" ry="152"/><ellipse rx="188" ry="93"/><ellipse rx="188" ry="34"/></g><rect x="22" y="510" width="356" height="48" fill="${paper}"/><text x="32" y="536" ${type} font-size="12" font-weight="700" fill="${ink}">FOR YOUR NEXT IDEA.</text><text x="352" y="549" text-anchor="end" ${type} font-size="45" font-weight="900" fill="${ink}">01</text></svg>`;
}
const artwork = Buffer.from(poster()).toString('base64');
function box(x = 810, y = 168, scale = 1) {
  return `<g transform="translate(${x} ${y}) scale(${scale})"><ellipse cx="210" cy="643" rx="260" ry="33" fill="${ink}" opacity=".10"/><polygon points="0,50 382,125 525,30 143,-45" fill="${orange}"/><polygon points="382,125 525,30 525,590 382,685" fill="#b9431b"/><g transform="matrix(.955 .1875 0 .965 0 50)"><image href="data:image/svg+xml;base64,${artwork}" width="400" height="580"/></g><text x="458" y="360" ${type} font-size="18" font-weight="700" text-anchor="middle" fill="${paper}" transform="rotate(-33 458 360)">NESOMN STUDIO</text></g>`;
}
function canvas(body) {
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1000" viewBox="0 0 1600 1000"><rect width="1600" height="1000" fill="#eeede8"/>${body}<text x="80" y="944" ${type} font-size="16" fill="#5e5d56">NESOMN STUDIO / INTERNAL CONCEPT</text><text x="1520" y="944" text-anchor="end" ${type} font-size="16" fill="#5e5d56">DEMO / SAMPLE</text></svg>`,
  );
}
const logo = await sharp(readFileSync('client/public/nesomn-logo-black.svg'))
  .resize(68, 68, { fit: 'inside' })
  .png()
  .toBuffer();
const cover = canvas(
  `<text x="80" y="250" ${type} font-size="22" font-weight="700" fill="${ink}">A SPACE FOR CREATIVE POSSIBILITIES.</text><text x="74" y="390" ${type} font-size="120" font-weight="900" letter-spacing="-7" fill="${ink}">NESOMN</text><text x="74" y="505" ${type} font-size="120" font-weight="900" letter-spacing="-7" fill="${orange}">STUDIO KIT.</text><path d="M80 590h530" stroke="#b7b4aa"/><text x="80" y="638" ${type} font-size="22" fill="#5e5d56">One identity. A whole new perspective.</text>${box(900, 170, 0.92)}`,
);
await sharp(cover)
  .composite([{ input: logo, top: 72, left: 80 }])
  .png()
  .toFile(folder + '/cover.png');
await sharp(
  canvas(
    `<g transform="translate(280 120) rotate(-8 200 290)"><rect x="-12" y="-12" width="424" height="604" rx="4" fill="#20201d" opacity=".07"/><image href="data:image/svg+xml;base64,${artwork}" width="400" height="580"/></g><g transform="translate(790 215) rotate(10 200 290)"><rect x="-12" y="-12" width="424" height="604" rx="4" fill="#20201d" opacity=".07"/><image href="data:image/svg+xml;base64,${artwork}" width="400" height="580"/></g>`,
  ),
)
  .png()
  .toFile(folder + '/artwork.png');
await sharp(
  canvas(
    `<text x="80" y="160" ${type} font-size="20" font-weight="700" fill="${ink}">FROM FLAT TO FORM.</text><text x="75" y="290" ${type} font-size="105" font-weight="900" letter-spacing="-6" fill="${ink}">A NEW</text><text x="75" y="390" ${type} font-size="105" font-weight="900" letter-spacing="-6" fill="${orange}">ANGLE.</text>${box(800, 130, 1)}`,
  ),
)
  .png()
  .toFile(folder + '/packaging.png');
const ff = spawnSync(
  'ffmpeg',
  [
    '-hide_banner',
    '-loglevel',
    'error',
    '-y',
    '-loop',
    '1',
    '-i',
    folder + '/artwork.png',
    '-vf',
    "zoompan=z='min(zoom+0.00035,1.06)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=120:s=1600x1000:fps=30",
    '-t',
    '4',
    '-an',
    '-c:v',
    'libx264',
    '-pix_fmt',
    'yuv420p',
    '-crf',
    '23',
    '-movflags',
    '+faststart',
    folder + '/motion.mp4',
  ],
  { encoding: 'utf8', windowsHide: true, timeout: 120000 },
);
if (ff.status !== 0)
  throw Error('FFmpeg required to generate the original silent motion study: ' + ff.stderr);
writeFileSync(
  folder + '/README.md',
  'Original Nesomn Studio Kit internal concept. Demo / Sample; no client commission or product for sale. Generated by node scripts/generate-studio-kit.mjs with Sharp and local FFmpeg. No third-party stock assets. The sample is not seeded automatically.\n',
);
console.log('Generated original Studio Kit images and silent4second MP4.');

await sharp(Buffer.from(poster())).png().toFile(folder+'/box-artwork.png');
