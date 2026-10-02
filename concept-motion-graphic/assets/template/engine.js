/* ============================================================
   개념 설명 모션그래픽 — 스텝 엔진 (concept-motion-graphic 스킬 템플릿)
   - 모든 장면은 "로컬 스텝 위치 S (연속값)" 의 함수로 그려진다.
     S = 2.4 → 1·2번 스텝 완료, 3번 스텝 40% 진행 중.
   - 그래서 앞/뒤 이동, 일시정지, 영상 추출이 전부 같은 코드로 된다.
   ============================================================ */
(function () {
  'use strict';
  const W = 1920, H = 1080;

  // ---------- 팔레트 (3Blue1Brown 톤) ----------
  const C = {
    bg: '#000000', white: '#FFFFFF', text: '#ECECEC', dim: '#BDBDBD', grey: '#8C8C8C',
    grey2: '#5E5E5E', grey3: '#2E2E2E', grey4: '#181818',
    blue: '#58C4DD', teal: '#5CD0B3', yellow: '#FFD84D', gold: '#F0AC5F',
    red: '#FC6255', green: '#83C167', purple: '#A98BD8', lblue: '#9CDCEB', pink: '#EE7FA8',
  };
  const CAPC = { y: C.yellow, b: C.blue, t: C.teal, r: C.red, g: C.green, w: C.white, o: C.gold, p: C.purple, d: C.grey };

  // ---------- 수학 ----------
  const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
  const lerp = (a, b, t) => a + (b - a) * t;
  const sub = (p, a, b) => clamp((p - a) / (b - a));
  const ease = (t) => { t = clamp(t); return t * t * t * (t * (6 * t - 15) + 10); };
  const easeOut = (t) => { t = clamp(t); return 1 - Math.pow(1 - t, 3); };
  const easeIn = (t) => { t = clamp(t); return t * t * t; };
  const easeInOut = (t) => { t = clamp(t); return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
  const back = (t) => { t = clamp(t); const c = 1.7; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };
  const rnd = (i) => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
  // 스텝 a 의 진행도 (0~1)
  const st = (S, a) => clamp(S - (a - 1));
  // 스텝 a 에 나타나서 스텝 b 에 사라지는 요소의 알파
  const vis = (S, a, b, inA = 0, inB = 0.35, outA = 0, outB = 0.3) => {
    let v = ease(sub(st(S, a), inA, inB));
    if (b !== undefined) v *= 1 - ease(sub(st(S, b), outA, outB));
    return v;
  };

  // ---------- 색 ----------
  const hexRgb = (h) => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  const rgba = (h, a) => { const [r, g, b] = hexRgb(h); return `rgba(${r},${g},${b},${a})`; };
  const mix = (h1, h2, t) => {
    const a = hexRgb(h1), b = hexRgb(h2);
    const c = a.map((v, i) => Math.round(lerp(v, b[i], clamp(t))));
    return '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('');
  };

  // ---------- 캔버스 ----------
  let ctx = null;
  const fontOf = (o) => {
    const sz = o.size || 36;
    switch (o.font) {
      case 'serif': return `${o.weight || 400} ${sz}px "MG Serif","MG Sans",serif`;
      case 'serifI': return `italic 400 ${sz}px "MG Serif","MG Sans",serif`;
      case 'math': return `italic 400 ${sz}px "MG Math","MG Serif","MG Sans",serif`;
      default: return `${o.weight || 500} ${sz}px "MG Sans","Pretendard Variable",Pretendard,"Apple SD Gothic Neo",sans-serif`;
    }
  };
  const mcache = new Map();
  function tw(str, o = {}) {
    const f = fontOf(o), k = f + '|' + str;
    let v = mcache.get(k);
    if (v === undefined) { ctx.save(); ctx.font = f; v = ctx.measureText(str).width; ctx.restore(); mcache.set(k, v); }
    return v;
  }
  const A = (o) => (o.alpha === undefined ? 1 : o.alpha);

  function text(str, x, y, o = {}) {
    const a = A(o); if (a <= 0.003 || str === '' || str == null) return;
    ctx.save(); ctx.globalAlpha *= a;
    ctx.font = fontOf(o); ctx.fillStyle = o.color || C.text;
    ctx.textAlign = o.align || 'left'; ctx.textBaseline = o.base || 'middle';
    if (o.glow) { ctx.shadowColor = o.glow; ctx.shadowBlur = o.blur || 22; }
    if (o.scale !== undefined && o.scale !== 1) { ctx.translate(x, y); ctx.scale(o.scale, o.scale); ctx.fillText(str, 0, 0); }
    else ctx.fillText(str, x, y);
    ctx.restore();
  }

  // 3b1b 의 Write 애니메이션: 글자 윤곽선이 그려진 뒤 속이 채워진다.
  function writeText(str, x, y, p, o = {}) {
    if (p <= 0) return;
    if (p >= 1) { text(str, x, y, o); return; }
    const a = A(o); if (a <= 0.003) return;
    const chars = [...str], n = chars.length, size = o.size || 36;
    const total = tw(str, o);
    const al = o.align || 'left';
    const x0 = al === 'center' ? x - total / 2 : al === 'right' ? x - total : x;
    const lag = n > 1 ? 0.55 / (n - 1) : 0, span = 0.45;
    ctx.save();
    ctx.font = fontOf(o); ctx.textAlign = 'left'; ctx.textBaseline = o.base || 'middle';
    ctx.fillStyle = o.color || C.text; ctx.strokeStyle = o.color || C.text;
    ctx.lineWidth = Math.max(1, size / 30); ctx.lineJoin = 'round';
    let acc = '';
    for (let i = 0; i < n; i++) {
      const ch = chars[i]; const cx = x0 + tw(acc, o); acc += ch;
      if (ch === ' ') continue;
      const q = sub(p, i * lag, i * lag + span); if (q <= 0) continue;
      const sq = sub(q, 0, 0.75), fq = sub(q, 0.4, 1);
      if (fq < 1) {
        ctx.setLineDash([sq * size * 7, 99999]);
        ctx.globalAlpha = a * (1 - fq);
        ctx.strokeText(ch, cx, y);
      }
      if (fq > 0) { ctx.setLineDash([]); ctx.globalAlpha = a * fq; ctx.fillText(ch, cx, y); }
    }
    ctx.restore();
  }

  function fadeText(str, x, y, p, o = {}) {
    if (p <= 0) return;
    const e = ease(p);
    text(str, x, y + (1 - e) * (o.rise === undefined ? 14 : o.rise), Object.assign({}, o, { alpha: A(o) * e }));
  }

  // {y|강조} 마크업을 쓰는 여러 색 문장
  function parseRich(str) {
    const out = []; const re = /\{(\w)\|([^}]*)\}/g; let last = 0, m;
    while ((m = re.exec(str))) {
      if (m.index > last) out.push({ t: str.slice(last, m.index), c: null });
      out.push({ t: m[2], c: CAPC[m[1]] || C.white }); last = re.lastIndex;
    }
    if (last < str.length) out.push({ t: str.slice(last), c: null });
    return out;
  }
  function richWidth(str, o = {}) { return parseRich(str).reduce((s, seg) => s + tw(seg.t, seg.c ? Object.assign({}, o, { weight: o.hiWeight || 700 }) : o), 0); }
  function rich(str, x, y, o = {}) {
    const a = A(o); if (a <= 0.003) return 0;
    const segs = parseRich(str);
    const ws = segs.map((s) => tw(s.t, s.c ? Object.assign({}, o, { weight: o.hiWeight || 700 }) : o));
    const total = ws.reduce((s, v) => s + v, 0);
    const al = o.align || 'left';
    let cx = al === 'center' ? x - total / 2 : al === 'right' ? x - total : x;
    segs.forEach((s, i) => {
      text(s.t, cx, y, Object.assign({}, o, { align: 'left', color: s.c || o.color || C.text, weight: s.c ? (o.hiWeight || 700) : o.weight }));
      cx += ws[i];
    });
    return total;
  }

  // ---------- 도형 ----------
  function rrPath(x, y, w, h, r) { ctx.beginPath(); ctx.roundRect(x, y, w, h, Math.max(0, Math.min(r, w / 2, h / 2))); }
  function rect(x, y, w, h, o = {}) {
    const a = A(o); if (a <= 0.003 || w <= 0 || h <= 0) return;
    ctx.save(); ctx.globalAlpha *= a;
    rrPath(x, y, w, h, o.r === undefined ? 10 : o.r);
    if (o.glow) { ctx.shadowColor = o.glow; ctx.shadowBlur = o.blur || 24; }
    if (o.fill) { ctx.fillStyle = o.fill; ctx.fill(); }
    ctx.shadowBlur = 0;
    if (o.stroke) {
      ctx.lineWidth = o.lw || 2; ctx.strokeStyle = o.stroke;
      if (o.draw !== undefined && o.draw < 1) { const per = 2 * (w + h); ctx.setLineDash([per * clamp(o.draw), per * 2]); }
      else if (o.dash) ctx.setLineDash(o.dash);
      ctx.stroke();
    }
    ctx.restore();
  }
  function circle(x, y, r, o = {}) {
    const a = A(o); if (a <= 0.003 || r <= 0) return;
    ctx.save(); ctx.globalAlpha *= a; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
    if (o.glow) { ctx.shadowColor = o.glow; ctx.shadowBlur = o.blur || 20; }
    if (o.fill) { ctx.fillStyle = o.fill; ctx.fill(); }
    ctx.shadowBlur = 0;
    if (o.stroke) { ctx.lineWidth = o.lw || 2; ctx.strokeStyle = o.stroke; ctx.stroke(); }
    ctx.restore();
  }
  function line(x1, y1, x2, y2, o = {}) {
    const a = A(o); if (a <= 0.003) return;
    ctx.save(); ctx.globalAlpha *= a; ctx.strokeStyle = o.color || C.white; ctx.lineWidth = o.lw || 2; ctx.lineCap = o.cap || 'round';
    if (o.dash) ctx.setLineDash(o.dash);
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); ctx.restore();
  }
  function head(x, y, ang, sz, color) {
    ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(x, y);
    ctx.lineTo(x - Math.cos(ang - 0.42) * sz, y - Math.sin(ang - 0.42) * sz);
    ctx.lineTo(x - Math.cos(ang + 0.42) * sz, y - Math.sin(ang + 0.42) * sz);
    ctx.closePath(); ctx.fill();
  }
  // 곧은 화살표 (p: 자라나는 정도)
  function arrow(x1, y1, x2, y2, p = 1, o = {}) {
    const a = A(o); if (p <= 0 || a <= 0.003) return;
    const ex = lerp(x1, x2, p), ey = lerp(y1, y2, p), ang = Math.atan2(y2 - y1, x2 - x1);
    const len = Math.hypot(ex - x1, ey - y1), hs = Math.min(o.head || 20, len * 0.7);
    ctx.save(); ctx.globalAlpha *= a; const col = o.color || C.white;
    ctx.strokeStyle = col; ctx.lineWidth = o.lw || 4; ctx.lineCap = 'round';
    if (o.glow) { ctx.shadowColor = o.glow; ctx.shadowBlur = 16; }
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(ex - Math.cos(ang) * hs * 0.6, ey - Math.sin(ang) * hs * 0.6); ctx.stroke();
    head(ex, ey, ang, hs, col); ctx.restore();
  }
  // 경로 함수 f(t)->[x,y] 를 따라 그리는 곡선/화살표
  function pathLine(f, p0, p1, o = {}) {
    const a = A(o); if (p1 - p0 <= 0.001 || a <= 0.003) return;
    const n = o.n || 48;
    ctx.save(); ctx.globalAlpha *= a; const col = o.color || C.white;
    ctx.strokeStyle = col; ctx.lineWidth = o.lw || 4; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    if (o.glow) { ctx.shadowColor = o.glow; ctx.shadowBlur = o.blur || 16; }
    if (o.dash) ctx.setLineDash(o.dash);
    ctx.beginPath();
    for (let i = 0; i <= n; i++) { const [x, y] = f(lerp(p0, p1, i / n)); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
    ctx.stroke();
    if (o.head) {
      const [x2, y2] = f(p1), [x1, y1] = f(Math.max(p0, p1 - 0.02));
      ctx.setLineDash([]); head(x2, y2, Math.atan2(y2 - y1, x2 - x1), o.head, col);
    }
    ctx.restore();
  }
  const qbez = (x1, y1, cx, cy, x2, y2) => (t) => [
    (1 - t) * (1 - t) * x1 + 2 * (1 - t) * t * cx + t * t * x2,
    (1 - t) * (1 - t) * y1 + 2 * (1 - t) * t * cy + t * t * y2,
  ];
  const cbez = (x1, y1, c1x, c1y, c2x, c2y, x2, y2) => (t) => {
    const u = 1 - t;
    return [u * u * u * x1 + 3 * u * u * t * c1x + 3 * u * t * t * c2x + t * t * t * x2,
      u * u * u * y1 + 3 * u * u * t * c1y + 3 * u * t * t * c2y + t * t * t * y2];
  };
  function glowDot(x, y, r, color, a = 1) {
    if (a <= 0.003) return;
    ctx.save(); ctx.globalAlpha *= a;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, rgba(color, 1)); g.addColorStop(0.25, rgba(color, 0.55)); g.addColorStop(1, rgba(color, 0));
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  }
  // 다이얼 (ang: 0 = 12시 방향, 시계방향 +)
  function dial(x, y, r, ang, o = {}) {
    const a = A(o); if (a <= 0.003 || r < 0.6) return;
    const col = o.color || C.dim;
    ctx.save(); ctx.globalAlpha *= a;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = o.fill || 'rgba(20,20,20,0.9)'; ctx.fill();
    ctx.lineWidth = o.lw || Math.max(1, r * 0.09); ctx.strokeStyle = col; ctx.stroke();
    if (o.ticks) {
      ctx.lineWidth = Math.max(0.8, r * 0.04);
      for (let k = 0; k < 12; k++) {
        const t = (k / 12) * Math.PI * 2;
        ctx.beginPath(); ctx.moveTo(x + Math.sin(t) * r * 0.78, y - Math.cos(t) * r * 0.78);
        ctx.lineTo(x + Math.sin(t) * r * 0.9, y - Math.cos(t) * r * 0.9); ctx.stroke();
      }
    }
    ctx.strokeStyle = o.needle || col; ctx.lineWidth = Math.max(1.2, r * 0.12); ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.sin(ang) * r * 0.72, y - Math.cos(ang) * r * 0.72); ctx.stroke();
    ctx.fillStyle = o.needle || col; ctx.beginPath(); ctx.arc(x, y, Math.max(1, r * 0.12), 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
  // 사람 실루엣
  function person(x, y, s, o = {}) {
    const a = A(o); if (a <= 0.003) return;
    ctx.save(); ctx.globalAlpha *= a; ctx.fillStyle = o.color || C.dim;
    ctx.beginPath(); ctx.arc(x, y - s * 0.55, s * 0.27, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(x, y + s * 0.42, s * 0.5, s * 0.52, 0, Math.PI, 0); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  // 문서 아이콘
  function doc(x, y, w, h, o = {}) {
    const a = A(o); if (a <= 0.003) return;
    rect(x - w / 2, y - h / 2, w, h, { fill: o.fill || 'rgba(30,30,30,0.95)', stroke: o.color || C.grey, lw: o.lw || 1.5, r: Math.min(4, w * 0.1), alpha: a });
    const n = o.lines || 4;
    for (let i = 0; i < n; i++) {
      const yy = y - h / 2 + h * (0.25 + (0.55 * i) / Math.max(1, n - 1));
      line(x - w * 0.3, yy, x + w * (i === n - 1 ? 0.05 : 0.3), yy, { color: o.color || C.grey, lw: Math.max(1, h * 0.04), alpha: a * 0.8 });
    }
  }
  // 단어 타일
  function tile(str, cx, cy, o = {}) {
    const a = A(o); if (a <= 0.003) return;
    const size = o.size || 40, padX = o.padX || size * 0.42, h = o.h || size * 1.55;
    const w = tw(str, { size, weight: o.weight || 600 }) + padX * 2;
    const sc = o.scale === undefined ? 1 : o.scale;
    ctx.save(); ctx.translate(cx, cy); ctx.scale(sc, sc);
    rect(-w / 2, -h / 2, w, h, { fill: o.fill || 'rgba(26,26,26,0.95)', stroke: o.stroke || C.grey2, lw: o.lw || 2, r: o.r || 10, alpha: a, glow: o.glow });
    text(str, 0, 1, { size, weight: o.weight || 600, color: o.color || C.text, align: 'center', alpha: a });
    ctx.restore();
    return w;
  }
  const tileW = (str, o = {}) => { const size = o.size || 40; return tw(str, { size, weight: o.weight || 600 }) + (o.padX || size * 0.42) * 2; };
  // 타일 여러 개를 가로로 배치 → 각 중심 x 좌표
  function layoutTiles(words, x, o = {}) {
    const gap = o.gap === undefined ? 14 : o.gap;
    const ws = words.map((w) => tileW(w, o));
    const total = ws.reduce((s, v) => s + v, 0) + gap * (words.length - 1);
    let cx = o.align === 'center' ? x - total / 2 : x;
    return ws.map((w) => { const c = cx + w / 2; cx += w + gap; return { x: c, w }; });
  }

  // 숫자 벡터 (세로 대괄호)
  const fmtNum = (v, d = 2) => (typeof v === 'string' ? v : (v < 0 ? '−' : '') + Math.abs(v).toFixed(d));
  function vecCol(x, y, vals, p, o = {}) {
    const a = A(o); if (p <= 0 || a <= 0.003) return;
    const fs = o.size || 26, rowH = fs * (o.rowH || 1.22), n = vals.length;
    const colW = o.w || fs * 3.3, h = n * rowH + fs * 0.5;
    const bp = ease(sub(p, 0, 0.45));
    const col = o.bracket || C.dim, lw = o.lw || 2.2, sw = Math.max(6, fs * 0.3);
    ctx.save(); ctx.globalAlpha *= a; ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.lineCap = 'square';
    const hh = (h / 2) * bp;
    for (const s of [-1, 1]) {
      const bx = x + (s * colW) / 2;
      ctx.beginPath(); ctx.moveTo(bx - s * sw, y - hh); ctx.lineTo(bx, y - hh); ctx.lineTo(bx, y + hh); ctx.lineTo(bx - s * sw, y + hh); ctx.stroke();
    }
    ctx.restore();
    vals.forEach((v, i) => {
      const q = sub(p, 0.15 + (i * 0.55) / n, 0.45 + (i * 0.55) / n);
      if (q <= 0) return;
      const yy = y - (n * rowH) / 2 + rowH * (i + 0.5);
      const color = o.colors ? o.colors[i] : (o.color || C.text);
      text(fmtNum(v, o.digits), x, yy, { size: fs, font: 'serif', align: 'center', color, alpha: a * ease(q) });
    });
    return { w: colW, h };
  }

  // 확률 막대 목록
  function bars(x, y, items, p, o = {}) {
    const a = A(o); if (p <= 0 || a <= 0.003) return;
    const gap = o.gap || 76, size = o.size || 38, maxW = o.maxW || 420, bh = o.bh || size * 0.8;
    const vmax = o.vmax || Math.max(...items.map((i) => i.v));
    const stag = o.stag === undefined ? 0.12 : o.stag;
    items.forEach((it, i) => {
      const q = ease(sub(p, i * stag, i * stag + 0.6));
      if (q <= 0) return;
      const yy = y + i * gap;
      const la = it.dim ? 0.35 : 1;
      text(it.w, x, yy, { size, weight: it.hl ? 700 : 500, color: it.hl ? C.white : C.text, align: 'right', alpha: a * Math.min(1, q * 2) * la });
      const bw = Math.max(0.5, (maxW * it.v) / vmax * q);
      rect(x + 26, yy - bh / 2, bw, bh, { fill: it.c || C.blue, r: 4, alpha: a * la * 0.95, glow: it.hl ? it.c : null, blur: 18 });
      const pct = o.frac ? (it.v * 100 * q).toFixed(1) : Math.round(it.v * 100 * q);
      text(pct + '%', x + 26 + bw + 16, yy + 2, { size: size * 0.9, font: 'serif', color: it.hl ? C.white : C.dim, alpha: a * Math.min(1, q * 2) * la });
    });
  }

  // ---------- 3D: 레이어 블록 ----------
  function cam(o) {
    const cy = Math.cos(o.yaw || 0), sy = Math.sin(o.yaw || 0), cp = Math.cos(o.pitch || 0), sp = Math.sin(o.pitch || 0);
    const D = o.dist || 16, s = o.s || 100, ox = o.x === undefined ? W / 2 : o.x, oy = o.y === undefined ? H / 2 : o.y;
    return {
      s,
      p(X, Y, Z) {
        const x = X * cy + Z * sy, z1 = -X * sy + Z * cy;
        const y = Y * cp - z1 * sp, z = Y * sp + z1 * cp;
        const f = D / (D - z);
        return [ox + x * f * s, oy - y * f * s, z];
      },
      nz(X, Y, Z) { const z1 = -X * sy + Z * cy; return Y * sp + z1 * cp; },
    };
  }
  const FACES = [
    { v: [0, 4, 6, 2], n: [-1, 0, 0], k: 'L' }, { v: [1, 3, 7, 5], n: [1, 0, 0], k: 'R' },
    { v: [0, 1, 5, 4], n: [0, -1, 0], k: 'B' }, { v: [2, 6, 7, 3], n: [0, 1, 0], k: 'T' },
    { v: [0, 2, 3, 1], n: [0, 0, -1], k: 'K' }, { v: [4, 5, 7, 6], n: [0, 0, 1], k: 'F' },
  ];
  const SHADE = { T: 1.35, F: 1.0, L: 0.82, R: 0.62, B: 0.5, K: 0.55 };
  function box3(cm, cx, cy, cz, hx, hy, hz, o) {
    const V = [];
    for (let i = 0; i < 8; i++) V.push(cm.p(cx + (i & 1 ? hx : -hx), cy + (i & 2 ? hy : -hy), cz + (i & 4 ? hz : -hz)));
    const a = o.alpha === undefined ? 1 : o.alpha;
    const base = hexRgb(o.fill || '#3A3A3A');
    for (const f of FACES) {
      if (cm.nz(...f.n) <= 0.0005) continue;
      ctx.beginPath(); f.v.forEach((vi, j) => (j ? ctx.lineTo(V[vi][0], V[vi][1]) : ctx.moveTo(V[vi][0], V[vi][1]))); ctx.closePath();
      const sh = SHADE[f.k];
      ctx.fillStyle = `rgba(${Math.min(255, base[0] * sh) | 0},${Math.min(255, base[1] * sh) | 0},${Math.min(255, base[2] * sh) | 0},${(o.fa === undefined ? 0.9 : o.fa) * a})`;
      ctx.fill();
      ctx.strokeStyle = rgba(o.edge || '#BDBDBD', (o.ea === undefined ? 0.85 : o.ea) * a); ctx.lineWidth = o.lw || 1.6; ctx.lineJoin = 'round';
      ctx.stroke();
    }
    return V;
  }
  function dial3(cm, P, u, v, r, ang, o) {
    // P: 중심, u/v: 면 위의 단위 방향벡터(월드), r: 반지름
    const c = cm.p(...P);
    const pu = cm.p(P[0] + u[0] * r, P[1] + u[1] * r, P[2] + u[2] * r);
    const pv = cm.p(P[0] + v[0] * r, P[1] + v[1] * r, P[2] + v[2] * r);
    const ax = pu[0] - c[0], ay = pu[1] - c[1], bx = pv[0] - c[0], by = pv[1] - c[1];
    if (Math.hypot(ax, ay) < 0.7) return;
    ctx.beginPath();
    for (let k = 0; k <= 18; k++) { const t = (k / 18) * Math.PI * 2; const x = c[0] + ax * Math.cos(t) + bx * Math.sin(t), y = c[1] + ay * Math.cos(t) + by * Math.sin(t); k ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
    ctx.closePath();
    ctx.fillStyle = o.fill; ctx.fill(); ctx.strokeStyle = o.rim; ctx.lineWidth = o.lw; ctx.stroke();
    // 바늘: 면 좌표계에서 ang (0 = v 방향 = 위)
    const nx = c[0] + (ax * Math.sin(ang) + bx * Math.cos(ang)) * 0.75, ny = c[1] + (ay * Math.sin(ang) + by * Math.cos(ang)) * 0.75;
    ctx.strokeStyle = o.needle; ctx.lineWidth = o.lw * 1.2; ctx.beginPath(); ctx.moveTo(c[0], c[1]); ctx.lineTo(nx, ny); ctx.stroke();
  }
  /* 레이어 블록(모델 상자).
     o: x,y,s,yaw,pitch, n(레이어 수), L,h,d(크기), explode(0=통짜 상자,1=레이어 분리), spread,
        hl(i)->0..1 (레이어 하이라이트), hlColor, dials(0..1), rows, cols, dialAng(i,r,c)->rad,
        label, alpha, shellFill, colors(i)->hex */
  function model(o) {
    const a = o.alpha === undefined ? 1 : o.alpha;
    const n = o.n || 8, L = o.L || 3.2, hh = (o.h || 2.2) / 2, dd = (o.d || 2.2) / 2;
    const e = clamp(o.explode || 0);
    const cm = cam(o);
    const spread = lerp(L, L * (o.spread || 1.7), ease(e));
    const shellA = a * (1 - ease(sub(e, 0, 0.55)));
    const slabA = a * ease(sub(e, 0.05, 0.5));
    const res = { cam: cm, left: cm.p(-spread / 2 - 0.05, 0, 0), right: cm.p(spread / 2 + 0.05, 0, 0) };
    if (a <= 0.003) return res;
    ctx.save();
    if (slabA > 0.003) {
      const t = lerp(L / n, o.thick || 0.14, ease(e)) / 2;
      const order = [...Array(n).keys()].map((i) => {
        const cx = -spread / 2 + ((i + 0.5) * spread) / n;
        return { i, cx, z: cm.p(cx, 0, 0)[2] };
      }).sort((p, q) => p.z - q.z);
      for (const { i, cx } of order) {
        const hl = o.hl ? clamp(o.hl(i)) : 0;
        const baseCol = o.colors ? o.colors(i) : (o.fill || '#3C3C3C');
        const fill = mix(baseCol, o.hlColor || C.blue, hl * 0.75);
        box3(cm, cx, 0, 0, t, hh, dd, { fill, alpha: slabA, fa: 0.78, edge: hl > 0.05 ? mix('#BDBDBD', o.hlColor || C.blue, hl) : (o.edge || '#9A9A9A'), ea: 0.9, lw: 1.4 });
        // 다이얼 (왼쪽 면)
        const da = slabA * (o.dials === undefined ? 1 : o.dials);
        if (da > 0.01 && cm.nz(-1, 0, 0) > 0.02) {
          const R = o.rows || 5, Cc = o.cols || 5;
          const r = Math.min((2 * hh) / R, (2 * dd) / Cc) * 0.32;
          ctx.save(); ctx.globalAlpha *= da; ctx.lineCap = 'round';
          const rimCol = hl > 0.05 ? mix('#A0A0A0', o.hlColor || C.blue, hl) : '#A0A0A0';
          for (let rr = 0; rr < R; rr++) for (let c = 0; c < Cc; c++) {
            const Y = hh - ((rr + 0.5) * 2 * hh) / R, Z = -dd + ((c + 0.5) * 2 * dd) / Cc;
            const ang = o.dialAng ? o.dialAng(i, rr, c) : (rnd(i * 97 + rr * 13 + c) - 0.5) * 5;
            dial3(cm, [cx - t - 0.002, Y, Z], [0, 0, 1], [0, 1, 0], r, ang, { fill: 'rgba(12,12,12,0.85)', rim: rimCol, needle: hl > 0.3 ? C.white : '#D0D0D0', lw: Math.max(0.8, r * cm.s * 0.07) });
          }
          ctx.restore();
        }
      }
    }
    if (shellA > 0.003) {
      const hs = clamp(o.hlShell || 0), hc = o.hlColor || C.blue;
      if (hs > 0.01) { const V = cm.p(0, 0, 0); glowDot(V[0], V[1], cm.s * 2.6, hc, shellA * hs * 0.32); }
      box3(cm, 0, 0, 0, L / 2, hh, dd, { fill: mix(o.shellFill || '#333333', hc, hs * 0.4), alpha: shellA, fa: 0.96, edge: mix('#C8C8C8', hc, hs), ea: 0.95, lw: 2 + hs * 1.5 });
      if (o.label) {
        // 앞면(+z)에 라벨을 붙인다
        if (cm.nz(0, 0, 1) > 0.05) {
          const O = cm.p(0, 0, dd), ex = cm.p(1, 0, dd), ey = cm.p(0, -1, dd);
          const k = cm.s;
          ctx.save();
          ctx.transform((ex[0] - O[0]) / k, (ex[1] - O[1]) / k, (ey[0] - O[0]) / k, (ey[1] - O[1]) / k, O[0], O[1]);
          text(o.label, 0, 2, { size: (o.labelSize || 0.62) * k, font: 'serif', weight: 400, color: C.white, align: 'center', alpha: shellA * (o.labelAlpha === undefined ? 1 : o.labelAlpha) });
          ctx.restore();
        }
      }
    }
    ctx.restore();
    return res;
  }

  // 흐르는 패킷(빛나는 점 + 꼬리)
  function comet(f, p, o = {}) {
    if (p <= 0 || p >= 1) return;
    const col = o.color || C.blue, tail = o.tail || 0.18;
    pathLine(f, Math.max(0, p - tail), p, { color: col, lw: o.lw || 5, alpha: (o.alpha === undefined ? 1 : o.alpha) * 0.8, glow: col, n: 20 });
    const [x, y] = f(p); glowDot(x, y, o.r || 22, col, o.alpha === undefined ? 1 : o.alpha);
  }

  // ============================================================
  //  플레이어
  // ============================================================
  const MG = (window.MG = window.MG || {});
  MG.W = W; MG.H = H; MG.C = C; MG.scenes = [];
  MG.scene = (def) => MG.scenes.push(def);
  // 버전: 기본(full) / 초보자(basic). 주소의 ?v=basic 으로 고른다.
  const qv = new URLSearchParams(location.search).get('v');
  MG.variant = qv === 'basic' ? 'basic' : 'full';
  MG.chosen = qv === 'basic' || qv === 'full';
  MG.active = [];
  const titleOf = (sc) => (MG.variant === 'basic' && sc.titleBasic) || sc.title;
  MG.lib = {
    C, clamp, lerp, sub, ease, easeOut, easeIn, easeInOut, back, rnd, st, vis, rgba, mix, hexRgb,
    text, writeText, fadeText, rich, richWidth, tw, rect, circle, line, arrow, pathLine, qbez, cbez, glowDot, dial,
    person, doc, tile, tileW, layoutTiles, vecCol, fmtNum, bars, model, cam, box3, comet, head,
    get ctx() { return ctx; },
  };

  const opts = { captions: true, chapters: true, hud: true, logo: true };
  // 오른쪽 위 서퍼스 로고 (영상 추출 때는 ?logo=1 일 때만)
  let logoImg = null;
  if (window.MG_LOGO_SVG) { logoImg = new Image(); logoImg.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(window.MG_LOGO_SVG); }
  function drawLogo() {
    if (!opts.logo || !logoImg || !logoImg.complete || !logoImg.naturalWidth) return;
    const h = 30, w = h * (logoImg.naturalWidth / logoImg.naturalHeight);
    ctx.save(); ctx.globalAlpha = 0.8; ctx.drawImage(logoImg, W - 80 - w, 76 - h / 2, w, h); ctx.restore();
  }
  let flat = [], N = 0;
  function build() {
    flat = [];
    const vb = MG.variant === 'basic';
    // only: 'full' | 'basic' 로 장면을, skipBasic 으로 스텝을 버전별로 고른다
    MG.active = MG.scenes.filter((sc) => !sc.only || sc.only === MG.variant);
    MG.active.forEach((sc, si) => {
      const lis = sc.steps.map((_, i) => i + 1).filter((li) => !(vb && sc.steps[li - 1].skipBasic));
      sc._first = lis[0]; sc._last = lis[lis.length - 1];
      lis.forEach((li) => { const s = sc.steps[li - 1]; flat.push({ si, li, d: s.d, n: s.n }); });
    });
    N = flat.length;
    let t = 0; flat.forEach((f) => { f.t0 = t; t += f.d; });
  }

  function drawChapter(sc, alpha) {
    if (!opts.chapters || !titleOf(sc) || alpha <= 0.003) return;
    const [num, name] = titleOf(sc);
    text(num, 80, 76, { size: 30, font: 'serif', color: C.grey, alpha });
    text(name, 80 + tw(num, { size: 30, font: 'serif' }) + 16, 77, { size: 27, weight: 500, color: C.grey, alpha });
  }
  // 장면 공통: 하단 자막
  MG.lib.caption = function (str, alpha, o = {}) {
    if (!opts.captions || alpha <= 0.003) return;
    const e = ease(alpha);
    rich(str, W / 2, (o.y || 990) + (1 - e) * 12, { size: o.size || 40, weight: 500, align: 'center', color: C.text, alpha: e });
  };

  function drawScene(sc, S, T) {
    ctx.save();
    sc.draw(S, T);
    ctx.restore();
    drawChapter(sc, titleOf(sc) ? vis(S, 1) : 0);
  }

  // P: 전역 연속 위치 (0..N), T: 앰비언트 시간(초)
  function renderAt(P, T) {
    ctx.save();
    ctx.fillStyle = C.bg; ctx.fillRect(0, 0, W, H);
    if (P > 0 && N > 0) {
      const gi = Math.min(N, Math.max(1, Math.ceil(P - 1e-9)));
      const p = clamp(P - (gi - 1));
      const f = flat[gi - 1], sc = MG.active[f.si];
      let S = f.li - 1 + p;
      if (f.li === sc._first && f.si > 0) {
        const prev = MG.active[f.si - 1];
        const fa = 1 - ease(sub(p, 0, 0.3));
        if (fa > 0.003) { ctx.save(); ctx.globalAlpha = fa; drawScene(prev, prev._last, T); ctx.restore(); }
        S = f.li - 1 + sub(p, 0.26, 1);
      }
      drawScene(sc, S, T);
    }
    drawLogo();
    ctx.restore();
  }

  // ---------- 실행 ----------
  const params = new URLSearchParams(location.search);
  const EXPORT = params.has('export');
  let cvs, dpr = 1, scale = 1, offX = 0, offY = 0;
  let pos = 0, anim = null, paused = false, black = false, lastTs = 0;
  const T0 = performance.now();

  function resize() {
    if (EXPORT) { cvs.width = W; cvs.height = H; cvs.style.width = W + 'px'; cvs.style.height = H + 'px'; dpr = 1; scale = 1; offX = offY = 0; return; }
    dpr = window.devicePixelRatio || 1;
    const w = innerWidth, h = innerHeight;
    cvs.width = Math.round(w * dpr); cvs.height = Math.round(h * dpr);
    cvs.style.width = w + 'px'; cvs.style.height = h + 'px';
    scale = Math.min(w / W, h / H); offX = (w - W * scale) / 2; offY = (h - H * scale) / 2;
  }
  function paint(P, T) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, cvs.width, cvs.height);
    if (black) return;
    ctx.setTransform(dpr * scale, 0, 0, dpr * scale, dpr * offX, dpr * offY);
    ctx.beginPath(); ctx.rect(0, 0, W, H); ctx.clip();
    renderAt(P, T);
  }

  function restIndex() { return anim ? anim.to : Math.round(pos); }
  function start(from, to, dur) { anim = { from, to, t: 0, dur: Math.max(0.01, dur) }; paused = false; }
  function next() {
    if (anim && anim.to > anim.from) { pos = anim.to; anim = null; sync(); return; }
    if (anim) { pos = anim.to; anim = null; }
    const g = Math.round(pos); if (g >= N) return;
    start(g, g + 1, flat[g].d);
  }
  function prev() {
    if (anim && anim.to > anim.from) { pos = anim.from; anim = null; sync(); return; }
    anim = null;
    const g = Math.round(pos); pos = Math.max(1, g - 1); sync();
  }
  function rewind() { anim = null; const g = Math.round(pos); if (g > 1) start(g, g - 1, Math.min(1.0, flat[g - 1].d * 0.5)); }
  function replay() { const g = restIndex(); if (g >= 1) { anim = null; pos = g - 1; start(g - 1, g, flat[g - 1].d); } }
  function jumpScene(si) {
    const idx = flat.findIndex((f) => f.si === si); if (idx < 0) return;
    anim = null; pos = idx; start(idx, idx + 1, flat[idx].d);
  }
  function jumpState(g) { anim = null; pos = clamp(g, 1, N); sync(); }

  // ---------- HUD ----------
  let hudTimer = 0; const $ = (id) => document.getElementById(id);
  function sync() {
    const g = restIndex();
    if (!EXPORT) try { history.replaceState(null, '', '#' + g); } catch (e) {}
    updateHud();
  }
  function updateHud() {
    if (EXPORT) return;
    const g = Math.max(1, restIndex()), f = flat[g - 1]; if (!f) return;
    const sc = MG.active[f.si];
    $('hud-ver').textContent = hasVariants() ? (MG.variant === 'basic' ? '초보자 버전' : '기본 버전') : '';
    $('hud-scene').textContent = (titleOf(sc) ? titleOf(sc).join('  ') : '표지');
    $('hud-step').textContent = `${f.li} / ${sc.steps.length} · ${f.n || ''}`;
    $('hud-count').textContent = `${g} / ${N}`;
    const bar = $('hud-bar');
    if (bar.childElementCount !== N) {
      bar.innerHTML = '';
      flat.forEach((ff, i) => {
        const d = document.createElement('div'); d.className = 'seg' + (ff.li === MG.active[ff.si]._first ? ' first' : '');
        d.title = `${i + 1}. ${(titleOf(MG.active[ff.si]) || ['', '표지']).join(' ')} — ${ff.n || ''}`;
        d.onclick = (ev) => { ev.stopPropagation(); jumpState(i + 1); };
        bar.appendChild(d);
      });
    }
    [...bar.children].forEach((d, i) => d.classList.toggle('on', i < g));
  }
  function pokeHud() {
    if (!opts.hud) return;
    document.body.classList.add('hud-show'); clearTimeout(hudTimer);
    hudTimer = setTimeout(() => document.body.classList.remove('hud-show'), 2600);
  }
  function buildMenu() {
    const m = $('menu-list'); m.innerHTML = '';
    MG.active.forEach((sc, si) => {
      const b = document.createElement('button');
      const tt = titleOf(sc), ns = flat.filter((f) => f.si === si).length;
      b.innerHTML = `<b>${tt ? tt[0] : '0'}</b><span>${tt ? tt[1] : '표지'}</span><i>${ns} 스텝</i>`;
      b.onclick = (ev) => { ev.stopPropagation(); toggle('menu', false); jumpScene(si); };
      m.appendChild(b);
    });
  }
  function toggle(id, force) { const el = $(id); const on = force === undefined ? !el.classList.contains('open') : force; el.classList.toggle('open', on); }

  const hasVariants = () => MG.scenes.some((sc) => sc.only || sc.steps.some((s) => s.skipBasic));
  function switchVariant(v) { location.href = location.pathname + '?v=' + v; }
  MG.switchVariant = switchVariant;
  function onKey(e) {
    if (!MG.chosen && !EXPORT && $('start')) { if (e.key === '1') switchVariant('full'); else if (e.key === '2') switchVariant('basic'); return; }
    const k = e.key;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if ($('menu').classList.contains('open') && k === 'Escape') { toggle('menu', false); return; }
    if ($('help').classList.contains('open') && (k === 'Escape' || k === '?')) { toggle('help', false); return; }
    if (['ArrowRight', 'ArrowDown', 'PageDown', ' ', 'Enter'].includes(k)) { e.preventDefault(); if (black) { black = false; return; } next(); }
    else if (['ArrowLeft', 'ArrowUp', 'PageUp', 'Backspace'].includes(k)) { e.preventDefault(); if (black) { black = false; return; } e.shiftKey ? rewind() : prev(); }
    else if (k === 'Home') jumpState(1);
    else if (k === 'End') jumpState(N);
    else if (k === 'k' || k === 'K') { if (anim) paused = !paused; }
    else if (k === 'r' || k === 'R') replay();
    else if (k === 'f' || k === 'F') { document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen(); }
    else if (k === 'c' || k === 'C') opts.captions = !opts.captions;
    else if (k === 't' || k === 'T') opts.chapters = !opts.chapters;
    else if (k === 'h' || k === 'H') { opts.hud = !opts.hud; document.body.classList.toggle('hud-off', !opts.hud); }
    else if (k === 'b' || k === 'B' || k === '.') black = !black;
    else if (k === 'l' || k === 'L') opts.logo = !opts.logo;
    else if (k === 'g' || k === 'G' || k === 'm' || k === 'M') toggle('menu');
    else if (k === '?' || k === '/') toggle('help');
    else if ((k === 'v' || k === 'V') && hasVariants()) switchVariant(MG.variant === 'basic' ? 'full' : 'basic');
    else if (/^[0-9]$/.test(k)) jumpScene(parseInt(k, 10));
    else return;
    pokeHud(); updateHud();
  }

  function loop(ts) {
    const dt = Math.min(0.1, (ts - (lastTs || ts)) / 1000); lastTs = ts;
    if (anim && !paused) {
      anim.t += dt;
      const q = clamp(anim.t / anim.dur);
      pos = lerp(anim.from, anim.to, q);
      if (q >= 1) { pos = anim.to; anim = null; sync(); }
    }
    paint(pos, (ts - T0) / 1000);
    requestAnimationFrame(loop);
  }

  async function loadFonts() {
    const list = window.MG_FONTS || [];
    await Promise.all(list.map(async (f) => {
      try { const ff = new FontFace(f.family, `url(${f.src})`, { weight: f.weight, style: f.style }); await ff.load(); document.fonts.add(ff); } catch (e) { console.warn('font', f.family, e); }
    }));
    await document.fonts.ready;
  }

  async function init() {
    cvs = document.getElementById('c'); ctx = cvs.getContext('2d');
    build(); resize();
    await loadFonts();
    mcache.clear();
    // 외부(영상 추출 스크립트)용 API
    MG.steps = () => flat.map((f, i) => ({ g: i + 1, scene: f.si, local: f.li, d: f.d, t0: f.t0, note: f.n, title: (titleOf(MG.active[f.si]) || ['0', '표지']).join(' ') }));
    MG.renderStep = (g, t) => { const f = flat[g - 1]; const p = clamp(t / f.d); paint(g - 1 + p, f.t0 + t); };
    MG.renderState = (P, T) => paint(P, T);
    MG.seek = (P) => { anim = null; pos = clamp(P, 0, N); updateHud(); }; // 디버그용: 연속 위치로 이동
    MG.N = N;
    if (EXPORT) { opts.logo = params.get('logo') === '1'; if (logoImg && !logoImg.complete) await logoImg.decode().catch(() => {}); document.body.classList.add('export'); MG.ready = true; return; }
    buildMenu();
    window.addEventListener('resize', resize);
    window.addEventListener('keydown', onKey);
    window.addEventListener('mousemove', pokeHud);
    cvs.addEventListener('click', () => { next(); updateHud(); });
    $('menu').addEventListener('click', () => toggle('menu', false));
    $('help').addEventListener('click', () => toggle('help', false));
    $('hud-scene').addEventListener('click', (e) => { e.stopPropagation(); toggle('menu'); });
    const h = parseInt((location.hash || '').slice(1), 10);
    document.querySelectorAll('[data-variant]').forEach((b) => b.addEventListener('click', (e) => { e.stopPropagation(); switchVariant(b.dataset.variant); }));
    const nFull = MG.scenes.filter((sc) => sc.only !== 'basic').reduce((a, sc) => a + sc.steps.length, 0);
    const nBasic = MG.scenes.filter((sc) => sc.only !== 'full').reduce((a, sc) => a + sc.steps.filter((s) => !s.skipBasic).length, 0);
    // 시작 화면(#start)이 있을 때만 버전 선택을 보여 준다
    if ($('n-full')) { $('n-full').textContent = nFull; $('n-basic').textContent = nBasic; }
    if ($('start') && !MG.chosen && !(h >= 1)) { document.body.classList.add('choosing'); pos = 0; }
    else if (h >= 1 && h <= N) { pos = h; sync(); } else { pos = 0; start(0, 1, flat[0].d); }
    updateHud(); pokeHud();
    MG.ready = true;
    requestAnimationFrame(loop);
  }
  window.addEventListener('DOMContentLoaded', init);
})();
