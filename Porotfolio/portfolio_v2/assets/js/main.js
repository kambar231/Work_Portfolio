/* portfolio v.02 - Obys three-panel layout
   Scroll moves a strip of images past a fixed ( ) bracket.
   The centered image drives the left names list and right info panel. */
(function () {
  var reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  function ready(fn) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", fn);
    } else { fn(); }
  }
  ready(init);

  var PROJECTS = [];
  try {
    PROJECTS = JSON.parse(document.getElementById("data").textContent);
  } catch (e) { PROJECTS = []; }

  function init() {
    setupClock();
    if (reduce) {
      var p = document.getElementById("preload");
      if (p) p.classList.add("is-done");
      setupModes();
      setupNavScroll();
      setupActive();
      return;
    }
    runPreloader().then(function () {
      setupCursor();
      setupModes();
      setupNavScroll();
      setupActive();
    });
  }

  function setupClock() {
    var el = document.getElementById("clock");
    if (!el) return;
    function tick() {
      var d = new Date();
      var h = d.getHours();
      var m = d.getMinutes();
      var ap = h < 12 ? "AM" : "PM";
      var h12 = ((h + 11) % 12) + 1;
      el.textContent = "EST " + String(h12).padStart(2, "0") + ":" + String(m).padStart(2, "0") + " " + ap;
    }
    tick();
    setInterval(tick, 30000);
  }

  function runPreloader() {
    return new Promise(function (resolve) {
      var pre = document.getElementById("preload");
      var c = document.getElementById("preCount");
      if (!pre) return resolve();
      var n = 0;
      function tick() {
        var inc = Math.max(1, Math.floor((100 - n) / 9));
        n = Math.min(100, n + inc);
        if (c) c.textContent = String(n).padStart(2, "0");
        if (n < 100) {
          setTimeout(tick, 50 + Math.random() * 45);
        } else {
          setTimeout(function () {
            pre.classList.add("is-done");
            setTimeout(resolve, 700);
          }, 280);
        }
      }
      tick();
    });
  }

  function setupCursor() {
    var cur = document.querySelector(".cursor");
    if (!cur || matchMedia("(hover: none)").matches) return;
    var tx = 0, ty = 0, cx = 0, cy = 0;
    addEventListener("mousemove", function (e) { tx = e.clientX; ty = e.clientY; });
    (function loop() {
      cx += (tx - cx) * 0.25;
      cy += (ty - cy) * 0.25;
      cur.style.transform = "translate3d(" + cx + "px," + cy + "px,0) translate(-50%,-50%)";
      requestAnimationFrame(loop);
    })();
    document.addEventListener("mouseover", function (e) {
      if (e.target.closest("a, button, [data-label]")) cur.classList.add("is-hover");
    });
    document.addEventListener("mouseout", function (e) {
      if (e.target.closest("a, button, [data-label]")) cur.classList.remove("is-hover");
    });
  }

  function setupModes() {
    var btns = document.querySelectorAll(".modes__b");
    var altH = document.getElementById("altH");
    var altG = document.getElementById("altG");
    btns.forEach(function (b) {
      b.addEventListener("click", function () {
        var m = b.getAttribute("data-mode");
        btns.forEach(function (x, i) {
          var on = (x === b);
          x.classList.toggle("is-on", on);
          var name = x.getAttribute("data-mode");
          var label = name.charAt(0).toUpperCase() + name.slice(1);
          var sep = (i === btns.length - 1) ? "" : ",";
          x.innerHTML = on ? ("<u>" + label + "</u>" + sep) : (label + sep);
        });
        document.body.classList.toggle("is-horizontal", m === "horizontal");
        document.body.classList.toggle("is-grid", m === "grid");
        if (altH) altH.hidden = (m !== "horizontal");
        if (altG) altG.hidden = (m !== "grid");
      });
    });
  }

  function setupNavScroll() {
    document.querySelectorAll('a[href^="#"]').forEach(function (a) {
      a.addEventListener("click", function (e) {
        var href = a.getAttribute("href");
        if (!href || href === "#" || href === "#top") return;
        var t = document.querySelector(href);
        if (!t) return;
        e.preventDefault();
        t.scrollIntoView({ behavior: "smooth", block: "center" });
      });
    });
  }

  function setupActive() {
    var items = Array.prototype.slice.call(document.querySelectorAll(".strip__item"));
    var names = Array.prototype.slice.call(document.querySelectorAll(".names li"));
    if (!items.length) return;

    var iTitle  = document.getElementById("iTitle");
    var iDomain = document.getElementById("iDomain");
    var iSvc    = document.getElementById("iSvc");
    var iYear   = document.getElementById("iYear");
    var iNum    = document.getElementById("iNum");
    var iLede   = document.getElementById("iLede");

    var current = -1;
    function setActive(i) {
      if (i === current || i < 0 || i >= items.length) return;
      current = i;
      for (var k = 0; k < items.length; k++) {
        items[k].classList.toggle("is-on", k === i);
      }
      for (var k2 = 0; k2 < names.length; k2++) {
        names[k2].classList.toggle("is-on", k2 === i);
      }
      var p = PROJECTS[i];
      if (p) {
        if (iTitle)  iTitle.textContent  = p.t;
        if (iDomain) iDomain.textContent = p.d;
        if (iSvc)    iSvc.textContent    = p.s;
        if (iYear)   iYear.textContent   = p.y;
        if (iNum)    iNum.textContent    = String(i + 1).padStart(2, "0") + " / " + String(items.length).padStart(2, "0");
        if (iLede)   iLede.textContent   = p.l;
      }
    }

    names.forEach(function (el, k) {
      el.addEventListener("click", function (e) {
        var a = el.querySelector("a");
        if (a && a.getAttribute("href").indexOf("#") === 0) {
          e.preventDefault();
          var id = a.getAttribute("href");
          var t = document.querySelector(id);
          if (t) t.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      });
      el.addEventListener("mouseenter", function () { setActive(k); });
    });

    function pickActive() {
      var mid = innerHeight / 2;
      var best = 0, bestD = Infinity;
      for (var i = 0; i < items.length; i++) {
        var r = items[i].getBoundingClientRect();
        var c = (r.top + r.bottom) / 2;
        var d = Math.abs(c - mid);
        if (d < bestD) { bestD = d; best = i; }
      }
      setActive(best);
    }

    var raf = 0;
    function schedule() {
      if (raf) return;
      raf = requestAnimationFrame(function () { raf = 0; pickActive(); });
    }
    addEventListener("scroll", schedule, { passive: true });
    addEventListener("resize", schedule);
    pickActive();

    setTimeout(function () {
      if (window.scrollY < 4) {
        items[0].scrollIntoView({ behavior: "instant", block: "center" });
        pickActive();
      }
    }, 80);
  }
})();
