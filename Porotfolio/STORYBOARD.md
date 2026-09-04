# Portfolio Storyboard — "The Bench"

One continuous space. The whole portfolio takes place at one workbench in a dark
room. You open on the room, move in to the desk, and every object on the desk *is*
a project you can pick up. Controls-engineer through-line: **sense → decide →
respond** is the quiet narration that ties it together.

---

## The flow (4 acts)

### ACT 1 — THE ROOM  (opening / landing)
- **Shot:** wide **side view** of a dark workshop room, the same mood as the
  lamp-lit bench — but you can actually see it. A single desk lamp pools warm light
  over a bench on the right; the rest of the room falls into shadow. **You** are
  there, seated/standing at the bench in profile, mid-task (assembling, filing a
  part). Pegboard, a shelf, a CNC in the shadow behind.
- **Overlay:** your name + one line ("Mechanical & controls engineer. Everything
  here, I built.").
- **Action:** scroll (or "Come closer") → the camera **pushes in toward the desk**,
  the room darkens at the edges, the lamp-lit bench fills the frame.
- *Needs: your side-profile photo (in Downloads) so the figure is you.*

### ACT 2 — THE BENCH  (the menu)
- **Shot:** we're now at the **tidy lamp-lit desk** (the image we just nailed),
  three-quarter top-down. The project objects sit spaced out on the clean wood.
- **Beat:** a soft line — *"Pick something up."* Each object gives a subtle glow /
  lift on hover, with a tiny label.
- This bench is the navigation. No menus, no cards — just the objects.

### ACT 3 — PICK IT UP  (per-project)
- **Action:** click an object → the **other objects slide + fade away** into the
  dark, the chosen object **moves to center and grows**, the lamp re-focuses on it.
- **Panel:** project details appear beside/under it — title, the story, *what it
  taught me*, tools used, and a detail image (close-up of the real thing).
- **Navigation:** "← back to the bench" returns every object; "next →" cycles to the
  adjacent object. Repeat through all projects.

### ACT 4 — LIGHTS ON  (close)
- After the last object (or always reachable): the lamp widens, you get a simple
  **contact / resume** card. "The bench is always open." Email · phone · résumé.

---

## Project → object on the bench

Each project becomes one physical object. (Edit freely — I guessed where info was thin.)

| # | Object on the desk | Project | Why it reads as this |
|---|--------------------|---------|----------------------|
| 1 | Aluminum bracket in the **bench vise** (+ file) | **PrintNC CNC** | the thing you *make*; hands-on build |
| 2 | The **open laptop** (CAD/code on screen) | **G-code generator (no AI)** | it drives the machine; built to learn machine control |
| 3 | A **3D-printed bracket** | **3D printing** | the iterate-fast habit |
| 4 | A **desktop double-pendulum** | **Double Pendulum** | the sim made physical |
| 5 | A short **clear tube + ping-pong balls** | **Vacuum Cannon** | reads instantly as the cannon |
| 6 | A small **model aircraft** | **Flight Dynamics** | Euler/quaternion sim |
| 7 | A **model rocket** (built, on its side) | **Saturn V — F-1 nozzle FEA** | Apollo / rocket |
| 8 | A **toy reach-truck / forklift** | **Raymond Corp — current role** | the "respond" payoff: safety systems |
| 9 | A **cast + electroplated metal part** (or wafer) | **Research** (AMPrint + Lithography) | optional; or fold into narration |

**Suggestions (you invited these):**
- Make **#8 Raymond** the *featured / final* object — it's the "respond" climax and
  your current real-world work.
- Treat **Education + Origin** (Semey → RIT, controls concentration) as the Act-1
  narration, not a desk object — it's who you are, not a thing on the bench.
- If 9 objects is too many on one desk, drop the Research object and mention research
  inside the laptop/notebook panel. 7–8 objects photographs cleaner.

---

## Assets we need (and status)

**Scenes**
- `room-sideview` — Act 1 wide room with you in profile. **TODO — needs your photo.**
- `bench-establishing` — Act 2 tidy desk. **DONE** ✓ (may shoot a cleaner top-down
  variant so objects are evenly spaced for the move-away animation).

**Object cut-outs** (each generated with the real-photo recipe on a plain dark
surface, then cut out on transparency so they can animate independently):
- vise+bracket · laptop · 3D print · pendulum · vacuum tube · model plane · rocket ·
  forklift. **TODO — 8 objects.**

**Project detail images** (shown when an object is opened) — reuse what we have:
- CNC spark macro ✓, warehouse safety ✓, pendulum light-painting ✓ — keep these.
- Generate detail shots for the rest as needed.

**You** — `kambar-working` side view for Act 1 / a Build moment. **TODO — needs your photo.**

---

## How it's built (tech)
- Same engine: GSAP + ScrollTrigger + Lenis.
- **Act 1 → 2:** scroll-scrubbed "camera push" — scale/pan the room image until the
  bench fills frame (one continuous move, no hard cut).
- **Act 3:** each object is its own positioned layer (transparent PNG) over the bench.
  Click → GSAP tweens the *other* objects out (translate off-frame + fade) and the
  chosen one to center + scale; detail panel fades in. Back/Next reverse or shift.
- **Fallback** (if cut-outs are too fiddly): keep the single bench photo with
  invisible hotspots; clicking dims/blurs the rest and zooms the chosen region. Same
  feel, less asset work.
- Mobile: the bench stacks; objects become a tap list that still opens the same panel.

---

## What I need from you
1. **Your side-profile photo** → drop into the **Downloads** folder. Unlocks Act 1 and
   the "you working" shot.
2. **Project edits** — confirm the 8–9 objects above, cut/add any, and fill in 1–2
   sentences on the vacuum cannon / flight dynamics if you want them sharper.
3. A **go** on this plot, then I generate the object set and build v2 around it.
