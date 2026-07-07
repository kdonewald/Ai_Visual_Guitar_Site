/**
 * Vizi Metronome — inline nav controls v3
 * Row 1: [Home] [Hold On] [Hold Off] [Reset]
 * Row 2: [3/4] [4/4] [−] [BPM] [+] [▶]  — full width, no slider, no tap
 * Hold-to-repeat with acceleration on − and + buttons.
 * API: window.viziMetro = { setBpm, getBpm, start, stop, setBeats }
 */
(function(){
  'use strict';

  const VM_RAILWAY_URL = 'https://vizi-tts-proxy-production.up.railway.app';

  // ── CSS ──────────────────────────────────────────────────────
  const css = `
nav, .site-nav {
  flex-direction: column !important;
  align-items: center !important;
  padding: .5rem 1rem !important;
  gap: .45rem !important;
}
.nav-logo { display: none !important; }

/* Row 1 — nav-links holds Home + hold buttons */
nav .nav-links, .site-nav .nav-links {
  display: flex !important;
  flex-wrap: nowrap !important;
  align-items: center;
  gap: .4rem !important;
  width: 100%;
  justify-content: flex-start !important;
}

/* Row 2 — metronome bar */
#vm-metro-row {
  display: flex;
  align-items: center;
  width: 100%;
  gap: .4rem;
  box-sizing: border-box;
}

/* Shared button base */
.nav-ctrl-btn {
  display: flex; align-items: center; justify-content: center;
  padding: 0 .75rem; height: 38px; border-radius: 8px;
  border: 1.5px solid rgba(255,255,255,0.15);
  background: transparent;
  font-size: .82rem; font-weight: 600; letter-spacing: .02em;
  cursor: pointer; transition: all .18s; flex-shrink: 0;
  font-family: 'DM Sans', sans-serif; line-height: 1;
  white-space: nowrap; color: var(--text, #f0ede8);
}

/* Home — bigger and more distinctive than the other controls, since it's the primary escape hatch */
#vm-home {
  height: 42px;
  padding: 0 1rem;
  font-size: .88rem;
  font-weight: 700;
  border-width: 2px;
  border-color: var(--vizi, #3dba72);
  color: var(--vizi, #3dba72);
  background: rgba(61,186,114,0.10);
  text-decoration: none;
}
#vm-home:hover { border-color: var(--vizi, #3dba72); background: rgba(61,186,114,0.20); }

/* Hold On */
#vm-hold-on { border-color: rgba(232,160,32,0.4); color: var(--gold, #e8a020); }
#vm-hold-on:hover { border-color: var(--gold, #e8a020); background: rgba(232,160,32,0.12); }

/* Hold Off */
#vm-hold-off { border-color: rgba(224,85,64,0.3); color: rgba(224,85,64,0.85); }
#vm-hold-off:hover { border-color: rgba(224,85,64,0.7); color: #e05540; background: rgba(224,85,64,0.08); }

/* Reset */
#vm-reset { border-color: rgba(79,142,247,0.35); color: rgba(79,142,247,0.85); }
#vm-reset:hover { border-color: var(--blue, #4f8ef7); color: #4f8ef7; background: rgba(79,142,247,0.08); }

/* Time sig toggle buttons */
.vm-ts-btn {
  display: flex; align-items: center; justify-content: center;
  height: 42px; width: 52px; border-radius: 8px; flex-shrink: 0;
  border: 1.5px solid rgba(255,255,255,0.15);
  background: transparent;
  font-family: 'DM Mono', monospace; font-size: .88rem; font-weight: 700;
  color: rgba(255,255,255,0.5); cursor: pointer; transition: all .18s;
}
.vm-ts-btn.active {
  border-color: var(--teal, #2dd4bf);
  color: var(--teal, #2dd4bf);
  background: rgba(45,212,191,0.1);
}
.vm-ts-btn:hover:not(.active) {
  border-color: rgba(255,255,255,0.35);
  color: rgba(255,255,255,0.8);
}

/* BPM − + display */
#vm-bpm-minus, #vm-bpm-plus {
  display: flex; align-items: center; justify-content: center;
  height: 42px; width: 42px; border-radius: 8px; flex-shrink: 0;
  border: 1.5px solid rgba(255,255,255,0.15);
  background: rgba(255,255,255,0.04);
  font-size: 1.2rem; font-weight: 700; color: #fff;
  cursor: pointer; transition: all .15s; user-select: none;
  font-family: 'DM Mono', monospace;
}
#vm-bpm-minus:hover, #vm-bpm-plus:hover {
  border-color: rgba(255,255,255,0.4);
  background: rgba(255,255,255,0.1);
}
#vm-bpm-minus:active, #vm-bpm-plus:active {
  background: rgba(255,255,255,0.16);
}

#vm-bpm-display {
  font-family: 'DM Mono', monospace; font-size: 1.05rem; font-weight: 700;
  color: #fff; min-width: 3.2rem; text-align: center;
  display: flex; flex-direction: column; align-items: center; line-height: 1.1;
  flex-shrink: 0;
}
#vm-bpm-display .vm-bpm-num { font-size: 1.1rem; }
#vm-bpm-display .vm-bpm-label {
  font-size: .6rem; letter-spacing: .1em; text-transform: uppercase;
  color: rgba(255,255,255,0.4); font-weight: 500;
}

/* Play button */
#vm-play {
  height: 42px; width: 42px; border-radius: 50%; border: none; flex-shrink: 0;
  background: #2e7d52; color: #fff; font-size: .75rem;
  cursor: pointer; display: flex; align-items: center; justify-content: center;
  transition: all .15s; margin-left: auto;
}
#vm-play.playing { background: #c93820; }
#vm-play:hover { filter: brightness(1.15); }
`;

  const styleEl = document.createElement('style');
  styleEl.textContent = css;
  document.head.appendChild(styleEl);

  // ── State ────────────────────────────────────────────────────
  let bpm = 80, beats = 4, beat = 0;
  let playing = false, audioCtx = null, timer = null;
  let vmAlreadyInjected = false;

  // Hold-to-repeat state
  let repeatTimer = null, repeatInterval = null;

  function buildElements() {
    // ── Row 1: Home + hold buttons ──
    const homeBtn = document.createElement('a');
    homeBtn.id = 'vm-home';
    homeBtn.className = 'nav-ctrl-btn';
    homeBtn.href = 'index.html';
    homeBtn.textContent = 'Home';

    const holdOnBtn = document.createElement('button');
    holdOnBtn.id = 'vm-hold-on';
    holdOnBtn.className = 'nav-ctrl-btn';
    holdOnBtn.title = 'Latch current fretboard LEDs';
    holdOnBtn.textContent = 'Hold On';

    const holdOffBtn = document.createElement('button');
    holdOffBtn.id = 'vm-hold-off';
    holdOffBtn.className = 'nav-ctrl-btn';
    holdOffBtn.title = 'Release fretboard hold';
    holdOffBtn.textContent = 'Hold Off';

    const resetBtn = document.createElement('button');
    resetBtn.id = 'vm-reset';
    resetBtn.className = 'nav-ctrl-btn';
    resetBtn.title = 'Reset fretboard';
    resetBtn.textContent = 'Reset';

    // ── Row 2: metronome bar ──
    const metroRow = document.createElement('div');
    metroRow.id = 'vm-metro-row';
    metroRow.innerHTML = `
      <button class="vm-ts-btn" id="vm-ts-3" title="3/4 time">3/4</button>
      <button class="vm-ts-btn active" id="vm-ts-4" title="4/4 time">4/4</button>
      <button id="vm-bpm-minus">−</button>
      <div id="vm-bpm-display">
        <span class="vm-bpm-num">80</span>
        <span class="vm-bpm-label">BPM</span>
      </div>
      <button id="vm-bpm-plus">+</button>
      <button id="vm-play">▶</button>
    `;

    return { homeBtn, holdOnBtn, holdOffBtn, resetBtn, metroRow };
  }

  function init() {
    if (vmAlreadyInjected) return;
    const nav = document.querySelector('nav') || document.querySelector('.site-nav');
    const navLinks = nav && nav.querySelector('.nav-links');
    if (!nav || !navLinks) { setTimeout(init, 100); return; }

    const { homeBtn, holdOnBtn, holdOffBtn, resetBtn, metroRow } = buildElements();

    // Clear existing nav-links children, replace with our row 1
    navLinks.innerHTML = '';
    navLinks.appendChild(homeBtn);
    navLinks.appendChild(holdOnBtn);
    navLinks.appendChild(holdOffBtn);
    navLinks.appendChild(resetBtn);

    // Row 2 appended directly to nav
    nav.appendChild(metroRow);

    vmAlreadyInjected = true;
    try { setup(); } catch(err) { console.error('Vizi metronome setup failed:', err); }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  function setup() {
    const bpmNumEl = document.querySelector('#vm-bpm-display .vm-bpm-num');
    const playBtn  = document.getElementById('vm-play');
    const minusBtn = document.getElementById('vm-bpm-minus');
    const plusBtn  = document.getElementById('vm-bpm-plus');
    const ts3Btn   = document.getElementById('vm-ts-3');
    const ts4Btn   = document.getElementById('vm-ts-4');

    if (!bpmNumEl || !playBtn || !minusBtn || !plusBtn) {
      console.warn('Vizi metronome: elements missing'); return;
    }

    // Restore saved BPM
    try {
      const saved = parseInt(localStorage.getItem('viziMetroBpm') || '80', 10);
      if (saved >= 40 && saved <= 220) bpm = saved;
    } catch(e){}
    bpmNumEl.textContent = bpm;

    // ── Hold commands ────────────────────────────────────────
    async function sendHoldCmd(type) {
      const btn = document.getElementById(type === 'on' ? 'vm-hold-on' : 'vm-hold-off');
      if (!btn) return;
      const orig = btn.textContent; btn.textContent = '…'; btn.style.opacity = '.5';
      try {
        const msg = type === 'on'
          ? 'Please return the HOLD ON command to the fretboard immediately.'
          : 'Please return the HOLD OFF command to the fretboard immediately.';
        await fetch(VM_RAILWAY_URL + '/claude-tts', {
          method:'POST', headers:{'Content-Type':'application/json'},
          body: JSON.stringify({ message: msg, mode: 'talk' })
        });
      } catch(e){}
      btn.textContent = orig; btn.style.opacity = '';
    }

    async function sendReset() {
      const btn = document.getElementById('vm-reset');
      if (!btn) return;
      const orig = btn.textContent; btn.textContent = '…'; btn.style.opacity = '.5';
      try {
        await fetch(VM_RAILWAY_URL + '/claude-tts', {
          method:'POST', headers:{'Content-Type':'application/json'},
          body: JSON.stringify({ message:'Please return the RESET command to the fretboard immediately.', mode:'talk' })
        });
      } catch(e){}
      btn.textContent = orig; btn.style.opacity = '';
    }

    document.getElementById('vm-hold-on') .addEventListener('click', () => sendHoldCmd('on'));
    document.getElementById('vm-hold-off').addEventListener('click', () => sendHoldCmd('off'));
    document.getElementById('vm-reset')   .addEventListener('click', sendReset);

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

    function tick() {
      if (!playing) return;
      click(beat === 0);
      beat = (beat + 1) % beats;
      timer = setTimeout(tick, 60000 / bpm);
    }

    function start() {
      if (playing) return;
      playing = true; beat = 0;
      playBtn.textContent = '■'; playBtn.classList.add('playing');
      tick();
    }

    function stop() {
      playing = false; clearTimeout(timer); timer = null;
      playBtn.textContent = '▶'; playBtn.classList.remove('playing');
    }

    function setBpm(v) {
      bpm = Math.max(40, Math.min(220, parseInt(v, 10) || 80));
      bpmNumEl.textContent = bpm;
      try { localStorage.setItem('viziMetroBpm', bpm); } catch(e){}
      if (playing) { stop(); start(); }
    }

    function setBeats(n) {
      beats = n; beat = 0;
      if (playing) { stop(); start(); }
    }

    // ── Hold-to-repeat with acceleration ────────────────────
    function startRepeat(delta) {
      let stepCount = 0;
      setBpm(bpm + delta);
      repeatTimer = setTimeout(function fire() {
        stepCount++;
        // Accelerate: after 10 steps jump by 5, after 20 jump by 10
        const step = stepCount > 20 ? 10 : stepCount > 10 ? 5 : 1;
        setBpm(bpm + delta * step);
        repeatInterval = setTimeout(fire, stepCount > 10 ? 60 : 120);
      }, 400);
    }

    function stopRepeat() {
      clearTimeout(repeatTimer);
      clearTimeout(repeatInterval);
      repeatTimer = repeatInterval = null;
    }

    function addHoldRepeat(btn, delta) {
      btn.addEventListener('mousedown',  () => startRepeat(delta));
      btn.addEventListener('touchstart', (e) => { e.preventDefault(); startRepeat(delta); }, { passive: false });
      btn.addEventListener('mouseup',    stopRepeat);
      btn.addEventListener('mouseleave', stopRepeat);
      btn.addEventListener('touchend',   stopRepeat);
      btn.addEventListener('touchcancel',stopRepeat);
    }

    addHoldRepeat(minusBtn, -1);
    addHoldRepeat(plusBtn,  +1);

    // ── Time signature toggle ────────────────────────────────
    ts3Btn.addEventListener('click', () => {
      ts3Btn.classList.add('active');
      ts4Btn.classList.remove('active');
      setBeats(3);
    });
    ts4Btn.addEventListener('click', () => {
      ts4Btn.classList.add('active');
      ts3Btn.classList.remove('active');
      setBeats(4);
    });

    // ── Play ─────────────────────────────────────────────────
    playBtn.addEventListener('click', () => playing ? stop() : start());

    // ── Public API ───────────────────────────────────────────
    window.viziMetro = { setBpm, getBpm: () => bpm, start, stop, setBeats };
  }

})();
