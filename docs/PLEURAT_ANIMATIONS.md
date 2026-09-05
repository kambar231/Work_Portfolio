# pleurat.com — Animation Study

Study of the motion and interaction design on <https://www.pleurat.com/> (portfolio of
Pleurat Shala, product designer). Goal: catalog every animation so Kambar can pick ones to
replicate in his own portfolio.

Captured 2026-09-05. Frames live under `docs/pleurat-film/` (git-ignored). Filenames encode
the scroll offset, e.g. `film_..._054_y6729.png` = frame 54, scrollY 6729.

## Mechanism (how the site is built)

- **Stack:** React app built with Vite (single hashed bundle `assets/index-DwCqBxFL.js`,
  ~88 KB). No animation library. No GSAP, no Lenis/Locomotive, no Framer Motion, no Three.js.
  All motion is hand-authored CSS plus a little JavaScript.
- **Fonts:** General Sans (Fontshare, weights 400-700) for everything; IBM Plex Mono for the
  small mono labels (`READY`, `1440 · 12 COL`, section tags).
- **Palette:** near-black ink `rgb(22,20,14)`, warm cream paper `rgb(251,247,230)`, amber accent
  `rgb(243,180,74)` with a darker amber `rgb(199,126,10)`, muted taupes for secondary text.
- **Reveal engine:** a single `IntersectionObserver` (one `observe(` call in the bundle) adds an
  `is-in` class to `.sv-rv` elements when they enter the viewport; CSS transitions do the rest
  (`opacity` + `translateY`, ~0.8s, `cubic-bezier(0.2,0.8,0.2,1)`). This is the workhorse for
  every "fades up on scroll" block.
- **Character / illustration motion:** pure CSS `@keyframes` (28 of them, all prefixed `sv-`),
  driving SVG limb rotations. These are time-based loops, not scroll-based.
- **Progress-driven fills:** a `requestAnimationFrame` loop advances a `--p` custom property
  from 0→100 (`el.style.setProperty("--p", pct.toFixed(2))`) and CSS reads `var(--p)` to size
  bars / rotate the dial. It auto-advances once the section is in view (`pct + 7` per frame).
- **Reduced motion:** the code checks `matchMedia('prefers-reduced-motion')`, so animations are
  gated for accessibility.
- **Theme:** a "lights" toggle button (`button.sv-lights`) flips a light "day" and dark "night"
  rendering; dark is the coded default for first-time visitors (inline script sets
  `data-theme="dark"` unless `localStorage['theme-pref']==='light'`). In the night look the
  street lamps and building windows glow amber.

Total page height 9498 px, scrollable range 8598 px. Filmed at 1440x900: 70 frames over the
full page (step ~123 px), plus a 44-frame fine pass over the pinned chart section and two
time-lapses (hero, chart).

## Sections, top to bottom

| # | Section (class/id) | y-range | One line |
|---|---|---|---|
| 1 | `nav.sv-nav` | sticky, 0-67 | Wordmark, section links with active dot, day/night toggle, amber Contact button. |
| 2 | `header.sv-hero` #top | 0-558 | Headline + an animated line-art city street a walking figure tours. |
| 3 | `section#contact .sv-outro` | 558-1444 | Large browser/app mockup mounted below the hero (design-tool + code UI). |
| 4 | `section#focus` | 1444-2090 | "Primarily focused on" — isometric illustration carousel. |
| 5 | `section.sv-chart-sec` | 2090-4475 | "Ten years, by the numbers." — **pinned** animated bar chart with count-up. |
| 6 | `section#tools` | 4475-5061 | "AI is part of how I design & build, every day." — text reveal. |
| 7 | `section#profile` | 5060-5959 | "Where I've worked" — ruled reveal block. |
| 8 | `.sv-mosaic-track` | 5959-8839 | Scroll-driven project mosaic; centered tile is highlighted. |
| 9 | `footer.sv-footer` | 8839-9498 | City skyline repeats, "Express yourself" CTA, link columns. |

