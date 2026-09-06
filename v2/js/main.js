/* main.js — entry point.
 * Owns the single rAF loop (so one FPS counter covers both canvases), smooth scroll
 * (Lenis), the GSAP ScrollTrigger unravel timeline, the blink text reveal, click-to-
 * scroll on cubes, and the FPS guard that halves the particle count if the laptop
 * can't hold 50 fps.
 */
import gsap from 'gsap';
import ScrollTrigger from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import { createParticles } from './particles.js';
import { createCubeHero } from './cubes.js';
import { initChapters } from './chapters.js';
import { createVct } from './vct.js';

window.gsap = gsap;                       // let cubes.js use GSAP for setState/focus
gsap.registerPlugin(ScrollTrigger);

const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const mobile = window.innerWidth < 820;
const moving = !reduced;

// Boot the WebGL scenes AFTER the first paint so the headline and text render
// immediately (fast FCP/LCP); the heavy particle burn-in then runs off the critical path.
function boot() {

// ---- smooth scroll ----
let lenis = null;
if (!reduced) {
  lenis = new Lenis({ lerp: 0.1 });
  lenis.on('scroll', ScrollTrigger.update);
}

// ---- scenes ----
const particles = createParticles(reduced ? { staticDensity: 0.4 } : {});
const cubes = createCubeHero({
  onCubeClick: (i) => scrollToSection(cubes.sectionFor(i)),
});

// Raymond unfold state, shared by the experience ScrollTrigger and the pointer handlers.
let raymondUnfoldT = 0;
let raymondFaces = [];
fetch('data/projects.json').then((r) => r.json())
  .then((j) => { raymondFaces = (j.raymond && j.raymond.faces) || []; })
  .catch(() => {});

// shape-debug (?shape=forklift|slicer|cube): force one particle morph fully on and hide
// every cube, so the silhouette can be screenshotted and scored (IoU) with no scroll/scrub
// ambiguity. Scroll-driven motion is frozen shortly after boot.
const debugShape = new URLSearchParams(location.search).get('shape');
if (debugShape != null) {
  const k = { forklift: 0, slicer: 1, cube: 2 }[debugShape];
  if (k != null) {
    particles.forceShape(k);
    cubes.setForceHidden(true);
    setTimeout(() => ScrollTrigger.getAll().forEach((s) => s.disable(false)), 150);
  }
}

// verifier hooks: drive the unravel and read screen bounding boxes from Playwright
window.__v2 = {
  freeze: () => ScrollTrigger.getAll().forEach((s) => s.disable(false)),
  setUnravel: (p) => cubes.setUnravel(p),
  cubeBoxes: () => cubes.cubeBoxes(),
  labelBoxes: () => cubes.labelBoxes(),
  headlineBox: () => {
    const el = document.querySelector('.display');
    const r = el.getBoundingClientRect();
    return { x: r.x, y: r.y, w: r.width, h: r.height };
  },
  navBox: () => {
    const r = document.querySelector('.nav-links').getBoundingClientRect();
    return { x: r.x, y: r.y, w: r.width, h: r.height };
  },
};

function scrollToSection(sel) {
  if (!sel) return;
  const el = document.querySelector(sel);
  if (!el) return;
  if (lenis) lenis.scrollTo(el, { offset: 0 });
  else el.scrollIntoView({ behavior: 'smooth' });
}

// ---- unravel: one GSAP timeline scrubbed by ScrollTrigger over the first 120vh ----
if (!reduced && !mobile) {
  const proxy = { p: 0 };
  gsap.to(proxy, {
    p: 1,
    ease: 'power2.inOut',
    scrollTrigger: {
      trigger: '#hero',
      start: 'top top',
      end: '+=120%',
      scrub: true,
    },
    onUpdate: () => cubes.setUnravel(proxy.p),
  });
} else {
  cubes.setUnravel(0);   // reduced + mobile: the sorted grid stays put
}

// ---- reading panels ----
initChapters({ lenis });

// (Dark stripe + contact reassembly triggers are created in initPart3(), called near the
// end of boot AFTER the pinned experience/slicer triggers so their measured scroll
// positions include the pin spacing above them.)
function initPart3() {
  const stripe = document.querySelector('#about.darkstripe');
  const veil = document.getElementById('dark-veil');
  const clamp01 = (x) => Math.max(0, Math.min(1, x));
  if (stripe && !reduced) {
    ScrollTrigger.create({
      trigger: stripe, start: 'top bottom', end: 'bottom top', scrub: 0.6,
      onUpdate: (self) => {
        const p = self.progress;
        // The stripe fully fills the viewport only around progress 0.5 (100vh section).
        // Darken (veil + white points) on a plateau there so the neighbouring white
        // sections are gone before the band goes dark; ramp at the edges for a soft cut.
        let dark;
        if (p < 0.3) dark = 0;
        else if (p < 0.45) dark = (p - 0.3) / 0.15;
        else if (p < 0.55) dark = 1;
        else if (p < 0.7) dark = (0.7 - p) / 0.15;
        else dark = 0;
        dark = clamp01(dark);
        particles.setDark(dark);
        if (veil) veil.style.opacity = dark.toFixed(3);
        // cube outline forms only while the band is dark (its points are white only then)
        let m;
        if (p < 0.32) m = 0;
        else if (p < 0.5) m = (p - 0.32) / 0.18;
        else if (p < 0.58) m = 1;
        else if (p < 0.75) m = (0.75 - p) / 0.17;
        else m = 0;
        particles.setMorph(2, clamp01(m));
        document.body.classList.toggle('in-stripe', dark > 0.4);
      },
      onLeave: () => { particles.setDark(0); particles.setMorph(2, 0); if (veil) veil.style.opacity = '0'; document.body.classList.remove('in-stripe'); },
      onLeaveBack: () => { particles.setDark(0); particles.setMorph(2, 0); if (veil) veil.style.opacity = '0'; document.body.classList.remove('in-stripe'); },
    });
  }
  // Contact: the eight cubes glide from the drift into the SAME sorted 4x2 grid as projects
  // (labels return), fully settled by 60 percent of the section with tumble damped to 0, so
  // nothing moves after that.
  const contactReassemble = document.getElementById('contact');
  if (contactReassemble && !reduced && !mobile) {
    ScrollTrigger.create({
      trigger: contactReassemble, start: 'top 80%', end: 'bottom bottom', scrub: 0.6,
      onUpdate: (self) => cubes.setContact(Math.min(1, self.progress / 0.6)),
      onLeaveBack: () => cubes.setContact(0),
    });
  }
}

// ---- variable cam timing diagram (experience section); its update is driven by the one
// master loop below, not its own rAF ----
const vctEl = document.querySelector('.vct');
let vctFrame = null;
if (vctEl) { const r = createVct(vctEl, !reduced); if (!reduced) vctFrame = r; }

// reduced motion: cubes are the static sorted grid at the hero only, hidden past it
if (reduced) {
  const setHero = () => document.body.classList.toggle('past-hero', window.scrollY > window.innerHeight * 0.85);
  window.addEventListener('scroll', setHero, { passive: true });
  setHero();
}

// ---- nav + in-page anchors use smooth Lenis scroll ----
document.querySelectorAll('a[href^="#"]').forEach((a) => {
  a.addEventListener('click', (e) => {
    const el = document.querySelector(a.getAttribute('href'));
    if (!el) return;
    e.preventDefault();
    if (lenis) lenis.scrollTo(el, { offset: 0 });
    else el.scrollIntoView({ behavior: 'smooth' });
  });
});

// ---- scroll progress rail (bar height + current chapter number) ----
const progressBar = document.querySelector('.progress-bar');
const progressNum = document.querySelector('.progress-num');
const chapterSecs = ['hero', 'origin', 'polymer', 'casting', 'cnc', 'slicer', 'raymond',
  'experience', 'others', 'websites', 'about', 'contact']
  .map((id) => document.getElementById(id)).filter(Boolean);
function updateProgress() {
  if (!progressBar) return;
  const max = document.documentElement.scrollHeight - window.innerHeight;
  const p = max > 0 ? Math.min(1, window.scrollY / max) : 0;
  progressBar.style.height = (p * 100) + 'vh';
}

// ---- Experience: dots reform into the forklift; content reveals line by line ----
const expSec = document.querySelector('#experience');
if (expSec) {
  const lines = Array.from(expSec.querySelectorAll('.reveal-line'));
  const p2 = (x) => (x < 0.5 ? 2 * x * x : 1 - (-2 * x + 2) * (-2 * x + 2) * 0.5);
  if (reduced || mobile) {
    expSec.classList.add('seen');
    lines.forEach((el) => el.classList.add('in'));
  } else {
    // cube 4 (Raymond "deploy") parks left of the forklift; the other seven exit to the
    // edges while experience is on screen and are recalled to drift when it leaves.
    const RAYMOND_CUBE = 4;
    const enterExperience = () => {
      for (let i = 0; i < cubes.count; i++) {
        if (i === RAYMOND_CUBE) continue;
        cubes.exit(i);
      }
      // park the raymond cube left of the forklift (30vw / 52vh, scale 2.4). chapterPark
      // ignores axvw/ayvh, so use the engine's setParkAnchor when it is available.
      if (cubes.setParkAnchor) cubes.setParkAnchor(RAYMOND_CUBE, 30, 52, 2.4);
      else cubes.chapterPark(RAYMOND_CUBE, 'left', 1, { scale: 2.4 });
    };
    const leaveExperience = () => {
      if (cubes.setRaymondUnfold) cubes.setRaymondUnfold(0);
      raymondUnfoldT = 0;
      for (let i = 0; i < cubes.count; i++) cubes.recall(i);
      cubes.chapterPark(RAYMOND_CUBE, 'left', 0);   // unpark -> back to drift
    };
    ScrollTrigger.create({
      trigger: expSec, start: 'top top', end: '+=180%', pin: expSec.querySelector('.exp2-pin'),
      pinSpacing: true, scrub: 0.8,
      onUpdate: (self) => {
        const p = self.progress;
        // forklift assembles from dust over the first 30% then HOLDS at 1 to the end of
        // experience; the slicer trigger owns the crossfade hand-off to the slice stack.
        const m = p < 0.30 ? p2(p / 0.30) : 1;
        particles.setMorph(0, m);
        // Raymond cube unfolds into its six-face net over progress 0.25..0.55 (power2.inOut),
        // holds open, then folds back over 0.85..0.95 so it returns to drift as slicer begins.
        let ru;
        if (p < 0.25) ru = 0;
        else if (p <= 0.55) ru = p2((p - 0.25) / 0.30);
        else if (p < 0.85) ru = 1;
        else if (p <= 0.95) ru = 1 - p2((p - 0.85) / 0.10);
        else ru = 0;
        raymondUnfoldT = ru;
        if (cubes.setRaymondUnfold) cubes.setRaymondUnfold(ru);
        expSec.classList.toggle('seen', p > 0.02);
        lines.forEach((el, k) => el.classList.toggle('in', p > 0.08 + k * 0.045));
      },
      onEnter: enterExperience,
      onEnterBack: enterExperience,
      // forward exit: forklift HOLDS at 1 (slicer crossfade zeroes it); just recall cubes
      onLeave: leaveExperience,
      // back exit above experience: no forklift here, so dissolve it
      onLeaveBack: () => { leaveExperience(); particles.setMorph(0, 0); },
    });
    // verifier hooks: current unfold t and a screen rect for face j (when the engine exposes it)
    window.__v2.raymondUnfold = () => raymondUnfoldT;
    window.__v2.raymondFace = (j) => (cubes.raymondFaceRects ? cubes.raymondFaceRects()[j] : null);
  }
}

// ---- Slicer: the dots reform into the slice stack, built bottom ring first with scroll ----
const slSec = document.querySelector('#slicer');
if (slSec) {
  const slLines = Array.from(slSec.querySelectorAll('.reveal-line'));
  const hair = slSec.querySelector('.slice-hairline');
  const hairLabel = slSec.querySelector('.slice-label');
  const p2s = (x) => (x < 0.5 ? 2 * x * x : 1 - (-2 * x + 2) * (-2 * x + 2) * 0.5);
  if (reduced || mobile) {
    slSec.classList.add('seen');
    slLines.forEach((el) => el.classList.add('in'));
    if (hair) hair.style.opacity = '0';
  } else {
    ScrollTrigger.create({
      trigger: slSec, start: 'top top', end: '+=160%', pin: slSec.querySelector('.exp2-pin'),
      pinSpacing: true, scrub: 0.8,
      onUpdate: (self) => {
        const p = self.progress;
        // Crossfade: over the first 40vh the held forklift (morph 0) fades out while the
        // slice stack (morph 1) fades in on the same scrub, so there is never a plain gap.
        const span = Math.max(1, self.end - self.start);
        const cf = Math.min(0.9, (0.40 * window.innerHeight) / span);
        const x = Math.min(1, p / cf);            // 0..1 crossfade progress
        particles.setMorph(0, 1 - x);             // forklift dissolves as the slice rises
        // slice stack: rise with the crossfade, hold while the stack builds, dissolve last 25%
        let m;
        if (p < cf) m = x;
        else if (p < 0.75) m = 1;
        else m = 1 - p2s((p - 0.75) / 0.25);
        particles.setMorph(1, m);
        // build line rises bottom-first: ring k appears when p > 0.15 + 0.6*k/40
        const reveal = Math.min(1, Math.max(0, (p - 0.15) / 0.6));
        particles.setSliceReveal(p < 0.75 ? reveal : 1);
        slSec.classList.toggle('seen', p > 0.02);
        slLines.forEach((el, k) => el.classList.toggle('in', p > 0.08 + k * 0.05));
        // DOM layer hairline follows the top built ring while the stack grows
        if (hair && particles.sliceTop) {
          const on = p > 0.15 && p < 0.78 && m > 0.5;
          hair.style.opacity = on ? '1' : '0';
          if (on) {
            const t = particles.sliceTop();
            hair.style.transform = `translateY(${t.y.toFixed(1)}px)`;
            if (hairLabel) hairLabel.textContent = `layer ${t.ring} / ${t.rings}`;
          }
        }
      },
      // forward past slicer: stack dissolves, forklift already 0
      onLeave: () => { particles.setMorph(1, 0); if (hair) hair.style.opacity = '0'; },
      // back up into the previous band: hand the shape back to the held forklift, no gap
      onLeaveBack: () => { particles.setMorph(1, 0); particles.setMorph(0, 1); if (hair) hair.style.opacity = '0'; },
    });
  }
}

// ---- Projects: cubes settle into a grid; click one to unfold its six-face net ----
const projSec = document.querySelector('#projects');
if (projSec) {
  const closeBtn = document.getElementById('project-close');
  const stackEl = document.getElementById('project-stack');
  const head = projSec.querySelector('.projects-head');
  // content per cube slot (label order: simulate, make, build, software, deploy, print, dynamics, flight)
  const RAYMOND = { title: 'The Raymond Corporation', year: '2024 to now',
    one: 'Mechanical systems engineer, controls, on the reach trucks.',
    designed: 'Six subsystems, from a performance stability system to a redesigned structural frame.',
    analyzed: 'Pressure transducers, machine vision, regenerative braking, and access control logic.',
    built: 'Shipped across the reach-truck line, validated on real hardware.',
    proved: '+14 percent performance and -10 percent battery draw.', key: '+14% performance',
    tools: 'Controls, hydraulics, FEA', panel: 'ray-stability', images: ['sens-plus-flyer'] };
  const bySlot = {};
  fetch('data/projects.json').then((r) => r.json()).then((j) => {
    const byCube = {};
    j.projects.forEach((pr) => { if (byCube[pr.cube] == null) byCube[pr.cube] = pr; });
    for (let s = 0; s < 8; s++) bySlot[s] = byCube[s] || null;
    bySlot[4] = RAYMOND;   // deploy slot = Raymond overview (not in projects.json)
  }).catch(() => {});

  // one image per face card (100% card width), cycled from the project's photo list so
  // each face fills. No image -> text only (never a broken src).
  const imgFor = (d, n) => {
    const arr = d.images || [];
    if (!arr.length) return '';
    return `<img loading="lazy" decoding="async" src="assets/img/${arr[n % arr.length]}.jpg" alt="" />`;
  };
  const FACES = [
    { key: 'front', build: (d) => `${imgFor(d, 0)}<span class="pc-kick">${cubes.labelFor(openIdx)}</span><h3>${d.title}</h3><span class="pc-year">${d.year}</span><p>${d.one}</p>` },
    { key: 'right', build: (d) => `${imgFor(d, 1)}<span class="pc-kick">Designed</span><p>${d.designed}</p>` },
    { key: 'left', build: (d) => `${imgFor(d, 2)}<span class="pc-kick">Analyzed</span><p>${d.analyzed}</p>` },
    { key: 'top', build: (d) => `${imgFor(d, 3)}<span class="pc-kick">Built</span><p>${d.built}</p>` },
    { key: 'bottom', build: (d) => `${imgFor(d, 4)}<span class="pc-kick">Proved</span><p>${d.proved}</p><p class="pc-key">${d.key}</p>` },
    { key: 'back', build: (d) => `${imgFor(d, 5)}<span class="pc-kick">Tools</span><p>${d.tools}</p>` },
  ];
  let openIdx = -1;

  // The six faces are the 3D net (baked textures from the engine); no DOM cards over them.
  // The only overlay is the Close button and one Full breakdown link centred below the net.
  const scrim = document.getElementById('project-scrim');
  const fullBtn = document.getElementById('project-full');
  let openPanelName = '';
  if (fullBtn) fullBtn.addEventListener('click', () => { if (openPanelName && window.__v2panel) window.__v2panel.open(openPanelName); });
  cubes.setProjectHandlers(
    (i) => {
      openIdx = i;
      const d = bySlot[i];
      openPanelName = d && d.panel ? d.panel : '';
      if (fullBtn) fullBtn.hidden = !openPanelName;
      closeBtn.hidden = false; head.classList.add('dim');
      if (scrim) scrim.classList.add('on'); document.body.classList.add('cube-open');
    },
    () => {
      openPanelName = '';
      if (fullBtn) fullBtn.hidden = true;
      closeBtn.hidden = true; head.classList.remove('dim');
      if (scrim) scrim.classList.remove('on'); document.body.classList.remove('cube-open');
    },
  );
  closeBtn.addEventListener('click', () => cubes.closeProject());
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && cubes.projectOpenIndex() >= 0) cubes.closeProject(); });

  if (!reduced && !mobile) {
    // active only while the grid is on screen; turning off closes any open cube (setProjects)
    ScrollTrigger.create({
      trigger: projSec, start: 'top 60%', end: 'bottom 70%',
      onEnter: () => cubes.setProjects(true), onEnterBack: () => cubes.setProjects(true),
      onLeave: () => cubes.setProjects(false), onLeaveBack: () => cubes.setProjects(false),
    });
  } else {
    // mobile / reduced: a 2x4 grid of tappable project tiles; tap opens a vertical face stack
    const grid = document.createElement('div');
    grid.className = 'project-mgrid';
    const openStack = (i) => {
      const d = bySlot[i] || {};
      stackEl.innerHTML = `<button type="button" class="pms-close" aria-label="Close">&times;</button>` +
        FACES.map((f) => `<div class="pms-card">${f.build ? f.build(Object.assign({}, d, {})) : ''}</div>`).join('');
      // fix the front kicker (uses openIdx global on desktop)
      stackEl.hidden = false; stackEl.setAttribute('aria-hidden', 'false');
      stackEl.querySelector('.pms-close').addEventListener('click', () => { stackEl.hidden = true; });
      const back = bySlot[i] && bySlot[i].panel;
      if (back) { const b = document.createElement('button'); b.type = 'button'; b.className = 'pc-full'; b.textContent = 'Full breakdown';
        b.addEventListener('click', () => window.__v2panel && window.__v2panel.open(back)); stackEl.appendChild(b); }
    };
    for (let i = 0; i < 8; i++) {
      const btn = document.createElement('button');
      btn.type = 'button'; btn.className = 'project-tile'; btn.textContent = cubes.labelFor(i);
      btn.addEventListener('click', () => { openIdx = i; openStack(i); });
      grid.appendChild(btn);
    }
    head.after(grid);
  }
}

