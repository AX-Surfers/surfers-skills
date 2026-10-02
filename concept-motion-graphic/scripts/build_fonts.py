"""fonts/ 의 woff2 를 base64 로 묶어 fonts.js 를 만든다.
file:// 로 열어도(서버 없이 더블클릭) 폰트가 깨지지 않게 하려는 것.
사용법: python3 build_fonts.py <프로젝트 폴더>
"""
import base64, os, sys

root = sys.argv[1] if len(sys.argv) > 1 else "."
FONTS = [  # (family, file, weight, style) — 엔진은 MG Sans / MG Serif / MG Math 이름으로 쓴다
    ("MG Sans", "PretendardVariable.woff2", "100 900", "normal"),
    ("MG Serif", "KaTeX_Main-Regular.woff2", "400", "normal"),
    ("MG Serif", "KaTeX_Main-Bold.woff2", "700", "normal"),
    ("MG Serif", "KaTeX_Main-Italic.woff2", "400", "italic"),
    ("MG Math", "KaTeX_Math-Italic.woff2", "400", "italic"),
]
out = ["// 자동 생성: fonts/ 의 폰트를 base64 로 내장", "window.MG_FONTS = ["]
for fam, fn, w, st in FONTS:
    b = base64.b64encode(open(os.path.join(root, "fonts", fn), "rb").read()).decode()
    out.append(f'  {{family:"{fam}", weight:"{w}", style:"{st}", src:"data:font/woff2;base64,{b}"}},')
out.append("];")
open(os.path.join(root, "fonts.js"), "w").write("\n".join(out))
print("fonts.js", os.path.getsize(os.path.join(root, "fonts.js")), "bytes")
