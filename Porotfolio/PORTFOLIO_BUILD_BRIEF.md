# Portfolio Build Brief — "Sense · Decide · Respond"
### A self-contained prompt + design spec for building Kambar Mangibayev's animated portfolio

> **How to use this file:** Paste the entire contents of this file as the prompt into a fresh Cowork session that has access to the folder `C:\Users\kmangibayev\Desktop\Porotfolio`. Everything needed to build is here — content, assets, story, tech, and the quality bar. The builder should NOT need to re-scrape the Wix site or re-investigate NRG.

---

## 0. The one-paragraph instruction (read first)

Build a single-page, scroll-driven cinematic portfolio website for **Kambar Mangibayev, Mechanical/Controls Engineer**, in a **new subfolder** at `C:\Users\kmangibayev\Desktop\Porotfolio\site\`. Model the *experience* on the reference site (NRG "Build Your Data Center"): a loading/"enter" reveal that plays like a video, then a scroll-locked narrative that assembles itself phase by phase, ending in an **interactive hub** the visitor can click to explore. Use **GSAP + ScrollTrigger + Lenis smooth-scroll** as the animation engine and **composite Kambar's real rendered assets** (image sequences, GIFs, screenshots) rather than hand-building 3D models. The through-line / "plot" is his own engineering philosophy, taken verbatim from his bio: systems that **sense, decide, and respond**. Deliverable must look premium on both desktop and mobile. Do not ship anything that looks low-poly, clip-arty, or template-y.

---

## 1. What we are copying from the reference site

Reference: `https://business.nrg.com/campaigns/build-your-data-center/`

Mechanics worth replicating (these are the "key points"):

1. **Cinematic intro gate.** A branded loading moment → a single "Enter" affordance → a hero line that animates in like the first frame of a film ("DATA DRIVES OUR WORLD"). We replicate this with Kambar's logo/name assembling and a hero statement.
2. **Scroll = playhead.** Scrolling does not just move the page; it *scrubs an animation*. Sections pin in place while content builds, then release. This is the single most important feel to nail.
3. **Phased narrative.** NRG promises "five simple phases" and shows a build coming together step by step with a persistent phase/progress indicator. We use the same structure — a fixed progress rail that tracks which phase you're in.
4. **Assembly metaphor.** Things get *built* on screen (parts arrive, connect, power on). We mirror this literally because Kambar is a builder (CNC, 3D printers, slicers).
5. **Interactive payoff at the end.** After the guided cinematic, it drops you into an explorable scene with clickable hotspots. We end on an **interactive project hub**: clickable cards/nodes for each project, plus resume and contact.
6. **Restrained, confident art direction.** Dark, high-contrast, generous negative space, one accent color, minimal but purposeful motion. No clutter.

What we are **NOT** copying: NRG's specific 3D data-center models, their corporate copy, or their exact color palette.

---

## 2. The story / "plot" (the spine of the whole site)

**Title concept:** *SENSE · DECIDE · RESPOND* — pulled directly from Kambar's bio line: "how systems sense, decide, and respond in the real world." This is the controls-engineering through-line and it doubles as the site's narrative engine: the page itself behaves like a control system booting up, taking input, and acting.

