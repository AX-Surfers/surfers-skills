---
name: intrinsic-receipt
description: Use when the user asks to create/generate/발급 a 영수증 (receipt) for 인트린직 (company Intrinsic) — e.g. "영수증 만들어줘", "영수증 발급", "인트린직 영수증", listing items/quantities/prices and who it's for. Produces a single-screen receipt document (Artifact) with supplier info pre-filled and item amounts auto-calculated, plus a matching Excel (.xlsx) copy.
license: MIT
metadata:
  category: documents
  locale: ko-KR
  phase: v1
---

# 인트린직 영수증 생성

`template.html`(이 스킬 폴더에 번들됨)을 채워 넣어 한 화면짜리 영수증 문서를 만든다.

## 입력 수집

사용자에게 없으면 반드시 확인 후 진행한다:

- **받는자** (필수) — 영수증을 받는 사람/거래처명
- **품목 목록** (필수) — 품목명, 수량, 단가를 항목별로. 최소 1개 이상.
- **작성일자** (선택, 기본값: 오늘 날짜) — `date +"%Y년 %m월 %d일"` 형식 사용
- **공급자 정보** (선택, 기본값 아래 고정값 사용 — 사용자가 명시적으로 다른 값을 주지 않는 한 그대로 사용):
  - 상호: `인트린직`
  - 사업자등록번호: `146-33-01415`
  - 대표자: `김승렬`
  - 연락처: `010-9016-1681`

## 계산 규칙

각 품목 행: `금액 = 수량 × 단가`
- `합계` = 모든 품목 금액의 합
- `부가세` = `round(합계 × 0.1)` (원 단위 반올림)
- `총액` = `합계 + 부가세`

모든 금액은 천단위 콤마 + `원` 접미사로 표기 (예: `110,000원`).

## 템플릿 채우기

1. `template.html`을 읽는다.
2. 아래 플레이스홀더를 치환한다:
   - `{{RECIPIENT}}`, `{{DATE}}`
   - `{{SUPPLIER_NAME}}`, `{{SUPPLIER_REGNO}}`, `{{SUPPLIER_CEO}}`, `{{SUPPLIER_PHONE}}`
   - `{{ITEM_ROWS}}` — 품목당 한 줄:
     ```html
     <tr><td class="item-name">품목명</td><td class="qty">수량</td><td class="price">단가원</td><td class="amount">금액원</td></tr>
     ```
     여러 품목이면 `<tr>`을 이어붙인다.
   - `{{SUBTOTAL}}`, `{{VAT}}`, `{{TOTAL}}`
   - `{{SIGNATURE_SVG}}` — 이 스킬 폴더의 `signature.svg` 파일 내용을 그대로 읽어 그 자리에 인라인으로 삽입한다 (외부 참조 금지, Artifact는 자체완결 HTML만 허용).
3. 치환이 끝난 완성 HTML을 스크래치패드에 저장한다.

## 결과물 표시

영수증을 만들 때마다 **Artifact + 엑셀 파일 둘 다** 만든다.

### 1. Artifact

완성된 HTML을 **Artifact 도구**로 발행한다.
- Artifact 발행 전 반드시 `artifact-design` 스킬을 먼저 로드한다 (Artifact 도구 규칙).
- `favicon`은 `🧾`로 고정한다.
- 제목은 `영수증 - {받는자}` 형태로.
- title 파라미터는 이미 template.html 상단 `<title>`에 채워지므로 별도 지정 불필요.

### 2. 엑셀 파일

같은 데이터로 `.xlsx` 사본을 만든다 (`xlsx` 스킬 사용). 시트 하나에:
- 상단: 받는자, 작성일자
- 공급자 정보 블록: 상호 / 사업자등록번호 / 대표자 / 연락처
- 품목 표: 품목 / 수량 / 단가 / 금액 (헤더 포함, 단가·금액은 숫자 셀에 천단위 콤마 서식)
- 표 아래: 합계 / 부가세(10%) / 총액 행

파일명: `영수증_{받는자}_{YYYYMMDD}.xlsx`, 스크래치패드에 저장 후 `SendUserFile`로 전달한다.

> `xlsx` 스킬의 `recalc.py`는 이 환경의 기본 `python3`(3.9)에서 `tempfile.TemporaryDirectory(ignore_cleanup_errors=...)` 인자 문제로 바로 실패한다. `python3.14`엔 `openpyxl`이 없어 그것도 안 된다. 우회: `python3`(3.9)로 실행하되, 실행 전에 `tempfile.TemporaryDirectory`를 `ignore_cleanup_errors` 킥아웃하는 래퍼로 감싸고, `recalc.py`가 있는 `scripts/` 디렉터리에서(상대 import `office.soffice` 때문에) 실행한다.

발행/전달 후 Artifact 링크와 함께 엑셀 파일을 사용자에게 전달한다. 이 두 가지 외에 요청받지 않은 추가 산출물(PDF, 이미지 변환 등)은 만들지 않는다.
