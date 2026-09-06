/* chapters.js — phase 2 chapter choreography.
 *
 * For each chapter section (origin, polymer, casting, cnc, slicer):
 *  - pins the .ch-pin viewport with a scrubbed ScrollTrigger and, over that pin, travels
 *    the chapter's cube from the cloud to its parking side and back (cubes.chapterPark);
 *  - reveals the category word (blink glyphs), sub-list and story on enter;
 *  - wires "Read the full breakdown" to a full-screen reading panel with Escape/Close,
 *    body-scroll lock via Lenis.stop(), and scroll position restored on close.
 */

function splitWord(el) {
  const text = el.textContent;
  el.setAttribute('aria-label', text);   // read as a word, not letter by letter
  el.textContent = '';
  let d = 0;
  for (const ch of text) {
    const g = document.createElement('span');
    g.className = 'glyph';
    g.setAttribute('aria-hidden', 'true');
    g.textContent = ch;
    g.style.animationDelay = (d * 18) + 'ms';
    el.appendChild(g);
    if (ch !== ' ') d++;
  }
}

export function initChapters({ gsap, ScrollTrigger, cubes, lenis, reduced, initManifestoStack }) {
  const sections = Array.from(document.querySelectorAll('.ch'));
  const mobile = window.innerWidth < 820;   // phone/tablet: no pins, cubes stay a faint cloud

  sections.forEach((section) => {
    const word = section.querySelector('.ch-word');
    if (word) splitWord(word);
    const cubeIndex = parseInt(section.dataset.cube, 10);
    const side = section.dataset.side === 'left' ? 'left' : 'right';
    const raymond = section.id === 'raymond';
    const sysItems = raymond ? Array.from(section.querySelectorAll('.ray-sys')) : [];
    const parkOpts = raymond ? { scale: 2.2, tumble: 0 } : undefined;

    // reveal on enter (once)
    ScrollTrigger.create({
      trigger: section, start: 'top 72%', once: true,
      onEnter: () => { section.classList.add('in'); if (word) word.classList.add('reveal'); },
    });

    if (reduced || mobile) {
      // static: no pin, everything visible, cubes stay in the cloud (dimmed on mobile via CSS)
      section.classList.add('in');
      if (word) word.classList.add('reveal');
      sysItems.forEach((el) => el.classList.add('shown'));
      return;
    }

    // pin the hero moment and travel the cube across it (origin dims the whole cloud)
    const pin = section.querySelector('.ch-pin');
    ScrollTrigger.create({
      trigger: section,
      start: 'top top',
      end: raymond ? '+=220%' : '+=100%',
      pin: pin,
      pinSpacing: true,
      scrub: 0.6,
      onUpdate: (self) => {
        const p = self.progress;
        if (raymond) {
          // park and hold across the whole pin, release at the very end; reveal systems
          const t = p < 0.9 ? Math.min(1, p / 0.14) : Math.max(0, 1 - (p - 0.9) / 0.1);
          cubes.chapterPark(cubeIndex, side, t, parkOpts);
          sysItems.forEach((el, k) => el.classList.toggle('shown', p > 0.12 + k * 0.1));
        } else if (cubeIndex >= 0) {
          cubes.chapterPark(cubeIndex, side, Math.sin(p * Math.PI));
        } else {
          cubes.chapterDim(Math.sin(p * Math.PI));
        }
      },
      onLeave: () => { cubeIndex >= 0 ? cubes.chapterPark(cubeIndex, side, 0) : cubes.chapterDim(0); },
      onLeaveBack: () => { cubeIndex >= 0 ? cubes.chapterPark(cubeIndex, side, 0) : cubes.chapterDim(0); },
    });
  });

  // ---- Other work: cubes 5,6,7 follow the DOM anchors above the three columns ----
  const others = document.getElementById('others');
  if (others && !reduced && !mobile) {
    const trio = Array.from(others.querySelectorAll('.oth-anchor'))
      .map((el) => ({ i: parseInt(el.dataset.cube, 10), el, scale: 0.95 }));
    ScrollTrigger.create({
      trigger: others, start: 'top bottom', end: 'bottom top',
      onEnter: () => cubes.setTrack(trio),
      onEnterBack: () => cubes.setTrack(trio),
      onLeave: () => cubes.setTrack([]),
      onLeaveBack: () => cubes.setTrack([]),
    });
  }

  // ---- About: fade the photo cubes out over the manifesto, so the plume + wireframe
  // stack carry it; bring them back for the contact reassembly ----
  if (!reduced && !mobile) {
    ScrollTrigger.create({
      trigger: '#about', start: 'top 70%', endTrigger: '#contact', end: 'top 80%',
      onToggle: (self) => document.body.classList.toggle('hide-cubes', self.isActive),
    });
  }

  // ---- Contact: cubes glide back into the sorted grid as contact enters ----
  const contact = document.getElementById('contact');
  if (contact && !reduced) {
    gsap.to({ p: 1 }, {
      p: 0, ease: 'none',
      scrollTrigger: { trigger: contact, start: 'top 85%', end: 'bottom bottom', scrub: 0.6 },
      onUpdate: function () { cubes.setUnravel(this.targets()[0].p); },
    });
  }

  // ---- Mobile: fade the cube canvas to a faint cloud between the hero grid and the
  // contact grid (opacity .25), so stacked chapter text stays readable ----
  if (mobile && !reduced) {
    ScrollTrigger.create({
      trigger: '#origin', start: 'top 80%', endTrigger: '#contact', end: 'top 60%',
      onToggle: (self) => document.body.classList.toggle('m-dim', self.isActive),
    });
  }

  // ---- manifesto wireframe cube stack ----
  const stackEl = document.querySelector('.manifesto-stack');
  if (stackEl && initManifestoStack) initManifestoStack(stackEl, !reduced);

  // ---- reading panels ----
  const panels = document.getElementById('panels');
  let savedScroll = 0;
  let openPanel = null;
  let lastTrigger = null;

  function open(name) {
    const panel = document.getElementById('panel-' + name);
    if (!panel) return;
    lastTrigger = document.activeElement;
    savedScroll = window.scrollY;
    panel.hidden = false;
    requestAnimationFrame(() => panel.classList.add('open'));
    panel.querySelector('.panel-scroll').scrollTop = 0;
    if (lenis) lenis.stop();
    document.documentElement.style.overflow = 'hidden';
    openPanel = panel;
    const close = panel.querySelector('.panel-close');
    if (close) close.focus();
    panels.setAttribute('aria-hidden', 'false');
  }

  function close() {
    if (!openPanel) return;
    const panel = openPanel;
    panel.classList.remove('open');
    document.documentElement.style.overflow = '';
    if (lenis) { lenis.start(); lenis.scrollTo(savedScroll, { immediate: true }); }
    else window.scrollTo(0, savedScroll);
    setTimeout(() => { panel.hidden = true; }, 360);
    openPanel = null;
    panels.setAttribute('aria-hidden', 'true');
    if (lastTrigger && lastTrigger.focus) lastTrigger.focus();   // return focus to opener
  }

  // trap Tab within the open dialog
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Tab' || !openPanel) return;
    const f = openPanel.querySelectorAll('button, a[href], [tabindex]:not([tabindex="-1"])');
    if (!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });

  document.querySelectorAll('.ch-open, .ray-open').forEach((btn) => {
    btn.addEventListener('click', () => open(btn.dataset.panel));
  });
  document.querySelectorAll('.panel-close').forEach((btn) => {
    btn.addEventListener('click', close);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && openPanel) close();
  });

  // expose for the click test
  window.__v2panel = { open, close, isOpen: () => !!openPanel };
}
