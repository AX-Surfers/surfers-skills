# 엔진 API 레퍼런스 (`engine.js`)

장면 코드를 쓸 때 필요한 것만 정리했다. 실제 구현은 `assets/template/engine.js`.

## 목차
1. 장면 정의와 스텝 모델
2. 타이밍 헬퍼
3. 글자
4. 도형·선·화살표
5. 데이터 위젯 (막대·벡터·타일)
6. 3D 레이어 블록 `model()`
7. 색·폰트
8. 버전 분기 (기본/초보자)
9. 재생기·외부 API

---

## 1. 장면 정의와 스텝 모델

```js
(() => {
  const L = MG.lib, C = L.C;          // 파일 최상단에서 꺼내 둔다 (engine.js 가 먼저 로드됨)
  MG.scene({
    id: 'training',                     // 고유 id
    title: ['5', '훈련'],               // 좌상단 장면 제목 [번호, 이름]. null 이면 없음
    steps: [                            // 한 스텝 = → 키 한 번 = PPT 슬라이드 한 장
      { d: 2.8, n: '마지막 단어 가리기' },   // d: 재생 시간(초), n: 메모(HUD·PPT 노트에 표시)
      { d: 3.6, n: '예측 → 정답과 비교' },
    ],
    draw(S, T) { /* S: 로컬 연속 스텝 위치, T: 앰비언트 시간(초) */ },
  });
})();
```

- **S** = 이 장면 안에서의 연속 위치. `S = 1.4`면 1번 스텝이 끝났고 2번 스텝이 40% 진행된 상태다. 화면의 모든 값을 S의 함수로 계산해야 앞으로 가기, 뒤로 가기, 되감기, 영상 추출이 저절로 맞는다. 내부 상태(let 변수에 누적)를 두지 않는다.
- **T** = 실제 흐르는 시간. 깜빡이는 커서, 흐르는 입자, 은은한 맥동 같은 **정지 상태에서도 움직여야 하는 것**에만 쓴다. 영상 추출 때는 결정적(deterministic) 값이 들어온다.
- 장면이 넘어갈 때 엔진이 이전 장면을 0.3 구간 동안 페이드아웃하고, 새 장면의 1번 스텝을 `sub(p, 0.26, 1)`로 재매핑한다. 그래서 1번 스텝을 등장 애니메이션으로 쓰면 된다.
- 캔버스 좌표는 항상 **1920×1080 논리 좌표**다. 창 크기와 레티나 배율은 엔진이 처리한다.
- 날것의 컨텍스트가 필요하면 `const ctx = L.ctx;`(draw 안에서). save/restore는 짝을 맞춘다.

## 2. 타이밍 헬퍼

| 함수 | 뜻 |
|---|---|
| `st(S, a)` | a번 스텝의 진행도 0~1 |
| `sub(p, a, b)` | p를 [a,b] 구간으로 잘라 0~1로 (한 스텝 안에서 여러 동작을 순서대로) |
| `vis(S, a, b, inA, inB, outA, outB)` | a번 스텝에 나타나고 b번 스텝에 사라지는 알파. 자막·패널에 쓴다 |
| `ease` (smootherstep), `easeOut`, `easeIn`, `easeInOut`, `back` (살짝 튀는 등장) | 이징 |
| `lerp(a,b,t)`, `clamp` | 기본 |
| `rnd(i)` | 결정적 의사난수 0~1 (Math.random 금지: 프레임마다 달라져 영상이 떨린다) |

**자막이 겹치지 않는 표준 패턴** — 앞 자막은 다음 스텝 0~0.15에 빠지고, 새 자막은 0.2~0.4에 들어온다:
```js
L.caption('A', L.vis(S, 2, 3, 0.2, 0.45, 0, 0.15));
L.caption('B', L.vis(S, 3, 4, 0.2, 0.45, 0, 0.15));
```

## 3. 글자

