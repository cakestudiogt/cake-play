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

export function sfxPlace() {
  beep({ freq: 360, dur: 0.05, type: 'triangle', gain: 0.05 });
  setTimeout(() => beep({ freq: 480, dur: 0.04, type: 'sine', gain: 0.03 }), 30);
}

export function sfxClear() {
  beep({ freq: 420, dur: 0.1, type: 'sine', gain: 0.06, slide: 160 });
  setTimeout(() => beep({ freq: 620, dur: 0.12, type: 'triangle', gain: 0.05 }), 50);
}

export function sfxCombo(n = 2) {
  beep({ freq: 440 + n * 50, dur: 0.14, type: 'square', gain: 0.035, slide: 220 });
  setTimeout(() => beep({ freq: 660 + n * 40, dur: 0.16, type: 'sine', gain: 0.05, slide: 80 }), 70);
  if (n >= 3) {
    setTimeout(() => beep({ freq: 880, dur: 0.18, type: 'triangle', gain: 0.04, slide: 100 }), 140);
  }
}

export function sfxDeal() {
  beep({ freq: 300, dur: 0.04, type: 'triangle', gain: 0.03 });
  setTimeout(() => beep({ freq: 380, dur: 0.04, type: 'triangle', gain: 0.03 }), 40);
  setTimeout(() => beep({ freq: 460, dur: 0.05, type: 'sine', gain: 0.03 }), 80);
}

export function sfxGameOver() {
  beep({ freq: 280, dur: 0.2, type: 'sawtooth', gain: 0.04, slide: -120 });
  setTimeout(() => beep({ freq: 180, dur: 0.28, type: 'triangle', gain: 0.05 }), 120);
}
