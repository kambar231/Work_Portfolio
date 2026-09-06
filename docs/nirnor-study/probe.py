"""Probe nirnor.jp: script URLs, WebGL/canvas detection, globals, DOM of hero."""
import json, sys
from playwright.sync_api import sync_playwright

OUT = "docs/nirnor-study"
scripts = []

with sync_playwright() as p:
    b = p.chromium.launch()
    page = b.new_page(viewport={"width":1440,"height":900})
    page.on("response", lambda r: scripts.append(r.url) if r.url.endswith(".js") or ".js?" in r.url else None)
    page.goto("https://nirnor.jp/", wait_until="networkidle", timeout=60000)
    page.wait_for_timeout(2500)

    info = page.evaluate(r"""() => {
      const out = {};
      // canvases
      out.canvases = [...document.querySelectorAll('canvas')].map(c => ({
        w: c.width, h: c.height,
        cssw: c.clientWidth, cssh: c.clientHeight,
        cls: c.className, id: c.id,
        parent: c.parentElement ? c.parentElement.className : null,
        style: c.getAttribute('style')
      }));
      // WebGL context test
      out.webglContexts = [];
      for (const c of document.querySelectorAll('canvas')) {
        let ctx=null, type=null;
        for (const t of ['webgl2','webgl','experimental-webgl']) {
          try { ctx = c.getContext(t); } catch(e){}
          if (ctx) { type=t; break; }
        }
        out.webglContexts.push(type);
      }
      // globals of interest
      const g = window;
      out.globals = {};
      for (const k of ['THREE','PIXI','Matter','OGL','regl','p5','BABYLON','gsap','ScrollTrigger','Lenis','lenis','__THREE__']) {
        out.globals[k] = (typeof g[k] !== 'undefined');
      }
      // any global whose name mentions three/gl/render
      out.suspectGlobals = Object.keys(g).filter(k => /three|webgl|render|scene|lenis|gsap|scroll/i.test(k)).slice(0,40);
      // three version if present
      try { out.threeRevision = g.THREE ? g.THREE.REVISION : null; } catch(e){ out.threeRevision=null; }
      return out;
    }""")

    # full HTML
    html = page.content()
    open(OUT+"/page.html","w",encoding="utf-8").write(html)

    info["scriptUrls"] = sorted(set([s for s in scripts]))
    open(OUT+"/probe.json","w",encoding="utf-8").write(json.dumps(info, indent=1, ensure_ascii=False))
    print(json.dumps(info, indent=1, ensure_ascii=False))
    b.close()
