"""Render the Raymond forklift SVG (from root index.html) to a 512x512 PNG on white.
Run from repo root: python v2/assets/cubes/_gen_forklift.py
"""
import os
from playwright.sync_api import sync_playwright

OUT = os.path.join(os.path.dirname(__file__), "raymond-forklift.png")

SVG = '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 380 440" fill="none" stroke="#15607a" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" width="380" height="440">
  <g><line x1="198" y1="96" x2="338" y2="96"/><line x1="206" y1="96" x2="206" y2="300"/><line x1="238" y1="96" x2="238" y2="120"/><line x1="304" y1="96" x2="304" y2="120"/></g>
  <g><line x1="332" y1="110" x2="332" y2="300"/><rect x="314" y="206" width="20" height="12" rx="2"/><circle cx="252" cy="248" r="14"/><line x1="252" y1="262" x2="252" y2="300"/></g>
  <rect x="190" y="300" width="150" height="76" rx="10"/><line x1="205" y1="336" x2="325" y2="336"/><path d="M188,314 L168,300 M188,300 L168,318"/>
  <g><circle cx="300" cy="392" r="36"/><circle cx="300" cy="392" r="13"/><line x1="264" y1="392" x2="336" y2="392" stroke-width="2.5"/><line x1="300" y1="356" x2="300" y2="428" stroke-width="2.5"/></g>
  <g><circle cx="150" cy="398" r="17"/><circle cx="150" cy="398" r="6"/><line x1="133" y1="398" x2="167" y2="398" stroke-width="2"/><line x1="150" y1="381" x2="150" y2="415" stroke-width="2"/></g>
  <g><line x1="150" y1="110" x2="150" y2="362"/><line x1="168" y1="110" x2="168" y2="362"/><line x1="150" y1="150" x2="168" y2="150"/><line x1="150" y1="250" x2="168" y2="250"/><circle cx="159" cy="110" r="6"/><rect x="146" y="300" width="26" height="30" rx="3"/></g>
  <g><line x1="150" y1="330" x2="150" y2="384"/><line x1="150" y1="384" x2="64" y2="384"/><line x1="64" y1="384" x2="58" y2="377"/><line x1="150" y1="376" x2="72" y2="376"/></g>
  <g><rect x="134" y="76" width="36" height="22" rx="3"/><circle cx="144" cy="87" r="4"/><circle cx="160" cy="87" r="4"/></g>
</svg>'''

HTML = f'''<!doctype html><html><head><meta charset="utf-8"><style>
html,body{{margin:0}} .box{{width:512px;height:512px;background:#ffffff;display:flex;align-items:center;justify-content:center}}
.box svg{{width:400px;height:463px}}</style></head>
<body><div class="box">{SVG}</div></body></html>'''

with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={"width": 512, "height": 512}, device_scale_factor=1)
    pg.set_content(HTML)
    pg.wait_for_timeout(150)
    pg.locator(".box").screenshot(path=OUT)
    b.close()
print("wrote", OUT)
