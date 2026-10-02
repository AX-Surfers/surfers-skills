/* 1. 예시 장면 — 패턴 견본. 실제 장면을 만들면 이 파일을 지우거나 덮어쓴다.
   스텝 ① 입력 문장 등장  ② 모델 통과 → 확률 막대  ③ 하나를 골라 문장에 붙임
   규칙: 모든 값은 S(로컬 연속 스텝 위치)의 함수. p1..p3 = 각 스텝 진행도(0~1). */
(() => {
  const L = MG.lib, C = L.C;
  const Y = 520, SX = 140, FS = 42;
  const SENT = '오늘 점심은 김치찌개를';
  const M = { x: 1010, y: Y, yaw: 0.42, pitch: 0.24, s: 70, label: 'AI' };
  const ITEMS = [
    { w: '먹었다', v: 0.52, c: C.yellow },
    { w: '먹을까', v: 0.28, c: C.teal },
    { w: '기타', v: 0.2, c: C.grey },
  ];

  MG.scene({
    id: 'example', title: ['1', '예시 장면'],
    steps: [
      { d: 2.4, n: '문장 등장' },
      { d: 3.0, n: '모델 → 확률' },
      { d: 2.6, n: '골라서 붙이기' },
    ],
    draw(S) {
      const p1 = L.st(S, 1), p2 = L.st(S, 2), p3 = L.st(S, 3);
      const sw = L.tw(SENT, { size: FS }), bx = SX + sw + 16;

      // ① 문장 + 빈칸
      L.writeText(SENT, SX, Y, L.sub(p1, 0, 0.6), { size: FS });
      const filled = L.ease(L.sub(p3, 0.7, 1));
      L.rect(bx, Y - 33, 150, 66, { stroke: C.yellow, lw: 2.5, dash: [10, 8], r: 10, alpha: L.ease(L.sub(p1, 0.4, 0.8)) * (1 - filled) });
      if (filled > 0) L.text('먹었다', bx + 6, Y, { size: FS, weight: 700, color: C.yellow, alpha: filled });

      // ② 모델(반환값의 left/right 로 화살표 끝을 맞춘다) + 흐르는 빛 + 막대
      const glow = Math.sin(Math.PI * L.sub(p2, 0.1, 0.45));
      const m = L.model({ ...M, alpha: L.ease(L.sub(p1, 0.3, 0.8)), hlShell: glow, hlColor: C.yellow });
      const ax0 = bx + 172, ax1 = m.left[0] - 14, ox0 = m.right[0] + 14, ox1 = 1265;
      L.arrow(ax0, Y, ax1, Y, L.ease(L.sub(p1, 0.55, 0.95)), { color: C.grey });
      L.arrow(ox0, Y, ox1, Y, L.ease(L.sub(p1, 0.65, 1)), { color: C.grey });
      L.comet((t) => [L.lerp(ax0, ax1, t), Y], L.sub(p2, 0, 0.2), { color: C.yellow });
      L.comet((t) => [L.lerp(ox0, ox1, t), Y], L.sub(p2, 0.22, 0.38), { color: C.yellow });
      L.bars(1440, 440, ITEMS.map((it, i) => ({ ...it, hl: i === 0 && p3 > 0.3 })), L.sub(p2, 0.35, 1), { gap: 84, maxW: 290 });

      // ③ 뽑힌 단어가 빈칸으로 날아간다
      const f = L.ease(L.sub(p3, 0.35, 0.7));
      if (f > 0 && f < 1) {
        const path = L.cbez(1340, 440, 1100, 200, bx + 260, 260, bx + 70, Y);
        const [x, y] = path(f);
        L.text('먹었다', x, y, { size: FS, weight: 700, color: C.yellow, align: 'center', glow: L.rgba(C.yellow, 0.6) });
      }

      // 자막: 스텝마다 하나, 앞 자막이 빠진 뒤 다음 자막이 들어오게
      L.caption('문장을 넣으면 {y|다음 단어}를 예측한다', L.vis(S, 1, 2, 0.5, 0.9, 0, 0.15));
      L.caption('후보마다 {y|확률}을 매긴다', L.vis(S, 2, 3, 0.35, 0.55, 0, 0.15));
      L.caption('확률에 따라 하나를 골라 {y|이어 붙인다}', L.vis(S, 3, undefined, 0.2, 0.4));
    },
  });
})();
