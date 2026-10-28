// Screens: start (date code) → hub → one game at a time → finale.
// All photos and text arrive encrypted in content/; nothing shows until the code unlocks them.
import { deriveKey, decrypt } from './crypto.js';
import { sfx, unlockAudio, isMuted, setMuted } from './sound.js';
import { $, esc, sleep, reducedMotion, store } from './util.js';
import memory from './games/memory.js';
import puzzle from './games/puzzle.js';
import quiz from './games/quiz.js';
import scratch from './games/scratch.js';

const GAMES = {
  memory: { game: memory, icon: '🃏', name: 'MEMORY<br>MATCH' },
  puzzle: { game: puzzle, icon: '🧩', name: 'PHOTO<br>PUZZLE' },
  quiz: { game: quiz, icon: '💌', name: 'HOW WELL<br>DO U KNOW US' },
  scratch: { game: scratch, icon: '🪙', name: 'SCRATCH<br>CARDS' },
};
const IDS = Object.keys(GAMES);

let meta, key, data;
let progress = store.get('progress', {});
let run = 0; // bumps on every screen change so a game left mid-way can't act on the new screen
const photoUrls = new Map();

function show(name) {
  run++;
  document.querySelectorAll('[data-screen]').forEach(s => { s.hidden = s.dataset.screen !== name; });
  window.scrollTo(0, 0);
}

function photo(p) {
  if (!photoUrls.has(p.id)) {
    photoUrls.set(p.id, fetch(`content/${p.id}.bin`)
      .then(r => r.arrayBuffer())
      .then(buf => decrypt(key, buf))
      .then(plain => URL.createObjectURL(new Blob([plain], { type: p.type }))));
  }
  return photoUrls.get(p.id);
}

// ---------- Modal ----------
async function reveal(item, title, button = 'YAY ♥') {
  const img = $('#modal-img');
  img.hidden = !item.photo;
  if (item.photo) img.src = await photo(item.photo);
  $('#modal-title').textContent = title;
  $('#modal-date').textContent = item.date || '';
  $('#modal-date').hidden = !item.date;
  $('#modal-cap').textContent = item.caption || '';
  $('#modal-cap').hidden = !item.caption;
  $('#modal-ok').textContent = button;
  $('#modal').hidden = false;
  $('#modal-ok').focus({ preventScroll: true });
  await new Promise(r => { $('#modal-ok').onclick = () => { sfx.tap(); r(); }; });
  $('#modal').hidden = true;
}

// ---------- Start ----------
function buildCodeInputs() {
  const box = $('#code');
  box.innerHTML = '';
  let n = 0;
  for (const ch of meta.format) {
    if (/[A-Z]/i.test(ch)) {
      const i = document.createElement('input');
      // No maxLength: a pasted or autofilled code must reach the input handler whole
      i.inputMode = 'numeric';
      i.setAttribute('aria-label', `Code digit ${++n}`);
      box.appendChild(i);
    } else {
      box.insertAdjacentHTML('beforeend', `<span class="sep">${esc(ch)}</span>`);
    }
  }
  const inputs = [...box.querySelectorAll('input')];
  inputs.forEach((el, i) => {
    el.addEventListener('input', () => {
      const digits = el.value.replace(/\D/g, '');
      // Pasting the whole code into one box spreads it across the rest
      [...digits].forEach((d, k) => { if (inputs[i + k]) inputs[i + k].value = d; });
      if (!digits) el.value = '';
      const next = inputs[Math.min(i + digits.length, inputs.length - 1)];
      if (digits) next.focus();
    });
    el.addEventListener('keydown', e => {
      if (e.key === 'Backspace' && !el.value && inputs[i - 1]) inputs[i - 1].focus();
    });
  });
  return inputs;
}

async function unlock(code) {
  try {
    const k = await deriveKey(code, meta.salt, meta.iter);
    const buf = await fetch('content/manifest.bin').then(r => r.arrayBuffer());
    data = JSON.parse(new TextDecoder().decode(await decrypt(k, buf)));
    key = k;
    return true;
  } catch {
    return false;
  }
}

