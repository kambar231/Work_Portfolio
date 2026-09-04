# Portfolio v2 — handoff for the next chat

Paste this whole file into a new chat. It is self-contained — the new agent will not have seen the prior conversation.

---

## 1. What this project is

Kambar Mangibayev — vehicle systems engineer, late 20s, Asian, broad shoulders, glasses, thick tousled black hair, wears suits — is building a personal portfolio at `C:\Users\kmangibayev\Desktop\Porotfolio\portfolio_v2\`. The portfolio has **two parallel entry experiences**:

- **`index.html`** — an Obys-agency-inspired editorial project index. Single custom serif (Fraunces), three view modes (Vertical / Horizontal / Grid), 15 projects. Recruiter-safe path.
- **`desk.html`** — a Three.js 3D scene of a stylized "you" sitting at a desk with five clickable props (portfolio, Iron Man helmet, CAD model, recommendation letter, coffee mug). Click a prop → 4-beat pickup animation → camera dollies into first-person POV → relevant project content overlay reveals. Creative-coder showpiece.

The desk's "Open the Index" CTA navigates to `index.html`.

`desk.html` is the active focus.

---

## 2. Tech stack — hard constraints

- **Three.js r148 core** via UMD global script. Chosen so `desk.html` works opened directly from disk (`file://`) without a server.
- **r147 examples/js for postprocessing** (`EffectComposer`, `RenderPass`, `ShaderPass`, `UnrealBloomPass`, supporting shaders). r148 removed `examples/js/` so we cross-pin: core at r148, post at r147. URLs are all live on unpkg and confirmed working. *Do not upgrade r148 without solving the file:// problem first.*
- **GSAP 3.12.5** for tweens, also UMD global.
- **No external 3D assets.** No STLs, no GLBs, no images for the scene itself. Everything is built procedurally from Three.js primitives. There is no portrait of Kambar on disk.

---

## 3. File map

```
portfolio_v2/
├── desk.html               # v1 of the desk scene (left in place as a safety net)
├── desk-v2.html            # v2 — current focus. Adds the post-processing script tags.
├── index.html              # Obys-style index (polished, don't break)
├── assets/
│   ├── css/
│   │   ├── desk.css        # v1
│   │   ├── desk-v2.css     # v2 (currently identical copy of desk.css)
│   │   └── styles.css      # Obys index styles
│   └── js/
│       ├── desk.js         # v1 — ~1585 lines
│       ├── desk-v2.js      # v2 — ~1700 lines. THE working file.
│       └── main.js         # Obys index JS
├── work/   projects/       # case study pages, untouched
├── HANDOFF.md              # original handoff (still applicable for project context)
├── STYLE_SOUL.md           # research + 90/10 plan for the Soul-inspired upgrade
└── HANDOFF_V2.md           # this file
```

---

## 4. What v1 (desk.js) was

A single-file Three.js scene with five sections in order: renderer → portrait-rig lighting (hemi + key + cool fill + cool rim) → MeshStandardMaterial palette (navy / red / gold / walnut / skin / hair / paper) → procedural floor, desk, chair, character (torso, lapels, tie, neck, head, face features, hair, 2 arms with mitten hands), 5 props in a `props` Group → raycaster + 4-beat GSAP pickup timeline → camera tween (staggered: focus leads, position +0.10s, FOV +0.15s) → POV overlay reveal → return-to-desk (faster, decisive). State machine: `idle | picking | pov | returning`. Cineon tone mapping. No env map. No post chain. Hands were mittens.

---

## 5. The Soul-inspired upgrade — what v2 changed

Read `STYLE_SOUL.md` for the full rationale and source citations. The thesis: most of the "this is a Three.js demo" feeling comes from rendering, not geometry. Soul (Pixar 2020) gives us a coherent rendering philosophy — stylized characters lit and graded with care, sitting in environments that feel painted, with PBR-real metals against toon-shaded skin and cloth.

Eight rendering changes plus one geometry change, in `desk-v2.js`:

