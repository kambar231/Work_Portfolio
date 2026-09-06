import os
from playwright.sync_api import sync_playwright
OUT="docs/v2-film/p3"; os.makedirs(OUT, exist_ok=True)
SHOTS=[("raymond",300),("raymond",1100),("experience",400),("others",500),("websites",300),("about",300),("about",1100),("contact",500)]
with sync_playwright() as p:
    b=p.chromium.launch()
    pg=b.new_page(viewport={"width":1440,"height":900}, device_scale_factor=1)
    pg.goto("http://localhost:8791/v2/", wait_until="load"); pg.wait_for_timeout(1200)
    H=pg.evaluate("()=>document.documentElement.scrollHeight")
    print("PAGE HEIGHT", H, "px  (", round(H/900,1), "viewports )")
    seen={}
    for sel,off in SHOTS:
        top=pg.evaluate(f"()=>document.querySelector('#{sel}').getBoundingClientRect().top+window.scrollY")
        pg.evaluate("(y)=>window.__v2.scrollToY(y)", top+off)
        pg.wait_for_timeout(800)
        seen[sel]=seen.get(sel,0)+1
        pg.screenshot(path=os.path.join(OUT,f"{sel}_{seen[sel]}.png"))
    print("shots written")
    b.close()
