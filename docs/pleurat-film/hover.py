from playwright.sync_api import sync_playwright
import os
OUT='docs/pleurat-film/hover'; os.makedirs(OUT,exist_ok=True)
def clip(t,l=0,w=1440,h=140): return {'x':l,'y':t,'width':w,'height':h}
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={'width':1440,'height':900})
    pg.goto('https://www.pleurat.com/',wait_until='networkidle'); pg.wait_for_timeout(1500)
    # nav bar before/after hover on Work
    pg.screenshot(path=f'{OUT}/nav_rest.png', clip=clip(0))
    try:
        pg.hover('nav >> text=Work'); pg.wait_for_timeout(400)
        pg.screenshot(path=f'{OUT}/nav_hover_work.png', clip=clip(0))
    except Exception as e: print('work hover',e)
    # Contact CTA hover
    try:
        pg.hover('text=Contact'); pg.wait_for_timeout(400)
        pg.screenshot(path=f'{OUT}/cta_hover.png', clip=clip(0))
    except Exception as e: print('cta',e)
    # click the lights (theme) toggle -> dark mode
    try:
        pg.click('button.sv-lights'); pg.wait_for_timeout(800)
        pg.screenshot(path=f'{OUT}/darkmode_top.png', clip={'x':0,'y':0,'width':1440,'height':620})
        # dark full-page mosaic sample
        pg.evaluate("scrollTo({top:6700,behavior:'instant'})"); pg.wait_for_timeout(600)
        pg.screenshot(path=f'{OUT}/darkmode_mosaic.png', clip={'x':0,'y':0,'width':1440,'height':900})
        pg.evaluate("scrollTo({top:0,behavior:'instant'})"); pg.wait_for_timeout(300)
        pg.click('button.sv-lights'); pg.wait_for_timeout(400)  # back to light
    except Exception as e: print('dark',e)
    b.close(); print('hover done', os.listdir(OUT))