1. **ACES Filmic tone mapping** (was Cineon).
2. **PMREM environment** baked from a tiny procedural scene of emissive colored planes — warm above, cool window-left, warm back, cool rim, dim floor bounce. Bound to `scene.environment` so all Standard materials reflect a room. Single biggest visual change for metals.
3. **MeshToonMaterial + 3-step gradient ramps** on skin / cloth / wood / paper. Metals (helmet red, helmet gold, drawer pulls, chair posts) stay PBR Standard. The mix is intentional — Soul's "stylized character / near-real environment" tension at a smaller scale.
4. **Inverted-hull back-face outlines** on the character group only. Not on props, furniture, or anything under 5 mm.
5. **Post chain**: `RenderPass → UnrealBloomPass(strength 0.35, threshold 0.85) → custom vignette + grain ShaderPass`. Last pass renders to screen. Bloom strength and vignette **tween up on POV entry** (helmet POV pushes hardest) and ease back on return — Soul's two-mode visual switch for free.
6. **Canvas value-noise roughness map** (3 octaves) shared across every Standard material. Kills the perfect-mirror highlight.
7. **Fresnel rim glow** via `onBeforeCompile` shader patch — warm on skin, cool on blazer and helmet red.
8. **Fake AO contact discs** under every prop (helmet, portfolio, cad, letter, mug). Character disc was already in v1.

Plus:

9. **4-finger + thumb hand rebuild** in `makeArm()`. v1 had mittens; v2 has a palm + four finger groups (pinky, ring, middle, index) each with a base segment, knuckle ball, and distal pivot group, plus an opposable thumb on a metacarpal joint. Per Soul's production: "hands are where the artist lives." The `distal` group on each finger is exposed via `userData` so future passes can animate per-finger curl (for the helmet grasp or mug clutch) without rebuilding geometry.

---

## 6. One real bug fixed while building (worth knowing)

Three.js r148's `Material.copy()` does **not** copy `onBeforeCompile`. So `matSkin.clone()` — used dozens of times — would have silently dropped the Fresnel rim patch. The fix is in `addFresnelRim()` in `desk-v2.js`: the helper monkey-patches the material's instance `clone()` method so every clone re-attaches the same `onBeforeCompile` callback and a matching `customProgramCacheKey`. The chain also patches clones-of-clones.

If you ever add new patched materials, use `addFresnelRim()` (or follow the same pattern). Don't set `material.onBeforeCompile` directly and then clone — the clones will look wrong.

---

## 7. What is NOT yet verified

- **Browser load.** Sandboxed Chromium kept segfaulting and the Claude-in-Chrome navigate tool mangles `file://` URLs. The file passes Node syntax check and a code-review pass, but it has not been opened in a real browser yet. Kambar's task is to open `desk-v2.html` and report what he sees.
- **Tuning by eye.** Once it loads, these may need to be dialed:
  - Bloom strength (currently `0.35`; bump to `0.45` if highlights look flat, drop to `0.25` if anything bleaches).
  - Outline thickness (currently `1.018` everywhere; bump to `1.022–1.025` if outlines look weak on small geometry, drop to `1.012` if heads look cartoony-cheap).
  - Fresnel intensities (currently warm-skin `0.45`, cool-blazer `0.30`, cool-red `0.25`).
  - Vignette default (currently `0.45`; up to `0.55` for more cinematic feel).

---

## 8. Architecture of `desk-v2.js` (so you know what to touch)

Top to bottom, all in one file, no modules:

1. Constants (colors, `$`, `lerp`)
2. Renderer (**ACES Filmic**, sRGB encoding)
3. Scene + gradient sky canvas + fog
4. Camera + `CAM_A` (third-person) + `CAM_B` (per-prop POV)
5. Lighting — hemi + key/fill/rim DirectionalLights (unchanged)
6. **PMREM env-map IIFE** — bakes a tiny envScene to a cubemap, binds to `scene.environment`
7. **`buildNoiseRoughness()`** — 3-octave value-noise canvas texture, shared
8. **`addFresnelRim()`** — onBeforeCompile patch + clone preservation
9. **`makeRamp()`** + ramps + Toon and Standard material palettes
10. `addEdges()`, `roundedBoxGeometry()`, `softBlockGeometry()` helpers (unchanged from v1)
11. **`makeContactDisc()`** — shared AO disc factory
12. Floor / backdrop / grid (toon)
13. Desk + chair (toon wood)
14. `buildFaceTexture()` (unchanged; held as a fallback)
15. Character group at `(0, -0.30, -0.85)` — same hierarchy as v1, but using toon materials
16. **`makeFinger()` + `makeArm()`** with palm + 4 fingers + thumb pivot
17. `setIdle()`
18. Props group — portfolio, helmet, cad, letter, mug (helmet + gold + metals stay PBR, rest are toon)
19. **Per-prop AO contact discs** IIFE
20. **`addOutlinesToGroup()` and the call on the character** — inverted-hull back-face outlines
21. Raycaster + state machine + cursor
22. **Post-processing setup** — `EffectComposer`, `RenderPass`, `UnrealBloomPass`, custom `VignetteGrainShader` ShaderPass
23. `tweenCamera`, `triggerPickup` (now tweens bloom + vignette), `returnToDesk` (eases them back)
24. POV overlay show/hide
25. `ambientIdle` (breathing + head sway, unchanged)
26. `tick()` — calls `composer.render()` instead of `renderer.render(scene, camera)`
27. Resize — composer + bloom setSize
28. `dismissCurtain`, debug globals (`__scene__`, `__camera__`, `__composer__`, `__bloom__`, `__vig__`, `__pickById`, `__backToDesk`), boot

---

## 9. How to brief the new chat

Drop the new agent this prompt:

> I'm continuing work on a Three.js portfolio piece (`desk-v2.html` + `assets/js/desk-v2.js` + `assets/css/desk-v2.css`) at `C:\Users\kmangibayev\Desktop\Porotfolio\portfolio_v2\`. Read `HANDOFF_V2.md` for full context — what the project is, the v2 Soul-inspired render upgrade we just shipped, the file structure, and what's not yet verified. Then read `STYLE_SOUL.md` for the rendering rationale and source citations. Don't change the tech stack (Three.js r148 UMD core, r147 examples/js post, file:// safe, no external assets). Begin by helping me [the thing you want next].

Tell the agent **specifically** what you want next. Some likely directions:

- **"Open desk-v2.html in a browser and walk me through what I'm seeing — does the toon shading + outlines + bloom land?"** Best first move if you haven't loaded it yet.
- **"Tune the rendering parameters by eye"** — bloom strength, outline thickness, Fresnel intensities, vignette depth. Section 7 above lists the dials.
- **"Animate per-finger curl on pickup"** — the `userData.fingers[i].userData.distal` group on each finger is the pivot to rotate during the REACH and LIFT beats so the hand wraps around the prop instead of staying flat.
- **"Polish the head"** — currently a scaled sphere. With toon shading + outlines + rim it may already read fine; or it may need a LatheGeometry profile per Section 5.A of HANDOFF.md.
- **"Add a desk lamp"** — Soul's lighting philosophy is "practicals first, key/fill second." A desk lamp with a real PointLight motivates the existing warm key and would lift the scene.
- **"Polish the Iron Man helmet"** — under PMREM env it should now reflect a room. If the silhouette still reads weakly, the directions in HANDOFF.md §5.B still apply (more vertices on the faceplate Shape, horn detail, slight 0.15 rad y-tilt to show the 3/4 view).

---

## 10. Lane discipline (works well with this project)

In the v1 work and this v2 push, the cleanest pattern has been: brief a research specialist agent → get a concrete code proposal back → integrate sequentially → render screenshots → verify with a fresh code-review agent before declaring done. Outline-thickness wars start when multiple changes land together without a screenshot between them. One change → look → next change.