function wrongCode(msg) {
  const s = $('[data-screen="start"]');
  s.classList.remove('shake'); void s.offsetWidth; s.classList.add('shake');
  $('#err').textContent = msg;
}

async function initStart() {
  try {
    meta = await fetch('content/meta.json').then(r => r.json());
  } catch {
    $('#err').textContent = 'NO GAME CARTRIDGE FOUND';
    $('#press').disabled = true;
    return;
  }
  const inputs = buildCodeInputs();

  // Returning visit: skip the code if it was saved on this phone
  const saved = store.get('code', null);
  if (saved && await unlock(saved)) return enterHub();

  $('#code-form').onsubmit = async e => {
    e.preventDefault();
    unlockAudio();
    const code = inputs.map(i => i.value).join('');
    if (code.length < inputs.length) return wrongCode('FILL IN ALL THE NUMBERS');
    $('#press').disabled = true;
    $('#press').textContent = 'LOADING...';
    const ok = await unlock(code);
    $('#press').disabled = false;
    $('#press').textContent = 'PRESS START';
    if (!ok) {
      sfx.bad();
      inputs.forEach(i => { i.value = ''; });
      inputs[0].focus({ preventScroll: true });
      return wrongCode('WRONG CODE ♥ TRY AGAIN');
    }
    store.set('code', code);
    sfx.start();
    await sleep(500);
    enterHub();
  };
  inputs[0].focus({ preventScroll: true });
}

// ---------- Hub ----------
function enterHub() {
  document.addEventListener('pointerdown', unlockAudio, { once: true });
  $('#player').textContent = data.player || 'P1';
  $('#hs-name').textContent = data.player || 'P1';
  // Warm up every photo in the background so games open instantly
  galleryItems().forEach(it => photo(it.photo).catch(() => {}));
  renderHub();
  show('hub');
}

function renderHub() {
  const cleared = IDS.filter(id => progress[id]).length;
  const all = cleared === IDS.length;
  $('#hearts').innerHTML = IDS.map(id => `<span class="${progress[id] ? 'on' : ''}">♥</span>`).join('');
  $('#mute').textContent = isMuted() ? '🔇' : '🔊';
  $('#cabinets').innerHTML = IDS.map(id => `
    <button class="cab ${id} ${progress[id] ? 'done' : ''}" type="button" data-id="${id}">
      <div class="icon">${GAMES[id].icon}</div>
      <div class="name">${GAMES[id].name}</div>
      <div class="state">${progress[id] ? '★ CLEARED' : '▶ PLAY'}</div>
    </button>`).join('') + `
    <button class="cab finale ${all ? '' : 'locked'}" type="button" data-id="finale" ${all ? '' : 'aria-disabled="true"'}>
      <div class="icon">${all ? '🎁' : '🔒'}</div>
      <div class="name">${all ? 'YOUR SURPRISE IS READY' : '??? SURPRISE ???'}</div>
      <div class="state">${all ? '▶ OPEN' : `CLEAR ALL 4 TO UNLOCK`}</div>
    </button>`;
  $('#meter-fill').style.width = `${(cleared / IDS.length) * 100}%`;
  $('#meter-text').textContent = all ? 'LOVE METER FULL ♥ OPEN YOUR SURPRISE' : `LOVE METER ${cleared}/${IDS.length} · CLEAR ALL FOR A SURPRISE`;
}

$('#cabinets').addEventListener('click', e => {
  const cab = e.target.closest('.cab');
  if (!cab) return;
  if (cab.dataset.id === 'finale') {
    if (cab.classList.contains('locked')) { sfx.bad(); cab.classList.remove('shake'); void cab.offsetWidth; cab.classList.add('shake'); return; }
    sfx.start();
    return openFinale();
  }
  sfx.tap();
  startGame(cab.dataset.id);
});

$('#mute').onclick = () => {
  setMuted(!isMuted());
  $('#mute').textContent = isMuted() ? '🔇' : '🔊';
  sfx.tap();
};

