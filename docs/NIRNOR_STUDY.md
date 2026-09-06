# nirnor.jp — teardown for a portfolio rebuild

Study of https://nirnor.jp/ (nirnor inc. / 株式会社ニアノア, a Tokyo art-direction +
design + engineering studio). Captured 2026-09-05 at 1440×900. This is a reference
document only; no site files were changed.

**One-line verdict:** a React + Vite single page, near-white throughout, with two
WebGL layers — a continuously-animating **strange-attractor particle field** painted
across the whole background, and **photo-textured 3D cubes** that act as the project
tiles. Smooth-scrolled with Lenis. Everything else is Tailwind v4 + Google Fonts with
a signature per-character "flicker/blink" text reveal.

Frames referenced below live under
`docs/nirnor-study/film/run_20260905_215301/` and `docs/nirnor-study/timelapse/`
(git-ignored). Bundles saved under `docs/nirnor-study/bundles/`.

---

## 1. Site map

Single long page, **~13,365 px tall** at 1440 wide. Fixed top-right text nav
(`WORKS / ABOUT US / CONTACT`) over a fixed full-viewport background canvas. Layout is
Tailwind, content column max-width **1248 px**, section gaps set with fluid
`mt-[min(<px>, <vw>vw)]` margins.

The headline is the line Kambar liked. Exact copy, in both languages:

- JP: `より、整った世界を` / `より、心に触れるデザインを`
- EN: `A more organised world.` / `More design that touches your heart.`

| # | Section | Approx. scroll range (px) | One line |
|---|---------|---------------------------|----------|
| 0 | Fixed nav | pinned, top | `WORKS / ABOUT US / CONTACT`, thin Roboto, top-right; logo `nirnor` top-left |
| 1 | Hero | 0 – ~700 | Big `nirnor` serif wordmark (the `o` is a filled dot), JP+EN strapline lower-left, address block center, `SCROLL ↓` bottom-right |
| 2 | WORKS intro | ~700 – ~2,000 | `WORKS` heading, category list (Art Direction / Graphic Design / Logo Design / Digital Content), one large tumbling photo-cube top-right |
| 3 | Works showcase | ~2,000 – ~5,700 | `art direction` lowercase heading, more cubes tumbling in, `VIEW ALL WORKS 45` with a circular arrow button |
| 4 | ABOUT US | ~5,700 – ~9,500 | `ABOUT US`, mission copy, photo tiles with JP calligraphy, numbered service list `01–05` (PHOTOGRAPH, WEB DESIGN, WEB DEVELOPMENT, GRAPHIC DESIGN, MOVIE DIRECTION) |
| 5 | (bridge) | ~9,500 – ~10,600 | spacer band where the particle field thickens into dense attractor ribbons |
| 6 | Member | ~10,600 – ~11,700 | Role → name rows: Technical Director / NAITO Koji, Front-end Engineer / OKAZAKI Shohei, Art Director, Designer / HASEGAWA Octo, Designer / … |
| 7 | Company | ~11,700 – ~12,600 | `Company` info table |
| 8 | Topics | ~12,600 – ~12,900 | `Topics`, e.g. `2025.10.01 サイトをリニューアル致しました。` |
| 9 | Contact / footer | ~12,900 – 13,365 | Full-width dark `#1a1a1a` `Contact Us →` block, then footer nav + `X / Instagram / Facebook` + `©nirnor.inc` |

Ranges are read off the scroll-film frames (`film_..._NNN_yYYYY.png`, the `y` in each
filename is the scroll offset); the fluid `mt` margins make exact boundaries device-
dependent.

Representative frames:
`..._000_y0.png` (hero), `..._001_y531.png` (first cube enters), `..._002_y1062.png`
(WORKS + big cube), `..._004_y2125.png` (art-direction reveal), `..._010_y5312.png`
(VIEW ALL WORKS + cubes), `..._017_y9030.png` (services + dense field + photo tile),
`..._021_y11154.png` (Member + attractor ribbons), `..._025_y13279.png` (Topics +
Contact + footer). Cube tumble: `timelapse/still_y900_00.png` → `..._29.png`.

---

## 2. The two WebGL scenes (in full detail)

**Mechanism: Three.js r163, WebGL2, code-split into `assets/WebGL-DCLktg0A.js`.**
Not CSS 3D. Detection evidence (`docs/nirnor-study/probe.json`):

