'use strict';
// Cat Tree! — find Biscuit the cat at the end of the forest, dodging beavers' falling trees.
const W = 256, H = 240;
const cv = document.getElementById('game');
const ctx = cv.getContext('2d');
ctx.imageSmoothingEnabled = false;

// ---------- helpers
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = a => a[Math.floor(Math.random() * a.length)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const overlap = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
function hash(a, b) {
  let n = (Math.imul(a, 374761393) + Math.imul(b, 668265263)) | 0;
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}
function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function sprite(rows, pal) {
  const c = canvas(rows[0].length, rows.length), g = c.getContext('2d');
  rows.forEach((r, y) => [...r].forEach((ch, x) => { if (pal[ch]) { g.fillStyle = pal[ch]; g.fillRect(x, y, 1, 1); } }));
  return c;
}
function draw(img, x, y, flip) {
  x = Math.round(x); y = Math.round(y);
  if (!flip) return ctx.drawImage(img, x, y);
  ctx.save(); ctx.translate(x + img.width, y); ctx.scale(-1, 1); ctx.drawImage(img, 0, 0); ctx.restore();
}
function rect(x, y, w, h, c) { ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); }
function disc(g, cx, cy, r, c) {
  g.fillStyle = c;
  for (let dy = -r; dy <= r; dy++) { const w = Math.floor(Math.sqrt(r * r - dy * dy) + 0.3); g.fillRect(cx - w, cy + dy, w * 2 + 1, 1); }
}
function text(s, x, y, c = '#fff', size = 8) {
  ctx.font = size + 'px "Press Start 2P", monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  ctx.fillStyle = '#000'; ctx.fillText(s, x + 1, y + 1); ctx.fillStyle = c; ctx.fillText(s, x, y);
}
function box(lines, y0) {
  rect(12, y0 - 10, W - 24, lines.length * 14 + 16, 'rgba(0,0,0,0.8)');
  lines.forEach((l, i) => text(l[0], W / 2, y0 + i * 14, l[1] || '#fff'));
}

// ---------- sprites
const PLAYER_ROWS = [
  '....hhhh....',
  '...hhhhhh...',
  '..hhhhhhhh..',
  '...ssssss...',
  '...sesses...',
  '...ssssss...',
  '..bbbbbbbb..',
  '.sbbbbbbbbs.',
  '.sbbbbbbbbs.',
  '...pppppp...',
];
const PPAL = { h: '#d83a3a', s: '#f2c38f', e: '#222', b: '#3466c8', p: '#5a3a22', k: '#2a1a10' };
const playerImg = [
  sprite(PLAYER_ROWS.concat(['...pp..pp...', '...kk..kk...']), PPAL),
  sprite(PLAYER_ROWS.concat(['..pp....pp..', '..kk....kk..']), PPAL),
];

const BEAVER_ROWS = [
  '....cccccc....',
  '...bbbbbbbb...',
  '..bbebbbbebb..',
  '..bbbbnnbbbb..',
  '...bbbwwbbb...',
  '....bbwwbb....',
  '..xxxxxxxxxx..',
  '.bxxxxxxxxxxb.',
  '.bxxxxxxxxxxb.',
  '..xxxxxxxxxx..',
  '...bb....bb...',
  '....tttttt....',
  '...tttttttt...',
];
// Four kinds of beaver: Gnawer (fells trees), Lumberjack (fast, big trees), Speedy (runs across), Roller (rolls logs)
const BEAVERS = {
  brown: { b: '#8a5a2b', x: '#8a5a2b', t: '#5a3818' },
  jack: { b: '#7a4c24', x: '#c8322a', t: '#4e3016', c: '#222' },
  run: { b: '#b48a52', x: '#3a9ad8', t: '#7a5a30', c: '#fff' },
  roll: { b: '#6a4626', x: '#6a4626', t: '#422a12', c: '#f0c020' },
};
const beaverImg = {};
for (const k in BEAVERS) beaverImg[k] = sprite(BEAVER_ROWS, { e: '#111', n: '#2a1608', w: '#fff', ...BEAVERS[k] });

const catImg = sprite([
  '.o........o.',
  '.oo......oo.',
  '.oooooooooo.',
  '.oGooooooGo.',
  '.ooooppoooo.',
  '..oooooooo..',
  '...dooood..o',
  '..oooooooo.o',
  '.oooddddooo.',
  '.oooooooooo.',
  '..ww....ww..',
], { o: '#f09030', d: '#c06010', G: '#40c040', p: '#ff80a0', w: '#fff' });

