---
name: concept-motion-graphic
description: 개념·원리(LLM 원리, 웹 동작 원리, 알고리즘, 경제 개념 등)를 3Blue1Brown 스타일의 스텝형 모션그래픽으로 만든다. 브라우저에서 →/← 로 한 동작씩 앞뒤로 넘기며 발표할 수 있는 HTML(Canvas)과, PPT에 넣을 스텝별 MP4·자동재생 PPTX까지 뽑는다. "원리를 모션그래픽으로", "3b1b처럼 애니메이션", "강의 슬라이드용 설명 애니메이션", "레퍼런스 유튜브 영상을 내 버전으로", "PPT에서 멈췄다 넘길 수 있는 애니메이션", "manim 대신" 같은 요청이나, 강의 자료의 설명·삽화를 움직이는 설명 영상으로 바꾸고 싶어 할 때는 명시적으로 '모션그래픽'이라고 하지 않아도 이 스킬을 쓴다.
---

# 원리 설명 모션그래픽 (3b1b 스타일, 스텝형)

강의·발표용 설명 애니메이션을 만든다. 결과물은 세 가지다.
1. **HTML 발표본**: `index.html`을 열고 →/←(클리커 PageDown/PageUp)로 스텝 단위 재생·되돌리기
2. **스텝별 MP4 + 자동 재생 PPTX**: 스텝 1개 = 슬라이드 1장
3. (필요하면) 장면별 MP4: 문서·페이지에 끼워 넣는 용도

도구로 Manim이나 After Effects 대신 **직접 만든 Canvas 스텝 엔진**을 쓴다. 발표 중 즉시 앞뒤 이동이 되고, 설치 없이 더블클릭으로 열리고, 같은 코드로 프레임 단위 결정적 영상 추출이 된다. 엔진·추출 스크립트는 `assets/template/`에 들어 있으니 새로 짜지 않는다.

완성 예시(9장면 36스텝, 초보자 버전 포함): `~/SURFERS/강의/클로드 마스터클래스/LLM원리_모션그래픽/` (GitHub `AX-Surfers/llm-motion-graphic`). 비슷한 연출이 필요하면 그 `scenes/*.js`를 열어 참고한다(다이얼 줌인·줌아웃은 04, 역전파 파동과 1억 년 스케일 줌은 05, 어텐션 호와 의미 공간은 08).

## 작업 흐름

### 1. 재료 모으기
- 설명할 **원문**(강의 Notion 섹션, 문서)을 가져온다. 링크가 있으면 fetch해서 해당 섹션의 항목·예시·숫자를 뽑는다.
- 레퍼런스 영상 분석이 주어지면 **연출 문법만** 빌린다. 내용 범위는 원문이 정한다.
- 청중(비개발자인지), 용도(브라우저 발표/PPT), 기존 삽화 재사용 여부를 확인한다. 사용자가 기존 이미지를 쓰지 말라고 하면 모든 시각 요소를 코드로 그린다.

### 2. 스토리보드 → 사용자 확인
`references/design-playbook.md`를 읽고 장면·스텝 표(화면에서 일어나는 일 + 한 줄 자막)를 만든다. 원문 항목 하나가 장면 하나, 발표자가 말을 멈출 지점이 스텝 하나다. 구현 전에 표를 보여 주고, 빼거나 합칠 장면이 있는지 묻는다. 규모가 커지므로 여기서 방향을 맞추는 게 가장 싸다.

### 3. 프로젝트 만들기
```bash
bash ~/.claude/skills/concept-motion-graphic/scripts/new_project.sh "<대상 폴더>" "<제목>" "<영문 부제>"
```
템플릿 복사, 제목 치환, `fonts.js` 생성, `export/`에 playwright-core 설치까지 한 번에 한다. 결과 폴더의 `scenes/01_example.js`가 패턴 견본이다(입력 → 블록 → 확률 막대 → 선택).

### 4. 장면 구현
- `references/engine-api.md`를 읽고 쓴다. 핵심 규칙: **화면의 모든 값은 S(로컬 연속 스텝 위치)의 함수**다. 이래야 되감기, 건너뛰기, 영상 추출이 공짜로 맞는다. 입자나 깜빡임만 T(시간)를 쓴다.
- 장면 파일은 `scenes/NN_이름.js`, index.html에 `<script>`를 순서대로 추가한다.
- 자막은 `L.caption()`으로 스텝마다 하나, 겹치지 않는 표준 타이밍을 쓴다.
- 장면이 많으면 2~3개씩 만들고 바로 검수한다. 한꺼번에 다 쓰고 나중에 보면 레이아웃 문제가 쌓인다.

### 5. 검수 (반드시 원본 해상도로)
```bash
cd <프로젝트>/export && rm -rf snaps && node render.mjs snap 3 3.5 4 5.2 6
python3 ~/.claude/skills/concept-motion-graphic/scripts/contact_sheet.py snaps -o /tmp/sheet.png
```
`snap`의 숫자는 **전역 연속 위치**다(정수 g = g번째 스텝 완료, g−0.5 = 그 스텝 중간). 시트를 Read로 보고 `design-playbook.md`의 체크리스트대로 고친다. 스텝 끝 화면, 중간 화면, 장면 전환 구간을 같이 본다. 브라우저 미리보기는 키 조작 확인용으로만 쓴다(`launch.json`에 정적 서버를 등록하고 `MG.seek(P)`로 이동).

### 6. 추출
```bash
cd <프로젝트>/export
node render.mjs clips              # 스텝별 MP4(60fps) + 첫/끝 프레임 PNG → clips/
python3 make_pptx.py               # 자동 재생 PPTX → <폴더명>.pptx
node render.mjs scenes --fps 30 --hold 1.2   # (선택) 장면별 MP4 → scenes/
```
`--v basic`은 초보자 버전, `--logo`는 영상에 로고를 넣는다. PPTX 자동 재생은 PowerPoint 실물에서 검증된 적이 없으니 결과를 알릴 때 그 점을 말한다.

### 7. 마무리
- 프로젝트 폴더에 README(키 조작, 장면 표, 재추출 명령)를 남긴다.
- 보고할 때는 장면 구성, 쓰는 방법(브라우저/PPT), 검증한 것과 못 한 것을 짧게 정리한다.

## 선택 기능 (요청이 있을 때)
- **초보자 버전**: 뺄 기준을 먼저 제안하고 인터뷰로 확정한다(`design-playbook.md` 6절). 구현은 `engine-api.md` 8절(`only`, `skipBasic`, `?v=basic`, 시작 화면 선택).
- **로고**: `window.MG_LOGO_SVG`(engine-api 9절).
- 배포, Notion 삽입, GitHub에서 막히면 `references/pitfalls.md` 끝부분을 본다.

## 참고 파일
- `references/engine-api.md` — 엔진 함수, 3D 블록, 버전 분기, 키·추출 API
- `references/design-playbook.md` — 원문에서 장면 고르기, 스토리보드, 3b1b 룩, 배치 좌표, 말투, 검수 체크리스트
- `references/pitfalls.md` — 실제로 겪은 문제와 해결법
- `assets/template/` — 엔진, index.html, 표지·예시 장면, 폰트, `export/render.mjs`·`make_pptx.py`
- `scripts/new_project.sh`, `scripts/build_fonts.py`, `scripts/contact_sheet.py`
