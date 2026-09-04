# VERSIONS — Kambar Mangibayev Portfolio

**The rule:** nothing here is ever overwritten or deleted. Every design is an
immutable, dated snapshot. New work goes in a **new folder**. To iterate on a
design, we copy it to the next `vN` and edit the copy. If you ever say
"go back to that one," it's still here — find it in the table below.

_Last updated: 2026-06-17_

---

## How it's organized

- `concepts/` — each distinct portfolio **direction** gets its own folder
  (`concepts/01-control-loop/`, etc.). Inside, iterations are `v1/`, `v2/`, …
- Existing builds below stay exactly where they are; this file just indexes them.
- Each snapshot folder gets a tiny `ABOUT.txt` saying what it is and its date.

---

## Existing work (preserved)

| Path | What it is | Status |
|------|-----------|--------|
| `portfolio_v2/drawings.html` | **KM-26 "Drawing Set" — REV D** (8 sheets: cover → 5 flagships → index → contact; self-drawing control-loop hero). Current. | ✅ active |
| `portfolio_v2/drawings.REV-E-fourchapters.backup.html` | KM-26 **REV E** (four life-chapters + step-response hero). Backed up before reverting to REV D. | 🗄 archived |
| `portfolio_v2/index.html` | Editorial index variant | 🗄 archived |
| `portfolio_v2/desk.html`, `desk-v2.html` | Early 3D "engineer's desk" experiments (Three.js) | 🧪 experiment |
| `site/` | Cinematic scroll build v1 (per `PORTFOLIO_BUILD_BRIEF.md`) — GSAP/Lenis, real assets | 🗄 prior build |
| `site-v2/` | Cinematic scroll build v2 (latest of that line) | 🗄 prior build |
| `index.html` (root) | Original landing page | 🗄 archived |
| `PORTFOLIO_BUILD_BRIEF.md` | The 5-phase "SENSE·DECIDE·RESPOND" cinematic brief | 📄 spec |
| `STORYBOARD.md` | "The Bench" workshop storyboard | 📄 spec |
| `gemini-prompts/` | Photoreal asset recipe + prompts (`REALISTIC_RECIPE.md`, `prompts.json`) | 🧰 assets |
| `work/`, `projects/`, `motor/`, `Slicer/`, `Phone/`, `files/`, `assets/` | Source content, screenshots, renders, frame sequences | 🧰 assets |
| `Side-view*.aep`, `*.aep_AME/` | After Effects projects + rendered GIF/PNG outputs | 🧰 assets |

---

## Concept explorations (new — this session)

| # | Direction | Folder | Latest | Status |
|---|-----------|--------|--------|--------|
| 01 | The Control Loop (live feedback system) | `concepts/01-control-loop/` | `v1/` | ✅ v1 built & verified |
| 02 | Sense·Decide·Respond — Cinematic Boot | `concepts/02-cinematic-boot/` | `v1/` | ✅ v1 built & verified |
| 03 | The Bench / Workshop | `concepts/03-the-bench/` | `v1/` | ✅ v1 built & verified |
| 04 | Engineering Terminal / KambarOS | `concepts/04-terminal-os/` | `v1/` | ✅ v1 built & verified |
| 05 | Editorial Kinetic | `concepts/05-editorial-kinetic/` | `v1/` | ✅ v1 built & verified |
| 06 | Mission Control / Telemetry | `concepts/06-mission-control/` | `v1/` | ✅ v1 built & verified |
| 07 | The Workbench (01 Control Loop × 03 The Bench) | `concepts/07-the-workbench/` | `v1/` | ✅ v1 built & verified |
| 08 | The Toolbox (Stephen King metaphor; drawers → tools → builds) | `concepts/08-the-toolbox/` | `v1/` | ✅ v1 built, audited 8/10 |
| 08 | The Toolbox — "dark garage, you hold the light" (cursor lamp) | `concepts/08-the-toolbox/` | `v2/` | ✅ v2 built & verified |
| 08 | The Toolbox — fully lit (flashlight removed), drag drawers + tools | `concepts/08-the-toolbox/` | `v3/` | ✅ v3 built & verified |
| 09 | ⭐ The Workshop — blend of 07 (warm) + 08 (interactive toolbox) | `concepts/09-the-workshop/` | `v1/` | ✅ v1 built & verified — **current lead** |

