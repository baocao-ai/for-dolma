export const $ = (sel, el = document) => el.querySelector(sel);
export const sleep = ms => new Promise(r => setTimeout(r, ms));
export const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

export function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

// localStorage can be blocked (private mode); everything still runs without it.
export const store = {
  get(k, fallback) {
    try { return JSON.parse(localStorage.getItem('dolma.' + k)) ?? fallback; } catch { return fallback; }
  },
  set(k, v) {
    try { localStorage.setItem('dolma.' + k, JSON.stringify(v)); } catch { /* ignore */ }
  },
  del(k) {
    try { localStorage.removeItem('dolma.' + k); } catch { /* ignore */ }
  },
};
