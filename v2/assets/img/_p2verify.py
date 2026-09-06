"""P2 verification: scroll to each chapter via Lenis (so ScrollTrigger + cube travel
run), screenshot the hero moment and the evidence strip at 1440 and 390, and click-test
all four reading-panel openers (open, in-viewport, close, scroll restored).
"""
import sys, os
from playwright.sync_api import sync_playwright

URL = "http://localhost:8791/v2/"
OUT = os.path.join("docs", "v2-film", "p2")
os.makedirs(OUT, exist_ok=True)
CHAPTERS = ["#origin", "#polymer", "#casting", "#cnc", "#slicer"]
PANELS = ["polymer", "casting", "cnc", "slicer"]

def shots(pg, w, tag):
    for sel in CHAPTERS:
        top = pg.evaluate(f"() => document.querySelector('{sel}').getBoundingClientRect().top + window.scrollY")
        # hero moment (mid pin) and evidence strip (after the 100vh pin)
        for label, off in [("hero", 450), ("evidence", int(pg.viewport_size['height']) + 260)]:
            pg.evaluate("(y) => window.__v2.scrollToY(y)", top + off)
            pg.wait_for_timeout(700)
            name = f"{tag}_{sel.strip('#')}_{label}.png"
            pg.screenshot(path=os.path.join(OUT, name))
    print(f"[{tag}] chapter shots written")

def intersect(a, b, pad=0):
    return not (a["x"] + a["w"] + pad < b["x"] or b["x"] + b["w"] + pad < a["x"]
                or a["y"] + a["h"] + pad < b["y"] or b["y"] + b["h"] + pad < a["y"])

fails = 0
with sync_playwright() as p:
    b = p.chromium.launch()
    # ---- desktop chapter shots ----
    pg = b.new_page(viewport={"width": 1440, "height": 900}, device_scale_factor=1)
    pg.goto(URL, wait_until="load"); pg.wait_for_timeout(1200)
    shots(pg, 1440, "d")

    # ---- Fix B: no cube brighter than 0.35 sits inside a text rect (+40px), 8 positions ----
    for sel in ["#origin", "#polymer", "#casting", "#cnc", "#slicer"]:
        top = pg.evaluate(f"() => document.querySelector('{sel}').getBoundingClientRect().top + window.scrollY")
        bad_here = 0
        for k in range(8):
            pg.evaluate("(y) => window.__v2.scrollToY(y)", top + k * 220)
            pg.wait_for_timeout(320)
            text = pg.evaluate(f"() => window.__v2.textColBox('{sel}')")
            cubes_st = pg.evaluate("() => window.__v2.allCubes()")
            if not text:
                continue
            for c in cubes_st:
                if c["op"] > 0.36 and intersect(c["box"], text, 40):
                    bad_here += 1
        if bad_here:
            fails += 1
            print(f"Fix B {sel}: FAIL ({bad_here} bright cube/text overlaps across 8 positions)")
        else:
            print(f"Fix B {sel}: PASS (no bright cube over text)")

    # ---- reading panel click test ----
    for name in PANELS:
        top = pg.evaluate(f"() => document.querySelector('#{name}').getBoundingClientRect().top + window.scrollY")
        pg.evaluate("(y) => window.__v2.scrollToY(y)", top + 300)
        pg.wait_for_timeout(400)
        before = pg.evaluate("() => window.scrollY")
        pg.evaluate(f"() => document.querySelector('.ch-open[data-panel=\"{name}\"]').click()")
        pg.wait_for_timeout(500)
        opened = pg.evaluate("() => window.__v2panel.isOpen()")
        # panel content visible in viewport?
        vis = pg.evaluate(f"""() => {{
            const p = document.getElementById('panel-{name}');
            const r = p.getBoundingClientRect();
            const h2 = p.querySelector('h2').getBoundingClientRect();
            return p.classList.contains('open') && r.width>0 && h2.top < window.innerHeight && h2.bottom>0;
        }}""")
        # can the panel body scroll?
        pg.evaluate(f"() => document.querySelector('#panel-{name} .panel-scroll').scrollTo(0, 400)")
        pg.wait_for_timeout(200)
        scrolled = pg.evaluate(f"() => document.querySelector('#panel-{name} .panel-scroll').scrollTop")
        # close via Escape
        pg.keyboard.press("Escape")
        pg.wait_for_timeout(500)
        closed = not pg.evaluate("() => window.__v2panel.isOpen()")
        after = pg.evaluate("() => window.scrollY")
        ok = opened and vis and scrolled > 100 and closed and abs(after - before) < 8
        if not ok:
            fails += 1
        print(f"panel {name}: opened={opened} visible={vis} scrolled={scrolled} closed={closed} restored={abs(after-before)}px -> {'OK' if ok else 'FAIL'}")
    pg.close()

    # ---- mobile chapter shots ----
    pg2 = b.new_page(viewport={"width": 390, "height": 844}, device_scale_factor=1)
    pg2.goto(URL, wait_until="load"); pg2.wait_for_timeout(1200)
    shots(pg2, 390, "m")
    pg2.close()
    b.close()

print("PANEL RESULT:", "ALL PASS" if fails == 0 else f"{fails} FAILURES")
sys.exit(1 if fails else 0)
