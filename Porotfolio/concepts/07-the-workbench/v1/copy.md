# THE WORKBENCH — Copy
### Kambar Mangibayev · Mechanical Systems & Controls Engineer

---

## 1. HERO / ROOM-ENTRY

**Kicker (tiny line above the name):**
> WORKBENCH NO. 1 — ROCHESTER, NY · 41°F OUTSIDE, WARM IN HERE

**Name treatment note:**
Set "KAMBAR MANGIBAYEV" large, in a slightly worn industrial face — like it was stenciled onto the side of a toolbox a few years ago and has lost a little ink. Below it, smaller and quieter: *Mechanical Systems & Controls Engineer.* The lamp's pool of light should fall across the name; the edges of both name and tagline can sit just slightly in shadow.

**The one-liner under his name:**
> Pull up a stool. Everything on this bench is something I built, and most of it is still warm.

**"The bench is lit / come in" affordance label — 3 options:**
1. `THE LAMP'S ON. HAVE A LOOK AROUND.`
2. `PICK SOMETHING UP. I DON'T MIND.`
3. `THE PENDULUM'S STILL SWINGING — START THERE.`

---

## 2. ABOUT (one paragraph, his voice)

I'm from Semey, Kazakhstan — a town that quietly produced most of the poets the country brags about, though I went a different direction with my hands. I came to the US in 2016, learned the language and the machine shop at roughly the same speed, and ended up with a BS and a master's in Mechanical Engineering from RIT, with the controls concentration because that's the part that wouldn't leave me alone. Now I design mechanical and control systems for industrial vehicles at The Raymond Corporation. The honest version of who I am: I come home from work to work. Not out of discipline — out of curiosity. There's always one more thing I want to take apart and understand, and the bench is where I do it.

---

## 3. THE "SOUL" LINE

> Strip away the steel and the code and every single thing on this bench is doing the same three things a person does when they catch a falling glass — sense the world, decide what matters, respond before it's too late.

*(Pendulum sub-label, optional, set in mono near the live pendulum):*
`SENSE · DECIDE · RESPOND — the whole job, on a string.`

---

## 4. THE OBJECTS ON THE BENCH (Projects)

---

### (Raymond) Pedestrian Detection & Automated Braking
**Object label:** The Eyes
**Hook:** A forklift that notices you before you notice it.

A warehouse is a bad place to be small and on foot — the vehicles are heavy, the aisles are tight, and the operator can't see everyone. I worked on the system that lets the truck watch its own surroundings and stop itself when a person is where they shouldn't be. Sensors feed a perception layer, the controller weighs what it's seeing against how fast and how loaded the truck is, and if the math turns ugly it commands the brakes faster than a startled human could. The part that stuck with me: getting it to brake hard for real danger while ignoring a thousand harmless things every shift is most of the work — confidence is cheap, *good* confidence is everything.

---

### (Raymond) Performance Stability System
**Object label:** The Inner Ear
**Hook:** Keeping a loaded truck from believing it's lighter than it is.

A forklift carrying a heavy load up high is a tip-over waiting for an excuse. The job was a system that keeps the vehicle composed when the operator, the load, and physics all disagree at once. It reads what the truck is doing — speed, steering, load state — decides how close to the edge that puts it, and quietly trims the truck's behavior so the edge never arrives. What I took from it is that the best stability work is invisible: if the operator notices it kicking in, you've already let things get more exciting than they should.

---

### (Personal) PrintNC CNC Router
**Object label:** The Big One
**Hook:** A steel CNC router I built on the third floor of an apartment.

I wanted a machine that could cut real material, not just foam and patience, so I built a PrintNC — a steel-framed CNC router — in my apartment. On the third floor. Don't tell my landlord. It senses position through its motion system, decides on a toolpath, and drags a spinning cutter through aluminum and wood with more authority than anything that size has a right to. Building it taught me the unglamorous half of engineering: squareness, rigidity, and the truth that a machine is only as accurate as its worst-bolted joint.

---

### (Personal) Python 3D Slicer & G-code Generator
**Object label:** The Translator
**Hook:** I wrote the thing that tells my printer what to do.

I got tired of treating my slicer like a black box, so I wrote my own in Python — the software that turns a 3D model into the thousands of small instructions a printer actually understands. It takes a shape, decides how to carve it into layers and paths, and emits the G-code that drives the machine line by line. Doing it from scratch is humbling; every smooth print you've ever seen is hiding a stack of geometry decisions you never had to think about. Now I think about them, which is exactly the kind of problem I keep coming home to.

---

### (Personal) 3D Printing
**Object label:** The Diamond Press
**Hook:** Where "good enough" went to get printed.

3D printing is how I prototype almost everything else on this bench, but it started as something closer to a vice. As a broke college student, every print felt like printing with diamonds — you do not casually waste a spool when it costs you a week of lunches, so I learned to get the geometry right before I ever hit print. The loop is the same as always: measure the real-world thing, decide on tolerances and orientation, print, then hold it and find out where I lied to myself. My favorite output isn't a part — it's the MagSafe stand I made for my wife, which is still in daily use and is the only review I really care about.