// verifier hook: parked-cube box vs a chapter's text column
window.__v2.parkCube = (i, side, t) => { cubes.setUnravel(1); cubes.chapterPark(i, side, t); };
window.__v2.meshBox = (i) => cubes.meshBox(i);
window.__v2.setMorph = (k, v) => particles.setMorph(k, v);
window.__v2.morphBox = (k) => particles.morphBox(k);
window.__v2.morphVal = (k) => particles.morphVal(k);
window.__v2.allCubes = () => Array.from({ length: cubes.count }, (_, i) => ({ box: cubes.meshBox(i), op: cubes.cubeOpacity(i) }));
window.__v2.state = () => cubes.getState();
// verifier: drive + read the projects unfold (deterministic open, real X/Escape close)
window.__v2.openProject = (i) => cubes.openProject(i);
window.__v2.projectOpen = () => cubes.projectOpenIndex();
window.__v2.faceAnchors = () => cubes.faceAnchors();
window.__v2.gridSlots = () => cubes.gridSlots();
window.__v2.shapeRects = () => cubes.shapeRectsNow();
window.__v2.cubesCanvasOpacity = () => parseFloat(getComputedStyle(document.getElementById('cubes-canvas')).opacity || '1');
window.__v2.cubeCenters = () => cubes.cubeCenters();
window.__v2.cardCentres = () => Array.from(document.querySelectorAll('#project-cards .pc')).map((el) => {
  const r = el.getBoundingClientRect();
  const key = (el.className.match(/pc-(front|right|left|top|bottom|back)/) || [])[1];
  return { key, x: r.x + r.width / 2, y: r.y + r.height / 2, op: parseFloat(el.style.opacity || '0') };
});