## Animations

### 1. "Welcome." intro word reveal
- **Where / trigger:** page load, hero center, before the site settles.
- **What moves:** the word "Welcome." paints in left-to-right — first letter bold ink, the rest
  fading from grey to ink, with an amber period dot popping last.
- **Timing / mechanism:** CSS `@keyframes` (`sv-cue` / `sv-hi` family) on per-letter spans,
  opacity + color, sub-second. Time-based, fires once on load.
- **Frames:** `hero/hero_00.png`.
- **Replicate:** wrap each letter in a `<span>`, animate `opacity` and `color` with a staggered
  `animation-delay` (nth-child or inline `--i`). One `@keyframes fade{from{opacity:.15}to{opacity:1}}`.
  **Difficulty: easy.**

### 2. Curtain / column wipe reveal (page enter)
- **Where / trigger:** load, full viewport, immediately after the intro word.
- **What moves:** vertical columns (`div.sv-curtain-col`) slide away to uncover the hero; column
  labels (`.sv-curtain-label`) fade out.
- **Timing:** `transform 0.48s cubic-bezier(0.72,0,0.22,1)`, columns staggered; labels `opacity 0.3s`.
- **Frames:** `hero/hero_05.png` (left third still curtained) → `hero/hero_11.png` (fully open).
- **Replicate:** a row of absolutely-positioned full-height divs; on load add a class that sets
  `transform: translateY(-100%)` (or scaleY→0) with staggered `transition-delay`. **Difficulty: easy-medium.**

### 3. Walking-figure street tour (signature piece)
- **Where / trigger:** hero, the line-art skyline strip (`.sv-street`, y 428-558); plays on load
  and loops. This is the standout animation.
- **What moves:** a little backpacked character walks along an illustrated street of buildings,
  lamps, trees, benches, bikes, cars and a hot-air balloon. Legs/arms/torso are individually
  rotated SVG groups. As the walker passes a building it lights up and the project label above
  cycles ("WORKSPACE" → "03 Sena — AI-based SaaS app" → "04 Toyota — Brand & Interface"). A small
  speech/`say` bubble animates in. In night mode the lamps and windows glow amber.
- **Properties:** many `transform: rotate()` keyframes — `sv-walk-thigh`, `sv-walk-knee`,
  `sv-walk-foot`, `sv-walk-shoulder`, `sv-walk-bob`, `sv-walk-rise`, `sv-walk-carry`; building
  illumination via `g.bl`/`g.lit` `opacity 0.5-0.6s`; label via `sv-street-say`
  (`opacity`+`translateY`, 0.5s).
- **Frames:** `hero/hero_05.png`, `hero/hero_11.png`, `hover/darkmode_top.png` (night version).
- **Replicate:** hard. It is a rigged SVG character with a walk cycle plus scene state (which
  building is "active"). Doable with inline SVG + CSS keyframes on each limb group and a JS timer
  that advances the active building/label, but it is a real illustration + rigging job.
  **Difficulty: hard.**

### 4. Hero copy + mockup reveal
- **Where / trigger:** hero right column and the mockup below, on load / scroll into view.
- **What moves:** headline second line and the "10+ years…" paragraph + buttons fade-and-rise
  (`.sv-rv.is-in.sv-hero-right`, `opacity`+`transform` 0.8s); the browser mockup (`.sv-street`
  block / outro) mounts under them.
- **Timing:** `opacity 0.8s, transform 0.8s`, `ease` / `cubic-bezier(0.2,0.8,0.2,1)`.
- **Frames:** `hero/hero_11.png`, `run_20260905_122442/film_..._000_y0.png`.
- **Replicate:** the standard IntersectionObserver `.is-in` reveal (see Mechanism). **Difficulty: easy.**

