---
name: surfers-quote
description: Use when the user asks to create/generate/작성 a 견적서 (quotation) for 서퍼스 (Surfers) — e.g. "견적서 뽑아줘", "견적서 만들어줘", listing items/quantities/prices and who it's for. Produces a one-page 견적서 (Artifact + PDF + Excel) with supplier info pre-filled, optional 할인, 부가세 면제/10%, 교육 일정, 입금 계좌 and 세금계산서/현금영수증 안내.
---

# 서퍼스 견적서 생성

`make_quote.py` 가 template.html 을 채워 **Artifact용 HTML, PDF(A4 한 장), 엑셀**을 한 번에 만든다.
(영수증은 `surfers-receipt` 스킬. 견적서는 이 스킬을 쓴다.)

## 입력 수집 — 없으면 확인 후 진행

- **받는자** (필수), **품목** (필수: 이름·수량·단가)
- 작성일자 (기본: 오늘, `2026년 10월 06일` 형식)
- 할인율과 라벨 (예: 단체신청 10%) — 선택
- **부가세**: 간이과세자는 기본 `exempt`(면제 0원). 10% 가산이면 `"10"`. 모호하면 반드시 묻는다.
- 교육 일정, 입금 계좌(예금주 포함) — 선택. 빠뜨리기 쉬우니 없으면 한 번 물어본다.
- 견적 유효기간 등 추가 문구는 `notes` 에 넣는다.
- 공급자 기본값: 서퍼스 / 146-33-01415 / 김승렬 / 010-9016-1681 (다른 값을 주면 `supplier` 로 덮어쓴다)
- 입금 계좌는 저장해 두지 않는다. 사용자에게 은행·계좌번호·예금주를 매번 받는다.

## 실행

1. 스크래치패드에 spec.json 작성:
```json
{"recipient":"씨스퀘어자산운용","date":"2026년 10월 06일","qty_suffix":"명",
 "items":[{"name":"클로드 마스터 클래스","qty":8,"price":350000}],
 "discount_pct":10,"discount_label":"단체신청 할인 (10%)","vat":"exempt",
 "schedule":"2026년 10월 24일(토), 10월 31일(토) 오후 1시 ~ 6시",
 "account":"○○은행 000-000000-00000 (예금주: 홍길동)",
 "notes":["공급자는 간이과세자로 부가가치세가 면제됩니다.","세금계산서는 발행할 수 없으며, 현금영수증은 발행 가능합니다."]}
```
2. `python3 ~/.claude/skills/surfers-quote/make_quote.py spec.json <스크래치패드 출력폴더>`
   — 출력의 `sub/discount/vat/total` 로 금액을 사용자 요청과 대조한다. **같은 폴더에 다시 돌리면 quote.html 이 덮어써지므로** HTML을 손으로 고친 뒤에는 스크립트를 재실행하지 않는다(고칠 것은 spec 이나 template.html 에서 고친다).
3. 엑셀 재계산(수식 값 채우기): xlsx 스킬의 `scripts/recalc.py` 를 실행. 기본 python3(3.9)에서 `tempfile.TemporaryDirectory(ignore_cleanup_errors=...)` 인자 오류가 나므로 해당 클래스를 감싸 그 인자를 무시하는 래퍼로 실행하고, `scripts/` 디렉터리에서 돌린다(상대 import 때문). `total_errors: 0` 확인.
4. 시각 확인: PDF 를 `qlmanage -t -s 900 -o . 파일.pdf` 로 PNG 변환해 한 번 본다(poppler 는 이 환경에서 깨져 있음).

## 결과물 전달

- **Artifact**: 먼저 `artifact-design` 스킬을 로드한 뒤 quote.html 발행. icon `document`, 제목은 `<title>` 에 이미 `견적서 - {받는자}` 로 들어 있다. 같은 파일 경로로 재발행하면 URL 이 유지된다.
- **PDF·엑셀**: `SendUserFile` 로 전달. 요청받지 않은 다른 산출물은 만들지 않는다.
- 글씨 색은 검정(템플릿의 `--input-blue` 를 `#1a1a1a` 로 둠). 도장은 `signature.svg` 인라인.
