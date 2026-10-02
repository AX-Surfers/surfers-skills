"""검수용 시트: 여러 PNG 를 2열 격자로 이어 붙인다 (1920×1080 → 칸당 960 폭).
사용법: python3 contact_sheet.py <png 폴더 또는 파일들...> -o sheet.png [--cols 2] [--width 960]
파일 이름이 pos_12_5.png 형식이면 위치(12.5) 순서로 정렬한다. 10장 이하로 끊어 보는 게 읽기 좋다.
"""
import argparse, glob, os, re
from PIL import Image, ImageDraw

ap = argparse.ArgumentParser()
ap.add_argument("inputs", nargs="+"); ap.add_argument("-o", "--out", required=True)
ap.add_argument("--cols", type=int, default=2); ap.add_argument("--width", type=int, default=960)
a = ap.parse_args()
files = []
for i in a.inputs:
    files += sorted(glob.glob(os.path.join(i, "*.png"))) if os.path.isdir(i) else [i]
def key(f):
    m = re.match(r"pos_(\d+)(?:_(\d+))?\.png", os.path.basename(f))
    return float(f"{m.group(1)}.{m.group(2) or 0}") if m else 0
files.sort(key=key)
ims = [Image.open(f).convert("RGB") for f in files]
w = a.width; h = int(w * ims[0].height / ims[0].width); pad = 6
rows = (len(ims) + a.cols - 1) // a.cols
sheet = Image.new("RGB", (a.cols * (w + pad) + pad, rows * (h + pad) + pad), (90, 90, 90))
dr = ImageDraw.Draw(sheet)
for k, (im, f) in enumerate(zip(ims, files)):
    x = pad + (k % a.cols) * (w + pad); y = pad + (k // a.cols) * (h + pad)
    sheet.paste(im.resize((w, h), Image.LANCZOS), (x, y))
    dr.text((x + 8, y + h - 18), os.path.basename(f), fill=(255, 216, 77))
sheet.save(a.out); print(a.out, len(ims), "장")