| 함수 | 용도 |
|---|---|
| `text(str, x, y, o)` | 기본. `o = {size, weight, color, align:'left'|'center'|'right', font:'sans'|'serif'|'serifI'|'math', alpha, glow, blur, scale}` |
| `writeText(str, x, y, p, o)` | 3b1b "Write": 윤곽선이 그려진 뒤 채워진다. 제목·핵심 문장 등장에 |
| `fadeText(str, x, y, p, o)` | 아래에서 살짝 올라오며 페이드인 (`o.rise`) |
| `rich(str, x, y, o)` | `{y|강조}` 마크업. 색 키: y 노랑, b 파랑, t 청록, g 초록, r 빨강, o 주황, p 보라, w 흰색, d 회색 |
| `caption(str, alpha, o)` | 하단 중앙 자막(y=990, 40px). `C` 키로 전체 숨김 가능 |
| `tw(str, o)` | 글자 폭 측정(캐시됨) — 배치 계산에 |

- 숫자·수식은 `font:'serif'`(KaTeX Main = Computer Modern 계열), 변수는 `font:'math'`. 한글은 자동으로 Pretendard로 대체된다.
- 음수는 `fmtNum(v)`로 쓰면 진짜 마이너스 기호(−)가 들어간다.

## 4. 도형·선·화살표

| 함수 | 메모 |
|---|---|
| `rect(x,y,w,h,o)` | `o = {fill, stroke, lw, r, dash, draw(0~1: 테두리가 그려지는 정도), glow, alpha}` |
| `circle(x,y,r,o)`, `line(x1,y1,x2,y2,o)` | |
| `arrow(x1,y1,x2,y2,p,o)` | p만큼 자라는 화살표. `o = {color, lw, head, glow}` |
| `pathLine(f, p0, p1, o)` | 경로 함수 f(t)→[x,y]의 일부 구간. `o.head`를 주면 끝에 화살촉. 곡선 화살표·관계선(어텐션 호) |
| `qbez(...)`, `cbez(...)` | 2차/3차 베지어 경로 함수 생성 |
| `comet(f, p, o)` | 경로를 따라 흐르는 빛나는 점+꼬리. 데이터가 흘러가는 연출 |
| `glowDot(x,y,r,color,a)` | 방사형 발광 |
| `dial(x,y,r,ang,o)` | 다이얼(0 = 12시, 시계방향 +). `o.ticks`로 눈금 |
| `person(x,y,s,o)`, `doc(x,y,w,h,o)` | 사람 실루엣, 문서 아이콘 |

## 5. 데이터 위젯

| 함수 | 메모 |
|---|---|
| `tile(str, cx, cy, o)` | 단어 타일(토큰). `o = {size, color, stroke, fill, glow, scale, alpha}` |
| `layoutTiles(words, x, o)` | 타일 여러 개를 가로 배치 → `[{x, w}]`. `o.align:'center'`면 x가 중심 |
| `bars(x, y, items, p, o)` | 확률 막대. x=라벨 오른쪽 끝, items=`[{w, v, c, hl, dim}]`. `o = {gap, maxW, size, vmax, frac, stag}`. v를 매 프레임 바꾸면 막대가 살아 움직인다 |
| `vecCol(x, y, vals, p, o)` | 세로 대괄호 벡터. `vals`에 문자열('⋮')도 가능, `o.colors`로 행별 색 |

## 6. 3D 레이어 블록 `model(o)`

"AI 모델 = 층층이 쌓인 판 + 다이얼" 비유용 블록. 직접 만든 가벼운 3D 투영이다.

