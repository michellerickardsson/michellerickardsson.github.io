/* ============================================================
   Hero-animationen
   ============================================================ */
(function () {
  var svg = document.getElementById("graph");
  var ball = document.getElementById("ball");
  var halo = document.getElementById("halo");

  var pathA = document.getElementById("pathA");
  var word = document.getElementById("word");
  var pathB = document.getElementById("pathB");

  // Säkerhetskontroll om element saknas
  if (!svg || !ball || !halo || !pathA || !word || !pathB) {
    console.warn("SVG-animationen avbröts: Ett eller flera ID:n saknas i HTML.");
    return;
  }

  var segs = [
    { el: pathA, weight: 1 },
    { el: word, weight: 1.22 },
    { el: pathB, weight: 1 }
  ].map(function (s) {
    s.len = s.el.getTotalLength();
    s.el.style.strokeDasharray = s.len;
    s.el.style.strokeDashoffset = s.len;
    return s;
  });

  var cursor = 0;
  segs.forEach(function (s) {
    s.vStart = cursor;
    cursor += s.len * s.weight;
  });
  var virtualTotal = cursor;

  // Lägre tal = långsammare ritande.
  var DRAW = virtualTotal / 0.185;

  function ease(t) {
    return 0.5 * (1 - Math.cos(Math.PI * t));
  }

  function paint(v) {
    segs.forEach(function (s) {
      var local = (v - s.vStart) / (s.len * s.weight);
      if (local <= 0) {
        s.el.style.strokeDashoffset = s.len;
      } else if (local >= 1) {
        s.el.style.strokeDashoffset = 0;
      } else {
        s.el.style.strokeDashoffset = s.len * (1 - local);
        var pt = s.el.getPointAtLength(s.len * local);
        ball.setAttribute("cx", pt.x);
        ball.setAttribute("cy", pt.y);
        halo.setAttribute("cx", pt.x);
        halo.setAttribute("cy", pt.y);
      }
    });
  }

  function settle() {
    paint(virtualTotal);
    ball.setAttribute("opacity", "0");
    halo.setAttribute("opacity", "0");
  }

  var reduce =
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (reduce) {
    settle();
  } else {
    var t0 = null;
    requestAnimationFrame(function tick(now) {
      if (t0 === null) t0 = now;
      var t = now - t0;

      if (t >= DRAW) {
        settle();
        return;
      }

      var p = ease(t / DRAW);
      paint(virtualTotal * p);
      var vis = p > 0.004;
      ball.setAttribute("opacity", vis ? 0.9 : 0);
      halo.setAttribute("opacity", vis ? 0.13 : 0);
      requestAnimationFrame(tick);
    });
  }

  /* Långsam drift + mjuk reaktion på muspekaren */
  var tx = 0,
    ty = 0,
    cx = 0,
    cy = 0;

  window.addEventListener("mousemove", function (e) {
    tx = (e.clientX / window.innerWidth - 0.5) * 2;
    ty = (e.clientY / window.innerHeight - 0.5) * 2;
  });

  requestAnimationFrame(function drift(now) {
    cx += (tx - cx) * 0.022;
    cy += (ty - cy) * 0.022;
    var dx = Math.sin((now || 0) / 5200) * 7;
    var dy = Math.cos((now || 0) / 6900) * 9;
    svg.style.transform =
      "translate(" + (cx * 9 + dx) + "px," + (cy * 7 + dy) + "px) scale(1.02)";
    requestAnimationFrame(drift);
  });
})();

/* Årtal i sidfoten */
document.addEventListener("DOMContentLoaded", function () {
  var yearEl = document.getElementById("year");
  if (yearEl) {
    yearEl.textContent = new Date().getFullYear();
  }
});