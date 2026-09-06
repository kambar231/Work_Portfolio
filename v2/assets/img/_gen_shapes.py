"""Generate morph-target point clouds for particles.js and write them to
v2/assets/shapes/*.bin as raw little-endian Float32 [x,y,z,cls, x,y,z,cls, ...].

Coordinates are NORMALISED (height ~1 unit, centred on the shape's bounding box);
particles.js scales and places each shape into world space at runtime, so these files
are viewport-agnostic. The 4th channel is a CLASS flag read by the shader:
    cls = 1.0  EDGE point  (dark #4a4a4a, size 1.9) -> the crisp silhouette
    cls = 0.0  FILL point  (light #c4c4c4, size 1.3) -> sparse interior mass

  forklift.bin  reach-truck: 70% edge points sampled along the dilated stroke outline,
                30% fill points sampled sparsely (~1/6 density) inside the solid masses.
  slicer.bin    a nozzle-profile lathe sliced into 40 rings (1100 pts/ring); all edge.
  cube.bin      the 12 edges of a cube plus corner clusters; all edge.

Run from repo root: python v2/assets/img/_gen_shapes.py
"""
import os, math, random
import numpy as np
from playwright.sync_api import sync_playwright

OUT = os.path.join(os.path.dirname(__file__), "..", "shapes")
os.makedirs(OUT, exist_ok=True)
random.seed(7); np.random.seed(7)


def write_bin(name, pts, cls):
    pts = np.asarray(pts, dtype="<f4").reshape(-1, 3)
    cls = np.asarray(cls, dtype="<f4").reshape(-1, 1)
    out = np.concatenate([pts, cls], axis=1).astype("<f4")
    with open(os.path.join(OUT, name), "wb") as f:
        f.write(out.tobytes())
    ne = int((cls > 0.5).sum())
    print(f"{name}: {len(pts)} points ({ne} edge, {len(pts)-ne} fill)")


# ---- forklift: two SVGs (outline strokes + solid masses), rasterised and sampled ----
# reach truck facing LEFT (forks toward the text column). viewBox 0 0 380 440.
EDGE_SVG = '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 380 440" fill="none" stroke="#000" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
  <g stroke-width="3.6">
    <rect x="190" y="300" width="150" height="76" rx="10"/>
    <line x1="198" y1="96" x2="338" y2="96"/>
    <line x1="206" y1="96" x2="206" y2="300"/>
    <line x1="332" y1="110" x2="332" y2="300"/>
    <circle cx="300" cy="392" r="36"/>
    <circle cx="150" cy="398" r="17"/>
  </g>
  <g>
    <line x1="238" y1="96" x2="238" y2="120"/><line x1="304" y1="96" x2="304" y2="120"/>
    <rect x="314" y="206" width="20" height="12" rx="2"/><circle cx="252" cy="248" r="14"/><line x1="252" y1="262" x2="252" y2="300"/>
    <line x1="205" y1="336" x2="325" y2="336"/><path d="M188,314 L168,300 M188,300 L168,318"/>
    <circle cx="300" cy="392" r="13"/><line x1="264" y1="392" x2="336" y2="392"/><line x1="300" y1="356" x2="300" y2="428"/>
    <circle cx="150" cy="398" r="6"/><line x1="133" y1="398" x2="167" y2="398"/><line x1="150" y1="381" x2="150" y2="415"/>
    <line x1="150" y1="110" x2="150" y2="362"/><line x1="168" y1="110" x2="168" y2="362"/><line x1="150" y1="150" x2="168" y2="150"/><line x1="150" y1="250" x2="168" y2="250"/><circle cx="159" cy="110" r="6"/><rect x="146" y="300" width="26" height="30" rx="3"/>
    <line x1="150" y1="330" x2="150" y2="384"/><line x1="150" y1="384" x2="64" y2="384"/><line x1="64" y1="384" x2="58" y2="377"/><line x1="150" y1="376" x2="72" y2="376"/>
    <rect x="134" y="76" width="36" height="22" rx="3"/><circle cx="144" cy="87" r="4"/><circle cx="160" cy="87" r="4"/>
  </g>
