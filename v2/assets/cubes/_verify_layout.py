"""Projection verifier for the hero layout.
For widths 1280/1440/1920 (height 900):
  - sorted state: assert the headline box intersects no cube box and no label box.
  - unravel 0/.25/.5/.75/1: assert no two cube boxes intersect.
Prints PASS/FAIL lines and exits nonzero on any failure.
Run from repo root with the dev server up.
"""
import sys
from playwright.sync_api import sync_playwright

URL = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8791/v2/"
WIDTHS = [1280, 1440, 1920]

def intersect(a, b, pad=0):
    return not (a["x"] + a["w"] + pad < b["x"] or b["x"] + b["w"] + pad < a["x"]
                or a["y"] + a["h"] + pad < b["y"] or b["y"] + b["h"] + pad < a["y"])

fails = 0
with sync_playwright() as p:
    b = p.chromium.launch()
    for W in WIDTHS:
        pg = b.new_page(viewport={"width": W, "height": 900}, device_scale_factor=1)
        pg.goto(URL, wait_until="load")
        pg.wait_for_function("() => window.__v2 && window.__v2.cubeBoxes().length === 8")
        pg.evaluate("() => window.__v2.freeze()")

        def settle(pval):
            pg.evaluate(f"() => window.__v2.setUnravel({pval})")
            pg.wait_for_timeout(120)  # let a few frames run so positions/labels update

        # sorted: headline vs cubes + labels
        settle(0)
        head = pg.evaluate("() => window.__v2.headlineBox()")
        cubes = pg.evaluate("() => window.__v2.cubeBoxes()")
        labels = pg.evaluate("() => window.__v2.labelBoxes()")
        hc = [i for i, c in enumerate(cubes) if intersect(head, c)]
        hl = [i for i, l in enumerate(labels) if intersect(head, l)]
        if hc or hl:
            fails += 1
            print(f"[{W}] FAIL headline overlaps cubes={hc} labels={hl}  head={ {k:round(v) for k,v in head.items()} }")
        else:
            print(f"[{W}] PASS headline clear of all cubes and labels")

        # unravel path: no two cubes intersect
        for pv in [0, 0.25, 0.5, 0.75, 1.0]:
            settle(pv)
            cubes = pg.evaluate("() => window.__v2.cubeBoxes()")
            bad = []
            for i in range(len(cubes)):
                for j in range(i + 1, len(cubes)):
                    if intersect(cubes[i], cubes[j]):
                        bad.append((i, j))
            if bad:
                fails += 1
                print(f"[{W}] FAIL unravel {pv}: overlapping cube pairs {bad}")
            else:
                print(f"[{W}] PASS unravel {pv}: no cube overlaps")
        pg.close()
    b.close()

print("RESULT:", "ALL PASS" if fails == 0 else f"{fails} FAILURES")
sys.exit(1 if fails else 0)
