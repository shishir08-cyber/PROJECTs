(function () {
  'use strict';

  var STORAGE_KEY = 'ns_visited';
  var isFirstVisit = !localStorage.getItem(STORAGE_KEY);
  localStorage.setItem(STORAGE_KEY, '1');

  function mountMini() {
    var el = document.createElement('div');
    el.id = 'ns-splash';
el.style.cssText = 'position:fixed;inset:0;z-index:9999;background:#ffffff;overflow:hidden;transition:opacity 1.3s ease;';
    el.innerHTML = '<canvas id="ns-canvas" style="position:absolute;inset:0;width:100%;height:100%;"></canvas>';

    document.body.insertBefore(el, document.body.firstChild);
    document.body.style.overflow = 'hidden';

    var canvas = document.getElementById('ns-canvas');
    var ctx    = canvas.getContext('2d');
    var W, H;

    function resize() {
      W = canvas.width  = canvas.offsetWidth;
      H = canvas.height = canvas.offsetHeight;
    }
    resize();

    var startTime = null;
    var TOTAL     = 4200;
    var fadingOut = false;

    /* ── LIGHT LEAKS
       Each leak is a large soft radial blob that drifts slowly
       across the screen — exactly like lens light leak overlays.
       No hard edges. Pure soft glow bleeding through.
    ── */
    var leaks = [
 { x: -0.1, y: 0.1,  tx: 0.6,  ty: -0.05, size: 0.7,  color: [240, 240, 245], peakA: 0, delay: 0.0,  alpha: 0 },
{ x:  1.1, y: 0.3,  tx: 0.2,  ty:  0.5,  size: 0.55, color: [240, 240, 245], peakA: 0, delay: 0.15, alpha: 0 },
{ x:  0.5, y: -0.1, tx: 0.8,  ty:  0.7,  size: 0.65, color: [240, 240, 245], peakA: 0, delay: 0.05, alpha: 0 },
{ x: -0.1, y: 0.7,  tx: 0.5,  ty:  0.2,  size: 0.45, color: [240, 240, 245], peakA: 0, delay: 0.25, alpha: 0 },
{ x:  0.9, y: -0.1, tx: 0.1,  ty:  0.8,  size: 0.5,  color: [240, 240, 245], peakA: 0, delay: 0.10, alpha: 0 },
];

    /* ── DOTS ── */
    var DOT_COUNT = 900;
    var dots = [];
    for (var i = 0; i < DOT_COUNT; i++) {
      var angle = -0.4 + (Math.random() - 0.5) * 0.6;
      var speed = 0.12 + Math.random() * 0.25;
      dots.push({
        x:            Math.random() * W,
        y:            Math.random() * H,
        vx:           Math.cos(angle) * speed,
        vy:           Math.sin(angle) * speed - 0.08,
        size:         0.8 + Math.random() * 1.4,
        alpha:        0.2 + Math.random() * 0.6,
        twinkle:      Math.random() * Math.PI * 2,
        twinkleSpeed: 0.5 + Math.random() * 1.5,
      });
    }

    function lerp(a, b, t) { return a + (b - a) * t; }
    function easeOut(t)     { return 1 - Math.pow(1 - t, 3); }
    function easeInOut(t)   { return t < 0.5 ? 2*t*t : 1 - Math.pow(-2*t+2,2)/2; }

    function drawLeak(leak, globalA, time, idx) {
      var cx = leak.x * W;
      var cy = leak.y * H;
      var r  = leak.size * Math.max(W, H);

      // organic shape — slightly oval and slowly morphing
      var scaleX = 1.0 + Math.sin(time * 0.3 + idx * 1.1) * 0.15;
      var scaleY = 1.0 + Math.cos(time * 0.25 + idx * 0.9) * 0.12;

      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(scaleX, scaleY);

      var grad = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
      var c    = leak.color;
      var a    = leak.alpha * globalA;

      grad.addColorStop(0,    'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + (a * 0.9).toFixed(3) + ')');
      grad.addColorStop(0.25, 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + (a * 0.5).toFixed(3) + ')');
      grad.addColorStop(0.55, 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + (a * 0.18).toFixed(3) + ')');
      grad.addColorStop(1,    'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',0)');

      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();
      ctx.restore();
    }

    function draw(ts) {
      if (!startTime) startTime = ts;
      var elapsed  = ts - startTime;
      var progress = Math.min(elapsed / TOTAL, 1);
if (!fadingOut) bar.style.width = (progress * 100 * 1.2) + 'px';
      var time     = elapsed / 1000;

      var fadeIn  = Math.min(elapsed / (TOTAL * 0.30), 1);
      var fadeOut = Math.max(0, (elapsed - TOTAL * 0.72) / (TOTAL * 0.28));

      if (fadeOut > 0.06 && !fadingOut) {
        fadingOut = true;
        el.style.opacity = '0';
      }

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);

      var globalA = easeOut(fadeIn) * (1 - fadeOut);

      /* ── Light leaks: each blob drifts from start → end position ── */
      for (var l = 0; l < leaks.length; l++) {
        var lk = leaks[l];

        // staggered fade in
        var lProgress = Math.max(0, (fadeIn - lk.delay) / (1 - lk.delay));
        var tNorm     = easeInOut(Math.min(lProgress * 1.4, 1));

        // drift position — lerp from start to end over full duration
        lk.x = lerp(lk.x, lk.tx, 0.0015);
        lk.y = lerp(lk.y, lk.ty, 0.0012);

        // alpha: fade in, hold, implicit fade via globalA
        lk.alpha = lerp(lk.alpha, lk.peakA * Math.min(tNorm * 2, 1), 0.025);

        // subtle breath pulse
        var breathe = 0.85 + Math.sin(time * 0.6 + l * 1.4) * 0.15;
        lk.alpha *= breathe;

        drawLeak(lk, globalA, time, l);
      }

      /* ── Dots ── */
      for (var i = 0; i < dots.length; i++) {
        var d = dots[i];
        d.x += d.vx;
        d.y += d.vy;
        if (d.x < -2)  d.x = W + 2;
        if (d.x > W+2) d.x = -2;
        if (d.y < -2)  d.y = H + 2;
        if (d.y > H+2) d.y = -2;

        var twinkle = 0.75 + Math.sin(time * d.twinkleSpeed + d.twinkle) * 0.25;
        var alpha   = d.alpha * twinkle * globalA;
        if (alpha < 0.01) continue;

        ctx.beginPath();
        ctx.arc(d.x, d.y, d.size, 0, Math.PI * 2);
ctx.fillStyle = 'rgba(0,0,0,' + alpha.toFixed(3) + ')';
        ctx.fill();
      }

      /* ── Vignette — darkens edges so leaks feel like they come from inside ── */
      var vig = ctx.createRadialGradient(W/2, H/2, H*0.05, W/2, H/2, H*0.9);
vig.addColorStop(0,   'rgba(255,255,255,0)');
vig.addColorStop(0.6, 'rgba(255,255,255,0)');
vig.addColorStop(1,   'rgba(255,255,255,0)');
      ctx.fillStyle = vig;
      ctx.fillRect(0, 0, W, H);

      /* ── Brand text ── */
      var textA = Math.max(0, (easeOut(fadeIn) - 0.55) / 0.45) * (1 - fadeOut * 2.5) * 0.7;
      if (textA > 0.01) {
        ctx.save();
        ctx.globalAlpha  = Math.max(0, textA);
        ctx.font         = '800 18px Inter, sans-serif';
ctx.textAlign    = 'center';
ctx.textBaseline = 'middle';
ctx.letterSpacing = '0.2em';
ctx.fillStyle    = 'rgba(0,0,0,0.85)';
ctx.fillText('NOVA STUDIOZ', W / 2, H / 2);;
        ctx.restore();
      }

      if (progress < 1) {
        requestAnimationFrame(draw);
      } else {
        setTimeout(function () {
          if (el && el.parentNode) el.parentNode.removeChild(el);
          document.body.style.overflow = '';
        }, 1400);
      }
    }
// Progress bar
var bar = document.createElement('div');
bar.style.cssText = 'position:absolute;bottom:46%;left:50%;transform:translateX(-50%);height:1px;width:0%;background:rgba(0,0,0,0.25);z-index:10;';
el.appendChild(bar);
    requestAnimationFrame(draw);
  }

  /* ══════════════════════════════════════════════════════
     BIG SPLASH — first visit (unchanged)
  ══════════════════════════════════════════════════════ */
  function mountBig() {
    var el = document.createElement('div');
    el.id = 'ns-splash';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    el.setAttribute('aria-label', 'Nova Studioz — Welcome');

    el.innerHTML = [
      '<div id="ns-splash-inner">',
        '<p class="ns-eyebrow">Nova Studioz</p>',
        '<h1 class="ns-headline">',
          'We bring characters',
          '<br>',
          '<span class="ns-strike">on&nbsp;screens</span>',
          '&nbsp;',
          '<span class="ns-highlight">beyond screens</span>',
        '</h1>',
        '<p class="ns-sub">for the ones who feel it</p>',
      '</div>',
      '<div class="ns-progress-wrap">',
        '<div class="ns-progress-fill"></div>',
      '</div>',
      '<span class="ns-corner-mark">Est. 2024</span>',
    ].join('');

    document.body.insertBefore(el, document.body.firstChild);
    document.body.style.overflow = 'hidden';
    el.style.setProperty('--splash-dur', '6s');

    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        var inner    = document.getElementById('ns-splash-inner');
        var eyebrow  = el.querySelector('.ns-eyebrow');
        var headline = el.querySelector('.ns-headline');
        var sub      = el.querySelector('.ns-sub');
        var progWrap = el.querySelector('.ns-progress-wrap');
        var progFill = el.querySelector('.ns-progress-fill');
        var corner   = el.querySelector('.ns-corner-mark');

        if (inner)    inner.classList.add('ns-visible');
        if (eyebrow)  eyebrow.classList.add('ns-visible');
        if (headline) headline.classList.add('ns-visible');
        if (sub)      sub.classList.add('ns-visible');
        if (corner)   corner.classList.add('ns-visible');
        if (progWrap) progWrap.classList.add('ns-visible');
        if (progFill) requestAnimationFrame(function () { progFill.classList.add('ns-running'); });

        setTimeout(function () { exitSplash(el); }, 6000);
      });
    });
  }

  function exitSplash(el) {
    el.classList.add('ns-exit');
    setTimeout(function () {
      if (el && el.parentNode) el.parentNode.removeChild(el);
      document.body.style.overflow = '';
    }, 950);
  }

  var BIG_KEY     = 'ns_big_log';   // tracks timestamps of big splash plays
var MAX_PER_HOUR = 2;             // ← max times mountBig() can show per hour

function canShowBig() {
  var now = Date.now();
  var oneHour = 60 * 60 * 1000;
  var raw = localStorage.getItem(BIG_KEY);
  var times = raw ? JSON.parse(raw) : [];

  // keep only timestamps within the last hour
  times = times.filter(function(t) { return now - t < oneHour; });

  if (times.length >= MAX_PER_HOUR) return false;

  // record this new play
  times.push(now);
  localStorage.setItem(BIG_KEY, JSON.stringify(times));
  return true;
}

function init() {
  if (canShowBig()) {
    mountBig();
  }
}

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();