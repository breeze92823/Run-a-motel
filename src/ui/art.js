// Illustration set for the Upgrades / Hiring / Shop windows.
// Every icon is an inline SVG string (viewBox 0 0 120 100) that scales with CSS.
// Usage: el.innerHTML = art('drip');

// ---------- palette ----------
const O = '#3a2a22', K = '#2b2b2b';
const T = '#2fb3a5', TD = '#1d7f78', MINT = '#9fe3cf', CR = '#fdf3dc', CRD = '#e9d6ad';
const RED = '#e8473f', REDD = '#b8302a', GOLD = '#ffc52e', GOLDD = '#e59b12', GOLDL = '#ffe07a';
const GR = '#5cbf4a', GRD = '#2f8a3a', GRL = '#93dd7f';
const BLUE = '#3d8be0', BLUED = '#2a64ad', BLUEL = '#86bdf2';
const WOOD = '#a86a3b', WOODD = '#7a4a28', WOODL = '#c98b55';
const STEEL = '#cfd6db', STEELD = '#8e9aa3', BLK = '#3b3b40';
const PINK = '#f59ab5', PINKD = '#d9708f';
const SKIN = '#f6c9a0', SKIN_D = '#8d5a3b', SKIN_T = '#e9b385', SKIN_O = '#f2c4a0';
const COFFEE = '#6b3b1f', GLASS = '#e3f4f7', STEAM = '#b9c6cc';
const NAVY = '#2a3a6b', NAVYD = '#1c2850';

// ---------- primitives ----------
let SWK = 1; // stroke multiplier, so scaled groups keep ~3px outlines
const f2 = (v) => +(+v).toFixed(2);
const D = (s, ...v) => s.reduce((a, str, i) => a + str + (i < v.length ? (typeof v[i] === 'number' ? f2(v[i]) : v[i]) : ''), '');
const SA = (w = 3, c = O) => `stroke="${c}" stroke-width="${f2(w * SWK)}" stroke-linejoin="round" stroke-linecap="round"`;
const R = (x, y, w, h, f, rx = 0, a = '', sw = 3, c = O) => `<rect x="${f2(x)}" y="${f2(y)}" width="${f2(w)}" height="${f2(h)}" rx="${f2(rx)}" fill="${f}" ${SA(sw, c)} ${a}/>`;
const Rn = (x, y, w, h, f, rx = 0, a = '') => `<rect x="${f2(x)}" y="${f2(y)}" width="${f2(w)}" height="${f2(h)}" rx="${f2(rx)}" fill="${f}" ${a}/>`;
const C = (x, y, r, f, a = '', sw = 3, c = O) => `<circle cx="${f2(x)}" cy="${f2(y)}" r="${f2(r)}" fill="${f}" ${SA(sw, c)} ${a}/>`;
const Cn = (x, y, r, f, a = '') => `<circle cx="${f2(x)}" cy="${f2(y)}" r="${f2(r)}" fill="${f}" ${a}/>`;
const E = (x, y, rx, ry, f, a = '', sw = 3) => `<ellipse cx="${f2(x)}" cy="${f2(y)}" rx="${f2(rx)}" ry="${f2(ry)}" fill="${f}" ${SA(sw)} ${a}/>`;
const En = (x, y, rx, ry, f, a = '') => `<ellipse cx="${f2(x)}" cy="${f2(y)}" rx="${f2(rx)}" ry="${f2(ry)}" fill="${f}" ${a}/>`;
const P = (d, f, a = '', sw = 3, c = O) => `<path d="${d}" fill="${f}" ${SA(sw, c)} ${a}/>`;
const Pn = (d, f, a = '') => `<path d="${d}" fill="${f}" ${a}/>`;
const L = (d, sw = 3, c = O, a = '') => `<path d="${d}" fill="none" ${SA(sw, c)} ${a}/>`;
const SH = (d, sw = 3, o = 0.7) => `<path d="${d}" fill="none" stroke="#fff" stroke-width="${f2(sw * SWK)}" stroke-linecap="round" stroke-linejoin="round" opacity="${o}"/>`;
const G = (t, b) => `<g transform="${t}">${b}</g>`;
const SC = (t, s, fn) => { const p = SWK; SWK = p / s; const b = fn(); SWK = p; return G(`${t} scale(${s})`, b); };
const TX = (x, y, s, t, f, o = 0) =>
  `<text x="${f2(x)}" y="${f2(y)}" font-size="${f2(s)}" font-family="'Arial Black',Arial,sans-serif" font-weight="900" text-anchor="middle" fill="${f}"${o ? ` stroke="${O}" stroke-width="${f2(o * SWK)}" stroke-linejoin="round" paint-order="stroke"` : ''}>${t}</text>`;