const HEART_ROWS = ['.rr.rr.', 'rrrrrrr', 'rrrrrrr', '.rrrrr.', '..rrr..', '...r...'];
const heartImg = sprite(HEART_ROWS, { r: '#e8304a' });
const heartEmpty = sprite(HEART_ROWS, { r: '#402028' });
const bellImg = sprite(['.rrrrr.', '..yyy..', '.yyyyy.', 'yywyyyy', 'yyyyyyy', 'yyykyyy', '.yyyyy.'],
  { r: '#d02a2a', y: '#f0c830', w: '#fff8c0', k: '#5a4000' });

function makeTree(r, dark, mid, light) {
  const c = canvas(r * 2 + 4, r * 2 + 4), g = c.getContext('2d');
  disc(g, r + 2, r + 3, r, 'rgba(0,0,0,0.3)');
  disc(g, r + 1, r + 1, r, dark);
  disc(g, r, r, r - 2, mid);
  disc(g, r - 2, r - 2, Math.max(1, r - 6), light);
  return c;
}

// ---------- levels
const LEVELS = [
  { name: 'Sunny Pines', len: 2400, ground: '#5aa040', tuft: '#468a32', flower: '#f0e060',
    tree: ['#1e5a2a', '#2e7a3a', '#4a9a4a'], every: 1.9, pool: ['brown', 'brown', 'run'], music: 'level1' },
  { name: 'Autumn Woods', len: 3000, ground: '#8a9a40', tuft: '#727a30', flower: '#e05030',
    tree: ['#8a3a10', '#c06a20', '#e09a40'], every: 1.5, pool: ['brown', 'jack', 'jack', 'run'], music: 'level2' },
  { name: 'Deep Dark Forest', len: 3600, ground: '#2e5a44', tuft: '#244a38', flower: '#a080e0',
    tree: ['#0c261a', '#183e2c', '#2a5a40'], every: 1.15, pool: ['brown', 'jack', 'run', 'roll', 'roll'], music: 'level3' },
];
for (const l of LEVELS) l.treeImg = makeTree(8, ...l.tree);

// ---------- audio: 8-bit music + noises
let ac = null, master, musicBus, sfxBus, noiseBuf, muted = false, wantTrack = 'title';
const music = { track: null, step: 0, next: 0 };

