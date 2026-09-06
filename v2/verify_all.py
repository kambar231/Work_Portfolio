"""Whole-page consistency + performance checker for the v2 portfolio.

Serves the repo root over HTTP, loads /v2/ in Chromium (headed when a GPU is available,
else headless), and walks the page in 200 px steps. At every step it screenshots to
docs/v2-film/full/NNNN_yYYYY.png and asserts:

  (a) no two cubes' projected bounding boxes intersect,
  (b) no cube brighter than 0.35 opacity sits inside a visible text rect (+40 px),
  (c) no project cube is open (no unfold, no cards on screen),
  (d) nothing overflows the viewport horizontally,
  (e) the running console-error count is 0.

Every 10th step it samples fps for ~1 s; on a real GPU the median must be >= 55 (on
software rendering the fps gate is reported but not enforced, and that is stated).

It also runs the eight-cube open/close click test (X and Escape) and the reading-panel
test. A table is printed at the end and the process exits non-zero on any failure.

Usage:  python v2/verify_all.py [--headless] [--port 8792]
Requires:  playwright (Python), Pillow.  No repo-specific tooling.
"""
import argparse
import functools
import http.server
import os
import socketserver
import statistics
import sys
import threading
from pathlib import Path

from playwright.sync_api import sync_playwright

REPO_ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = REPO_ROOT / "docs" / "v2-film" / "full"

TEXT_SELECTORS = (
    ".display,.hero-sub,.exp-word,.exp2-head,.exp2-systems,.exp2-ach,.exp2-prev,"
    ".slicer-story,.slicer-key,.ev-strip,.flat-head,.projects-head,.web-lead,.web-tiles,"
    ".ds-left,.edu,.contact-inner"
)


def serve(port: int) -> socketserver.TCPServer:
    handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=str(REPO_ROOT))
    httpd = socketserver.TCPServer(("127.0.0.1", port), handler)
    httpd.log_message = lambda *a, **k: None  # type: ignore
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd


def boxes_intersect(a, b, pad=0.0):
    return not (a["x"] + a["w"] + pad <= b["x"] or b["x"] + b["w"] + pad <= a["x"]
                or a["y"] + a["h"] + pad <= b["y"] or b["y"] + b["h"] + pad <= a["y"])


# A tilted cube's axis-aligned projected box overstates its visible silhouette (empty
# corners), so cube-cube overlap is judged on the inscribed footprint (matches cubes.js).
CUBE_SHRINK = 0.68


def shrink(box, f=CUBE_SHRINK):
    return {"x": box["x"] + box["w"] * (1 - f) / 2, "y": box["y"] + box["h"] * (1 - f) / 2,
            "w": box["w"] * f, "h": box["h"] * f}


