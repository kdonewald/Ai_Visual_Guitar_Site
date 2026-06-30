/**
 * Vizi Metronome — inline nav controls
 * Injects Hold On / Hold Off / metronome controls directly into the
 * existing .nav-links row alongside Home. No separate sticky element,
 * no race conditions with page navigation or content re-renders.
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
.nav-logo { justify-content: center; }
nav .nav-links, .site-nav .nav-links {
  display: flex !important;
  flex-wrap: wrap !important;
  align-items: center;
  gap: .35rem !important;
  width: 100%;
  justify-content: center;
}

.nav-ctrl-btn {
  display: flex; align-items: center; justify-content: center;
  padding: 0 .6rem; height: 32px; border-radius: 8px;
  border: 1.5px solid rgba(255,255,255,0.15);
  background: transparent;
  font-size: .72rem; font-weight: 600; letter-spacing: .02em;
  cursor: pointer; transition: all .18s; flex-shrink: 0;
  font-family: 'DM Sans', sans-serif; line-height: 1;
  white-space: nowrap;
}

#vm-hold-on { border-color: rgba(232,160,32,0.4); color: var(--gold, #e8a020); }
#vm-hold-on:hover { border-color: var(--gold, #e8a020); background: rgba(232,160,32,0.12); }

#vm-hold-off { border-color: rgba(224,85,64,0.3); color: rgba(224,85,64,0.85); }
#vm-hold-off:hover { border-color: rgba(224,85,64,0.7); color: #e05540; background: rgba(224,85,64,0.08); }

#vm-inline {
  display: flex; align-items: center; gap: .35rem;
  padding: 0 .5rem; height: 32px; border-radius: 8px;
  border: 1.5px solid rgba(255,255,255,0.12);
  background: rgba(255,255,255,0.03);
  flex-shrink: 0;
}
#vm-bpm-display {
  font-family: 'DM Mono', monospace; font-size: .82rem; font-weight: 700;
  color: #fff; min-width: 1.7rem; text-align: center;
}
#vm-slider {
  -webkit-appearance: none; appearance: none;
  width: 60px; height: 3px; border-radius: 2px;
  background: rgba(255,255,255,.2); outline: none; cursor: pointer;
}
#vm-slider::-webkit-slider-thumb {
  -webkit-appearance: none; width: 13px; height: 13px;
  border-radius: 50%; background: #4f8ef7; cursor: pointer;
}
#vm-slider::-moz-range-thumb {
  width: 13px; height: 13px; border-radius: 50%;
  background: #4f8ef7; cursor: pointer; border: none;
}
#vm-tap {
  background: rgba(255,255,255,.08); border: 1px solid rgba(255,255,255,.15);
  border-radius: 50%; width: 26px; height: 26px; flex-shrink: 0;
  cursor: pointer; font-size: .55rem; font-weight: 700; color: rgba(255,255,255,.75);
  display: flex; align-items: center; justify-content: center;
  font-family: 'DM Mono', monospace; transition: all .07s;
}
#vm-tap.pulse { background: #e8a020; border-color: #e8a020; color: #fff; transform: scale(.85); }
#vm-play {
  width: 28px; height: 28px; border-radius: 50%; border: none;
  background: #2e7d52; color: #fff; font-size: .68rem; flex-shrink: 0;
  cursor: pointer; display: flex; align-items: center; justify-content: center;
  transition: all .15s;
}
#vm-play.playing { background: #c93820; }
`;

  const styleEl = document.createElement('style');
  styleEl.textContent = css;
  document.head.appendChild(styleEl);

  // ── State ────────────────────────────────────────────────────
  let bpm = 80, beats = 4, beat = 0;
  let playing = false, audioCtx = null, timer = null;
  let tapTimes = [];
  let vmAlreadyInjected = false;

  function buildElements() {
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

    const inline = document.createElement('div');
    inline.id = 'vm-inline';
    inline.innerHTML = `
      <span id="vm-bpm-display">80</span>
      <input id="vm-slider" type="range" min="40" max="220" value="80">
      <div id="vm-tap">TAP</div>
      <button id="vm-play">▶</button>
    `;

    return { holdOnBtn, holdOffBtn, inline };
  }

  function init() {
    if (vmAlreadyInjected) return;
    const nav = document.querySelector('nav') || document.querySelector('.site-nav');
    const navLinks = nav && nav.querySelector('.nav-links');
    if (!nav || !navLinks) {
      setTimeout(init, 100);
      return;
    }

    const { holdOnBtn, holdOffBtn, inline } = buildElements();
    navLinks.insertBefore(inline,     navLinks.firstChild);
    navLinks.insertBefore(holdOffBtn, navLinks.firstChild);
    navLinks.insertBefore(holdOnBtn,  navLinks.firstChild);

    vmAlreadyInjected = true;
    try { setup(); } catch(err) { console.error('Vizi metronome setup failed:', err); }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  function setup() {
    const el = {
      bpmDisp: document.getElementById('vm-bpm-display'),
      slider:  document.getElementById('vm-slider'),
      tap:     document.getElementById('vm-tap'),
      play:    document.getElementById('vm-play'),
    };
    if (!el.bpmDisp || !el.slider || !el.tap || !el.play) {
      console.warn('Vizi metronome: elements missing after injection');
      return;
    }

    try {
      const savedBpm = parseInt(localStorage.getItem('viziMetroBpm') || '80', 10);
      if (savedBpm >= 40 && savedBpm <= 220) { bpm = savedBpm; }
    } catch(e){}

    el.bpmDisp.textContent = bpm;
    el.slider.value = bpm;

    // ── Hold On / Hold Off ──────────────────────────────────
    async function sendHoldCmd(type) {
      const btn = document.getElementById(type === 'on' ? 'vm-hold-on' : 'vm-hold-off');
      if (!btn) return;
      const orig = btn.textContent;
      btn.textContent = '…';
      btn.style.opacity = '.5';
      try {
        const msg = type === 'on'
          ? 'Please return the HOLD ON command to the fretboard immediately.'
          : 'Please return the HOLD OFF command to the fretboard immediately.';
        await fetch(VM_RAILWAY_URL + '/claude-tts', {
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

    function pulseTap() {
      el.tap.classList.add('pulse');
      setTimeout(() => el.tap.classList.remove('pulse'), 80);
    }

    function tick() {
      if (!playing) return;
      const accent = beat === 0;
      click(accent);
      pulseTap();
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
      beat = 0;
      if (playing) { stop(); start(); }
    }

    // ── Events ───────────────────────────────────────────────
    el.play.addEventListener('click', () => playing ? stop() : start());
    el.slider.addEventListener('input', e => setBpm(e.target.value));
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
      pulseTap();
      clearTimeout(el.tap._rt);
      el.tap._rt = setTimeout(() => { tapTimes = []; }, 3000);
    });

    // ── Public API ───────────────────────────────────────────
    window.viziMetro = { setBpm, getBpm: () => bpm, start, stop, setBeats };
  }

})();
