/* chapters.js — reading-panel manager.
 *
 * Wires every "Read the full breakdown" opener (.ch-open, .ray-open, and the projects
 * cards' Full breakdown button via window.__v2panel) to a full-screen reading panel with
 * Escape/Close, a focus trap, body-scroll lock via Lenis.stop(), and scroll position
 * restored on close. The round-2 page has no pinned chapter sections, so that choreography
 * was removed; only the panels remain.
 */
export function initChapters({ lenis }) {
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

  // expose for the projects cards and the click test
  window.__v2panel = { open, close, isOpen: () => !!openPanel };
}
