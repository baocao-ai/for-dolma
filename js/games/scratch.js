// Scratch-off tickets: rub away the foil to reveal a photo. Clears itself once most of the foil is gone.
import { sleep } from '../util.js';

const CLEAR_AT = 0.55;

async function drawFoil(canvas) {
  const g = canvas.getContext('2d');
  const { width: w, height: h } = canvas;
  const grad = g.createLinearGradient(0, 0, w, h);
  grad.addColorStop(0, '#d9d2ea');
  grad.addColorStop(0.5, '#f4f0fb');
  grad.addColorStop(1, '#c9bfe0');
  g.fillStyle = grad;
  g.fillRect(0, 0, w, h);

  // Pixel-heart pattern
  const px = Math.max(3, Math.round(w / 90));
  const heart = ['.XX.XX.', 'XXXXXXX', 'XXXXXXX', '.XXXXX.', '..XXX..', '...X...'];
  g.fillStyle = 'rgba(157,132,230,.45)';
  for (let y = px * 4, row = 0; y < h; y += px * 11, row++) {
    for (let x = (row % 2) * px * 6 + px * 2; x < w; x += px * 12) {
      heart.forEach((line, r) => [...line].forEach((ch, c) => ch === 'X' && g.fillRect(x + c * px, y + r * px, px, px)));
    }
  }

  await document.fonts.load('16px "Press Start 2P"').catch(() => {});
  const fs = Math.round(w / 17);
  g.font = `${fs}px "Press Start 2P", monospace`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  const label = 'SCRATCH ME ♥';
  const tw = g.measureText(label).width + fs * 1.6;
  g.fillStyle = '#3b2a5a';
  g.fillRect((w - tw) / 2, h / 2 - fs * 1.3, tw, fs * 2.6);
  g.fillStyle = '#ffe08a';
  g.fillText(label, w / 2, h / 2 + 1);
}

function scratchedShare(canvas) {
  const { data } = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height);
  let clear = 0, total = 0;
  for (let i = 3; i < data.length; i += 4 * 24) { total++; if (data[i] === 0) clear++; }
  return clear / total;
}

export default {
  title: 'SCRATCH TO WIN!',
  async start(el, data, ctx) {
    const cards = data.scratch;
    for (let i = 0; i < cards.length; i++) {
      const card = cards[i];
      ctx.status(`CARD ${i + 1}/${cards.length}`);
      const url = await ctx.photo(card.photo);
      el.innerHTML = `
        <div class="ticket"><img alt="" src="${url}"><canvas aria-label="Scratch-off foil"></canvas></div>
        <p class="scr-cap hidden-cap">Rub the foil with your finger</p>`;
      const canvas = el.querySelector('canvas');
      const cap = el.querySelector('.scr-cap');
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(canvas.clientWidth * dpr);
      canvas.height = Math.round(canvas.clientHeight * dpr);
      await drawFoil(canvas);

      await new Promise(resolve => {
        const g = canvas.getContext('2d');
        g.globalCompositeOperation = 'destination-out';
        g.lineCap = g.lineJoin = 'round';
        g.lineWidth = 46 * dpr;
        let last = null, strokes = 0, finished = false;

        const point = e => {
          const r = canvas.getBoundingClientRect();
          return [(e.clientX - r.left) * dpr, (e.clientY - r.top) * dpr];
        };
        const rub = e => {
          if (!last || finished) return;
          const p = point(e);
          g.beginPath(); g.moveTo(...last); g.lineTo(...p); g.stroke();
          last = p;
          ctx.sfx.scratch();
          if (++strokes % 8 === 0 && scratchedShare(canvas) > CLEAR_AT) {
            finished = true;
            canvas.classList.add('gone');
            resolve();
          }
        };
        canvas.addEventListener('pointerdown', e => {
          canvas.setPointerCapture(e.pointerId);
          last = point(e);
          g.beginPath(); g.arc(...last, g.lineWidth / 2, 0, Math.PI * 2); g.fill();
        });
        canvas.addEventListener('pointermove', rub);
        const stop = () => { last = null; };
        canvas.addEventListener('pointerup', stop);
        canvas.addEventListener('pointercancel', stop);
      });

      ctx.sfx.good();
      cap.classList.remove('hidden-cap');
      cap.textContent = card.caption || '';
      await sleep(900);
      await ctx.reveal(card, 'YOU WON A MEMORY!', i < cards.length - 1 ? 'NEXT CARD ▶' : 'YAY ♥');
    }
    ctx.win('EVERY TICKET IS A WINNER');
  },
};
