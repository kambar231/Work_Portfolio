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

window.gsap = gsap;                       // let cubes.js use GSAP for setState/focus
gsap.registerPlugin(ScrollTrigger);

const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const moving = !reduced;

// ---- smooth scroll ----
let lenis = null;
if (!reduced) {
  lenis = new Lenis({ lerp: 0.1 });
  lenis.on('scroll', ScrollTrigger.update);
}

// ---- scenes ----
const particles = createParticles();
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
if (!reduced) {
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
  cubes.setUnravel(0);
}

// ---- chapters (phase 2 + 3) ----
initChapters({ gsap, ScrollTrigger, cubes, lenis, reduced, initManifestoStack });

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
  const mid = window.scrollY + window.innerHeight * 0.5;
  let cur = 0;
  chapterSecs.forEach((s, i) => { if (s.offsetTop <= mid) cur = i; });
  progressNum.textContent = String(cur).padStart(2, '0');
  progressNum.style.top = (p * 100) + 'vh';
}

// Persistent cloud dim: while any chapter text (origin..websites) is on screen the
// non-parked cubes stay <=0.35 opacity so they never compete with the text. Off in the
// hero (bright unravel) and from the manifesto on (dark band + contact reassembly).
if (!reduced) {
  ScrollTrigger.create({ trigger: '#origin', start: 'top 85%',
    onEnter: () => cubes.setCloudDim(1), onLeaveBack: () => cubes.setCloudDim(0) });
  ScrollTrigger.create({ trigger: '#contact', start: 'top 75%',
    onEnter: () => cubes.setCloudDim(0), onLeaveBack: () => cubes.setCloudDim(1) });
}

// verifier hook: parked-cube box vs a chapter's text column
window.__v2.parkCube = (i, side, t) => { cubes.setUnravel(1); cubes.chapterPark(i, side, t); };
window.__v2.meshBox = (i) => cubes.meshBox(i);
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

// ---- click a cube -> scroll to its chapter (raycast; ignore clicks on links) ----
window.addEventListener('click', (e) => {
  if (e.target.closest('a, button')) return;
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

  // count rAF for 5 s after load; if under 50 fps, halve the particle count
  if (!fpsChecked) {
    fpsFrames++;
    if (now - fpsStart >= 5000) {
      const fps = (fpsFrames * 1000) / (now - fpsStart);
      console.log('[v2] measured fps over 5s:', fps.toFixed(1), '| particles:', particles.getCount());
      if (fps < 50) {
        particles.halveCount();
        console.log('[v2] fps under 50, halved particle count to', particles.getCount());
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
  el.textContent = '';
  let d = 0;
  const words = text.split(' ');
  words.forEach((word, wi) => {
    // each word is a nowrap unit so lines only ever break at spaces, never inside a word
    const wspan = document.createElement('span');
    wspan.className = 'word';
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
