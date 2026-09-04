# Portfolio v2 — handoff to next chat

This is a complete handoff for picking the desk experience back up in a fresh conversation. Paste this whole file to brief the new chat. The goal is to **work on `desk.html` and improve every single 3D object, starting with the "3D me" character.**

---

## 1. Who you are and what you're building

You're Kambar Mangibayev — vehicle systems engineer, Asian, late 20s, thick tousled black hair, broad smile, glasses, broader shoulders, wears suits. You're building a personal portfolio at `C:\Users\kmangibayev\Desktop\Porotfolio\portfolio_v2\` that has **two parallel entry experiences**:

- **`index.html`** — an Obys-agency-inspired editorial project index. Single custom serif (Fraunces), three view modes (Vertical/Horizontal/Grid), 15 projects, project names left, image center inside `( )` brackets, description right. This is the recruiter-safe path.
- **`desk.html`** — a Three.js 3D experience where a stylized "you" sits at a desk with five clickable props (portfolio, Iron Man helmet, CAD model, recommendation letter, coffee mug). Click a prop → 4-beat pickup animation → camera dollies into first-person POV → relevant project content overlay reveals. This is the creative-coder showpiece. **This file is the focus of the next round.**

Both connect: the desk's `OPEN THE INDEX →` button on the portfolio POV navigates to `index.html`.

---

## 2. Tech stack constraints (do not change these without thinking hard)

- **Three.js r148** loaded as a classic global `<script>` (the UMD build). This was chosen so `desk.html` works when opened directly from disk (`file://`) without a server — ES modules + importmap don't work over `file://` because of CORS. r148 was the last version that ships a working `three.min.js` UMD. Do not upgrade to r150+ without solving the file:// problem first.
- **GSAP 3.12.5** for animation tweens — also as a global script.
- **No external 3D assets.** No STLs, no GLBs, no Blender models — everything is built procedurally from Three.js primitives (Box / Sphere / Cylinder / Cone / Plane / Torus / TorusKnot / Shape + Extrude). This is a hard constraint: I tried to fetch a Mark III helmet STL from Thingiverse and it's behind a login wall. Plan B is always procedural primitives.
- **No real photo of Kambar on disk.** The photo lives in conversation context but isn't a file. To get true likeness, save the photo to `assets/img/kambar.jpg` and ask the agent to swap `buildFaceTexture()` for a `TextureLoader().load('assets/img/kambar.jpg')` call.

---

## 3. Files and their roles

```
portfolio_v2/
├── desk.html                  # THE focus file. Sits at ~125 lines. See section 7 below for the full source.
├── index.html                 # The Obys-style index (already polished, don't break it)
├── assets/
│   ├── css/
│   │   ├── desk.css           # POV overlays, HUD, cursor, paper-grain filter, ~450 lines
│   │   └── styles.css         # Obys index styles
│   ├── js/
│   │   ├── desk.js            # THE Three.js scene. ~62KB, ~1500 lines. Contains everything 3D.
│   │   └── main.js            # Obys index JS
│   └── img/                   # Project images for index.html (no portrait yet)
├── work/                      # 6 case study pages
├── projects/                  # 9 case study pages
└── HANDOFF.md                 # this file
```

---

## 4. desk.js architecture (so you know what to touch)

`desk.js` is organized top-to-bottom in this order. Each section is its own block of `const` declarations and `scene.add()` calls — no classes, no modules. Editing one section should not break the others.