// ---------- Game ----------
async function startGame(id) {
  const { game } = GAMES[id];
  show('game');
  const me = run;
  const alive = () => me === run;
  $('#game-title').textContent = game.title;
  $('#status').textContent = '';
  // Each run renders into a fresh element, so a stale run only ever writes to a detached node
  const body = document.createElement('div');
  body.style.cssText = 'display:flex;flex-direction:column;flex:1';
  $('#game-body').replaceChildren(body);

  const ctx = {
    sfx,
    photo,
    status: text => { if (alive()) $('#status').textContent = text; },
    reveal: (item, title, button) => alive() ? reveal(item, title, button) : new Promise(() => {}),
    async win(message) {
      if (!alive()) return;
      const firstClear = !progress[id];
      progress[id] = true;
      store.set('progress', progress);
      sfx.win();
      const all = IDS.every(g => progress[g]);
      await reveal({ caption: `${message}\n\n${all && firstClear ? 'ALL 4 CLEARED!\nSOMETHING JUST UNLOCKED... 🎁' : '+1 ♥ LOVE METER'}` }, '★ STAGE CLEAR ★', 'BACK TO ARCADE');
      if (!alive()) return;
      renderHub();
      show('hub');
    },
  };
  try {
    await game.start(body, data, ctx);
  } catch (err) {
    console.error(err);
    if (alive()) body.innerHTML = '<p class="err">GAME GLITCHED ♥ GO BACK AND TRY AGAIN</p>';
  }
}

$('#back').onclick = () => { sfx.tap(); renderHub(); show('hub'); };

// ---------- Finale ----------
// Every photo once, in play order, with its caption
function galleryItems() {
  const items = [...data.memory, data.puzzle, ...data.quiz.map(q => ({ photo: q.photo, caption: q.reveal, date: q.date })), ...data.scratch];
  const seen = new Set();
  return items.filter(it => it.photo && !seen.has(it.photo.id) && seen.add(it.photo.id));
}

function hearts() {
  if (reducedMotion()) return;
  for (let i = 0; i < 28; i++) {
    const h = document.createElement('span');
    h.className = 'fall';
    h.textContent = ['♥', '★', '♥', '✦'][i % 4];
    h.style.left = `${Math.random() * 100}vw`;
    h.style.color = ['#ff8fc0', '#ffe08a', '#8ee8c8', '#9fd3ff'][i % 4];
    h.style.animationDuration = `${2.5 + Math.random() * 2.5}s`;
    h.style.animationDelay = `${Math.random() * 1.5}s`;
    document.body.appendChild(h);
    h.addEventListener('animationend', () => h.remove());
  }
}

async function openFinale() {
  show('finale');
  const me = run;
  hearts();

  const items = galleryItems();
  const gallery = $('#gallery');
  gallery.innerHTML = '';
  for (const it of items) {
    const b = document.createElement('button');
    b.type = 'button';
    b.setAttribute('aria-label', it.caption || 'Photo');
    b.innerHTML = `<img alt="" src="${await photo(it.photo)}">`;
    b.onclick = () => { sfx.tap(); reveal(it, '♥ MEMORY ♥', 'CLOSE'); };
    gallery.appendChild(b);
  }

  // Typewriter letter; tap it to skip ahead
  const letter = $('#letter');
  const text = data.letter || '';
  letter.textContent = '';
  let skip = reducedMotion();
  letter.parentElement.onclick = () => { skip = true; };
  for (let i = 0; i < text.length && me === run; i++) {
    if (skip) { letter.textContent = text; break; }
    letter.textContent = text.slice(0, i + 1);
    if (i % 3 === 0 && text[i] !== ' ') sfx.tap();
    await sleep(text[i] === '\n' ? 220 : 32);
  }
}

$('#finale-back').onclick = () => { sfx.tap(); renderHub(); show('hub'); };
$('#replay').onclick = () => {
  progress = {};
  store.set('progress', progress);
  sfx.start();
  renderHub();
  show('hub');
};

initStart();