- Two `<canvas>` elements, both return a `webgl2` context.
- `window.__THREE__` is set (Three's multiple-instance guard); `window.lenis` and
  `window.lenisVersion` are set (Lenis smooth scroll). No `gsap`/`ScrollTrigger`
  global — scroll animation is hand-rolled off Lenis + `requestAnimationFrame`.
- Bundle is minified Three r163 plus the app scene. `PerspectiveCamera` is created
  as `new It(90,1,t,n)` → **fov 90**, aspect 1, near/far runtime. The app uses
  `BoxGeometry` (×1, reused), `PlaneGeometry` (×1), `Points` / `PointsMaterial`
  (×several) with `BufferGeometry` + `Float32Array` position buffers, and
  `sizeAttenuation`. Lit materials in play are the MeshStandard/Physical family
  (roughness + metalness uniforms present).

There are **two distinct canvases doing two different things.**

### 2a. Background particle field (the signature)

- Canvas parent: `fixed top-0 left-0 right-0 bottom-0 z-[-9999]` — a full-viewport
  layer *behind all content*, present the entire page.
- It is a **THREE.Points cloud** (built-in `PointsMaterial`, tiny `sizeAttenuation`
  dots) whose vertex positions are stepped every frame by a **strange-attractor /
  curl-flow iteration** (heavy `sin`/`cos` use in the bundle; positions written into a
  `Float32Array`). Visually: thousands of 1-px light-gray dots that trace smoke-like
  ribbon streaks and looping lobes — a De Jong / Clifford-attractor look.
- **Color:** dots are near-white grays — `#eaeaea` / `#d9d9d9` on the white body,
  reading as a faint pencil-smudge. Over the dark `#1a1a1a` Contact block the same
  dots read as pale specks (a starfield).
- **Density evolves down the page.** Near the hero it is a whisper (a few faint
  curves); by Member/Topics it is a dense, many-looped ribbon structure filling the
  viewport (compare `..._000_y0.png` vs `..._021_y11154.png`). The attractor keeps
  integrating as you scroll, so lower sections show the accumulated, busier state —
  scroll drives *how far the system has evolved*, not a discrete rearrangement.
- **It never stops.** At a *fixed* scroll position the field still changes every
  frame: frame-to-frame pixel delta is ~13% at 0.2 s and creeps up continuously
  (`docs/nirnor-study/timelapse` diff). This is time-driven `requestAnimationFrame`
  motion, not scroll-triggered.
- **Cursor response is minimal.** Sweeping the pointer full-width barely alters the
  render (all mouse frames differ from the first by a near-constant ~10.6%, which is
  just the field's own animation between shots). Any pointer influence is a subtle
  drift at most, not a parallax the eye tracks.
- No fog, no depth-of-field. It is flat additive-ish points on a solid background.

### 2b. Project cubes (the tiles)

- Canvas parent: `absolute inset-0 overflow-hidden` inside the works area (~1440×941).
- **The cubes ARE the project tiles.** Each cube is a `BoxGeometry` with a project's
  **photograph textured onto its faces**; it **tumbles continuously** in 3D (a slow
  free rotation on multiple axes) while drifting/floating in the column. See the big
  cube in `..._002_y1062.png` (a photo of a styled interior wraps the faces) and a
  different textured cube in `..._010_y5312.png`.
- **Count / arrangement:** not a fixed grid. One hero cube dominates the WORKS intro
  top-right; additional smaller cubes tumble in lower (thumbnail-scale), scattered
  down the works column rather than snapped to a grid. The `VIEW ALL WORKS 45` label
  implies 45 works total behind a "view all" route; only a handful are shown as cubes
  on the home page.
- **Material / lighting:** soft, matte, evenly lit — no hard specular hotspots, no
  visible outlines, faint soft edge shadow. Consistent with a MeshStandard/Physical
  material at high roughness under an ambient + one soft directional light. Faces are
  the photo texture; the cube reads as a floating photographic block.
- **Motion:** continuous auto-rotation (the tumble accumulates — fixed-scroll pixel
  delta at the cube climbs from ~14% to ~21% over 6 s, i.e. it keeps turning). The
  float is a slow positional bob layered on the spin. No snap between arrangements;
  cubes simply enter, tumble, and leave as you scroll past.
- **Relation to content:** the cube is the work's presentation object — photography is
  literally mapped onto a rotating solid, tying the studio's "photography → object"
  craft to the 3D. Clicking through (`VIEW ALL WORKS`) is the escape to a full list.

**Extracted parameters (from `bundles/WebGL-DCLktg0A.js`):** Three r163; camera
`PerspectiveCamera(fov 90, aspect 1)`; geometry `BoxGeometry` + `PlaneGeometry`;
`THREE.Points` + `PointsMaterial` with `sizeAttenuation` over `Float32Array` buffers;
MeshStandard/Physical (roughness/metalness) materials. Numeric attractor constants and
particle count are computed at runtime (no literal count survives minification), so
those are tuned by eye in a rebuild, not copied.

---

## 3. Typography & palette

**Fonts — all from one Google Fonts request** (found in
`assets/styles-F2pie9rR.css`):

```
https://fonts.googleapis.com/css2?family=Ibarra+Real+Nova:ital,wght@0,400..700;1,400..700
  &family=Roboto:ital,wght@0,100..900;1,100..900
  &family=Shippori+Mincho
  &family=Zen+Kaku+Gothic+New&display=swap
```

Exposed as CSS variables (Tailwind v4 `@theme`):

| Variable | Family | Role |
|----------|--------|------|
| `--font-ibarra` | Ibarra Real Nova, serif | `nirnor` wordmark + serif display (`WORKS`, `VIEW ALL WORKS`) |
| `--font-roboto` | Roboto (100–900) | Latin nav, labels, service list, big bold display |
| `--font-zen` | Zen Kaku Gothic New, sans | JP strapline / JP body (`より、整った世界を`) |
| `--font-shippori` | Shippori Mincho, serif | JP serif accents |
| `--font-sans` | `ui-sans-serif` system stack | Tailwind default fallback |

**Type scale is fluid**, built from Tailwind arbitrary values
`text-[min(<px>,<vw>vw)]` — every size is `min(desktop-px, mobile-vw)`, so it caps at a
fixed desktop size and shrinks on narrow screens. Observed rungs (px cap → vw):

```
150px/10.417vw   giant display (hero wordmark / VIEW ALL WORKS)
48px/12.8vw      section display
40px/10.667vw · 35px/9.333vw · 28px/7.467vw   headings (H2 measured ≈34px)
24px/1.667vw · 22px · 20px · 18px    sub-heads
16px/1.111vw (body) · 14 · 13 · 12 · 11 · 10 · 7   labels / captions
```

Weights: display in Roboto Black/Bold or Ibarra 400–700; labels in Roboto ~300–400.
Letter-spacing: `.2em` on the small tracked-out caps labels (nav, `SCROLL`), `.02em`
on body, `-.02em` tight on the largest display. Line-height 1.5–2em for JP text
blocks, `1` for big Latin display.

**Palette (sampled, with usage weight):**

| Hex | Role |
|-----|------|
| `#ffffff` | page background (dominant) |
| `#1a1a1a` (rgb 26,26,26) | primary text + dark Contact block; the real "black" |
| `#000000` | token black (rare, borders) |
| `#7e7e7e` | secondary/label gray |
| `#3c3c3c` | mid text |
| `#eaeaea` | hairline dividers + particle dots |
| `#d9d9d9` | lighter particle dots |

**Why it reads elegant and easy:** one near-white ground, one near-black ink, grays
only for hierarchy; generous fluid whitespace (huge `mt` gaps between sections); a
serif wordmark against clean sans body; and all the "busy" energy pushed into the
faint background layer so the text column stays calm and high-contrast.

---

## 4. Every other animation / transition

Extracted `@keyframes` + motion table are in `docs/nirnor-study/spec.json`.

**a) Per-character "flicker/blink" text reveal — the signature.** Headings and labels
are split into per-character `<span class="blink opacity-0">` (and `<img class="blink">`
for image reveals). Each runs `@keyframes blink` once, staggered per character:

```css
@keyframes blink {            /* 0.3s, ease, 1 iteration */
  0%  { opacity: 0;   } 10% { opacity: .5; } 20% { opacity: .2; }
  30% { opacity: .7;  } 40% { opacity: 0;  } 100% { opacity: 1; }
}   /* steps 0–30% use step-end timing → hard flicker, then settle to 1 */
```

Trigger: on scroll-into-view. Effect: letters strobe in like a signal locking on —
visible in `..._002_y1062.png` (`WORK` solid, `S` mid-flicker) and `..._004_y2125.png`
(`art di ection` with letters at mixed opacity). **Recipe:** wrap each glyph in a span,
`opacity:0`, on IntersectionObserver add a class that plays the blink keyframe with
`animation-delay: i * ~30–50ms`.

**b) Underline / hairline grow.** `span.h-[1px]` / `span.absolute.h-px` dividers
animate `transition: all .3s ease` — width/opacity grows in under links and section
rules (the `VIEW ALL WORKS` rule, list separators). **Recipe:** `transform: scaleX(0)
→ 1`, `transform-origin:left`, `.3s ease`, fired on reveal/hover.