def launch(pw, headless):
    args = ["--use-gl=angle", "--ignore-gpu-blocklist", "--enable-gpu"]
    if headless:
        return pw.chromium.launch(headless=True)
    return pw.chromium.launch(headless=False, args=args)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--headless", action="store_true")
    ap.add_argument("--port", type=int, default=8792)
    ap.add_argument("--step", type=int, default=200)
    args = ap.parse_args()

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for old in OUT_DIR.glob("*.png"):
        old.unlink()
    httpd = serve(args.port)
    url = f"http://127.0.0.1:{args.port}/v2/"
    failures = []
    rows = []

    with sync_playwright() as pw:
        try:
            browser = launch(pw, args.headless)
        except Exception:
            browser = launch(pw, True)
        pg = browser.new_page(viewport={"width": 1440, "height": 900}, device_scale_factor=1)
        errors = []
        pg.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
        pg.on("pageerror", lambda e: errors.append("PAGEERROR: " + e.message))
        pg.on("requestfailed", lambda r: errors.append("REQFAIL: " + r.url))
        pg.goto(url, wait_until="load")
        pg.wait_for_timeout(4200)

        sh = pg.evaluate("() => document.documentElement.scrollHeight")
        vh = pg.evaluate("() => window.innerHeight")

        # detect a real GPU from the WebGL renderer string (SwiftShader/llvmpipe/basic =
        # software); the fps gate is enforced only on real hardware.
        renderer = pg.evaluate("""() => {
          try { const c = document.createElement('canvas'); const gl = c.getContext('webgl') || c.getContext('experimental-webgl');
            const dbg = gl.getExtension('WEBGL_debug_renderer_info');
            const s = (dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER)) || '';
            const lose = gl.getExtension('WEBGL_lose_context'); if (lose) lose.loseContext();  // don't leak a context
            return s; }
          catch (e) { return ''; }
        }""")
        soft_markers = ("swiftshader", "llvmpipe", "software", "microsoft basic", "mesa offscreen")
        gpu = bool(renderer) and not any(s in renderer.lower() for s in soft_markers)
        warm = sample_fps(pg)
        fps_samples = []
        print(f"renderer: {renderer!r}")
        print(f"warm-up fps {warm:.0f} -> {'GPU (fps gate enforced)' if gpu else 'software render (fps reported only)'}")

        end_y = max(0, sh - vh)
        print(f"document end (scrollHeight - innerHeight) = {end_y}")
        positions = list(range(0, end_y + args.step, args.step))
        last_idx = len(positions) - 1
        for idx, y in enumerate(positions):
            pg.evaluate(f"() => window.__v2.scrollToY({y})")
            # the last position is the document end: let the contact grid finish settling
            pg.wait_for_timeout(2200 if idx == last_idx else 320)
            checks = {}

            # at the document end, every cube must be on its grid slot (< 6 px)
            if idx == last_idx:
                slot = pg.evaluate("""() => {
                  const s = window.__v2.gridSlots(); const c = window.__v2.cubeCenters();
                  let maxd = 0; for (let i = 0; i < 8; i++) maxd = Math.max(maxd, Math.hypot(c[i].x-s[i].x, c[i].y-s[i].y));
                  return +maxd.toFixed(1);
                }""")
                checks["g_contact_on_slot"] = slot <= 6
                if slot > 6:
                    failures.append(("contact-end-slot", f"max slot dist {slot} px", 0))

            cubes = pg.evaluate("() => window.__v2.allCubes()")
            # the cube layer is faded out entirely inside the dark stripe; when the canvas is
            # invisible there are no cubes to check for overlap / text / shape
            cubes_visible = pg.evaluate("() => window.__v2.cubesCanvasOpacity()") > 0.1
            vis = [c for c in cubes if c["op"] > 0.12 and c["box"]["w"] > 0] if cubes_visible else []
            overlap = 0.0
            for i in range(len(vis)):
                for j in range(i + 1, len(vis)):
                    a, b = shrink(vis[i]["box"]), shrink(vis[j]["box"])
                    if boxes_intersect(a, b, pad=-1.0):
                        ox = min(a["x"] + a["w"], b["x"] + b["w"]) - max(a["x"], b["x"])
                        oy = min(a["y"] + a["h"], b["y"] + b["h"]) - max(a["y"], b["y"])
                        overlap = max(overlap, min(ox, oy))
            checks["a_no_cube_overlap"] = overlap <= 0.5

            text_rects = pg.evaluate(f"""() => Array.from(document.querySelectorAll('{TEXT_SELECTORS}'))
                .map(e => e.getBoundingClientRect())
                .filter(r => r.width > 4 && r.height > 4 && r.bottom > 0 && r.top < window.innerHeight)
                .map(r => ({{x:r.x, y:r.y, w:r.width, h:r.height}}))""")
            bright_on_text = False
            for c in (cubes if cubes_visible else []):
                if c["op"] <= 0.35:
                    continue
                bx = c["box"]
                for r in text_rects:
                    if boxes_intersect(bx, {"x": r["x"] - 40, "y": r["y"] - 40, "w": r["w"] + 80, "h": r["h"] + 80}):
                        bright_on_text = True
                        break
                if bright_on_text:
                    break
            checks["b_no_bright_cube_on_text"] = not bright_on_text

            # HARD exclusion: no visible cube (dimmed or not) may sit inside an active morph
            # shape box. Use the engine's OWN shape rects (already +60) and the inscribed
            # footprint, so the check and the engine agree exactly.
            shape_rects = pg.evaluate("() => window.__v2.shapeRects()")
            cube_on_shape = False
            for c in (cubes if cubes_visible else []):
                if c["op"] < 0.05:
                    continue
                for s in shape_rects:
                    if boxes_intersect(shrink(c["box"]), s, pad=-1.0):
                        cube_on_shape = True
                        break
                if cube_on_shape:
                    break
            checks["f_no_cube_on_shape"] = not cube_on_shape

            open_idx = pg.evaluate("() => window.__v2.projectOpen()")
            cards = pg.evaluate("() => document.querySelectorAll('#project-cards .pc').length")
            checks["c_no_open_unfold"] = open_idx < 0 and cards == 0

            ov = pg.evaluate("() => document.documentElement.scrollWidth - window.innerWidth")
            checks["d_no_h_overflow"] = ov <= 1

            checks["e_no_console_errors"] = len(errors) == 0

            fps = ""
            if idx % 10 == 0:
                f = sample_fps(pg)
                fps_samples.append(f)
                fps = f"{f:.0f}"

            passed = all(checks.values())
            rows.append((y, passed, fps, dict(checks), round(overlap, 1)))
            if not passed:
                failures.append((y, {k: v for k, v in checks.items() if not v}, round(overlap, 1)))

            pg.screenshot(path=str(OUT_DIR / f"{idx:04d}_y{y:05d}.png"))

        # interaction tests
        click_fail = run_click_test(pg)
        panel_fail = run_panel_test(pg)
        contact_fail = run_contact_test(pg, sh, vh)
        if click_fail:
            failures.append(("click-test", click_fail, 0))
        if panel_fail:
            failures.append(("panel-test", panel_fail, 0))
        if contact_fail:
            failures.append(("contact-grid", contact_fail, 0))

        med_fps = statistics.median(fps_samples) if fps_samples else 0
        fps_ok = (med_fps >= 55) if gpu else True
        if not fps_ok:
            failures.append(("fps", f"median {med_fps:.0f} < 55 on GPU", 0))

        browser.close()

    httpd.shutdown()

    print("\n== per-position ==")
    print(f"{'y':>7} {'pass':>5} {'fps':>4}  failing-checks")
    for y, passed, fps, checks, overlap in rows:
        bad = ",".join(k for k, v in checks.items() if not v)
        print(f"{y:>7} {'OK' if passed else 'FAIL':>5} {fps:>4}  {bad}")
    print(f"\nmedian fps sample: {med_fps:.0f}  (gpu={gpu}, enforced={gpu})")
    print(f"click test: {'OK' if not click_fail else click_fail}")
    print(f"panel test: {'OK' if not panel_fail else panel_fail}")
    print(f"contact grid: {'OK' if not contact_fail else contact_fail}")
    print(f"frames written: {len(rows)} -> {OUT_DIR}")

    if failures:
        print(f"\nFAILURES ({len(failures)}):")
        for f in failures:
            print("  ", f)
        sys.exit(1)
    print("\nALL CHECKS PASSED")


