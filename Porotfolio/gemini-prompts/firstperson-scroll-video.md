# First-Person Scroll Video — Gemini / Veo 3.1 Prompt Pack
### Kambar Mangibayev · hands-only desk POV, scroll-scrubbed

---

## 0. Read this first (how it actually works)

- **Clip length:** Veo 3.1 makes **4 / 6 / 8-second** clips, not one long take. You build the
  "continuous" feel with **Scene Extension** — it seeds the next clip from the **last ~1 second**
  of the previous one, so motion/lighting/hands carry over. Chain the 8 shots below in order;
  cumulative length can reach ~140s.
- **Consistency = "Ingredients to Video":** attach your reference photo (for skin tone + hands) to
  **every** shot, and paste the **MASTER INGREDIENTS** block at the top of **every** prompt.
  Only the *action* and *camera* should change shot to shot. You can attach up to 3 reference
  images per shot — use: (1) your hand/skin photo, (2) a desk/lighting still once you like one,
  (3) the relevant project photo for that beat.
- **Aspect ratio:** generate **16:9, 1080p** for the desktop site (request 4K if available, then
  downscale). Optionally also a **9:16** pass for mobile.
- **Make it scrub well:** ask for *slow, steady, continuous forward motion, locked exposure, no
  hard cuts, no fast whip-pans*. Jittery clips scrub badly. On the website the video's
  `currentTime` is mapped to scroll position (frame-accurate scrubbing), so smooth + evenly paced
  wins over flashy.
- **The fax/contact ending is half video, half website.** Veo can't capture the *viewer* typing
  their number. So: the video shows your hands feeding the portfolio into the fax and the machine
  going to a "READY TO SEND" state; the **website overlays the real contact form**; on submit, play
  a short "fax transmitting → confirmation slip prints" clip. (Shots 7–8 below are written for this.)

---

## 1. MASTER INGREDIENTS  (paste at the top of EVERY shot prompt)

> **Style & character (keep identical across all shots):** Photorealistic first-person POV, as if
> the viewer is looking through my own eyes down at a workbench — *only my two hands and forearms
> ever enter the frame, never my face or body.* Hands and skin tone must match the attached
> reference photo exactly (medium skin tone, adult male hands, short clean nails, no rings, sleeves
> rolled to the forearm). One continuous unbroken take, camera locked at seated eye height with a
> tiny natural head-sway, slow and steady. Warm tungsten desk lamp as the key light, cool shadows
> falling off into a dark workshop (CineStill 800T look: warm highlights, slightly teal shadows,
> gentle halation around the lamp), shallow depth of field, fine 35mm film grain, 50mm lens feel.
> The desk is a **clean, uncluttered engineer's working desk** — a low-profile keyboard and two
> monitors at the back, and only a few essentials within reach (a pair of calipers, a mechanical
> pencil, a small notebook). Nothing busy or messy; everything has its place. The desk surface is a
> **green self-healing cutting mat** printed with a fine white measuring grid (cells) and angle
> guides at 30/45/60°. Movements are deliberate and unhurried. No on-screen text unless specified.
> 16:9, 1080p.

---

## 2. THE 8 SHOTS  (generate in order; use Scene Extension to chain each to the next)

### SHOT 1 — Hands arrive · the forklift (Raymond)
> [MASTER INGREDIENTS]
> **Action:** My hands enter the frame from below holding a small die-cast reach-truck / forklift
> model. I rotate it under the lamp, my thumb flicks a tiny black sensor module mounted on its mast
> (a pedestrian-detection camera), I snug a tiny screw with my fingertips, then give the mast a
> light test-nudge so a wheel spins. I set the forklift down to the LEFT edge of the desk and let
> go. **Camera:** static, looking down at the desk, slight sway. **Audio:** quiet shop-room tone,
> a soft mechanical click. End with the forklift resting left and both hands lifting away.

### SHOT 2 — The poster fills the screen (all projects)
> [MASTER INGREDIENTS]
> **Action:** My hands reach forward, take a large rolled blueprint poster and unroll it toward the
> camera until the paper completely fills the frame. The poster is a warm off-white engineering
> sheet, header reading "KAMBAR MANGIBAYEV — SELECTED WORK", with a neat grid of project panels
> (forklift safety system, CNC router, 3D-printed parts, flight-dynamics plots, a double pendulum,
> a Saturn V nozzle, a cast metal part). **Camera:** slow push as the paper rises to fill the
> screen. End on the poster filling 100% of the frame, held steady. *(Website swaps in the real
> hi-res poster at this moment.)*

### SHOT 3 — Lower poster · 3D prints, the cast part, the CNC part
> [MASTER INGREDIENTS]
> **Action:** My hands lower the poster down and to the right, revealing the desk again. One by one
> I pick up and turn under the light: a 3D-printed bracket, a small 3D-printed gear, and a sleek
> 3D-printed MagSafe phone stand — setting each in a row. Beside them I tap a shiny
> electroplated cast-metal water nozzle and a CNC-milled aluminum block. **Camera:** static,
> following my hands with tiny reframes. End with hands moving toward the back of the desk.

