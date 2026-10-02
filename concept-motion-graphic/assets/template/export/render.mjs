/* ============================================================
   모션그래픽 → 영상/이미지 추출
   사용법 (이 폴더에서):
     node render.mjs clips            스텝마다 MP4 한 개 (PPT용)  → clips/
     node render.mjs full             전체를 이어 붙인 MP4 한 개   → <폴더명>_전체.mp4
     node render.mjs scenes           장면마다 MP4 한 개 (문서 삽입용) → scenes/
     node render.mjs snap 8 10.5      특정 위치의 PNG (검수용)     → snaps/
   옵션: --fps 60  --tail 0.4(스텝 끝 정지 시간)  --hold 1.0(full 에서 스텝 사이 정지)
         --from 3 --to 10 (clips 범위)  --v basic (초보자 버전)  --logo (로고 포함)
   ============================================================ */
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const PROJ = path.basename(ROOT); // 결과 파일 이름에 쓰는 프로젝트 폴더 이름
const args = process.argv.slice(2);
const mode = args[0] || 'help';
const opt = (name, def) => { const i = args.indexOf('--' + name); return i >= 0 ? args[i + 1] : def; };
const FPS = +opt('fps', 60);
const TAIL = +opt('tail', 0.4);
const HOLD = +opt('hold', 1.0);
const V = opt('v', 'full') === 'basic' ? 'basic' : 'full'; // --v basic → 초보자 버전
const SUF = V === 'basic' ? '_basic' : '';

async function openPage() {
  const launch = { args: ['--force-device-scale-factor=1', '--disable-gpu-vsync'] };
  let browser;
  try { browser = await chromium.launch({ ...launch, channel: 'chrome' }); }
  catch { browser = await chromium.launch(launch); }
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  page.on('pageerror', (e) => console.error('[page error]', e.message));
  await page.goto(pathToFileURL(path.join(ROOT, 'index.html')).href + '?export=1&v=' + V + (args.includes('--logo') ? '&logo=1' : ''));
  await page.waitForFunction(() => window.MG && window.MG.ready === true, null, { timeout: 30000 });
  const steps = await page.evaluate(() => MG.steps());
  return { browser, page, steps };
}
const grab = async (page) => Buffer.from(await page.evaluate(() => document.getElementById('c').toDataURL('image/png').split(',')[1]), 'base64');

function ffmpeg(out) {
  return spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'png', '-i', '-',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '16', '-pix_fmt', 'yuv420p', '-r', String(FPS), '-movflags', '+faststart', out],
  { stdio: ['pipe', 'inherit', 'inherit'] });
}
async function feed(proc, buf) { if (!proc.stdin.write(buf)) await new Promise((r) => proc.stdin.once('drain', r)); }
const finish = (proc) => new Promise((res, rej) => { proc.on('close', (c) => (c === 0 ? res() : rej(new Error('ffmpeg exit ' + c)))); proc.stdin.end(); });
const pad = (n) => String(n).padStart(2, '0');
const clipName = (s) => `${pad(s.g)}_장면${s.scene}-${s.local}`;

async function snap(positions) {
  const { browser, page, steps } = await openPage();
  fs.mkdirSync(path.join(HERE, 'snaps' + SUF), { recursive: true });
  for (const P of positions) {
    const gi = Math.max(1, Math.ceil(P - 1e-9)), s = steps[gi - 1];
    const T = s.t0 + (P - (gi - 1)) * s.d;
    await page.evaluate(([P, T]) => MG.renderState(P, T), [P, T]);
    const out = path.join(HERE, 'snaps' + SUF, `pos_${String(P).replace('.', '_')}.png`);
    fs.writeFileSync(out, await grab(page));
    console.log(out);
  }
  await browser.close();
}

async function clips() {
  const { browser, page, steps } = await openPage();
  const dir = path.join(HERE, 'clips' + SUF);
  fs.mkdirSync(dir, { recursive: true });
  const from = +opt('from', 1), to = +opt('to', steps.length);
  const t0 = Date.now();
  for (const s of steps) {
    if (s.g < from || s.g > to) continue;
    const n = Math.round((s.d + TAIL) * FPS);
    const out = path.join(dir, clipName(s) + '.mp4');
    const proc = ffmpeg(out);
    for (let f = 0; f <= n; f++) {
      await page.evaluate(([g, t]) => MG.renderStep(g, t), [s.g, f / FPS]);
      const buf = await grab(page);
      if (f === 0) fs.writeFileSync(path.join(dir, clipName(s) + '_시작.png'), buf);
      if (f === n) fs.writeFileSync(path.join(dir, clipName(s) + '_끝.png'), buf);
      await feed(proc, buf);
    }
    await finish(proc);
    console.log(`[${s.g}/${steps.length}] ${clipName(s)}  (${s.title} · ${s.note})  ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  }
  fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify(steps.map((s) => ({ ...s, file: clipName(s) + '.mp4', seconds: +(s.d + TAIL).toFixed(2) })), null, 2));
  await browser.close();
}

async function full() {
  const { browser, page, steps } = await openPage();
  const out = path.join(HERE, `${PROJ}_전체${SUF}.mp4`);
  const proc = ffmpeg(out);
  const t0 = Date.now();
  for (const s of steps) {
    const n = Math.round((s.d + HOLD) * FPS);
    for (let f = 0; f < n; f++) {
      await page.evaluate(([g, t]) => MG.renderStep(g, t), [s.g, f / FPS]);
      await feed(proc, await grab(page));
    }
    console.log(`[${s.g}/${steps.length}] ${s.title} · ${s.note}  ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  }
  await finish(proc);
  await browser.close();
  console.log(out);
}

// 장면마다 MP4 한 개 (스텝 사이 HOLD 초 정지) — Notion·문서 삽입용
async function scenes() {
  const { browser, page, steps } = await openPage();
  const dir = path.join(HERE, 'scenes' + SUF);
  fs.mkdirSync(dir, { recursive: true });
  const ids = [...new Set(steps.map((s) => s.scene))];
  for (const sc of ids) {
    const ss = steps.filter((s) => s.scene === sc);
    const out = path.join(dir, `장면${sc}_${ss[0].title.replace(/^\d+\s*/, '').replace(/[\s:=/]+/g, '_')}.mp4`);
    const proc = ffmpeg(out);
    for (const s of ss) {
      const n = Math.round((s.d + HOLD) * FPS);
      for (let f = 0; f < n; f++) {
        await page.evaluate(([g, t]) => MG.renderStep(g, t), [s.g, f / FPS]);
        await feed(proc, await grab(page));
      }
    }
    await finish(proc);
    console.log(out, (fs.statSync(out).size / 1e6).toFixed(1) + 'MB');
  }
  await browser.close();
}

if (mode === 'scenes') await scenes();
else if (mode === 'snap') await snap(args.slice(1).map(Number).filter((n) => !Number.isNaN(n)));
else if (mode === 'clips') await clips();
else if (mode === 'full') await full();
else console.log(fs.readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').slice(0, 10).join('\n'));
