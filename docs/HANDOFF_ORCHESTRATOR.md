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

## State at handoff (updated 2026-09-06, round 4 shipped)
- origin/main = a6796e3 "v2: feature cube parks in the free band, label row clear". Round 4 was
  delivered against section 10 of docs/V2_SPEC.md (scrubbed cube motion, magnetic snap, hero
  portrait to dust, per-section cubes only, contact grid removed).
- Commit chain by area (round 4):
  - engine, v2/js/cubes.js: 8e6f6cb, 11a7974, 80931b4, bf1678b, 301e2d5, ae22b6b, 9ccca9e,
    a1054c1, ec8c0af, 67e1baf, 77b4b7e, a6796e3.
  - morph and hero portrait, v2/js/particles.js: 46b24a3, 928bc80, 36331a3, efd7dc4.
  - page, v2/index.html + css: af16a74, 33ab78d.
  - checker, v2/verify_all.py: f150d19, 3314f67, f0ab039, 85d5710, f666de9.
- Commit chain by area (round 3): origin/main was 5cd3d56 at the round-3 pivot; that chain was
  engine 25cfb6f..5cd3d56, morph 78fda50/a49c2aa, page 9ec27a0..588c112, checker c27d8d7..c3ccac5.
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

## Process that worked (round 4, 2026-09-06). Keep doing it this way.
- Commit with an explicit pathspec: `git commit -m msg -- <paths>`. The shared index races
  between agents, so staging only your own files keeps another agent's work out of your commit.
- Never message another agent. A message resurrects a stopped one (seen twice already). Report
  only to the lead.
- Builders verify with numbers only. One screenshot set and one full checker run happen per
  round, on the lead's ask, not per commit.
- Brief aesthetics by the look, not by ratios. Describe the intended feel and let the builder
  pick the exact numbers.
- Hard timeboxes with a lead-commit fallback: if a builder runs past its box, the lead commits
  what is green and moves on.