### SHOT 4 — Turn up to two monitors
> [MASTER INGREDIENTS]
> **Action:** The view tilts and turns up from the desk surface to reveal TWO monitors at the back
> of the bench. The LEFT monitor wakes showing a code editor / IDE. The RIGHT monitor wakes showing
> an engineering simulation. My hands come to rest on a keyboard and mouse. **Camera:** one smooth
> continuous turn/tilt up, no cut. End framed on both screens with hands on the desk.

### SHOT 5 — Dive into the CODING screen (slicer / G-code)
> [MASTER INGREDIENTS]
> **Action:** My right hand moves the mouse; the camera pushes slowly toward the LEFT monitor until
> its screen fills the frame: a custom Python 3D-slicer UI with an STL model, scrolling G-code, and
> toolpaths drawing layer by layer. **Camera:** slow dolly-in to the screen. End with the screen
> filling the frame. *(Website can overlay real slicer screenshots here.)*

### SHOT 6 — Dive into the SIMULATION screen (flight / pendulum / FEA / litho)
> [MASTER INGREDIENTS]
> **Action:** The camera eases back from the left screen and turns to the RIGHT monitor, then
> pushes in until it fills the frame, cycling through engineering sims: aircraft attitude/response
> plots, a chaotic double-pendulum trace, a Saturn V F-1 nozzle FEA stress map (red/orange heat),
> a vacuum-cannon velocity plot, and a molecular-dynamics lattice (polymer lithography).
> **Camera:** pull-back, turn, dolly-in. End on the sim screen filling the frame.

### SHOT 7 — Gather the portfolio · feed the fax
> [MASTER INGREDIENTS]
> **Action:** The camera returns to the desk. My hands gather a small stack of printed portfolio
> pages, tap them square on the desk, and feed the stack into a vintage-style fax machine sitting on
> the bench. The rollers pull the top page in; a small status light blinks amber. **Camera:** static
> on the fax. End on the fax's little keypad/screen with a hand hovering over it.

### SHOT 8 — "Ready to send" → contact (website takeover)
> [MASTER INGREDIENTS]
> **Action:** Macro close-up on the fax's small screen reading "ENTER RECIPIENT —", a single
> blinking cursor, my fingertip resting near the keypad, holding still. **Camera:** locked macro,
> almost no motion (this frame is where the website overlays the real contact form). Keep it
> calm and loopable. *(Optional SHOT 8b — "transmit": after the viewer submits, the fax whirs, the
> page feeds through, and a slip prints reading "SENT — TALK SOON". Generate this as a separate
> short clip the site plays on form submit.)*

---

## 3. NEGATIVE PROMPT  (add to every shot)
> no face, no head, no body, no mirror reflections of a face; consistent hands (don't change skin
> tone, don't add/remove fingers, no extra hands); no warping or morphing of objects; no floating
> objects; no text artifacts or gibberish writing; no fast whip-pans, no jump cuts, no flicker;
> no watermark; no cartoon/3D-render look — keep it photoreal.

---

## 4. PRODUCTION WORKFLOW (step by step in Gemini)
1. In Gemini, pick the **Veo 3.1** video model. Start a generation with **SHOT 1** + your hand/skin
   reference photo as an ingredient.
2. When SHOT 1 looks right, use **"Extend / Scene Extension"** and paste **SHOT 2** (with MASTER
   INGREDIENTS + the poster reference image). Repeat for SHOTs 3–8, each time extending from the
   previous clip and attaching that beat's project photo.
3. Keep the same MASTER INGREDIENTS text every time so hands/lighting/desk stay consistent.
4. Export the full chained video at the highest resolution offered. Also export a **9:16** version
   for mobile if you want.
5. Hand the file back to me — I'll wire it into the site so it **scrubs with scroll** (map scroll
   position → video time) and overlay the real poster (Shot 2) and the contact form (Shot 8).

## 5. Assets to prepare for the prompts
- ✅ Your **hand / skin-tone photo** (you have this) — the #1 ingredient.
- The **real poster** (I can design this from your project list so Shot 2's overlay matches).
- Project stills you already have in the folder (forklift/SEnS, CNC, 3D prints, MagSafe, slicer UI,
  flight plots, pendulum, casting) — use as per-shot ingredients so the AI renders them faithfully.

---

*Projects covered: Raymond forklift (pedestrian detection + stability) · the all-projects poster ·
3D printing + MagSafe stand · investment casting (cast nozzle) · PrintNC CNC (milled part) · Python
slicer/G-code (coding screen) · flight dynamics, double pendulum, vacuum cannon, Saturn V FEA, polymer
lithography (simulation screen) · fax + contact ending.*
