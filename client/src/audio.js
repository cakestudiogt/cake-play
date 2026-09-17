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

export function sfxDrop() {
  beep({ freq: 320, dur: 0.06, type: 'triangle', gain: 0.05 });
}

export function sfxMerge(level = 0) {
  beep({ freq: 380 + level * 40, dur: 0.12, type: 'sine', gain: 0.07, slide: 120 });
  setTimeout(() => beep({ freq: 520 + level * 30, dur: 0.1, type: 'triangle', gain: 0.05 }), 40);
}

export function sfxCombo(n) {
  beep({ freq: 440 + n * 60, dur: 0.15, type: 'square', gain: 0.04, slide: 200 });
}

export function sfxGameOver() {
  beep({ freq: 280, dur: 0.2, type: 'sawtooth', gain: 0.04, slide: -120 });
  setTimeout(() => beep({ freq: 180, dur: 0.28, type: 'triangle', gain: 0.05 }), 120);
}
