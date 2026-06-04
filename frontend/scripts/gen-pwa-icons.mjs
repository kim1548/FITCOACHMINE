// FitCoach 마크(mockup/상단마크.html 변형 A)로부터 PWA·파비콘 PNG를 생성한다.
// 실행:  node scripts/gen-pwa-icons.mjs
import sharp from 'sharp';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'public');

// 라운드 사각 — 투명 모서리 허용(브라우저 탭/안드로이드 any 아이콘용).
const rounded = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="14" fill="#c43c2f"/>
  <rect x="23" y="15" width="11" height="34" fill="#f0e8d8"/>
  <rect x="23" y="15" width="25" height="11" fill="#f0e8d8"/>
  <rect x="23" y="29" width="18" height="10" fill="#f0e8d8"/>
</svg>`;

// 풀블리드 — 모서리까지 꽉 채움(iOS apple-touch·maskable: 플랫폼이 직접 라운딩/마스킹).
const fullBleed = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" fill="#c43c2f"/>
  <rect x="23" y="15" width="11" height="34" fill="#f0e8d8"/>
  <rect x="23" y="15" width="25" height="11" fill="#f0e8d8"/>
  <rect x="23" y="29" width="18" height="10" fill="#f0e8d8"/>
</svg>`;

const jobs = [
  ['pwa-192x192.png', rounded, 192],
  ['pwa-512x512.png', rounded, 512],
  ['pwa-maskable-512x512.png', fullBleed, 512],
  ['apple-touch-icon-180.png', fullBleed, 180],
  ['favicon-32.png', rounded, 32],
];

for (const [name, svg, size] of jobs) {
  await sharp(Buffer.from(svg)).resize(size, size).png().toFile(join(out, name));
  console.log(`✓ ${name} (${size}px)`);
}