const shadow = (cx = 60, cy = 92, rx = 40, ry = 5) => En(cx, cy, rx, ry, 'rgba(0,0,0,.15)');
const svg = (body, defs = '') =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 100" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">${defs ? `<defs>${defs}</defs>` : ''}${body}</svg>`;
const rad = (id, c1, c2) => `<radialGradient id="${id}" cx=".38" cy=".32" r=".75"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></radialGradient>`;

// ---------- shapes ----------
const starPts = (cx, cy, r1, r2, n = 5) => {
  const s = [];
  for (let i = 0; i < n * 2; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / n, r = i % 2 ? r2 : r1;
    s.push(f2(cx + r * Math.cos(a)) + ',' + f2(cy + r * Math.sin(a)));
  }
  return s.join(' ');
};
const STAR = (cx, cy, r, f = GOLD, sw = 3) => `<polygon points="${starPts(cx, cy, r, r * 0.48)}" fill="${f}" ${SA(sw)}/>`;
const SPARK = (cx, cy, s, f = GOLD, sw = 2.5) => {
  const k = s * 0.2;
  return P(D`M${cx} ${cy - s} Q${cx + k} ${cy - k} ${cx + s} ${cy} Q${cx + k} ${cy + k} ${cx} ${cy + s} Q${cx - k} ${cy + k} ${cx - s} ${cy} Q${cx - k} ${cy - k} ${cx} ${cy - s} Z`, f, '', sw);
};
const BOLT = (x, y, s = 1, f = GOLD) =>
  `<polygon points="${[12, 0, 2, 17, 9, 17, 6, 30, 18, 11, 11, 11, 14, 0].map((v, i) => f2(i % 2 ? y + v * s : x + v * s)).join(' ')}" fill="${f}" ${SA(3)}/>`;
const moon = (cx, cy, r, f = GOLD) => {
  const tx = cx + r * 0.5, t1 = cy - r * 0.866, t2 = cy + r * 0.866, r2 = r * 1.23;
  return P(D`M${tx} ${t1} A${r} ${r} 0 1 0 ${tx} ${t2} A${r2} ${r2} 0 0 1 ${tx} ${t1} Z`, f) + SH(D`M${cx - r * 0.7} ${cy - r * 0.2} Q${cx - r * 0.6} ${cy - r * 0.6} ${cx - r * 0.25} ${cy - r * 0.75}`, 2.5, 0.6);
};

// banknote, centred on x,y
const bill = (x, y, rot = 0, w = 26, h = 14) =>
  G(`translate(${f2(x)} ${f2(y)}) rotate(${rot})`,
    R(-w / 2, -h / 2, w, h, GR, 2, '', 2.5) +
    `<rect x="${f2(-w / 2 + 3)}" y="${f2(-h / 2 + 2.5)}" width="${f2(w - 6)}" height="${f2(h - 5)}" rx="1.5" fill="none" stroke="${GRD}" stroke-width="${f2(1.4 * SWK)}"/>` +
    Cn(0, 0, h * 0.3, GRL) + TX(0, h * 0.17, h * 0.48, '$', GRD));

// gold coin with thick rim
const coin = (cx, cy, r = 9) => {
  const sw = r < 8 ? 2.5 : 3;
  return C(cx, cy + r * 0.22, r, GOLDD, '', sw) + C(cx, cy, r, GOLD, '', sw) +
    `<circle cx="${f2(cx)}" cy="${f2(cy)}" r="${f2(r * 0.7)}" fill="none" stroke="${GOLDD}" stroke-width="${f2(Math.max(1.4, r * 0.11) * SWK)}"/>` +
    TX(cx, cy + r * 0.37, r * 1.05, '$', GOLDD) +
    SH(D`M${cx - r * 0.62} ${cy - r * 0.1} Q${cx - r * 0.55} ${cy - r * 0.55} ${cx - r * 0.15} ${cy - r * 0.68}`, Math.max(1.5, r * 0.16), 0.85);
};

// stack of banknotes in 3/4 view; x,y = front bottom-left
const stack = (x, y, w = 44, n = 4, band = GOLD) => {
  const top = y - 8 - (n - 1) * 6;
  let s = P(D`M${x + w} ${top} L${x + w + 7} ${top - 7} L${x + w + 7} ${y - 7} L${x + w} ${y} Z`, GRD, '', 2.5);
  for (let i = 0; i < n; i++) {
    const yy = y - 8 - i * 6;
    s += R(x, yy, w, 8, GR, 2, '', 2.5) + Rn(x + 3, yy + 2, w - 6, 1.8, GRL, 0.9);
  }
  s += P(D`M${x} ${top} L${x + 7} ${top - 7} L${x + w + 7} ${top - 7} L${x + w} ${top} Z`, GRL, '', 2.5);
  s += En(x + w * 0.24 + 3.5, top - 3.5, 4.5, 2, GR);
  s += R(x + w / 2 - 5, top, 10, y - top, band, 0, '', 2.5);
  s += P(D`M${x + w / 2 - 5} ${top} L${x + w / 2 + 2} ${top - 7} L${x + w / 2 + 12} ${top - 7} L${x + w / 2 + 5} ${top} Z`, band, '', 2.5);
  return s;
};

// gold up arrow, tip at (cx,t), total height 2s
const arrow = (cx, t, s) =>
  P(D`M${cx} ${t} L${cx + s} ${t + s} L${cx + s * 0.45} ${t + s} L${cx + s * 0.45} ${t + s * 2} L${cx - s * 0.45} ${t + s * 2} L${cx - s * 0.45} ${t + s} L${cx - s} ${t + s} Z`, GOLD) +
  Pn(D`M${cx} ${t + 3} L${cx + s - 3.6} ${t + s - 1.5} L${cx + s * 0.45 - 1.5} ${t + s - 1.5} L${cx + s * 0.45 - 1.5} ${t + s * 2 - 1.5} L${cx} ${t + s * 2 - 1.5} Z`, GOLDD) +
  SH(D`M${cx - s * 0.62} ${t + s * 0.72} L${cx - 2} ${t + 4}`, 2.5, 0.8);

// gift box; x,y top-left of lid area
const gift = (x, y, w, h, col = RED, rib = GOLD, dark = REDD) => {
  const ly = y + h * 0.26, lh = h * 0.2, by = ly + lh - 1, bh = y + h - by, cx = x + w / 2, rw = w * 0.18;
  return R(x, by, w, bh, col, 3) + Rn(x + w - 9, by + 3, 6, bh - 6, dark, 2) +
    R(cx - rw / 2, by, rw, bh, rib, 0, '', 2.5) +
    P(D`M${cx} ${ly} C${cx - w * 0.42} ${ly - h * 0.34} ${cx - w * 0.44} ${ly + h * 0.04} ${cx} ${ly} Z`, rib, '', 2.5) +
    P(D`M${cx} ${ly} C${cx + w * 0.42} ${ly - h * 0.34} ${cx + w * 0.44} ${ly + h * 0.04} ${cx} ${ly} Z`, rib, '', 2.5) +
    R(x - 3, ly, w + 6, lh, col, 3) + R(cx - rw / 2, ly, rw, lh, rib, 0, '', 2.5) +
    SH(D`M${x + 2} ${ly + 4} H${cx - rw}`, 2.5, 0.5);
};

// front-loading washing machine
const washer = (x, y, w, h) => {
  const cx = x + w / 2, top = y + 13, cy = top + (h - 13) / 2, r = Math.min(w - 10, h - 19) / 2, ri = r - 5;
  return R(x, y, w, h, '#f4f6f7', 7) + Rn(x + w - 9, y + 4, 5, h - 8, '#d7dde2', 2.5) +
    L(D`M${x + 1.5} ${top} H${x + w - 1.5}`, 2.5) +
    R(x + 6, y + 4, w * 0.32, 5.5, '#7cc6f0', 2, '', 2) +
    C(x + w - 11, y + 6.8, 3, STEELD, '', 2) + Cn(x + w - 19, y + 6.8, 2, RED) +
    C(cx, cy, r, STEEL) + Cn(cx, cy, ri, '#bfe6fb') +
    Pn(D`M${cx - ri} ${cy + 1} Q${cx - ri / 2} ${cy - 3} ${cx} ${cy + 1} Q${cx + ri / 2} ${cy + 5} ${cx + ri} ${cy + 1} A${ri} ${ri} 0 0 1 ${cx - ri} ${cy + 1} Z`, BLUE) +
    C(cx, cy, ri, 'none', '', 2.5) +
    SH(D`M${cx - ri * 0.6} ${cy - ri * 0.35} Q${cx - ri * 0.45} ${cy - ri * 0.7} ${cx - ri * 0.1} ${cy - ri * 0.75}`, 2.5, 0.9);
};

// small two-storey motel, local box ~ (-2..92, -4..72)
const motel = () =>
  P('M72 40 L92 72 L84 72 L72 52 Z', WOOD) + L('M76 47 H80 M80 53 H84 M84 59 H88 M88 65 H91', 2) + L('M72 34 L94 66', 2) +
  R(2, 16, 70, 56, CR, 2) + Rn(61, 19, 8, 51, CRD, 1) +
  R(-2, 12, 78, 6, TD, 3) +
  R(10, 21, 11, 15, T, 1.5, '', 2.5) + R(40, 21, 11, 15, T, 1.5, '', 2.5) +
  R(25, 23, 11, 8, MINT, 1.5, '', 2.5) + R(55, 23, 11, 8, MINT, 1.5, '', 2.5) +
  L('M4 30 H70 M12 30 V38 M24 30 V38 M36 30 V38 M48 30 V38 M60 30 V38', 2) +
  R(2, 38, 70, 4, T, 1, '', 2.5) +
  R(10, 47, 11, 23, T, 1.5, '', 2.5) + R(40, 47, 11, 23, T, 1.5, '', 2.5) +
  R(25, 50, 11, 10, MINT, 1.5, '', 2.5) + R(55, 50, 11, 10, MINT, 1.5, '', 2.5) +
  Cn(19, 59, 1.4, GOLD) + Cn(49, 59, 1.4, GOLD) +
  L('M24 12 V6 M50 12 V6', 3) + R(13, -4, 48, 12, RED, 3) + TX(37, 5.4, 8, 'MOTEL', CR);

// ---------- characters ----------
const neck = (skin, cx = 60, top = 60) => R(cx - 6, top - 10, 12, 14, skin, 4);
const torso = (col, shade, cx = 60, top = 60, w = 30) =>
  P(D`M${cx - w} 104 L${cx - w + 2} ${top + 12} Q${cx - w + 4} ${top} ${cx - 12} ${top} L${cx + 12} ${top} Q${cx + w - 4} ${top} ${cx + w - 2} ${top + 12} L${cx + w} 104 Z`, col) +
  Pn(D`M${cx + w - 10} ${top + 3} Q${cx + w - 4} ${top + 4} ${cx + w - 3.2} ${top + 13} L${cx + w - 1.6} 100 L${cx + w - 11} 100 Z`, shade);
const head = (cx, cy, skin, r = 18) =>
  C(cx - r + 1, cy + 3, 4.5, skin) + C(cx + r - 1, cy + 3, 4.5, skin) + C(cx, cy, r, skin) +
  Pn(D`M${cx + r * 0.2} ${cy + r * 0.92} Q${cx + r * 0.9} ${cy + r * 0.6} ${cx + r * 0.93} ${cy} Q${cx + r * 0.72} ${cy + r * 0.62} ${cx + r * 0.2} ${cy + r * 0.92} Z`, 'rgba(0,0,0,.08)');
const eyes = (cx, cy, dx = 6.5) => Cn(cx - dx, cy, 2.7, K) + Cn(cx + dx, cy, 2.7, K) + Cn(cx - dx - 0.8, cy - 1, 1, '#fff') + Cn(cx + dx - 0.8, cy - 1, 1, '#fff');
const cheeks = (cx, cy) => En(cx - 11, cy, 3.4, 2.2, '#f28b82', 'opacity=".7"') + En(cx + 11, cy, 3.4, 2.2, '#f28b82', 'opacity=".7"');
const smile = (cx, cy, w = 5) => L(D`M${cx - w} ${cy} Q${cx} ${cy + 4.5} ${cx + w} ${cy}`, 2.4);
const feat = (cx, cy) => eyes(cx, cy + 2) + cheeks(cx, cy + 8) + smile(cx, cy + 9);
const hand = (x, y, skin = SKIN) => C(x, y, 5.5, skin, '', 2.5);
const thickLine = (d, c, w = 6) => L(d, w) + L(d, w - 3, c);

const HAIR_R = '#e0612f', HAIR_B = '#7a4a28', HAIR_J = '#2b2230';

const roseFig = (prop) =>
  E(84, 32, 7.5, 13, HAIR_R, 'transform="rotate(-28 84 32)"') +
  neck(SKIN) + torso(PINK, PINKD) +
  P('M44 70 L76 70 L80 104 L40 104 Z', '#fff') + L('M46 70 L50 61 M74 70 L70 61', 2.5) +
  R(53, 80, 14, 9, '#fff', 2, '', 2) +
  P('M50 60 L60 67 L70 60 Z', '#fff', '', 2.5) +
  head(60, 36, SKIN) +
  P('M41 40 Q37 15 60 15 Q83 15 79 40 Q78 29 71 25 Q61 30 50 26 Q44 30 41 40 Z', HAIR_R) +
  Pn('M66 18 Q78 21 79 34 Q76 26 70 24 Z', '#c24d22') +
  P('M78 20 L70 14 L71 26 Z', RED, '', 2.5) + P('M78 20 L86 13 L87 26 Z', RED, '', 2.5) + C(78, 20, 3, RED, '', 2.5) +
  feat(60, 38) + prop;

const roseDuster =
  thickLine('M34 90 L22 52', WOOD) +
  P('M10 46 Q5 36 14 32 Q16 23 24 26 Q33 24 32 34 Q37 42 29 48 Q20 55 10 46 Z', '#a9dcf7') +
  Pn('M14 36 Q17 28 23 30 Q18 32 16 38 Z', '#e1f3fd') + L('M15 44 L22 36 M22 47 L27 38', 2, '#6fb7e0') +
  hand(33, 86) +
  L('M93 78 Q103 62 113 78', 3) + R(93, 62, 9, 18, '#fff', 3, '', 2.5) + R(94, 57, 7, 6, RED, 1.5, '', 2.5) +
  R(104, 67, 8, 13, MINT, 3, '', 2.5) +
  R(88, 78, 30, 22, GOLD, 3) + Rn(108, 81, 7, 16, GOLDD, 2) + SH('M92 83 H102', 2.5, 0.6);

const roseMop =
  thickLine('M84 46 L102 94', WOOD) +
  P('M92 90 Q103 85 112 90 L116 100 L88 100 Z', '#ece6d6') + L('M95 92 L93 99 M101 91 L101 99 M107 92 L109 99', 2, '#b5ab92') +
  hand(93, 72);

const gusFig = (lantern = true) =>
  neck(SKIN_O, 60, 62) + torso(NAVY, NAVYD, 60, 62) +
  P('M50 62 L60 72 L70 62 Z', '#fff', '', 2.5) +
  R(32, 64, 13, 5, GOLD, 2.5, '', 2) + R(75, 64, 13, 5, GOLD, 2.5, '', 2) +
  C(60, 80, 2.4, GOLD, '', 1.5) + C(60, 90, 2.4, GOLD, '', 1.5) +
  head(60, 38, SKIN_O) +
  P('M42 33 Q39 44 45 49 L47 34 Z', '#d3d7da', '', 2.5) + P('M78 33 Q81 44 75 49 L73 34 Z', '#d3d7da', '', 2.5) +
  P('M38 23 Q36 9 60 8 Q84 9 82 23 Z', NAVY) + Pn('M70 11 Q81 13 81 22 L74 22 Q74 15 70 11 Z', NAVYD) +
  R(40, 20, 40, 6, GOLD, 1, '', 2.5) + P('M40 26 Q60 34 80 26 Z', K, '', 2.5) + STAR(60, 15, 4, GOLD, 1.5) +
  eyes(60, 40) + L('M49 35.5 Q53 33 57 35.5 M63 35.5 Q67 33 71 35.5', 2.6, '#8c949a') +
  cheeks(60, 45) +
  P('M49 47 Q54 42 60 45 Q66 42 71 47 Q67 52 60 49 Q53 52 49 47 Z', '#e3e6e9', '', 2.5) +
  L('M57 53 Q60 55 63 53', 2) +
  (lantern
    ? Cn(98, 80, 17, '#ffe39a', 'opacity=".5"') + L('M90 64 Q98 52 106 64', 3) + R(90, 63, 16, 5, K, 2, '', 2.5) +
      R(91, 68, 14, 18, '#fff4c2', 2, '', 2.5) + P('M98 71 Q103 77 98 83 Q93 77 98 71 Z', GOLDD, '', 1.5) +
      R(89, 86, 18, 5, K, 2, '', 2.5) + hand(98, 57, SKIN_O)
    : '');

const lampBody = () =>
  Cn(60, 48, 34, '#ffe9a0', 'opacity=".45"') +
  R(36, 80, 48, 10, GOLDD, 4) +
  P('M38 82 L38 40 Q38 16 60 16 Q82 16 82 40 L82 82 Z', GOLD) +
  Pn('M73 22 Q81 29 81 40 L81 81 L75 81 L75 40 Q75 30 73 22 Z', GOLDD) +
  P('M46 76 L46 42 Q46 26 60 26 Q74 26 74 42 L74 76 Z', '#fff4c2', '', 2.5) +
  L('M53 36 V72', 3.5, RED) + L('M60 32 V72', 3.5, T) + L('M67 36 V72', 3.5, RED) +
  C(60, 12, 5, RED) + Cn(58.5, 10.5, 1.5, '#fff') +
  SH('M42 70 V42 Q42 27 52 21', 3, 0.6);

const bandanaBody = () =>
  P('M20 34 Q8 26 4 30 Q8 37 18 38 Z', T, '', 2.5) + P('M20 35 Q10 41 8 47 Q16 45 22 39 Z', T, '', 2.5) +
  P('M24 36 Q60 46 96 36 L60 88 Z', T) +
  Pn('M60 86 L94 38 Q89 40 84 41 L60 78 Z', TD) +
  Cn(44, 46, 3, '#fff') + Cn(63, 49, 3, '#fff') + Cn(80, 44, 2.6, '#fff') + Cn(54, 61, 3, '#fff') + Cn(68, 63, 2.6, '#fff') + Cn(60, 76, 2.4, '#fff') +
  R(16, 28, 88, 11, TD, 5.5) + SH('M24 31.5 H70', 2.5, 0.5);

const medal = (id, base, dark, light, inner) =>
  svg(shadow(60, 94, 30, 4) + C(60, 54, 38, dark) + C(60, 54, 31, `url(#${id}-g)`, '', 2.5) +
    SH('M27.6 42.2 A34.5 34.5 0 0 1 48.2 21.6', 3, 0.55) + inner,
  rad(`${id}-g`, light, base));