window.__v2.scrollToY = (y) => { if (lenis) lenis.scrollTo(y, { immediate: true }); else window.scrollTo(0, y); };
window.__lenis = lenis;
// verifier: pixel scroll range of a pinned section's ScrollTrigger, so the film can hit
// exact chapter progress values (e.g. slicer at 20/50/85 percent).
window.__v2.triggerRange = (id) => {
  const bare = id.charAt(0) === '#' ? id.slice(1) : id;   // accept '#experience' or 'experience'
  const st = ScrollTrigger.getAll().find((s) => s.trigger && s.trigger.id === bare && s.pin);
  return st ? { start: st.start, end: st.end } : null;
};
window.__v2.textColBox = (sel) => {
  const el = document.querySelector(sel + ' .ch-inner');
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { x: r.x, y: r.y, w: r.width, h: r.height };
};

// ---- cursor parallax + projects-grid hover ----
window.addEventListener('pointermove', (e) => {
  const nx = (e.clientX / window.innerWidth) * 2 - 1;
  const ny = (e.clientY / window.innerHeight) * 2 - 1;
  cubes.setPointer(nx, ny);
  if (!mobile && cubes.projectsActive && cubes.projectsActive() && cubes.projectOpenIndex() < 0) {
    const i = cubes.raycast({ x: nx, y: -ny });
    cubes.setHover(i);
    document.body.style.cursor = i >= 0 ? 'pointer' : '';
  }
  // hovering an unfolded Raymond face shows the pointer cursor
  if (!mobile && raymondUnfoldT > 0.9 && cubes.raymondFaceAt) {
    document.body.style.cursor = cubes.raymondFaceAt(nx, -ny) >= 0 ? 'pointer' : '';
  }
}, { passive: true });

