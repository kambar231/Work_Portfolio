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
  // Contact: the eight cubes glide from the drift back into the sorted grid (labels return
  // with the unravel) as contact scrolls in.
  const contactReassemble = document.getElementById('contact');
  if (contactReassemble && !reduced && !mobile) {
    gsap.to({ p: 1 }, {
      p: 0, ease: 'none',
      scrollTrigger: { trigger: contactReassemble, start: 'top 90%', end: 'bottom bottom', scrub: 0.6 },
      onUpdate: function () { cubes.setUnravel(this.targets()[0].p); },
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

// Persistent cloud dim: while any chapter text (origin..websites) is on screen the
// non-parked cubes stay <=0.35 opacity so they never compete with the text. Off in the
// hero (bright unravel) and from the manifesto on (dark band + contact reassembly).
if (!reduced && !mobile) {
  ScrollTrigger.create({ trigger: '#experience', start: 'top 85%',
    onEnter: () => cubes.setCloudDim(1), onLeaveBack: () => cubes.setCloudDim(0) });
  ScrollTrigger.create({ trigger: '#contact', start: 'top 30%',
    onEnter: () => cubes.setCloudDim(0), onLeaveBack: () => cubes.setCloudDim(1) });
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
    const expCol = expSec.querySelector('.exp2-col');
    ScrollTrigger.create({
      trigger: expSec, start: 'top top', end: '+=180%', pin: expSec.querySelector('.exp2-pin'),
      pinSpacing: true, scrub: 0.8,
      onUpdate: (self) => {
        const p = self.progress;
        let m;
        if (p < 0.45) m = p2(p / 0.45);        // assemble from dust over the first 45%
        else if (p < 0.80) m = 1;              // hold the truck formed and crisp 45-80%
        else m = 1 - p2((p - 0.80) / 0.20);    // dissolve back to dust across the last 20%
        particles.setMorph(0, m);
        expSec.classList.toggle('seen', p > 0.02);
        lines.forEach((el, k) => el.classList.toggle('in', p > 0.08 + k * 0.045));
        // the drifting cubes part around the experience copy while it is on screen
        if (expCol && cubes.setExclude) {
          const r = expCol.getBoundingClientRect();
          cubes.setExclude([{ x: r.x, y: r.y, w: r.width, h: r.height }]);
        }
      },
      onLeave: () => { particles.setMorph(0, 0); if (cubes.setExclude) cubes.setExclude([]); },
      onLeaveBack: () => { particles.setMorph(0, 0); if (cubes.setExclude) cubes.setExclude([]); },
    });
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
    const slCol = slSec.querySelector('.exp2-col');
    ScrollTrigger.create({
      trigger: slSec, start: 'top top', end: '+=160%', pin: slSec.querySelector('.exp2-pin'),
      pinSpacing: true, scrub: 0.8,
      onUpdate: (self) => {
        const p = self.progress;
        // morph on quickly, hold while the stack builds, dissolve back to dust over the last 25%
        let m;
        if (p < 0.12) m = p2s(p / 0.12);
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
        if (slCol && cubes.setExclude) {
          const r = slCol.getBoundingClientRect();
          cubes.setExclude([{ x: r.x, y: r.y, w: r.width, h: r.height }]);
        }
      },
      onLeave: () => { particles.setMorph(1, 0); if (hair) hair.style.opacity = '0'; if (cubes.setExclude) cubes.setExclude([]); },
      onLeaveBack: () => { particles.setMorph(1, 0); if (hair) hair.style.opacity = '0'; if (cubes.setExclude) cubes.setExclude([]); },
    });
  }
}

// ---- Projects: cubes settle into a grid; click one to unfold its six-face net ----
const projSec = document.querySelector('#projects');
if (projSec) {
  const cardsEl = document.getElementById('project-cards');
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
  const cardByFace = {};

  function buildCards(i) {
    openIdx = i;
    const d = bySlot[i] || { title: cubes.labelFor(i), year: '', one: '', designed: '', analyzed: '', built: '', proved: '', key: '', tools: '', panel: '' };
    cardsEl.innerHTML = '';
    FACES.forEach((f) => {
      const el = document.createElement('div');
      el.className = 'pc pc-' + f.key;
      el.innerHTML = f.build(d);
      if (f.key === 'back' && d.panel) {
        const b = document.createElement('button');
        b.type = 'button'; b.className = 'pc-full'; b.textContent = 'Full breakdown';
        b.addEventListener('click', () => { if (window.__v2panel) window.__v2panel.open(d.panel); });
        el.appendChild(b);
      }
      cardsEl.appendChild(el);
      cardByFace[f.key] = el;
    });
    cardsEl.setAttribute('aria-hidden', 'false');
  }
  function positionCards() {
    const a = cubes.faceAnchors();
    if (!a) return;
    for (const key in cardByFace) {
      const el = cardByFace[key]; const p = a[key];
      if (!p) continue;
      el.style.transform = `translate(-50%, -50%) translate(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px)`;
      el.style.opacity = Math.max(0, (p.vis - 0.35) / 0.65).toFixed(2);
    }
  }
  let cardRAF = 0;
  function tickCards() { positionCards(); if (cubes.projectOpenIndex() >= 0 || cubes.faceAnchors()) cardRAF = requestAnimationFrame(tickCards); }

  const scrim = document.getElementById('project-scrim');
  cubes.setProjectHandlers(
    (i) => { buildCards(i); closeBtn.hidden = false; head.classList.add('dim');
      if (scrim) scrim.classList.add('on'); document.body.classList.add('cube-open');
      cancelAnimationFrame(cardRAF); tickCards(); },
    () => { closeBtn.hidden = true; head.classList.remove('dim');
      if (scrim) scrim.classList.remove('on'); document.body.classList.remove('cube-open');
      setTimeout(() => { cancelAnimationFrame(cardRAF); cardsEl.innerHTML = ''; cardsEl.setAttribute('aria-hidden', 'true'); }, 950); },
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
  const st = ScrollTrigger.getAll().find((s) => s.trigger && s.trigger.id === id && s.pin);
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
const TEXT_SEL = '.display,.hero-sub,.exp-word,.exp2-head,.exp2-systems,.exp2-ach,.exp2-prev,'
  + '.slicer-story,.slicer-key,.ev-strip,.flat-head,.projects-head,.web-lead,.web-tiles,.ds-left,.edu,.contact-inner';
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
  cubes.setTextRects(rects);
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
