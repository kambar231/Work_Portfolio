from playwright.sync_api import sync_playwright
import sys
def inter(a,b):
    return not (a["x"]+a["w"]<b["x"] or b["x"]+b["w"]<a["x"] or a["y"]+a["h"]<b["y"] or b["y"]+b["h"]<a["y"])
def rect(pg,sel):
    return pg.evaluate(f"""()=>{{const e=document.querySelector('{sel}');if(!e)return null;const r=e.getBoundingClientRect();return {{x:r.x,y:r.y,w:r.width,h:r.height,vis:r.width>0&&r.bottom>0&&r.top<innerHeight}};}}""")
fails=0
with sync_playwright() as p:
    b=p.chromium.launch()
    for W,H in [(360,800),(390,844),(768,1024)]:
        pg=b.new_page(viewport={"width":W,"height":H})
        pg.goto("http://localhost:8791/v2/",wait_until="load"); pg.wait_for_timeout(1500)
        # hero: grid vs headline/subline/cue
        pg.evaluate("()=>window.__v2.scrollToY(0)"); pg.wait_for_timeout(400)
        cubes=pg.evaluate("()=>window.__v2.cubeBoxes()")
        bad=[]
        for name in [".display",".hero-sub",".scroll-cue"]:
            t=rect(pg,name)
            if t and t["vis"]:
                for i,c in enumerate(cubes):
                    if inter(c,t): bad.append((name,i))
        print(f"[{W}] hero grid vs text: {'PASS' if not bad else 'FAIL '+str(bad[:4])}")
        if bad: fails+=1
        # contact: grid vs contact text
        top=pg.evaluate("()=>document.querySelector('#contact').getBoundingClientRect().top+window.scrollY")
        pg.evaluate("(y)=>window.__v2.scrollToY(y)", top+60); pg.wait_for_timeout(500)
        cubes=pg.evaluate("()=>window.__v2.cubeBoxes()")
        badc=[]
        for name in [".flat-head",".contact-list",".contact-pill"]:
            t=rect(pg,name)
            if t and t["vis"]:
                for i,c in enumerate(cubes):
                    if inter(c,t): badc.append((name,i))
        print(f"[{W}] contact grid vs text: {'PASS' if not badc else 'FAIL '+str(badc[:4])}")
        if badc: fails+=1
        pg.close()
    b.close()
print("MOBILE LAYOUT:", "ALL PASS" if fails==0 else f"{fails} FAILURES")
sys.exit(1 if fails else 0)
