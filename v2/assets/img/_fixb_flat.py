from playwright.sync_api import sync_playwright
SECTIONS = {
  "#experience": ".exp-text h3, .exp-text p",
  "#others": ".oth-col h3, .oth-col p, .rit-row h4, .rit-row p",
  "#websites": ".web-lead, .wt-name, .wt-desc",
  "#about": ".edu-col h3, .edu-col p",
}
def inter(a,b,pad=0):
    return not (a["x"]+a["w"]+pad<b["x"] or b["x"]+b["w"]+pad<a["x"] or a["y"]+a["h"]+pad<b["y"] or b["y"]+b["h"]+pad<a["y"])
fails=0
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={"width":1440,"height":900})
    pg.goto("http://localhost:8791/v2/",wait_until="load"); pg.wait_for_timeout(1200)
    H=pg.evaluate("()=>document.documentElement.scrollHeight")
    for sel,textsel in SECTIONS.items():
        top=pg.evaluate(f"()=>document.querySelector('{sel}').getBoundingClientRect().top+window.scrollY")
        bot=pg.evaluate(f"()=>{{const r=document.querySelector('{sel}').getBoundingClientRect();return r.height;}}")
        bad=0
        for k in range(8):
            y=top - 300 + (bot+600)*k/7
            pg.evaluate("(y)=>window.__v2.scrollToY(y)", max(0,min(H-900,y))); pg.wait_for_timeout(260)
            cubes=pg.evaluate("()=>window.__v2.allCubes()")
            texts=pg.evaluate(f"""()=>Array.from(document.querySelectorAll('{textsel}')).map(e=>{{const r=e.getBoundingClientRect();return {{x:r.x,y:r.y,w:r.width,h:r.height,vis:r.bottom>0&&r.top<innerHeight&&r.width>0}};}}).filter(t=>t.vis)""")
            for c in cubes:
                if c["op"]>0.36:
                    for t in texts:
                        if inter(c["box"],t,40): bad+=1; break
        print(f"{sel}: {'PASS' if bad==0 else 'FAIL ('+str(bad)+' overlaps)'}")
        if bad: fails+=1
    b.close()
print("FIX B FLAT:", "ALL PASS" if fails==0 else f"{fails} FAILURES")