function freq(n) {
  const m = n.match(/^([A-G])(#?)(\d)$/);
  const midi = 12 * (+m[3] + 1) + { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[m[1]] + (m[2] ? 1 : 0);
  return 440 * Math.pow(2, (midi - 69) / 12);
}
// one token per eighth note: note name, "-" holds the previous note, "." is a rest
function parse(str) {
  const tok = str.trim().split(/\s+/).filter(Boolean);
  return tok.map((t, i) => {
    if (t === '-' || t === '.') return null;
    let d = 1; while (tok[i + d] === '-') d++;
    return { t, d };
  });
}
const TRACKS = {
  title: { bpm: 120, loop: true,
    lead: 'G4 C5 E5 G5 - E5 C5 - A4 D5 F5 A5 - F5 D5 - G4 B4 D5 G5 F5 D5 B4 G4 C5 - - - . . . .',
    bass: 'C3 . . . G2 . . . D3 . . . A2 . . . G2 . . . G2 . . . C3 . . . C3 . . .',
    drum: 'k . h . s . h .' },
  level1: { bpm: 140, loop: true,
    lead: 'C5 E5 G5 E5 F5 A5 G5 - E5 G5 C6 G5 A5 G5 E5 - D5 F5 A5 F5 G5 F5 E5 D5 C5 E5 D5 B4 C5 - - .',
    bass: 'C3 . G3 . F3 . G3 . C3 . E3 . F3 . G3 . D3 . A3 . G3 . B2 . C3 . G2 . C3 . . .',
    drum: 'k . h . s . h . k . h . s . h .' },
  level2: { bpm: 150, loop: true,
    lead: 'A4 C5 E5 C5 D5 F5 E5 - C5 E5 A5 E5 G5 E5 D5 - F5 E5 D5 C5 B4 C5 D5 E5 A4 - C5 B4 A4 - - .',
    bass: 'A2 . E3 . D3 . E3 . A2 . C3 . G2 . G3 . F2 . C3 . G2 . D3 . A2 . E3 . A2 . . .',
    drum: 'k h h k s h k h k h h k s h s s' },
  level3: { bpm: 120, loop: true,
    lead: 'D5 - F5 - A5 - G#5 - A5 - F5 - D5 - - . C5 - E5 - G5 - F5 - E5 - C#5 - D5 - - .',
    bass: 'D2 D3 D2 D3 D2 D3 D2 D3 A#1 A#2 A#1 A#2 A1 A2 A1 A2',
    drum: 'k . . h s . . h' },
  clue: { bpm: 160, loop: false, lead: 'C5 E5 G5 C6 - G5 C6 - - - . .', bass: 'C3 . . . G2 . . . C3 - - .', drum: '' },
  gameover: { bpm: 100, loop: false, lead: 'G4 - F#4 - F4 - E4 - - - . .', bass: 'C3 - B2 - A#2 - A2 - - - . .', drum: '' },
  party: { bpm: 160, loop: true,
    lead: 'C5 E5 G5 C6 G5 E5 C5 E5 F5 A5 C6 A5 G5 - - . E5 G5 C6 E5 D5 F5 B5 D5 C5 E5 G5 C6 C6 - - .',
    bass: 'C3 G3 C3 G3 F3 C4 F3 C4 C3 G3 C3 G3 G2 D3 G2 D3',
    drum: 'k h s h k h s h' },
};
for (const k in TRACKS) {
  const t = TRACKS[k];
  t.chans = [
    { type: 'square', v: 0.1, ev: parse(t.lead) },
    { type: 'triangle', v: 0.28, ev: parse(t.bass) },
    { drum: true, ev: parse(t.drum) },
  ];
  t.len = Math.max(...t.chans.map(c => c.ev.length));
}

function initAudio() {
  if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
  ac = new (window.AudioContext || window.webkitAudioContext)();
  master = ac.createGain(); master.gain.value = muted ? 0 : 0.5; master.connect(ac.destination);
  musicBus = ac.createGain(); musicBus.gain.value = 0.5; musicBus.connect(master);
  sfxBus = ac.createGain(); sfxBus.gain.value = 0.8; sfxBus.connect(master);
  noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  setInterval(schedule, 25);
  playMusic(wantTrack);
}
function tone(f, t, d, type, v, bus, f2) {
  const o = ac.createOscillator(), g = ac.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t);
  if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + d);
  g.gain.setValueAtTime(v, t); g.gain.setValueAtTime(v, t + d * 0.6); g.gain.linearRampToValueAtTime(0.0001, t + d);
  o.connect(g); g.connect(bus); o.start(t); o.stop(t + d + 0.05);
}
function noise(t, d, v, ftype, f, bus) {
  const s = ac.createBufferSource(), fl = ac.createBiquadFilter(), g = ac.createGain();
  s.buffer = noiseBuf; fl.type = ftype; fl.frequency.value = f;
  g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.001, t + d);
  s.connect(fl); fl.connect(g); g.connect(bus); s.start(t); s.stop(t + d + 0.05);
}
function drum(k, t) {
  if (k === 'k') tone(150, t, 0.12, 'sine', 0.8, musicBus, 40);
  if (k === 's') noise(t, 0.12, 0.35, 'highpass', 1500, musicBus);
  if (k === 'h') noise(t, 0.04, 0.15, 'highpass', 7000, musicBus);
}
function playMusic(name) {
  wantTrack = name;
  if (!ac) return;
  music.track = TRACKS[name]; music.step = 0; music.next = ac.currentTime + 0.05;
}
function schedule() {
  const tr = music.track;
  if (!tr) return;
  const sd = 60 / tr.bpm / 2;
  while (music.next < ac.currentTime + 0.15) {
    if (!tr.loop && music.step >= tr.len) { music.track = null; return; }
    for (const ch of tr.chans) {
      if (!ch.ev.length) continue;
      const e = ch.ev[music.step % ch.ev.length];
      if (!e) continue;
      if (ch.drum) drum(e.t, music.next);
      else tone(freq(e.t), music.next, e.d * sd * 0.95, ch.type, ch.v, musicBus);
    }
    music.step++; music.next += sd;
  }
}
const SFX = {
  chop: t => noise(t, 0.06, 0.25, 'bandpass', 1800, sfxBus),
  creak: t => tone(260, t, 0.45, 'sawtooth', 0.12, sfxBus, 90),
  crash: t => { noise(t, 0.6, 0.7, 'lowpass', 500, sfxBus); tone(110, t, 0.35, 'square', 0.25, sfxBus, 35); },
  hit: t => { tone(700, t, 0.12, 'square', 0.25, sfxBus, 300); tone(300, t + 0.12, 0.2, 'square', 0.25, sfxBus, 120); },
  whoosh: t => noise(t, 0.3, 0.15, 'bandpass', 900, sfxBus),
  meow: t => { tone(520, t, 0.14, 'square', 0.12, sfxBus, 880); tone(880, t + 0.14, 0.32, 'square', 0.12, sfxBus, 420); },
  start: t => [523, 659, 784, 1047].forEach((f, i) => tone(f, t + i * 0.07, 0.1, 'square', 0.15, sfxBus)),
};
function sfx(n) { if (ac) SFX[n](ac.currentTime); }
function toggleMute() { muted = !muted; if (master) master.gain.value = muted ? 0 : 0.5; }

