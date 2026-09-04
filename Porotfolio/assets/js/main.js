/* main.js — animations + interactions
   GSAP + Lenis loaded from CDN. Reveals use IntersectionObserver. */

(() => {
  const prefersReduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const ready = (fn) => document.readyState === "loading"
    ? document.addEventListener("DOMContentLoaded", fn) : fn();
  ready(init);

  function init() {
    // CSS fallback show: if JS is alive, this exposes data-reveal items unless GSAP overrides them
    setTimeout(() => document.body.classList.add("reveal-in"), 50);

    setupClock();
    setupNavStuck();
    setupBackToTop();

    if (prefersReduce) {
      // ensure everything is visible
      document.querySelectorAll(".hero__title .reveal").forEach(el => el.style.transform = "none");
      document.querySelectorAll("[data-reveal]").forEach(el => { el.style.opacity = 1; el.style.transform = "none"; });
      return;
    }

    setupLenis();
    setupCursor();
    setupHeroIntro();
    setupReveals();
    setupMagnetic();
  }

  function setupClock() {
    const el = document.getElementById("clock");
    if (!el) return;
    const tick = () => {
      const d = new Date();
      el.textContent = String(d.getHours()).padStart(2,"0") + ":" + String(d.getMinutes()).padStart(2,"0") + " LOCAL";
    };
    tick();
    setInterval(tick, 30000);
  }

  function setupNavStuck() {
    const nav = document.querySelector(".nav");
    if (!nav) return;
    const onScroll = () => nav.classList.toggle("is-stuck", window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
  }

  function setupBackToTop() {
    const btn = document.getElementById("toTop");
    if (!btn) return;
    btn.addEventListener("click", () => {
      if (window.lenis) window.lenis.scrollTo(0, { duration: 1.4 });
      else window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  function setupLenis() {
    if (typeof Lenis === "undefined") return;
    const lenis = new Lenis({
      duration: 1.15,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      smoothTouch: false,
    });
    window.lenis = lenis;
    function raf(time) { lenis.raf(time); requestAnimationFrame(raf); }
    requestAnimationFrame(raf);

    document.querySelectorAll('a[href^="#"]').forEach((a) => {
      a.addEventListener("click", (e) => {
        const href = a.getAttribute("href");
        if (!href || href === "#") return;
        const t = document.querySelector(href);
        if (!t) return;
        e.preventDefault();
        lenis.scrollTo(t, { offset: -60, duration: 1.3 });
      });
    });
  }

  function setupCursor() {
    const ring = document.querySelector(".cursor");
    const dot = document.querySelector(".cursor-dot");
    if (!ring || !dot) return;
    let mx = innerWidth/2, my = innerHeight/2, rx = mx, ry = my;
    addEventListener("mousemove", (e) => {
      mx = e.clientX; my = e.clientY;
      dot.style.transform = "translate3d(" + mx + "px," + my + "px,0) translate(-50%,-50%)";
    });
    (function loop() {
      rx += (mx - rx) * 0.18; ry += (my - ry) * 0.18;
      ring.style.transform = "translate3d(" + rx + "px," + ry + "px,0) translate(-50%,-50%)";
      requestAnimationFrame(loop);
    })();
    document.querySelectorAll("a, button, .work, .card").forEach((el) => {
      el.addEventListener("mouseenter", () => ring.classList.add("is-hover"));
      el.addEventListener("mouseleave", () => ring.classList.remove("is-hover"));
    });
  }

  function setupHeroIntro() {
    if (typeof gsap === "undefined") return;
    const tl = gsap.timeline({ defaults: { ease: "power3.out" }, delay: 0.15 });
    tl.to(".hero__title .reveal", { yPercent: -100, duration: 1.1, stagger: 0.09 }, 0)
      .from(".hero__meta",   { opacity: 0, y: 12, duration: 0.7 }, 0.4)
      .from(".hero__bottom", { opacity: 0, y: 16, duration: 0.7 }, 0.6)
      .from(".nav",          { opacity: 0, y: -12, duration: 0.6 }, 0.2);
  }

  function setupReveals() {
    if (typeof gsap === "undefined") return;

    const animate = (el, opts) => {
      const { delay = 0, y = 28 } = opts || {};
      gsap.fromTo(el, { opacity: 0, y: y }, { opacity: 1, y: 0, duration: 0.9, delay: delay, ease: "power3.out", overwrite: "auto" });
    };

    // generic data-reveal (skip hero)
    const reveals = Array.from(document.querySelectorAll("[data-reveal]"))
      .filter((el) => !el.closest(".hero"));

    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) { animate(e.target); io.unobserve(e.target); }
      });
    }, { rootMargin: "0px 0px -10% 0px", threshold: 0.05 });
    reveals.forEach((el) => io.observe(el));

    // staggered groups
    const group = (sel, parentSel, step, y) => {
      const parent = document.querySelector(parentSel);
      if (!parent) return;
      const items = Array.from(parent.querySelectorAll(sel));
      if (!items.length) return;
      const obs = new IntersectionObserver((entries, o) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            items.forEach((it, i) => animate(it, { delay: i * step, y: y }));
            o.disconnect();
          }
        });
      }, { rootMargin: "0px 0px -8% 0px", threshold: 0.05 });
      obs.observe(parent);
    };
    group(".work", "#worklist", 0.06, 24);
    group(".card", ".grid",     0.08, 30);

    // safety net: anything still hidden after 4s
    setTimeout(() => {
      document.querySelectorAll("[data-reveal], .work, .card").forEach((el) => {
        const op = parseFloat(getComputedStyle(el).opacity);
        if (!isNaN(op) && op < 0.05) gsap.to(el, { opacity: 1, y: 0, duration: 0.4 });
      });
    }, 4000);
  }

  function setupMagnetic() {
    document.querySelectorAll(".magnetic").forEach((el) => {
      const s = 18;
      el.addEventListener("mousemove", (e) => {
        const r = el.getBoundingClientRect();
        const x = e.clientX - (r.left + r.width/2);
        const y = e.clientY - (r.top + r.height/2);
        el.style.transform = "translate(" + (x/r.width)*s + "px," + (y/r.height)*s + "px)";
      });
      el.addEventListener("mouseleave", () => { el.style.transform = ""; });
    });
  }
})();