// ---- open a cube ONLY on a real click (pointerdown + pointerup within 6px and 400ms on
// the SAME cube). Scroll, drags and momentum never open a cube; a tap outside an open cube
// closes it. Never opens from a scroll or timeline callback. ----
const toNdc = (e) => ({ x: (e.clientX / window.innerWidth) * 2 - 1, y: -(e.clientY / window.innerHeight) * 2 + 1 });
const IGNORE_SEL = 'a, button, #project-cards, #project-close, #project-stack';
let downPt = null;
window.addEventListener('pointerdown', (e) => {
  if (mobile) { downPt = null; return; }
  if (e.target.closest(IGNORE_SEL)) { downPt = null; return; }
  downPt = { x: e.clientX, y: e.clientY, t: performance.now(), cube: cubes.raycast(toNdc(e)) };
}, { passive: true });
window.addEventListener('pointerup', (e) => {
  const d = downPt; downPt = null;
  if (mobile || !d || e.target.closest(IGNORE_SEL)) return;
  const moved = Math.hypot(e.clientX - d.x, e.clientY - d.y);
  if (moved > 6 || performance.now() - d.t > 400) return;   // a drag/scroll, not a click
  // a click on an unfolded Raymond face opens that system's reading panel
  if (raymondUnfoldT > 0.9 && cubes.raymondFaceAt) {
    const ndc = toNdc(e);
    const j = cubes.raymondFaceAt(ndc.x, ndc.y);
    if (j >= 0) {
      const face = raymondFaces[j];
      if (face && face.panel && window.__v2panel) window.__v2panel.open(face.panel);
      return;
    }
  }
  const up = cubes.raycast(toNdc(e));
  if (cubes.projectsActive && cubes.projectsActive()) {
    if (cubes.projectOpenIndex() >= 0) {
      if (up < 0) cubes.closeProject();                       // tap outside closes
    } else if (up >= 0 && up === d.cube) {
      cubes.openProject(up);                                  // tap the same cube opens it
    }
    return;
  }
  if (up >= 0 && up === d.cube) scrollToSection(cubes.sectionFor(up));
});

