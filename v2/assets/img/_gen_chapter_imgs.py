"""Copy the chapter evidence + reading-panel images from ../assets into v2/assets/img
at max 1200px on the long edge, jpg q82. Run from repo root.
"""
import os
from PIL import Image, ImageOps

REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
SRC = os.path.join(REPO, "assets")
OUT = os.path.dirname(__file__)
MAXPX = 1200

NAMES = [
    "polymer-1.jpg", "polymer-2.jpg", "polymer-3.jpg", "polymer-phase-sep.jpg",
    "casting-1.jpg", "casting-2.jpg", "casting-3.jpg", "casting-4.jpg", "casting-5.jpg",
    "cnc-render.jpg", "cnc-build.jpg", "cnc-machine.jpg", "cnc-bed.jpg",
    "cnc-cut-rough.jpg", "cnc-cut-clean.jpg", "cnc-cut-warm.jpg",
    "slicer-software.jpg", "slicer-stl-viewer.jpg", "slicer-layer-plot.jpg", "slicer-stl-detail.jpg",
]

made = []
for name in NAMES:
    src = os.path.join(SRC, name)
    if not os.path.exists(src):
        print("MISSING", name); continue
    with Image.open(src) as im:
        im = ImageOps.exif_transpose(im).convert("RGB")
        w, h = im.size
        s = MAXPX / max(w, h)
        if s < 1:
            im = im.resize((round(w * s), round(h * s)), Image.LANCZOS)
        im.save(os.path.join(OUT, name), "JPEG", quality=82)
    made.append(name)
print("wrote", len(made), "chapter images")