**c) Slide/fade utility keyframes** present for menu/route bits:
`slide-in (translateX 100%→0)`, `slide-out (→ -100%)`, `fade-in`, `fade-out`, and a
`slide-flash` (translateY -150%→0 with an opacity stutter 1↔.2↔1) — a flash-drop used
for small badges/notices. All ~0.3s.

**d) Smooth scroll (Lenis).** Whole-page inertial scrolling via `lenis-react`; the
background attractor and cube tumble read the eased scroll value, which is why motion
feels weighted and continuous rather than 1:1 with the wheel. **Recipe:** Lenis with a
gentle `lerp` (~0.08–0.1).

**e) Nav / hover.** Nav is plain text with a `.3s ease` color/opacity transition on
hover (no big motion). Circular arrow button on `VIEW ALL WORKS` and `Contact Us →`
uses a small arrow; hover is a subtle scale/opacity. (Capture returned no dramatic
hover-state diffs — hovers are understated.)

**f) Continuous WebGL** (section 2): background field animates every frame; cubes
auto-rotate + bob every frame. Both independent of scroll timing.

---

## 5. Replication plan — Three.js + GSAP ScrollTrigger + Lenis, no build step

Target feel: calm near-white page, one faint living attractor field behind everything,
a few photo-cubes as project tiles, flicker-in text, inertial scroll. All loadable from
CDN (`three` UMD, `gsap` + `ScrollTrigger`, `lenis`) — no bundler.

