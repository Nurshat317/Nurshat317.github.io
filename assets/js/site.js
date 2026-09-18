/* nurshat317.github.io — small, dependency-free behaviours. */
(function () {
  "use strict";

  var root = document.documentElement;
  var header = document.getElementById("site-header");

  /* ---------- Theme toggle ---------- */
  var themeBtn = document.getElementById("theme-toggle");
  var darkQuery = window.matchMedia("(prefers-color-scheme: dark)");

  function currentTheme() {
    return root.getAttribute("data-theme") || (darkQuery.matches ? "dark" : "light");
  }

  if (themeBtn) {
    themeBtn.addEventListener("click", function () {
      var next = currentTheme() === "dark" ? "light" : "dark";
      root.setAttribute("data-theme", next);
      try { localStorage.setItem("theme", next); } catch (e) { /* private mode */ }
      document.dispatchEvent(new Event("themechange"));
    });
  }
  if (darkQuery.addEventListener) {
    darkQuery.addEventListener("change", function () { document.dispatchEvent(new Event("themechange")); });
  }

  /* ---------- Header: scrolled state + mobile menu ---------- */
  function onScroll() { if (header) header.classList.toggle("is-scrolled", window.scrollY > 8); }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  var navBtn = document.getElementById("nav-toggle");
  var nav = document.getElementById("site-nav");
  function setMenu(open) {
    header.classList.toggle("is-open", open);
    navBtn.setAttribute("aria-expanded", String(open));
    navBtn.setAttribute("aria-label", open ? "Close menu" : "Open menu");
  }
  if (navBtn && nav && header) {
    navBtn.addEventListener("click", function () { setMenu(!header.classList.contains("is-open")); });
    nav.addEventListener("click", function (e) { if (e.target.closest("a")) setMenu(false); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") setMenu(false); });
  }

  /* ---------- Highlight the nav link for the section in view ---------- */
  var links = {};
  Array.prototype.forEach.call(document.querySelectorAll(".site-nav__link[data-section]"), function (a) {
    links[a.getAttribute("data-section")] = a;
  });
  var sections = Object.keys(links).map(function (id) { return document.getElementById(id); }).filter(Boolean);
  if (sections.length && "IntersectionObserver" in window) {
    var spy = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        Object.keys(links).forEach(function (id) { links[id].classList.toggle("is-active", id === entry.target.id); });
      });
    }, { rootMargin: "-40% 0px -55% 0px" });
    sections.forEach(function (s) { spy.observe(s); });
  }

  /* ---------- Hero flow field ----------
     Tracer particles advected through a time-varying 2D velocity field. The field is
     derived from a stream function psi, u = dpsi/dy and v = -dpsi/dx, so it is
     divergence-free by construction (an incompressible flow). The pointer adds a
     point vortex, which is divergence-free as well. */
  var canvas = document.getElementById("flow");
  if (!canvas || !canvas.getContext) return;

  var ctx = canvas.getContext("2d");
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var W = 0, H = 0, L = 1, dpr = 1;
  var particles = [];
  var rgb = "14, 111, 124";
  var time = 0, frame = 0, onScreen = true;
  var pointer = { x: 0, y: 0, strength: 0, target: 0 };
  var vel = [0, 0];

  function readColor() {
    var v = getComputedStyle(root).getPropertyValue("--flow-rgb").trim();
    if (v) rgb = v;
  }

  function velocity(x, y, t) {
    var X = x / L, Y = y / L;
    var a = X + 0.15 * t, b = 1.3 * Y - 0.1 * t;
    var c = 2.1 * X - 0.7 * Y + 0.2 * t;
    var d = 0.6 * X + 1.7 * Y - 0.12 * t;
    // psi = sin(a)cos(b) + 0.45 sin(c) + 0.6 cos(d) + 0.9 Y
    var u = -1.3 * Math.sin(a) * Math.sin(b) - 0.315 * Math.cos(c) - 1.02 * Math.sin(d) + 0.9;
    var v = -Math.cos(a) * Math.cos(b) - 0.945 * Math.cos(c) + 0.36 * Math.sin(d);

    if (pointer.strength > 0.01) {
      var dx = x - pointer.x, dy = y - pointer.y;
      var k = (pointer.strength * 1.5 * L) / (dx * dx + dy * dy + 0.05 * L * L);
      u += -dy * k;
      v += dx * k;
    }
    vel[0] = u; vel[1] = v;
  }

  function spawn(p, anywhere) {
    p.x = anywhere || Math.random() < 0.6 ? Math.random() * W : -4;
    p.y = Math.random() * H;
    p.age = 0;
    p.life = 140 + Math.random() * 260;
  }

  function resize() {
    var rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    W = rect.width; H = rect.height;
    L = Math.max(260, Math.min(W, 1400) * 0.2);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.lineWidth = 1;
    ctx.lineCap = "round";

    var count = Math.max(220, Math.min(900, Math.round((W * H) / 2400)));
    particles = [];
    for (var i = 0; i < count; i++) { var p = {}; spawn(p, true); p.age = Math.random() * p.life; particles.push(p); }
    readColor();
    if (reduceMotion) drawStill();
  }

  function step(fade, alphaScale) {
    if (fade) {
      // Fade previous frames toward transparent so trails work over any background.
      ctx.globalCompositeOperation = "destination-out";
      ctx.fillStyle = "rgba(0, 0, 0, 0.055)";
      ctx.fillRect(0, 0, W, H);
      ctx.globalCompositeOperation = "source-over";
    }
    for (var i = 0; i < particles.length; i++) {
      var p = particles[i];
      velocity(p.x, p.y, time);
      var nx = p.x + vel[0] * 0.95, ny = p.y + vel[1] * 0.95;
      var fadeInOut = Math.min(1, p.age / 30, (p.life - p.age) / 30);
      ctx.strokeStyle = "rgba(" + rgb + ", " + (0.5 * alphaScale * Math.max(0, fadeInOut)).toFixed(3) + ")";
      ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(nx, ny); ctx.stroke();
      p.x = nx; p.y = ny; p.age++;
      if (p.age > p.life || nx < -8 || nx > W + 8 || ny < -8 || ny > H + 8) spawn(p, false);
    }
    time += 0.006;
  }

  // Reduced motion: integrate streamlines once and leave a still image.
  function drawStill() {
    ctx.clearRect(0, 0, W, H);
    for (var n = 0; n < 130; n++) step(false, 0.5);
  }

  function loop() {
    frame = requestAnimationFrame(loop);
    pointer.strength += (pointer.target - pointer.strength) * 0.06;
    step(true, 1);
  }
  function start() { if (!frame && !reduceMotion && onScreen && !document.hidden) frame = requestAnimationFrame(loop); }
  function stop() { if (frame) { cancelAnimationFrame(frame); frame = 0; } }

  var hero = canvas.parentElement;
  hero.addEventListener("pointermove", function (e) {
    if (e.pointerType === "touch") return;
    var rect = canvas.getBoundingClientRect();
    pointer.x = e.clientX - rect.left; pointer.y = e.clientY - rect.top; pointer.target = 1;
  });
  hero.addEventListener("pointerleave", function () { pointer.target = 0; });

  if ("IntersectionObserver" in window) {
    new IntersectionObserver(function (entries) {
      onScreen = entries[0].isIntersecting;
      if (onScreen) start(); else stop();
    }).observe(canvas);
  }
  document.addEventListener("visibilitychange", function () { if (document.hidden) stop(); else start(); });
  document.addEventListener("themechange", function () {
    readColor();
    ctx.clearRect(0, 0, W, H);
    if (reduceMotion) drawStill();
  });

  var resizeTimer;
  window.addEventListener("resize", function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () { if (Math.abs(canvas.getBoundingClientRect().width - W) > 1) resize(); }, 150);
  });

  resize();
  start();
})();
