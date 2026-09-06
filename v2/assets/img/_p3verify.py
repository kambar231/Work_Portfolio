from playwright.sync_api import sync_playwright
PANELS = ["polymer","casting","cnc","slicer",
  "ray-stability","ray-sensor","ray-weight","ray-steer","ray-interface","ray-frame",
  "borgwarner","bostonbeer","printing","pendulum","cannon","flight","saturn","cubesat","catbot"]
LINKS = ["https://kambar231.github.io/WebPort/terra-museum/","https://kambar231.github.io/WebPort/biavola/",
  "https://kambar231.github.io/WebPort/onda-day/","https://kambar231.github.io/WebPort/numera/"]
fails=0
with sync_playwright() as p:
    b=p.chromium.launch()
    pg=b.new_page(viewport={"width":1440,"height":900})
    pg.goto("http://localhost:8791/v2/",wait_until="load"); pg.wait_for_timeout(1200)
    for name in PANELS:
        pg.evaluate(f"()=>window.__v2panel.open('{name}')")
        pg.wait_for_timeout(220)
        vis=pg.evaluate(f"""()=>{{const p=document.getElementById('panel-{name}');if(!p)return false;const h=p.querySelector('h2').getBoundingClientRect();return p.classList.contains('open')&&h.top<innerHeight&&h.bottom>0;}}""")
        pg.evaluate(f"()=>document.querySelector('#panel-{name} .panel-scroll').scrollTo(0,300)")
        pg.wait_for_timeout(120)
        el=f"#panel-{name} .panel-scroll"
        sc=pg.evaluate(f"()=>document.querySelector('{el}').scrollTop")
        fits=pg.evaluate(f"()=>{{const s=document.querySelector('{el}');return s.scrollHeight<=s.clientHeight+5;}}")
        pg.keyboard.press("Escape"); pg.wait_for_timeout(240)
        closed=not pg.evaluate("()=>window.__v2panel.isOpen()")
        ok=vis and closed and (sc>=20 or fits)
        if not ok: fails+=1; print(f"panel {name}: vis={vis} sc={sc} closed={closed} FAIL")
    print(f"panels: {len(PANELS)-fails}/{len(PANELS)} pass")
    # website links: correct href + target _blank
    hrefs=pg.evaluate("()=>Array.from(document.querySelectorAll('.web-tile')).map(a=>({href:a.href,t:a.target}))")
    for want in LINKS:
        m=[h for h in hrefs if h['href']==want and h['t']=='_blank']
        if not m: fails+=1; print(f"link {want}: MISSING or not _blank")
    print(f"links: {len(LINKS)-sum(1 for w in LINKS if not [h for h in hrefs if h['href']==w and h['t']=='_blank'])}/{len(LINKS)} ok")
    b.close()
print("P3 PANEL/LINK RESULT:", "ALL PASS" if fails==0 else f"{fails} FAILURES")