/* ---- video reel: lazy-load + play-on-visible ---- */
(function setupReel() {
  const ready = (fn) => document.readyState === "loading"
    ? document.addEventListener("DOMContentLoaded", fn) : fn();
  ready(() => {
    const videos = document.querySelectorAll("video[data-src]");
    if (!videos.length) return;

    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        const v = entry.target;
        if (entry.isIntersecting) {
          // attach the source the first time
          if (!v.dataset.loaded) {
            const src = v.dataset.src;
            const s = document.createElement("source");
            s.src = src;
            s.type = "video/mp4";
            v.appendChild(s);
            v.load();
            v.dataset.loaded = "1";
          }
          v.play().catch(() => { /* autoplay blocked, that's fine */ });
        } else {
          if (!v.paused) v.pause();
        }
      });
    }, { threshold: 0.35, rootMargin: "0px 0px -8% 0px" });

    videos.forEach((v) => io.observe(v));
  });
})();

/* ---- work-peek: hover-follow image preview on selected work rows ---- */
(function setupWorkPeek() {
  const ready = (fn) => document.readyState === "loading"
    ? document.addEventListener("DOMContentLoaded", fn) : fn();
  ready(() => {
    const peek = document.getElementById("workPeek");
    if (!peek) return;
    if (window.matchMedia("(hover: none)").matches) return;

    const works = document.querySelectorAll(".work[data-preview]");
    if (!works.length) return;

    let mx = 0, my = 0, tx = 0, ty = 0, on = false;

    works.forEach((row) => {
      const src = row.getAttribute("data-preview");
      // pre-load the image
      const pre = new Image(); pre.src = src;

      row.addEventListener("mouseenter", () => {
        peek.style.backgroundImage = "url('" + src + "')";
        peek.classList.add("is-on");
        on = true;
      });
      row.addEventListener("mouseleave", () => {
        peek.classList.remove("is-on");
        on = false;
      });
    });

    document.addEventListener("mousemove", (e) => {
      mx = e.clientX; my = e.clientY;
    });

    function loop() {
      tx += (mx - tx) * 0.14;
      ty += (my - ty) * 0.14;
      // offset to the right of cursor, vertically centered, but kept on-screen
      const w = peek.offsetWidth || 320;
      const h = peek.offsetHeight || 240;
      const pad = 24;
      let x = tx + 28;
      let y = ty - h / 2;
      if (x + w + pad > window.innerWidth)  x = tx - w - 28;
      if (y < pad) y = pad;
      if (y + h + pad > window.innerHeight) y = window.innerHeight - h - pad;
      peek.style.transform = "translate3d(" + x + "px," + y + "px,0) scale(" + (on ? 1 : 0.96) + ")";
      requestAnimationFrame(loop);
    }
    loop();
  });
})();
