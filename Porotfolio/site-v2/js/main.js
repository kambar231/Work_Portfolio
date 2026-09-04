/* ============================================================
   KAMBAR MANGIBAYEV — cinematic scroll portfolio
   ============================================================ */
(function () {
  "use strict";
  const $  = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const hasGSAP = typeof window.gsap !== "undefined";
  const hasLenis = typeof window.Lenis !== "undefined";
  if (hasGSAP && window.ScrollTrigger) gsap.registerPlugin(ScrollTrigger);

  /* ---------- FRAME SEQUENCE CONFIG ---------- */
  const FRAME_COUNT = 120;
  const framePath = i => `assets/seq/frame_${String(i).padStart(3, "0")}.jpg`;
  const frames = [];
  let loaded = 0;

  /* ====================================================
     1. PRELOADER / BOOT
     ==================================================== */
  const pre = $("#preloader");
  const fill = $("#pre-fill");
  const enterBtn = $("#enter-btn");

  function setProgress(p) {
    p = Math.min(100, Math.round(p));
    if (fill) fill.style.width = p + "%";
  }

  // preload frames; progress drives the boot bar
  frames.length = 0;
  for (let i = 0; i < FRAME_COUNT; i++) {
    const img = new Image();
    img.onload = img.onerror = () => {
      loaded++;
      setProgress((loaded / FRAME_COUNT) * 100);
      if (loaded === FRAME_COUNT) ready();
    };
    img.src = framePath(i);
    frames.push(img);
  }
  // safety: never hang on the gate
  setTimeout(() => { if (loaded < FRAME_COUNT) ready(); }, 6000);

  let didReady = false;
  function ready() {
    if (didReady) return;
    didReady = true;
    setProgress(100);
    setTimeout(() => enterBtn.classList.add("show"), 400);
  }

  enterBtn.addEventListener("click", enter);
  let entered = false;
  function enter() {
    if (entered) return;
    entered = true;
    if (hasGSAP && !reduce) {
      gsap.to(pre, { autoAlpha: 0, duration: 0.8, ease: "power2.inOut",
        onComplete: () => { pre.style.display = "none"; } });
    } else {
      pre.style.display = "none";
    }
    $("#rail").classList.add("show");
    $("#topbar").classList.add("show");
    revealHero();
    document.documentElement.classList.add("entered");
  }

  /* ====================================================
     2. SMOOTH SCROLL (Lenis) + ScrollTrigger sync
     ==================================================== */
  let lenis = null;
  if (hasLenis && !reduce) {
    lenis = new Lenis({ duration: 1.1, smoothWheel: true,
      easing: t => Math.min(1, 1.001 - Math.pow(2, -10 * t)) });
    lenis.on("scroll", () => { if (window.ScrollTrigger) ScrollTrigger.update(); });
    if (hasGSAP) {
      gsap.ticker.add(t => lenis.raf(t * 1000));
      gsap.ticker.lagSmoothing(0);
    } else {
      const raf = t => { lenis.raf(t); requestAnimationFrame(raf); };
      requestAnimationFrame(raf);
    }
  }
  function scrollToId(id) {
    const el = document.getElementById(id);
    if (!el) return;
    if (lenis) lenis.scrollTo(el, { offset: 0, duration: 1.2 });
    else el.scrollIntoView({ behavior: reduce ? "auto" : "smooth" });
  }

  /* ====================================================
     3. HERO REVEAL
     ==================================================== */
  function revealHero() {
    const items = $$("#boot .reveal").sort((a, b) =>
      (+a.dataset.d || 0) - (+b.dataset.d || 0));
    if (!hasGSAP || reduce) { items.forEach(i => (i.style.opacity = 1)); return; }
    gsap.fromTo(items,
      { y: 34, opacity: 0 },
      { y: 0, opacity: 1, duration: 1, ease: "power3.out", stagger: 0.12 });
  }

  /* ====================================================
     4. BUILD: scroll-scrubbed CNC canvas
     ==================================================== */
  const canvas = $("#cnc-canvas");
  const ctx = canvas.getContext("2d");
  let cw = 0, ch = 0;
  function sizeCanvas() {
    const r = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    cw = Math.round(r.width * dpr);
    ch = Math.round(r.height * dpr);
    canvas.width = cw; canvas.height = ch;
    drawFrame(curFrame);
  }
  let curFrame = 0;
  function drawFrame(i) {
    i = Math.max(0, Math.min(FRAME_COUNT - 1, Math.round(i)));
    curFrame = i;
    const img = frames[i];
    if (!img || !img.complete || !img.naturalWidth) return;
    // cover fit
    const ir = img.naturalWidth / img.naturalHeight;
    const cr = cw / ch;
    let dw, dh, dx, dy;
    if (ir > cr) { dh = ch; dw = ch * ir; dx = (cw - dw) / 2; dy = 0; }
    else { dw = cw; dh = cw / ir; dx = 0; dy = (ch - dh) / 2; }
    ctx.clearRect(0, 0, cw, ch);
    ctx.drawImage(img, dx, dy, dw, dh);
  }

  function initBuildScrub() {
    sizeCanvas();
    window.addEventListener("resize", sizeCanvas);
    if (!hasGSAP || !window.ScrollTrigger || reduce) {
      drawFrame(FRAME_COUNT - 1);
      $$(".bcap").forEach(c => (c.style.opacity = 1));
      return;
    }
    const stage = $(".build-stage");
    const obj = { f: 0 };
    ScrollTrigger.create({
      trigger: stage,
      start: "top top",
      end: "bottom bottom",
      scrub: 0.6,
      onUpdate: self => {
        const p = self.progress;
        drawFrame(p * (FRAME_COUNT - 1));
        // caption crossfade (desktop only; mobile shows a single static caption)
        const c0 = $('.bcap[data-step="0"]');
        const c1 = $('.bcap[data-step="1"]');
        if (c0 && c1 && window.innerWidth > 900) {
          const t = (p - 0.45) / 0.2; // transition window
          const o1 = Math.max(0, Math.min(1, t));
          c0.style.opacity = (1 - o1).toFixed(3);
          c1.style.opacity = o1.toFixed(3);
        }
        const ro = $("#vp-readout");
        if (ro) ro.textContent = p > 0.5 ? "cutting" : "running";
      },
    });
    // initial states
    gsap.set('.bcap[data-step="0"]', { opacity: 1 });
    gsap.set('.bcap[data-step="1"]', { opacity: 0 });
  }

  /* ====================================================
     5. SCROLL REVEALS (phases, cards, sims)
     ==================================================== */
  function initReveals() {
    if (!hasGSAP || !window.ScrollTrigger || reduce) {
      $$(".reveal-card,.ph-tag,.ph-title,.ph-sub").forEach(e => (e.style.opacity = 1));
      return;
    }
    // headings
    $$(".phase").forEach(sec => {
      const head = $$(".ph-tag,.ph-title,.ph-sub", sec);
      if (head.length)
        gsap.from(head, {
          scrollTrigger: { trigger: sec, start: "top 78%" },
          y: 30, opacity: 0, duration: 0.9, ease: "power3.out", stagger: 0.1,
        });
    });
    // cards / sims
    $$(".reveal-card").forEach(card => {
      gsap.from(card, {
        scrollTrigger: { trigger: card, start: "top 85%" },
        y: 40, opacity: 0, duration: 0.8, ease: "power3.out",
      });
    });
  }

  /* ====================================================
     6. ORIGIN map route draw
     ==================================================== */
  function initOrigin() {
    const route = $(".map-route");
    if (!route) return;
    const len = route.getTotalLength ? route.getTotalLength() : 600;
    route.style.strokeDasharray = len;
    if (!hasGSAP || !window.ScrollTrigger || reduce) { route.style.strokeDashoffset = 0; return; }
    route.style.strokeDashoffset = len;
    gsap.to(route, {
      scrollTrigger: { trigger: "#origin", start: "top 65%" },
      strokeDashoffset: 0, duration: 1.6, ease: "power2.inOut",
    });
    gsap.from(".map-node", {
      scrollTrigger: { trigger: "#origin", start: "top 60%" },
      opacity: 0, scale: 0.4, transformOrigin: "center", duration: 0.6, stagger: 0.4, delay: 0.4,
    });
  }

  /* ====================================================
     7. SIMULATE traces
     ==================================================== */
  function initSims() {
    if (!hasGSAP || !window.ScrollTrigger || reduce) return;
    $$(".sim-viz").forEach(v => {
      const traces = $$(".trace", v);
      traces.forEach(p => {
        if (!p.getTotalLength) return;
        const L = p.getTotalLength();
        p.style.strokeDasharray = L;
        p.style.strokeDashoffset = L;
        gsap.to(p, {
          scrollTrigger: { trigger: v, start: "top 82%" },
          strokeDashoffset: 0, duration: 1.4, ease: "power2.out",
        });
      });
      const stress = $(".stress", v);
      if (stress) gsap.to(stress, { scrollTrigger: { trigger: v, start: "top 82%" },
        strokeDashoffset: 0, duration: 1.4, ease: "power2.out" });
    });
  }

  /* ====================================================
     8. DEPLOY flow sequence
     ==================================================== */
  function initDeploy() {
    const nodes = $$(".flow-node");
    if (!nodes.length) return;
    if (!hasGSAP || !window.ScrollTrigger || reduce) { nodes.forEach(n => n.classList.add("on")); return; }
    nodes.forEach((n, i) => {
      ScrollTrigger.create({
        trigger: "#deploy", start: "top 55%",
        onEnter: () => setTimeout(() => n.classList.add("on"), i * 420),
        onLeaveBack: () => n.classList.remove("on"),
      });
    });
  }

  /* ====================================================
     9. RAIL active state + fill + nav
     ==================================================== */
  function initRail() {
    const railFill = $("#rail-fill");
    const lis = $$("#rail .rail-list li");
    lis.forEach(li => li.addEventListener("click", () => scrollToId(li.dataset.go)));
    $$('#topbar a, .top-cta').forEach(a => {
      a.addEventListener("click", e => {
        const href = a.getAttribute("href");
        if (href && href.startsWith("#")) { e.preventDefault(); scrollToId(href.slice(1)); }
      });
    });
    function update() {
      const h = document.documentElement;
      const max = h.scrollHeight - h.clientHeight;
      const p = max > 0 ? window.scrollY / max : 0;
      if (railFill) railFill.style.height = (p * 100) + "%";
      // active section
      const secs = ["boot","origin","foundation","build","simulate","deploy","hub"];
      let active = 0;
      secs.forEach((id, i) => {
        const el = document.getElementById(id);
        if (el && el.getBoundingClientRect().top <= window.innerHeight * 0.45) active = i;
      });
      lis.forEach((li, i) => li.classList.toggle("active", i === active));
    }
    if (lenis) lenis.on("scroll", update);
    window.addEventListener("scroll", update, { passive: true });
    update();
  }

  /* ====================================================
     10. HUB grid + modal
     ==================================================== */
  const projects = [
    { id:"printnc", cat:"Build · CNC", title:"PrintNC Router",
      img:"assets/img/printnc_t.png", meta:["Steel + printed","CAD → G-code","Personal build"],
      body:"I wanted a machine that could handle more than just wood, so I built the PrintNC — a hybrid using a heavy steel frame for rigidity and 3D-printed parts for precision alignment. An industrial-grade router you can build on the third floor of an apartment complex. (Don't tell my landlord.)" },
    { id:"slicer", cat:"Python · Toolpaths", title:"3D Slicer & G-code Generator",
      img:"assets/img/slicer2.jpg", meta:["Python","STL → G-code","Research foundation"],
      body:"Architected a custom STL-to-G-code pipeline from the ground up — the foundation for a larger research initiative on support reduction via non-standard slicing angles. Replicating slicing mechanics in Python gave me total control over toolpath generation, a prerequisite for support-minimization algorithms off-the-shelf software can't accommodate." },
    { id:"print3d", cat:"Making · Prototyping", title:"3D Printing",
      img:"assets/img/print3d.jpg", meta:["Iterate fast","Prototype early","Learn by building"],
      body:"3D printing started as a hobby and became a foundation for how I engineer: iterate fast, prototype early, learn by building. As a broke college student, every print felt like “printing with diamonds” — so each iteration had to count." },
    { id:"pendulum", cat:"Simulation", title:"Double Pendulum",
      img:"", meta:["Theory + physical","Chaotic dynamics"],
      body:"A theoretical model of double-pendulum behavior under set initial conditions — validated against a physical build." },
    { id:"cannon", cat:"Simulation", title:"Vacuum Cannon",
      img:"", meta:["Exit-velocity model","Ping-pong projectile"],
      body:"A simulation model approximating ping-pong-ball exit velocity for a vacuum cannon." },
    { id:"flight", cat:"MATLAB · Simulink", title:"Flight Dynamics",
      img:"", meta:["9 aircraft","Euler + quaternion"],
      body:"Simulated 9 aircraft responses to varied conditions using Euler-angle and quaternion models in MATLAB + Simulink." },
    { id:"fea", cat:"Ansys · FEA", title:"Saturn V — F-1 Nozzle FEA",
      img:"", meta:["Ansys","7.5M lb thrust","Apollo 11"],
      body:"Finite Element Analysis in Ansys on the Rocketdyne F-1 engine nozzle (Saturn V / Apollo 11; 7.5M lb thrust) to verify no failure under operating stresses." },
    { id:"raymond", cat:"Current Role", title:"Mechanical Systems Engineer — Raymond",
      img:"assets/img/raymond.png", meta:["02/24 – Present","Controls + safety","Industrial vehicles"],
      body:"I design, implement and validate electromechanical and control systems for industrial vehicles. Led development of performance-stability and sensor-driven safety systems — including pedestrian detection and automated braking — delivering measurable gains in performance, energy efficiency and operational safety." },
  ];
  function initHub() {
    const grid = $("#hub-grid");
    projects.forEach((p, i) => {
      const node = document.createElement("div");
      node.className = "hub-node";
      node.innerHTML =
        `<div class="hn-arrow"><svg width="14" height="14" viewBox="0 0 14 14"><path d="M3 11L11 3M5 3h6v6" stroke="currentColor" stroke-width="1.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg></div>
         <span class="hn-id">${String(i + 1).padStart(2, "0")}</span>
         <div><span class="hn-cat">${p.cat}</span><h4>${p.title}</h4></div>`;
      node.addEventListener("click", () => openModal(p));
      grid.appendChild(node);
    });
    // Reveal: immediateRender:false guarantees nodes are NEVER left hidden,
    // even if the trigger doesn't fire. They animate up from below on enter.
    if (hasGSAP && window.ScrollTrigger && !reduce) {
      gsap.from(".hub-node", {
        scrollTrigger: { trigger: "#hub-grid", start: "top 92%", once: true },
        y: 26, opacity: 0, immediateRender: false, duration: 0.6,
        ease: "power3.out", stagger: 0.05, clearProps: "opacity,transform",
      });
    }
    // resume button (graceful if no file)
    $("#resume-btn").addEventListener("click", e => {
      e.preventDefault();
      alert("Add your resume PDF to the site folder and link it here.");
    });
  }

  const modal = $("#modal");
  function openModal(p) {
    $("#m-tag").textContent = p.cat;
    $("#m-title").textContent = p.title;
    $("#m-body").textContent = p.body;
    $("#m-media").innerHTML = p.img ? `<img src="${p.img}" alt="${p.title}">` : "";
    $("#m-meta").innerHTML = (p.meta || []).map(m => `<span>${m}</span>`).join("");
    modal.querySelector(".modal-card").classList.toggle("no-media", !p.img);
    modal.classList.add("open");
    document.body.classList.add("locked");
    if (lenis) lenis.stop();
  }
  function closeModal() {
    modal.classList.remove("open");
    document.body.classList.remove("locked");
    if (lenis) lenis.start();
  }
  $("#modal-x").addEventListener("click", closeModal);
  modal.addEventListener("click", e => { if (e.target === modal) closeModal(); });
  document.addEventListener("keydown", e => { if (e.key === "Escape") closeModal(); });

  /* ====================================================
     INIT
     ==================================================== */
  function init() {
    initBuildScrub();
    initReveals();
    initOrigin();
    initSims();
    initDeploy();
    initRail();
    initHub();
    if (hasGSAP && window.ScrollTrigger) ScrollTrigger.refresh();
  }
  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", init);
  else init();

  // If reduced motion, no gate animation but still allow enter
  if (reduce) { setProgress(100); enterBtn.classList.add("show"); }
})();
/* build: cinematic v1 */
                                                                                                                                                                                                                                                                                                                          