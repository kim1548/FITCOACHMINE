// 일회성 마이그레이션: className 의 고정 px 아바트러리 값 [Npx] → [N/16 rem].
// 루트 글꼴(html font-size)을 화면폭 비례로 두면 이 값들이 함께 비례 확대된다.
// 나누기 16 이라 루트=16px 기준(모바일·노트북)에선 현재와 픽셀 단위로 동일.
//
// 매칭은 정확히 "[<숫자>px]" 형태만 → min(88vw,1700px) 같은 복합값은 건드리지 않는다.
import { readdirSync, statSync, readFileSync, writeFileSync } from 'node:fs';
import { join, extname } from 'node:path';

const ROOT = 'src';
const files = [];
function walk(d) {
  for (const e of readdirSync(d)) {
    const p = join(d, e);
    const s = statSync(p);
    if (s.isDirectory()) walk(p);
    else if (['.jsx', '.js'].includes(extname(p))) files.push(p);
  }
}
walk(ROOT);

let totalRepl = 0, filesChanged = 0;
for (const f of files) {
  const txt = readFileSync(f, 'utf8');
  let n = 0;
  const out = txt.replace(/\[(\d+)px\]/g, (_m, num) => {
    n++;
    const rem = Number(num) / 16;
    const s = rem.toFixed(4).replace(/0+$/, '').replace(/\.$/, '');
    return `[${s}rem]`;
  });
  if (n > 0) {
    writeFileSync(f, out);
    filesChanged++;
    totalRepl += n;
    console.log(`${f}: ${n}`);
  }
}
console.log(`\n파일 ${filesChanged}개, 치환 ${totalRepl}개`);