The visitor scrolls through a system coming online, in **five phases** (mirroring NRG's five), each phase mapping to a real chapter of his career:

| Phase | Label | Real content it carries | Assembly metaphor |
|------|-------|--------------------------|-------------------|
| **00 · BOOT** | *Power on* | Name + identity + the SENSE·DECIDE·RESPOND thesis | Logo/name self-assembles; system "initializes" |
| **01 · ORIGIN** | *Where the signal starts* | Semey, Kazakhstan → US (2016) → RIT | A line is drawn from a point on a map; foundation laid |
| **02 · FOUNDATION** | *Calibration* | BS + MEng Mechanical Eng @ RIT, controls concentration; research roles (AMPrint Center, Polymer-Based Lithography) | Layers stack / calibrate |
| **03 · BUILD** | *Hands on the metal* | The maker work: PrintNC CNC, Python 3D slicer/G-code pipeline, 3D printing | Machines assemble part-by-part (use the frame sequences here) |
| **04 · SIMULATE** | *Decide* | Analysis work: Double Pendulum, Vacuum Cannon, Flight Dynamics, Saturn V FEA | Plots/trajectories trace themselves on screen |
| **05 · DEPLOY** | *Respond* | Current role: Mechanical Systems Engineer @ The Raymond Corporation — pedestrian detection, automated braking, stability systems | The system "goes live" — sensors fire, vehicle responds |
| **— · HUB** | *Explore* | Interactive grid of all projects + Resume + Contact | Guided film ends; visitor takes control |

This arc is deliberate: **Origin → Foundation → Build → Simulate → Deploy** is a clean, legible story (immigrant-engineer journey that lands at a real, impressive job) AND it literally enacts sense→decide→respond. Keep it this simple. Do not add phases.

---

## 3. Recommended tech stack (and why) — the builder should follow this

**Decision on 3D models: do NOT hand-build 3D models in Three.js for the machines.** Rationale, because this matters most: Kambar's explicit fear is a final product that "looks trash." The single biggest risk factor for that outcome is amateur, hand-coded low-poly 3D of specific real machines — it almost never reads as premium. The reliably premium path is to **composite his real rendered assets** (he already has After Effects renders, a PNG frame sequence, GIFs, and clean screenshots) into scroll-driven 2D motion. Real imagery reads as professional; hand-built 3D of a CNC router does not. NRG's own "3D" feel is largely a **scroll-scrubbed image sequence on a `<canvas>`**, which is exactly the technique we'll use with Kambar's existing frame sequences.

**Stack:**

- **Framework:** Vite + vanilla JS/TS (or Astro). Keep it static and dependency-light so it opens by double-clicking / deploys to Netlify/Vercel/GitHub Pages with zero backend. Avoid Next.js unless the builder has a reason — this needs no server.
- **Smooth scroll:** **Lenis** (`@studio-freight/lenis` / `lenis`). Non-negotiable for the cinematic feel.
- **Animation:** **GSAP** + **ScrollTrigger** (pin, scrub, timelines). This is the core engine.
- **Hero "video" sequences:** scroll-scrubbed **`<canvas>` image-sequence** player (preload frames, draw frame indexed to scroll progress). Reuse the existing PNG frame sequence(s) and AE renders. This is how we get the "it renders, it runs through" feel without shipping a heavy MP4 or fragile 3D.
- **Optional single WebGL flourish (only if time + quality allow):** a subtle ambient particle/grid background or a data-flow shader using a lightweight lib (e.g., OGL or a tiny Three.js scene) — *ambient only*, never the literal machines. If it can't be made to look clean, cut it. Better to ship none than to ship a cheap one.
- **Type:** one strong typeface pairing (e.g., a technical grotesk like Space Grotesk / Inter for body, a mono accent like JetBrains Mono / IBM Plex Mono for labels/HUD readouts). Use a HUD/telemetry label treatment (small monospace tags like `PHASE 03 // BUILD`) to sell the "control system" concept.
- **Motion libs to avoid bloat:** no full page-builder frameworks, no jQuery, no template themes.
- **Accessibility/perf:** respect `prefers-reduced-motion` (provide a static fallback that still tells the story), lazy-load heavy frames, target Lighthouse perf ≥ 85 on desktop.

---

## 4. Art direction

- **Mood:** dark, cinematic, engineered. Think instrumentation panel meets architectural render.
- **Palette:** near-black base (`#0A0B0D`–`#101317`), off-white text, **one** electric accent (suggest a precise cyan/electric-blue `#3DDC97`-or-`#2D9CDB`-family, or Raymond-red if leaning into his employer — builder picks one and commits). Accent used only for emphasis, progress, and interactive affordances.
- **Texture:** subtle grid/blueprint lines, fine grain, thin 1px rules. Telemetry/HUD micro-labels in mono.
- **Motion principles:** ease-heavy, weighty, never bouncy/playful. Things settle like machined parts. One clear focal motion per scene — no competing animations.
- **Restraint:** lots of negative space. The reference site is confident and uncluttered; match that.

---

## 5. Section-by-section spec with FINAL COPY

> All copy below is from Kambar's live Wix portfolio and may be used verbatim or lightly tightened. Do not invent facts, employers, dates, or metrics.

### Contact / identity (used in BOOT + HUB + footer)
- **Name:** Kambar Mangibayev
- **Title:** Mechanical Systems Engineer · Controls
- **Email:** kambarmangibayev@gmail.com
- **Phone:** +1 585-309-94-67
- **Resume:** link/button (builder: wire to a resume file if present in folder, else placeholder button labeled "Resume")
- **Thesis line (hero):** "I build systems that sense, decide, and respond in the real world."

### Phase 00 · BOOT (hero)
Big animated wordmark "Kambar Mangibayev" / "SENSE · DECIDE · RESPOND". Sub: "Mechanical & Controls Engineer." A single "Enter" / "Scroll to explore" affordance. System-initializing micro-animation.

### Phase 01 · ORIGIN — About
> I'm a Mechanical Engineer originally from Semey, Kazakhstan — a city rich in history and known as the birthplace of Kazakhstan's greatest poets. I came to the United States in 2016 for high school and have called it home ever since.
>
> Outside of work, my number one hobby is engineering, so I get to come home from work to work. Besides engineering, I enjoy reading, 3D printing, sports, coding, machine learning and finances. I'm driven by curiosity, continuous learning, and meaningful collaboration.

(Optional visual: a clean line/arc from Semey → Rochester, NY on a minimal globe or map.)

### Phase 02 · FOUNDATION — Education & Research
- **Degree:** "I earned both my BS and MEng in Mechanical Engineering from the Rochester Institute of Technology, with a concentration in controls engineering — where I developed a strong interest in how systems sense, decide, and respond in the real world."
- **Additive Manufacturing Print Center @ RIT** | 05/23 – 12/24
  > Student Researcher at the AMPrint Center focused on advanced manufacturing — investment casting and ceramic 3D printing for functional components. Designed, prototyped and fabricated custom water nozzles, owning the workflow from CAD and additive manufacturing through investment casting, electroplating and post-processing. Supported PhD researchers on advanced lab equipment, experimental setup, and design iteration, using simulation and flow analysis to inform decisions.
- **Polymer-Based Lithography** | 06/20 – 09/20
  > Honors Summer Research on polymer-based lithography (during COVID), emphasizing simulation-driven analysis to reduce experimental overhead. Investigated correlations between lab results and simulation outputs to validate models and minimize physical lab runs, supporting a simulation-first workflow.

### Phase 03 · BUILD — Hands-on engineering (use frame sequences / renders here)
- **PrintNC — CNC Router**
  > I wanted a machine that could handle more than just wood, so I built the PrintNC — a hybrid using a heavy steel frame for rigidity and 3D-printed parts for precision alignment. Essentially an industrial-grade router you can build in a garage… or on the third floor of an apartment complex. (Don't tell my landlord.)
  - Asset: `files/PrintNC_cover2.png`, `motor/Screenshot 2026-01-17 122939.png`
- **3D Slicer & G-code Generator (Python)**
  > Architected a custom STL-to-G-code pipeline from the ground up — the foundation for a larger research initiative on support reduction via non-standard slicing angles. By replicating standard slicing mechanics in a custom Python environment, I gained total control over toolpath generation, a prerequisite for support-minimization algorithms off-the-shelf software can't accommodate.
  - Assets: `Slicer/Screenshot 2026-01-12 *.png`, `Slicer/Video Project.mp4`
- **3D Printing**
  > 3D printing started as a hobby and became a foundation for how I engineer: iterate fast, prototype early, learn by building. As a broke college student, every print felt like "printing with diamonds" — so each iteration had to count.
  - Assets: `Phone/IMG_8595####.png` frame sequence, `Phone/*.MOV`, `Side-view*.aep_AME/*.gif`

### Phase 04 · SIMULATE — Analysis & modeling (plots trace themselves)
- **Double Pendulum** — "A theoretical model of double-pendulum behavior under set initial conditions, validated against a physical build."
- **Vacuum Cannon** — "A simulation model approximating ping-pong-ball exit velocity for a vacuum cannon."
- **Flight Dynamics** — "Simulated 9 aircraft responses to varied conditions using Euler-angle and quaternion models in MATLAB + Simulink."
- **Saturn V — Finite Element Analysis** — "FEA in Ansys on the Rocketdyne F-1 engine nozzle (Saturn V / Apollo 11; 7.5M lb thrust) to verify no failure under operating stresses."

### Phase 05 · DEPLOY — Current role (the payoff)
- **Mechanical Systems Engineer — The Raymond Corporation** | 02/24 – Present
  > Design, implement and validate electromechanical and control systems for industrial vehicles. Led development of performance-stability and sensor-driven safety systems — including pedestrian detection and automated braking — delivering measurable gains in performance, energy efficiency and operational safety.
  - Asset: `files/Ray Logo New.png` (use tastefully; it's his employer's mark)

### HUB — Interactive explore (the end state)
A pinned interactive grid/constellation of clickable nodes: PrintNC · Slicer · 3D Printing · Double Pendulum · Vacuum Cannon · Flight Dynamics · Saturn V FEA · Raymond Corp. Each opens a panel/modal with the copy + asset above. Plus persistent **Resume** and **Contact** (email/phone). This is the "you can click on different parts" payoff.

---

## 6. Asset inventory (already in the folder) + prep steps

Folder root: `C:\Users\kmangibayev\Desktop\Porotfolio`

**Directly usable:**
- `files/Ray Logo New.png` — Raymond Corp logo (DEPLOY phase)
- `files/PrintNC_cover2.png` — CNC hero
- `motor/Screenshot 2026-01-17 122939.png` — motor/CAD render
- `Slicer/Screenshot 2026-01-12 *.png` + `Slicer/Video Project.mp4` — slicer project
- `Phone/IMG_8595####.png` — **numbered PNG frame sequence → use as the scroll-scrubbed canvas hero in BUILD** (this is the NRG-style "video" technique, already rendered)
- `Side-view.aep_AME/*.gif` + `*_##.png` — rendered side-view sequences (BUILD)
- `files/2022_Smart-Environment-Sensor_SEnS-Plus_Flyer*.jpg` — SEnS sensor flyer (optional, research/IoT context)
- `Phone/*.MOV` — short clips (optional background loops; compress first)

**Needs conversion before web use (builder should do this):**
- `*.HEIC` photos → convert to optimized `.webp`/`.jpg` (many in `Phone/`).
- `.MOV` → compressed `.mp4`/`.webm` (H.264/VP9), muted, short.
- `.aep` (After Effects projects) are NOT web assets — ignore them; use the already-rendered GIF/PNG outputs in the `*_AME` folders instead.
- Large PNGs → resize to max ~2000px, compress (squoosh/sharp).
- Create a clean `site/assets/` folder; copy in only the curated, web-optimized files. Do not reference originals scattered across the folder.

**Missing / to confirm with Kambar (don't block on these — use placeholders):**
- A real headshot (the `Phone/` HEICs may include one — verify).
- A current resume PDF to link from Resume button.
- Final accent-color preference and whether to lean on Raymond-red or a neutral cyan.

---

## 7. Build plan (recommended order for the executing Cowork)

1. Scaffold `site/` with Vite; install `gsap`, `lenis`. Set up base dark theme, type, grid.
2. Build the asset pipeline: convert HEIC/MOV, optimize images, drop curated set into `site/assets/`, generate the BUILD frame-sequence array.
3. Implement Lenis smooth scroll + a global ScrollTrigger timeline with a fixed phase-progress rail (00→05) and mono HUD labels.
4. Build BOOT hero (assemble wordmark + Enter affordance).
5. Build phases 01–05 as pinned scroll scenes, each with its copy + one focal motion; wire the BUILD canvas image-sequence to scroll progress.
6. Build the interactive HUB with clickable project nodes → modal panels; add Resume + Contact.
7. Add `prefers-reduced-motion` fallback, mobile layout pass, perf pass (lazy-load frames, compress).
8. Self-verify against the quality bar (Section 8). Take screenshots at desktop + mobile widths and review before declaring done.

---

## 8. Quality bar / acceptance criteria ("do not look trash" checklist)

- [ ] Scroll feels smooth and *scrubs* animation (Lenis active); no janky jumps.
- [ ] The intro reads like the first seconds of a film, not a generic hero.
- [ ] Each of the 5 phases has exactly one clear focal motion; nothing competes.
- [ ] Real rendered assets are used for BUILD (frame sequence), not hand-drawn shapes.
- [ ] **No** amateur low-poly 3D of machines. Any WebGL is ambient-only and clean, or absent.
- [ ] One accent color, consistent; generous negative space; HUD/mono labels sell the controls theme.
- [ ] Interactive HUB at the end actually works — every node opens correct content.
- [ ] Fully legible and good-looking on a phone (Kambar reviews from mobile).
- [ ] `prefers-reduced-motion` path still tells the full story statically.
- [ ] No spelling errors; all dates/employers/metrics match Section 5 exactly.
- [ ] Opens via `npm run build` → static output, deployable to Netlify/Vercel/Pages.
- [ ] Builder took desktop + mobile screenshots and visually reviewed them before finishing.

---

## 9. Hard constraints

- Keep it **one page**, scroll-driven. No multi-page routing needed.
- Keep scope tight — **5 phases + hub**, nothing more. Kambar explicitly does not want a long back-and-forth or bloat.
- Don't fabricate experience, numbers, or testimonials.
- Don't ship the raw originals; ship an optimized curated asset set.
- Output to `C:\Users\kmangibayev\Desktop\Porotfolio\site\`.

---

*End of brief. This file was generated from Kambar's live Wix portfolio content, the NRG reference site structure, and an inventory of the `Porotfolio` folder.*
