# v2 spec: "Ordered" (nirnor.jp-inspired portfolio)

Owner: team lead (Fable). Implementers: Opus 4.8, one at a time on `v2/`. Root `index.html` is frozen; all v2 work lives in `v2/`. Live URL when done: https://kambar231.github.io/Work_Portfolio/v2/

## 0. Why this exists
Kambar's verdict on the root page: animations rudimentary, colors flat, page messy. Reference for
elegance: https://nirnor.jp/ (floating cubes, calm type, "a more organized world"). Reference for
vibe: `codex-portfolio/` (playful, not too serious, warm paper palette). See
`docs/NIRNOR_STUDY.md` and `docs/CODEX_VS_OURS.md` for measured parameters. Numbers there override
guesses here.

## 1. Concept in one paragraph
Everything Kambar has made is a cube. The page opens on a perfectly sorted grid of cubes hovering
over a calm ground, each cube labelled softly. Scroll or click, and the grid unravels: cubes drift
apart, and one chapter at a time a cube glides to the side of the screen, grows, and its story
appears next to it, told in first person with the real photos and numbers. At the end the cubes
settle back into order. Thesis line adapted from nirnor's: "A more organized world" becomes
"Order, from parts that move." Subline: "I design things, prove them on paper, build them, then
test them until the number is real."

## 1b. What nirnor.jp actually does (lead's read of the 60-frame film, docs/nirnor-study/lead-film)
- Pure white page. Background = a slow-drifting field of fine grey PARTICLES drawn along flowing
  curves (looks like pencil-dust threads and a smoke plume near About). It is subtle: 10 to 15 percent
  grey, never competes with text. It drifts continuously and shifts with scroll.
- Cubes: photo-textured cubes (each face a different work photo), 1 to 2 on screen at a time,
  tumbling slowly as they travel with scroll, entering from one edge and leaving by another. They
  are the only colour on the page. Perspective camera, no shadows, no outlines, crisp textures.
- Type: one thin geometric sans (Roboto-light-like), used at three scales: huge lowercase category
  words (art direction, digital content, movie, graphic, logo) ~90 px, small lists of sub-items
  ~16 px, and a giant bold "VIEW ALL WORKS" CTA with a count superscript. Nav is three tiny
  uppercase links top-right. Logo top-left. Enormous whitespace; each viewport holds one idea.
- Text reveals: headlines scramble/wipe in letter by letter as they enter (frames show partially
  drawn letters "al cont nt"), lists fade in staggered.