### 5. Isometric focus carousel ("Primarily focused on")
- **Where / trigger:** `#focus`, y 1444-2090, reveal on scroll; arrows advance it.
- **What moves:** a 3D isometric artboard (dotted grid plate labeled `1440 · 12 COL`, `U1`, `ART`)
  with an extruded block that builds/drops in; prev/next arrows swap between focus areas
  ("Product Design" etc.), each with its own isometric illustration.
- **Properties:** `@keyframes sv-art-in`, `sv-build`, `sv-drop`, `sv-tok`, `sv-lift` — transform +
  opacity on stacked SVG faces; arrow buttons transition `background`/`transform`.
- **Frames:** `run_20260905_122442/film_..._013_y1620.png`.
- **Replicate:** medium. Isometric look is a CSS `transform: rotateX/rotateZ` or a pre-drawn SVG;
  the carousel is index state swapping panels with a fade/slide. **Difficulty: medium.**

### 6. Pinned "By the numbers" bar chart (second signature piece)
- **Where / trigger:** `.sv-chart-sec`, y 2090-4475. The 2385 px tall section **pins** — the
  content stays fixed in the viewport while you scroll through it (frames barely change over
  y2118-3489), and the chart animates in place.
- **What moves:** four bars grow to encode their values while filling amber from the bottom, and
  the numbers count up as they fill: `4+→10+` (Years designing), `67+→150+` (Websites designed),
  `22+→50+` (Products shipped), `4+→10+` (Industries worked). The heading "Ten years, / by the
  numbers." reveals in two lines (second line rises from grey to ink).
- **Properties / mechanism:** the `--p` rAF progress property drives bar height/fill via CSS
  `var(--p)`; numbers are set from the same progress in JS (`toFixed`). Bars carry a diagonal
  hatch texture. Auto-advances once pinned (`pct + 7`/frame).
- **Frames:** `charttime/ct_00.png` (bars low, `4+/67+/22+/4+`) → `charttime/ct_10.png`
  (grown + counted to `10+/150+/50+/10+`); fine scroll pass in `chart/run_20260905_122604/`.
- **Replicate:** medium-hard. The count-up + fill is easy (rAF lerping a number and a CSS var).
  The *pinning* is the work: either `position: sticky` on a tall spacer, or a scroll-progress
  calc. Native CSS scroll-driven animations (`animation-timeline: view()`) could also drive it.
  **Difficulty: medium-hard** (easy if you drop the pin and just trigger on enter).

### 7. Section text reveals (#tools, #profile)
- **Where / trigger:** y 4475-5959, on scroll into view.
- **What moves:** headline + paragraph fade-and-rise; a ruled divider draws in on `#profile`
  (`.sv-ruled`). The accent word inside each headline is amber.
- **Timing:** the shared `.sv-rv.is-in` reveal, 0.8s.
- **Frames:** `run_20260905_122442/film_..._033_y4112.png` region.
- **Replicate:** IntersectionObserver `.is-in` reveal; underline via `transform: scaleX` on a
  pseudo-element. **Difficulty: easy.**

### 8. Scroll-driven project mosaic
- **Where / trigger:** `.sv-mosaic-track`, y 5959-8839 (2880 px), scroll.
- **What moves:** a staggered mosaic of project screenshots (Mindpath ADHD site, a "My jobs"
  mobile app, TRT Clinic, a dashboard, an office photo). As you scroll, the tile in the center of
  the viewport is emphasized (full color, slight scale, pink frame on the featured one) while the
  surrounding tiles sit muted grey — a focus-follows-scroll gallery with mild parallax between
  columns.
- **Properties:** per-tile `opacity`/`transform`/`scale` keyed to scroll position; columns move at
  slightly different rates (parallax).
- **Frames:** `run_20260905_122442/film_..._054_y6729.png`, `..._057_y7103.png`,
  `hover/darkmode_mosaic.png`.