// ---------- game state
let state = 'title', stateT = 0, time = 0, paused = false;
let lvlIdx = 0, lv = LEVELS[0], player, hazards = [], trees = [], parts = [];
let camY = 0, spawnT = 0, shake = 0, banner = 0, meowT = 0, heartT = 0;

function setState(s) { state = s; stateT = 0; }

function startLevel(i) {
  lvlIdx = i; lv = LEVELS[i];
  player = { x: 123, y: lv.len - 30, w: 10, h: 10, hearts: 3, inv: 0, face: 1, walk: 0, moving: false };
  hazards = []; parts = []; trees = [];
  spawnT = 2.5; banner = 2.5; paused = false;
  for (let y = lv.len - 140; y > 140; y -= 52) {
    const n = Math.random() < 0.25 ? 0 : Math.random() < 0.6 ? 1 : 2;
    let last = -99;
    for (let k = 0; k < n; k++) {
      let x = rnd(46, 206);
      if (Math.abs(x - last) < 44) x = x < 126 ? x + 50 : x - 50;
      last = x;
      trees.push({ x: Math.round(x), y: Math.round(y + rnd(-10, 10)) });
    }
  }
  setState('play');
  playMusic(lv.music);
  sfx('start');
}

const treeBox = t => ({ x: t.x - 5, y: t.y - 3, w: 10, h: 12 });
function fellRect(h) {
  const th = h.thick + 4;
  return h.side < 0 ? { x: 32, y: h.y - th / 2, w: h.ext, h: th } : { x: 224 - h.ext, y: h.y - th / 2, w: h.ext, h: th };
}
function solids() {
  const s = trees.map(treeBox);
  for (const h of hazards) if (h.kind === 'tree' && h.landed) s.push(fellRect(h));
  return s;
}
function move(o, mx, my) {
  const before = { x: o.x, y: o.y, w: o.w, h: o.h };
  o.x += mx; o.y += my;
  if (solids().some(s => overlap(o, s) && !overlap(before, s))) { o.x -= mx; o.y -= my; }
}
function hurt() {
  if (player.inv > 0) return;
  player.hearts--; player.inv = 1.5; shake = 0.25; sfx('hit');
  if (player.hearts <= 0) { setState('dead'); playMusic('gameover'); }
}
function burst(x, y, n, colors, speed = 40, g = 60) {
  for (let i = 0; i < n; i++) parts.push({ x, y, vx: rnd(-speed, speed), vy: rnd(-speed, speed / 2), g, life: rnd(0.4, 0.9), c: pick(colors), sz: 1 });
}

function spawn(type) {
  if (type === 'roll') {
    if (camY < 80) return;
    hazards.push({ kind: 'roll', x: rnd(40, 172), y: camY - 14, w: 44, h: 10, vy: 55 + lvlIdx * 8, spin: 0 });
    sfx('whoosh');
    return;
  }
  const lo = Math.max(camY + 24, 90), hi = player.y - 48;
  if (hi - lo < 10) return;
  const y = Math.round(rnd(lo, hi));
  if (hazards.some(h => h.kind === 'tree' && Math.abs(h.y - y) < 26)) return;
  const side = Math.random() < 0.5 ? -1 : 1;
  if (type === 'run') {
    hazards.push({ kind: 'run', x: side < 0 ? 18 : 224, y, w: 14, h: 10, vx: -side * (85 + lvlIdx * 15) });
    sfx('whoosh');
    return;
  }
  const jack = type === 'jack';
  hazards.push({ kind: 'tree', type, side, y, t: 0, gnaw: jack ? 0.8 : 1.3, len: jack ? rnd(120, 160) : rnd(85, 130),
    thick: jack ? 10 : 7, ext: 0, landed: false, life: 5 });
}