**Cheap / high-payoff (do first):**
1. **Lenis smooth scroll** — CDN, `new Lenis({lerp:0.09})`, RAF loop. Instant "feel".
2. **Flicker text reveal** — pure CSS. Split headings to per-char spans, port the
   `blink` keyframe verbatim, stagger `animation-delay` via nth-child or a tiny JS
   loop, fire with ScrollTrigger/IntersectionObserver. This is 60% of the identity.
3. **Type + palette** — load the same four Google fonts; set the fluid
   `min(px, vw)` scale as CSS custom properties; white ground, `#1a1a1a` ink,
   `#7e7e7e`/`#eaeaea` grays. Copies the "elegant, readable" baseline exactly.
4. **Layout** — 1248px column, big `min(px,vw)` section gaps, fixed top-right nav,
   dark `#1a1a1a` Contact block. Static, no WebGL needed.

**Medium:**
5. **Photo-cubes** — `BoxGeometry` + a `MeshStandardMaterial` (roughness ~0.8) per
   face texture (project photo), one soft `DirectionalLight` + `AmbientLight`,
   `PerspectiveCamera(fov 90)`. Auto-rotate each cube (`rotation.x/y += small`) plus a
   `sin(t)` positional bob. Position/scale each cube down the works column; drive
   entrance/parallax off ScrollTrigger. Straightforward Three.

**Hard / tune-by-eye (the differentiator):**
6. **Strange-attractor particle field.** One full-viewport fixed `THREE.Points` cloud,
   `PointsMaterial` (size ~1–2, `sizeAttenuation`, color `#e6e6e6`, slight
   transparency), a few ×10⁴–10⁵ points in a `Float32Array`. Each frame, iterate a
   Clifford/De Jong attractor (`x' = sin(a·y) + c·cos(a·x)`, etc.) to nudge positions
   so the cloud traces evolving ribbons; map the eased Lenis scroll to the attractor
   parameters or point-count so the field visibly densifies toward the footer. Keep it
   near-white and low-opacity so text stays readable. Exact constants and count aren't
   recoverable from the minified bundle — tune visually against the reference frames.
   Optional cheaper stand-in: a single fragment-shader curl-noise field on a fullscreen
   plane, animated by `uTime` + `uScroll`.

**Minimal parameter set to reproduce the feel:**
`fov 90` · white bg `#fff`, ink `#1a1a1a`, particle `#e6e6e6` · cube material
roughness ~0.8, one soft directional + ambient light, auto-rotate ≈0.2–0.4 rad/s +
`sin` bob · flicker reveal `0.3s ease`, per-char stagger ~30–50 ms · Lenis `lerp 0.09`
· fonts Ibarra Real Nova + Roboto + Zen Kaku Gothic New + Shippori Mincho · fluid type
`min(px, vw)` capped at desktop px.

**What is genuinely nirnor-specific and hardest to match:** the attractor field's exact
evolution (its constants and how it thickens with scroll) and the decision to make
photography *the texture on a tumbling solid*. Nail the flicker text, the fonts/palette,
the whitespace, and a "good enough" attractor, and the rebuild will read as the same
family while staying entirely original in content.
