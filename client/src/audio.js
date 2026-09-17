/** Tiny procedural SFX — no asset files required */
let muted = false;
let ctx;

function ac() {
  if (!ctx) {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    ctx = new Ctx();
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

export function setMuted(m) {
  muted = m;
}

export function isMuted() {
  return muted;
}

function beep({ freq = 440, dur = 0.08, type = 'sine', gain = 0.06, slide = 0 }) {
  if (muted) return;
  const c = ac();
  if (!c) return;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, c.currentTime);
  if (slide) o.frequency.linearRampToValueAtTime(freq + slide, c.currentTime + dur);
  g.gain.setValueAtTime(gain, c.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + dur);
  o.connect(g);
  g.connect(c.destination);
  o.start();
  o.stop(c.currentTime + dur + 0.02);
}

export function sfxLane() {
  beep({ freq: 360, dur: 0.07, type: 'sine', gain: 0.04, slide: 80 });
}

export function sfxCollect(tier = 1) {
  const base = 480 + tier * 60;
  beep({ freq: base, dur: 0.09, type: 'triangle', gain: 0.05, slide: 160 });
  setTimeout(() => beep({ freq: base + 180, dur: 0.1, type: 'sine', gain: 0.035 }), 35);
}

export function sfxHit() {
  beep({ freq: 160, dur: 0.16, type: 'sawtooth', gain: 0.04, slide: -60 });
  setTimeout(() => beep({ freq: 110, dur: 0.2, type: 'triangle', gain: 0.045 }), 80);
}

export function sfxCombo(n = 2) {
  beep({ freq: 440 + n * 45, dur: 0.12, type: 'square', gain: 0.032, slide: 200 });
  setTimeout(() => beep({ freq: 660 + n * 35, dur: 0.14, type: 'sine', gain: 0.045, slide: 90 }), 60);
  if (n >= 4) {
    setTimeout(() => beep({ freq: 880, dur: 0.16, type: 'triangle', gain: 0.038, slide: 100 }), 120);
  }
}

export function sfxJump() {
  beep({ freq: 280, dur: 0.12, type: 'sine', gain: 0.04, slide: 220 });
}

export function sfxGameOver() {
  beep({ freq: 280, dur: 0.2, type: 'sawtooth', gain: 0.04, slide: -120 });
  setTimeout(() => beep({ freq: 180, dur: 0.28, type: 'triangle', gain: 0.05 }), 120);
}

export function vibrate(ms = 12) {
  try {
    if (!muted && navigator.vibrate) navigator.vibrate(ms);
  } catch {
    /* ignore */
  }
}
