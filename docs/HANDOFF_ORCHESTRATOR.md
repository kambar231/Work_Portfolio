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

## State at handoff (updated 2026-09-06, round 3 pivot shipped)
- origin/main = 5cd3d56 "v2: raymond park centred and on-screen, grid labels under each
  cube". Round 3 was delivered through the pivot in section 9 of docs/V2_SPEC.md.
- Commit chain by area (round 3):
  - engine, v2/js/cubes.js: 25cfb6f, a8647b7, 930e80d, fa697b9, cd093c6, 5a8d861, 3b3799f,
    0141e7b, 2247c47, e5ce0f5, 8b43245, 5cd3d56.
  - morph, v2/js/particles.js: 78fda50, a49c2aa.
  - page, v2/index.html + css + projects.json: 9ec27a0, 4162307, 107b268, 763a050, d55f98d,
    b387422, 588c112.
  - checker, v2/verify_all.py: c27d8d7, 6b802cf, c318905, e9a6f39, 7160d8e, df8a756, 8258235,
    4525ac0, 436cf25, 92a60d7, c3ccac5.
- The last full checker table is in the lead's report. Do not invent results.
- Open items still waiting on Kambar: CubeSat and CatBot images, the forklift 3D model, and a
  clear cast-part photo. Five of the six Raymond faces use the forklift placeholder image
  until those assets arrive.

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

## Process that worked (round 3, 2026-09-06). Keep doing it this way.
- Fan out by file, one owner per file, no shared writes.
- Report only to the lead. Never message another agent: a message resurrects a stopped agent,
  which happened twice today.
- Builders verify one feature per commit with one targeted check.
- The checker runs only on the lead's ask.
- The lead reviews frames of the final wave states only.
- Per-frame section state is derived from the scroll position. ScrollTrigger onEnter and
  onLeave do not fire on discrete jumps.
- Positions are measured at spring rest.
