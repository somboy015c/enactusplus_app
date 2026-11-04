/* EnactusNG Plus – native layer: platform bridge, splash, server-driven onboarding, ripples, keyboard & offline handling */
(function () {
  'use strict';
  var C = window.Capacitor, isCap = !!(C && C.isNativePlatform && C.isNativePlatform());
  var isTauri = !!(window.__TAURI_INTERNALS__ || window.__TAURI__);
  var platform = isCap ? 'mobile' : (isTauri ? 'desktop' : 'web');
  var root = document.documentElement;
  var ONB_KEY = 'plus_onboarded_v1', CACHE_KEY = 'plus_slides_cache_v1', OVERRIDE_KEY = 'plus_api_override';
  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function lsDel(k) { try { localStorage.removeItem(k); } catch (e) {} }
  window.PLUS_CONFIG = window.PLUS_CONFIG || {};
  var DEFAULT_API = window.PLUS_CONFIG.api || '';
  if (lsGet(OVERRIDE_KEY)) { window.PLUS_CONFIG.api = lsGet(OVERRIDE_KEY); }
  var CFG = window.PLUS_CONFIG;
  function plug(name) { try { return (C.Plugins && C.Plugins[name]) || (C.registerPlugin && C.registerPlugin(name)); } catch (e) { return null; } }
  function invoke(cmd, args) { var i = window.__TAURI_INTERNALS__ || (window.__TAURI__ && window.__TAURI__.core); return i.invoke(cmd, args || {}); }
  function $(s) { return document.querySelector(s); }
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function ready(fn) { if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn); else fn(); }

  if (platform === 'web' && !/[?&]native=1/.test(location.search)) { return; } // plain website: leave everything as it was
  root.classList.add('native', 'is-' + platform);
  var BASE = String(CFG.api || '').replace(/api\/index\.php.*$/, '');

  /* ---------- network layer: the apps talk to the server natively, so website CORS rules cannot block them ---------- */
  var rawFetch = window.fetch.bind(window);
  function b64FromBytes(bytes) { var s = '', CH = 0x8000; for (var i = 0; i < bytes.length; i += CH) s += String.fromCharCode.apply(null, bytes.subarray(i, i + CH)); return btoa(s); }
  function bytesFromB64(b) { var s = atob(b || ''), a = new Uint8Array(s.length); for (var i = 0; i < s.length; i++) a[i] = s.charCodeAt(i); return a; }
  function plainHeaders(h) { var o = {}; if (!h) return o; if (typeof h.forEach === 'function' && !Array.isArray(h)) { h.forEach(function (v, k) { o[k] = v; }); } else { Object.keys(h).forEach(function (k) { o[k] = h[k]; }); } return o; }
  function viaRust(url, init) {
    init = init || {}; var headers = plainHeaders(init.headers), body = init.body, p;
    if (body == null) p = Promise.resolve(null);
    else if (typeof body === 'string') p = Promise.resolve(b64FromBytes(new TextEncoder().encode(body)));
    else { var rq = new Response(body); var ct = rq.headers.get('content-type'); if (ct) headers['Content-Type'] = ct; p = rq.arrayBuffer().then(function (ab) { return b64FromBytes(new Uint8Array(ab)); }); }
    return p.then(function (b64) {
      return invoke('api_fetch', { req: { url: url, method: init.method || 'GET', headers: headers, body_b64: b64 } });
    }).then(function (r) {
      var nobody = r.status === 204 || r.status === 205 || r.status === 304;
      return new Response(nobody ? null : bytesFromB64(r.body_b64), { status: r.status, headers: { 'Content-Type': r.content_type || 'application/json' } });
    }, function (e) { throw new TypeError(String(e)); });
  }
  function viaCapHttp(url, init) {
    init = init || {}; var H = plug('CapacitorHttp'); if (!H || (init.body != null && typeof init.body !== 'string')) return Promise.reject(new TypeError('no native http'));
    var headers = plainHeaders(init.headers), data;
    if (typeof init.body === 'string') { try { data = JSON.parse(init.body); } catch (e) { data = init.body; } }
    return H.request({ url: url, method: init.method || 'GET', headers: headers, data: data, responseType: 'text' }).then(function (r) {
      var hd = r.headers || {}, ct = hd['Content-Type'] || hd['content-type'] || 'application/json';
      return new Response(typeof r.data === 'string' ? r.data : JSON.stringify(r.data), { status: r.status, headers: { 'Content-Type': ct } });
    });
  }
  window.fetch = function (input, init) {
    var url = typeof input === 'string' ? input : (input && input.url) || '';
    if (!CFG.api || url.indexOf(CFG.api) !== 0) return rawFetch(input, init);
    if (isTauri) return viaRust(url, init);
    return rawFetch(input, init).catch(function (err) { if (isCap) return viaCapHttp(url, init).catch(function () { throw err; }); throw err; });
  };

  /* ---------- bridge used by app.js ---------- */
  function toBase64(blob) {
    return new Promise(function (res, rej) { var r = new FileReader(); r.onload = function () { res(String(r.result).split(',')[1] || ''); }; r.onerror = rej; r.readAsDataURL(blob); });
  }
  window.PlusNative = {
    platform: platform,
    openExternal: function (url) {
      if (!/^https?:\/\//i.test(url)) return Promise.resolve();
      try {
        if (isCap) { var B = plug('Browser'); if (B) return B.open({ url: url }); }
        if (isTauri) return invoke('open_external', { url: url });
      } catch (e) {}
      window.open(url, '_blank', 'noopener'); return Promise.resolve();
    },
    saveUrl: function (url) { return window.PlusNative.openExternal(url); },
    saveBlob: function (blob, name) {
      name = String(name || 'file').replace(/[\\/:*?"<>|]+/g, '_');
      return toBase64(blob).then(function (b64) {
        if (isTauri) return invoke('save_download', { name: name, data: b64 });
        if (isCap) {
          var F = plug('Filesystem'), S = plug('Share');
          return F.writeFile({ path: 'downloads/' + name, data: b64, directory: 'CACHE', recursive: true })
            .then(function () { return F.getUri({ path: 'downloads/' + name, directory: 'CACHE' }); })
            .then(function (u) { return S.share({ title: name, url: u.uri }); });
        }
      });
    }
  };

  /* external links open in the system browser, never inside the app window */
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href]');
    if (!a) return;
    var href = a.getAttribute('href') || '';
    if (/^https?:\/\//i.test(href) && !a.hasAttribute('download')) { e.preventDefault(); window.PlusNative.openExternal(href); }
  }, true);

  /* ---------- ripples (clipped in their own layer so badges are never cut off) + haptics ---------- */
  var RIP = '.btn,.bn,.nav-btn,.side-link,.pill-tabs button,.post-actions button,.post-actions a,.attach-btn,.b-btn';
  document.addEventListener('pointerdown', function (e) {
    var t = e.target.closest && e.target.closest(RIP);
    if (!t || t.disabled) return;
    var r = t.getBoundingClientRect(), d = Math.max(r.width, r.height) * 2;
    if (getComputedStyle(t).position === 'static') t.classList.add('ripple-host');
    var wrap = document.createElement('span'); wrap.className = 'rip-wrap';
    var s = document.createElement('span'); s.className = 'rip' + (t.matches('.btn-primary,.b-btn.primary') ? '' : ' dark');
    s.style.cssText = 'width:' + d + 'px;height:' + d + 'px;left:' + (e.clientX - r.left - d / 2) + 'px;top:' + (e.clientY - r.top - d / 2) + 'px';
    wrap.appendChild(s); t.appendChild(wrap);
    s.addEventListener('animationend', function () { wrap.remove(); });
    try { navigator.vibrate && navigator.vibrate(8); } catch (x) {}
  }, true);

  /* ---------- keyboard: hide the floating bottom bar while typing ---------- */
  var kbT;
  function isField(el) { return el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) && !/^(checkbox|radio|file|button|submit)$/i.test(el.type || ''); }
  document.addEventListener('focusin', function (e) { if (isField(e.target)) { clearTimeout(kbT); root.classList.add('kb'); } });
  document.addEventListener('focusout', function () { clearTimeout(kbT); kbT = setTimeout(function () { if (!isField(document.activeElement)) root.classList.remove('kb'); }, 120); });

  /* ---------- offline banner ---------- */
  ready(function () {
    var b = document.createElement('div'); b.id = 'net-banner'; b.setAttribute('role', 'status'); b.innerHTML = '<i></i><span>You are offline – reconnecting…</span>';
    document.body.appendChild(b);
    function upd() { b.classList.toggle('show', navigator.onLine === false); }
    window.addEventListener('online', upd); window.addEventListener('offline', upd); upd();
  });

  /* ---------- status bar / native splash ---------- */
  if (isCap) {
    try { var SB = plug('StatusBar'); if (SB) { SB.setStyle({ style: 'LIGHT' }); SB.setBackgroundColor({ color: '#FFFFFF' }); } } catch (e) {}
    try { var SP = plug('SplashScreen'); if (SP) SP.hide({ fadeOutDuration: 200 }); } catch (e) {}
  }

  /* ---------- server check + slide texts (photos are built into the app) ---------- */
  function getPublic() {
    var cached = null; try { cached = JSON.parse(lsGet(CACHE_KEY) || 'null'); } catch (e) {}
    return new Promise(function (res) {
      var c = window.AbortController ? new AbortController() : null, t = setTimeout(function () { if (c) c.abort(); res({ ok: false, slides: cached }); }, 9000);
      window.fetch(CFG.api + '?r=public', { cache: 'no-store', signal: c && c.signal }).then(function (r) { return r.json(); }).then(function (d) {
        clearTimeout(t); if (d && d.ok) { if (d.slides) lsSet(CACHE_KEY, JSON.stringify(d.slides)); res({ ok: true, slides: d.slides || cached }); } else res({ ok: false, slides: cached });
      }).catch(function () { clearTimeout(t); res({ ok: false, slides: cached }); });
    });
  }
  function applyTexts(slides, els) {
    if (!slides) return;
    els.forEach(function (el, i) { var s = slides[i]; if (!s) return; if (s.title) el.querySelector('h2').textContent = s.title; if (s.text) el.querySelector('p').textContent = s.text; });
  }
  function hostOf(u) { try { return new URL(u).host; } catch (e) { return u; } }
  function setupConn(retry) {
    var box = $('#b-conn'); if (!box) return function () {};
    var addr = box.querySelector('.addr'), input = $('#b-conn-input'), change = $('#b-conn-change');
    $('#b-conn-host').textContent = hostOf(CFG.api);
    $('#b-conn-retry').onclick = function () { if (addr.hidden) { box.classList.remove('show'); retry(); return; }
      var v = (input.value || '').trim().replace(/\/+$/, '').replace(/\/api\/index\.php.*$/, '');
      if (!/^https:\/\/[a-z0-9.-]+(:\d+)?(\/[^\s]*)?$/i.test(v)) { input.style.borderColor = '#ED341C'; return; }
      lsSet(OVERRIDE_KEY, v + '/api/index.php'); location.reload(); };
    change.onclick = function () { addr.hidden = false; input.value = hostOf(CFG.api) ? 'https://' + hostOf(CFG.api) : ''; $('#b-conn-retry .lbl').textContent = 'Save and reconnect'; change.textContent = 'Use the original address'; change.onclick = function () { lsDel(OVERRIDE_KEY); location.reload(); }; };
    return function show() { box.classList.add('show'); };
  }

  /* ---------- boot: splash -> onboarding (first launch) -> app ---------- */
  ready(function () {
    var boot = $('#boot'); if (!boot) return;
    var splash = $('#b-splash'), onb = $('#b-onb');
    var slides = [].slice.call(document.querySelectorAll('.b-slide')), dots = [].slice.call(document.querySelectorAll('.b-dot'));
    var track = $('#b-track'), vp = $('#b-vp'), next = $('#b-next'), skip = $('#b-skip'), idx = 0;
    var first = !(lsGet(ONB_KEY) || lsGet('plus_token'));
    var pubP = getPublic(), connShow = setupConn(function () { location.reload(); });
    pubP.then(function (r) { if (first) applyTexts(r.slides, slides); });
    function show(el) { [splash, onb].forEach(function (s) { s.classList.toggle('show', s === el); }); }
    function dismiss() { boot.classList.add('gone'); setTimeout(function () { boot.remove(); }, 800); }
    function finish() { lsSet(ONB_KEY, '1'); onb.classList.remove('show'); dismiss(); }
    function go(i) {
      idx = Math.max(0, Math.min(slides.length - 1, i));
      track.style.transform = 'translateX(' + (-idx * 100) + '%)';
      slides.forEach(function (s, n) { s.classList.toggle('active', n === idx); });
      dots.forEach(function (d, n) { d.classList.toggle('active', n === idx); });
      var last = idx === slides.length - 1;
      next.querySelector('.lbl').textContent = last ? 'Get started' : 'Next';
      skip.style.visibility = last ? 'hidden' : 'visible';
    }
    var sx = 0, sy = 0, dx = 0, drag = false, locked = false;
    vp.addEventListener('pointerdown', function (e) { drag = true; locked = false; sx = e.clientX; sy = e.clientY; dx = 0; track.classList.add('drag'); });
    window.addEventListener('pointermove', function (e) {
      if (!drag) return; dx = e.clientX - sx;
      if (!locked && Math.abs(e.clientY - sy) > Math.abs(dx) + 6) { drag = false; track.classList.remove('drag'); go(idx); return; }
      locked = true; track.style.transform = 'translateX(' + (-idx * vp.clientWidth + dx) + 'px)';
    });
    function end() { if (!drag) return; drag = false; track.classList.remove('drag'); var t = vp.clientWidth * 0.18; go(dx < -t ? idx + 1 : dx > t ? idx - 1 : idx); }
    window.addEventListener('pointerup', end); window.addEventListener('pointercancel', end);
    window.addEventListener('keydown', function (e) { if (!onb.classList.contains('show')) return; if (e.key === 'ArrowRight') next.click(); else if (e.key === 'ArrowLeft') go(idx - 1); });
    next.addEventListener('click', function () { idx === slides.length - 1 ? finish() : go(idx + 1); });
    skip.addEventListener('click', finish);
    go(0);

    var started = Date.now();
    function appReady() { return !!document.querySelector('#app > *:not(.splash)'); }
    sleep(2600).then(function () {
      if (!first) {                                   // returning user: wait for the app itself to be ready, then reveal it
        var wait = function () { if (appReady() || Date.now() - started > 9000) dismiss(); else setTimeout(wait, 120); };
        wait();
      } else {                                        // first launch: give the slides (and their photos) a moment, then show them
        Promise.race([pubP, sleep(1800)]).then(function () { show(onb); });
      }
      pubP.then(function (r) { if (!r.ok && navigator.onLine !== false) connShow(); });
    });
  });
})();
