/* ============================================================
   Masked heading — warm flame fill for the hero name.

   A vanilla adaptation of the React Bits <MaskedHeading /> component
   for this static site. The name (#heroName) is filled with a looping
   ember->flame->gold gradient via CSS background-clip:text; this script
   slides that gradient every frame so the colour lives under the letters:

     • flow     — a steady sideways scroll through the spectrum
     • parallax — the colour leans away from the pointer
     • drift    — a slow idle sway so it never sits perfectly still

   Motion is skipped entirely under prefers-reduced-motion; the CSS
   still shows a static gradient in that case.
   ============================================================ */
(function () {
  var fill = document.getElementById('heroName');
  var hero = document.querySelector('.hero');
  if (!fill || !hero) return;

  // Respect the user's motion preference — leave the static gradient in place.
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  var FLOW = 9;        // spectrum scroll speed, %/second
  var PARALLAX = 14;   // how far the colour leans from the pointer, in %
  var DRIFT = 7;       // idle sway amplitude, in %

  var clamp = function (v, a, b) { return v < a ? a : v > b ? b : v; };

  var target = 0;      // parallax target from the pointer
  var cur = 0;         // eased parallax offset actually applied
  var phase = 0;       // running flow position
  var last = performance.now();

  function onMove(e) {
    var r = fill.getBoundingClientRect();
    var nx = ((e.clientX - r.left) / (r.width || 1)) * 2 - 1;
    target = clamp(nx, -1, 1) * -PARALLAX;
  }

  function onLeave() { target = 0; }

  function frame(now) {
    var dt = Math.min(0.05, (now - last) / 1000);
    last = now;

    phase = (phase + FLOW * dt) % 200;              // seamless because the tile repeats
    var drift = Math.sin(now / 3600) * DRIFT;       // slow idle sway
    var ease = 1 - Math.exp(-dt / 0.18);            // frame-rate independent smoothing
    cur += (target + drift - cur) * ease;

    fill.style.backgroundPosition = (phase + cur).toFixed(2) + '% 50%';
    requestAnimationFrame(frame);
  }

  hero.addEventListener('pointermove', onMove);
  hero.addEventListener('pointerleave', onLeave);
  requestAnimationFrame(frame);
})();