- Sequence: hero (logo, tagline, tiny address) -> WORKS index -> per-category viewports with one
  cube each -> VIEW ALL WORKS -> ABOUT (italic serif quote "eloquently expressed silence" on a soft
  grey smoke plume) -> a full-bleed DARK BAND with the manifesto rotated vertical ("A more organised
  world, more design that touches your heart") next to a ribbed monochrome 3D form -> Member list ->
  Company -> Topics -> Contact button. Total scroll ~13,300 px at 1440x900.
- Feel: monochrome, thin, quiet, slow. Colour only from the cube photos.

## 1c. Kambar's tailoring (decided)
- Cubes = his work. Faces textured with REAL photos from assets/: CNC machine, wound motor, cast
  nozzle shell, slicer UI, polymer render, forklift SVG rendered to a texture, pendulum rig, cannon.
  One cube per chapter, 8 cubes total.
- Hero = all 8 cubes hovering in a SORTED 4x2 grid ("an organised world"), gently floating, slight
  cursor parallax. Tagline: "Order, from parts that move." Below it, tiny: Kambar Mangibayev,
  Mechanical Systems Engineer, Rochester NY.
- Unravel: the first scroll breaks the grid; cubes drift into a loose cloud; from then on one cube
  at a time travels with its chapter (nirnor's tumble) and parks beside the chapter text. Category
  words at nirnor scale: simulate / make / build / software / deploy. Clicking a cube in the hero
  jumps to its chapter (that is the "people can select" idea).
- Dark band = Kambar's manifesto, rotated vertical, beside the ribbed form replaced by the F-1 nozzle
  wireframe or a rotating cube stack: "Sense. Decide. Respond. Then measure it."
- Closing: cubes glide back into the sorted grid behind the contact line.
- Background particle threads: reproduce (points along 3 to 4 slowly evolving Bezier curves,
  additive grey, drifting). This is the single most important atmosphere element after the cubes.

## 2. Stack (answering "what framework")
No React, no build step (GitHub Pages serves static files). Real libraries, pinned, ES modules from
jsdelivr:
- three@0.160 (cube scene: InstancedMesh, soft shadow, fog, MeshStandardMaterial matte)
- gsap@3.12 + ScrollTrigger (scroll choreography, pinning, timelines, one source of truth for
  all motion)
- lenis@1.1 (smooth scroll)
- Fonts: per NIRNOR_STUDY (self-host if licensed free, else Fontshare/Google equivalents).
Files: `v2/index.html`, `v2/css/site.css`, `v2/js/{scene.js,story.js,main.js}`, `v2/assets/`
(copied from root assets, plus new renders). Copy stays in the HTML, not in JS.

## 3. Chapters, in order (the content restructure Kambar asked for)
0. Hero: sorted cube grid, name, thesis, one line of who I am, scroll cue.
1. Origin: Semey to Rochester, RIT BS+MEng controls, GPA. One cube = RIT.
2. Polymer Lithography Simulation (2020): the first cube that unravels. Simulation branch begins.
3. Additive Manufacturing and Investment Casting (RIT AMPrint, 2023 to 2024).
4. PrintNC CNC (built in an apartment; 1200x800 mm; 0.1 mm).
5. 3D Slicer and G-code (2025 to 2026): where the math meets the machines. Nirnor's "design that
   touches your heart" line becomes here: "Software that touches the material."
6. The Raymond Corporation (2024 to now): six systems on one truck. Forklift silhouette drawn from
   the cube material (or the SVG placeholder), six cards orbit, no overlap. Stats: +14%, -10%.
7. Previous experience: BorgWarner (SIMPLE VCT: one auto-looping advance/retard sweep, no
   buttons, 6 parts max), Boston Beer (non-alcoholic line, +7% OEE). No "intern", no "co-op".
8. Other projects, compact tiles: Flight Dynamics, Double Pendulum, Vacuum Cannon, Saturn V FEA,
   3D Printing, CubeSat, CatBot (images pending).
9. Websites: four WebPort tiles, one line, links out, back links already fixed.
10. Education, awards, contact. Cubes reassemble sorted behind the closing line.

Every chapter 2 to 7 keeps the Designed / Analyzed / Built / Proved evidence, but as a quiet
four-column strip under the story paragraph (small caps labels), not four blocks of prose. A
"Read the full breakdown" link opens the reading panel with the existing long-form copy.

## 4. Motion rules (micromanaged)
- One GSAP ScrollTrigger timeline per chapter, scrub: 0.6, pin where the chapter has a hero
  moment (hero, slicer, Raymond). Everything else is `power2.out`/`power3.inOut`, 0.6 to 1.2 s.
  Nothing linear. No CSS keyframes for scroll-driven motion.
- Cube scene: one Three.js canvas fixed behind the page, alpha, devicePixelRatio capped at 2,
  60 fps on a laptop iGPU (measure with a 5 s rAF counter, must stay above 50). Cubes float with
  two summed sines (amplitude and period from NIRNOR_STUDY), cursor parallax lerped at 0.06.
  Arrangement states: SORTED (grid), UNRAVELLED (loose cloud), FOCUS(i) (cube i at screen-left
  anchor, scale 2.2, others dimmed). Transitions via GSAP tweens on instance matrices, 1.2 s.
- Text: chapter headline reveals by line (clip-path mask + y 40 px), body fades, 0.08 s stagger.
- Reduced motion: static sorted grid image, no pin, all content visible. Under 760 px: canvas
  stays but cubes are fewer (12) and no FOCUS moves; content stacks.
- Never: overlays outside their container, transforms on ancestors of fixed panels, fades from
  opacity 0 at the very top of the page (first paint must show the hero).

## 5. Palette, type, and measured parameters (from docs/NIRNOR_STUDY.md, binding)
- Background #ffffff. Ink #1a1a1a. Greys #3c3c3c (secondary text), #7e7e7e (labels), #d9d9d9 and
  #eaeaea (particles, hairlines). Dark band #1a1a1a with #ffffff text. NO accent colour in the UI;
  colour comes only from cube photo textures. (Codex palette dropped by Kambar's instruction.)
- Type: Roboto (weights 100 to 900, Google Fonts) for everything Latin; Ibarra Real Nova italic for
  the one serif quote line. Fluid sizes: display min(150px, 10.4vw) weight 300; category words
  min(96px, 6.6vw) weight 300 lowercase; body 16 to 18 px weight 400 line-height 1.7; labels 12 px
  uppercase tracking 0.12em weight 500. Column max-width 1248 px.
- Cube scene: Three.js r163 (module build from jsdelivr, pinned). PerspectiveCamera fov 90 for the
  cube canvas; cubes = BoxGeometry with a different photo per face (MeshStandardMaterial,
  roughness 0.85, metalness 0), one DirectionalLight (intensity 1.2, from upper left) + AmbientLight
  0.6, no shadows, no fog, no outlines. Continuous tumble: rotation.x += 0.0025, rotation.y += 0.004
  per frame, bob = sin(t*0.6)*0.08. Texture maps: assets downscaled to 512 px square, mipmapped.
- Background particle field: separate fixed canvas behind everything (z-index -1), THREE.Points,
  PointsMaterial size 1.6 sizeAttenuation true colour #d9d9d9 opacity 0.85, 40k points at desktop
  (12k mobile), positions stepped each frame by a strange-attractor step (Clifford or de Jong,
  a,b,c,d tuned by eye to give smoke ribbons; dt 0.004) plus a slow global drift; density scales
  with scroll progress: 30 percent of points visible at hero, 100 percent by the closing section.
  Cursor: negligible (parallax 0.01).
- Signature text reveal ("blink"): each glyph wrapped in a span, keyframes over 0.3 s with
  step-end: opacity 0 -> .5 -> .2 -> .7 -> 0 -> 1, stagger 18 ms per glyph, triggered on
  scroll-in once. Hairlines grow width 0 -> 100 percent over 0.3 s ease. Sections slide/fade 24 px.
- Smooth scroll: Lenis 1.1, lerp 0.1. GSAP ScrollTrigger scrub 0.6 for cube travel.

## 6. Build phases (one implementer, one commit per phase, film each)
P1 Scaffold + cube scene: hero with sorted grid, float, cursor parallax, unravel on first scroll,
   fps check. Gate: film 30 frames, time-lapse at y=0, fps >= 50.
P2 Chapters 1 to 5 with FOCUS moves and text reveals. Gate: film, no overlap, copy grep.
P3 Raymond + previous experience (simple VCT loop) + other projects + websites + close.
P4 Reading panel, mobile, reduced motion, Lighthouse performance >= 85, click tests on all
   openers, writing-rules grep, every src exists. Then link from root nav "v2 preview".
Each phase: `git add -A && git commit -m "v2: <phase>" && git push`, report frames + hash.

## 7. Round 2 (Kambar, 2026-09-06): "naked, empty, lazy" -> make it alive
Verdict on round 1: cubes and background too faint, structure too sparse, "02 / SIMULATE" labels
read as AI. Round 2 replaces the chapter structure with fewer, stronger set pieces.

### 7.1 Always on: floating cubes + dense background
- Particle field is a VISIBLE actor: 160k points desktop, size 1.6, colour #b8b8b8 at hero (not
  #d9d9d9), ribbons clearly readable at first paint (compare nirnor frame_013). Density never
  below 70 percent.
- Eight photo cubes float across the page continuously (slow drift + tumble), never hidden
  between sections; they part around text (exclusion rule stays) but stay on screen.
- Cube reveal: fade in per cube when its textures load, with a 2.5 s timeout after which the
  cube shows with a neutral #e0e0e0 material so nothing can stay invisible.
- No numbered section labels. Headings are plain words; the fluid category-word style stays.

### 7.2 Background morphs (three, no more; "it will get annoying")
Mechanism: each point has attractorPos and up to three shapePos targets (sampled from a mask
image at build time: forklift, slicer stack, cube outline). Vertex shader mixes
attractorPos -> shapePos[k] by uMorph[k] (0..1) with per-point noise so the form assembles
from dust and dissolves back. uMorph driven by ScrollTrigger scrub 0.8, power2.inOut.
1. EXPERIENCE: on the right the dots reform into the FORKLIFT silhouette (from the root SVG,
   rasterised to a 1024 mask, ~45k points, slight breathing). Left column: The Raymond
   Corporation, role, 2024 to now, the six systems as plain lines with their numbers, then
   achievements (Outstanding Undergraduate Scholar 2022, Greater Good 2019, GPA 3.90 / 4.00),
   then BorgWarner and Boston Beer as two short rows (VCT loop stays, small).
2. SLICER: dots reform into a STACK OF SLICE CONTOURS (a nozzle-like solid sliced into ~40
   horizontal rings, generated procedurally, rings light up bottom to top with scroll like a
   print), beside the slicer story and its evidence.
3. DARK STRIPE: full-bleed #1a1a1a band; the same field in white dots forms a wireframe CUBE
   OUTLINE that slowly rotates while the manifesto sits rotated vertical on the left.

### 7.3 Projects = grid of cubes that unfold
- A 4x2 grid of the eight cubes (larger, ~180 px) under the heading "projects". Hover: cube lifts
  and slows. Click: the cube glides to screen centre, the other cubes and text fade, and it UNFOLDS
  into its cross net (six hinged face meshes, GSAP rotations, 1.1 s power3.inOut), the camera
  frames the net, then DOM cards attach to each face by projection: face 1 title + year + one
  line, face 2 Designed (image + 2 lines), face 3 Analyzed, face 4 Built, face 5 Proved with the
  number, face 6 tools and a "full breakdown" link (existing reading panel). Close (X, Escape,
  click outside) folds it back and returns it to the grid. Mobile: unfold becomes a vertical
  stack of the six faces.
### 7.4 Page order
Hero (headline, floating cubes, dense ribbons) -> Experience (forklift morph) -> Slicer (stack
morph) -> Projects (cube grid + unfold) -> Websites (small) -> Dark stripe (cube-outline morph +
manifesto) -> Contact (cubes settle into a grid, details).

## 8. Round 3 (Kambar, 2026-09-06 "go ahead and cook"): motion engine, Raymond cube, baked faces
Order: engine -> experience -> unfold. Every step passes v2/verify_all.py (extended) before review.

### 8.1 Cube motion engine (v2/js/cubes.js rewrite of the movement layer)
- Each cube: position, velocity, target, plus rotation and angular velocity. Sections only set
  targets (grid slot, side lane, off-screen exit point). A critically damped spring (omega ~2.2,
  zeta 1) moves the cube; angular velocity damps toward a slow tumble or to zero when parked.
- Repulsion between cubes and lane-avoidance around text are soft forces added to velocity
  (never position writes), so no snapping and no oscillation.
- Visibility is never opacity: unneeded cubes drift out past the nearest viewport edge (target
  1.3x outside) and drift back when needed. Opacity stays 1.0 always (except the projects
  scrim state, where non-open cubes drop to 0.06 as before).
- Lanes: every visible text block registers a rect; the engine steers cubes into the free
  region (usually the opposite column) instead of dimming them.
- Checker additions: max per-frame displacement of any cube <= 14 px at 60 fps (no pops), no
  cube below opacity 0.98 outside the scrim state, zero overlaps, zero cube-on-text.

### 8.2 Experience choreography
- Morph geometry: forklift and slice stack centred at 62vw, 50vh (not the right edge), ~62vh
  tall. Forklift assembles over the first 30 percent of experience, HOLDS to the end of
  experience, then crossfades into the slice stack as slicer begins (uMorph0 down while
  uMorph1 up over the same 40vh). No plain-background gap between them.
- RAYMOND CUBE replaces the six-line list: at experience start the raymond cube flies in from
  the right, parks at 30vw / 52vh at scale 2.4 (left of the forklift, right of the text), then
  unfolds scroll-driven (progress 0.25 to 0.55) into its cross net; the six faces ARE the six
  systems (baked textures, see 8.3): name, key number, one line. Each face is clickable and
  opens that system's reading panel. It folds back and returns to drift as slicer begins.
- Left column keeps: heading "experience", employer, role, dates, achievements. BorgWarner and
  Boston Beer move to their own band 60vh lower with the small VCT loop.
- Reading panels scroll internally (data-lenis-prevent, overflow auto, max-height 100vh) and a
  test opens the longest panel and scrolls it 600 px.
- Other cubes exit to the edges during experience (no dimming).

### 8.3 Baked faces for every unfold (projects and Raymond)
- Face textures are drawn on 1024 px canvases: image (cover, top 58 percent), a white band
  with title (Roboto 500 44 px), key line (Roboto 400 30 px), one-line summary (26 px), a small
  label (DESIGNED / ANALYZED / BUILT / PROVED / TOOLS / the system name). CanvasTexture with
  sRGB colourSpace, anisotropy 8. The DOM overlay is reduced to one "Full breakdown" link and
  the Close button; no cards over faces.
- Remove the diagonal seam: use PlaneGeometry(1,1,1,1) with MeshBasicMaterial for open faces
  (no lighting-induced diagonal), toneMapped false, no alpha edges; verify with 400 px crops of
  every open face (assert no diagonal line via a Hough-style check or by eye in the report).
