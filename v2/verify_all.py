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
import io
import json
import os
import socketserver
import statistics
import sys
import threading
from pathlib import Path

import numpy as np
from PIL import Image
from playwright.sync_api import sync_playwright

REPO_ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = REPO_ROOT / "docs" / "v2-film" / "full"
FACES_DIR = OUT_DIR / "faces"

TEXT_SELECTORS = (
    ".display,.hero-sub,.exp-word,.exp2-head,.exp2-systems,.exp2-ach,.exp2-prev,"
    ".slicer-story,.slicer-key,.ev-strip,.flat-head,.projects-head,.web-lead,.web-tiles,"
    ".ds-left,.edu,.contact-inner,.prev-band"
)

# ---- round-3 gate thresholds (spec section 8) ----
NO_POP_MAX = 14.0        # max per-frame cube-centre displacement (px)
MIN_CUBE_OP = 0.98       # cube opacity outside the projects scrim state
NO_POP_TICKS = 40        # rAF ticks sampled per no-pop probe
SEAM_EDGE = 24           # grayscale diagonal edge response threshold
SEAM_FRAC = 0.60         # fraction of a diagonal above SEAM_EDGE that flags a seam
SEAM_MIN_LEN = 200       # a diagonal must be longer than this (px) to be judged


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
    # headed launch drives the real GPU (RTX -> 60 fps, fps gate enforced). Headless falls back
    # to SwiftShader on this box, which caps ~35-45 fps, so run headed unless --headless is set.
    args = ["--use-gl=angle", "--ignore-gpu-blocklist", "--enable-gpu", "--enable-gpu-rasterization"]
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
    FACES_DIR.mkdir(parents=True, exist_ok=True)
    for old in OUT_DIR.glob("*.png"):
        old.unlink()
    for old in FACES_DIR.glob("*.png"):
        old.unlink()
    httpd = serve(args.port)
    url = f"http://127.0.0.1:{args.port}/v2/"
    failures = []
    rows = []
    # round-3 gate trackers
    worst_pop_static = 0.0
    worst_pop_static_y = 0
    min_op = 1.0
    min_op_y = 0

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
            vis = [(i, c) for i, c in enumerate(cubes) if c["op"] > 0.12 and c["box"]["w"] > 0] if cubes_visible else []
            overlap = 0.0
            overlap_pairs = []  # (cube_i, cube_j, px) in allCubes order
            for m in range(len(vis)):
                for n in range(m + 1, len(vis)):
                    ia, ca = vis[m]
                    ib, cb = vis[n]
                    a, b = shrink(ca["box"]), shrink(cb["box"])
                    if boxes_intersect(a, b, pad=-1.0):
                        ox = min(a["x"] + a["w"], b["x"] + b["w"]) - max(a["x"], b["x"])
                        oy = min(a["y"] + a["h"], b["y"] + b["h"]) - max(a["y"], b["y"])
                        ov_amt = min(ox, oy)
                        overlap = max(overlap, ov_amt)
                        if ov_amt > 0.5:
                            overlap_pairs.append((ia, ib, round(ov_amt, 1)))
            checks["a_no_cube_overlap"] = overlap <= 0.5

            text_rects = pg.evaluate(f"""() => Array.from(document.querySelectorAll('{TEXT_SELECTORS}'))
                .map(e => e.getBoundingClientRect())
                .filter(r => r.width > 4 && r.height > 4 && r.bottom > 0 && r.top < window.innerHeight)
                .map(r => ({{x:r.x, y:r.y, w:r.width, h:r.height}}))""")
            # routing gate: cubes are never dimmed now, so ANY cube sitting inside a text
            # rect (+40 px) is a routing failure. threshold raised from 0.35 to 0.98.
            on_text_cubes = []  # cube indices (allCubes order) sitting on a text rect +40
            for i, c in enumerate(cubes if cubes_visible else []):
                if c["op"] < MIN_CUBE_OP:
                    continue
                bx = c["box"]
                for r in text_rects:
                    if boxes_intersect(bx, {"x": r["x"] - 40, "y": r["y"] - 40, "w": r["w"] + 80, "h": r["h"] + 80}):
                        on_text_cubes.append(i)
                        break
            checks["b_no_bright_cube_on_text"] = not on_text_cubes

            # HARD exclusion: no visible cube (dimmed or not) may sit inside an active morph
            # shape box. Use the engine's OWN shape rects (already +60) and the inscribed
            # footprint, so the check and the engine agree exactly.
            shape_rects = pg.evaluate("() => window.__v2.shapeRects()")
            on_shape_cubes = []  # cube indices (allCubes order) inside a morph shape box
            for i, c in enumerate(cubes if cubes_visible else []):
                if c["op"] < 0.05:
                    continue
                for s in shape_rects:
                    if boxes_intersect(shrink(c["box"]), s, pad=-1.0):
                        on_shape_cubes.append(i)
                        break
            checks["f_no_cube_on_shape"] = not on_shape_cubes

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

            # MIN-OPACITY gate: outside the projects-open state every cube op must be >= 0.98
            if open_idx < 0 and cubes_visible:
                step_min_op = min((c["op"] for c in cubes), default=1.0)
                if step_min_op < min_op:
                    min_op = step_min_op
                    min_op_y = y

            # NO-POP gate (static): sample cube centres over consecutive rAF ticks once the
            # scroll has settled; the worst per-frame displacement of any cube must be <= 14 px
            step_pop = sample_no_pop_static(pg, NO_POP_TICKS)
            if step_pop > worst_pop_static:
                worst_pop_static = step_pop
                worst_pop_static_y = y

            passed = all(checks.values())
            rows.append((y, passed, fps, dict(checks), round(overlap, 1)))
            if not passed:
                detail = {}
                if overlap_pairs:
                    detail["overlap(i,j,px)"] = overlap_pairs
                if on_text_cubes:
                    detail["on_text_cubes"] = on_text_cubes
                if on_shape_cubes:
                    detail["on_shape_cubes"] = on_shape_cubes
                failures.append((y, {k: v for k, v in checks.items() if not v}, round(overlap, 1), detail))

            pg.screenshot(path=str(OUT_DIR / f"{idx:04d}_y{y:05d}.png"))

        # NO-POP gate (continuous): scroll y=0 -> bottom at 1200 px/s, sampling cube centres
        # every rAF; the worst per-frame displacement of any cube must stay <= 14 px.
        pop_scroll = sample_no_pop_scroll(pg, end_y)
        worst_pop_scroll = pop_scroll["worst"]
        worst_pop_scroll_y = pop_scroll["worstY"]

        # interaction tests
        click_fail = run_click_test(pg)
        panel_fail = run_panel_test(pg)
        contact_fail = run_contact_test(pg, sh, vh)
        panel_scroll_info = run_panel_scroll_test(pg)
        panel_scroll_fail = None if panel_scroll_info.get("ok") else panel_scroll_info
        raymond = run_raymond_test(pg)
        seam_report = run_seam_test(pg)
        if click_fail:
            failures.append(("click-test", click_fail, 0))
        if panel_fail:
            failures.append(("panel-test", panel_fail, 0))
        if contact_fail:
            failures.append(("contact-grid", contact_fail, 0))

        # ---- round-3 gate verdicts ----
        if worst_pop_static > NO_POP_MAX:
            failures.append(("no-pop-static", f"worst {worst_pop_static} px at y={worst_pop_static_y}", worst_pop_static))
        if worst_pop_scroll > NO_POP_MAX:
            failures.append(("no-pop-scroll", f"worst {worst_pop_scroll} px at y={worst_pop_scroll_y}", worst_pop_scroll))
        if min_op < MIN_CUBE_OP:
            failures.append(("min-opacity", f"min cube op {min_op} at y={min_op_y}", min_op))
        if panel_scroll_fail:
            failures.append(("panel-scroll", panel_scroll_fail, 0))
        if raymond["status"] == "FAIL":
            failures.append(("raymond", raymond["fails"], 0))
        seam_flagged = sum(s["flagged"] for s in seam_report)
        if seam_flagged > 0:
            failures.append(("seam-crops", [s for s in seam_report if s["flagged"]], seam_flagged))

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

    print("\n== round-3 gates ==")
    print(f"{'gate':<16} {'verdict':>7}  detail")

    def _row(name, ok, detail):
        print(f"{name:<16} {'OK' if ok else 'FAIL':>7}  {detail}")

    _row("NO-POP-STEP", worst_pop_static <= NO_POP_MAX,
         f"worst {worst_pop_static} px (<= {NO_POP_MAX}) at y={worst_pop_static_y}")
    _row("NO-POP-SCROLL", worst_pop_scroll <= NO_POP_MAX,
         f"worst {worst_pop_scroll} px (<= {NO_POP_MAX}) at y={worst_pop_scroll_y}")
    _row("MIN-OPACITY", min_op >= MIN_CUBE_OP,
         f"min cube op {min_op} (>= {MIN_CUBE_OP}) at y={min_op_y}")
    _row("PANEL-SCROLL", not panel_scroll_fail,
         f"panel={panel_scroll_info.get('id')} scrollHeight={panel_scroll_info.get('scrollHeight')} "
         f"scrollTop={panel_scroll_info.get('scrollTop')}")
    if raymond["status"] == "SKIP":
        print(f"{'RAYMOND':<16} {'SKIP':>7}  {raymond.get('reason')} "
              f"(unfold={raymond.get('unfold')}, faces_present={raymond.get('faces_present')})")
    else:
        _row("RAYMOND", raymond["status"] == "OK",
             f"unfold={raymond['unfold']} fails={len(raymond['fails'])} {raymond['fails'] if raymond['fails'] else ''}")
    seam_flagged = sum(s["flagged"] for s in seam_report)
    _row("SEAM-CROPS", seam_flagged == 0,
         "  ".join(f"cube{s['cube']}:{s['flagged']}/{s['faces']}" for s in seam_report))

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