function updatePlay(dt) {
  banner -= dt; player.inv -= dt; meowT -= dt;
  let dx = (key.right ? 1 : 0) - (key.left ? 1 : 0), dy = (key.down ? 1 : 0) - (key.up ? 1 : 0);
  if (pointer.down) {
    const px = pointer.x - (player.x + 5), py = pointer.y + camY - (player.y + 5);
    if (Math.hypot(px, py) > 4) { dx = px; dy = py; }
  }
  const m = Math.hypot(dx, dy);
  player.moving = m > 0;
  if (m) {
    dx /= m; dy /= m; player.walk += dt;
    if (dx) player.face = dx > 0 ? 1 : -1;
    move(player, dx * 72 * dt, 0);
    move(player, 0, dy * 72 * dt);
  }
  player.x = clamp(player.x, 34, 212);
  player.y = clamp(player.y, 4, lv.len - 14);
  camY = clamp(player.y - 170, 0, lv.len - H);

  spawnT -= dt;
  if (spawnT <= 0) { spawnT = lv.every * rnd(0.7, 1.3); spawn(pick(lv.pool)); }

  for (const h of hazards) {
    if (h.kind === 'tree') {
      h.t += dt;
      const baseX = h.side < 0 ? 26 : 230;
      if (h.t < h.gnaw) {
        if (Math.random() < dt * 14) burst(baseX, h.y + 6, 1, ['#d8b070', '#b08850'], 30);
        if (Math.random() < dt * 7) sfx('chop');
      } else if (!h.landed) {
        if (!h.creaked) { h.creaked = true; sfx('creak'); }
        h.ext = Math.min(h.len, h.ext + dt * h.len / 0.35);
        const r = fellRect(h);
        if (overlap(player, r)) {
          hurt();
          player.y = player.y + 5 < h.y ? r.y - player.h - 1 : r.y + r.h + 1;
        }
        if (h.ext >= h.len) {
          h.landed = true; shake = 0.3; sfx('crash');
          for (let i = 0; i < 6; i++) burst(r.x + rnd(0, r.w), h.y, 3, lv.tree, 50);
        }
      } else if ((h.life -= dt) <= 0) h.dead = true;
    } else if (h.kind === 'run') {
      h.x += h.vx * dt;
      if (overlap(player, h)) hurt();
      if (h.x < -20 || h.x > 276) h.dead = true;
    } else if (h.kind === 'roll') {
      h.y += h.vy * dt; h.spin += dt;
      if (overlap(player, h)) hurt();
      if (h.y > camY + H + 20) h.dead = true;
    }
  }
  hazards = hazards.filter(h => !h.dead);

  if (lvlIdx === 2 && player.y < 140 && meowT <= 0) { sfx('meow'); meowT = 2.5; }
  if (player.y < 52 && state === 'play') {
    if (lvlIdx < 2) { setState('clue'); playMusic('clue'); }
    else { setState('party'); lv = LEVELS[0]; parts = []; playMusic('party'); sfx('meow'); }
  }
}

const CONFETTI = ['#ff4060', '#40c0ff', '#ffe040', '#60e060', '#e070ff', '#ffffff'];
function updateParty(dt) {
  if (Math.random() < dt * 30) parts.push({ x: rnd(0, W), y: -4, vx: rnd(-15, 15), vy: rnd(25, 50), g: 0, life: 6, c: pick(CONFETTI), sz: 2 });
  if (Math.random() < dt * 4) for (const [x, y] of [[97, 144], [169, 146], [157, 164]]) parts.push({ x, y, vx: rnd(-3, 3), vy: -12, g: 0, life: 1.2, c: 'rgba(255,255,255,0.6)', sz: 1 });
  if ((heartT -= dt) <= 0) { heartT = 1; parts.push({ x: 156, y: 106, vx: rnd(-6, 6), vy: -18, g: 0, life: 2, heart: true }); }
  if ((meowT -= dt) <= 0) { meowT = 3.5; sfx('meow'); }
}

function update(dt) {
  time += dt; stateT += dt; shake -= dt;
  if (paused) return;
  if (state === 'play') updatePlay(dt);
  if (state === 'party') updateParty(dt);
  for (const p of parts) { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += p.g * dt; p.life -= dt; }
  parts = parts.filter(p => p.life > 0);
}