1. **Constants** — colors (`PAPER`, `NAVY`, `RED`, `WOOD`, `SKIN`, `HAIR`, `GOLD`), `$()` helper, `lerp()` helper.
2. **Renderer + scene + camera** — WebGLRenderer with `toneMapping = THREE.CineonToneMapping` (NOT ACES — ACES desaturates reds), `outputEncoding = sRGBEncoding`, `toneMappingExposure = 1.00`. Two camera setups: `CAM_A` (third-person rest) and `CAM_B` (5 first-person POV presets, one per prop).
3. **Lighting** — `HemisphereLight(0xcfd9e8, 0xc9b89a, 0.20)` + warm key `DirectionalLight(0xffc89a, 1.1)` + cool fill `DirectionalLight(0xbcd4ff, 0.35)` + rim `DirectionalLight(0xf2f6ff, 0.6)`. Total irradiance ~2.25 — pushing it past ~3.0 will bleach the materials.
4. **Materials** — `matNavy`, `matRed`, `matGold`, `matWood`, `matSkin`, `matHair`, `matInk`, `matPaper`, `matAccent`, plus suit-specific `matBlazer`, `matShirt`, `matTie`, `matTiePat`.
5. **Geometry helpers** — `addEdges()` (blueprint look), `roundedBoxGeometry()` (Three.js doesn't ship rounded boxes natively).
6. **Floor / backdrop / grid**.
7. **Desk + drawers + side return + modesty panel + chair** — the furniture.
8. **`buildFaceTexture()`** — procedurally draws the face on a 512×512 canvas (skin base, cheek blush, almond eyes with iris/pupil/catchlight, eyebrows, smile with teeth).
9. **Character group** at `(0, -0.30, -0.85)`. In order: torso (cylinder), hem, shoulder spheres (`SHOULDER_R = 0.16`, `SHOULDER_X = 0.41`, `SHOULDER_Y = 1.60`), lapels (two angled boxes), shirt V, tie + pattern + knot, neck base, neck cylinder, head sphere (`HEAD_SCALE = 0.85`), face features (nose cone, two eye groups, brow bars, half-torus smile, teeth strip, mouth shadow, ear spheres), hair group (3 stacked spheres + cone tufts), `makeArm()` builds shoulder pivot → upper arm → elbow → forearm → wrist → hand mitten + thumb stub.
10. **Idle pose** — `setIdle()` sets arm angles for hands-on-desk position.
11. **Props** — 5 groups added to `props` Group, each tagged with `userData.id`:
    - `portfolio` — book box with gold spine
    - `helmet` — Iron Man (red cranium sphere + extruded gold faceplate Shape + V-brow bars + angry-eye slits + mouth grille + temple panels + jaw hinges)
    - `cad` — torus knot on a small base
    - `letter` — paper sheet with text-line slats
    - `mug` — body + handle + coffee circle + rim on a coaster
12. **Raycaster + state machine** — `state = "idle" | "picking" | "pov" | "returning"`. Click → `pickPropAt()` → `triggerPickup()`.
13. **Custom cursor** — small dot + 32px hover ring on interactive elements.
14. **`tweenCamera()`** — staggered: focus point leads at t=0 (power3.out), camera position at t=+0.10s (expo.inOut), FOV at t=+0.15s (power2.inOut). Total ~1.45s.
15. **`triggerPickup()`** — 4-beat GSAP timeline: SETTLE 180ms → ANTICIPATE 120ms (arm pulls back 15°) → REACH 380ms (elbow leads, wrist trails 60ms) → 40ms hold at apex → LIFT 280ms (prop rises, opposite shoulder counter-rotates). Camera dolly fires at t=1.04. POV overlay reveals at 92% of camera tween.
16. **`returnToDesk()`** — faster (0.9s), `power4.out` ease, bypasses `tweenCamera` so the retreat is unified rather than staggered. Going in is reverent, coming out is decisive.
17. **`ambientIdle()`** — breathing on torso y-scale ±0.4% on 3.2s sine + head sway ±0.4° on 4s + phase-shifted pitch wobble.
18. **`tick()`** — animation loop. Cursor lerp, ambient idle, `camera.lookAt(camFocus)`, render.
19. **Resize + curtain dismiss + window debug globals** (`__getState`, `__pickById`, `__backToDesk`, `__scene__`, `__camera__`).
20. **Boot** — `setIdle()`, first render, `tick()`, `dismissCurtain()`.

---

## 5. Per-3D-object improvement roadmap

Here is every 3D object currently in the scene, what's weak about it, and concrete directions for improvement. Start at the top (the character — your "3D me") and work down.

### A. The character — the "3D me"

The single biggest visual gap in the scene. Currently a primitives puppet with procedurally-drawn features.

**A.1 Head sphere**
- *Current:* `SphereGeometry(0.30, 32, 24)` scaled `(0.85, 0.8925, 0.8075)`, plain `matSkin`.
- *Weak because:* perfect spheroid — no jaw, no temples, no chin definition.
- *Directions:*
  - Add a `BoxGeometry`-then-bevel jawline at the bottom front.
  - Pinch the chin via vertex deformation (loop over `geometry.attributes.position` and pull lower-front vertices inward).
  - Use a `LatheGeometry` with a head silhouette profile for a real head shape.
  - Best win: **load a free GLB head model from a CDN that allows CORS** (e.g. Ready Player Me's avatar export), parse with GLTFLoader, drop in. Bumps fidelity by an order of magnitude.

**A.2 Face features (eyes, nose, eyebrows, mouth, ears)**
- *Current:* All real 3D primitives glued to the head front at `z = FACE_Z = 0.235`. Eye = white sphere + dark pupil + tiny catchlight. Nose = cone protruding forward. Brows = thin black boxes. Mouth = half-torus + teeth strip + mouth shadow box. Ears = small flattened spheres on the sides.
- *Weak because:* the features look glued on, not part of the skull. Nose has no nostril holes. Eyes don't blink. Eyebrows don't move. Mouth doesn't open/close.
- *Directions:*
  - **Blink animation:** scale the eye whites/pupils y-axis to 0.05 in a 120ms GSAP tween every 4-6 seconds.
  - **Eye tracking:** make the pupils follow the cursor (raycast mouse → world → calculate pupil rotation).
  - **Mouth states:** swap the half-torus between three positions (neutral / smile / surprised) when picking up props.
  - **Better nose:** add nostrils via two tiny `SphereGeometry(0.003)` dark spheres set into the nose underside.
  - **Cheekbones:** add two flattened spheres beneath the eyes for the Asian cheekbone shape Kambar has.
  - **Eyebrow expressions:** tween brow rotation slightly when interacting (raise on hover, furrow on focus).

**A.3 Hair**
- *Current:* a Group of 3 stacked flattened spheres + 5 randomly-rotated cone tufts on top. Color `#0e0805`.
- *Weak because:* the tufts read as "spikes," not as the soft tousle in Kambar's photo. The base spheres look bowl-shaped.
- *Directions:*
  - Replace the cone tufts with curled `TorusKnotGeometry(0.018, 0.005, 24, 4)` pieces — gives organic locks instead of cone spikes.
  - Add a "side sweep" by tilting the top sphere 8° to one side.
  - Add 2-3 longer cone strands hanging down at the temples (the photo shows hair touching ears).
  - Best win: **bake a hair card texture (alpha-cut strands on a plane), tile it across a sphere** — the standard way real-time hair is done. Requires a single texture asset.

**A.4 Torso / blazer**
- *Current:* `roundedBoxGeometry(0.77, 0.88, 0.39, 0.07, 4)` in `matBlazer` (`#1a2540`). A "hem" mesh below for the waist taper.
- *Weak because:* uniformly thick — no chest/waist contrast, no shirt cuff showing at sleeves, no breast pocket, no buttons.
- *Directions:*
  - Add a single button: small dark `CylinderGeometry(0.012, 0.012, 0.005)` at jacket-belly height.
  - Add a breast pocket: thin `BoxGeometry(0.08, 0.005, 0.02)` set into the chest.
  - Show cuff: add a thin off-white ring around each wrist at the hand attachment.
  - Sharpen the lapel notch: replace the suggestive triangle plane with a proper Shape extrusion that cuts the corner.
  - Add pinstripe: a `RepeatWrapping` texture of thin lines on the blazer material.

**A.5 Shoulders**
- *Current:* `SphereGeometry(0.16)` spheres scaled `(1.0, 0.70, 0.90)` at `x = ±0.41`.
- *Weak because:* perfectly spherical — real suit shoulders have a flat top (the structured pad).
- *Directions:* Replace with `BoxGeometry(0.16, 0.05, 0.18)` slightly tapered, or scale the sphere `(1.0, 0.45, 0.95)` for a more padded look.

**A.6 Neck / collar**
- *Current:* skin-tone neck base sphere + small cylinder bridging head to torso. Half-torus collar.
- *Weak because:* visible seam between head and neck. Collar shape barely reads as a shirt collar.
- *Directions:*
  - Smooth the head-neck join: lower the head sphere by 0.02 so it visually merges with the neck.
  - Add a real collar: two angled `BoxGeometry(0.10, 0.06, 0.025)` shapes flanking the tie, in `matShirt` (white). This is the missing piece that makes a suit read as a suit.
  - Add tie knot dimple: shrink the front face of the tie knot box slightly to suggest the centered crease.

**A.7 Arms / hands**
- *Current:* shoulder pivot → upper arm cylinder → elbow → forearm cylinder → wrist → flat sphere hand + thumb sphere stub.
- *Weak because:* arms are uniform-radius blue tubes (should taper); hands are mittens with no finger separation; thumb floats.
- *Directions:*
  - Taper arms: replace `CylinderGeometry(0.07, 0.07, ...)` with `CylinderGeometry(0.09, 0.07, ...)` (wider at shoulder).
  - Add an elbow joint sphere at the elbow pivot for visual continuity.
  - Replace mitten with a 4-finger hand: 4 thin `CylinderGeometry(0.01, 0.01, 0.04)` for fingers + 1 thumb. Group at the wrist.
  - Add jacket cuff: small dark ring at wrist.

### B. The Iron Man helmet

The other headline asset. Currently the biggest disappointment.

- *Current:* red cranium sphere + gold faceplate (Shape extrusion with a V-brow apex shape) + brow ridge bars + emissive cyan eye slits at 15° angry tilt + gold mouth grille + dark slats + side temple panels + jaw hinges. Built from primitives only — no STL.
- *Weak because:* even with the rebuild, the faceplate Shape only has 12 vertices so the silhouette is blocky. The gold faceplate is barely distinguishable from the red cranium at desk scale. The brow V is too subtle.
- *Directions ordered by impact:*
  1. **Get an STL** — go to the Thingiverse Iron Man helmet page (`thing:3236642`) in a normal browser, log in, download the STL to `assets/models/iron-man-helmet.stl`, then ask the agent to load it via `THREE.STLLoader` (an addon — must include from the same r148 examples folder). This single move makes the helmet movie-accurate and is the highest-leverage change.
  2. If staying procedural: increase the `fpShape` to 24+ vertices for finer cheekbone curves; make the gold faceplate ~30% bigger so it dominates the silhouette; add a deeper inset for the eye slits (push them recessed into the faceplate).
  3. Add the iconic "horn" detail at the temples — two small angled gold pieces above the ear line.
  4. Bump the helmet position so the gold faceplate is clearly facing the camera at rest (currently `rotation.y = 0` after my last fix; tilt to 0.15 to show 3/4 view).
  5. Add a thin black outline around the faceplate edges via `EdgesGeometry` with `LineBasicMaterial` — the comic-book panel-line look.

### C. The portfolio (the book)

- *Current:* `BoxGeometry` cover + thin pages box + gold spine box. Tagged `id: "portfolio"`.
- *Weak because:* reads as a slim black book with a gold spine — fine but uninteresting. No texture on the cover, no embossing.
- *Directions:*
  - Add a faint embossed "K" or "PORTFOLIO" via a thin gold `PlaneGeometry` on the cover front.
  - Show 2-3 papers peeking out from the side (small offset rectangles).
  - Slightly open the book at rest (rotate the cover by 8°).

### D. The CAD model (the torus knot)

- *Current:* `TorusKnotGeometry(0.08, 0.025, 80, 14)` in blue + matte paper base.
- *Weak because:* a torus knot is the most cliché "look at my Three.js scene" object — the verifier specifically called this out as a tutorial-project red flag.
- *Directions:*
  - **Replace it with something engineering-specific:** a small gear (custom geometry using `Shape` with teeth), a bracket (extruded L-shape), a turbine blade (extruded airfoil), or a CAD bolt (cylinder + hex head).
  - If keeping the abstract idea, switch to `IcosahedronGeometry(0.10, 1)` — looks more like a polished crystal/wireframe model.
  - Add a small dimension annotation as a label (use SVG overlay or in-canvas text).

### E. The recommendation letter

- *Current:* thin paper sheet + 6 text-line slats.
- *Weak because:* the text-line slats look like a barcode at this scale. Paper is flat and stiff.
- *Directions:*
  - Replace text-line slats with a procedural texture: draw text lines on a canvas and apply as a map to the paper.
  - Add a signature mark as a small darker swirl in the bottom right of the canvas.
  - Slightly curl the paper edge via vertex deformation (lift the corner).
  - Add a folded crease line — a thin darker line across the middle suggesting it was folded.

### F. The coffee mug

- *Current:* cylinder body + half-torus handle + coffee circle on top + rim torus + black coaster.
- *Weak because:* the handle is a perfect half-torus — real mug handles flatten where they meet the body.
- *Directions:*
  - Add steam: 2-3 thin curved tubes rising and fading via vertex alpha, animated.
  - Add a "KM" or coffee-shop logo on the side as a canvas-texture decal.
  - Slight coffee surface ripple animated on a `time` uniform if you go to ShaderMaterial.

### G. The desk

- *Current:* single-pedestal furniture-grade desk (top, hem, drawer stack with handles, side panel, modesty panel hiding under-desk).
- *Weak because:* solid wood color — no grain texture. Drawer handles are small dark slats with no metallic feel.
- *Directions:*
  - Add wood grain via a procedural noise texture on `matWood.map`.
  - Add brass drawer pulls: small `TorusGeometry` half-rings in `matGold`.
  - Add a small inset (recessed handle pull) on each drawer face.
  - Add edge bevel via the rounded-box helper instead of sharp box edges.

### H. The chair

- *Current:* low-back chair backrest + two vertical posts + seat cushion box.
- *Weak because:* the chair backrest is just a flat rectangle — no curvature. Posts look like generic cylinders.
- *Directions:*
  - Curve the backrest: replace `BoxGeometry` with a `CylinderGeometry` open-ended segment.
  - Add an Aeron-style mesh look: subdivided plane with `TextureLoader` of a mesh pattern + alpha.
  - Add casters at the bottom: 5 small dark spheres on a star base.
  - Add seat depth and armrests (currently the character's arms float in front with nothing under them).

### I. The room (floor, backdrop, grid)

- *Current:* flat infinite floor + flat back wall + warm fog. Subtle GridHelper.
- *Weak because:* no environment, no depth. The character feels like he's in a cyclorama, not a room.
- *Directions:*
  - Add a window or framed art on the back wall (a textured plane with an image of an engineering diagram or city skyline).
  - Add a desk lamp on the desk corner (cylinder + cone shade + emissive bulb).
  - Add a houseplant: stylized stacked spheres or a `LatheGeometry` plant pot + a few leaf planes.
  - Replace the back wall with a `BoxGeometry` floor extension that fades into fog so distance reads more believably.
  - Add a baseboard at the wall-floor join.

### J. Lighting

- *Current:* 3-light portrait rig (key + fill + rim) + hemisphere ambient.
- *Weak because:* no specular highlight from any single visible light source — the scene feels evenly lit, not portrait-lit.
- *Directions:*
  - Add a window light: a separate `RectAreaLight` (Three.js r148 has it) coming from the left to motivate the key light.
  - Add a desk lamp emissive bulb that casts its own real light.
  - Bake an HDR environment map (`new THREE.PMREMGenerator`) for proper reflections on the metallic helmet — this would transform the helmet from "matte red" to "polished lacquer that reflects the room."

### K. Cameras and animation

- *Current:* CAM_A at `(0, 1.30, 3.80)`, CAM_B preset per prop. 4-beat pickup timeline, staggered camera dolly.
- *Weak because:* the third-person framing is dead-center symmetric; the camera never moves at rest.
- *Directions:*
  - Add subtle parallax: the camera drifts ±0.08 in x based on the cursor x position (already partly in `mousemove` setup).
  - Add a depth-of-field shader for the POV shots to blur the background — would make the prop hero "pop."
  - On idle, slowly orbit the camera ±2° to suggest a "live shot."
  - On pickup, briefly chromatic-aberration the screen edges via post-processing.

### L. POV overlays

- *Current:* 5 HTML overlay sections sharing a `pov__head` eyebrow, paper-grain SVG filter, CTA button system. Iron Man HUD has gold scrim boxes and SVG corner brackets + reticle + arc reactor.
- *What's strong:* this is the most-praised part of the build. The cream cards and Iron Man HUD have editorial-grade typography. Don't touch unless you have a strong reason.
- *Possible upgrades:*
  - Add 3D mockups inside the portfolio card (a tiny rotating preview of each project).
  - Add a typewriter reveal animation to the Iron Man HUD telemetry corners.
  - Sound design: a soft click on POV transition, a subtle hum during the helmet HUD.

---

## 6. Open challenges / things I couldn't solve

1. **Photo of Kambar isn't on disk.** The image lives in conversation context but isn't a file. To use it as a face texture, save it to `assets/img/kambar.jpg`.
2. **STL files can't be fetched from Thingiverse without auth.** Plan B: get the STL another way (3D-print community, free 3D model sites with direct downloads), save it locally, load via THREE.STLLoader (an example addon — must be included separately for r148).
3. **r148 tonemapping desaturates reds.** Switched from ACES → Cineon — this is why the helmet reads as red and not orange.
4. **ES module imports don't work on `file://`.** That's why we're stuck on r148's UMD build. If you ever serve this via a real HTTP server (GitHub Pages, Vercel, even `python -m http.server`), you can upgrade to r160 and pick up proper sRGB rendering for cleaner saturation.

---

## 7. The full current desk.html source

Copy-paste this into the new chat so it has the starting code:

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <title>Kambar Mangibayev — the desk</title>
  <meta name="description" content="An engineer at his desk. Pick something up to see the work." />
  <meta name="theme-color" content="#f4f1ea" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght,SOFT,WONK@9..144,300..900,0..100,0..1&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="assets/css/desk.css" />
</head>
<body>

  <!-- shared SVG noise filter for paper-grain texture, referenced by every cream card -->
  <svg class="pov__grain-defs" aria-hidden="true" width="0" height="0" style="position:absolute">
    <filter id="paperGrain">
      <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch"/>
      <feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.04 0"/>
    </filter>
  </svg>

  <div id="stage" aria-hidden="true"></div>

  <header class="hud hud--top">
    <span class="hud__brand">/ Kambar&nbsp;Mangibayev<sup>®</sup></span>
    <span class="hud__caption" id="caption">Pick something up</span>
    <a class="hud__skip" href="index.html">Skip → the index</a>
  </header>

  <button class="hud__back" id="back" hidden>← back to the desk</button>

  <section class="pov pov--portfolio" id="povPortfolio" hidden>
    <div class="pov__page">
      <div class="pov__grain" aria-hidden="true"></div>
      <div class="pov__head">
        <span>Portfolio</span>
        <span>01 / 15</span>
      </div>
      <h2 class="pov__title">Engineer at the seams &mdash; <em>vehicle systems, simulation, 3D printing &amp; CNC.</em></h2>
      <p class="pov__lede">An index of built things, at every scale I&rsquo;ve had the chance to build at. Open the full index for project case studies.</p>
      <a class="pov__cta" href="index.html">Open the index →</a>
    </div>
  </section>

  <section class="pov pov--helmet" id="povHelmet" hidden>
    <svg class="pov__hud-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
      <defs>
        <radialGradient id="arc" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="#fff" stop-opacity="1"/>
          <stop offset="40%" stop-color="#c7e6ff" stop-opacity=".9"/>
          <stop offset="100%" stop-color="#9cc6ff" stop-opacity="0"/>
        </radialGradient>
      </defs>
      <path d="M 80 60 L 240 60 L 280 100 L 280 220" fill="none" stroke="#d6a72a" stroke-width="1.4" opacity=".75"/>
      <path d="M 1360 60 L 1200 60 L 1160 100 L 1160 220" fill="none" stroke="#d6a72a" stroke-width="1.4" opacity=".75"/>
      <path d="M 80 840 L 240 840 L 280 800 L 280 680" fill="none" stroke="#d6a72a" stroke-width="1.4" opacity=".75"/>
      <path d="M 1360 840 L 1200 840 L 1160 800 L 1160 680" fill="none" stroke="#d6a72a" stroke-width="1.4" opacity=".75"/>
      <g transform="translate(1080 250)" stroke="#d6a72a" stroke-width="1.2" fill="none" opacity=".8">
        <circle r="60"/><circle r="40"/>
        <line x1="-72" y1="0" x2="-48" y2="0"/><line x1="48" y1="0" x2="72" y2="0"/>
        <line x1="0" y1="-72" x2="0" y2="-48"/><line x1="0" y1="48" x2="0" y2="72"/>
        <text x="68" y="-44" font-family="JetBrains Mono, monospace" font-size="10" fill="#d6a72a">STEREO LOCK</text>
        <text x="68" y="-30" font-family="JetBrains Mono, monospace" font-size="10" fill="#d6a72a">ML PERCEPTION</text>
      </g>
      <g transform="translate(360 650)" stroke="#d6a72a" stroke-width="1.2" fill="none" opacity=".7">
        <circle r="44"/><circle r="30"/><circle r="16"/>
        <line x1="-50" y1="0" x2="50" y2="0"/><line x1="0" y1="-50" x2="0" y2="50"/>
        <text x="-20" y="-54" font-family="JetBrains Mono, monospace" font-size="10" fill="#d6a72a">DEPTH MAP</text>
      </g>
      <circle cx="720" cy="120" r="34" fill="url(#arc)"/>
      <circle cx="720" cy="120" r="24" fill="none" stroke="#d6a72a" stroke-width="1.5" opacity=".9"/>
      <circle cx="720" cy="120" r="12" fill="#fff" opacity=".85"/>
      <g font-family="JetBrains Mono, monospace" font-size="11" fill="#d6a72a" opacity=".9">
        <text x="600" y="65">PWR 100%</text>
        <text x="820" y="65">FOV 165</text>
      </g>
      <g stroke="#d6a72a" stroke-width="1" opacity=".55">
        <line x1="690" y1="450" x2="710" y2="450"/>
        <line x1="730" y1="450" x2="750" y2="450"/>
        <line x1="720" y1="420" x2="720" y2="440"/>
        <line x1="720" y1="460" x2="720" y2="480"/>
        <circle cx="720" cy="450" r="1.8" fill="#d6a72a"/>
      </g>
      <g font-family="JetBrains Mono, monospace" font-size="10" fill="#d6a72a" opacity=".85">
        <text x="96" y="92">STEREO BASELINE 120MM</text>
        <text x="1224" y="92" text-anchor="end">FRAME 02 / 15</text>
        <text x="96" y="822">LATENCY 14MS</text>
        <text x="1224" y="822" text-anchor="end">BRAKE TORQUE Nm: ARMED</text>
      </g>
    </svg>

    <div class="pov__hud">
      <div class="pov__hud-head">
        <span>SEnS+ / ML&nbsp;Perception</span>
        <span>02 / 15</span>
      </div>
      <div class="pov__hud-corner pov__hud-corner--tl">STEREO BASELINE 120MM</div>
      <div class="pov__hud-corner pov__hud-corner--tr">FRAME 02 / 15</div>
      <div class="pov__hud-corner pov__hud-corner--bl">LATENCY 14MS &middot; CONFIDENCE 98.4%</div>
      <div class="pov__hud-corner pov__hud-corner--br">BRAKE TORQUE Nm: ARMED</div>
      <div class="pov__hud-center">
        <p>Stereoscopic camera detection wired into regenerative braking. Perception sitting inside the safety stack &mdash; not a notification, an action.</p>
        <a class="pov__hud-cta" href="work/sens-plus.html">Open the case study →</a>
      </div>
    </div>
  </section>

  <section class="pov pov--letter" id="povLetter" hidden>
    <div class="pov__paper">
      <div class="pov__grain" aria-hidden="true"></div>
      <div class="pov__head">
        <span>A letter</span>
        <span>03 / 15</span>
      </div>
      <span class="pov__monogram" aria-hidden="true">KM</span>
      <p>To whom it may concern,</p>
      <p>Kambar leads engineering work on vehicle systems &mdash; stability, hydraulics, perception, structural. He cares most about the moments where research has to become a product, and walks the line between safety and performance without falling off either side.</p>
      <p>The job is to find the line and not fall off either side. He finds it.</p>
      <p class="pov__signature">
        <span class="pov__signature-mark">K. Mangibayev</span>
        <span class="pov__signature-line">&mdash; Kambar, writing about himself in the third person</span>
      </p>
      <a class="pov__cta" href="index.html">See the work →</a>
    </div>
  </section>

  <section class="pov pov--cad" id="povCad" hidden>
    <div class="pov__cad">
      <div class="pov__grain" aria-hidden="true"></div>
      <div class="pov__head">
        <span>Structural &mdash; FEA pass 04</span>
        <span>04 / 15</span>
      </div>
      <h2 class="pov__title">Frame &mdash; <em>infinite-life under fatigue load.</em></h2>
      <ul class="pov__spec">
        <li><span>Mesh</span><span>1.2M tetra</span></li>
        <li><span>Max stress</span><span>148 MPa</span></li>
        <li><span>FOS (fatigue)</span><span>2.4</span></li>
        <li><span>Status</span><span>Infinite life</span></li>
      </ul>
      <a class="pov__cta" href="work/structural-frame.html">Open the case study →</a>
    </div>
  </section>

  <section class="pov pov--mug" id="povMug" hidden>
    <div class="pov__mug">
      <div class="pov__grain" aria-hidden="true"></div>
      <p class="pov__mug-line">Coffee&rsquo;s warm.</p>
      <p class="pov__mug-hint">click or <kbd>esc</kbd> &mdash; put it down</p>
    </div>
  </section>

  <div class="curtain" id="curtain">
    <div class="curtain__mark">
      <svg viewBox="0 0 220 80" xmlns="http://www.w3.org/2000/svg">
        <text x="0" y="62" fill="currentColor" font-family="Fraunces, serif" font-weight="500" font-size="72" letter-spacing="-3">KAMBAR</text>
      </svg>
    </div>
    <div class="curtain__count" id="curtainCount">building the desk &middot; 00%</div>
  </div>

  <!-- Three.js r148 still ships a global UMD build that works under file:// without a server. -->
  <script src="https://unpkg.com/three@0.148.0/build/three.min.js"></script>
  <script src="https://unpkg.com/gsap@3.12.5/dist/gsap.min.js"></script>
  <script src="assets/js/desk.js"></script>
</body>
</html>
```

---

## 8. How to prompt the new chat

> "I'm continuing work on a Three.js portfolio piece. Read HANDOFF.md in `C:\Users\kmangibayev\Desktop\Porotfolio\portfolio_v2\` for full context — the project, the architecture, what's done, and the per-object improvement roadmap. The focus is `desk.html` (and its assets/js/desk.js + assets/css/desk.css). Start with improving the character — section 5A in the doc. Use the same lane-discipline architecture as before: brief specialists, have them return code proposals, integrate sequentially, render screenshots, verify with a fresh agent before declaring done. Don't change tech stack (Three.js r148 UMD via file://). Begin."

The new chat will read this file and have the full context.
