"""Generate morph-target point clouds for particles.js and write them to
v2/assets/shapes/*.bin as raw little-endian Float32 [x,y,z, x,y,z, ...].

Coordinates are NORMALISED (height ~1 unit, centred on origin); particles.js scales
and places each shape into world space at runtime, so these files are viewport-agnostic.

  forklift.bin  ~45k points sampled inside the root index.html forklift SVG (strokes
                dilated ~6px), y in [-0.5, 0.5], x by aspect.
  slicer.bin    a nozzle-profile lathe sliced into 40 rings (1100 pts/ring) up the z axis.
  cube.bin      the 12 edges of a cube (3500 pts/edge) plus corner clusters.

Run from repo root: python v2/assets/img/_gen_shapes.py
"""
import os, struct, math, random
import numpy as np
from playwright.sync_api import sync_playwright

OUT = os.path.join(os.path.dirname(__file__), "..", "shapes")
os.makedirs(OUT, exist_ok=True)
random.seed(7); np.random.seed(7)


def write_bin(name, pts):
    pts = np.asarray(pts, dtype="<f4").reshape(-1, 3)
    with open(os.path.join(OUT, name), "wb") as f:
        f.write(pts.tobytes())
    print(f"{name}: {len(pts)} points")


# ---- forklift: rasterise the SVG to a mask, sample dark pixels ----
FORKLIFT_SVG = '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 380 440" fill="none" stroke="#000" stroke-width="9" stroke-linecap="round" stroke-linejoin="round" width="380" height="440">
  <g><line x1="198" y1="96" x2="338" y2="96"/><line x1="206" y1="96" x2="206" y2="300"/><line x1="238" y1="96" x2="238" y2="120"/><line x1="304" y1="96" x2="304" y2="120"/></g>
  <g><line x1="332" y1="110" x2="332" y2="300"/><rect x="314" y="206" width="20" height="12" rx="2"/><circle cx="252" cy="248" r="14"/><line x1="252" y1="262" x2="252" y2="300"/></g>
  <rect x="190" y="300" width="150" height="76" rx="10"/><line x1="205" y1="336" x2="325" y2="336"/><path d="M188,314 L168,300 M188,300 L168,318"/>
  <g><circle cx="300" cy="392" r="36"/><circle cx="300" cy="392" r="13"/><line x1="264" y1="392" x2="336" y2="392"/><line x1="300" y1="356" x2="300" y2="428"/></g>
  <g><circle cx="150" cy="398" r="17"/><circle cx="150" cy="398" r="6"/><line x1="133" y1="398" x2="167" y2="398"/><line x1="150" y1="381" x2="150" y2="415"/></g>
  <g><line x1="150" y1="110" x2="150" y2="362"/><line x1="168" y1="110" x2="168" y2="362"/><line x1="150" y1="150" x2="168" y2="150"/><line x1="150" y1="250" x2="168" y2="250"/><circle cx="159" cy="110" r="6"/><rect x="146" y="300" width="26" height="30" rx="3"/></g>
  <g><line x1="150" y1="330" x2="150" y2="384"/><line x1="150" y1="384" x2="64" y2="384"/><line x1="64" y1="384" x2="58" y2="377"/><line x1="150" y1="376" x2="72" y2="376"/></g>
  <g><rect x="134" y="76" width="36" height="22" rx="3"/><circle cx="144" cy="87" r="4"/><circle cx="160" cy="87" r="4"/></g>
</svg>'''


def gen_forklift(n=45000):
    html = f'<!doctype html><html><head><style>html,body{{margin:0}}.b{{width:1024px;height:1024px;background:#fff;display:flex;align-items:center;justify-content:center}}.b svg{{width:760px;height:880px}}</style></head><body><div class="b">{FORKLIFT_SVG}</div></body></html>'
    with sync_playwright() as p:
        b = p.chromium.launch()
        pg = b.new_page(viewport={"width": 1024, "height": 1024}, device_scale_factor=1)
        pg.set_content(html); pg.wait_for_timeout(150)
        pg.locator(".b").screenshot(path=os.path.join(OUT, "_forklift_mask.png"))
        b.close()
    from PIL import Image
    im = np.asarray(Image.open(os.path.join(OUT, "_forklift_mask.png")).convert("L"))
    ys, xs = np.where(im < 128)                       # dark pixels = the drawing
    idx = np.random.randint(0, len(xs), size=n)
    px = xs[idx].astype("f4"); py = ys[idx].astype("f4")
    px += np.random.uniform(-1.5, 1.5, n); py += np.random.uniform(-1.5, 1.5, n)
    h = 1024.0
    x = (px - 512.0) / h                              # normalise: height 1, centred
    y = -(py - 512.0) / h                             # flip to y-up
    z = np.random.uniform(-0.01, 0.01, n)
    return np.stack([x, y, z], axis=1)


def gen_slicer(rings=40, per=1100):
    # nozzle profile: radius(z) narrowing then flaring, sliced into horizontal rings
    pts = []
    for r in range(rings):
        t = r / (rings - 1)
        z = (t - 0.5) * 0.9
        base = 0.34 - 0.22 * math.sin(t * math.pi) + 0.10 * t     # waisted nozzle
        for _ in range(per):
            a = random.uniform(0, 2 * math.pi)
            rad = base * random.uniform(0.98, 1.02)
            pts.append((rad * math.cos(a), z, rad * math.sin(a)))
    return np.asarray(pts, dtype="f4")


def gen_cube(per=3500):
    pts = []
    c = [-0.5, 0.5]
    edges = []
    for a in c:
        for bb in c:
            edges.append(((a, bb, -0.5), (a, bb, 0.5)))
            edges.append(((a, -0.5, bb), (a, 0.5, bb)))
            edges.append(((-0.5, a, bb), (0.5, a, bb)))
    for (p0, p1) in edges:
        for _ in range(per):
            t = random.random()
            j = [random.uniform(-0.006, 0.006) for _ in range(3)]
            pts.append((p0[0] + (p1[0] - p0[0]) * t + j[0],
                        p0[1] + (p1[1] - p0[1]) * t + j[1],
                        p0[2] + (p1[2] - p0[2]) * t + j[2]))
    for cx in c:
        for cy in c:
            for cz in c:
                for _ in range(400):
                    pts.append((cx + random.uniform(-0.02, 0.02),
                                cy + random.uniform(-0.02, 0.02),
                                cz + random.uniform(-0.02, 0.02)))
    return np.asarray(pts, dtype="f4")


write_bin("forklift.bin", gen_forklift())
write_bin("slicer.bin", gen_slicer())
write_bin("cube.bin", gen_cube())
print("shapes written to", os.path.abspath(OUT))