// ---------- drawing
function drawTree(cx, cy) { rect(cx - 2, cy + 5, 4, 5, '#5a3a1a'); draw(lv.treeImg, cx - 9, cy - 9); }
function drawGround(top) {
  rect(0, top, W, H, lv.ground);
  const r0 = Math.floor(top / 16);
  for (let cy = r0; cy < r0 + 17; cy++) for (let cx = 0; cx < 16; cx++) {
    const r = hash(cx + 99, cy), x = cx * 16 + Math.floor(r * 12), y = cy * 16 + Math.floor(hash(cy, cx) * 12);
    if (r < 0.4) { rect(x, y, 1, 2, lv.tuft); rect(x + 2, y, 1, 2, lv.tuft); rect(x + 1, y + 1, 1, 2, lv.tuft); }
    else if (r > 0.94) rect(x, y, 2, 2, lv.flower);
  }
}
function drawBorder(top) {
  for (const [col, off] of [[6, 0], [22, 6], [234, 3], [250, 9]]) {
    const i0 = Math.floor((top - off - 20) / 12);
    for (let i = i0; i < i0 + 24; i++) drawTree(col + Math.round(hash(col, i) * 4 - 2), i * 12 + off);
  }
}
function drawParticles() {
  for (const p of parts) {
    if (p.heart) draw(heartImg, p.x, p.y);
    else rect(p.x, p.y, p.sz, p.sz, p.c);
  }
}
function drawPlayer() {
  if (player.inv > 0 && Math.floor(player.inv * 12) % 2) return;
  draw(playerImg[player.moving ? Math.floor(player.walk * 8) % 2 : 0], player.x - 1, player.y - 2, player.face < 0);
}
function drawGoal() {
  if (lvlIdx < 2) for (let i = 0; i < 5; i++) {
    const x = 125 + (i % 2 ? 6 : 0), y = 2 + i * 8;
    rect(x, y, 3, 2, 'rgba(40,20,10,0.5)'); rect(x - 1, y - 2, 1, 1, 'rgba(40,20,10,0.5)'); rect(x + 3, y - 2, 1, 1, 'rgba(40,20,10,0.5)');
  }
  if (lvlIdx === 0) draw(bellImg, 125, 40 + Math.round(Math.sin(time * 4)));
  if (lvlIdx === 1) for (let i = 0; i < 8; i++) rect(124 + hash(i, 1) * 8, 40 + hash(i, 2) * 6, 2, 1, i % 2 ? '#f09030' : '#c06010');
  if (lvlIdx === 2) {
    draw(catImg, 122, 30 + (Math.floor(time * 3) % 2));
    if (Math.floor(time * 2) % 2) draw(heartImg, 134, 20);
  }
}
function drawFelled(h) {
  if (h.landed && h.life < 1 && Math.floor(h.life * 10) % 2) return;
  const r = fellRect(h);
  rect(r.x, r.y + 2, r.w, h.thick, '#6a4020');
  rect(r.x, r.y + 2, r.w, 2, '#8a5a30');
  for (let x = 6; x < r.w - 4; x += 9) rect(r.x + x, r.y + 4, 1, h.thick - 3, '#4a2a10');
  if (h.ext > 8) draw(lv.treeImg, (h.side < 0 ? 32 + h.ext : 224 - h.ext) - 9, h.y - 9);
}
function drawGnawers() {
  for (const h of hazards) if (h.kind === 'tree') {
    const baseX = h.side < 0 ? 26 : 230;
    if (h.t < h.gnaw) {
      if (h.t > h.gnaw * 0.35 && Math.floor(time * 8) % 2) {
        const r = fellRect({ ...h, ext: h.len });
        rect(r.x, r.y, r.w, r.h, 'rgba(255,40,40,0.3)');
      }
      drawTree(baseX + (Math.floor(time * 30) % 2 ? 1 : -1), h.y);
    }
    if (!h.landed || h.life > 1) draw(beaverImg[h.type], h.side < 0 ? 6 : 236, h.y + 2 + (Math.floor(time * 10) % 2), h.side > 0);
  }
}

