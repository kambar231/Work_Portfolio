"""Time-lapse at fixed scroll positions to observe cube float + mouse response."""
import os
from playwright.sync_api import sync_playwright

OUT = r"C:\Users\kmangibayev\Code\Work_Portfolio\docs\nirnor-study\timelapse"
os.makedirs(OUT, exist_ok=True)

with sync_playwright() as p:
    b = p.chromium.launch()
    page = b.new_page(viewport={"width":1440,"height":900}, device_scale_factor=1)
    page.goto("https://nirnor.jp/", wait_until="networkidle", timeout=60000)
    page.wait_for_timeout(2000)

    spots = {"y0":0, "y900":900, "y2400":2400}
    for name, y in spots.items():
        page.evaluate(f"window.scrollTo(0,{y})")
        page.wait_for_timeout(800)
        # 6s @ 200ms = 30 frames, still mouse
        for i in range(30):
            page.screenshot(path=f"{OUT}/still_{name}_{i:02d}.png")
            page.wait_for_timeout(200)

    # mouse-move response at y=0: sweep cursor across viewport
    page.evaluate("window.scrollTo(0,0)"); page.wait_for_timeout(600)
    xs = [200,500,720,1000,1300,720]
    for i,x in enumerate(xs):
        page.mouse.move(x, 450, steps=10)
        page.wait_for_timeout(350)
        page.screenshot(path=f"{OUT}/mouse_{i:02d}_x{x}.png")

    print("done", len(os.listdir(OUT)), "frames")
    b.close()
