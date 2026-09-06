# Orchestrator handoff, Work_Portfolio (written 2026-09-06 by the outgoing Fable lead)

Read in this order: CLAUDE.md (roles, loop), docs/V2_SPEC.md (sections 7 and 8 are the live
spec), this file, then `git status` and `git log --oneline -8`.

## What this project is
Kambar Mangibayev's portfolio. Two pages, both live on GitHub Pages (repo public):
- Classic: https://kambar231.github.io/Work_Portfolio/ (root index.html). Frozen. Only allowed
  edit was the "New version" nav link.
- v2 (the one Kambar cares about): https://kambar231.github.io/Work_Portfolio/v2/ . nirnor.jp
  inspired: white page, de Jong attractor particle field that morphs into a forklift, a slice
  stack and a cube outline; eight photo-textured Three.js cubes that float, park, form grids and
  unfold into their faces. Stack: Three r163 + GSAP ScrollTrigger + Lenis via jsdelivr import
  map, no build step. Files: v2/index.html, v2/css/site.css, v2/js/{main,cubes,particles,
  chapters,vct}.js, v2/data/projects.json, v2/assets/{cubes,img,shapes,web}.
- Viewing: NEVER file://. Double-click `Open portfolio.bat` (serves on :8790 and opens /v2/) or
  use the live URL. Kambar has been bitten by this three times.

## Roles and process (Kambar's rules, binding)
- The lead (Fable) never implements. One Opus 4.8 implementer (`subagent_type: implementer`)
  at a time on v2/ (single shared file set; never two writers). Lead writes micromanaged briefs
  with exact numbers, reviews frames itself (a contact sheet or 2 frames, not 20), runs the
  checker itself, reports commit hash + Links block. Kambar reviews on localhost:8790.
- Every round commits and pushes. Commit prefix "v2: ...".
- Kambar's complaint on 2026-09-06: too many fix rounds. Rule now: the checker is the gate
  (implementer must pass it before reporting); batch all observations into one brief; no
  per-item follow-ups; if a round passes 20 min ask for a status line.
- Writing rules: docs/WRITING_RULES.md (no em dashes, banned words, no intern/co-op). Grep gate.

## The checker (run before accepting anything)
`python v2/verify_all.py` from the repo root. Starts its own server, films every 200 px into
docs/v2-film/full/, asserts per position: no cube-cube overlap (inscribed footprint), no cube on
text, no open unfold, no horizontal overflow, zero console errors; fps median >= 55 on GPU
(headful); 8-cube click test; 19 reading-panel test; contact grid slots within 6 px. Takes ~5
minutes. Round 3 extends it (no-pop <= 14 px/frame, min opacity 0.98, panel-scroll test).

## State at handoff
- origin/main = 43e3aa8 (part 4 additions). Checker ALL PASS at that commit (lead-verified).
- IN FLIGHT: implementer `v2-r2p2` was sent the ROUND 3 brief (spec section 8) as three commits:
  A "v2: cube motion engine", B "v2: experience with Raymond cube, morph timing, panel scroll",
  C "v2: baked unfold faces, seam removed". If this session ended, that implementer is dead.
  Check `git status`: uncommitted changes in v2/ are its WIP. Do NOT discard; spawn a fresh
  implementer with the section-8 spec and tell it to `git diff`, read every hunk, and continue
  (this exact recovery worked once already on 2026-09-06).
- Kambar's round-3 asks, verbatim summary (all approved, "go ahead and cook"):
  1 cubes never pop or reappear, always float (build a motion engine; springs, forces, exits
    past the edge instead of hiding). 2 cubes are almost always dimmed because text is in front:
    route around text lanes instead of dimming; only important cubes stay near. 3 forklift and
    slicer stack too far right (centre at 62vw) and transitions too abrupt: forklift holds to the
    end of experience and crossfades into the slice stack. 4 reading panels cannot scroll
    (Performance Stability): fix + test. 5 a dedicated Raymond cube flies in, parks, unfolds with
    the six systems on its faces instead of the list; each face opens its panel (two cubes 3+3 is
    the fallback). 6 BorgWarner and Boston Beer move lower. 7 projects cubes laggy/jittery
    (repulsion oscillation): engine fix. 8 unfolded cube shows cards with different pictures in
    front of the faces, and each open face has a diagonal triangle seam: bake content into the
    face textures, delete the cards, remove the seam.

## Open items (need Kambar's material, nothing to do until he sends it)
- CubeSat and CatBot images (placeholder slots exist on both pages).
- Forklift 3D model (Google image-to-3D output; not on this machine, searched thoroughly).
- Clear cast-part photo for Investment Casting (the only one on disk is black).

## Lessons that cost time here
- Opening index.html from disk shows only text: module scripts and fetches are blocked.
- Fixed panel inside an element with will-change/transform gets trapped (caused a scroll
  freeze on the classic page). Keep panels at body level, no transformed ancestors.
- Never create a junction into assets/ for filming; serve the repo root instead.
- The webgen film tool scrolls with window.scrollTo, which does not drive Lenis/ScrollTrigger:
  film through the page's own Lenis (the implementers have scripts; verify_all.py does this).
- Headless Chromium falls back to SwiftShader: fps numbers only count from a headful run on the
  RTX 5070 Ti. verify_all.py detects the renderer string.
- Lead review of frames found real defects the implementers' own gates missed every round
  (overlaps, wrong cube parked, empty forklift, cards missing). Keep looking at 2 to 3 frames
  per commit; contact sheets via ImageMagick montage keep the token cost low.

## Reference docs
docs/V2_SPEC.md (binding spec, sections 1 to 8), docs/NIRNOR_STUDY.md (measured reference),
docs/PLEURAT_ANIMATIONS.md, docs/CODEX_VS_OURS.md (abandoned direction), docs/WRITING_RULES.md.
Tools: C:\Users\kmangibayev\Code\Tools\webport\webgen.py (film/shot/serve), Playwright installed.
Memory: ~/.claude/shared-memory/work-portfolio-project.md.

## Efficiency post-mortem (Kambar, 2026-09-06: "something makes it very slow"). Do it differently.
What happened: one implementer at a time, briefs of 5 to 8 features each, filming + Playwright
tests + the 5-minute checker inside every round, lead review only after the whole part, so every
part cost two rounds of 30 to 60 min.
Run round 3 and everything after like this instead:
1. FAN OUT BY FILE, one owner per file, all in parallel, no shared writes:
   - engine agent: v2/js/cubes.js only (motion engine, unfold rig, baked-face textures)
   - morph agent: v2/js/particles.js only (forklift/slicer centring, hold, crossfade)
   - page agent: v2/index.html, v2/css/site.css, v2/data/projects.json (experience layout,
     Raymond cube markup hooks, BorgWarner/Boston band, panel scroll CSS)
   - checker agent: v2/verify_all.py only (no-pop, min-opacity, panel-scroll, seam crops)
   Interfaces are already there: cubes.setTargets/setState/focus, particles uMorph uniforms,
   main.js wires them. main.js is lead-arbitrated: only one agent may touch it per wave.
2. ONE FEATURE PER BRIEF, 10 to 15 minutes of work, pushed as soon as its own file is green.
3. Verification runs in parallel by the checker agent against the integrated tree, not by each
   builder. Builders only run the fast file-level checks (node --check, a single screenshot).
4. Lead reviews 2 frames per wave WHILE agents work (ask for an early screenshot at 5 min), so
   fixes land in the same wave. No separate fix rounds.
5. Timebox: any agent silent for 10 min gets a status ping; 20 min gets stopped and its WIP
   handed to a fresh one (WIP stays on disk; never discard).
