/* Reality Fracture Adventure — Jace's spiral tower board.
 * Self-contained: no build step, no network calls, no external assets.
 * Control view: index.html   OBS view: index.html?obs=1 (or obs.html)   Transparent: ?obs=1&transparent=1 (or obs-transparent.html)
 */
(function () {
  'use strict';

  // ---------------------------------------------------------------- mode
  var params = new URLSearchParams(location.search);
  var FORCE = window.RFA_FORCE || {};
  var OBS = !!FORCE.obs || params.get('obs') === '1';
  var TRANSPARENT = !!FORCE.transparent || params.get('transparent') === '1';
  var DOCK = params.get('dock') === '1';
  var KEY = 'rfa-board-state-v1', HKEY = 'rfa-board-history-v1', CH = 'rfa-board-sync';

  // ---------------------------------------------------------------- prize data (from prizes.js / PRIZE_LIST.csv)
  function parseCSV(text) {
    var rows = [], row = [], f = '', q = false, i, c;
    text = String(text || '').replace(/^\uFEFF/, '').trim();
    for (i = 0; i < text.length; i++) {
      c = text[i];
      if (q) {
        if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; }
        else f += c;
      } else if (c === '"') q = true;
      else if (c === ',') { row.push(f); f = ''; }
      else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(f); rows.push(row); row = []; f = ''; }
      else f += c;
    }
    row.push(f); rows.push(row);
    return rows;
  }
  var DATA_ERRORS = [];
  var SPACES = [];
  (function buildSpaces() {
    var rows = parseCSV(window.RFA_PRIZE_CSV);
    var head = rows.shift().map(function (h) { return h.trim().toLowerCase(); });
    var ix = function (name) { return head.indexOf(name); };
    var cS = ix('space'), cZ = ix('zone'), cMP = ix('multiverse prize'), cMC = ix('multiverse category'), cEP = ix('echoverse prize'), cEC = ix('echoverse category'), cR = ix('rift');
    if ([cS, cZ, cMP, cMC, cEP, cEC, cR].some(function (x) { return x < 0; })) DATA_ERRORS.push('PRIZE CSV header is missing a required column');
    rows.forEach(function (r) {
      var n = parseInt(r[cS], 10);
      if (!(n >= 1 && n <= 100)) return;
      var rift = null, m = /Rift \+(\d+) to (\d+)/i.exec(r[cR] || '');
      if (m) rift = { plus: +m[1], to: +m[2] };
      SPACES[n] = { n: n, zone: (r[cZ] || '').trim(), rift: rift,
        MV: prize(r[cMP], r[cMC]), EV: prize(r[cEP], r[cEC]) };
    });
    for (var n = 1; n <= 100; n++) if (!SPACES[n]) DATA_ERRORS.push('Space ' + n + ' missing from prize data');
    SPACES.forEach(function (s) {
      if (s && s.rift && (s.rift.to !== s.n + s.rift.plus || (SPACES[s.rift.to] && SPACES[s.rift.to].rift) || s.rift.to >= 100))
        DATA_ERRORS.push('Rift on ' + s.n + ' looks inconsistent');
    });
  })();
  function prize(full, cat) {
    full = (full || '').trim(); cat = (cat || '').trim();
    var parts = full.split(' — ');
    var name = parts[0], detail = parts.slice(1).join(' — ');
    if (cat === 'Raw Draw') { name = 'Raw Draw'; detail = 'Magic card draw'; }
    if (cat === 'Reality Coin Flip') detail = 'Reality Coin Flip — Heads: 2 Reality Fracture Play Boosters · Tails: 1 Reality Fracture Collector Booster';
    return { full: full, name: name, detail: detail || cat, cat: cat };
  }
  if (DATA_ERRORS.length) console.warn('[RFA] prize data problems:', DATA_ERRORS);

  var ZONES = [
    { name: 'Hexhaven Campus', from: 1, to: 20, cls: 'z-hex', color: '#6fe0b0' },
    { name: 'The Five Schools', from: 21, to: 40, cls: 'z-sch', color: '#ffb04a' },
    { name: 'Lorwyn Five vs Doppelgangers', from: 41, to: 60, cls: 'z-lor', color: '#ff9bd2' },
    { name: "Sculptor's Stronghold", from: 61, to: 80, cls: 'z-scu', color: '#d8b07a' },
    { name: "Theorist's Tower", from: 81, to: 99, cls: 'z-the', color: '#7df9ff' },
    { name: 'Heart of the Echoverse', from: 100, to: 100, cls: 'z-core', color: '#ffffff' }
  ];
  var SCHOOLS = [['Konstrari', '#ff6a3d'], ['Stingerquill', '#eae4d2'], ['Vigorbloom', '#6fd04e'], ['Theorix', '#4aa3ff'], ['Fatehold', '#c58bff']];
  function zoneOf(n) { if (n <= 0) return ZONES[0]; for (var i = 0; i < ZONES.length; i++) if (n >= ZONES[i].from && n <= ZONES[i].to) return ZONES[i]; return ZONES[5]; }
  function tileColor(n) { return (n >= 21 && n <= 40) ? SCHOOLS[Math.floor((n - 21) / 4)][1] : zoneOf(n).color; }
  var LANE_NAME = { MV: 'Multiverse', EV: 'Echoverse' };
  var COIN_SPACES = [60, 90];
  var COIN_TEXT = { H: { side: 'HEADS', prize: '2 Reality Fracture Play Boosters' }, T: { side: 'TAILS', prize: 'Reality Fracture Collector Booster' } };

  // ---------------------------------------------------------------- geometry (square spiral, 13 x 9 floors, center = Heart of the Echoverse)
  var COLS = 13, ROWS = 9, X0 = 100, Y0 = 14, CW = 106, CHh = 116, TW = 102, TH = 112;
  var CELLS = [];
  (function spiral() {
    var top = 0, bot = ROWS - 1, l = 0, r = COLS - 1, out = [], c, rr;
    while (top <= bot && l <= r) {
      for (c = l; c <= r; c++) out.push([bot, c]); bot--;
      for (rr = bot; rr >= top; rr--) out.push([rr, r]); r--;
      if (top <= bot) { for (c = r; c >= l; c--) out.push([top, c]); top++; }
      if (l <= r) { for (rr = top; rr <= bot; rr++) out.push([rr, l]); l++; }
    }
    for (var n = 1; n <= 99; n++) CELLS[n] = { r: out[n - 1][0], c: out[n - 1][1], x: X0 + out[n - 1][1] * CW, y: Y0 + out[n - 1][0] * CHh };
  })();
  var CORE = { x: 418, y: 362, w: 738, h: 228 };
  function centerOf(n) {
    if (n <= 0) return { x: 50, y: 998 };
    if (n >= 100) return { x: CORE.x + CORE.w / 2, y: CORE.y + CORE.h / 2 + 10 };
    return { x: CELLS[n].x + TW / 2, y: CELLS[n].y + TH / 2 + 4 };
  }

  // ---------------------------------------------------------------- icons (original, simple SVG)
  var ICONS = {
    pack: '<path d="M6 2h12l-1.2 2L18 6v12l-1.2 2L18 22H6l1.2-2L6 18V6l1.2-2z" fill="#e9eefc" stroke="#222" stroke-width="1"/><rect x="8" y="8" width="8" height="8" rx="1.5" fill="#7b5cff"/>',
    star: '<path d="M18 1.5l1.4 2.9 3.1.4-2.3 2.2.6 3.1-2.8-1.5-2.8 1.5.6-3.1-2.3-2.2 3.1-.4z" fill="#ffd34d" stroke="#5a3a00" stroke-width=".6"/>',
    glow: '<circle cx="12" cy="12" r="11" fill="#fff6a8" opacity=".55"/>',
    card: '<rect x="5" y="2.5" width="14" height="19" rx="2" fill="#f3e2bd" stroke="#3b230e" stroke-width="1.2"/><rect x="7.5" y="5" width="9" height="7" rx="1" fill="#6b4423"/>',
    spark: '<path d="M19 1l1 3 3 1-3 1-1 3-1-3-3-1 3-1z" fill="#fff" stroke="#7ff" stroke-width=".6"/>',
    wheel: '<circle cx="12" cy="12" r="10" fill="#e9eefc" stroke="#222" stroke-width="1.2"/><path d="M12 2v20M2 12h20M5 5l14 14M19 5L5 19" stroke="#7b5cff" stroke-width="1.6"/><circle cx="12" cy="12" r="2.4" fill="#222"/>',
    wheelg: '<circle cx="12" cy="12" r="10" fill="#ffd34d" stroke="#5a3a00" stroke-width="1.2"/><path d="M12 2v20M2 12h20M5 5l14 14M19 5L5 19" stroke="#b05a00" stroke-width="1.6"/><circle cx="12" cy="12" r="2.4" fill="#5a3a00"/>',
    vault: '<rect x="2.5" y="3" width="19" height="18" rx="3" fill="#cfd6ff" stroke="#222" stroke-width="1.2"/><circle cx="12" cy="12" r="5.5" fill="#ffd34d" stroke="#5a3a00"/><path d="M12 7.5v9M7.5 12h9" stroke="#5a3a00" stroke-width="1.4"/>',
    crown: '<path d="M2 18l2-11 5 5 3-8 3 8 5-5 2 11z" fill="#ffd34d" stroke="#5a3a00" stroke-width="1.2"/><rect x="2" y="18" width="20" height="3" fill="#ffd34d" stroke="#5a3a00"/>'
  };
  var CAT = {
    'Raw Draw': { icon: 'card', tag: 'RAW DRAW' },
    'Standard Booster': { icon: 'pack', tag: 'BOOSTER' },
    'Booster of Choice': { icon: 'pack+star', tag: 'CHOICE' },
    'Premium Booster': { icon: 'glow+pack', tag: 'PREMIUM' },
    'Premium Raw Draw': { icon: 'card+spark', tag: 'PREM DRAW' },
    'Level 1 Spin': { icon: 'wheel', tag: 'SPIN 1' },
    'Level 2 Premium Spin': { icon: 'wheelg', tag: 'SPIN 2' },
    'Reality Coin Flip': { icon: 'vault', tag: 'COIN FLIP' },
    'Grand Prize': { icon: 'crown', tag: 'GRAND' },
    'Rift': { icon: 'spark', tag: 'RIFT' }
  };
  function icon(cat) {
    var spec = (CAT[cat] || CAT['Raw Draw']).icon;
    return '<svg viewBox="0 0 24 24" aria-hidden="true">' + spec.split('+').map(function (k) { return ICONS[k]; }).join('') + '</svg>';
  }
  var PIECE_SVG = '<svg viewBox="0 0 100 120" aria-label="Hooded mind-mage game piece">' +
    '<defs><linearGradient id="cloak" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2d3a8c"/><stop offset="1" stop-color="#0c1033"/></linearGradient></defs>' +
    '<path d="M50 5C29 5 21 24 21 41c0 11 4 19 8 25L12 112q38 10 76 0L71 66c4-6 8-14 8-25C79 24 71 5 50 5z" fill="url(#cloak)" stroke="currentColor" stroke-width="4"/>' +
    '<path d="M50 14c-14 0-20 14-20 28 0 10 4 17 9 21h22c5-4 9-11 9-21 0-14-6-28-20-28z" fill="#04050f"/>' +
    '<ellipse cx="43" cy="44" rx="3.2" ry="2.2" fill="currentColor"/><ellipse cx="57" cy="44" rx="3.2" ry="2.2" fill="currentColor"/>' +
    '<path d="M50 72l9 11-9 11-9-11z" fill="currentColor" opacity=".95"/><path d="M50 76l5 7-5 7-5-7z" fill="#fff" opacity=".8"/>' +
    '<path d="M30 66l-8 40M70 66l8 40" stroke="currentColor" stroke-width="2" opacity=".5"/></svg>';
  var PIP_SVG = '<svg viewBox="0 0 60 70"><path class="fill" d="M30 3L56 12v22c0 16-11 26-26 33C15 60 4 50 4 34V12z"/><path d="M30 18l9 14-9 14-9-14z" fill="#fff" opacity=".55"/></svg>';

  // ---------------------------------------------------------------- state
  function defaults() { return { v: 1, rev: 0, pos: 0, lane: 'MV', meter: 0, bonusTotal: 0, zoom: 1, customer: '', pendingRift: null, coins: [], coinVisit: null, log: [], event: null, updated: 0 }; }
  function sanitize(s) {
    var d = defaults();
    if (!s || typeof s !== 'object') return d;
    var o = Object.assign(d, s);
    o.pos = Math.max(0, Math.min(100, Math.round(+o.pos) || 0));
    o.lane = o.lane === 'EV' ? 'EV' : 'MV';
    o.meter = Math.max(0, Math.min(4, Math.round(+o.meter) || 0));
    o.zoom = Math.max(1, Math.min(3, +o.zoom || 1));
    o.rev = +o.rev || 0;
    if (!Array.isArray(o.coins)) o.coins = [];
    if (!Array.isArray(o.log)) o.log = [];
    if (o.pendingRift && !(SPACES[o.pendingRift.from] && SPACES[o.pendingRift.from].rift && o.pos === o.pendingRift.from)) o.pendingRift = null;
    return o;
  }
  function load() { try { return sanitize(JSON.parse(localStorage.getItem(KEY))); } catch (e) { return defaults(); } }
  function loadHistory() { try { var h = JSON.parse(localStorage.getItem(HKEY)); return Array.isArray(h) ? h : []; } catch (e) { return []; } }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  var state = load();
  var view = { pos: state.pos, lane: state.lane, meter: state.meter };
  var lastEventId = state.event && state.event.id;
  var bc = null;
  try { if ('BroadcastChannel' in window) { bc = new BroadcastChannel(CH); bc.onmessage = function (e) { receive(e.data); }; } } catch (e) { bc = null; }
  window.addEventListener('storage', function (e) { if (e.key === KEY && e.newValue) { try { receive(JSON.parse(e.newValue)); } catch (x) { /* ignore */ } } });
  setInterval(function () { var s = load(); if (s.rev > state.rev) receive(s); }, 700); // fallback for hosts without BroadcastChannel/storage events

  function receive(s) { s = sanitize(s); if (s.rev <= state.rev) return; adopt(s); }
  function adopt(s) {
    state = s;
    if (s.event && s.event.id !== lastEventId) { lastEventId = s.event.id; play(s.event); }
    else { syncView(); renderAll(); }
  }
  function uid() { var a = new Uint32Array(2); crypto.getRandomValues(a); return a[0].toString(36) + a[1].toString(36); }
  function snapshot(s) { var o = clone(s); delete o.event; delete o.log; return o; }
  function pushHistory(s) {
    var h = loadHistory(); h.push(snapshot(s)); while (h.length > 40) h.shift();
    try { localStorage.setItem(HKEY, JSON.stringify(h)); } catch (e) { /* ignore */ }
  }
  function commit(mutate, ev, opts) {
    opts = opts || {};
    var stored = load();
    var base = stored.rev > state.rev ? stored : state;
    if (!opts.noHistory) pushHistory(base);
    (opts.extraHistory || []).forEach(pushHistory);
    var next = clone(base);
    mutate(next);
    next.rev = base.rev + 1;
    next.updated = Date.now();
    next.event = Object.assign({ type: 'set' }, ev || {}, { id: uid() });
    if (opts.log) { next.log = (next.log || []).concat([{ t: Date.now(), m: opts.log }]).slice(-30); }
    next = sanitize(next);
    try { localStorage.setItem(KEY, JSON.stringify(next)); } catch (e) { console.warn('[RFA] could not save state', e); }
    if (bc) { try { bc.postMessage(next); } catch (e) { /* ignore */ } }
    adopt(next);
  }

  // ---------------------------------------------------------------- DOM build
  var app = document.getElementById('app');
  document.body.classList.add(OBS ? 'mode-obs' : 'mode-control');
  if (TRANSPARENT) { document.body.classList.add('transparent'); document.documentElement.style.background = 'transparent'; }
  function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function seeded(seed) { return function () { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; }; }

  var viewport = el('div'); viewport.id = 'viewport';
  var stage = el('div'); stage.id = 'stage';
  viewport.appendChild(stage); app.appendChild(viewport);

  var bg = el('div', 'bg', '<div class="warm"></div><div class="cold"></div><div class="frost"></div>' +
    '<svg class="seam" viewBox="0 0 1920 1080" preserveAspectRatio="none"><defs><filter id="seamGlow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="6" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>' +
    '<g filter="url(#seamGlow)" fill="none" stroke-linejoin="bevel"><polyline points="998,0 941,194 1037,356 902,562 998,734 883,907 960,1080" stroke="#e9ffff" stroke-width="5"/>' +
    '<path d="M941 194L880 240L850 232M1037 356L1110 380M902 562L820 600L790 650M998 734L1080 760L1120 820M883 907L820 930" stroke="#bff" stroke-width="2" opacity=".8"/></g></svg>');
  stage.appendChild(bg);
  (function floatShards() { var rnd = seeded(7); for (var i = 0; i < 16; i++) { var s = el('div', 'shard-float'); s.style.left = (860 + rnd() * 240) + 'px'; s.style.top = (rnd() * 1060) + 'px'; s.style.animationDelay = (-rnd() * 9) + 's'; s.style.scale = String(0.5 + rnd()); bg.appendChild(s); } })();

  var boardWrap = el('div'); boardWrap.id = 'boardWrap';
  var flipper = el('div'); flipper.id = 'flipper'; flipper.style.cssText = 'position:absolute;inset:0;transform-style:preserve-3d';
  var board = el('div'); board.id = 'board';
  flipper.appendChild(board); boardWrap.appendChild(flipper); stage.appendChild(boardWrap);

  function crackSVG(seed) {
    var rnd = seeded(seed), pts = [], x = 0;
    while (x < 102) { pts.push(x.toFixed(1) + ',' + (8 + (rnd() - 0.5) * 9).toFixed(1)); x += 8 + rnd() * 12; }
    pts.push('102,' + (8 + (rnd() - 0.5) * 6).toFixed(1));
    return '<svg class="crack" viewBox="0 0 102 20" preserveAspectRatio="none"><polyline points="' + pts.join(' ') + '" fill="none" stroke="#f2ffff" stroke-width="1.6" opacity=".85"/></svg>';
  }
  function riftSVG(seed) {
    var rnd = seeded(seed), d = '';
    for (var i = 0; i < 9; i++) {
      var a = (i / 9) * Math.PI * 2 + rnd() * 0.5, r1 = 8 + rnd() * 6, r2 = 30 + rnd() * 22, mx = 51 + Math.cos(a + 0.2) * (r1 + r2) / 2, my = 60 + Math.sin(a + 0.2) * (r1 + r2) / 2;
      d += 'M' + (51 + Math.cos(a) * r1).toFixed(1) + ' ' + (60 + Math.sin(a) * r1).toFixed(1) + 'L' + mx.toFixed(1) + ' ' + my.toFixed(1) + 'L' + (51 + Math.cos(a) * r2).toFixed(1) + ' ' + (60 + Math.sin(a) * r2).toFixed(1);
    }
    return '<svg class="rift-svg" viewBox="0 0 102 112"><path d="' + d + '" stroke="#e9ffff" stroke-width="1.6" fill="none" opacity=".9"/><circle cx="51" cy="60" r="10" fill="none" stroke="#fff" stroke-width="2"><animate attributeName="r" values="8;16;8" dur="2.4s" repeatCount="indefinite"/></circle></svg>';
  }
  function halfHTML(lane, p, num) {
    var c = CAT[p.cat] || { tag: p.cat.toUpperCase() };
    return '<div class="half ' + lane.toLowerCase() + '"><div class="nm">' + esc(p.name) + '</div><div class="meta"><span class="lt">' + lane + '</span>' + icon(p.cat) + '<span class="tg">' + esc(c.tag) + '</span>' + (num ? '<span class="no">' + num + '</span>' : '') + '</div></div>';
  }
  var TILES = [];
  for (var n = 1; n <= 99; n++) {
    var sp = SPACES[n]; if (!sp) continue;
    var z = zoneOf(n), t = el('div', 'tile ' + z.cls);
    t.style.left = CELLS[n].x + 'px'; t.style.top = CELLS[n].y + 'px'; t.style.setProperty('--zone', tileColor(n));
    t.dataset.n = n;
    if (sp.rift) {
      t.classList.add('rift');
      t.innerHTML = riftSVG(n * 31) + '<div class="num">' + n + '</div><div class="rlabel"><small>RIFT</small>+' + sp.rift.plus + ' → ' + sp.rift.to + '</div>';
      t.title = 'Fracture Rift: ' + n + ' → ' + sp.rift.to;
    } else if (sp.MV.cat === 'Raw Draw' && sp.EV.cat === 'Raw Draw') {
      t.classList.add('raw');
      t.innerHTML = '<div class="half mv"></div>' + crackSVG(n * 17) + '<div class="half ev"></div><div class="num">' + n + '</div>';
    } else {
      t.classList.add('named');
      if (sp.MV.cat !== sp.EV.cat) t.classList.add('diff');
      var isCoin = COIN_SPACES.indexOf(n) >= 0 || sp.MV.cat === 'Reality Coin Flip';
      if (isCoin) t.classList.add('coin');
      t.innerHTML = halfHTML('MV', sp.MV, n) + crackSVG(n * 17) + halfHTML('EV', sp.EV);
    }
    board.appendChild(t); TILES[n] = t;
  }
  ZONES.slice(0, 5).forEach(function (zn) {
    var c = CELLS[zn.from], tag = el('div', 'zone-tag', esc(zn.name.toUpperCase()) + ' ' + zn.from + '–' + zn.to);
    tag.style.left = (c.x + TW / 2) + 'px'; tag.style.top = (c.y + 16) + 'px'; tag.style.setProperty('--zone', zn.color);
    board.appendChild(tag);
    var tw = tag.offsetWidth || 180, cx = c.x + TW / 2;
    tag.style.left = Math.max(tw / 2 + 4, Math.min(1486 - tw / 2, cx)) + 'px';
  });
  var start = el('div', '', 'START<small>HEXHAVEN<br>GATES</small>'); start.id = 'start'; board.appendChild(start);
  var core = el('div', '', ''); core.id = 'core';
  (function coreArt() {
    var rnd = seeded(100), d = '', polys = '';
    for (var i = 0; i < 22; i++) {
      var a = (i / 22) * Math.PI * 2 + rnd() * 0.2, r = 420, x1 = 369 + Math.cos(a) * 30, y1 = 114 + Math.sin(a) * 18, mx = 369 + Math.cos(a + 0.08) * 160, my = 114 + Math.sin(a + 0.08) * 70;
      d += 'M' + x1.toFixed(0) + ' ' + y1.toFixed(0) + 'L' + mx.toFixed(0) + ' ' + my.toFixed(0) + 'L' + (369 + Math.cos(a) * r).toFixed(0) + ' ' + (114 + Math.sin(a) * r * 0.5).toFixed(0);
      if (i % 3 === 0) polys += '<polygon points="' + mx.toFixed(0) + ',' + my.toFixed(0) + ' ' + (mx + 26 * rnd()).toFixed(0) + ',' + (my - 20 * rnd()).toFixed(0) + ' ' + (mx + 30).toFixed(0) + ',' + (my + 14).toFixed(0) + '" fill="rgba(255,255,255,.18)" stroke="#fff" stroke-width="1"/>';
    }
    core.innerHTML = '<svg viewBox="0 0 738 228" preserveAspectRatio="none"><path d="' + d + '" stroke="rgba(255,255,255,.75)" stroke-width="1.6" fill="none"/>' + polys + '</svg>' +
      '<div class="ctext"><div class="cnum">100</div><div class="ctitle">HEART OF THE ECHOVERSE</div><div class="cprize">' + icon('Grand Prize').replace('<svg', '<svg style="width:22px;height:22px;vertical-align:-4px"') + ' Grand Prize · ' + esc(SPACES[100] ? SPACES[100].MV.detail : 'Reality Fracture Collector Booster') + '</div></div>';
  })();
  board.appendChild(core);
  var riftList = SPACES.filter(function (s) { return s && s.rift; }).map(function (s) { return s.n + '→' + s.rift.to; });
  var legend = el('div', '', '<b>FRACTURE RIFTS · EXACT LANDING ONLY</b>' + riftList.slice(0, 4).join(' · ') + '<br>' + riftList.slice(4).join(' · ') + '<div class="coinline">◎ 60 &amp; 90 Coin Flip · reach 100 = Grand Prize</div>');
  legend.id = 'legend'; board.appendChild(legend);
  (function arcs() {
    var s = '<svg id="arcs" viewBox="0 0 1490 1080"><defs><marker id="ah" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M0 0L10 5L0 10z" fill="#bffcff"/></marker>' +
      '<filter id="ag"><feGaussianBlur stdDeviation="2.5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>';
    function outward(n) {
      var c = CELLS[n], k = Math.min(c.r, ROWS - 1 - c.r, c.c, COLS - 1 - c.c);
      if (c.r === ROWS - 1 - k) return [0, 1];
      if (c.c === COLS - 1 - k) return [1, 0];
      if (c.r === k) return [0, -1];
      return [-1, 0];
    }
    SPACES.forEach(function (sp) {
      if (!sp || !sp.rift) return;
      var A = CELLS[sp.n], B = CELLS[sp.rift.to], oa = outward(sp.n), ob = outward(sp.rift.to);
      var pa = [A.x + TW / 2 + oa[0] * (TW / 2 - 6), A.y + TH / 2 + oa[1] * (TH / 2 - 4)], pb = [B.x + TW / 2 + ob[0] * (TW / 2 - 6), B.y + TH / 2 + ob[1] * (TH / 2 - 4)];
      var ox = oa[0] + ob[0], oy = oa[1] + ob[1], L = Math.hypot(ox, oy) || 1, k = 16;
      var q = [(pa[0] + pb[0]) / 2 + ox / L * k, (pa[1] + pb[1]) / 2 + oy / L * k];
      if (oa[0] !== ob[0] || oa[1] !== ob[1]) q = [oa[0] ? pa[0] + oa[0] * 6 : pb[0] + ob[0] * 6, oa[1] ? pa[1] + oa[1] * 6 : pb[1] + ob[1] * 6];
      q[0] = Math.max(4, Math.min(1486, q[0])); q[1] = Math.max(4, Math.min(1076, q[1]));
      s += '<path d="M' + pa[0].toFixed(0) + ' ' + pa[1].toFixed(0) + ' Q' + q[0].toFixed(0) + ' ' + q[1].toFixed(0) + ' ' + pb[0].toFixed(0) + ' ' + pb[1].toFixed(0) + '" fill="none" stroke="#9ff" stroke-width="3" stroke-dasharray="7 5" filter="url(#ag)" marker-end="url(#ah)" opacity=".95"><animate attributeName="stroke-dashoffset" from="24" to="0" dur="1s" repeatCount="indefinite"/></path>';
    });
    board.insertAdjacentHTML('beforeend', s + '</svg>');
  })();
  var piece = el('div', '', PIECE_SVG); piece.id = 'piece'; board.appendChild(piece);

  var hud = el('div'); hud.id = 'hud';
  hud.innerHTML =
    '<div class="panelglass hud-title"><div class="t1">REALITY FRACTURE</div><div class="t2">ADVENTURE</div></div>' +
    '<div class="zone-banner" id="hZone"></div>' +
    '<div class="lane-badge" id="hLane"></div>' +
    '<div class="panelglass space-box"><div class="big" id="hSpace"></div><div><div class="lbl">FLOOR OF 100</div><div class="who" id="hWho"></div></div></div>' +
    '<div class="panelglass prize-box"><div class="lbl" id="hPrizeLbl"></div><div class="pname" id="hPrize"></div><div class="pcat" id="hCat"></div><div class="other" id="hOther"></div></div>' +
    '<div class="panelglass meter-box"><svg width="0" height="0" style="position:absolute"><defs><linearGradient id="pipGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d9f6ff"/><stop offset=".5" stop-color="#4aa3ff"/><stop offset="1" stop-color="#2a1a8a"/></linearGradient></defs></svg>' +
    '<div class="lbl"><span>EMPOWER JACE</span><b id="hMeter"></b></div><div class="pips" id="hPips"></div></div>' +
    '<div class="panelglass zones-box" id="hZones"></div>';
  stage.appendChild(hud);
  var pipsEl = hud.querySelector('#hPips');
  for (var p = 0; p < 5; p++) pipsEl.appendChild(el('div', 'pip', PIP_SVG));
  hud.querySelector('#hZones').innerHTML = ZONES.map(function (zn) {
    var sw = zn.cls === 'z-sch' ? 'background:conic-gradient(' + SCHOOLS.map(function (s, i) { return s[1] + ' ' + (i * 20) + '% ' + ((i + 1) * 20) + '%'; }).join(',') + ')' : 'background:' + zn.color;
    return '<div class="zr" data-z="' + zn.from + '"><span class="sw" style="' + sw + '"></span>' + esc(zn.name) + '<span class="rng">' + (zn.from === zn.to ? zn.from : zn.from + '–' + zn.to) + '</span></div>' +
      (zn.cls === 'z-sch' ? '<div class="schools">' + SCHOOLS.map(function (s) { return '<i style="--c:' + s[1] + '">' + s[0] + '</i>'; }).join('') + '</div>' : '');
  }).join('');

  var banners = el('div'); banners.id = 'banners'; stage.appendChild(banners);
  var shimmer = el('div'); shimmer.id = 'shimmer'; stage.appendChild(shimmer);
  var coinStage = el('div'); coinStage.id = 'coinStage'; coinStage.style.left = '745px'; coinStage.style.top = '520px'; stage.appendChild(coinStage);

  // ---------------------------------------------------------------- control panel
  var panel = null, $ = function (id) { return document.getElementById(id); };
  if (!OBS) {
    panel = el('aside'); panel.id = 'panel';
    panel.innerHTML =
      '<header><div><span>REALITY FRACTURE ADVENTURE</span><h1>Tower Control</h1></div><button class="x" id="cHide" title="Hide controls (C)" aria-label="Hide controls">×</button></header>' +
      (DATA_ERRORS.length ? '<div class="card" style="border-color:#f66;color:#fbb">Prize data warning: ' + esc(DATA_ERRORS.join('; ')) + '</div>' : '') +
      '<div class="card"><div class="h"><span>CURRENT</span><span class="sync" id="cSync"></span></div><div class="status"><div class="sn" id="cSpace"></div><div class="pl"><span class="lanepill" id="cLane"></span> <span id="cZone" style="color:#9fb4d8;font-size:12px"></span></div><div class="pz" id="cPrize"></div><div class="ot" id="cOther"></div></div></div>' +
      '<div class="rift-prompt" id="cRift"><b id="cRiftTxt"></b><div class="row" style="margin-top:8px"><button class="b primary" id="cRiftYes">Apply rift (Enter)</button><button class="b" id="cRiftNo">Dismiss (Esc)</button></div></div>' +
      '<div class="card"><div class="h"><span>MOVE</span><span>exact landing only</span></div>' +
      '<div class="row"><button class="b" id="cM5">−5</button><button class="b" id="cM1">−1</button><button class="b primary" id="cP1">+1 SPACE</button><button class="b" id="cP5">+5</button></div>' +
      '<div class="row"><input type="number" id="cMoveN" min="0" max="60" placeholder="Move by N (mythic MV total)" aria-label="Move by N"><button class="b warm" id="cMove" style="flex:0 0 96px">Move ▶</button></div>' +
      '<div class="row"><input type="number" id="cJumpN" min="0" max="100" placeholder="Jump to space (0 = Start)" aria-label="Jump to space"><button class="b" id="cJump" style="flex:0 0 96px">Jump</button></div>' +
      '<div class="hint">Move-by-N walks step by step, auto-applies a rift on an exact landing (Undo reverts just the rift first), and caps at 100. Arrows / jump never auto-warp: they raise a rift prompt instead.</div></div>' +
      '<div class="card"><div class="h"><span>REALITY LANE</span><span>L</span></div><div class="row"><button class="b" id="cFlip"></button></div></div>' +
      '<div class="card"><div class="h"><span>EMPOWER JACE · J / Shift+J</span><span id="cBonus"></span></div><div class="row" style="align-items:center"><div class="pipsmini" id="cPips"></div></div>' +
      '<div class="row"><button class="b" id="cJm">−1</button><button class="b cold" id="cJp">+1 Jace card</button><button class="b" id="cJr">Reset meter</button></div></div>' +
      '<div class="card"><div class="h"><span>REALITY COIN FLIP</span><span>spaces 60 / 90 · F</span></div><div class="row"><button class="b gold" id="cCoin">Flip the Reality Coin</button></div><div class="log" id="cCoins"></div></div>' +
      '<div class="card"><div class="h"><span>CLIMBER (optional)</span></div><div class="row"><input type="text" id="cCust" maxlength="40" placeholder="Customer name"><button class="b" id="cCustSet" style="flex:0 0 70px">Set</button></div></div>' +
      '<div class="card"><div class="h"><span>CAMERA ZOOM <b id="cZoomV"></b></span><span>+ / −</span></div><input type="range" id="cZoom" min="1" max="3" step="0.1"></div>' +
      '<div class="card"><div class="row"><button class="b" id="cUndo">↶ Undo (Ctrl+Z)</button><button class="b danger" id="cReset">Reset board…</button></div></div>' +
      '<div class="card keys"><div class="h"><span>KEYBOARD (also works in OBS via Interact)</span></div>' +
      '<kbd>→</kbd>/<kbd>Space</kbd> +1 &nbsp; <kbd>←</kbd> −1 &nbsp; <kbd>PgUp</kbd> +5 &nbsp; <kbd>PgDn</kbd> −5<br><kbd>M</kbd> move-by-N box &nbsp; <kbd>G</kbd> jump box &nbsp; <kbd>L</kbd> flip lane<br>' +
      '<kbd>J</kbd> Jace +1 &nbsp; <kbd>Shift</kbd>+<kbd>J</kbd> Jace −1 &nbsp; <kbd>F</kbd> coin flip (60/90)<br><kbd>Enter</kbd> apply rift &nbsp; <kbd>Esc</kbd> dismiss &nbsp; <kbd>C</kbd> hide/show controls<br><kbd>+</kbd>/<kbd>−</kbd> zoom &nbsp; <kbd>Ctrl</kbd>+<kbd>Z</kbd> undo &nbsp; Reset is never on a single key.</div>' +
      '<div class="card links"><div class="h"><span>VIEWS</span></div><a href="?obs=1" target="_blank">Clean OBS view (?obs=1) ↗</a><a href="?obs=1&amp;transparent=1" target="_blank">Transparent OBS view ↗</a><a href="?dock=1" target="_blank">Compact controls (OBS dock) ↗</a></div>' +
      '<div class="card"><div class="h"><span>ACTIVITY LOG</span></div><div class="log" id="cLog"></div></div>';
    app.appendChild(panel);
    var showBtn = el('button', '', '☰'); showBtn.id = 'showPanel'; showBtn.title = 'Show controls (C)'; app.appendChild(showBtn);
    showBtn.onclick = function () { togglePanel(true); };
    var modal = el('div'); modal.id = 'modal'; modal.innerHTML = '<div class="box" role="dialog" aria-modal="true"></div>'; app.appendChild(modal);
  }

  // ---------------------------------------------------------------- layout / scaling
  function fit() {
    var compact = !OBS && (DOCK || window.innerWidth < 900);
    document.body.classList.toggle('compact', compact);
    var w = viewport.clientWidth, h = viewport.clientHeight;
    if (!w || !h) return;
    var sc = Math.min(w / 1920, h / 1080);
    stage.style.transform = 'translate(' + ((w - 1920 * sc) / 2) + 'px,' + ((h - 1080 * sc) / 2) + 'px) scale(' + sc + ')';
  }
  window.addEventListener('resize', fit);
  function togglePanel(show) { if (document.body.classList.contains('compact')) return; document.body.classList.toggle('panel-hidden', show === undefined ? !document.body.classList.contains('panel-hidden') : !show); fit(); }

  // ---------------------------------------------------------------- rendering
  function syncView() { view.pos = state.pos; view.lane = state.lane; view.meter = state.meter; }
  function setLaneClass(l) { document.body.classList.toggle('lane-MV', l === 'MV'); document.body.classList.toggle('lane-EV', l === 'EV'); }
  function placePiece(n, mode) {
    piece.classList.remove('glide', 'instant');
    if (mode) piece.classList.add(mode);
    var c = centerOf(n); piece.style.left = c.x + 'px'; piece.style.top = c.y + 'px';
    TILES.forEach(function (t, i) { if (t) t.classList.toggle('here', i === n); });
    core.classList.toggle('reached', n >= 100);
    applyZoom(n);
  }
  function applyZoom(n) {
    var z = state.zoom || 1;
    if (z <= 1.001) { board.style.transform = ''; return; }
    var c = centerOf(n), W = 1490, H = 1080;
    var tx = Math.min(0, Math.max(W - W * z, W / 2 - c.x * z)), ty = Math.min(0, Math.max(H - H * z, H / 2 - c.y * z));
    board.style.transform = 'translate(' + tx + 'px,' + ty + 'px) scale(' + z + ')';
  }
  function spaceInfo(n, lane) {
    if (n <= 0) return { lbl: 'START', name: 'The climb begins', cat: 'Hexhaven Campus gates — no prize', icon: '', other: '' };
    var sp = SPACES[n], p = sp[lane], o = sp[lane === 'MV' ? 'EV' : 'MV'];
    if (sp.rift) { var dp = SPACES[sp.rift.to][lane]; return { lbl: 'FRACTURE RIFT', name: 'Rift +' + sp.rift.plus + ' → ' + sp.rift.to, cat: 'No prize on a rift — destination prize only', icon: icon('Rift'), other: 'Destination ' + sp.rift.to + ': ' + dp.name + (dp.cat !== 'Raw Draw' ? ' — ' + dp.detail : '') }; }
    return { lbl: (n >= 100 ? 'GRAND PRIZE' : LANE_NAME[lane].toUpperCase() + ' PRIZE'), name: p.name, cat: p.detail, icon: icon(p.cat),
      other: n >= 100 ? 'Same prize in both realities' : (lane === 'MV' ? 'Echoverse' : 'Multiverse') + ' would be: ' + o.name + (o.cat !== 'Raw Draw' ? ' — ' + o.detail : '') };
  }
  function renderHUD() {
    var n = view.pos, lane = view.lane, zn = zoneOf(n), info = spaceInfo(n, lane);
    setLaneClass(lane);
    var hz = $('hZone'); hz.style.setProperty('--zone', n >= 100 ? '#e9ffff' : (n >= 21 && n <= 40 ? tileColor(n) : zn.color));
    hz.innerHTML = '<small>' + (n <= 0 ? 'START · FLOORS 1–20' : n >= 100 ? 'FLOOR 100' : 'FLOORS ' + zn.from + '–' + zn.to) + '</small>' + esc(zn.name) + (n >= 21 && n <= 40 ? ' · ' + SCHOOLS[Math.floor((n - 21) / 4)][0] : '');
    $('hLane').innerHTML = (lane === 'MV' ? 'MULTIVERSE' : 'ECHOVERSE') + '<small>' + lane + ' · ' + (lane === 'MV' ? 'WARM REALITY' : 'COLD REALITY') + '</small>';
    var hs = $('hSpace'); hs.textContent = n <= 0 ? 'START' : n; hs.style.fontSize = n <= 0 ? '40px' : '';
    $('hWho').textContent = state.customer ? 'Climber: ' + state.customer : (state.pendingRift ? 'Rift detected!' : 'Jace\'s Spiral Tower');
    $('hPrizeLbl').textContent = info.lbl; $('hPrize').textContent = info.name;
    $('hCat').innerHTML = info.icon + '<span>' + esc(info.cat) + '</span>'; $('hOther').textContent = info.other;
    $('hOther').style.display = info.other ? '' : 'none';
    $('hMeter').textContent = view.meter + '/5';
    Array.prototype.forEach.call(pipsEl.children, function (pp, i) { pp.classList.toggle('on', i < view.meter); });
    Array.prototype.forEach.call(document.querySelectorAll('#hZones .zr'), function (r) { r.classList.toggle('cur', +r.dataset.z === zn.from); });
    TILES.forEach(function (t, i) { if (t && t.classList.contains('rift')) t.classList.toggle('pending', !!(state.pendingRift && state.pendingRift.from === i && view.pos === i)); });
  }
  function fmtTime(t) { var d = new Date(t); return ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2); }
  function renderPanel() {
    if (!panel) return;
    var n = state.pos, lane = state.lane, info = spaceInfo(n, lane);
    $('cSpace').textContent = n <= 0 ? 'S' : n;
    $('cLane').textContent = LANE_NAME[lane].toUpperCase() + ' (' + lane + ')';
    $('cZone').textContent = zoneOf(n).name;
    $('cPrize').textContent = (n <= 0 ? 'Start — no prize' : info.name + ' — ' + info.cat);
    $('cOther').textContent = info.other;
    $('cSync').textContent = 'saved · rev ' + state.rev + (bc ? ' · live sync' : ' · storage sync');
    var pr = state.pendingRift && state.pendingRift.from === n;
    $('cRift').classList.toggle('show', !!pr);
    if (pr) $('cRiftTxt').textContent = 'Rift! ' + state.pendingRift.from + ' → ' + state.pendingRift.to + ' — apply?';
    $('cFlip').textContent = 'Flip lane → ' + (lane === 'MV' ? 'ECHOVERSE' : 'MULTIVERSE');
    $('cFlip').className = 'b ' + (lane === 'MV' ? 'cold' : 'warm');
    var pm = ''; for (var i = 0; i < 5; i++) pm += '<i class="' + (i < state.meter ? 'on' : '') + '"></i>';
    $('cPips').innerHTML = pm + '<span style="margin-left:8px">' + state.meter + '/5</span>';
    $('cBonus').textContent = 'bonus spins: ' + (state.bonusTotal || 0);
    var atCoin = COIN_SPACES.indexOf(n) >= 0;
    $('cCoin').disabled = !atCoin;
    $('cCoin').textContent = atCoin ? (state.coinVisit ? 'Flip again (already flipped here)…' : 'Flip the Reality Coin (space ' + n + ')') : 'Coin flip only on 60 or 90';
    $('cCoins').innerHTML = state.coins.slice(-5).reverse().map(function (c) { return fmtTime(c.at) + ' · space ' + c.space + ' · <b>' + COIN_TEXT[c.result].side + '</b> — ' + COIN_TEXT[c.result].prize; }).join('<br>');
    if (document.activeElement !== $('cCust')) $('cCust').value = state.customer || '';
    $('cZoom').value = state.zoom; $('cZoomV').textContent = (+state.zoom).toFixed(1) + '×';
    $('cUndo').disabled = loadHistory().length === 0;
    $('cM1').disabled = $('cM5').disabled = n <= 0; $('cP1').disabled = $('cP5').disabled = n >= 100;
    $('cLog').innerHTML = state.log.slice(-12).reverse().map(function (l) { return fmtTime(l.t) + ' · ' + esc(l.m); }).join('<br>');
  }
  function renderAll() { setLaneClass(view.lane); placePiece(view.pos, 'instant'); renderHUD(); renderPanel(); }

  // ---------------------------------------------------------------- animation helpers
  var animToken = 0;
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function clearFx() { Array.prototype.forEach.call(document.querySelectorAll('.fxshard,.fxcrack,.confetti,.burst-ring'), function (e) { e.remove(); }); coinStage.innerHTML = ''; }
  var bannerTimer = null;
  function showBanner(o) {
    clearTimeout(bannerTimer);
    banners.innerHTML = '';
    var small = !!o.small;
    var b = el('div', 'banner' + (small ? ' small' : ''),
      (o.kick ? '<div class="kick">' + esc(o.kick) + '</div>' : '') + '<div class="head">' + esc(o.head) + '</div>' + (o.sub ? '<div class="sub">' + esc(o.sub) + '</div>' : '') + (o.note ? '<div class="note">' + esc(o.note) + '</div>' : ''));
    if (o.color) b.style.setProperty('--bc', o.color);
    if (o.top) b.style.top = o.top;
    banners.appendChild(b);
    b.animate([{ opacity: 0, transform: small ? 'translate(-50%,-20px)' : 'translate(-50%,-50%) scale(.85)' }, { opacity: 1, transform: small ? 'translate(-50%,0)' : 'translate(-50%,-50%) scale(1)' }], { duration: 380, easing: 'cubic-bezier(.2,.9,.3,1.3)' });
    bannerTimer = setTimeout(function () { var a = b.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 400, fill: 'forwards' }); a.onfinish = function () { b.remove(); }; }, o.ms || 5000);
  }
  function hideBanner() { clearTimeout(bannerTimer); banners.innerHTML = ''; }
  function shards(x, y, inward, color, count) {
    for (var i = 0; i < (count || 18); i++) {
      var s = el('div', 'fxshard'); s.style.left = (x - 8) + 'px'; s.style.top = (y - 11) + 'px';
      if (color) s.style.background = 'linear-gradient(135deg,#fff,' + color + ')';
      board.appendChild(s);
      var a = Math.random() * Math.PI * 2, d = 50 + Math.random() * 90, rot = (Math.random() * 720 - 360) + 'deg';
      var far = 'translate(' + (Math.cos(a) * d) + 'px,' + (Math.sin(a) * d) + 'px) rotate(' + rot + ') scale(.6)', near = 'translate(0px,0px) rotate(0deg) scale(1.2)';
      var an = s.animate(inward ? [{ transform: far, opacity: 0 }, { transform: near, opacity: 1 }] : [{ transform: near, opacity: 1 }, { transform: far, opacity: 0 }], { duration: 650, easing: inward ? 'cubic-bezier(.5,0,.8,.4)' : 'cubic-bezier(.1,.7,.3,1)', fill: 'forwards' });
      an.onfinish = (function (node) { return function () { node.remove(); }; })(s);
    }
  }
  function crackAt(x, y) {
    var rnd = Math.random, d = '';
    for (var i = 0; i < 8; i++) { var a = i / 8 * Math.PI * 2 + rnd() * 0.4, r1 = 30 + rnd() * 20, r2 = 70 + rnd() * 40; d += 'M80 80L' + (80 + Math.cos(a + 0.15) * r1).toFixed(0) + ' ' + (80 + Math.sin(a + 0.15) * r1).toFixed(0) + 'L' + (80 + Math.cos(a) * r2).toFixed(0) + ' ' + (80 + Math.sin(a) * r2).toFixed(0); }
    var c = el('div', 'fxcrack', '<svg width="160" height="160" viewBox="0 0 160 160"><path d="' + d + '" stroke="#fff" stroke-width="3" fill="none" stroke-dasharray="400" stroke-dashoffset="400" style="filter:drop-shadow(0 0 6px #7ff)"><animate attributeName="stroke-dashoffset" from="400" to="0" dur=".45s" fill="freeze"/></path></svg>');
    c.style.left = (x - 80) + 'px'; c.style.top = (y - 80) + 'px'; board.appendChild(c);
    setTimeout(function () { c.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 500, fill: 'forwards' }).onfinish = function () { c.remove(); }; }, 900);
  }
  function confetti(x, y, colors, count) {
    for (var i = 0; i < count; i++) {
      var c = el('div', 'confetti'); c.style.left = x + 'px'; c.style.top = y + 'px'; c.style.background = colors[i % colors.length];
      stage.appendChild(c);
      var a = Math.random() * Math.PI * 2, d = 200 + Math.random() * 520, dur = 1400 + Math.random() * 1600;
      var an = c.animate([{ transform: 'translate(0px,0px) rotate(0deg)', opacity: 1 }, { transform: 'translate(' + Math.cos(a) * d + 'px,' + (Math.sin(a) * d + 220) + 'px) rotate(' + (Math.random() * 1080) + 'deg)', opacity: 0 }], { duration: dur, easing: 'cubic-bezier(.1,.8,.4,1)', fill: 'forwards' });
      an.onfinish = (function (node) { return function () { node.remove(); }; })(c);
    }
  }
  function ring(x, y, color) {
    var r = el('div', 'burst-ring'); r.style.left = (x - 40) + 'px'; r.style.top = (y - 40) + 'px'; r.style.width = r.style.height = '80px'; r.style.borderColor = color || '#fff';
    stage.appendChild(r);
    r.animate([{ transform: 'scale(.2)', opacity: 1 }, { transform: 'scale(9)', opacity: 0 }], { duration: 1200, easing: 'ease-out', fill: 'forwards' }).onfinish = function () { r.remove(); };
  }
  function stageXY(n) { var c = centerOf(n), z = state.zoom || 1; if (z <= 1.001) return c; var m = /translate\(([-\d.]+)px,\s*([-\d.]+)px\)/.exec(board.style.transform) || [0, 0, 0]; return { x: +m[1] + c.x * z, y: +m[2] + c.y * z }; }

  function landingBanner(n, lane, extra) {
    if (n <= 0 || n >= 100) return;
    var sp = SPACES[n];
    if (sp.rift) { showBanner({ kick: 'FRACTURE RIFT DETECTED', head: 'Floor ' + n + ' → ' + sp.rift.to, sub: 'Rift +' + sp.rift.plus + ' · exact landing', color: '#7ff', ms: 4000 }); return; }
    var p = sp[lane], coin = p.cat === 'Reality Coin Flip';
    showBanner({ kick: (extra ? extra + ' · ' : '') + 'FLOOR ' + n + ' · ' + LANE_NAME[lane].toUpperCase(), head: p.name, sub: coin ? 'Reality Coin Flip!' : p.detail,
      note: coin ? 'Heads: 2 Reality Fracture Play Boosters · Tails: 1 Reality Fracture Collector Booster' : (p.cat === 'Raw Draw' ? '' : zoneOf(n).name),
      color: coin ? '#ffd36b' : null, ms: coin ? 7000 : 5200 });
  }
  async function grand(tok) {
    var c = stageXY(100);
    core.classList.add('reached');
    showBanner({ kick: 'THE CLIMB IS COMPLETE', head: 'HEART OF THE ECHOVERSE', sub: 'GRAND PRIZE — ' + SPACES[100].MV.detail, note: 'Same prize in both realities', color: '#e9ffff', ms: 9000 });
    for (var i = 0; i < 4 && tok === animToken; i++) { ring(c.x, c.y, i % 2 ? '#ffd36b' : '#b28cff'); confetti(c.x, c.y, ['#fff', '#ffd36b', '#b28cff', '#8fe3ff', '#ff9a3c'], 60); await sleep(700); }
  }
  async function warp(from, to, tok) {
    var a = centerOf(from), b = centerOf(to);
    crackAt(a.x, a.y);
    await sleep(380); if (tok !== animToken) return false;
    piece.style.visibility = 'hidden';
    shards(a.x, a.y, false, '#7ff', 22);
    await sleep(520); if (tok !== animToken) return false;
    view.pos = to; placePiece(to, 'instant'); renderHUD();
    shards(b.x, b.y, true, '#b28cff', 22);
    await sleep(600);
    piece.style.visibility = '';
    if (tok !== animToken) return false;
    piece.animate([{ transform: 'scale(1.6)', filter: 'brightness(3)' }, { transform: 'scale(1)', filter: 'brightness(1)' }], { duration: 420, easing: 'ease-out' });
    return true;
  }
  async function walk(path, per, tok) {
    for (var i = 0; i < path.length; i++) {
      if (tok !== animToken) return false;
      view.pos = path[i]; placePiece(view.pos); renderHUD();
      await sleep(per);
    }
    return tok === animToken;
  }
  function range(a, b) { var r = []; if (b >= a) for (var i = a + 1; i <= b; i++) r.push(i); else for (var j = a - 1; j >= b; j--) r.push(j); return r; }
  function pipCenter() { var m = pipsEl.getBoundingClientRect(), s = stage.getBoundingClientRect(), sc = s.width / 1920 || 1; return { x: (m.left - s.left + m.width / 2) / sc, y: (m.top - s.top + m.height / 2) / sc }; }

  async function play(ev) {
    var tok = ++animToken;
    clearFx(); piece.style.visibility = '';
    if (flipper.getAnimations) flipper.getAnimations().forEach(function (a) { a.cancel(); });
    Array.prototype.forEach.call(pipsEl.children, function (pp) { pp.classList.remove('burst'); });
    renderPanel();
    var finalize = function () { if (tok === animToken) { syncView(); renderAll(); } };
    try {
      switch (ev.type) {
        case 'step': {
          view.lane = state.lane; view.meter = state.meter;
          if (!(await walk(range(ev.from, ev.to), 110, tok))) return;
          finalize();
          if (ev.to >= 100) { await grand(tok); return; }
          await sleep(650); if (tok !== animToken) return;
          landingBanner(ev.to, state.lane);
          return;
        }
        case 'move': {
          view.lane = state.lane; view.meter = state.meter; view.pos = ev.from; placePiece(ev.from, 'instant'); renderHUD();
          if (ev.n === 0) { showBanner({ kick: 'NO MYTHIC THIS TURN', head: 'No movement', sub: 'No prize — the piece stays on ' + (ev.from <= 0 ? 'Start' : 'floor ' + ev.from), ms: 4500 }); finalize(); return; }
          hideBanner();
          showBanner({ kick: (state.customer ? state.customer.toUpperCase() + "'S CLIMB" : 'THE CLIMB'), head: 'Move ' + ev.n + (ev.n === 1 ? ' floor' : ' floors'), sub: (ev.from <= 0 ? 'Start' : 'Floor ' + ev.from) + ' → ' + (ev.landing >= 100 ? '100' : ev.landing), small: true, ms: 2600 });
          var per = Math.max(140, Math.min(380, 3600 / Math.max(1, ev.landing - ev.from)));
          if (!(await walk(range(ev.from, ev.landing), per, tok))) return;
          if (ev.rift) {
            showBanner({ kick: 'FRACTURE RIFT!', head: ev.landing + ' → ' + ev.final, sub: 'The glass cracks… reality warps +' + (ev.final - ev.landing), color: '#7ff', small: true, ms: 2400 });
            await sleep(300); if (tok !== animToken) return;
            if (!(await warp(ev.landing, ev.final, tok))) return;
          }
          finalize();
          if (ev.final >= 100) { await grand(tok); return; }
          await sleep(250); if (tok !== animToken) return;
          landingBanner(ev.final, state.lane, ev.rift ? 'VIA RIFT ' + ev.landing + '→' + ev.final : '');
          return;
        }
        case 'jump': {
          view.lane = state.lane; view.meter = state.meter; view.pos = ev.to;
          placePiece(ev.to, 'glide'); renderHUD();
          await sleep(950); if (tok !== animToken) return;
          finalize();
          if (ev.to >= 100) { await grand(tok); return; }
          landingBanner(ev.to, state.lane);
          return;
        }
        case 'rift': {
          view.lane = state.lane; view.meter = state.meter; view.pos = ev.from; placePiece(ev.from, 'instant'); renderHUD();
          showBanner({ kick: 'FRACTURE RIFT!', head: ev.from + ' → ' + ev.to, sub: 'Reality warps +' + (ev.to - ev.from), color: '#7ff', small: true, ms: 2400 });
          if (!(await warp(ev.from, ev.to, tok))) return;
          finalize();
          await sleep(250); if (tok !== animToken) return;
          landingBanner(ev.to, state.lane, 'VIA RIFT ' + ev.from + '→' + ev.to);
          return;
        }
        case 'flip': {
          var to = ev.to, color = to === 'EV' ? '#b28cff' : '#ffc45a', from = to === 'EV' ? 'MV' : 'EV';
          view.pos = state.pos; view.meter = state.meter; view.lane = from; renderAll();
          shimmer.animate([{ opacity: 0, backgroundPosition: '150% 0' }, { opacity: 1, offset: 0.3 }, { opacity: 0, backgroundPosition: '-50% 0' }], { duration: 1100, easing: 'ease-in-out' });
          var a1 = flipper.animate([{ transform: 'rotateY(0deg)' }, { transform: 'rotateY(90deg)' }], { duration: 450, easing: 'ease-in', fill: 'forwards' });
          var lb = $('hLane'), b1 = lb.animate([{ transform: 'rotateX(0deg)' }, { transform: 'rotateX(90deg)' }], { duration: 450, easing: 'ease-in', fill: 'forwards' });
          await sleep(450);
          if (tok !== animToken) { a1.cancel(); b1.cancel(); return; }
          view.lane = to; renderHUD(); setLaneClass(to);
          var a2 = flipper.animate([{ transform: 'rotateY(-90deg)' }, { transform: 'rotateY(0deg)' }], { duration: 550, easing: 'cubic-bezier(.2,.9,.3,1.2)', fill: 'forwards' });
          lb.animate([{ transform: 'rotateX(-90deg)' }, { transform: 'rotateX(0deg)' }], { duration: 550, easing: 'cubic-bezier(.2,.9,.3,1.2)' });
          a1.cancel(); b1.cancel();
          var pc = stageXY(state.pos); ring(pc.x, pc.y, color);
          confetti(745, 540, to === 'EV' ? ['#b28cff', '#8fe3ff', '#ffffff'] : ['#ffc45a', '#ff7a1a', '#fff3d6'], 40);
          showBanner({ kick: 'ECHOED PAIR · REALITY FLIP', head: to === 'EV' ? 'ECHOVERSE' : 'MULTIVERSE', sub: to === 'EV' ? 'The cold reality takes hold' : 'Back to the warm Multiverse', color: color, ms: 3400 });
          await sleep(560); a2.cancel(); finalize();
          if (state.pos > 0 && state.pos < 100 && !SPACES[state.pos].rift) {
            await sleep(2600); if (tok !== animToken) return;
            var np = SPACES[state.pos][to];
            showBanner({ kick: 'FLOOR ' + state.pos + ' IN THE ' + LANE_NAME[to].toUpperCase(), head: np.name, sub: np.detail, small: true, color: color, ms: 3500 });
          }
          return;
        }
        case 'jace': {
          view.pos = state.pos; view.lane = state.lane;
          if (ev.bonus) {
            view.meter = 5; renderHUD();
            Array.prototype.forEach.call(pipsEl.children, function (pp) { pp.classList.add('burst'); });
            var pcn = pipCenter();
            ring(pcn.x, pcn.y, '#8fe3ff'); confetti(pcn.x, pcn.y, ['#8fe3ff', '#4aa3ff', '#ffffff', '#b28cff'], 50);
            showBanner({ kick: 'EMPOWER JACE 5/5', head: 'BONUS LEVEL 1 SPIN!', sub: (state.customer ? state.customer + ' earns a bonus spin' : 'This turn\'s customer earns a bonus spin'), note: 'The meter resets to ' + ev.to + '/5', color: '#8fe3ff', ms: 5200 });
            await sleep(2600); if (tok !== animToken) return;
            Array.prototype.forEach.call(pipsEl.children, function (pp) { pp.classList.remove('burst'); });
            finalize();
          } else {
            finalize();
            var idx = ev.to > ev.from ? ev.to - 1 : ev.from - 1, pp = pipsEl.children[idx];
            if (pp) pp.animate([{ transform: 'scale(1.4)' }, { transform: 'scale(1)' }], { duration: 400, easing: 'ease-out' });
            showBanner({ kick: 'EMPOWER JACE', head: ev.to + '/5', sub: ev.to > ev.from ? 'A Jace card adds a loyalty counter' : (ev.to === 0 ? 'Meter reset' : 'Meter adjusted'), small: true, color: '#8fe3ff', ms: 2200 });
          }
          return;
        }
        case 'coin': {
          finalize();
          var r = ev.result, end = 6 * 360 + (r === 'T' ? 180 : 0);
          var coin = el('div', 'coin3d', '<div class="face heads"><b>H</b><span>2 PLAY<br>BOOSTERS</span></div><div class="face tails"><b>T</b><span>COLLECTOR<br>BOOSTER</span></div>');
          coinStage.appendChild(coin);
          showBanner({ kick: 'REALITY COIN FLIP · FLOOR ' + ev.space, head: 'Heads or Tails?', sub: 'Heads: 2 Play Boosters · Tails: Collector Booster', small: true, color: '#ffd36b', ms: 2900 });
          var an = coin.animate([
            { transform: 'translateY(0px) rotateY(0deg) scale(.6)' },
            { transform: 'translateY(-260px) rotateY(' + (end * 0.5) + 'deg) scale(1.1)', offset: 0.45 },
            { transform: 'translateY(0px) rotateY(' + end + 'deg) scale(1)' }], { duration: 2800, easing: 'cubic-bezier(.25,.6,.35,1)', fill: 'forwards' });
          await new Promise(function (res) { an.onfinish = res; an.oncancel = res; setTimeout(res, 3200); });
          if (tok !== animToken) return;
          ring(745, 520, r === 'H' ? '#ffd36b' : '#b28cff');
          confetti(745, 520, r === 'H' ? ['#ffd36b', '#ff9a3c', '#fff'] : ['#b28cff', '#8fe3ff', '#fff'], 70);
          showBanner({ kick: 'THE COIN LANDS ON', head: COIN_TEXT[r].side + '!', sub: (r === 'H' ? '2 Reality Fracture Play Boosters' : '1 Reality Fracture Collector Booster'), top: '78%', color: r === 'H' ? '#ffd36b' : '#b28cff', ms: 8000 });
          await sleep(8000); if (tok !== animToken) return;
          coin.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 500, fill: 'forwards' }).onfinish = function () { coin.remove(); };
          return;
        }
        case 'reset': {
          var ra = centerOf(ev.from || 0);
          shards(ra.x, ra.y, false, '#fff', 20); piece.style.visibility = 'hidden';
          await sleep(600); if (tok !== animToken) return;
          finalize(); piece.style.visibility = '';
          var rb = centerOf(0); shards(rb.x, rb.y, true, '#ffc45a', 20);
          showBanner({ kick: 'A NEW CLIMB BEGINS', head: 'Jace\'s Spiral Tower', sub: 'Start · Multiverse · Empower Jace ' + state.meter + '/5', color: '#ffc45a', ms: 4500 });
          return;
        }
        default: finalize(); return;
      }
    } catch (e) { console.error('[RFA] animation error', e); finalize(); }
  }

  // ---------------------------------------------------------------- actions
  function isRift(n) { return n > 0 && n < 100 && SPACES[n] && SPACES[n].rift; }
  function pend(s, n) { s.pendingRift = isRift(n) ? { from: n, to: SPACES[n].rift.to } : null; s.coinVisit = null; }
  function stepBy(d) {
    var from = state.pos, to = Math.max(0, Math.min(100, from + d));
    if (to === from) return;
    commit(function (s) { s.pos = to; pend(s, to); }, { type: 'step', from: from, to: to }, { log: 'Step ' + (d > 0 ? '+' : '') + d + ': ' + from + ' → ' + to + (to === 100 ? ' (GRAND PRIZE)' : '') });
  }
  function moveBy(n) {
    n = Math.round(+n);
    if (!(n >= 0 && n <= 60)) { flash('Enter a movement total from 0 to 60'); return; }
    var from = state.pos;
    if (from >= 100) { flash('Already at 100 — reset the board for a new climb'); return; }
    var landing = Math.min(100, from + n), r = isRift(landing), fin = r ? r.to : landing;
    var extra = [];
    if (r) { var mid = clone(state); mid.pos = landing; mid.pendingRift = { from: landing, to: r.to }; mid.coinVisit = null; extra.push(state, mid); }
    commit(function (s) { s.pos = fin; s.pendingRift = null; if (n > 0) s.coinVisit = null; }, { type: 'move', from: from, n: n, landing: landing, final: fin, rift: !!r },
      { noHistory: !!r, extraHistory: extra, log: (state.customer ? state.customer + ': ' : '') + 'Move ' + n + ': ' + from + ' → ' + landing + (r ? ' · RIFT → ' + fin : '') + (fin >= 100 ? ' (GRAND PRIZE)' : '') + ' · ' + LANE_NAME[state.lane] });
  }
  function jumpTo(n) {
    n = Math.round(+n);
    if (!(n >= 0 && n <= 100)) { flash('Jump target must be 0 (Start) to 100'); return; }
    var from = state.pos; if (n === from) return;
    commit(function (s) { s.pos = n; pend(s, n); }, { type: 'jump', from: from, to: n }, { log: 'Jump ' + from + ' → ' + n });
  }
  function applyRift() {
    var pr = state.pendingRift; if (!pr || pr.from !== state.pos) return;
    commit(function (s) { s.pos = pr.to; s.pendingRift = null; s.coinVisit = null; }, { type: 'rift', from: pr.from, to: pr.to }, { log: 'Rift applied ' + pr.from + ' → ' + pr.to });
  }
  function dismissRift() { if (!state.pendingRift) return; commit(function (s) { s.pendingRift = null; }, { type: 'set' }, { log: 'Rift prompt dismissed on ' + state.pos }); }
  function flipLane() { var to = state.lane === 'MV' ? 'EV' : 'MV'; commit(function (s) { s.lane = to; }, { type: 'flip', to: to }, { log: 'Lane flip → ' + LANE_NAME[to] }); }
  function jace(d) {
    var from = state.meter;
    if (d > 0) {
      var m = from + 1, bonus = m >= 5;
      commit(function (s) { s.meter = bonus ? m - 5 : m; if (bonus) s.bonusTotal = (s.bonusTotal || 0) + 1; }, { type: 'jace', from: from, to: bonus ? m - 5 : m, bonus: bonus }, { log: 'Jace +1 → ' + (bonus ? '5/5 BONUS LEVEL 1 SPIN, meter 0/5' : m + '/5') });
    } else { if (from <= 0) return; commit(function (s) { s.meter = from - 1; }, { type: 'jace', from: from, to: from - 1 }, { log: 'Jace −1 → ' + (from - 1) + '/5' }); }
  }
  function coinFlip(force) {
    var n = state.pos; if (COIN_SPACES.indexOf(n) < 0) { flash('The Reality Coin Flip is only on spaces 60 and 90'); return; }
    if (state.coinVisit && !force) {
      var lastC = state.coins[state.coins.length - 1];
      if (OBS) return;
      confirmBox('Flip again?', 'A coin was already flipped on space ' + n + ' this visit (' + (lastC ? COIN_TEXT[lastC.result].side : '?') + '). Only re-flip if you really want a new result.', 'Flip again', function () { coinFlip(true); });
      return;
    }
    var a = new Uint8Array(1); crypto.getRandomValues(a); var r = (a[0] & 1) ? 'H' : 'T';
    commit(function (s) { s.coins = (s.coins || []).concat([{ space: n, result: r, at: Date.now() }]).slice(-50); s.coinVisit = Date.now(); }, { type: 'coin', space: n, result: r }, { log: 'Coin flip on ' + n + ': ' + COIN_TEXT[r].side + ' — ' + COIN_TEXT[r].prize });
  }
  function setZoom(z) { z = Math.max(1, Math.min(3, Math.round(z * 10) / 10)); if (z === state.zoom) return; commit(function (s) { s.zoom = z; }, { type: 'set' }, { noHistory: true }); }
  function setCustomer(name) { name = String(name || '').trim().slice(0, 40); if (name === state.customer) return; commit(function (s) { s.customer = name; }, { type: 'set' }, { noHistory: true, log: name ? 'Climber: ' + name : 'Climber cleared' }); }
  function undo() {
    var h = loadHistory(); if (!h.length) { flash('Nothing to undo'); return; }
    var prev = h.pop(); try { localStorage.setItem(HKEY, JSON.stringify(h)); } catch (e) { /* ignore */ }
    commit(function (s) { ['pos', 'lane', 'meter', 'bonusTotal', 'customer', 'pendingRift', 'coins', 'coinVisit'].forEach(function (k) { if (k in prev) s[k] = prev[k]; }); }, { type: 'undo' },
      { noHistory: true, log: 'Undo → ' + (prev.pos ? 'space ' + prev.pos : 'Start') + ', ' + LANE_NAME[prev.lane] + ', Jace ' + prev.meter + '/5' });
  }
  function resetBoard(alsoMeter, alsoCustomer) {
    var from = state.pos;
    commit(function (s) { s.pos = 0; s.lane = 'MV'; s.pendingRift = null; s.coinVisit = null; if (alsoMeter) { s.meter = 0; s.bonusTotal = 0; } if (alsoCustomer) s.customer = ''; },
      { type: 'reset', from: from }, { log: 'BOARD RESET → Start, Multiverse' + (alsoMeter ? ', Jace meter 0/5' : ', Jace meter kept') });
  }
  function resetMeter() { commit(function (s) { s.meter = 0; }, { type: 'jace', from: state.meter, to: 0 }, { log: 'Jace meter reset to 0/5' }); }

  // ---------------------------------------------------------------- modal + toast
  function flash(msg) { if (OBS) { console.info('[RFA]', msg); return; } var t = el('div', '', esc(msg)); t.style.cssText = 'position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:300;background:#2a1030;border:1px solid #f8a;padding:10px 16px;border-radius:10px;font:700 14px var(--ui)'; document.body.appendChild(t); setTimeout(function () { t.remove(); }, 2600); }
  var modalOpen = false, modalOk = null;
  function openModal(html, onOpen) { var m = $('modal'); if (!m) return; m.querySelector('.box').innerHTML = html; m.classList.add('show'); modalOpen = true; if (onOpen) onOpen(m); }
  function closeModal() { var m = $('modal'); if (m) m.classList.remove('show'); modalOpen = false; modalOk = null; }
  function confirmBox(title, text, okText, ok) {
    openModal('<h2>' + esc(title) + '</h2><p>' + esc(text) + '</p><div class="row"><button id="mNo">Cancel</button><button class="danger" id="mYes">' + esc(okText) + '</button></div>', function () {
      modalOk = function () { closeModal(); ok(); };
      $('mNo').onclick = closeModal; $('mYes').onclick = modalOk; $('mNo').focus();
    });
  }
  function resetDialog() {
    openModal('<h2>Reset the board?</h2><p>This moves the piece back to <b>Start</b> and the lane to <b>Multiverse</b> for a brand-new climb. Type <b>RESET</b> to confirm.</p>' +
      '<input type="text" id="mTxt" autocomplete="off" placeholder="Type RESET"><label><input type="checkbox" id="mMeter"> Also reset the Empower Jace meter to 0/5 (default: keep it)</label>' +
      '<label><input type="checkbox" id="mCust"> Clear the climber name</label><div class="row"><button id="mNo">Cancel</button><button class="danger" id="mYes" disabled>Reset board</button></div>', function () {
      var txt = $('mTxt'), yes = $('mYes');
      txt.oninput = function () { yes.disabled = txt.value.trim().toUpperCase() !== 'RESET'; };
      modalOk = function () { if (yes.disabled) return; var m = $('mMeter').checked, c = $('mCust').checked; closeModal(); resetBoard(m, c); };
      yes.onclick = modalOk; $('mNo').onclick = closeModal; txt.focus();
    });
  }

  // ---------------------------------------------------------------- wiring
  if (panel) {
    $('cHide').onclick = function () { togglePanel(false); };
    $('cM5').onclick = function () { stepBy(-5); }; $('cM1').onclick = function () { stepBy(-1); };
    $('cP1').onclick = function () { stepBy(1); }; $('cP5').onclick = function () { stepBy(5); };
    $('cMove').onclick = function () { var v = $('cMoveN').value; if (v === '') { flash('Enter the total mana value of the mythics (0 = no movement)'); return; } moveBy(v); $('cMoveN').value = ''; $('cMoveN').blur(); };
    $('cMoveN').onkeydown = function (e) { if (e.key === 'Enter') { e.preventDefault(); $('cMove').click(); } };
    $('cJump').onclick = function () { var v = $('cJumpN').value; if (v === '') return; jumpTo(v); $('cJumpN').value = ''; $('cJumpN').blur(); };
    $('cJumpN').onkeydown = function (e) { if (e.key === 'Enter') { e.preventDefault(); $('cJump').click(); } };
    $('cRiftYes').onclick = applyRift; $('cRiftNo').onclick = dismissRift;
    $('cFlip').onclick = flipLane;
    $('cJp').onclick = function () { jace(1); }; $('cJm').onclick = function () { jace(-1); };
    $('cJr').onclick = function () { confirmBox('Reset Empower Jace?', 'Set the shared Jace meter back to 0/5 (currently ' + state.meter + '/5).', 'Reset meter', resetMeter); };
    $('cCoin').onclick = function () { coinFlip(false); };
    $('cCustSet').onclick = function () { setCustomer($('cCust').value); $('cCust').blur(); };
    $('cCust').onkeydown = function (e) { if (e.key === 'Enter') { e.preventDefault(); $('cCustSet').click(); } };
    $('cZoom').oninput = function () { setZoom(+this.value); };
    $('cUndo').onclick = undo; $('cReset').onclick = resetDialog;
  }
  window.addEventListener('keydown', function (e) {
    if (modalOpen) {
      if (e.key === 'Escape') { e.preventDefault(); closeModal(); }
      else if (e.key === 'Enter' && modalOk) { e.preventDefault(); modalOk(); }
      return;
    }
    var tg = e.target && e.target.tagName;
    if (tg === 'INPUT' || tg === 'TEXTAREA' || tg === 'SELECT') { if (e.key === 'Escape') e.target.blur(); return; }
    if (tg === 'BUTTON' && (e.key === ' ' || e.key === 'Enter')) return;
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); undo(); return; }
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    var k = e.key;
    if (k === 'ArrowRight' || k === ' ') { e.preventDefault(); stepBy(1); }
    else if (k === 'ArrowLeft') { e.preventDefault(); stepBy(-1); }
    else if (k === 'PageUp') { e.preventDefault(); stepBy(5); }
    else if (k === 'PageDown') { e.preventDefault(); stepBy(-5); }
    else if (k === 'Enter') { if (state.pendingRift) { e.preventDefault(); applyRift(); } }
    else if (k === 'Escape') { if (state.pendingRift) dismissRift(); }
    else if (k === 'l' || k === 'L') flipLane();
    else if (k === 'J') jace(-1);
    else if (k === 'j') jace(1);
    else if (k === 'f' || k === 'F') { if (COIN_SPACES.indexOf(state.pos) >= 0) coinFlip(false); }
    else if (k === 'c' || k === 'C') { if (!OBS) togglePanel(); }
    else if (k === '+' || k === '=') setZoom((state.zoom || 1) + 0.1);
    else if (k === '-' || k === '_') setZoom((state.zoom || 1) - 0.1);
    else if ((k === 'm' || k === 'M') && panel) { e.preventDefault(); if (document.body.classList.contains('panel-hidden')) togglePanel(true); $('cMoveN').focus(); }
    else if ((k === 'g' || k === 'G') && panel) { e.preventDefault(); if (document.body.classList.contains('panel-hidden')) togglePanel(true); $('cJumpN').focus(); }
  });

  // test/debug hook used by the automated checks
  window.RFA = { get state() { return clone(state); }, get view() { return clone(view); }, spaces: SPACES, cells: CELLS, centerOf: centerOf, errors: DATA_ERRORS };

  fit(); syncView(); renderAll();
  requestAnimationFrame(fit);
})();