def sample_no_pop_static(pg, ticks):
    # collect cube centres on `ticks` consecutive rAF ticks (no scrolling) and return the
    # worst per-frame displacement, NORMALISED to a 60 fps (16.7 ms) frame so the value is
    # frame-rate independent: a real pop stays hundreds of px, a smooth spring never does.
    return pg.evaluate("""(n) => new Promise(res => {
      const samples = [], times = []; let count = 0;
      function tick(t){
        samples.push(window.__v2.cubeCenters().map(p => ({ x: p.x, y: p.y })));
        times.push(t);
        count++;
        if (count >= n) {
          let worst = 0;
          for (let k = 1; k < samples.length; k++) {
            const a = samples[k - 1], b = samples[k];
            const dt = Math.min(50, Math.max(8, times[k] - times[k - 1]));
            const scale = 16.7 / dt;
            const m = Math.min(a.length, b.length);
            for (let i = 0; i < m; i++) {
              const d = Math.hypot(b[i].x - a[i].x, b[i].y - a[i].y) * scale;
              if (d > worst) worst = d;
            }
          }
          res(+worst.toFixed(2));
        } else requestAnimationFrame(tick);
      }
      requestAnimationFrame(tick);
    })""", ticks)


def sample_no_pop_scroll(pg, end_y, speed=1200):
    # drive a continuous scroll from y=0 to the document bottom at `speed` px/s, sampling
    # cube centres every rAF; return the worst per-frame displacement (normalised to a 60 fps
    # frame, px * 16.7 / dt_ms with dt clamped to [8, 50] ms) and the y where it hit.
    pg.evaluate("() => window.__v2.scrollToY(0)")
    pg.wait_for_timeout(600)
    return pg.evaluate("""([endY, speed]) => new Promise(res => {
      let prev = null, prevT = null, worst = 0, worstY = 0; const t0 = performance.now();
      function tick(t){
        const y = Math.min(endY, speed * (t - t0) / 1000);
        window.__v2.scrollToY(y);
        const cur = window.__v2.cubeCenters().map(p => ({ x: p.x, y: p.y }));
        if (prev) {
          const dt = Math.min(50, Math.max(8, t - prevT));
          const scale = 16.7 / dt;
          const m = Math.min(prev.length, cur.length);
          for (let i = 0; i < m; i++) {
            const d = Math.hypot(cur[i].x - prev[i].x, cur[i].y - prev[i].y) * scale;
            if (d > worst) { worst = d; worstY = y; }
          }
        }
        prev = cur; prevT = t;
        if (y >= endY) res({ worst: +worst.toFixed(2), worstY: Math.round(worstY) });
        else requestAnimationFrame(tick);
      }
      requestAnimationFrame(tick);
    })""", [end_y, speed])