- **Replicate:** medium. CSS grid mosaic; on scroll, compute each tile's distance from viewport
  center and map to opacity/scale (rAF or `animation-timeline: view()`). Parallax = different
  `translateY` factors per column. **Difficulty: medium.**

### 9. Sticky nav — active-section dot + day/night toggle
- **Where / trigger:** nav is sticky; scroll updates which link shows the amber dot; clicking the
  toggle flips the whole theme.
- **What moves:** an amber dot slides under the active section link; the toggle icon
  (`svg.sv-dial-mk`) rotates (`transform 0.45s cubic-bezier(0.2,0.8,0.2,1)`) and the page
  crossfades between day and night, at which point the street lamps/windows light up.
- **Hover states (measured):** nav links change `opacity` only (0.2s) — a very subtle ~0.1%
  change; the toggle background fills `rgb(239,233,210)` on hover; the Contact button lightens
  `rgb(243,180,74)→rgb(249,203,128)` and nudges on press (`background, transform` 0.2s/0.15s).
- **Frames:** `hover/nav_rest.png` vs `hover/nav_hover_work.png`; `hover/cta_hover.png`;
  `hover/darkmode_top.png`.
- **Replicate:** easy-medium. Active dot = an absolutely-positioned element whose `left` follows
  the current link (IntersectionObserver on sections). Theme = toggle a `data-theme` attribute +
  CSS variables. **Difficulty: easy-medium.**

### 10. Assorted looping micro-animations
- Small CSS `@keyframes` seen in the bundle used as decorative loops: `sv-wave` (a waving hand,
  rotate ±), `sv-core` (a pulsing dot, opacity 0.55↔1), `sv-blink`, `sv-ring`, `sv-tap`,
  `sv-jump`, `sv-board-hi` (a tooltip/label popping up), `sv-sheet-fade` (the mobile nav sheet).
- **Mechanism:** pure CSS keyframe loops, mostly `transform: rotate` / `opacity`.
- **Replicate:** trivial one-offs. **Difficulty: easy.**

### 11. Mobile nav sheet (clip-path reveal)
- **Where / trigger:** hamburger at narrow widths (`div#sv-nav-menu.sv-nav-sheet`).
- **What moves:** the menu opens via a `clip-path` wipe (`clip-path, visibility` 0.62s
  `cubic-bezier(0.76,0,0.24,1)`); menu items and footer stagger in (`transform`+`opacity` 0.5s
  `cubic-bezier(0.22,1,0.3,1)`); the hamburger-to-X icon morphs (`span` bars transform/opacity/width).
- **Replicate:** medium. `clip-path: inset()` or `circle()` transition on the panel; staggered
  item transitions; classic 3-line→X hamburger. **Difficulty: medium.** (Not filmed at desktop
  width; inferred from the motion table.)

## Which fit a four-step (Designed / Analyzed / Built / Proved) card portfolio

Best candidates, in order:

1. **#6 Pinned "By the numbers" bar chart** — top pick. It has a clear narrative (raw stats →
   designed chart → built with a progress loop → proved by the count-up landing on real numbers),
   is visually satisfying, and the four-bar structure literally mirrors a four-step card. Medium
   effort, high payoff.
2. **#8 Scroll-driven project mosaic** — a natural "gallery of proof" surface; each tile can be a
   case study, and focus-follows-scroll is impressive without needing custom illustration.
3. **#2 Curtain wipe + #1 intro word** — cheap, high polish; good as the framing/entrance for a
   card deck (Designed→Analyzed→Built→Proved could each wipe in).
4. **#9 Sticky nav active-dot + day/night toggle** — a strong "chrome" layer that ties a
   four-step deck together and shows craft, with an easy build.

Skip for a card portfolio (great but expensive / off-theme): **#3 the walking-figure street**
is the site's showpiece but is a bespoke rigged-SVG illustration — high cost, and it is a
navigation metaphor rather than a per-project step. Worth admiring, not the first thing to clone.