def sample_fps(pg):
    return pg.evaluate("""() => new Promise(res => {
      let n = 0, t0 = performance.now();
      function tick(t){ n++; if (t - t0 >= 1000) res(n * 1000 / (t - t0)); else requestAnimationFrame(tick); }
      requestAnimationFrame(tick);
    })""")


def run_click_test(pg):
    projTop = pg.evaluate("() => document.getElementById('projects').offsetTop")
    Y = projTop - 135
    fails = []
    for i in range(8):
        pg.evaluate(f"() => window.__v2.scrollToY({Y})")
        pg.wait_for_timeout(500)
        if pg.evaluate("() => window.__v2.projectOpen()") >= 0:
            pg.keyboard.press("Escape")
            pg.wait_for_timeout(900)
        y0 = pg.evaluate("() => window.scrollY")
        pg.evaluate(f"() => window.__v2.openProject({i})")
        pg.wait_for_timeout(1500)
        # by now the net is complete (~1.1 s) plus >350 ms; cards must be fully faded in
        chk = pg.evaluate("""() => {
          const a = window.__v2.faceAnchors(); const cs = window.__v2.cardCentres();
          let maxd = null, minop = 1;
          if (a) { maxd = 0; cs.forEach(c => { const d = Math.hypot(c.x-a[c.key].x, c.y-a[c.key].y); if (d>maxd) maxd=d; if (c.op<minop) minop=c.op; }); }
          return { open: window.__v2.projectOpen(), n: cs.length,
                   maxd: maxd===null?null:+maxd.toFixed(2), minop: +minop.toFixed(2) };
        }""")
        pg.screenshot(path=str(OUT_DIR / f"open_{i}.png"))
        if i % 2 == 0:
            pg.click("#project-close")
        else:
            pg.keyboard.press("Escape")
        pg.wait_for_timeout(1100)
        y1 = pg.evaluate("() => window.scrollY")
        after = pg.evaluate("() => window.__v2.projectOpen()")
        ok = (chk["open"] == i and chk["n"] == 6 and chk["maxd"] is not None
              and chk["maxd"] <= 8 and chk["minop"] >= 0.95 and after == -1 and abs(y1 - y0) < 2)
        if not ok:
            fails.append({"cube": i, **chk, "after": after, "dscroll": round(y1 - y0, 1)})
    return fails


