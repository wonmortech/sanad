/* Sanad home page: header, reveal, the living certificate (guilloche + scan), the chain rail and the chat mock.
   No dependencies. Everything pauses off screen and respects prefers-reduced-motion. */
(function () {
  'use strict';
  var doc = document.documentElement;
  var lang = (doc.lang || 'uz').slice(0, 2);
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  var coarse = window.matchMedia('(pointer: coarse)').matches;

  var T = {
    uz: { scanning: 'Skanerlanmoqda…', ok: 'Haqiqiy: imzo mos, beruvchi tanish', bad: 'Soxta: imzolangandan keyin bitta maydon oʻzgartirilgan',
      proofIdle: 'imzo: Ed25519 · did:web:markaz.example', proofOk: '✓ imzo mos · did:web:markaz.example · oflayn', proofBad: '✗ imzo mos emas · maʼlumot oʻzgargan',
      toDark: 'Qorongʻi mavzu', toLight: 'Yorugʻ mavzu', open: 'Menyuni ochish', close: 'Menyuni yopish' },
    en: { scanning: 'Scanning…', ok: 'Genuine: signature matches, issuer is known', bad: 'Forged: one field was changed after signing',
      proofIdle: 'signature: Ed25519 · did:web:markaz.example', proofOk: '✓ signature valid · did:web:markaz.example · offline', proofBad: '✗ signature invalid · data was changed',
      toDark: 'Dark theme', toLight: 'Light theme', open: 'Open menu', close: 'Close menu' },
    ru: { scanning: 'Проверяем…', ok: 'Подлинный: подпись совпадает, издатель известен', bad: 'Подделка: после подписи изменили одно поле',
      proofIdle: 'подпись: Ed25519 · did:web:markaz.example', proofOk: '✓ подпись верна · did:web:markaz.example · офлайн', proofBad: '✗ подпись неверна · данные изменены',
      toDark: 'Тёмная тема', toLight: 'Светлая тема', open: 'Открыть меню', close: 'Закрыть меню' }
  }[lang] || null;
  if (!T) return;

  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function guil() { return getComputedStyle(doc).getPropertyValue('--guil').trim() || '31 138 116'; }

  /* theme */
  var themeBtn = $('#theme');
  function isDark() {
    var t = doc.getAttribute('data-theme');
    if (t) return t === 'dark';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  }
  function labelTheme() { if (themeBtn) themeBtn.setAttribute('aria-label', isDark() ? T.toLight : T.toDark); }
  if (themeBtn) {
    labelTheme();
    themeBtn.addEventListener('click', function () {
      var next = isDark() ? 'light' : 'dark';
      doc.setAttribute('data-theme', next);
      try { localStorage.setItem('sanad-theme', next); } catch (e) { /* ignore */ }
      labelTheme();
    });
  }

  /* menu */
  var menuBtn = $('#menu'), nav = $('#nav');
  if (menuBtn && nav) {
    menuBtn.addEventListener('click', function () {
      var open = nav.classList.toggle('open');
      menuBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
      menuBtn.setAttribute('aria-label', open ? T.close : T.open);
    });
    $$('a', nav).forEach(function (a) {
      a.addEventListener('click', function () { nav.classList.remove('open'); menuBtn.setAttribute('aria-expanded', 'false'); menuBtn.setAttribute('aria-label', T.open); });
    });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && nav.classList.contains('open')) { menuBtn.click(); menuBtn.focus(); } });
  }

  /* reveal */
  var rvs = $$('.rv');
  if ('IntersectionObserver' in window && !reduce.matches) {
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
    }, { rootMargin: '0px 0px -8% 0px' });
    rvs.forEach(function (el) { io.observe(el); });
  } else rvs.forEach(function (el) { el.classList.add('in'); });

  /* decorative QR-like pattern: a picture of a code, not a working one */
  function qrSvg(seed) {
    var n = 25, s = seed, out = '';
    function rnd() { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; }
    function finder(x, y) { return '<rect x="' + x + '" y="' + y + '" width="7" height="7" fill="#111"/><rect x="' + (x + 1) + '" y="' + (y + 1) + '" width="5" height="5" fill="#fff"/><rect x="' + (x + 2) + '" y="' + (y + 2) + '" width="3" height="3" fill="#111"/>'; }
    for (var y = 0; y < n; y++) for (var x = 0; x < n; x++) {
      var inF = (x < 8 && y < 8) || (x > n - 9 && y < 8) || (x < 8 && y > n - 9);
      if (!inF && rnd() > .52) out += '<rect x="' + x + '" y="' + y + '" width="1" height="1" fill="#111"/>';
    }
    return '<svg viewBox="0 0 ' + n + ' ' + n + '" aria-hidden="true" shape-rendering="crispEdges">' + out + finder(0, 0) + finder(n - 7, 0) + finder(0, n - 7) + '</svg>';
  }
  $$('[data-qr]').forEach(function (el) { el.innerHTML = qrSvg(parseInt(el.getAttribute('data-qr'), 10) || 7); });

  /* guilloche: interference curves, drawn on canvas, breathing slowly */
  function Guilloche(canvas, kind) {
    this.c = canvas; this.kind = kind; this.ctx = canvas.getContext('2d'); this.w = 0; this.h = 0; this.dpr = 1;
  }
  Guilloche.prototype.resize = function () {
    var r = this.c.getBoundingClientRect();
    this.dpr = Math.min(window.devicePixelRatio || 1, coarse ? 1.25 : 1.75);
    this.w = Math.max(1, r.width); this.h = Math.max(1, r.height);
    this.c.width = Math.round(this.w * this.dpr); this.c.height = Math.round(this.h * this.dpr);
  };
  Guilloche.prototype.draw = function (ph) {
    var ctx = this.ctx, w = this.w, h = this.h, g = guil();
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    if (this.kind === 'seal') return this.seal(ctx, w, h, ph, g);
    var m = Math.min(w, h), inset = m * .045, band = m * .03, i, k, t;
    // border band: lines wander around the rectangle perimeter
    var W = w - inset * 2, H = h - inset * 2, P = 2 * (W + H), steps = coarse ? 520 : 900, lines = coarse ? 7 : 10;
    ctx.lineWidth = .7;
    for (i = 0; i < lines; i++) {
      ctx.strokeStyle = 'rgb(' + g + ' / ' + (i % 2 ? .38 : .62) + ')';
      ctx.beginPath();
      for (k = 0; k <= steps; k++) {
        t = k / steps;
        var s = t * P, x, y, nx, ny;
        if (s < W) { x = inset + s; y = inset; nx = 0; ny = 1; }
        else if (s < W + H) { x = inset + W; y = inset + (s - W); nx = -1; ny = 0; }
        else if (s < 2 * W + H) { x = inset + W - (s - W - H); y = inset + H; nx = 0; ny = -1; }
        else { x = inset; y = inset + H - (s - 2 * W - H); nx = 1; ny = 0; }
        var off = band * (.5 + .5 * Math.sin(t * Math.PI * 2 * 64 + ph * 1.3 + i * .63) * Math.cos(t * Math.PI * 2 * 9 - ph * .7 + i * .31));
        x += nx * off; y += ny * off;
        if (k) ctx.lineTo(x, y); else ctx.moveTo(x, y);
      }
      ctx.stroke();
    }
    // watermark rosette behind the text
    var cx = w * .3, cy = h * .58, R = m * .36;
    ctx.lineWidth = .6;
    for (i = 0; i < 3; i++) {
      ctx.strokeStyle = 'rgb(' + g + ' / ' + (.07 - i * .015) + ')';
      ctx.beginPath();
      var N = 1400;
      for (k = 0; k <= N; k++) {
        t = k / N * Math.PI * 2 * 7;
        var rr = R * (.62 + .2 * Math.sin(t * 2.857 + ph * .5 + i) + .1 * Math.cos(t * 11 / 7 - ph * .3));
        var px = cx + rr * Math.cos(t), py = cy + rr * Math.sin(t) * .82;
        if (k) ctx.lineTo(px, py); else ctx.moveTo(px, py);
      }
      ctx.stroke();
    }
  };
  Guilloche.prototype.seal = function (ctx, w, h, ph, g) {
    var cx = w / 2, cy = h / 2, R = Math.min(w, h) / 2 * .98, lines = coarse ? 10 : 16, N = coarse ? 260 : 420;
    ctx.lineWidth = .8;
    for (var i = 0; i < lines; i++) {
      ctx.strokeStyle = 'rgb(' + g + ' / ' + (.35 + .45 * (i % 3 === 0)) + ')';
      ctx.beginPath();
      for (var k = 0; k <= N; k++) {
        var t = k / N * Math.PI * 2;
        var r = R * (.78 + .17 * Math.sin(t * 18 + ph + i * Math.PI * 2 / lines) * Math.cos(t * 3 - ph * .6));
        var x = cx + r * Math.cos(t), y = cy + r * Math.sin(t);
        if (k) ctx.lineTo(x, y); else ctx.moveTo(x, y);
      }
      ctx.closePath(); ctx.stroke();
    }
  };

  /* living loop: one rAF for guilloche + tilt, 30fps for the canvases, paused off screen */
  var cert = $('#cert');
  if (cert) {
    var wrap = $('.cert-wrap'), stage = $('.stage');
    var gs = [new Guilloche($('canvas.guil', cert), 'border'), new Guilloche($('.seal canvas', cert), 'seal')];
    var visible = true, last = 0, ph = 0, tx = 0, ty = 0, cxr = 0, cyr = 0, t0 = performance.now();
    function resize() { gs.forEach(function (g) { g.resize(); g.draw(ph); }); }
    resize();
    window.addEventListener('resize', function () { clearTimeout(resize.t); resize.t = setTimeout(resize, 120); });
    if (window.ResizeObserver) new ResizeObserver(function () { resize(); }).observe(cert);
    if ('IntersectionObserver' in window) new IntersectionObserver(function (es) { visible = es[0].isIntersecting; if (visible) requestAnimationFrame(frame); }).observe(cert);
    // theme switches change nothing on paper, but repaint keeps the colour token honest
    new MutationObserver(function () { gs.forEach(function (g) { g.draw(ph); }); }).observe(doc, { attributes: true, attributeFilter: ['data-theme'] });

    if (!coarse) {
      stage.addEventListener('pointermove', function (e) {
        var r = stage.getBoundingClientRect();
        tx = ((e.clientX - r.left) / r.width - .5); ty = ((e.clientY - r.top) / r.height - .5);
      });
      stage.addEventListener('pointerleave', function () { tx = 0; ty = 0; });
    }
    function frame(now) {
      if (!visible || reduce.matches) return;
      var dt = Math.min(.05, (now - (frame.p || now)) / 1000); frame.p = now;
      var k = 1 - Math.exp(-dt * 2.6);
      var idle = (now - t0) / 1000;
      cxr += (tx - cxr) * k; cyr += (ty - cyr) * k;
      var ry = cxr * 9 + Math.sin(idle * .35) * 1.6, rx = -cyr * 7 + Math.cos(idle * .28) * 1.1;
      wrap.style.transform = 'rotateX(' + rx.toFixed(2) + 'deg) rotateY(' + ry.toFixed(2) + 'deg)';
      cert.style.setProperty('--gx', (50 + cxr * 80).toFixed(1) + '%');
      cert.style.setProperty('--gy', (20 + cyr * 60).toFixed(1) + '%');
      if (now - last > 33) { ph += .045; gs.forEach(function (g) { g.draw(ph); }); last = now; }
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
    reduce.addEventListener && reduce.addEventListener('change', function () { if (!reduce.matches) requestAnimationFrame(frame); });

    /* scan story: genuine -> verified, forged -> fails */
    var beam = $('.beam', cert), proof = $('.proof', cert), res = $('#result'), resText = $('#result-text');
    var fields = $$('.field', cert), btnReal = $('#v-real'), btnFake = $('#v-fake'), btnScan = $('#v-scan');
    var mode = 'real', auto = true, running = false, token = 0;
    function setMode(m) {
      mode = m;
      btnReal.setAttribute('aria-pressed', m === 'real' ? 'true' : 'false');
      btnFake.setAttribute('aria-pressed', m === 'fake' ? 'true' : 'false');
      fields.forEach(function (f) {
        var v = $('.val', f), alt = f.getAttribute('data-forged');
        if (!alt) return;
        var want = m === 'fake' ? alt : f.getAttribute('data-real');
        if (v.textContent !== want) {
          v.style.opacity = 0; v.style.transform = 'translateY(-30%)';
          setTimeout(function () { v.textContent = want; v.style.transform = 'translateY(30%)'; requestAnimationFrame(function () { v.style.opacity = 1; v.style.transform = 'none'; }); }, reduce.matches ? 0 : 380);
        }
        f.classList.toggle('forged', m === 'fake');
      });
    }
    function clear() {
      cert.removeAttribute('data-state'); res.removeAttribute('data-state');
      fields.forEach(function (f) { f.classList.remove('ok', 'bad'); });
      proof.textContent = T.proofIdle;
    }
    function scan() {
      var my = ++token; running = true; clear();
      resText.textContent = T.scanning;
      var H = cert.clientHeight, dur = reduce.matches ? 0 : 2600, start = performance.now();
      cert.classList.add('scanning');
      var marks = fields.map(function (f) { return { f: f, y: f.offsetTop + f.offsetHeight / 2 + f.offsetParent.offsetTop, done: false }; });
      return new Promise(function (resolve) {
        function step(now) {
          if (my !== token) return resolve(false);
          var p = dur ? Math.min(1, (now - start) / dur) : 1;
          var e = p < .5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
          var y = e * (H * 1.18) - H * .18;
          beam.style.transform = 'translateY(' + y.toFixed(1) + 'px)';
          marks.forEach(function (m) {
            if (!m.done && y + H * .18 > m.y) { m.done = true; if (mode === 'real') m.f.classList.add('ok'); else if (m.f.classList.contains('forged')) m.f.classList.add('bad'); }
          });
          if (p < 1) requestAnimationFrame(step);
          else {
            cert.classList.remove('scanning');
            var st = mode === 'real' ? 'ok' : 'bad';
            cert.setAttribute('data-state', st); res.setAttribute('data-state', st);
            resText.textContent = st === 'ok' ? T.ok : T.bad;
            proof.textContent = st === 'ok' ? T.proofOk : T.proofBad;
            running = false; resolve(true);
          }
        }
        requestAnimationFrame(step);
      });
    }
    function stopAuto() { auto = false; }
    btnReal.addEventListener('click', function () { stopAuto(); setMode('real'); setTimeout(scan, reduce.matches ? 0 : 450); });
    btnFake.addEventListener('click', function () { stopAuto(); setMode('fake'); setTimeout(scan, reduce.matches ? 0 : 450); });
    btnScan.addEventListener('click', function () { stopAuto(); scan(); });
    proof.textContent = T.proofIdle;

    (async function loop() {
      await sleep(reduce.matches ? 0 : 900);
      if (reduce.matches) { setMode('real'); scan(); return; }
      while (auto) {
        if (!visible) { await sleep(500); continue; }
        setMode('real'); await sleep(500); if (!auto) break;
        await scan(); if (!auto) break;
        await sleep(3400); if (!auto) break;
        clear(); setMode('fake'); await sleep(1300); if (!auto) break;
        await scan(); if (!auto) break;
        await sleep(3600); if (!auto) break;
      }
    })();
  }

  /* chain rail: a small certificate travels issuer -> holder -> verifier */
  var rail = $('.rail');
  if (rail && !reduce.matches) {
    var path = $('.run', rail), dotg = $('.traveller', rail), len = 0, railVis = false, tStart = 0;
    function measure() { try { len = path.getTotalLength(); path.style.strokeDasharray = len; path.style.setProperty('--len', len); } catch (e) { len = 0; } }
    measure(); window.addEventListener('resize', measure);
    if ('IntersectionObserver' in window) new IntersectionObserver(function (es) { railVis = es[0].isIntersecting; if (railVis) { tStart = performance.now(); requestAnimationFrame(tick); } }).observe(rail);
    function tick(now) {
      if (!railVis || !len) return;
      var cyc = 7.5, t = ((now - tStart) / 1000 % cyc) / cyc;
      // dwell at each node: 0, .5, 1 of the path
      var seg = t < .4 ? Math.min(1, t / .3) * .5 : t < .8 ? .5 + Math.min(1, (t - .4) / .3) * .5 : 1;
      var e = seg < .5 ? (1 - Math.cos(seg * 2 * Math.PI)) / 2 * .5 : .5 + (1 - Math.cos((seg - .5) * 2 * Math.PI)) / 2 * .5;
      var pt = path.getPointAtLength(e * len);
      dotg.setAttribute('transform', 'translate(' + pt.x.toFixed(1) + ' ' + pt.y.toFixed(1) + ')');
      path.style.strokeDashoffset = (len * (1 - e)).toFixed(1);
      dotg.style.opacity = t > .93 ? Math.max(0, 1 - (t - .93) / .07) : Math.min(1, t / .03);
      requestAnimationFrame(tick);
    }
  }

  /* chat mock */
  var chat = $('#chat');
  if (chat) {
    var msgs = $$('.msg', chat);
    if (reduce.matches || !('IntersectionObserver' in window)) {
      msgs.forEach(function (m) { if (m.hasAttribute('data-typing')) m.remove(); else m.classList.add('in'); });
    } else {
      var played = false;
      new IntersectionObserver(function (es) {
        if (!es[0].isIntersecting || played) return; played = true;
        (async function () {
          for (var i = 0; i < msgs.length; i++) {
            var m = msgs[i];
            m.classList.add('in');
            if (m.hasAttribute('data-typing')) { await sleep(1300); m.style.display = 'none'; continue; }
            await sleep(m.classList.contains('me') ? 900 : 1500);
          }
        })();
      }, { threshold: .35 }).observe(chat);
    }
  }
})();