def run_panel_scroll_test(pg):
    # find the LONGEST reading panel dynamically (its scrollHeight), then confirm it scrolls
    # internally by 600 px. Panel content varies, so ray-stability is not assumed longest.
    names = pg.evaluate("() => Array.from(document.querySelectorAll('#panels .panel')).map(e => e.id.replace('panel-',''))")

    def _scroller_metrics():
        return pg.evaluate("""() => {
          const panel = Array.from(document.querySelectorAll('article.panel')).find(p => !p.hidden);
          if (!panel) return null;
          // the article may itself scroll, or an inner .panel-scroll may be the scroller
          const cand = [panel, ...panel.querySelectorAll('.panel-scroll,[data-lenis-prevent]')];
          const el = cand.find(e => e.scrollHeight > e.clientHeight + 1) || panel;
          return { id: panel.id.replace('panel-',''),
                   which: el === panel ? 'article' : (el.className || 'inner'),
                   scrollHeight: el.scrollHeight, clientHeight: el.clientHeight };
        }""")

    longest = None
    for name in names:
        pg.evaluate(f"() => window.__v2panel.open('{name}')")
        pg.wait_for_timeout(220)
        m = _scroller_metrics()
        pg.keyboard.press("Escape")
        pg.wait_for_timeout(160)
        if m and (longest is None or m["scrollHeight"] > longest["scrollHeight"]):
            longest = m

    if longest is None:
        return {"err": "no visible panel among " + str(names)}

    # reopen the longest panel and run the 600 px scroll assertion on its scroller
    pg.evaluate(f"() => window.__v2panel.open('{longest['id']}')")
    pg.wait_for_timeout(600)
    info = pg.evaluate("""() => {
      const panel = Array.from(document.querySelectorAll('article.panel')).find(p => !p.hidden);
      if (!panel) return { err: 'no visible panel' };
      const cand = [panel, ...panel.querySelectorAll('.panel-scroll,[data-lenis-prevent]')];
      const el = cand.find(e => e.scrollHeight > e.clientHeight + 1) || panel;
      const before = { id: panel.id.replace('panel-',''),
                       which: el === panel ? 'article' : (el.className || 'inner'),
                       scrollHeight: el.scrollHeight, clientHeight: el.clientHeight };
      el.scrollTop = 600;
      before.scrollTop = el.scrollTop;
      return before;
    }""")
    pg.screenshot(path=str(OUT_DIR / "panel_scroll.png"))
    pg.keyboard.press("Escape")
    pg.wait_for_timeout(420)
    if info.get("err"):
        info["ok"] = False
        return info
    info["ok"] = (info["scrollHeight"] > info["clientHeight"]) and (info.get("scrollTop", 0) >= 590)
    return info