def run_contact_test(pg, sh, vh):
    # scroll to the very bottom and let the settle finish, then assert every cube sits on
    # its grid slot (< 6 px) and no two boxes overlap.
    pg.evaluate(f"() => window.__v2.scrollToY({sh})")
    pg.wait_for_timeout(2600)
    data = pg.evaluate("""() => {
      const slots = window.__v2.gridSlots(); const centers = window.__v2.cubeCenters();
      const boxes = window.__v2.allCubes();
      return centers.map((c, i) => ({ cx: c.x, cy: c.y, sx: slots[i].x, sy: slots[i].y,
        box: boxes[i].box, op: boxes[i].op }));
    }""")
    fails = []
    maxd = 0.0
    for i, d in enumerate(data):
        dist = ((d["cx"] - d["sx"]) ** 2 + (d["cy"] - d["sy"]) ** 2) ** 0.5
        maxd = max(maxd, dist)
        if dist > 6:
            fails.append({"cube": i, "slot_dist": round(dist, 1)})
    boxes = [d["box"] for d in data if d["op"] > 0.12]
    for i in range(len(boxes)):
        for j in range(i + 1, len(boxes)):
            if boxes_intersect(shrink(boxes[i]), shrink(boxes[j]), pad=-1.0):
                fails.append({"overlap": [i, j]})
    if fails:
        fails.append({"max_slot_dist": round(maxd, 1)})
    return fails


def run_panel_test(pg):
    names = pg.evaluate("() => Array.from(document.querySelectorAll('#panels .panel')).map(e => e.id.replace('panel-',''))")
    fails = []
    for name in names:
        pg.evaluate(f"() => window.__v2panel.open('{name}')")
        pg.wait_for_timeout(200)
        opened = pg.evaluate(f"() => {{ const el = document.getElementById('panel-{name}'); return !el.hidden && el.classList.contains('open'); }}")
        pg.keyboard.press("Escape")
        pg.wait_for_timeout(420)
        closed = pg.evaluate("() => !window.__v2panel.isOpen()")
        if not (opened and closed):
            fails.append({"panel": name, "opened": opened, "closed": closed})
    return fails


if __name__ == "__main__":
    main()
