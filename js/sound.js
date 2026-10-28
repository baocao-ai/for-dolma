// Chiptune blips from WebAudio square waves, so there are no audio files to ship.
import { store } from './util.js';

let ac;
let muted = store.get('muted', false);

export const isMuted = () => muted;
export function setMuted(m) { muted = m; store.set('muted', m); }

// Browsers only allow audio after a tap, so this runs on PRESS START.
export function unlockAudio() {
  try {
    ac ??= new (window.AudioContext || window.webkitAudioContext)();
    if (ac.state === 'suspended') ac.resume();
  } catch { /* no audio, games still work */ }
}

function play(notes) {
  if (muted || !ac) return;
  const t0 = ac.currentTime;
  for (const [freq, at, dur, type = 'square', vol = 0.06] of notes) {
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(vol, t0 + at);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + at + dur);
    o.connect(g).connect(ac.destination);
    o.start(t0 + at);
    o.stop(t0 + at + dur + 0.02);
  }
}

let lastScratch = 0;
export const sfx = {
  tap: () => play([[660, 0, 0.05]]),
  flip: () => play([[520, 0, 0.04], [780, 0.04, 0.04]]),
  good: () => play([[880, 0, 0.08], [1320, 0.08, 0.14]]),
  bad: () => play([[220, 0, 0.14, 'sawtooth', 0.05], [160, 0.12, 0.2, 'sawtooth', 0.05]]),
  start: () => play([[392, 0, 0.1], [523, 0.1, 0.1], [659, 0.2, 0.1], [784, 0.3, 0.22]]),
  win: () => play([[523, 0, 0.12], [659, 0.12, 0.12], [784, 0.24, 0.12], [1047, 0.36, 0.12], [784, 0.48, 0.1], [1047, 0.58, 0.35]]),
  scratch() {
    const now = performance.now();
    if (now - lastScratch < 70) return;
    lastScratch = now;
    play([[1400 + Math.random() * 900, 0, 0.03, 'triangle', 0.03]]);
  },
};