// ---- scroll progress for particle density ----
function scrollProgress() {
  const max = document.documentElement.scrollHeight - window.innerHeight;
  return max > 0 ? window.scrollY / max : 0;
}

// ---- mobile: hero + contact show the sorted grid; between them every cube is hidden
// except the active chapter's cube, parked above its category word ----
const contactEl = document.getElementById('contact');
const mAnchors = mobile ? Array.from(document.querySelectorAll('.m-cube-anchor')) : [];
function updateMobileDim() {
  if (!mobile || reduced) return;
  const vh = window.innerHeight, y = window.scrollY, mid = vh * 0.5;
  const ct = contactEl ? contactEl.offsetTop : Infinity;
  const inChapters = y > vh * 0.92 && y < ct - vh * 0.5;
  cubes.setMobileHide(inChapters);
  if (inChapters) {
    // show the cube only while its word sits in a comfortable middle band (clear of the nav)
    let best = null, bestD = Infinity;
    for (const a of mAnchors) {
      const r = a.getBoundingClientRect();
      const cy = r.top + r.height / 2;
      if (cy > vh * 0.22 && cy < vh * 0.72) {
        const d = Math.abs(cy - mid);
        if (d < bestD) { bestD = d; best = a; }
      }
    }
    cubes.setTrack(best ? [{ i: parseInt(best.dataset.cube, 10), el: best, scale: 1.6 }] : []);
  } else {
    cubes.setTrack([]);
  }
}

