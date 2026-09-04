# Work_Portfolio — project instructions

Kambar Mangibayev's personal portfolio. Goal: finalize a **plain, list-style portfolio** fast by
iterating on it with Kambar's feedback. No design flourishes unless Kambar explicitly asks.

## Roles (hard rule)

- **Fable 5 (the main session) NEVER implements.** It audits, orchestrates, plans, and delegates.
  It does not write or edit HTML/CSS/JS/content files itself, even for one-line fixes, unless
  Kambar specifically tells it to in the current message.
- **All implementation is done by Opus 4.8 implementers** (`subagent_type: implementer`,
  model `claude-opus-4-8`, medium effort) for every task, unless Kambar says otherwise.
- Fable verifies implementer output itself (open the page, check the diff, check git log) and
  reports to Kambar. No Fable auditor subagents unless asked.

## Iteration loop (every iteration commits and pushes)

1. Kambar gives feedback on the current `index.html`.
2. Fable turns it into a precise brief and spawns ONE Opus 4.8 implementer.
3. Implementer edits, then **must** run:
   ```
   git add -A
   git commit -m "portfolio: <what changed>"
   git push
   ```
   An iteration that is not committed and pushed is not done.
4. Fable verifies (page opens, content intact, commit on `origin/main`) and reports the commit
   hash plus a one-line summary to Kambar.

Remote: `https://github.com/kambar231/Work_Portfolio` (branch `main`). Commit messages use the
`portfolio: ...` prefix. Never force-push. Never reset --hard.

## Structure

```
Work_Portfolio/
├── CLAUDE.md            # this file
├── .gitignore           # excludes 2.5 GB of raw phone video, AE autosaves, HEIC, huge PNGs
├── index.html           # THE portfolio. Plain list. Single file, no build step. (root = GitHub Pages)
├── assets/              # images/videos used by index.html (copied from Porotfolio/assets, curated)
└── Porotfolio/          # SOURCE MATERIAL from earlier attempts. Read-only reference, do not edit.
    ├── index.html + work/*.html + projects/*.html   # v1: editorial site; work/ = Raymond Corp
    │                                                # case studies, projects/ = RIT/personal projects
    ├── assets/img, assets/video                      # curated images + 3 mp4 reels (v1 assets)
    ├── portfolio_v2/                                 # v2: Obys-style index + Three.js desk scene
    │   ├── HANDOFF.md, HANDOFF_V2.md, STYLE_SOUL.md # project/bio facts live here too
    │   └── index.html, desk*.html, drawings.html
    ├── site/, site-v2/                               # cinematic scroll concept builds
    ├── concepts/CONCEPTS.md + 01..09/vN/index.html   # 9 design concepts, each with ABOUT.txt
    ├── files/, motor/, Slicer/                       # raw photos / screenshots
    └── gemini-prompts/                               # image-generation prompts (ignore)
```

Content source of truth for the plain portfolio: `Porotfolio/work/*.html` (6 Raymond Corp case
studies), `Porotfolio/projects/*.html` (9 projects), `Porotfolio/portfolio_v2/index.html` (15-project
list) and `Porotfolio/concepts/CONCEPTS.md` (identity, career arc). When sources disagree, prefer
the most specific/most recent text and flag the conflict to Kambar.

## Plain-portfolio rules

- One `index.html`, vanilla HTML + minimal CSS in a `<style>` block. No frameworks, no fonts from
  CDNs, no JS unless needed for something Kambar asked for.
- Layout: header (name, title, contact links) then a flat list of entries. Each entry = picture(s)
  on one side, text next to it. Text = title, one-line role/context, 2-5 sentence description,
  tools/stack line.
- All pictures from the source material that are relevant to an entry are included. Nothing lost.
- No hero animations, marquees, custom cursors, grain, parallax, theming, or "design choices".
  System font, black on white, readable at any width.
- No em dashes in copy (Kambar's global preference).

## Kambar's preferences that apply here

- Kambar reviews and gives feedback directly. Don't ask permission for routine edits; do them,
  commit, push, report.
- Track every directive in a multi-item feedback message; address all of them in one iteration.
- Report outcomes plainly with the commit hash and a Links block (local file path + GitHub URL).
