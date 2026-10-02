#!/usr/bin/env bash
# 새 모션그래픽 프로젝트 만들기
# 사용법: bash new_project.sh <대상 폴더> "<제목>" "<부제(영문 이탤릭 권장)>"
set -euo pipefail
DEST="$1"; TITLE="${2:-제목}"; SUBTITLE="${3:-Subtitle}"
HERE="$(cd "$(dirname "$0")" && pwd)"; TPL="$HERE/../assets/template"
if [ -e "$DEST" ] && [ -n "$(ls -A "$DEST" 2>/dev/null)" ]; then echo "이미 내용이 있는 폴더입니다: $DEST" >&2; exit 1; fi
mkdir -p "$DEST"
cp -R "$TPL"/. "$DEST"/
python3 - "$DEST" "$TITLE" "$SUBTITLE" <<'PY'
import sys, pathlib
d, t, s = pathlib.Path(sys.argv[1]), sys.argv[2], sys.argv[3]
for p in [d / "index.html", d / "scenes" / "00_title.js"]:
    p.write_text(p.read_text().replace("{{TITLE}}", t).replace("{{SUBTITLE}}", s))
PY
python3 "$HERE/build_fonts.py" "$DEST"
printf 'export/node_modules/\nexport/clips*/\nexport/snaps*/\nexport/scenes*/\nexport/*.pptx\nexport/*.mp4\nexport/*.log\n.DS_Store\n.vercel\n' > "$DEST/.gitignore"
printf 'export/\n.git/\n.DS_Store\n' > "$DEST/.vercelignore"
(cd "$DEST/export" && npm i playwright-core@latest --silent >/dev/null 2>&1 && echo "playwright-core 설치 완료") || echo "경고: npm 설치 실패 — export 폴더에서 'npm i playwright-core' 를 직접 실행하세요"
echo "완료: $DEST (index.html 을 열면 표지+예시 장면이 보입니다)"