// ---- visible text rects (so bright cubes fade off the copy); elements cached once ----
// keep this selector list in sync with TEXT_SELECTORS in v2/verify_all.py
const TEXT_SEL = '.display,.hero-sub,.exp-word,.exp2-head,.exp2-systems,.exp2-ach,.exp2-prev,'
  + '.slicer-story,.slicer-key,.ev-strip,.flat-head,.projects-head,.web-lead,.web-tiles,'
  + '.ds-left,.edu,.contact-inner,.prev-band';
const textEls = Array.from(document.querySelectorAll(TEXT_SEL));
function refreshTextRects() {
  const vh = window.innerHeight, vw = window.innerWidth;
  const rects = [];
  for (const el of textEls) {
    const r = el.getBoundingClientRect();
    if (r.width > 4 && r.height > 4 && r.bottom > 0 && r.top < vh && r.left < vw && r.right > 0) {
      rects.push({ x: r.x, y: r.y, w: r.width, h: r.height });
    }
  }
  // lanes: every visible text block is a soft lane the drifting cubes steer around
  // (spec 8.1). Refreshed each frame, which is a superset of every ScrollTrigger update
  // and resize. setShapeRects below still feeds the hard morph-shape exclusions.
  cubes.setLanes(rects);
  // a morph shape (forklift / slice stack / cube outline) is a HARD exclusion, expanded
  // 60 px, that every cube is pushed clear of while it is active
  const shapes = [];
  for (let k = 0; k < 3; k++) {
    if (particles.morphVal(k) > 0.25) {
      const b = particles.morphBox(k);
      if (b) shapes.push({ x: b.x - 60, y: b.y - 60, w: b.w + 120, h: b.h + 120 });
    }
  }
  cubes.setShapeRects(shapes);
}

