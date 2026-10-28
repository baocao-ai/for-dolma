// "How well do you know us": multiple choice. Wrong answers just try again; each right answer reveals a memory.
import { esc, sleep } from '../util.js';

const NOPE = ['NOPE ♥ TRY AGAIN', 'HMM... NOT QUITE', 'RUDE. TRY AGAIN', 'WRONG! (STILL CUTE)', 'ARE YOU SURE?? NO'];
const YES = ['CORRECT!', 'YOU KNOW ME ♥', 'BIG BRAIN!', 'NAILED IT!', 'PERFECT!'];

export default {
  title: 'HOW WELL DO YOU KNOW US?',
  async start(el, data, ctx) {
    const qs = data.quiz;
    let firstTry = 0;

    for (let i = 0; i < qs.length; i++) {
      const q = qs[i];
      ctx.status(`Q ${i + 1}/${qs.length}`);
      el.innerHTML = `
        <div class="window q-card">
          <p class="q-num">QUESTION ${i + 1}</p>
          <p class="q-text">${esc(q.q)}</p>
        </div>
        <div class="choices">${q.choices.map((c, k) => `<button class="choice" type="button" data-k="${k}">${esc(c)}</button>`).join('')}</div>
        <p class="q-msg" aria-live="polite"></p>`;
      const msg = el.querySelector('.q-msg');
      // Start the photo download while she reads the question
      const photoReady = q.photo ? ctx.photo(q.photo) : null;

      let missed = false;
      await new Promise(resolve => {
        el.querySelectorAll('.choice').forEach(btn => btn.onclick = () => {
          if (btn.classList.contains('wrong') || el.querySelector('.choice.right')) return;
          if (Number(btn.dataset.k) === q.answer) {
            btn.classList.add('right');
            ctx.sfx.good();
            if (!missed) firstTry++;
            msg.textContent = YES[i % YES.length];
            resolve();
          } else {
            missed = true;
            btn.classList.add('wrong');
            btn.classList.remove('shake'); void btn.offsetWidth; btn.classList.add('shake');
            ctx.sfx.bad();
            msg.textContent = NOPE[Math.floor(Math.random() * NOPE.length)];
          }
        });
      });

      await photoReady;
      await sleep(600);
      if (q.reveal || q.photo) {
        await ctx.reveal({ photo: q.photo, caption: q.reveal, date: q.date }, YES[i % YES.length], i < qs.length - 1 ? 'NEXT ▶' : 'YAY ♥');
      }
    }
    ctx.win(`${firstTry}/${qs.length} ON THE FIRST TRY`);
  },
};