```js
const m = L.model({
  x: 960, y: 540, s: 90,          // 화면 중심, 1단위당 px
  yaw: 0.5, pitch: 0.28,          // 0,0 = 정면(직사각형). yaw>0이면 왼쪽 면(다이얼 면)이 보인다
  n: 8, L: 3.2, h: 2.2, d: 2.2,   // 판 개수, 전체 길이, 높이, 깊이
  explode: 0,                     // 0 = 통짜 상자(라벨 표시), 1 = 판 분리
  spread: 1.7, thick: 0.14,       // 분리 시 퍼짐 정도와 판 두께
  label: 'LLM',                   // 통짜 상자 앞면 글자
  hlShell: 0~1, hlColor,          // 통짜 상자가 빛나는 정도 (예측하는 순간)
  hl: (i) => 0~1,                 // i번 판 하이라이트 → 파동: i => Math.exp(-(i-w)**2*1.3), w를 -1→n으로 움직임
  rows: 5, cols: 5, dials: 0~1,   // 다이얼 격자
  dialAng: (i, r, c) => rad,      // 다이얼 바늘 각도 (학습으로 바뀌는 연출)
  colors: (i) => hex,             // 판별 색 (예: 어텐션/피드포워드 교대)
  alpha,
});
// 반환: { left:[x,y], right:[x,y], cam } → 입력·출력 화살표 끝을 여기에 맞춘다
```

- 카메라 옮기기(줌인·다이브)는 `cam({...pose, x:0, y:0}).p(X,Y,Z)`로 원하는 지점의 화면 오프셋을 구해, 그 지점이 고정되도록 x,y를 보정한다. 예제는 LLM 프로젝트의 `scenes/04_dials.js`에 있다.
- 호출 전에 `alpha:0`으로 한 번 불러 좌표만 얻을 수 있다(그리지 않음).

## 7. 색·폰트

`C`: bg #000, white, text #ECECEC, dim, grey, grey2, grey3, blue #58C4DD, teal #5CD0B3, yellow #FFD84D, gold, red #FC6255, green #83C167, purple, pink, lblue. 헬퍼 `rgba(hex,a)`, `mix(h1,h2,t)`.

## 8. 버전 분기 (기본/초보자)

사용자가 쉬운 버전을 따로 원할 때만 쓴다.
- 장면 단위: `MG.scene({ only: 'full' | 'basic', ... })`
- 스텝 단위: `steps: [{ d, n, skipBasic: true }]` → 초보자 버전에서 그 스텝을 건너뛴다. 건너뛴 스텝이 남긴 화면 요소(예: `vis(S,3,4)`로 켜진 수식)는 다음 스텝 시작 때 이미 켜진 상태이므로, 장면 코드에서 `if (MG.variant === 'basic')`로 꺼 준다.
- 버전별 장면 제목: `titleBasic: ['8', '…']`
- 주소 `?v=basic` / `?v=full`, 발표 중 `V` 키로 전환. 처음 열 때 고르게 하려면 index.html에 `#start` 오버레이(카드 두 개: `data-variant="basic|full"`, 스텝 수 자리 `#n-basic`, `#n-full`)와 `body.choosing #start{display:flex}` CSS를 추가한다. 엔진은 `#start`가 있을 때만 선택 화면을 띄운다.
- 추출: `node render.mjs clips --v basic`, `python3 make_pptx.py --v basic`

## 9. 재생기·외부 API

- 키: → Space PageDown 클릭(다음, 재생 중이면 즉시 완료), ← PageUp(이전 상태), Shift+←(되감기), R(다시), K(일시정지), 0~9·G(장면), F(전체화면), C/T(자막/제목), B(검은 화면), L(로고), H(진행 막대), ?(도움말)
- 주소 `#번호` = 현재 스텝(새로고침해도 유지)
- `?export=1` 모드: HUD 없음, 1920×1080 고정. 스크립트용 `MG.steps()`, `MG.renderStep(g, t)`, `MG.renderState(P, T)`, `MG.seek(P)`(디버그: 연속 위치로 이동)
- 로고: `window.MG_LOGO_SVG = '<svg…>'`(data URI로 그려서 캔버스 오염 없음)를 index.html에서 불러오면 오른쪽 위에 표시. 추출 영상에는 `--logo`를 줄 때만 들어간다.