// ---- master loop + FPS guard ----
// One rAF drives particles, cubes and the VCT diagram. It idles when the tab is hidden
// (visibilitychange) so nothing renders in the background.
let last = performance.now();
let fpsStart = last, fpsFrames = 0, fpsChecked = false;
let pageHidden = document.hidden;
document.addEventListener('visibilitychange', () => {
  pageHidden = document.hidden;
  if (!pageHidden) { last = performance.now(); fpsStart = last; fpsFrames = 0; }  // avoid a dt/fps spike on resume
});

function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (pageHidden) { requestAnimationFrame(loop); return; }   // idle while backgrounded
  if (lenis) lenis.raf(now);
  refreshTextRects();
  particles.frame(now, dt, scrollProgress(), moving);
  cubes.frame(now, dt, moving);
  if (vctFrame) vctFrame(now);
  updateProgress();
  updateMobileDim();

  // count rAF for 2.5 s after load; if under 50 fps, halve the particle count. A short
  // window lets weak/software-rendered hardware shed load quickly (better on a laptop
  // iGPU and on Lighthouse's headless software WebGL); on a real GPU fps stays >=50 and
  // nothing changes. (Skipped in shape-debug so the silhouette keeps its full count.)
  if (!fpsChecked && !debugShape) {
    fpsFrames++;
    if (now - fpsStart >= 2500) {
      const fps = (fpsFrames * 1000) / (now - fpsStart);
      console.log('[v2] measured fps over 2.5s:', fps.toFixed(1), '| particles:', particles.getCount());
      if (fps < 50) {
        particles.halveCount();
        particles.capDpr();
        cubes.capDpr();
        console.log('[v2] fps under 50: halved particles to', particles.getCount(), 'and capped DPR to 1.5');
      }
      fpsChecked = true;
    }
  }
  requestAnimationFrame(loop);
}

