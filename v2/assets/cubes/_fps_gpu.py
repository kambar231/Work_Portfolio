import sys
from playwright.sync_api import sync_playwright
URL=sys.argv[1]
logs=[]
with sync_playwright() as p:
    b=p.chromium.launch(headless=False, args=["--ignore-gpu-blocklist","--use-angle=d3d11"])
    pg=b.new_page(viewport={"width":1440,"height":900}, device_scale_factor=1)
    gpu=pg.evaluate("""()=>{const c=document.createElement('canvas');const gl=c.getContext('webgl2');const d=gl.getExtension('WEBGL_debug_renderer_info');return d?gl.getParameter(d.UNMASKED_RENDERER_WEBGL):'?';}""")
    pg.on("console", lambda m: logs.append(m.text))
    pg.goto(URL, wait_until="load")
    fps=pg.evaluate("""()=>new Promise(res=>{let n=0,s=performance.now();function f(t){n++;if(t-s>=4000)res((n*1000)/(t-s));else requestAnimationFrame(f);}requestAnimationFrame(f);})""")
    print("GPU:",gpu[:46]); print("injected rAF fps over 4s:",round(fps,1))
    for l in logs:
        if "measured fps" in l: print("page:",l)
    b.close()
