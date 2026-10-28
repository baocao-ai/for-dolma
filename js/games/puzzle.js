// Sliding puzzle: 3x3, one photo cropped square. Shuffled by random legal moves so it's always solvable.
import { sleep } from '../util.js';

const N = 3, BLANK = N * N - 1;

function squareCrop(url, size) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const s = Math.min(img.naturalWidth, img.naturalHeight);
      const c = document.createElement('canvas');
      c.width = c.height = size;
      c.getContext('2d').drawImage(img, (img.naturalWidth - s) / 2, (img.naturalHeight - s) / 2, s, s, 0, 0, size, size);
      resolve(c.toDataURL('image/jpeg', 0.9));
    };
    img.onerror = reject;
    img.src = url;
  });
}

const neighbors = i => {
  const r = Math.floor(i / N), c = i % N, out = [];
  if (r > 0) out.push(i - N);
  if (r < N - 1) out.push(i + N);
  if (c > 0) out.push(i - 1);
  if (c < N - 1) out.push(i + 1);
  return out;
};

function scrambled() {
  const cells = [...Array(N * N).keys()];
  let blank = BLANK, prev = -1;
  for (let k = 0; k < 160; k++) {
    const opts = neighbors(blank).filter(i => i !== prev);
    const pick = opts[Math.floor(Math.random() * opts.length)];
    [cells[blank], cells[pick]] = [cells[pick], cells[blank]];
    prev = blank;
    blank = pick;
  }
  return cells.every((t, i) => t === i) ? scrambled() : cells;
}

export default {
  title: 'SLIDE THE PIECES BACK!',
  async start(el, data, ctx) {
    const item = data.puzzle;
    const img = await squareCrop(await ctx.photo(item.photo), 900);
    const cells = scrambled(); // cells[position] = tile id
    let moves = 0, done = false;
    ctx.status('MOVES 0');

    el.innerHTML = `
      <div class="pz" id="pz"></div>
      <div class="pz-bar">
        <span class="status">TAP A PIECE NEXT TO THE GAP</span>
        <button class="btn small alt" id="peek" type="button">PEEK</button>
      </div>`;
    const board = el.querySelector('#pz');

    const tiles = [...Array(N * N).keys()].map(id => {
      const t = document.createElement('button');
      t.type = 'button';
      t.className = 'tile' + (id === BLANK ? ' blank' : '');
      t.setAttribute('aria-label', `Piece ${id + 1}`);
      t.style.backgroundImage = `url(${img})`;
      t.style.backgroundPosition = `${(id % N) * 50}% ${Math.floor(id / N) * 50}%`;
      t.onclick = () => slide(id);
      board.appendChild(t);
      return t;
    });

    const place = () => cells.forEach((id, pos) => {
      tiles[id].style.transform = `translate(${(pos % N) * 100}%, ${Math.floor(pos / N) * 100}%)`;
    });
    place();

    async function slide(id) {
      if (done) return;
      const pos = cells.indexOf(id), gap = cells.indexOf(BLANK);
      if (!neighbors(gap).includes(pos)) return;
      [cells[pos], cells[gap]] = [cells[gap], cells[pos]];
      place();
      ctx.sfx.tap();
      ctx.status(`MOVES ${++moves}`);
      if (cells.every((t, i) => t === i)) {
        done = true;
        board.classList.add('solved');
        ctx.sfx.good();
        await sleep(900);
        await ctx.reveal(item, 'PUZZLE SOLVED!');
        ctx.win(`SOLVED IN ${moves} MOVES`);
      }
    }

    // Peek shows the finished photo for a moment
    el.querySelector('#peek').onclick = () => {
      if (done || board.querySelector('.pz-peek')) return;
      const p = document.createElement('div');
      p.className = 'pz-peek';
      p.style.backgroundImage = `url(${img})`;
      board.appendChild(p);
      setTimeout(() => p.remove(), 1500);
    };
  },
};
