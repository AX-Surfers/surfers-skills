/* 0. 표지 — 스텝 1개. title 이 null 이면 좌상단 장면 제목이 나오지 않는다. */
MG.scene({
  id: 'title', title: null,
  steps: [{ d: 3.2, n: '제목' }],
  draw(S) {
    const L = MG.lib, C = L.C;
    const p = L.st(S, 1);
    L.writeText('{{TITLE}}', 960, 500, L.sub(p, 0, 0.75), { size: 96, weight: 700, align: 'center', color: C.white });
    const u = L.ease(L.sub(p, 0.45, 0.85));
    L.line(960 - 330 * u, 585, 960 + 330 * u, 585, { color: C.grey2, lw: 1.5 });
    L.fadeText('{{SUBTITLE}}', 960, 642, L.sub(p, 0.55, 0.95), { size: 40, font: 'serifI', align: 'center', color: C.grey });
  },
});
