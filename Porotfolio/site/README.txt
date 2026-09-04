KAMBAR MANGIBAYEV — PORTFOLIO ("Sense · Decide · Respond")
==========================================================

HOW TO VIEW
-----------
Double-click  index.html  to open it in your browser.
(Needs an internet connection the first time — it pulls in the
animation libraries + fonts from a CDN.)

WHAT IT IS
----------
A single-page, scroll-driven cinematic portfolio modeled on the
NRG "Build Your Data Center" experience:
  • Boot / "Enter" gate that plays like the opening of a film
  • 5 scroll phases: Origin → Foundation → Build → Simulate → Deploy
  • A scroll-scrubbed "live" CNC viewport built from your real footage
  • An interactive project hub at the end (click any node)

TWO THINGS TO ADD (optional)
----------------------------
1. RESUME: drop your resume PDF into this folder (e.g. resume.pdf),
   then in  js/main.js  find the "resume-btn" handler and point it at it.
2. HEADSHOT: there's no photo of you yet — add one if you'd like it in
   the Origin section.

DEPLOY (free)
-------------
Drag this "site" folder onto netlify.com/drop, or push to GitHub and
enable Pages. No build step required.

FILES
-----
  index.html        — structure + all copy
  css/style.css     — design system
  js/main.js        — animation engine (GSAP + ScrollTrigger + Lenis)
  assets/seq/       — CNC frame sequence (scroll-scrubbed)
  assets/img/       — project stills
