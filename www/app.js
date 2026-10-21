(() => {
  'use strict';
  const CFG = window.APP_CONFIG || {};
  const KEY = 'enactus_onboarded_v1';
  const $ = (s) => document.querySelector(s);
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const screens = ['splash', 'onboarding', 'opening', 'offline'].reduce((o, id) => (o[id] = $('#' + id), o), {});
  const store = { get: (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } },
                  set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} } };

  function show(name) {
    Object.entries(screens).forEach(([k, el]) => el.classList.toggle('show', k === name));
  }
  const buzz = (ms = 12) => { try { navigator.vibrate && navigator.vibrate(ms); } catch (e) {} };

  // ---- Material-style ripple on every .btn
  document.addEventListener('pointerdown', (e) => {
    const b = e.target.closest('.btn');
    if (!b) return;
    const r = b.getBoundingClientRect(), d = Math.max(r.width, r.height) * 2;
    const s = document.createElement('span');
    s.className = 'ripple';
    s.style.cssText = `width:${d}px;height:${d}px;left:${e.clientX - r.left - d / 2}px;top:${e.clientY - r.top - d / 2}px`;
    b.appendChild(s);
    s.addEventListener('animationend', () => s.remove());
    buzz();
  });

  // ---- Onboarding slider (swipe, buttons, keyboard)
  const slides = [...document.querySelectorAll('.slide')];
  const dots = [...document.querySelectorAll('.dot')];
  const track = $('#track'), viewport = $('#viewport'), next = $('#next');
  let idx = 0;
  const device = CFG.device || 'phone';
  slides.forEach((s) => (s.querySelector('p').textContent = s.querySelector('p').textContent.replace('{{device}}', device)));

  function go(i) {
    idx = Math.max(0, Math.min(slides.length - 1, i));
    track.style.transform = `translateX(${-idx * 100}%)`;
    slides.forEach((s, n) => s.classList.toggle('active', n === idx));
    dots.forEach((d, n) => d.classList.toggle('active', n === idx));
    const last = idx === slides.length - 1;
    next.querySelector('.label').textContent = last ? 'Get started' : 'Next';
    $('#skip').style.visibility = last ? 'hidden' : 'visible';
  }
  let sx = 0, dx = 0, dragging = false;
  viewport.addEventListener('pointerdown', (e) => { if (e.target.closest('.btn')) return; dragging = true; sx = e.clientX; dx = 0; track.classList.add('drag'); });
  window.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    dx = e.clientX - sx;
    const w = viewport.clientWidth;
    track.style.transform = `translateX(${-idx * w + dx}px)`;
  });
  const endDrag = () => {
    if (!dragging) return;
    dragging = false; track.classList.remove('drag');
    const t = viewport.clientWidth * 0.18;
    go(dx < -t ? idx + 1 : dx > t ? idx - 1 : idx);
  };
  window.addEventListener('pointerup', endDrag);
  window.addEventListener('pointercancel', endDrag);
  window.addEventListener('keydown', (e) => {
    if (!screens.onboarding.classList.contains('show')) return;
    if (e.key === 'ArrowRight') next.click(); else if (e.key === 'ArrowLeft') go(idx - 1);
  });
  next.addEventListener('click', () => (idx === slides.length - 1 ? finishOnboarding() : go(idx + 1)));
  $('#skip').addEventListener('click', finishOnboarding);

  function finishOnboarding() { store.set(KEY, '1'); openAdmin(); }

  // ---- Open the real dashboard (it is server-rendered, so we navigate to it)
  async function reachable(url) {
    const c = new AbortController(), t = setTimeout(() => c.abort(), 9000);
    try { await fetch(url, { mode: 'no-cors', cache: 'no-store', signal: c.signal }); return true; }
    catch (e) { return false; } finally { clearTimeout(t); }
  }
  async function openAdmin() {
    show('opening');
    const url = CFG.adminUrl;
    const [ok] = await Promise.all([url ? reachable(url) : false, sleep(700)]);
    if (ok) { window.location.replace(url); } else { show('offline'); }
  }
  $('#retry').addEventListener('click', openAdmin);
  window.addEventListener('online', () => screens.offline.classList.contains('show') && openAdmin());

  // ---- Boot: splash -> (onboarding on first launch) -> dashboard
  async function boot() {
    try { const C = window.Capacitor; const SP = C && ((C.Plugins && C.Plugins.SplashScreen) || (C.registerPlugin && C.registerPlugin('SplashScreen'))); SP && SP.hide({ fadeOutDuration: 200 }); } catch (e) {}
    go(0);
    await sleep(2800);
    if (store.get(KEY)) openAdmin(); else show('onboarding');
  }
  boot();
})();
