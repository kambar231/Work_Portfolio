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

## 5. Palette and type (fill from studies; defaults if studies disagree)
Background warm off-white (Codex paper #f4f1e9), ink #182b2b, one accent (Codex teal #17685d)
and one warm accent for the cubes (Codex rust #ac482c) used sparingly. Cubes: 3 tints of the
paper plus one accent cube per chapter. Type: nirnor's pairing or General Sans + IBM Plex Mono.

## 6. Build phases (one implementer, one commit per phase, film each)
P1 Scaffold + cube scene: hero with sorted grid, float, cursor parallax, unravel on first scroll,
   fps check. Gate: film 30 frames, time-lapse at y=0, fps >= 50.
P2 Chapters 1 to 5 with FOCUS moves and text reveals. Gate: film, no overlap, copy grep.
P3 Raymond + previous experience (simple VCT loop) + other projects + websites + close.
P4 Reading panel, mobile, reduced motion, Lighthouse performance >= 85, click tests on all
   openers, writing-rules grep, every src exists. Then link from root nav "v2 preview".
Each phase: `git add -A && git commit -m "v2: <phase>" && git push`, report frames + hash.