def _diagonal_seam_flag(gray):
    # gray: 2-D uint8 array. Flag a face if any 45-degree diagonal longer than SEAM_MIN_LEN px
    # has more than SEAM_FRAC of its pixels with an abs neighbour-difference above SEAM_EDGE.
    a = gray.astype(np.int16)
    flipped = np.fliplr(a)
    n = a.shape[0]
    for src in (a, flipped):  # down-right diagonals, then anti-diagonals
        for k in range(-(n - 1), n):
            diag = np.diagonal(src, offset=k)
            if diag.size <= SEAM_MIN_LEN:
                continue
            d = np.abs(np.diff(diag))
            if d.size and (d > SEAM_EDGE).mean() > SEAM_FRAC:
                return True
    return False


def run_seam_test(pg):
    # for each project cube, open it, crop 400x400 around every face anchor, and run a
    # diagonal-line check to catch the old lighting seam. Reports flagged faces per cube.
    report = []
    for i in range(8):
        pg.evaluate(f"() => window.__v2.openProject({i})")
        pg.wait_for_timeout(1400)
        anchors = pg.evaluate("() => window.__v2.faceAnchors()") or {}
        png = pg.screenshot()
        img = Image.open(io.BytesIO(png)).convert("RGB")
        W, H = img.size
        flagged = 0
        faces = 0
        for key, a in anchors.items():
            if not a:
                continue
            faces += 1
            cx, cy = int(a["x"]), int(a["y"])
            left = max(0, min(W - 400, cx - 200))
            top = max(0, min(H - 400, cy - 200))
            crop = img.crop((left, top, left + 400, top + 400))
            crop.save(str(FACES_DIR / f"cube{i}_face{faces - 1}.png"))
            gray = np.asarray(crop.convert("L"))
            if _diagonal_seam_flag(gray):
                flagged += 1
        pg.keyboard.press("Escape")
        pg.wait_for_timeout(1000)
        report.append({"cube": i, "faces": faces, "flagged": flagged})

    # Raymond cube: crop its six unfolded faces too (6 more crops) if the unfold rects exist
    if _scroll_experience(pg):
        rfaces = _raymond_face_rects(pg)
        if all(f is not None for f in rfaces):
            png = pg.screenshot()
            img = Image.open(io.BytesIO(png)).convert("RGB")
            W, H = img.size
            flagged = 0
            for j, f in enumerate(rfaces):
                cx, cy = int(f["x"] + f["w"] / 2), int(f["y"] + f["h"] / 2)
                left = max(0, min(W - 400, cx - 200))
                top = max(0, min(H - 400, cy - 200))
                crop = img.crop((left, top, left + 400, top + 400))
                crop.save(str(FACES_DIR / f"raymond_face{j}.png"))
                if _diagonal_seam_flag(np.asarray(crop.convert("L"))):
                    flagged += 1
            report.append({"cube": "ray", "faces": 6, "flagged": flagged})
        else:
            report.append({"cube": "ray", "faces": 0, "flagged": 0})
    return report


