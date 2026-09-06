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
import { initManifestoStack } from './manifesto.js';
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

// ---- chapters (phase 2 + 3) ----
initChapters({ gsap, ScrollTrigger, cubes, lenis, reduced, initManifestoStack });

// ---- variable cam timing diagram (experience section) ----
const vctEl = document.querySelector('.vct');
if (vctEl) createVct(vctEl, !reduced);

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
        if (p < 0.6) m = p2(p / 0.6);
        else if (p < 0.75) m = 1;
        else m = 1 - p2((p - 0.75) / 0.25);
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

// verifier hook: parked-cube box vs a chapter's text column
window.__v2.parkCube = (i, side, t) => { cubes.setUnravel(1); cubes.chapterPark(i, side, t); };
window.__v2.meshBox = (i) => cubes.meshBox(i);
window.__v2.setMorph = (k, v) => particles.setMorph(k, v);
window.__v2.morphBox = (k) => particles.morphBox(k);
window.__v2.allCubes = () => Array.from({ length: cubes.count }, (_, i) => ({ box: cubes.meshBox(i), op: cubes.cubeOpacity(i) }));
window.__v2.state = () => cubes.getState();

window.__v2.scrollToY = (y) => { if (lenis) lenis.scrollTo(y, { immediate: true }); else window.scrollTo(0, y); };
window.__lenis = lenis;
window.__v2.textColBox = (sel) => {
  const el = document.querySelector(sel + ' .ch-inner');
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { x: r.x, y: r.y, w: r.width, h: r.height };
};

// ---- cursor parallax for the cubes ----
window.addEventListener('pointermove', (e) => {
  const nx = (e.clientX / window.innerWidth) * 2 - 1;
  const ny = (e.clientY / window.innerHeight) * 2 - 1;
  cubes.setPointer(nx, ny);
}, { passive: true });

// ---- click a cube -> scroll to its chapter (desktop only; mobile cubes are not hit-tested) ----
window.addEventListener('click', (e) => {
  if (mobile || e.target.closest('a, button')) return;
  const ndc = {
    x: (e.clientX / window.innerWidth) * 2 - 1,
    y: -(e.clientY / window.innerHeight) * 2 + 1,
  };
  const i = cubes.raycast(ndc);
  if (i >= 0) scrollToSection(cubes.sectionFor(i));
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

// ---- master loop + FPS guard ----
let last = performance.now();
let fpsStart = last, fpsFrames = 0, fpsChecked = false;

function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (lenis) lenis.raf(now);
  particles.frame(now, dt, scrollProgress(), moving);
  cubes.frame(now, dt, moving);
  updateProgress();
  updateMobileDim();

  // count rAF for 5 s after load; if under 50 fps, halve the particle count
  if (!fpsChecked) {
    fpsFrames++;
    if (now - fpsStart >= 5000) {
      const fps = (fpsFrames * 1000) / (now - fpsStart);
      console.log('[v2] measured fps over 5s:', fps.toFixed(1), '| particles:', particles.getCount());
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

// Lenis drives native window scroll, so ScrollTrigger needs no scrollerProxy; a
// refresh after layout settles keeps the 120vh trigger measured correctly.
window.addEventListener('load', () => ScrollTrigger.refresh());
ScrollTrigger.refresh();

requestAnimationFrame(loop);

}  // end boot

// paint the DOM first, then start the WebGL scenes
requestAnimationFrame(() => requestAnimationFrame(boot));