---

### (RIT) Flight Dynamics Simulation
**Object label:** The Sky in a Box
**Hook:** Nine aircraft, all flying inside a laptop.

For this I built a flight dynamics simulation covering nine different aircraft — the full six-degrees-of-freedom problem of how a thing actually moves through the air. It senses its own state, the model decides how forces and moments push it around, and it responds the way a real airframe would, frame after frame. I implemented it both ways — Euler angles and quaternions — specifically to feel the difference, including watching Euler angles fall apart at gimbal lock while quaternions kept their composure. Built in MATLAB and Simulink, it's the project that turned "control theory" from equations on a page into something I could fly badly and understand deeply.

---

### (RIT) Double Pendulum
**Object label:** The Soul of the Bench
**Hook:** The one thing here I can model perfectly and still never predict.

The double pendulum is the project I keep on the bench because it's honest: two arms, one pivot, and behavior so sensitive that two identical starts split into two completely different futures. I modeled its chaotic dynamics from the equations of motion and then built the physical rig to watch model and reality drift apart in real time. The whole thing is the sense-decide-respond loop staring back at you — a system you understand completely and still cannot fully control. It's why everything else on this bench exists, and why it's the part that's always moving.

---

### (RIT) Vacuum Cannon
**Object label:** The Loud One
**Hook:** A 1.52-meter tube whose only job is to throw something very fast.

A vacuum cannon is delightfully simple and slightly alarming: evacuate the air from a 1.52-meter barrel, let atmospheric pressure do the rest, and a projectile leaves the end faster than feels reasonable. Before building it I simulated the exit velocity so I knew roughly what I was signing up for and where to stand. The model senses the pressure differential, the physics decides the acceleration down the barrel, and the projectile responds enthusiastically. It's the most fun I've had confirming that atmospheric pressure is not, in fact, "just air."

---

### (RIT) Saturn V F-1 Nozzle FEA
**Object label:** The Big Burn
**Hook:** Putting 7.5 million pounds of thrust into a simulation, on purpose.

The F-1 engine of the Saturn V produced around 7.5 million pounds of thrust per engine, which is an absurd number to type and a harder one to design hardware for. I ran a finite element analysis of the nozzle in Ansys to see how that kind of load and heat actually distributes through the structure. The simulation senses the applied loads, decides where stress and strain concentrate, and shows you exactly which corners would fail first. It gave me real respect for the people who did this in the 1960s without a single one of the tools I had open.

---

### (Research) Investment Casting at AMPrint
**Object label:** The Cast
**Hook:** Pouring metal into shapes a printer made first.

At RIT's AMPrint Center I worked on investment casting that started with additive manufacturing — using 3D-printed patterns and tooling instead of the traditional route. Part of the work was designing custom water nozzles and using CFD to understand how fluid actually behaved through them before committing to metal. The CFD senses the geometry, decides how the flow will move and where it'll misbehave, and lets you fix it on screen instead of in a failed pour. It's where I learned that "make it, then test it" gets very expensive very fast, and simulation is how you stay solvent.

---

### (Research) Polymer Lithography
**Object label:** The Small World
**Hook:** Engineering at a scale you can only reach through math.

Some problems are too small to prototype your way through, and polymer lithography is one of them. I used LAMMPS to simulate the molecular behavior because at that scale, simulation isn't a convenience — it's the only window you've got. The model senses the molecular setup, decides how the system evolves under the forces at play, and predicts behavior you'd otherwise have no way to see. This is the project that fully converted me to simulation-first thinking: understand it in the model, *then* spend the time and money in the real world.

---

## 5. CONTACT / CLOSING

**Warm human closing line (primary):**
> The lamp stays on. If something here made you want to ask a question, build a thing, or just argue about quaternions, the bench is always open.

**Contact details:**
- Email — kambarmangibayev@gmail.com
- Phone — +1 585-309-9467
- Location — Rochester, NY

**Two alternative closing lines:**
1. *"I'm easiest to reach by email, and easiest to win over with a hard problem. Either works."*
2. *"Pull up a stool any time. Worst case, you learn how a forklift decides to stop."*

---

## 6. INSTRUMENT READOUT / HUD MICRO-LABELS

```
BENCH POWER ......... ON
LAMP ................ 2700K
PENDULUM ............ LIVE
AMBIENT ............. 19.4°C
LOOP STATUS ......... SENSE · DECIDE · RESPOND
PROJECTS ON BENCH ... 11
LAST BUILD .......... STILL WARM
COFFEE .............. CRITICALLY LOW
```

*(Pick any 6–8. "COFFEE: CRITICALLY LOW" and "LAST BUILD: STILL WARM" are the optional human ones — keep one, drop one, or keep both if the panel can carry the wink.)*