</svg>'''

# solid masses (no stroke) for sparse fill sampling: mast column, chassis, overhead
# guard bar, drive tyre, load wheel, battery box.
FILL_SVG = '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 380 440" fill="#000" stroke="none">
  <rect x="190" y="300" width="150" height="76" rx="10"/>
  <rect x="198" y="96" width="140" height="12" rx="3"/>
  <rect x="200" y="108" width="12" height="192"/>
  <circle cx="300" cy="392" r="34"/>
  <circle cx="150" cy="398" r="15"/>
  <rect x="146" y="300" width="26" height="62" rx="3"/>
  <rect x="150" y="110" width="18" height="252"/>
</svg>'''


def _rasterise(svg, w=1024, h=1024, sw=820, sh=950):
    html = (f'<!doctype html><html><head><style>html,body{{margin:0}}'
            f'.b{{width:{w}px;height:{h}px;background:#fff;display:flex;align-items:center;'
            f'justify-content:center}}.b svg{{width:{sw}px;height:{sh}px}}</style></head>'
            f'<body><div class="b">{svg}</div></body></html>')
    with sync_playwright() as p:
        b = p.chromium.launch()
        pg = b.new_page(viewport={"width": w, "height": h}, device_scale_factor=1)
        pg.set_content(html); pg.wait_for_timeout(150)
        png = os.path.join(OUT, "_forklift_mask.png")
        pg.locator(".b").screenshot(path=png)
        b.close()
    from PIL import Image
    return np.asarray(Image.open(png).convert("L"))


def gen_forklift(n=62000, edge_frac=0.72):
    edge_mask = _rasterise(EDGE_SVG)
    fill_mask = _rasterise(FILL_SVG)
    eys, exs = np.where(edge_mask < 128)             # dark = stroke outline
    fys, fxs = np.where((fill_mask < 128) & (edge_mask >= 128))  # interior, not on outline
    n_edge = int(n * edge_frac)
    n_fill = n - n_edge
    ei = np.random.randint(0, len(exs), size=n_edge)
    fi = np.random.randint(0, len(fxs), size=n_fill)
    px = np.concatenate([exs[ei], fxs[fi]]).astype("f4")
    py = np.concatenate([eys[ei], fys[fi]]).astype("f4")
    cls = np.concatenate([np.ones(n_edge), np.zeros(n_fill)]).astype("f4")
    # small on-screen jitter (~1px in the 1024 raster) so lines are not single-pixel thin
    px += np.random.uniform(-1.0, 1.0, n); py += np.random.uniform(-1.0, 1.0, n)
    # normalise by the combined bounding box so the truck is exactly height 1, centred
    allx = np.concatenate([exs, fxs]).astype("f4"); ally = np.concatenate([eys, fys]).astype("f4")
    x0, x1 = allx.min(), allx.max(); y0, y1 = ally.min(), ally.max()
    cx = (x0 + x1) / 2; cy = (y0 + y1) / 2; hgt = (y1 - y0)
    x = (px - cx) / hgt
    y = -(py - cy) / hgt                              # flip to y-up
    z = np.random.uniform(-0.008, 0.008, n)
    return np.stack([x, y, z], axis=1), cls


def gen_slicer(rings=40, per=1100):
    # nozzle profile: radius(z) waisted then flaring, sliced into horizontal rings
    pts = []
    for r in range(rings):
        t = r / (rings - 1)
        z = (t - 0.5) * 0.9
        base = 0.34 - 0.22 * math.sin(t * math.pi) + 0.10 * t
        for _ in range(per):
            a = random.uniform(0, 2 * math.pi)
            rad = base * random.uniform(0.99, 1.01)
            pts.append((rad * math.cos(a), z, rad * math.sin(a)))
    pts = np.asarray(pts, dtype="f4")
    return pts, np.ones(len(pts), dtype="f4")          # all edge class


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
    pts = np.asarray(pts, dtype="f4")
    return pts, np.ones(len(pts), dtype="f4")          # all edge class


fp, fc = gen_forklift(); write_bin("forklift.bin", fp, fc)
sp, sc = gen_slicer(); write_bin("slicer.bin", sp, sc)
cp, cc = gen_cube(); write_bin("cube.bin", cp, cc)
print("shapes written to", os.path.abspath(OUT))