// ---------- icons ----------
const ICONS = {
  // ===== Upgrades: food =====
  hotdog: () => svg(
    shadow(60, 90, 44, 5) +
    P('M14 58 Q12 44 28 42 L92 42 Q108 44 106 58 Q104 72 88 72 L32 72 Q16 72 14 58 Z', '#e8a650') +
    P('M10 52 Q10 44 20 44 L100 44 Q110 44 110 52 Q110 60 100 60 L20 60 Q10 60 10 52 Z', '#c2452c') +
    SH('M22 48 H96', 2.5, 0.45) +
    L('M22 52 Q30 46 38 52 T54 52 T70 52 T86 52 T100 52', 3.5, '#ffd23f') +
    P('M16 60 Q22 80 60 80 Q98 80 104 60 Q98 70 60 70 Q22 70 16 60 Z', '#f2c06e')),
  burger: () => svg(
    shadow(60, 92, 40, 5) +
    P('M22 46 Q24 14 60 14 Q96 14 98 46 Z', '#efab4f') +
    Cn(46, 26, 2, '#fff5d6') + Cn(60, 21, 2, '#fff5d6') + Cn(74, 27, 2, '#fff5d6') + Cn(54, 33, 2, '#fff5d6') +
    P('M18 50 Q30 44 40 52 Q50 44 60 52 Q70 44 80 52 Q90 44 102 50 L100 56 L20 56 Z', GR) +
    P('M24 54 L96 54 L104 64 L16 64 Z', GOLD) +
    R(18, 60, 84, 12, '#7a3b1f', 6) +
    P('M22 74 L98 74 Q98 86 86 86 L34 86 Q22 86 22 74 Z', '#efab4f')),
  // ===== Upgrades: coffee =====
  drip: () => svg(
    shadow(58, 91, 40, 5) +
    R(72, 14, 22, 74, BLK, 5) + Rn(76, 30, 4, 44, '#5a5a62', 2) +
    R(20, 78, 76, 11, BLK, 5) + En(43, 79, 19, 3, STEELD) +
    R(24, 10, 70, 18, BLK, 6) + Rn(28, 21, 62, 3, STEEL, 1.5) + SH('M30 15 H56', 2.5, 0.35) +
    R(39, 28, 10, 7, STEELD, 2) +
    P('M28 46 L58 46 L62 73 Q62 80 55 80 L31 80 Q24 80 24 73 Z', GLASS) +
    Pn('M26 60 L60 60 L61.5 73 Q61.5 79 55 79 L31 79 Q24.5 79 24.5 73 Z', COFFEE) +
    Pn('M26 60 L60 60 L60.6 64 L25.4 64 Z', '#8a5230') +
    L('M28 46 L58 46 L62 73 Q62 80 55 80 L31 80 Q24 80 24 73 Z') +
    L('M59 52 Q70 50 68 64 Q67 70 61 71', 4.5) +
    SH('M31 50 L29 72', 3, 0.75) +
    R(26, 40, 34, 7, BLK, 3) +
    C(83, 70, 3.6, RED, '', 2.5) + Cn(82, 68.8, 1.2, '#fff')),

  autoMachine: () => svg(
    shadow(60, 92, 36, 5) +
    P('M40 24 L44 9 L76 9 L80 24 Z', GLASS) +
    En(52, 19, 4.5, 2.6, COFFEE, 'transform="rotate(-20 52 19)"') + En(62, 20, 4.5, 2.6, COFFEE, 'transform="rotate(15 62 20)"') +
    En(70, 17, 4, 2.4, COFFEE, 'transform="rotate(-10 70 17)"') + En(57, 14, 4, 2.4, COFFEE, 'transform="rotate(25 57 14)"') +
    L('M40 24 L44 9 L76 9 L80 24 Z') +
    R(41, 4, 38, 7, BLK, 3) +
    R(28, 22, 64, 68, '#d5dce0', 7) + Rn(80, 27, 8, 58, '#b0bac1', 4) + Rn(32, 27, 4, 58, '#fff', 2, 'opacity=".6"') +
    R(36, 32, 46, 48, BLK, 5) +
    R(41, 37, 22, 13, BLUE, 2.5, '', 2.5) + Rn(43.5, 39.5, 9, 3, BLUEL, 1.5) +
    C(73, 40, 3, RED, '', 2) + C(73, 48, 3, GOLD, '', 2) +
    R(52, 54, 14, 6, STEELD, 2, '', 2.5) + Rn(58, 60, 2, 5, COFFEE) +
    P('M50 65 L68 65 L66 77 Q66 79 64 79 L54 79 Q52 79 52 77 Z', '#fff', '', 2.5) + L('M68 68 Q74 69 67 75', 2.5) +
    R(40, 79, 38, 5, STEELD, 2, '', 2.5)),

  barista: () => svg(
    shadow(56, 91, 52, 5) +
    P('M4 28 L28 28 L24 48 L8 48 Z', GLASS) +
    En(13, 41, 3.5, 2.2, COFFEE) + En(20, 42, 3.5, 2.2, COFFEE) + En(16, 36, 3.5, 2.2, COFFEE) +
    L('M4 28 L28 28 L24 48 L8 48 Z') + R(6, 24, 20, 5, BLK, 2) +
    R(8, 48, 16, 38, BLK, 4) + Rn(11, 52, 3, 30, '#5a5a62', 1.5) + R(12, 62, 8, 5, STEELD, 1.5, '', 2) +
    R(5, 84, 22, 5, STEELD, 2, '', 2.5) +
    R(30, 22, 76, 10, STEEL, 4) + SH('M35 25.5 H72', 2, 0.85) +
    R(32, 31, 72, 55, RED, 6) + Rn(92, 35, 8, 47, REDD, 4) + Rn(36, 35, 4, 40, '#fff', 2, 'opacity=".35"') +
    C(68, 40, 6, '#fff', '', 2.5) + L('M68 40 L71 37', 2) +
    R(36, 48, 64, 7, STEEL, 3, '', 2.5) +
    R(43, 55, 10, 5, STEELD, 2, '', 2.5) + R(83, 55, 10, 5, STEELD, 2, '', 2.5) +
    R(40, 60, 16, 5, STEEL, 2, '', 2.5) + R(80, 60, 16, 5, STEEL, 2, '', 2.5) +
    thickLine('M40 63 L33 68', '#4a4a50', 7) + thickLine('M96 63 L104 68', '#4a4a50', 7) +
    R(43, 68, 10, 9, '#fff', 2, '', 2.5) + R(83, 68, 10, 9, '#fff', 2, '', 2.5) +
    R(38, 77, 60, 6, STEELD, 2, '', 2.5)),

  // ===== Upgrades: rooms =====
  door: () => svg(
    R(30, 6, 58, 84, WOOD, 3) + Rn(33, 9, 4, 78, WOODL, 1.5) +
    Rn(37, 13, 44, 77, '#ffe39a') +
    P('M37 13 L73 17 L73 88 L37 90 Z', T) + Pn('M65 16.2 L73 17 L73 88 L65 88.4 Z', TD) +
    P('M42 22 L67 24.6 L67 46 L42 46 Z', '#45c7b8', '', 2, TD) + P('M42 54 L67 54 L67 80 L42 81 Z', '#45c7b8', '', 2, TD) +
    R(48, 30, 14, 10, GOLD, 2, '', 2.5) + TX(55, 38, 8, '7', O) +
    Pn('M73 88 L81 90 L98 98 L80 98 Z', '#ffe39a', 'opacity=".55"') +
    P('M24 90 L86 90 L94 98 L16 98 Z', PINK) + L('M22 94 H88', 2, PINKD) +
    G('rotate(10 69 57)', L('M69 57 L69 63', 1.8) + R(62, 62, 14, 20, CR, 3, '', 2.5) + Cn(69, 66, 1.6, O) + Rn(65, 70, 8, 2.5, RED, 1) + Rn(65, 75, 6, 2.5, RED, 1)) +
    C(69, 57, 3.2, GOLD, '', 2.5) + SH('M34 11 H84', 2, 0.5)),

  towels: () => {
    const towel = (x, y, w, h, c, d) =>
      R(x, y, w, h, c, h / 2) + Rn(x + 5, y + h - 7, w - 10, 4, d, 2) +
      `<path d="M${x + 9} ${y + h * 0.5} H${x + w - 9}" fill="none" stroke="${d}" stroke-width="2" stroke-linecap="round" stroke-dasharray="3 4"/>` +
      L(`M${x + w - 14} ${y + 3} Q${x + w - 18} ${y + h / 2} ${x + w - 14} ${y + h - 3}`, 2, d) +
      SH(`M${x + 9} ${y + 4.5} H${x + w * 0.5}`, 2.5, 0.65);
    return svg(shadow(60, 92, 46, 5) +
      towel(18, 70, 84, 20, RED, REDD) + towel(22, 51, 76, 20, CR, CRD) + towel(26, 32, 68, 20, T, TD) +
      SPARK(100, 22, 7) + SPARK(16, 40, 4.5));
  },

  floor2: () => svg(shadow(62, 89, 50, 5) + G('translate(14 16)', motel())),

  // ===== Upgrades: ads =====
  flyers: () => svg(
    shadow(62, 93, 32, 4) +
    G('rotate(-9 52 50)', R(26, 16, 50, 66, MINT, 3) + Rn(32, 24, 38, 8, T, 2) + L('M33 44 H68 M33 52 H62 M33 60 H66', 2.5, '#5fb9a4')) +
    G('rotate(5 68 52)',
      R(42, 18, 52, 68, CR, 3) + Rn(48, 27, 40, 7, RED, 2) +
      R(48, 42, 6, 22, WOOD, 2, '', 2.5) + R(53, 52, 31, 8, T, 2, '', 2.5) + E(60, 49, 5, 3, '#fff', '', 2) +
      L('M55 60 V64 M82 60 V64', 3) + STAR(80, 41, 6, GOLD, 2) +
      L('M50 72 H86 M50 78 H76', 2.5, '#cdbb9b')) +
    C(68, 20, 5.5, RED, '', 2.5) + Cn(66.3, 18.3, 1.8, '#fff')),

  radio: () => svg(
    shadow(60, 92, 40, 5) +
    R(32, 84, 10, 6, WOODD, 2, '', 2.5) + R(78, 84, 10, 6, WOODD, 2, '', 2.5) +
    P('M26 86 L26 46 Q26 22 60 22 Q94 22 94 46 L94 86 Z', WOOD) +
    Pn('M28.5 76 H91.5 V84.5 H28.5 Z', WOODD) +
    SH('M32 46 Q34 30 52 26', 3, 0.45) +
    C(50, 56, 16, '#f1e2c0') +
    `<circle cx="50" cy="56" r="11" fill="none" stroke="${WOODD}" stroke-width="2"/><circle cx="50" cy="56" r="6" fill="none" stroke="${WOODD}" stroke-width="2"/>` +
    Cn(50, 56, 2, WOODD) +
    C(80, 47, 6.5, CR, '', 2.5) + L('M80 47 L80 42.5', 2) + C(80, 65, 6.5, CR, '', 2.5) + L('M80 65 L84 62', 2) +
    L('M18 36 Q12 44 18 52', 4, T) + L('M11 30 Q2 44 11 58', 4, T) +
    L('M102 36 Q108 44 102 52', 4, T) + L('M109 30 Q118 44 109 58', 4, T)),

  billboard: () => {
    let bulbs = '';
    for (let x = 22; x <= 78; x += 11.2) bulbs += C(x, 33, 2.2, GOLD, '', 1.5) + C(x, 51, 2.2, GOLD, '', 1.5);
    bulbs += C(92, 33, 2.2, GOLD, '', 1.5) + C(92, 51, 2.2, GOLD, '', 1.5) + C(101, 42, 2.2, GOLD, '', 1.5);
    return svg(
      shadow(58, 93, 32, 4) +
      R(31, 56, 6, 36, STEELD, 2) + R(65, 56, 6, 36, STEELD, 2) +
      L('M48 28 V14', 3) +
      P('M14 28 L80 28 L80 16 L110 42 L80 68 L80 56 L14 56 Q6 42 14 28 Z', RED) +
      Pn('M10.5 49 L80 49 L80 54.5 L14.8 54.5 Q12 52 10.5 49 Z', REDD) +
      L('M18 33.5 L85 33.5 L85 28 L101 42 L85 56 L85 50.5 L18 50.5 Q13 42 18 33.5 Z', 2, CR) +
      bulbs + TX(50, 46.5, 12, 'MOTEL', CR, 2.5) +
      STAR(48, 12, 9) + SPARK(30, 12, 4) + SPARK(68, 8, 3.5));
  },

  // ===== Staff =====
  lou: () => svg(
    neck(SKIN) + torso(T, TD) + P('M50 60 L60 69 L70 60 Z', '#fff', '', 2.5) +
    head(60, 36, SKIN) +
    Pn('M43 36 Q41 28 45 25 L48 36 Z', HAIR_B) + Pn('M77 36 Q79 28 75 25 L72 36 Z', HAIR_B) +
    P('M41 31 Q41 13 60 13 Q79 13 79 31 Z', T) + Pn('M66 16 Q77 19 77.5 29 L71 29 Q71 21 66 16 Z', TD) + SH('M48 21 Q52 16.5 58 15.5', 2.5, 0.6) +
    P('M37 31 Q60 25 83 31 Q85 36 79 36 Q60 32 41 36 Q35 36 37 31 Z', TD) + C(60, 13.5, 2.2, TD, '', 2) +
    feat(60, 37) +
    R(32, 62, 26, 12, MINT, 4, '', 2.5) + R(56, 60, 30, 14, CR, 4, '', 2.5) + SH('M60 64 H76', 2, 0.7) +
    P('M28 74 L92 74 L86 104 L34 104 Z', '#fff') + L('M44 80 L46 100 M60 80 V100 M76 80 L74 100', 2, '#c9d1d6') +
    R(24, 68, 72, 9, '#eef2f4', 4.5) +
    hand(26, 76) + hand(94, 76)),

  rose: () => svg(roseFig(roseDuster)),

  mia: () => svg(
    R(40, 22, 40, 40, HAIR_B, 16) +
    neck(SKIN) + torso(T, TD) + P('M50 60 L60 68 L70 60 Z', '#fff', '', 2.5) +
    P('M44 70 L76 70 L80 104 L40 104 Z', WOOD) + Pn('M70 72 L76 72 L79.5 101 L73 101 Z', WOODD) + L('M46 70 L52 61 M74 70 L68 61', 2.5) +
    head(60, 36, SKIN) +
    P('M42 36 Q40 15 60 15 Q80 15 78 36 Q72 25 62 24 Q60 30 50 28 Q45 30 42 36 Z', HAIR_B) + SH('M48 21 Q54 17 62 17.5', 2.5, 0.35) +
    feat(60, 38) +
    L('M84 64 Q80 58 84 52 Q88 46 84 40', 3.5, STEAM) + L('M92 64 Q88 58 92 52', 3.5, STEAM) +
    P('M76 70 L98 70 L96 92 Q95 96 91 96 L83 96 Q79 96 78 92 Z', '#fff') +
    Pn('M76.6 77 L97.4 77 L96.9 83 L77.1 83 Z', RED) +
    L('M98 74 Q106 75 103 83 Q101 88 96 87', 3.5) + E(87, 70, 11, 2.5, COFFEE, '', 2) +
    hand(76, 88)),

  sam: () => svg(
    neck(SKIN_D) + torso('#fff', '#e3e7ea') +
    P('M31 104 L32 72 Q34 61 48 60 L56 86 L56 104 Z', RED) + P('M89 104 L88 72 Q86 61 72 60 L64 86 L64 104 Z', RED) +
    Pn('M80 64 Q86 64 87 72 L88 100 L82 100 Z', REDD) +
    C(52, 90, 2.4, GOLD, '', 1.5) + C(68, 90, 2.4, GOLD, '', 1.5) + C(52, 98, 2.4, GOLD, '', 1.5) + C(68, 98, 2.4, GOLD, '', 1.5) +
    P('M60 64 L49 58 L49 70 Z', T, '', 2.5) + P('M60 64 L71 58 L71 70 Z', T, '', 2.5) + C(60, 64, 3, TD, '', 2.5) +
    head(60, 36, SKIN_D) +
    P('M42 32 Q41 16 60 16 Q79 16 78 32 Q70 24 60 25 Q50 24 42 32 Z', '#2b2018') +
    feat(60, 38) +
    `<circle cx="22" cy="55" r="6" fill="none" ${SA(6.5)}/><circle cx="22" cy="55" r="6" fill="none" ${SA(3, GOLD)}/>` +
    thickLine('M24 61 L31 80', GOLD) + L('M27.5 71 L31.5 69.5 M29 75 L33 73.5', 3, O) +
    hand(32, 82, SKIN_D) +
    R(86, 92, 30, 5, STEELD, 2, '', 2.5) + P('M88 92 Q88 76 101 76 Q114 76 114 92 Z', GOLD) +
    Pn('M104 77 Q113 80 113.5 91 L107 91 Q107 82 104 77 Z', GOLDD) +
    C(101, 73.5, 2.6, GOLD, '', 2) + SH('M93 87 Q93 81 97 79', 2.5, 0.8)),

  coby: () => svg(
    neck(SKIN_T) + torso(SKIN_T, '#d39a6c') +
    P('M40 104 L42 66 Q47 61 51 62 Q60 74 69 62 Q73 61 78 66 L80 104 Z', RED) + Pn('M72 66 L78 66 L79.6 101 L74 101 Z', REDD) +
    L('M52 62 Q56 72 60 74 Q64 72 68 62', 1.6, '#fff') + R(56, 73, 8, 5, GOLD, 2, '', 2) +
    head(60, 36, SKIN_T) +
    P('M44 28 Q41 16 50 17 Q53 10 60 13 Q67 10 70 17 Q79 16 76 28 Z', '#f2c14e') +
    R(41, 25, 38, 6, '#fff', 3, '', 2.5) +
    P('M40 29 Q60 22 80 29 Q90 33 82 37 Q60 30 38 37 Q30 33 40 29 Z', '#fff') + Pn('M44 33.5 Q60 29 78 33.5 Q60 31 44 34.5 Z', '#dde3e6') +
    feat(60, 39) +
    R(34, 78, 52, 20, '#fff', 5) + Rn(44, 79.5, 7, 17, T) + Rn(57, 79.5, 7, 17, RED) + Rn(70, 79.5, 7, 17, T) +
    R(34, 78, 52, 20, 'none', 5) + L('M36 88 H84', 1.5, '#c9d1d6') +
    hand(34, 88, SKIN_T) + hand(86, 88, SKIN_T)),

  jade: () => {
    let flower = '';
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
      flower += C(72 + 4.2 * Math.cos(a), 14 + 4.2 * Math.sin(a), 3.4, PINK, '', 1.8);
    }
    flower += C(72, 14, 2.2, GOLD, '', 1.5);
    return svg(
      C(60, 15, 9, HAIR_J) +
      neck(SKIN) + torso(T, TD) + P('M50 60 L60 69 L70 60 Z', '#fff', '', 2.5) +
      P('M31 104 L32 72 Q34 61 46 60 L54 90 L54 104 Z', BLK) + P('M89 104 L88 72 Q86 61 74 60 L66 90 L66 104 Z', BLK) +
      head(60, 36, SKIN) +
      P('M42 34 Q41 17 60 17 Q79 17 78 34 Q74 24 64 23 Q56 28 46 26 Q43 29 42 34 Z', HAIR_J) +
      flower + feat(60, 38) +
      L('M92 46 L84 70', 2) + L('M82 62 L76 46', 3, RED) +
      P('M74 62 L98 62 L92 84 L80 84 Z', '#ff9a4c') + Pn('M75.5 64 L96.5 64 L95 70 L77 70 Z', GOLD) +
      L('M74 62 L98 62 L92 84 L80 84 Z') + SH('M78 66 L82 80', 2.5, 0.7) +
      R(84, 84, 4, 8, GLASS, 1, '', 2) + E(86, 93, 9, 2.5, GLASS, '', 2) +
      C(74, 62, 5.5, '#9be36a', '', 2.5) + Cn(74, 62, 3, '#d6f5b8') +
      P('M82 48 Q92 34 104 46 Q98 43 93 47 Q88 44 82 48 Z', PINK, '', 2.5) +
      hand(80, 90));
  },

  gus: () => svg(moon(26, 22, 16) + SPARK(102, 16, 4) + SPARK(12, 52, 3.5) + gusFig(true)),

  // ===== Shop: forever =====
  autoCash: () => svg(
    shadow(60, 93, 42, 5) +
    bill(36, 22, -24) + bill(60, 13, 6) + bill(84, 21, 26) +
    L('M24 30 L15 28 M44 5 L41 1 M78 4 L82 0.5 M96 31 L106 29', 3) +
    R(40, 31, 40, 13, T, 3) + L('M47 35.5 H73', 3, K) +
    P('M28 58 L92 58 L86 42 L34 42 Z', CR) +
    C(43, 47, 2.6, T, '', 1.5) + C(53, 47, 2.6, T, '', 1.5) + C(63, 47, 2.6, T, '', 1.5) +
    C(41, 53, 2.6, T, '', 1.5) + C(52, 53, 2.6, T, '', 1.5) + C(63, 53, 2.6, T, '', 1.5) +
    R(71, 45, 13, 9, '#1b3b3a', 2, '', 2) + TX(77.5, 52.5, 7, '$', GRL) +
    P('M24 88 L96 88 L92 56 L28 56 Z', RED) + Pn('M84 59 L91 59 L94.5 85 L86 85 Z', REDD) +
    R(20, 76, 80, 14, T, 3) + Rn(88, 79, 8, 8, TD, 2) + R(52, 80.5, 16, 5, GOLD, 2, '', 2) +
    SH('M32 62 H52', 2.5, 0.5)),

  cash50: () => svg(shadow(64, 92, 38, 5) + stack(36, 88, 50, 5) + arrow(64, 6, 15)),

  cash2x: () => svg(
    shadow(60, 93, 52, 5) +
    stack(10, 90, 40, 4) + stack(64, 90, 40, 5) +
    arrow(33, 24, 11) + arrow(87, 16, 11) + TX(60, 26, 15, 'x2', GOLD, 3.5)),

  vacuum: () => svg(
    shadow(56, 93, 44, 5) +
    L('M34 46 Q52 30 70 44', 7) + L('M34 46 Q52 30 70 44', 3.5, GOLDD) +
    L('M88 58 Q108 50 102 30 Q96 12 74 14', 11) + L('M88 58 Q108 50 102 30 Q96 12 74 14', 6, '#5a5a62') +
    `<path d="M88 58 Q108 50 102 30 Q96 12 74 14" fill="none" stroke="#3e3e44" stroke-width="6" stroke-dasharray="1.5 4"/>` +
    G('rotate(-12 66 14)', R(52, 9, 22, 10, T, 4) + SH('M56 12 H66', 2, 0.6)) +
    R(18, 44, 72, 42, GOLD, 20) + Pn('M22 70 Q24 83 38 83 L72 83 Q86 83 87 70 Z', GOLDD) + SH('M28 53 Q36 48 50 47.5', 3, 0.7) +
    BOLT(44, 51, 0.92, RED) +
    C(88, 58, 6, BLK) +
    C(32, 86, 7, BLK) + Cn(32, 86, 2.5, STEEL) + C(76, 86, 7, BLK) + Cn(76, 86, 2.5, STEEL)),

  fastRose: () => svg(L('M2 42 H22 M8 54 H26 M2 66 H20 M10 78 H26', 3.5) + roseFig(roseMop)),

  nightShift: () => svg(
    moon(98, 22, 14) + SPARK(78, 10, 3.5) + SPARK(112, 46, 3) +
    SC('translate(9 5)', 0.85, () => gusFig(false)) +
    R(10, 73, 100, 24, WOOD, 3) + Rn(96, 76, 10, 18, WOODD, 2) + L('M60 75 V95', 2, WOODD) +
    R(6, 66, 108, 8, WOODL, 3) + SH('M12 69 H52', 2, 0.5) +
    R(72, 60, 24, 7, CR, 1.5, '', 2.5) + Rn(83, 60, 2, 7, RED) +
    R(18, 64, 18, 3.5, STEELD, 1.5, '', 2) + P('M20 64 Q20 54 27 54 Q34 54 34 64 Z', GOLD, '', 2.5) + C(27, 52, 2, GOLD, '', 1.8)),

  chute: () => svg(
    shadow(80, 93, 30, 4) +
    washer(56, 50, 48, 42) +
    G('translate(4 9) rotate(20)',
      L('M6 -4 H18 M10 -10 H21', 2.5) +
      C(32, -12, 4.5, PINK, '', 2.5) + C(41, -13, 5, MINT, '', 2.5) +
      P('M26 0 L48 0 L46 -11 L28 -11 Z', WOODL, '', 2.5) + L('M32 -10 L32 -1 M37 -10 V-1 M42 -10 L42 -1', 1.8, WOOD) +
      R(0, 0, 70, 16, STEEL, 8) + Rn(4, 9.5, 62, 4.5, STEELD, 2.2) + SH('M8 4 H58', 2.5, 0.8) +
      L('M22 0.5 V15.5 M46 0.5 V15.5', 2.5, '#7d8891') +
      E(68, 8, 4, 7.5, '#4a5560', '', 2.5))),

  selfCoffee: () => svg(
    shadow(60, 95, 34, 4) +
    R(40, 60, 40, 32, REDD, 4) +
    R(30, 90, 60, 6, STEELD, 3) +
    R(34, 8, 52, 56, RED, 9) + Rn(74, 13, 8, 46, REDD, 4) + SH('M40 17 V52', 3, 0.4) +
    R(32, 4, 56, 10, BLK, 4) +
    R(42, 20, 36, 24, CR, 4) + E(60, 32, 7, 9, COFFEE, 'transform="rotate(20 60 32)"', 2.5) + L('M57.5 25 Q63 32 59 39', 2, WOOD) +
    R(53, 63, 14, 8, STEELD, 2, '', 2.5) + R(66, 62, 10, 4, BLK, 2, '', 2) +
    Rn(59, 71, 2.5, 8, COFFEE) +
    L('M44 72 Q40 66 44 60', 3.5, STEAM) + L('M76 74 Q80 68 76 62', 3.5, STEAM) +
    P('M49 76 L71 76 L69.5 89 Q69 91 66 91 L54 91 Q51 91 50.5 89 Z', '#fff', '', 2.5) +
    Pn('M49.7 80 L70.3 80 L69.9 84 L50.1 84 Z', RED) + L('M71 79 Q77 80 74 85 Q72 88 69.5 87.5', 2.5)),

  megaBag: () => svg(
    shadow(64, 92, 50, 5) +
    P('M30 88 Q14 84 18 60 Q22 36 47 30 L53 26 L63 26 L69 30 Q94 36 97 60 Q100 84 84 88 Z', T) +
    Pn('M76 36 Q92 42 94 60 Q96 80 84 85 Q90 70 86 54 Q83 43 76 36 Z', TD) +
    L('M36 52 Q42 62 38 74 M58 40 Q56 50 60 58 M72 66 Q78 72 76 80', 2.5, TD) +
    SH('M26 66 Q26 50 38 42', 3.5, 0.5) +
    P('M57 25 Q48 14 46 6 Q56 10 59 20 Z', T, '', 2.5) + P('M59 25 Q66 12 76 8 Q72 18 61 22 Z', T, '', 2.5) +
    R(51, 22, 14, 6, TD, 3, '', 2.5) +
    P('M92 90 Q84 88 86 76 Q88 68 98 66 L101 62 L105 62 L108 66 Q117 68 116 78 Q116 89 108 90 Z', '#9aa4ab') +
    Pn('M108 68 Q115 71 114 80 Q113 87 108 88 Q111 80 108 68 Z', '#7d878f') +
    L('M101 62 L98 56 M105 62 L109 56', 2.5)),

  // ===== Shop: right now =====
  starter: () => svg(
    shadow(60, 92, 46, 5) +
    G('rotate(16 92 28)', R(66, 22, 50, 11, RED, 3) + R(86, 22, 10, 11, GOLD, 0, '', 2.5)) +
    SC('translate(15 15)', 0.55, lampBody) +
    SC('translate(57 26)', 0.34, bandanaBody) +
    R(28, 56, 64, 34, RED, 3) + Rn(80, 59, 8, 28, REDD, 2) + R(54, 56, 12, 34, GOLD, 0, '', 2.5) +
    R(25, 51, 70, 8, REDD, 3) + R(54, 51, 12, 8, GOLDD, 0, '', 2.5) +
    bill(18, 82, -18) + bill(102, 84, 14) + SPARK(16, 40, 5) + SPARK(104, 54, 4)),

  rushWash: () => svg(
    shadow(56, 93, 36, 5) +
    L('M6 44 H22 M2 56 H20 M8 68 H24', 3.5) +
    washer(30, 22, 52, 68) +
    BOLT(86, 6, 1.3, GOLD) +
    C(94, 60, 6, '#cfeeff', '', 2.5) + Cn(92, 58, 1.6, '#fff') +
    C(104, 74, 4, '#cfeeff', '', 2) + C(22, 22, 4.5, '#cfeeff', '', 2) + Cn(20.8, 20.8, 1.2, '#fff') +
    C(90, 84, 3, '#cfeeff', '', 2)),

  bus: () => svg(
    shadow(64, 90, 50, 5) +
    L('M2 50 H14 M4 60 H14 M2 70 H12', 3.5) +
    L('M30 34 V27 M90 34 V27 M26 27 H96', 2.5) +
    R(32, 15, 18, 12, WOOD, 2, '', 2.5) + R(52, 19, 16, 8, RED, 2, '', 2.5) + R(70, 13, 16, 14, T, 2, '', 2.5) +
    L('M41 15 V27 M78 13 V27', 1.8, O) +
    P('M18 78 L18 44 Q18 34 28 34 L98 34 Q108 34 110 46 L112 70 Q112 78 104 78 Z', GOLD) +
    Pn('M20.5 70 H109.5 V76 H20.5 Z', GOLDD) + Rn(18, 58, 94, 6, T) + L('M18 58 H112 M18 64 H112', 2) +
    R(26, 40, 14, 12, MINT, 2, '', 2.5) + R(44, 40, 14, 12, MINT, 2, '', 2.5) + R(62, 40, 14, 12, MINT, 2, '', 2.5) + R(80, 40, 12, 12, MINT, 2, '', 2.5) +
    P('M96 40 L104 40 Q108 42 108.5 54 L96 54 Z', MINT, '', 2.5) + SH('M29 49 L33 43 M47 49 L51 43', 2, 0.8) +
    Cn(110, 68, 2.6, '#fff6c0') +
    C(36, 78, 8, K) + Cn(36, 78, 3, STEEL) + C(92, 78, 8, K) + Cn(92, 78, 3, STEEL)),

  magicBed: () => svg(
    shadow(60, 92, 50, 5) +
    R(12, 30, 12, 58, WOOD, 4) + Rn(15, 34, 3, 44, WOODL, 1.5) +
    R(98, 52, 10, 36, WOOD, 3) +
    R(20, 66, 82, 10, WOOD, 2) +
    R(22, 56, 78, 12, '#fff', 5) +
    E(36, 52, 11, 6, '#fff') +
    P('M48 55 L97 55 Q100 55 100 58 L100 68 L48 68 Z', T) + Pn('M48 64 H99 V67 H48 Z', TD) +
    P('M66 55 Q63 34 84 26 Q98 22 104 32 Q90 34 88 55 Z', MINT) + Pn('M88 54 Q90 36 103 31 Q96 32 92 36 Q86 44 86 54 Z', T) +
    `<path d="M92 20 Q72 8 58 22" fill="none" stroke="${GOLDD}" stroke-width="2.5" stroke-linecap="round" stroke-dasharray="2 5"/>` +
    SPARK(54, 24, 7) + SPARK(106, 16, 5) + SPARK(40, 36, 4) + SPARK(112, 44, 4)),

  shoes: () => svg(
    shadow(64, 92, 46, 5) +
    L('M4 52 H20 M8 62 H22 M2 72 H18', 3.5) +
    P('M24 76 L106 76 Q112 76 112 82 Q112 88 104 88 L30 88 Q22 88 22 82 Z', '#fff') + L('M26 83 H108', 2, '#c9d1d6') +
    P('M26 78 L28 50 Q30 40 40 42 L50 46 Q64 50 74 58 L96 64 Q110 68 108 78 Z', RED) +
    Pn('M30 66 L30 76 L106 76 Q107 72 104 70 Z', REDD, 'opacity=".55"') +
    P('M90 63.4 Q100 66 105 70 Q108 74 107 77 L86 77 Q86 70 90 63.4 Z', '#fff', '', 2.5) +
    Pn('M31 46 Q33 41.5 40 43.5 L46.5 45.5 Q42 50 31 50 Z', K) +
    BOLT(42, 53, 0.62, GOLD) +
    L('M56 50 L64 56 M62 48 L70 56 M68 52 L75 58', 5) + L('M56 50 L64 56 M62 48 L70 56 M68 52 L75 58', 2.5, T) +
    SH('M34 60 Q35 51 40 47.5', 3, 0.6)),

  // ===== Shop: cash =====
  cashStack: () => svg(
    shadow(64, 92, 48, 5) +
    stack(20, 88, 54, 4) + coin(88, 84, 9) + coin(104, 84, 8) + coin(96, 70, 8)),

  cashBag: () => svg(
    shadow(60, 93, 40, 5) +
    bill(48, 20, -24) + bill(72, 18, 20) + bill(60, 12, 2) +
    P('M42 32 L38 18 L50 24 L58 14 L66 24 L80 16 L78 32 Z', '#d9b07a') +
    P('M44 34 Q22 46 22 68 Q22 90 60 90 Q98 90 98 68 Q98 46 76 34 Z', '#d9b07a') +
    Pn('M86 46 Q96 56 95 70 Q94 86 70 88 Q88 80 88 64 Q88 54 86 46 Z', '#b88a52') +
    SH('M31 64 Q33 51 43 45', 3.5, 0.5) +
    R(42, 28, 36, 7, GOLDD, 3.5) +
    TX(60, 80, 36, '$', GR, 4)),

  vault: () => svg(
    shadow(60, 93, 48, 5) +
    P('M22 50 L26 18 Q60 4 94 18 L98 50 Z', WOOD) + Pn('M29 48 L32 22 Q60 11 88 22 L91 48 Z', '#5a3418') +
    bill(34, 42, -20) + bill(58, 36, 4) + bill(82, 42, 22) +
    coin(44, 44, 7) + coin(72, 42, 7) + coin(58, 47, 7) +
    R(20, 52, 80, 36, WOOD, 4) + Rn(24, 76, 72, 9, WOODD, 2) + L('M22 66 H98', 2, WOODD) +
    R(32, 52, 8, 36, GOLDD, 1, '', 2.5) + R(80, 52, 8, 36, GOLDD, 1, '', 2.5) +
    R(18, 48, 84, 8, WOODL, 3) +
    R(52, 58, 16, 15, GOLD, 3, '', 2.5) + Cn(60, 64, 2.5, O) + Rn(59, 64, 2, 5, O) +
    coin(14, 86, 6) + coin(106, 86, 6) + SPARK(16, 34, 5) + SPARK(104, 30, 4)),

  crate: () => {
    const bundle = (x, y, r) => G(`translate(${x} ${y}) rotate(${r})`,
      R(-13, -6, 26, 12, GR, 2, '', 2.5) + Rn(-10, -3.5, 20, 1.8, GRL, 0.9) + R(-3, -6, 6, 12, GOLD, 0, '', 2));
    return svg(
      shadow(60, 92, 46, 5) +
      bundle(46, 30, -6) + bundle(70, 30, 10) +
      bundle(32, 42, -14) + bundle(56, 40, 4) + bundle(82, 42, 16) +
      R(20, 46, 80, 42, WOODL, 3) + L('M29 60 H91 M29 74 H91', 2, WOODD) +
      P('M29 84 L37 84 L91 52 L83 52 Z', WOOD, '', 2.5) +
      R(20, 46, 9, 42, WOOD, 2) + R(91, 46, 9, 42, WOOD, 2) +
      R(17, 43, 86, 6, WOOD, 2) +
      Cn(24.5, 54, 1.4, O) + Cn(95.5, 54, 1.4, O) + Cn(24.5, 80, 1.4, O) + Cn(95.5, 80, 1.4, O) +
      SPARK(106, 30, 4.5) + SPARK(14, 34, 3.5));
  },

  truck: () => svg(shadow(68, 92, 46, 5) + SC('translate(10 9)', 0.88, () =>
    P('M24 32 L10 26 L10 76 L24 80 Z', TD) +
    bill(12, 18, -35) + bill(30, 12, -10) + bill(6, 40, -70) +
    coin(18, 30, 6) + coin(4, 60, 5) +
    L('M2 14 L-2 10 M20 4 L18 0 M40 4 L42 0', 3) +
    P('M24 82 L24 34 Q24 28 30 28 L80 28 Q84 28 86 32 L96 46 L106 50 Q112 52 112 60 L112 82 Z', T) +
    Pn('M26.5 72 H109.5 V80 H26.5 Z', TD) + L('M24 40 H82', 2, TD) +
    P('M84 34 L93 47 L82 47 L82 34 Z', MINT, '', 2.5) + SH('M85 44 L85.5 38', 2, 0.8) +
    Cn(30, 46, 1.4, TD) + Cn(30, 66, 1.4, TD) + Cn(76, 46, 1.4, TD) + Cn(76, 66, 1.4, TD) +
    C(52, 56, 10, GOLD) + TX(52, 61, 13, '$', GOLDD) +
    R(104, 74, 10, 6, STEEL, 2, '', 2.5) + Cn(110, 62, 3, '#fff6c0') +
    C(42, 82, 9, K) + Cn(42, 82, 3.5, STEEL) + C(94, 82, 9, K) + Cn(94, 82, 3.5, STEEL))),

  empire: () => svg(
    shadow(60, 92, 54, 5) +
    SC('translate(22 6)', 0.8, motel) +
    gift(8, 58, 30, 34, T, GOLD, TD) +
    stack(76, 92, 30, 3) + coin(52, 86, 6) + coin(64, 88, 5) +
    SPARK(14, 30, 4.5) + SPARK(108, 30, 4)),

  // ===== UI glyphs =====
  tabCoffee: () => svg(
    shadow(60, 92, 36, 4) +
    L('M50 30 Q44 22 50 14 Q56 6 50 0', 4, STEAM) + L('M66 30 Q60 22 66 14', 4, STEAM) +
    E(60, 80, 36, 9, '#fff') + Pn('M28 82 Q60 92 92 82 Q90 87 60 88 Q30 87 28 82 Z', '#dde3e6') +
    L('M84 48 Q100 47 96 60 Q92 69 82 66', 8) + L('M84 48 Q100 47 96 60 Q92 69 82 66', 3.5, '#fff') +
    P('M34 40 L86 40 L82 70 Q80 80 70 80 L50 80 Q40 80 38 70 Z', '#fff') +
    Pn('M74 42 L84 42 L80.5 70 Q79 76 73 78 Q77 70 74 42 Z', '#dde3e6') +
    Pn('M35.4 50 L84.6 50 L83.7 57 L36.3 57 Z', RED) +
    L('M34 40 L86 40 L82 70 Q80 80 70 80 L50 80 Q40 80 38 70 Z') +
    E(60, 40, 26, 5, COFFEE, '', 3) + SH('M42 46 L44 68', 3, 0.7)),

  tabRooms: () => svg(
    shadow(60, 93, 32, 4) +
    R(32, 6, 56, 86, WOOD, 3) + Rn(35, 9, 4, 80, WOODL, 1.5) +
    R(39, 13, 42, 79, T, 2) + Rn(72, 16, 7, 74, TD, 1.5) +
    R(45, 20, 30, 24, '#45c7b8', 2, '', 2, TD) + R(45, 52, 30, 32, '#45c7b8', 2, '', 2, TD) +
    R(53, 27, 14, 10, GOLD, 2, '', 2.5) + TX(60, 35, 8, '7', O) +
    C(74, 54, 3.4, GOLD, '', 2.5) + SH('M43 18 V88', 2, 0.35)),

  tabAds: () => svg(
    shadow(56, 92, 34, 4) +
    R(40, 56, 9, 22, K, 3) +
    P('M30 40 L78 20 L78 80 L30 60 Z', RED) + Pn('M30 52 L78 56 L78 78 L32 59 Z', REDD) +
    SH('M36 43 L70 29', 3, 0.5) +
    R(18, 38, 14, 24, REDD, 4) +
    E(78, 50, 8, 31, GOLD) + E(79, 50, 3.5, 24, GOLDD, '', 2) +
    L('M94 36 Q100 50 94 64', 7) + L('M94 36 Q100 50 94 64', 3.5, T) +
    L('M104 28 Q114 50 104 72', 7) + L('M104 28 Q114 50 104 72', 3.5, T)),

  tabStaff: () => svg(
    shadow(60, 94, 30, 4) +
    P('M60 6 L92 16 L90 48 Q86 74 60 88 Q34 74 30 48 L28 16 Z', GOLD) +
    Pn('M60 6 L92 16 L90 48 Q86 74 60 88 Z', GOLDD) +
    P('M60 14 L84 21 L82.5 47 Q79 67 60 79 Q41 67 37.5 47 L36 21 Z', GOLDL, '', 2.5) +
    STAR(60, 44, 16, '#fff') +
    P('M30 66 L14 68 L20 74 L14 80 L32 78 Z', TD, '', 2.5) + P('M90 66 L106 68 L100 74 L106 80 L88 78 Z', TD, '', 2.5) +
    P('M26 62 L94 62 L92 78 L28 78 Z', T) + SH('M32 66 H86', 2.5, 0.5)),

  comfort: () => medal('comfort', BLUE, BLUED, BLUEL,
    R(44, 34, 32, 28, CR, 9) + Rn(48, 38, 6, 16, '#fff', 3, 'opacity=".8"') +
    R(36, 48, 14, 22, CR, 6) + R(70, 48, 14, 22, CR, 6) +
    R(48, 56, 24, 12, '#fff', 4) +
    R(40, 68, 40, 8, CRD, 3) + L('M45 76 V81 M75 76 V81', 3.5) +
    STAR(60, 16, 10)),

  deluxe: () => medal('deluxe', GOLD, GOLDD, GOLDL,
    P('M38 62 L38 46 Q38 38 46 40 Q52 32 60 36 Q68 32 74 40 Q82 38 82 46 L82 62 Z', RED) + Pn('M70 38 Q80 38 81 46 L81 61 L75 61 L75 46 Q74 41 70 38 Z', REDD) +
    C(60, 42, 2.6, GOLD, '', 2) +
    E(48, 57, 8, 4, '#fff', '', 2.5) + E(72, 57, 8, 4, '#fff', '', 2.5) +
    R(34, 59, 52, 8, '#fff', 4, '', 2.5) +
    P('M34 64 L86 64 L86 71 Q86 75 82 75 L38 75 Q34 75 34 71 Z', T) + L('M38 69 H82', 2, TD) +
    L('M38 75 V81 M82 75 V81', 3.5) +
    STAR(29.7, 36.5, 5.5, '#fff', 2) + STAR(42.5, 23.7, 5.5, '#fff', 2) + STAR(60, 19, 6.5, '#fff', 2) + STAR(77.5, 23.7, 5.5, '#fff', 2) + STAR(90.3, 36.5, 5.5, '#fff', 2)),

  pool: () => medal('pool', BLUE, BLUED, BLUEL,
    P('M36 58 Q33 41 49 41 Q59 41 63 48 Q67 54 76 50 Q88 46 88 62 Q88 78 66 78 L51 78 Q34 78 36 58 Z', CR, '', 2.5) +
    P('M41 58 Q39 46 50 46 Q57 46 60 52 Q65 59 76 55 Q83 52 83 62 Q83 73 66 73 L52 73 Q39 73 41 58 Z', '#7fd6f2', '', 2) +
    SH('M48 62 Q52 59 56 62 Q60 65 64 62', 2.5, 0.9) + SH('M62 68 Q66 65 70 68', 2.5, 0.9) +
    L('M75 44 V58 M82 42 V56', 4.5) + L('M75 44 V58 M82 42 V56', 2, '#e3e8eb') + L('M75 48.5 L82 46.5 M75 53.5 L82 51.5', 2.5) +
    Cn(44, 40, 8, '#fff') + Pn('M44 40 L44 32 A8 8 0 0 0 37.07 44 Z', RED) + Pn('M44 40 L44 32 A8 8 0 0 1 50.93 44 Z', GOLD) +
    C(44, 40, 8, 'none', '', 2.5) + Cn(41, 36, 1.6, '#fff')),

  mystery: () => svg(
    shadow(60, 92, 40, 5) +
    P('M30 88 Q14 86 18 66 Q14 50 28 44 Q28 26 46 26 Q52 12 68 18 Q86 16 88 36 Q104 44 98 62 Q106 80 88 88 Z', '#5a3a26') +
    Pn('M88 40 Q100 46 96 62 Q102 78 88 85 L80 85 Q92 74 88 62 Q94 50 88 40 Z', '#3e2718') +
    Pn('M30 46 Q30 30 46 29 Q40 34 38 44 Q26 50 26 60 Q22 52 30 46 Z', '#7a5236') +
    TX(60, 78, 50, '?', GOLD, 4) + SPARK(100, 18, 5) + SPARK(16, 28, 4)),

  lock: () => svg(
    shadow(60, 93, 32, 4) +
    L('M42 46 V30 Q42 12 60 12 Q78 12 78 30 V46', 14) + L('M42 46 V30 Q42 12 60 12 Q78 12 78 30 V46', 8, '#b7c0c7') +
    SH('M44.5 38 V30 Q44.5 17 55 15', 2, 0.7) +
    R(30, 44, 60, 46, '#9aa4ab', 8) + Rn(33, 76, 54, 11, '#7d878f', 5) +
    Pn('M34 52 Q34 47 39 47 L60 47 Q44 50 38 64 Z', '#c3cbd1') +
    Cn(60, 62, 5, '#3a3f44') + Pn('M57.5 64 L62.5 64 L64 76 L56 76 Z', '#3a3f44')),

  coin: () => svg(shadow(60, 93, 30, 4) + coin(60, 46, 34)),

  sparkle: () => svg(SPARK(58, 50, 40, GOLD, 3) + Pn('M58 20 Q60 40 72 48 Q62 44 58 20 Z', '#fff', 'opacity=".55"') + SPARK(98, 20, 9) + SPARK(22, 80, 7)),

  goldenLamp: () => svg(shadow(60, 92, 28, 4) + lampBody() + SPARK(96, 20, 5) + SPARK(22, 30, 4)),

  dogBandana: () => svg(shadow(60, 93, 26, 4) + bandanaBody()),
};

const FALLBACK = () => svg(shadow(60, 92, 34, 5) + gift(30, 18, 60, 72));

export const ART_IDS = Object.keys(ICONS);

export const GIFT_ART = { fastRose: 'fastRose', superVacuum: 'vacuum', magicBed: 'magicBed', autoCash: 'autoCash' };

const cache = new Map();
export function art(id) {
  const key = Object.prototype.hasOwnProperty.call(ICONS, id) ? id : '__fallback';
  let s = cache.get(key);
  if (!s) {
    s = key === '__fallback' ? FALLBACK() : ICONS[key]();
    cache.set(key, s);
  }
  return s;
}
