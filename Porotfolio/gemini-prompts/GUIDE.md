# Gemini asset prompts — for the portfolio

Ten prompts, written to match the site's art direction (warm ink `#16130e`, burnt
orange `#e2531d`, paper `#ece4d6`, steel `#88a0ab`) and the **sense → decide →
respond** spine. Full strings live in `prompts.json`.

## Models (verified June 2026)
- **Stills:** `gemini-3-pro-image-preview` — the model in your example.
- **Video:** `veo-3.1-generate-preview` (8s, up to 1080p/4K, native audio). A faster
  variant is `veo-3.1-fast-generate-preview`. (Google's newer *Gemini Omni Flash*
  isn't generally available via API yet.)

## How to run
Paste each `prompt` into Google AI Studio (aistudio.google.com) or the Gemini API,
pick the matching model, and set the aspect ratio noted in the JSON. Generate a few
variants per prompt and keep the best.

## The set
| id | type | where it goes |
|----|------|----------------|
| origin-hero | image 16:9 | hero background (keep right 2/3 dark for text) |
| build-cut | image 16:10 | CNC feature / card |
| simulate-trace | image 1:1 | Double Pendulum viz / Simulate bg |
| deploy-sense | image 16:9 | beside the Raymond role |
| texture-layers | image 16:9 | seamless section background |
| build-loop-cnc | video 9:16 | Build viewport loop |
| build-loop-print | video 16:9 | 3D-printing card ambient loop |
| hero-orbit | video 16:9 | hero ambient / transition |
| signal-thread | video 16:9 | section transition (the sense/decide/respond motif) |
| deploy-clip | video 16:9 | Deploy — safety system in action |

## Then what
Drop the finished files into `site/assets/img/` (stills) or a new
`site/assets/video/` (clips) and tell me which goes where — I'll wire them in
(lazy-loaded, muted autoplay loops, poster frames, reduced-motion fallbacks) so the
page stays fast. The `simulate-trace` light-painting and `signal-thread` clip are the
two I'd prioritize — they're the most on-brand and the hardest to fake otherwise.

## Tips for staying non-generic
- Generate 3–4 variants and cull hard; the first output is rarely the best.
- Keep the single-warm-accent rule — if a result has extra colored glows, regenerate.
- Favor the shots that look like *real photography of real machines* over anything
  that reads as 3D render; that's what keeps it from looking AI-made.