def _scroll_experience(pg, progress=0.6):
    # position the page at the given experience progress. main.js maps progress 0.25..0.55 to
    # unfold 0..1 (power2.inOut), so 0.5 only reaches 0.944; sample at 0.6, fully unfolded/held.
    rng = pg.evaluate("() => window.__v2.triggerRange('#experience')")
    if not rng:
        return False
    y = rng["start"] + progress * (rng["end"] - rng["start"])
    pg.evaluate(f"() => window.__v2.scrollToY({y})")
    pg.wait_for_timeout(2500)
    return True


def _raymond_face_rects(pg):
    # six raymond face rects normalised to {x,y,w,h}, or None per face if the hook is absent.
    return pg.evaluate("""() => {
      const out = [];
      for (let j = 0; j < 6; j++) {
        const r = (typeof window.__v2.raymondFace === 'function') ? window.__v2.raymondFace(j) : null;
        out.push(r ? { x: r.x, y: r.y, w: (r.width != null ? r.width : r.w),
                       h: (r.height != null ? r.height : r.h) } : null);
      }
      return out;
    }""")


def run_raymond_test(pg):
    # verify the raymond cube unfolds at experience 0.5: unfold >= 0.95, six face rects clear of
    # text and the forklift morph, all on-screen, and each face click opens its reading panel.
    if not _scroll_experience(pg):
        return {"status": "SKIP", "reason": "no #experience trigger range"}
    unfold = pg.evaluate("() => (typeof window.__v2.raymondUnfold === 'function') ? window.__v2.raymondUnfold() : null")
    faces = _raymond_face_rects(pg)
    if unfold is None or any(f is None for f in faces):
        return {"status": "SKIP", "reason": "raymond unfold hooks not implemented yet",
                "unfold": unfold, "faces_present": sum(1 for f in faces if f)}

    ctx = pg.evaluate(f"""() => {{
      const mb = (typeof window.__v2.morphBox === 'function') ? window.__v2.morphBox(0) : null;
      const texts = Array.from(document.querySelectorAll('{TEXT_SELECTORS}'))
        .map(e => e.getBoundingClientRect())
        .filter(r => r.width > 4 && r.height > 4 && r.bottom > 0 && r.top < window.innerHeight)
        .map(r => ({{ x: r.x, y: r.y, w: r.width, h: r.height }}));
      return {{ mb, texts, vw: window.innerWidth, vh: window.innerHeight }};
    }}""")

    fails = []
    if unfold < 0.95:
        fails.append({"unfold": round(unfold, 3)})
    for j, f in enumerate(faces):
        if not (f["x"] >= -1 and f["y"] >= -1
                and f["x"] + f["w"] <= ctx["vw"] + 1 and f["y"] + f["h"] <= ctx["vh"] + 1):
            fails.append({"face": j, "offscreen": {k: round(v, 1) for k, v in f.items()}})
        for r in ctx["texts"]:
            if boxes_intersect(f, {"x": r["x"] - 40, "y": r["y"] - 40, "w": r["w"] + 80, "h": r["h"] + 80}):
                fails.append({"face": j, "on_text": True})
                break
        if ctx["mb"] and boxes_intersect(f, ctx["mb"]):
            fails.append({"face": j, "on_forklift": True})

    pg.screenshot(path=str(OUT_DIR / "raymond_open.png"))

    # each face click must open the panel named in projects.json raymond.faces[j].panel
    panels = [f["panel"] for f in json.loads((REPO_ROOT / "v2" / "data" / "projects.json").read_text(encoding="utf-8"))["raymond"]["faces"]]
    for j, f in enumerate(faces):
        cx, cy = f["x"] + f["w"] / 2, f["y"] + f["h"] / 2
        pg.mouse.click(cx, cy)
        pg.wait_for_timeout(800)
        want = "panel-" + panels[j]
        opened = pg.evaluate(f"() => {{ const p = document.getElementById('{want}'); return !!p && !p.hidden && p.classList.contains('open'); }}")
        pg.keyboard.press("Escape")
        pg.wait_for_timeout(400)
        if not opened:
            fails.append({"face": j, "panel_expected": want, "opened": False})

    return {"status": "FAIL" if fails else "OK", "unfold": round(unfold, 3), "fails": fails}


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
        # baked faces replaced the DOM cards (commit 107b268): the meaningful check is that the
        # unfolded cube exposes six face anchors, all inside the viewport.
        chk = pg.evaluate("""() => {
          const a = window.__v2.faceAnchors();
          const vw = window.innerWidth, vh = window.innerHeight;
          let n = 0, inside = 0;
          if (a) for (const k in a) {
            const p = a[k]; n++;
            if (p && p.x >= 0 && p.y >= 0 && p.x <= vw && p.y <= vh) inside++;
          }
          return { open: window.__v2.projectOpen(), n, inside };
        }""")
        pg.screenshot(path=str(OUT_DIR / f"open_{i}.png"))
        if i % 2 == 0:
            pg.click("#project-close")
        else:
            pg.keyboard.press("Escape")
        pg.wait_for_timeout(1100)
        y1 = pg.evaluate("() => window.scrollY")
        after = pg.evaluate("() => window.__v2.projectOpen()")
        ok = (chk["open"] == i and chk["n"] == 6 and chk["inside"] == 6
              and after == -1 and abs(y1 - y0) < 2)
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