function renderPlay() {
  ctx.save();
  const sx = shake > 0 ? rnd(-2, 2) : 0, sy = shake > 0 ? rnd(-2, 2) : 0;
  ctx.translate(Math.round(sx), Math.round(sy - camY));
  drawGround(camY);
  drawGoal();
  for (const h of hazards) if (h.kind === 'tree' && h.landed) drawFelled(h);
  for (const t of trees) if (t.y > camY - 20 && t.y < camY + H + 20) drawTree(t.x, t.y);
  for (const h of hazards) {
    if (h.kind === 'run') draw(beaverImg.run, h.x, h.y - 3 + (Math.floor(time * 14) % 2), h.vx < 0);
    if (h.kind === 'roll') {
      draw(beaverImg.roll, h.x + h.w / 2 - 7, h.y - 13 + (Math.floor(time * 10) % 2));
      rect(h.x, h.y, h.w, h.h, '#6a4020');
      for (let i = 0; i < 5; i++) rect(h.x + 3 + ((i * 9 + Math.floor(h.spin * 40)) % (h.w - 6)), h.y, 1, h.h, '#4a2a10');
      rect(h.x, h.y, 3, h.h, '#c09060'); rect(h.x + h.w - 3, h.y, 3, h.h, '#c09060');
    }
  }
  drawPlayer();
  for (const h of hazards) if (h.kind === 'tree' && !h.landed && h.t >= h.gnaw) drawFelled(h);
  drawBorder(camY);
  drawGnawers();
  drawParticles();
  ctx.restore();

  // HUD
  for (let i = 0; i < 3; i++) draw(i < player.hearts ? heartImg : heartEmpty, 6 + i * 9, 6);
  const p = clamp(1 - (player.y - 52) / (lv.len - 82), 0, 1);
  rect(182, 8, 52, 5, '#000'); rect(183, 9, Math.round(50 * p), 3, '#f0c830');
  draw(catImg, 238, 4);
  if (muted) text('MUTE', 128, 6, '#aaa');
  if (banner > 0 && state === 'play') box([['LEVEL ' + (lvlIdx + 1), '#f0c830'], [lv.name]], 100);
  if (paused) box([['PAUSED'], ['Press P to go on']], 104);
}

function drawPartyHat(x, y, c) {
  rect(x + 6, y - 5, 2, 1, '#fff');
  rect(x + 6, y - 4, 2, 1, c); rect(x + 5, y - 3, 4, 1, c); rect(x + 4, y - 2, 6, 1, c); rect(x + 4, y - 1, 6, 1, c);
}
function renderParty() {
  drawGround(0);
  drawBorder(0);
  // picnic blanket
  for (let y = 0; y < 8; y++) for (let x = 0; x < 16; x++) rect(64 + x * 8, 120 + y * 8, 8, 8, (x + y) % 2 ? '#c83838' : '#f4ecd8');
  // cake
  rect(108, 150, 40, 3, '#ddd');
  rect(112, 136, 32, 14, '#f4d8a8');
  rect(112, 142, 32, 2, '#c03050');
  rect(111, 133, 34, 4, '#ff8fc0');
  for (const [x, h] of [[114, 2], [122, 3], [134, 2], [140, 3]]) rect(x, 137, 2, h, '#ff8fc0');
  for (const x of [116, 126, 136]) rect(x, 131, 3, 2, '#e02020');
  for (const x of [118, 127, 136]) {
    rect(x, 124, 2, 8, '#80c0ff'); rect(x, 126, 2, 1, '#fff'); rect(x, 129, 2, 1, '#fff');
    const f = Math.floor(time * 10 + x) % 2;
    rect(x, 120 + f, 2, 3, '#ffd040'); rect(x, 122, 2, 1, '#ff8020');
  }
  // teapot
  disc(ctx, 84, 152, 8, '#4a7ad0'); disc(ctx, 82, 150, 3, '#8ab0f0');
  rect(80, 142, 8, 3, '#4a7ad0'); rect(83, 140, 2, 2, '#4a7ad0');
  rect(92, 148, 4, 2, '#4a7ad0'); rect(95, 145, 2, 3, '#4a7ad0');
  rect(73, 148, 2, 8, '#4a7ad0'); rect(74, 147, 3, 1, '#4a7ad0'); rect(74, 156, 3, 1, '#4a7ad0');
  // teacups
  for (const [x, y] of [[168, 150], [156, 168]]) {
    rect(x - 5, y + 5, 12, 2, '#eee'); rect(x - 3, y, 8, 6, '#fff'); rect(x - 2, y, 6, 2, '#8a4a20'); rect(x + 5, y + 1, 2, 3, '#fff');
  }
  // you and Biscuit
  draw(playerImg[0], 96, 104);
  draw(catImg, 150, 110 + (Math.floor(time * 3) % 2));
  // beavers in party hats
  [['brown', 30, 196, '#ff4060'], ['jack', 82, 204, '#40c0ff'], ['run', 160, 204, '#ffe040'], ['roll', 212, 196, '#60e060']]
    .forEach(([k, x, y, c], i) => {
      const by = y - Math.abs(Math.round(Math.sin(time * 6 + i) * 4));
      draw(beaverImg[k], x, by); drawPartyHat(x, by, c);
    });
  drawParticles();
  text('YOU FOUND BISCUIT!', W / 2, 30, CONFETTI[Math.floor(time * 6) % 5]);
  text('Tea and cake for everyone!', W / 2, 50);
  text('Even the beavers came.', W / 2, 64, '#f0e0a0');
  if (stateT > 2 && Math.floor(time * 2) % 2) text('Press Enter to play again', W / 2, 228);
}

