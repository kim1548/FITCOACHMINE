// mockup/아바타1~6.png 를 (1) 가장자리에서 연결된 밝은 배경(흰/체커)을 투명 처리하고
// (2) 256px 정사각 PNG 로 최적화해 src/assets/avatars/ 에 넣는다.
//
// 플러드필로 "테두리에 연결된 밝고 무채색인 픽셀"만 지우므로, 캐릭터 내부의
// 흰색(판다 얼굴·옷 등)은 외곽선에 막혀 보존된다.
//
// 실행:  node scripts/gen-avatars.mjs
import sharp from 'sharp';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { mkdirSync } from 'node:fs';

const root = dirname(fileURLToPath(import.meta.url));
const srcDir = join(root, '..', 'mockup');
const outDir = join(root, '..', 'src', 'assets', 'avatars');
mkdirSync(outDir, { recursive: true });

const COUNT = 12;

// 배경 후보: 밝고(>=232) 거의 무채색(채널차 <=14)인 픽셀.
function isBg(data, idx) {
  const o = idx * 4;
  const r = data[o], g = data[o + 1], b = data[o + 2];
  return r >= 232 && g >= 232 && b >= 232 && Math.max(r, g, b) - Math.min(r, g, b) <= 14;
}

async function process(i) {
  const { data, info } = await sharp(join(srcDir, `아바타${i}.png`))
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width, height } = info;
  const N = width * height;
  const mark = new Uint8Array(N);
  const stack = new Int32Array(N);
  let sp = 0;
  const seed = (idx) => { if (!mark[idx] && isBg(data, idx)) { mark[idx] = 1; stack[sp++] = idx; } };

  for (let x = 0; x < width; x++) { seed(x); seed((height - 1) * width + x); }
  for (let y = 0; y < height; y++) { seed(y * width); seed(y * width + (width - 1)); }

  while (sp > 0) {
    const idx = stack[--sp];
    const x = idx % width, y = (idx / width) | 0;
    if (x > 0) seed(idx - 1);
    if (x < width - 1) seed(idx + 1);
    if (y > 0) seed(idx - width);
    if (y < height - 1) seed(idx + width);
  }

  let cleared = 0;
  for (let p = 0; p < N; p++) if (mark[p]) { data[p * 4 + 3] = 0; cleared++; }

  await sharp(data, { raw: { width, height, channels: 4 } })
    .resize(256, 256, { fit: 'cover', position: 'centre' })
    .png({ compressionLevel: 9 })
    .toFile(join(outDir, `avatar${i}.png`));

  console.log(`✓ avatar${i}.png  (배경 ${Math.round((cleared / N) * 100)}% 투명화)`);
}

for (let i = 1; i <= COUNT; i++) await process(i);