See `concepts/CONCEPTS.md` for the full write-up of all six.

---

## Changelog

- **2026-06-17** — Reverted KM-26 to REV D; backed up REV E. Set up this versioning
  system. Spawned parallel research + ideation agents; wrote the 6-concept brief.
  Built **all six concepts** as self-contained v1 pages (01 Control Loop, 02 Cinematic
  Boot, 03 The Bench, 04 Terminal/KambarOS, 05 Editorial Kinetic, 06 Mission Control).
  Each rendered in a headless browser, desktop + mobile, with zero console errors.
  All are immutable v1 snapshots — next iterations go to `v2/`.
- **2026-06-17 (later)** — Combined the two favorites (01 Control Loop + 03 The Bench)
  into **Concept 07 — The Workbench**. De-AI'd it: switched to Kambar's own palette
  (ink #16130e / ember #e2531d / steel #88a0ab / lamp brass), Fraunces + Plex Mono,
  film grain + lamp glow + vignette, and human copy in his voice (no "scroll to
  explore"). Pulled REAL project photos from the folder, warm-graded to one filmic
  world (`07-the-workbench/v1/assets/`). Live RK4 double-pendulum is the "soul";
  step-response reveals carry the control-loop DNA. Copy preserved in
  `07-the-workbench/v1/copy.md`. Rendered desktop + mobile, zero console errors.
- **2026-06-22** — Built **Concept 08 — The Toolbox** (new revision, 07 untouched):
  the Stephen King *On Writing* toolbox metaphor — five metal drawers (most-used on
  top) that pull open to reveal the TOOLS in each tray and the PROJECTS built with
  them. Ran parallel agents: (1) deep research into AI-design "tells" to avoid vs.
  award-winning patterns to emulate → a 10-point anti-AI rubric; (2) King-toolbox
  research + a tray taxonomy mapping Kambar's toolkit. Type: Archivo + Fraunces +
  Plex Mono; his warm palette; real warm-graded photos; live pendulum + step
  responses. A critic agent audited the render (8/10, passed the "could-be-anyone"
  test); fixed hierarchy (featured flagship card), contrast, image brightness,
  metal texture, steel/brass accents, mobile glyph. Verified desktop + mobile.
- **2026-06-22 (later)** — Feedback: v1 "looks AI, not interactive enough." Built
  **08 The Toolbox v2** (interaction-first; v1 kept intact): "dark garage, you hold
  the light" — the cursor is a warm tungsten inspection lamp revealing a dark teal
  (CineStill) workshop. Real interactions: DRAG drawers open (pointer + momentum +
  snap, not a click accordion) and PICK UP a tool, DROP it in the vise to reveal the
  projects built with it. Plus live ambient pendulum, step-response detail, a "hit
  the lights" toggle, and a touch/reduced-motion fallback (lamp off, tap to
  open/use). Verified: lamp reveal, drawer drag, and tool→vise load (3 projects) all
  working; zero console errors.
- **2026-06-22 (later)** — Feedback: "remove the flashlight effect." Built **08 v3**
  (v2 kept intact): removed the cursor-follows inspection lamp (#dark/#warm/#halo +
  light JS + "hit the lights" toggle + crosshair). Scene is now fully lit on the dark
  teal base with a soft STATIC warm glow + vignette. Drag-open drawers and
  drag-tool-to-vise retained and re-verified (loads 3 projects; zero console errors).
- **2026-06-22 (later)** — "Make it something between v8 and v7." Built **Concept 09 —
  The Workshop** (new folder; 07 and 08 untouched): took 08/v3's interactive toolbox
  (drag drawers, drag tool→vise) and re-skinned it into 07's WARM world — warm ink
  #15110c, ember, brass, bone, with steel-blue #88a0ab as the cool accent; soft static
  warm lamp glow + vignette (no flashlight). Retitled "The Workshop" (bench + toolbox).
  Live pendulum + step responses kept. Verified desktop + mobile; tool→vise loads 3
  projects; zero console errors. Current lead.
