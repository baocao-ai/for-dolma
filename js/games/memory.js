// Memory match: 6 photo pairs face down; every pair found pops up that photo's memory.
import { shuffle, sleep } from '../util.js';

export default {
  title: 'FIND THE PAIRS!',
  async start(el, data, ctx) {
    const items = data.memory;
    const urls = await Promise.all(items.map(it => ctx.photo(it.photo)));
    const deck = shuffle([...items.keys(), ...items.keys()]);
    let open = [], found = 0, busy = false;
    ctx.status(`PAIRS 0/${items.length}`);

    el.innerHTML = '<div class="mm-grid"></div>';
    const grid = el.firstElementChild;

    // Swap faces at the midpoint of the squash so the change is hidden
    const turn = (card, up) => {
      card.classList.remove('anim'); void card.offsetWidth; card.classList.add('anim');
      setTimeout(() => card.classList.toggle('flip', up), 150);
    };

    for (const n of deck) {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'card';
      card.setAttribute('aria-label', 'Hidden card');
      card.innerHTML = `<div class="in"><div class="f">♥</div><div class="b"><img alt="" src="${urls[n]}"></div></div>`;
      card.onclick = async () => {
        if (busy || card.classList.contains('flip') || open.includes(card)) return;
        ctx.sfx.flip();
        turn(card, true);
        open.push(card);
        if (open.length < 2) return;

        busy = true;
        const [a, b] = open;
        open = [];
        if (deck[[...grid.children].indexOf(a)] === deck[[...grid.children].indexOf(b)]) {
          a.classList.add('matched'); b.classList.add('matched');
          a.setAttribute('aria-label', 'Matched'); b.setAttribute('aria-label', 'Matched');
          found++;
          ctx.status(`PAIRS ${found}/${items.length}`);
          ctx.sfx.good();
          await sleep(450);
          await ctx.reveal(items[n], 'MEMORY UNLOCKED!');
          if (found === items.length) return ctx.win('YOU MATCHED EVERY MEMORY');
        } else {
          await sleep(800);
          turn(a, false); turn(b, false);
          await sleep(300);
        }
        busy = false;
      };
      grid.appendChild(card);
    }
  },
};