function renderTitle() {
  lv = LEVELS[0];
  drawGround(0);
  drawBorder(0);
  text('CAT TREE!', W / 2, 28, '#ffd040', 16);
  ctx.drawImage(catImg, 110, 56, 36, 33);
  text('Biscuit is lost in', W / 2, 100);
  text('the forest. Find her!', W / 2, 112);
  ['brown', 'jack', 'run', 'roll'].forEach((k, i) => draw(beaverImg[k], 56 + i * 40, 138 + (Math.floor(time * 4 + i) % 2)));
  text('Dodge the beavers!', W / 2, 160, '#f0e0a0');
  if (Math.floor(time * 2) % 2) text('PRESS ENTER', W / 2, 186, '#ffd040');
  text('Arrows/WASD: move', W / 2, 206, '#ccc');
  text('M: music  P: pause', W / 2, 220, '#ccc');
}

function render() {
  ctx.clearRect(0, 0, W, H);
  if (state === 'title') return renderTitle();
  if (state === 'party') return renderParty();
  renderPlay();
  if (state === 'clue') {
    const lines = lvlIdx === 0
      ? [["You found Biscuit's bell!", '#f0c830'], ['Paw prints lead deeper'], ['into the woods...']]
      : [['A tuft of orange fur!', '#f09030'], ['Biscuit must be close.'], ['It gets dark ahead...']];
    if (stateT > 1) lines.push(['Press Enter', '#ffd040']);
    box(lines, 90);
  }
  if (state === 'dead') {
    const lines = [['TIMBER!', '#e8304a'], ['The beavers got you.']];
    if (stateT > 1) lines.push(['Press Enter to try again', '#ffd040']);
    box(lines, 96);
  }
}

// ---------- input
const key = {}, pointer = { down: false, x: 0, y: 0 };
const KEYS = { ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down', ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right' };
function confirm() {
  if (state === 'title' && stateT > 0.3) startLevel(0);
  else if (state === 'clue' && stateT > 1) startLevel(lvlIdx + 1);
  else if (state === 'dead' && stateT > 1) startLevel(lvlIdx);
  else if (state === 'party' && stateT > 2) { setState('title'); playMusic('title'); }
}
addEventListener('keydown', e => {
  initAudio();
  if (KEYS[e.code]) { key[KEYS[e.code]] = true; e.preventDefault(); }
  if (e.code === 'Enter' || e.code === 'Space') { confirm(); e.preventDefault(); }
  if (e.code === 'KeyM') toggleMute();
  if (e.code === 'KeyP' && state === 'play') paused = !paused;
});
addEventListener('keyup', e => { if (KEYS[e.code]) key[KEYS[e.code]] = false; });
function setPointer(e) {
  const r = cv.getBoundingClientRect();
  pointer.x = (e.clientX - r.left) * W / r.width; pointer.y = (e.clientY - r.top) * H / r.height;
}
cv.addEventListener('pointerdown', e => { initAudio(); if (state === 'play') { pointer.down = true; setPointer(e); } else confirm(); });
cv.addEventListener('pointermove', e => { if (pointer.down) setPointer(e); });
addEventListener('pointerup', () => { pointer.down = false; });
addEventListener('pointercancel', () => { pointer.down = false; });

// ---------- main loop
let last = performance.now();
function frame(now) {
  update(Math.min(0.033, (now - last) / 1000));
  last = now;
  render();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