// ---- blink text reveal after fonts are ready ----
function splitGlyphs() {
  const el = document.querySelector('.display');
  if (!el) return;
  const text = el.textContent;
  el.setAttribute('aria-label', text);      // read as a sentence, not letter by letter
  el.textContent = '';
  let d = 0;
  const words = text.split(' ');
  words.forEach((word, wi) => {
    // each word is a nowrap unit so lines only ever break at spaces, never inside a word
    const wspan = document.createElement('span');
    wspan.className = 'word';
    wspan.setAttribute('aria-hidden', 'true');
    for (const ch of word) {
      const g = document.createElement('span');
      g.className = 'glyph';
      g.textContent = ch;
      g.style.animationDelay = (d * 18) + 'ms';
      wspan.appendChild(g);
      d++;
    }
    el.appendChild(wspan);
    if (wi < words.length - 1) el.appendChild(document.createTextNode(' '));
  });
}

splitGlyphs();
document.body.classList.add('loaded');

const startReveal = () => document.body.classList.add('reveal');
if (document.fonts && document.fonts.ready) {
  Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 800))]).then(startReveal);
} else {
  startReveal();
}

// Part 3 triggers are created last so they measure with all pin spacing in place.
initPart3();

// Lenis drives native window scroll, so ScrollTrigger needs no scrollerProxy; a
// refresh after layout settles keeps the 120vh trigger measured correctly.
window.addEventListener('load', () => ScrollTrigger.refresh());
ScrollTrigger.refresh();

requestAnimationFrame(loop);

}  // end boot

// paint the DOM first, then start the WebGL scenes
requestAnimationFrame(() => requestAnimationFrame(boot));
