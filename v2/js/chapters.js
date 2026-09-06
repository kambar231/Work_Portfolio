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
  el.textContent = '';
  let d = 0;
  for (const ch of text) {
    const g = document.createElement('span');
    g.className = 'glyph';
    g.textContent = ch;
    g.style.animationDelay = (d * 18) + 'ms';
    el.appendChild(g);
    if (ch !== ' ') d++;
  }
}

export function initChapters({ gsap, ScrollTrigger, cubes, lenis, reduced }) {
  const sections = Array.from(document.querySelectorAll('.ch'));
  const mobile = window.innerWidth < 760;   // on phones: no pin, cubes stay a faint cloud

  sections.forEach((section) => {
    const word = section.querySelector('.ch-word');
    if (word) splitWord(word);
    const cubeIndex = parseInt(section.dataset.cube, 10);
    const side = section.dataset.side === 'left' ? 'left' : 'right';

    // reveal on enter (once)
    ScrollTrigger.create({
      trigger: section,
      start: 'top 72%',
      once: true,
      onEnter: () => {
        section.classList.add('in');
        if (word) word.classList.add('reveal');
      },
    });

    if (reduced || mobile) {
      // static: no pin, everything visible, cubes stay in the cloud (dimmed on mobile via CSS)
      section.classList.add('in');
      if (word) word.classList.add('reveal');
      return;
    }

    // pin the hero moment and travel the cube across it (origin dims the whole cloud)
    const pin = section.querySelector('.ch-pin');
    ScrollTrigger.create({
      trigger: section,
      start: 'top top',
      end: '+=100%',
      pin: pin,
      pinSpacing: true,
      scrub: 0.6,
      onUpdate: (self) => {
        const t = Math.sin(self.progress * Math.PI); // 0 in, 1 mid, 0 out
        if (cubeIndex >= 0) cubes.chapterPark(cubeIndex, side, t);
        else cubes.chapterDim(t);
      },
      onLeave: () => { cubeIndex >= 0 ? cubes.chapterPark(cubeIndex, side, 0) : cubes.chapterDim(0); },
      onLeaveBack: () => { cubeIndex >= 0 ? cubes.chapterPark(cubeIndex, side, 0) : cubes.chapterDim(0); },
    });
  });

  // ---- reading panels ----
  const panels = document.getElementById('panels');
  let savedScroll = 0;
  let openPanel = null;

  function open(name) {
    const panel = document.getElementById('panel-' + name);
    if (!panel) return;
    savedScroll = window.scrollY;
    panel.hidden = false;
    // next frame so the transition runs
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
  }

  document.querySelectorAll('.ch-open').forEach((btn) => {
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
