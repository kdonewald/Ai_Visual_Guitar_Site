/**
 * Vizi Metronome — nav-integrated strip
 * Injects a ♩ toggle button into the page nav and a collapsible
 * metronome strip just below it. Works on all four pages.
 * API: window.viziMetro = { setBpm, getBpm, start, stop, setBeats }
 */
(function(){
  'use strict';

  // ── CSS ──────────────────────────────────────────────────────
  const css = `
/* ── Two-row nav ── */
nav {
  flex-direction: column !important;
  align-items: center !important;
  padding: .5rem 1rem !important;
  gap: .4rem !important;
}
.nav-logo {
  justify-content: center;
}
nav .nav-links {
  display: flex !important;
  flex-wrap: nowrap !important;
  align-items: center;
  gap: .4rem !important;
  width: 100%;
  justify-content: center;
}

/* Nav control buttons — shared style */
.nav-ctrl-btn {
  display: flex; align-items: center; justify-content: center;
  padding: 0 .65rem; height: 34px; border-radius: 8px;
  border: 1.5px solid rgba(255,255,255,0.15);
  background: transparent;
  font-size: .75rem; font-weight: 600; letter-spacing: .03em;
  cursor: pointer; transition: all .18s; flex-shrink: 0;
  font-family: 'DM Sans', sans-serif; line-height: 1;
  white-space: nowrap;
}

#vm-toggle-btn {
  color: rgba(255,255,255,0.7);
}
#vm-toggle-btn:hover { border-color: rgba(255,255,255,0.4); color: #fff; }
#vm-toggle-btn.open {
  border-color: var(--gold, #e8a020);
  color: var(--gold, #e8a020);
  background: rgba(232,160,32,0.12);
}

#vm-hold-on {
  border-color: rgba(232,160,32,0.4);
  color: var(--gold, #e8a020);
}
#vm-hold-on:hover { border-color: var(--gold, #e8a020); background: rgba(232,160,32,0.12); }

#vm-hold-off {
  border-color: rgba(224,85,64,0.3);
  color: rgba(224,85,64,0.75);
}
#vm-hold-off:hover { border-color: rgba(224,85,64,0.7); color: #e05540; background: rgba(224,85,64,0.08); }

#vm-strip-wrap {
  width: 100%;
  overflow: hidden;
  max-height: 0;
  transition: max-height .25s ease, border-color .25s;
  background: rgba(15,17,23,0.98);
  border-bottom: 1.5px solid transparent;
  position: sticky;
  top: 57px;
  z-index: 49;
}
#vm-strip-wrap.open {
  max-height: 64px;
  border-color: rgba(255,255,255,0.10);
}

#vm-strip {
  display: flex; align-items: center; gap: 10px;
  padding: 10px 16px;
  font-family: 'DM Sans', sans-serif;
}

#vm-bpm-display {
  font-family: 'DM Mono', monospace;
  font-size: 1.25rem; font-weight: 700;
  color: #fff; min-width: 3rem; text-align: center; flex-shrink: 0;
}
#vm-bpm-label {
  font-family: 'DM Mono', monospace;
  font-size: .62rem; letter-spacing: .1em;
  text-transform: uppercase; color: rgba(255,255,255,.4);
  flex-shrink: 0;
}
#vm-slider {
  flex: 1; -webkit-appearance: none; appearance: none;
  height: 3px; border-radius: 2px;
  background: rgba(255,255,255,.15); outline: none; cursor: pointer;
  min-width: 60px;
}
#vm-slider::-webkit-slider-thumb {
  -webkit-appearance: none; width: 18px; height: 18px;
  border-radius: 50%; background: #4f8ef7; cursor: pointer;
}
#vm-slider::-moz-range-thumb {
  width: 18px; height: 18px; border-radius: 50%;
  background: #4f8ef7; cursor: pointer; border: none;
}
#vm-beats { display: flex; gap: 5px; flex-shrink: 0; }
.vm-dot {
  width: 10px; height: 10px; border-radius: 50%;
  background: rgba(255,255,255,.15); transition: background .06s, box-shadow .06s;
}
.vm-dot.active { background: #4f8ef7; box-shadow: 0 0 6px rgba(79,142,247,.7); }
.vm-dot.accent { background: #e8a020; box-shadow: 0 0 6px rgba(232,160,32,.7); }
#vm-tap {
  background: rgba(255,255,255,.08); border: 1.5px solid rgba(255,255,255,.15);
  border-radius: 50%; width: 40px; height: 40px; flex-shrink: 0;
  cursor: pointer; font-size: .82rem; color: rgba(255,255,255,.75);
  display: flex; align-items: center; justify-content: center;
  transition: all .07s; font-family: 'DM Mono', monospace; font-weight: 600;
}
#vm-tap:hover { background: rgba(255,255,255,.14); }
#vm-tap.pulse { background: #e8a020; border-color: #e8a020; color: #fff; transform: scale(.88); }
#vm-ts {
  font-family: 'DM Mono', monospace; font-size: .72rem;
  color: rgba(255,255,255,.55); background: rgba(255,255,255,.07);
  border: 1px solid rgba(255,255,255,.12); border-radius: 6px;
  padding: 4px 9px; cursor: pointer; flex-shrink: 0;
  transition: background .15s; white-space: nowrap;
}
#vm-ts:hover { background: rgba(255,255,255,.13); color: #fff; }
#vm-play {
  width: 42px; height: 42px; border-radius: 50%; border: none;
  background: #2e7d52; color: #fff; font-size: 1rem; flex-shrink: 0;
  cursor: pointer; display: flex; align-items: center; justify-content: center;
  transition: all .15s; box-shadow: 0 2px 8px rgba(46,125,82,.4);
}
#vm-play:hover { background: #3a9966; }
#vm-play.playing { background: #c93820; box-shadow: 0 2px 8px rgba(201,56,32,.4); }
#vm-play.playing:hover { background: #e04030; }
`;

  // ── Inject CSS ────────────────────────────────────────────────
  const styleEl = document.createElement('style');
  styleEl.textContent = css;
  document.head.appendChild(styleEl);

  // ── Find nav and inject toggle button ─────────────────────────
  function injectToggleBtn() {
    const nav = document.querySelector('nav');
    if (!nav) return false;
    const navLinks = nav.querySelector('.nav-links');
    if (!navLinks) return false;

    // Metro toggle
    const toggleBtn = document.createElement('button');
    toggleBtn.id = 'vm-toggle-btn';
    toggleBtn.className = 'nav-ctrl-btn';
    toggleBtn.title = 'Metronome';
    toggleBtn.textContent = 'Metro';

    // Hold On
    const holdOnBtn = document.createElement('button');
    holdOnBtn.id = 'vm-hold-on';
    holdOnBtn.className = 'nav-ctrl-btn';
    holdOnBtn.title = 'Latch current fretboard LEDs';
    holdOnBtn.textContent = 'Hold On';

    // Hold Off
    const holdOffBtn = document.createElement('button');
    holdOffBtn.id = 'vm-hold-off';
    holdOffBtn.className = 'nav-ctrl-btn';
    holdOffBtn.title = 'Release fretboard hold';
    holdOffBtn.textContent = 'Hold Off';

    // Insert before Home (first child)
    navLinks.insertBefore(toggleBtn,  navLinks.firstChild);
    navLinks.insertBefore(holdOffBtn, navLinks.firstChild);
    navLinks.insertBefore(holdOnBtn,  navLinks.firstChild);

    return true;
  }

  // ── Build the strip HTML ──────────────────────────────────────
  const stripWrap = document.createElement('div');
  stripWrap.id = 'vm-strip-wrap';
  stripWrap.innerHTML = `
<div id="vm-strip">
  <span id="vm-bpm-display">80</span>
  <span id="vm-bpm-label">BPM</span>
  <input id="vm-slider" type="range" min="40" max="220" value="80">
  <div id="vm-beats">
    <div class="vm-dot"></div><div class="vm-dot"></div>
    <div class="vm-dot"></div><div class="vm-dot"></div>
  </div>
  <div id="vm-tap">TAP</div>
  <span id="vm-ts">4/4</span>
  <button id="vm-play">▶</button>
</div>`;

  // Insert strip after nav
  function injectStrip() {
    const nav = document.querySelector('nav');
    if (!nav) return false;
    nav.parentNode.insertBefore(stripWrap, nav.nextSibling);
    return true;
  }

  // ── Wait for DOM then inject ──────────────────────────────────
  function init() {
    if (!injectToggleBtn() || !injectStrip()) {
      // retry if nav not ready
      setTimeout(init, 100);
      return;
    }
    setup();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // ── State ────────────────────────────────────────────────────
  const TS_CYCLE = [2, 3, 4, 6];
  let bpm = 80, beats = 4, beat = 0;
  let playing = false, audioCtx = null, timer = null;
  let tapTimes = [];
  let stripOpen = false;

  function setup() {
    const el = {
      toggleBtn: document.getElementById('vm-toggle-btn'),
      stripWrap: document.getElementById('vm-strip-wrap'),
      bpmDisp:   document.getElementById('vm-bpm-display'),
      slider:    document.getElementById('vm-slider'),
      tap:       document.getElementById('vm-tap'),
      ts:        document.getElementById('vm-ts'),
      play:      document.getElementById('vm-play'),
    };
    function getDots() { return document.querySelectorAll('.vm-dot'); }

    // ── Restore saved state ───────────────────────────────────
    try {
      const savedBpm = parseInt(localStorage.getItem('viziMetroBpm') || '80', 10);
      if (savedBpm >= 40 && savedBpm <= 220) { bpm = savedBpm; }
      const wasOpen = localStorage.getItem('viziMetroOpen') === '1';
      if (wasOpen) openStrip();
    } catch(e){}

    el.bpmDisp.textContent = bpm;
    el.slider.value = bpm;

    // ── Toggle strip ─────────────────────────────────────────
    function openStrip() {
      stripOpen = true;
      el.stripWrap.classList.add('open');
      el.toggleBtn.classList.add('open');
      try { localStorage.setItem('viziMetroOpen', '1'); } catch(e){}
    }
    function closeStrip() {
      stripOpen = false;
      el.stripWrap.classList.remove('open');
      el.toggleBtn.classList.remove('open');
      try { localStorage.removeItem('viziMetroOpen'); } catch(e){}
    }

    el.toggleBtn.addEventListener('click', () => {
      stripOpen ? closeStrip() : openStrip();
    });

    // ── Hold On / Hold Off ────────────────────────────────
    const RAILWAY_URL = window.RAILWAY_URL ||
      'https://vizi-tts-proxy-production.up.railway.app';

    async function sendHoldCmd(type) {
      const btn = document.getElementById(type === 'on' ? 'vm-hold-on' : 'vm-hold-off');
      const orig = btn.textContent;
      btn.textContent = '…';
      btn.style.opacity = '.5';
      try {
        const msg = type === 'on'
          ? 'Please return the HOLD ON command to the fretboard immediately.'
          : 'Please return the HOLD OFF command to the fretboard immediately.';
        await fetch(RAILWAY_URL + '/claude-tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: msg, mode: 'talk' })
        });
      } catch(e) {}
      btn.textContent = orig;
      btn.style.opacity = '';
    }

    const holdOnEl  = document.getElementById('vm-hold-on');
    const holdOffEl = document.getElementById('vm-hold-off');
    if (holdOnEl)  holdOnEl.addEventListener('click',  () => sendHoldCmd('on'));
    if (holdOffEl) holdOffEl.addEventListener('click', () => sendHoldCmd('off'));

    // ── Audio ────────────────────────────────────────────────
    function click(accent) {
      if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx.state === 'suspended') audioCtx.resume();
      const o = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      const t = audioCtx.currentTime;
      o.frequency.value = accent ? 1100 : 750;
      g.gain.setValueAtTime(accent ? 0.45 : 0.28, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.07);
      o.connect(g); g.connect(audioCtx.destination);
      o.start(t); o.stop(t + 0.09);
    }

    function flashDot(n, accent) {
      getDots().forEach(d => d.classList.remove('active','accent'));
      const dots = getDots();
      if (dots[n]) dots[n].classList.add(accent ? 'accent' : 'active');
      el.tap.classList.add('pulse');
      setTimeout(() => el.tap.classList.remove('pulse'), 80);
    }

    function tick() {
      if (!playing) return;
      const accent = beat === 0;
      click(accent);
      flashDot(beat, accent);
      beat = (beat + 1) % beats;
      timer = setTimeout(tick, 60000 / bpm);
    }

    function start() {
      if (playing) return;
      playing = true; beat = 0;
      el.play.textContent = '■';
      el.play.classList.add('playing');
      tick();
    }

    function stop() {
      playing = false;
      clearTimeout(timer); timer = null;
      el.play.textContent = '▶';
      el.play.classList.remove('playing');
      getDots().forEach(d => d.classList.remove('active','accent'));
    }

    function setBpm(v) {
      bpm = Math.max(40, Math.min(220, parseInt(v, 10) || 80));
      el.bpmDisp.textContent = bpm;
      el.slider.value = bpm;
      try { localStorage.setItem('viziMetroBpm', bpm); } catch(e){}
      if (playing) { stop(); start(); }
    }

    function setBeats(n) {
      beats = n;
      el.ts.textContent = n === 6 ? '6/8' : n + '/4';
      const container = document.getElementById('vm-beats');
      container.innerHTML = '';
      for (let i = 0; i < n; i++) {
        const d = document.createElement('div');
        d.className = 'vm-dot';
        container.appendChild(d);
      }
      beat = 0;
      if (playing) { stop(); start(); }
    }

    // ── Events ───────────────────────────────────────────────
    el.play.addEventListener('click', () => playing ? stop() : start());
    el.slider.addEventListener('input', e => setBpm(e.target.value));
    el.ts.addEventListener('click', () => {
      const idx = TS_CYCLE.indexOf(beats);
      setBeats(TS_CYCLE[(idx + 1) % TS_CYCLE.length]);
    });
    el.tap.addEventListener('click', () => {
      const now = Date.now();
      tapTimes = tapTimes.filter(t => now - t < 3000);
      tapTimes.push(now);
      if (tapTimes.length >= 2) {
        const gaps = [];
        for (let i = 1; i < tapTimes.length; i++) gaps.push(tapTimes[i] - tapTimes[i-1]);
        const avg = gaps.reduce((a,b) => a+b, 0) / gaps.length;
        setBpm(Math.round(60000 / avg));
      }
      el.tap.classList.add('pulse');
      setTimeout(() => el.tap.classList.remove('pulse'), 80);
      clearTimeout(el.tap._rt);
      el.tap._rt = setTimeout(() => { tapTimes = []; }, 3000);
    });

    // ── Public API ───────────────────────────────────────────
    window.viziMetro = {
      setBpm,
      getBpm: () => bpm,
      start,
      stop,
      setBeats
    };
  }

})();
