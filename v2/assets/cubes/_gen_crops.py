"""Generate 512x512 q80 jpg square crops of every source photo used on the cubes.
Run once from repo root: python v2/assets/cubes/_gen_crops.py
Center-crops to square (subject kept centred), downsizes with Lanczos, saves q80.
"""
import os
from PIL import Image, ImageOps

REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
SRC = os.path.join(REPO, "assets")
OUT = os.path.dirname(__file__)

# source basename (in assets/) -> output name (in v2/assets/cubes/)
SOURCES = [
    "polymer-phase-sep.jpg", "polymer-1.jpg", "polymer-2.jpg", "polymer-3.jpg",
    "casting-1.jpg", "casting-2.jpg", "casting-3.jpg", "casting-4.jpg", "casting-5.jpg",
    "cnc-machine.jpg", "cnc-bed.jpg", "cnc-cut-clean.jpg", "cnc-cut-rough.jpg", "cnc-cut-warm.jpg",
    "slicer-stl-viewer.jpg", "slicer-software.jpg", "slicer-layer-plot.jpg", "slicer-stl-detail.jpg",
    "sens-plus-flyer.jpg",
    "motor-wound-pair.jpg", "motor-desk.jpg", "motor-exploded.jpg", "motor-shaft.jpg", "motor-stator.jpg",
    "pendulum-1.jpg", "pendulum-2.jpg", "pendulum-3.jpg",
    "cannon-1.jpg", "cannon-2.jpg", "cannon-3.jpg",
    "flight-1.jpg", "flight-2.jpg", "flight-3.jpg", "flight-dynamics.png",
]

def square512(im):
    im = ImageOps.exif_transpose(im).convert("RGB")
    w, h = im.size
    s = min(w, h)
    left = (w - s) // 2
    top = (h - s) // 2
    im = im.crop((left, top, left + s, top + s))
    return im.resize((512, 512), Image.LANCZOS)

made = []
for name in SOURCES:
    src = os.path.join(SRC, name)
    if not os.path.exists(src):
        print("MISSING", name); continue
    out_name = os.path.splitext(name)[0] + ".jpg"
    with Image.open(src) as im:
        square512(im).save(os.path.join(OUT, out_name), "JPEG", quality=80)
    made.append(out_name)

print("wrote", len(made), "crops")
for m in made:
    print(" ", m)
