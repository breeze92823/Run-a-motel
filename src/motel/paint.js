// Canvas painters for the motel: stucco, the starry fascia band, asphalt,
// bricks, curtains, AC grilles, signs and room plates. Drawn once at load
// (plates repaint when a room changes), so the game ships no image files.
import { CanvasTexture, RepeatWrapping, SRGBColorSpace } from 'three'
import { fbm, heightToNormal, hexRgb, mulberry32 } from '../textures.js'

const FONT = 'Fredoka, "Arial Rounded MT Bold", "Arial Black", sans-serif'

export function canvas(w, h = w) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  return c
}

export function tex(c, { repeatX = 1, repeatY = 1, srgb = true, wrap = true } = {}) {
  const t = new CanvasTexture(c)
  if (wrap) t.wrapS = t.wrapT = RepeatWrapping
  t.repeat.set(repeatX, repeatY)
  t.anisotropy = 8
  if (srgb) t.colorSpace = SRGBColorSpace
  return t
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

// Stucco: blotchy two-tone plaster with fine grit. White-ish so a material
// colour tints it; the normal map carries the trowel bumps.
export function paintStucco(size = 512, seed = 11) {
  const blot = fbm(size, 6, 4, seed)
  const grit = fbm(size, 64, 2, seed + 1)
  const rand = mulberry32(seed + 2)
  const c = canvas(size)
  const ctx = c.getContext('2d')
  const img = ctx.createImageData(size, size)
  const h = new Float32Array(size * size)
  for (let i = 0; i < h.length; i++) {
    const v = blot[i] * 0.7 + grit[i] * 0.25 + rand() * 0.05
    h[i] = v
    const shade = 0.86 + blot[i] * 0.16 + (grit[i] - 0.5) * 0.06
    img.data[i * 4] = 255 * Math.min(1, shade)
    img.data[i * 4 + 1] = 255 * Math.min(1, shade * 0.985)
    img.data[i * 4 + 2] = 255 * Math.min(1, shade * 0.96)
    img.data[i * 4 + 3] = 255
  }
  ctx.putImageData(img, 0, 0)
  return { color: c, normal: heightToNormal(h, size, 2.2) }
}

// Fascia band: orange with white four-point stars between round dots, the
// classic roadside-retro trim. Tiles along X.
export function paintStarBand(bg = '#f2743a', fg = '#fff6e8', w = 512, h = 128) {
  const c = canvas(w, h)
  const ctx = c.getContext('2d')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, w, h)
  // Slight top/bottom shading so the band reads as rounded.
  const g = ctx.createLinearGradient(0, 0, 0, h)
  g.addColorStop(0, 'rgba(255,255,255,0.18)')
  g.addColorStop(0.5, 'rgba(255,255,255,0)')
  g.addColorStop(1, 'rgba(0,0,0,0.16)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, w, h)
  ctx.fillStyle = fg
  const star = (cx, cy, r) => {
    ctx.beginPath()
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 - Math.PI / 2
      const rr = i % 2 === 0 ? r : r * 0.28
      ctx.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr)
    }
    ctx.closePath()
    ctx.fill()
  }
  const step = w / 4
  for (let i = 0; i < 4; i++) {
    star(step * i + step * 0.25, h / 2, h * 0.34)
    ctx.beginPath()
    ctx.arc(step * i + step * 0.75, h / 2, h * 0.07, 0, Math.PI * 2)
    ctx.fill()
  }
  return c
}

// Asphalt: dark aggregate speckle, a few tar-sealed cracks and oil stains.
export function paintAsphalt(size = 512, seed = 31, light = 0) {
  const base = fbm(size, 8, 4, seed)
  const rand = mulberry32(seed + 1)
  const c = canvas(size)
  const ctx = c.getContext('2d')
  const img = ctx.createImageData(size, size)
  const h = new Float32Array(size * size)
  for (let i = 0; i < h.length; i++) {
    const r = rand()
    const speck = r > 0.93 ? 0.35 : r < 0.05 ? -0.25 : 0
    const v = 0.42 + base[i] * 0.2 + speck * 0.5
    h[i] = r
    const k = Math.max(0, Math.min(1, v))
    img.data[i * 4] = 62 + light * 70 + k * 70
    img.data[i * 4 + 1] = 60 + light * 62 + k * 66
    img.data[i * 4 + 2] = 62 + light * 52 + k * 62
    img.data[i * 4 + 3] = 255
  }
  ctx.putImageData(img, 0, 0)
  ctx.strokeStyle = 'rgba(25,24,28,0.55)'
  ctx.lineWidth = 2
  for (let k = 0; k < 5; k++) {
    let x = rand() * size
    let y = rand() * size
    ctx.beginPath()
    ctx.moveTo(x, y)
    for (let s = 0; s < 14; s++) {
      x += (rand() - 0.5) * 40
      y += (rand() - 0.3) * 30
      ctx.lineTo(x, y)
    }
    ctx.stroke()
  }
  for (let k = 0; k < 3; k++) {
    const x = rand() * size
    const y = rand() * size
    const g = ctx.createRadialGradient(x, y, 0, x, y, 30 + rand() * 30)
    g.addColorStop(0, 'rgba(20,20,26,0.35)')
    g.addColorStop(1, 'rgba(20,20,26,0)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, size, size)
  }
  return { color: c, normal: heightToNormal(h, size, 0.6) }
}

// Bricks: running bond, each brick its own shade, recessed mortar.
export function paintBrick(size = 256, rows = 8, cols = 4, seed = 41) {
  const rand = mulberry32(seed)
  const c = canvas(size)
  const ctx = c.getContext('2d')
  const h = new Float32Array(size * size)
  ctx.fillStyle = '#e8d2b8'
  ctx.fillRect(0, 0, size, size)
  const bh = size / rows
  const bw = size / cols
  const m = 3
  for (let r = 0; r < rows; r++) {
    const off = r % 2 ? bw / 2 : 0
    for (let k = -1; k <= cols; k++) {
      const x = k * bw + off
      const t = rand()
      const [cr, cg, cb] = hexRgb(t < 0.33 ? '#d9532e' : t < 0.66 ? '#e8653a' : '#c8462a')
      const j = 0.9 + rand() * 0.15
      ctx.fillStyle = `rgb(${cr * j},${cg * j},${cb * j})`
      ctx.fillRect(x + m, r * bh + m, bw - 2 * m, bh - 2 * m)
      ctx.fillStyle = 'rgba(255,255,255,0.12)'
      ctx.fillRect(x + m, r * bh + m, bw - 2 * m, 3)
      for (let yy = Math.floor(r * bh + m); yy < r * bh + bh - m; yy++) {
        for (let xx = Math.max(0, Math.floor(x + m)); xx < Math.min(size, x + bw - m); xx++) h[yy * size + xx] = 1
      }
    }
  }
  return { color: c, normal: heightToNormal(h, size, 1.2) }
}

// Curtains: soft vertical folds in a warm print, lit from behind (for windows).
export function paintCurtain(base = '#f7d9a6', stripe = '#e8925a', w = 256, h = 256) {
  const c = canvas(w, h)
  const ctx = c.getContext('2d')
  for (let x = 0; x < w; x++) {
    const fold = 0.5 + 0.5 * Math.sin((x / w) * Math.PI * 14)
    const [r, g, b] = hexRgb(base)
    const k = 0.78 + fold * 0.22
    ctx.fillStyle = `rgb(${r * k},${g * k},${b * k})`
    ctx.fillRect(x, 0, 1, h)
  }
  ctx.globalAlpha = 0.5
  ctx.fillStyle = stripe
  for (let y = 18; y < h; y += 40) ctx.fillRect(0, y, w, 6)
  ctx.globalAlpha = 1
  // Gap in the middle where the curtains meet, with a dim room behind.
  const g = ctx.createLinearGradient(w * 0.46, 0, w * 0.54, 0)
  g.addColorStop(0, 'rgba(60,40,30,0)')
  g.addColorStop(0.5, 'rgba(60,40,30,0.55)')
  g.addColorStop(1, 'rgba(60,40,30,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, w, h)
  return c
}

// AC unit grille: horizontal louvres.
export function paintGrille(w = 128, h = 64) {
  const c = canvas(w, h)
  const ctx = c.getContext('2d')
  ctx.fillStyle = '#e9ece6'
  ctx.fillRect(0, 0, w, h)
  ctx.fillStyle = '#5d6460'
  ctx.fillRect(8, 8, w - 16, h - 16)
  for (let y = 10; y < h - 10; y += 5) {
    ctx.fillStyle = '#c9cfc8'
    ctx.fillRect(10, y, w - 20, 2.4)
  }
  return c
}

// Laundry floor: teal/cream checker.
export function paintChecker(a = '#3fb6a8', b = '#f4efe0', size = 128, n = 4) {
  const c = canvas(size)
  const ctx = c.getContext('2d')
  const s = size / n
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      ctx.fillStyle = (x + y) % 2 ? a : b
      ctx.fillRect(x * s, y * s, s, s)
    }
  }
  return c
}

// A flat sign face: rounded panel, border, optional marquee dots, centred text lines.
// opts: { w, h, bg, border, text, lines: [{ t, size, color, font? }], dots, dotColor, radius }
export function paintSign(opts) {
  const { w = 512, h = 192, bg = '#fff6e5', border = '#e8582c', borderW = 14, radius = 24, dots = false, dotColor = '#ffe9a8', lines = [], shadow = null } = opts
  const c = canvas(w, h)
  const ctx = c.getContext('2d')
  roundRect(ctx, borderW / 2, borderW / 2, w - borderW, h - borderW, radius)
  ctx.fillStyle = bg
  ctx.fill()
  if (border) {
    ctx.lineWidth = borderW
    ctx.strokeStyle = border
    ctx.stroke()
  }
  if (dots) {
    ctx.fillStyle = dotColor
    const inset = borderW / 2
    const step = 26
    for (let x = inset + 14; x < w - inset; x += step) {
      ctx.beginPath(); ctx.arc(x, inset, 4.5, 0, Math.PI * 2); ctx.fill()
      ctx.beginPath(); ctx.arc(x, h - inset, 4.5, 0, Math.PI * 2); ctx.fill()
    }
  }
  const total = lines.reduce((s, l) => s + l.size * 1.12, 0)
  let y = (h - total) / 2
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  for (const l of lines) {
    y += (l.size * 1.12) / 2
    ctx.font = `${l.weight ?? 700} ${l.size}px ${l.font ?? FONT}`
    let size = l.size
    while (ctx.measureText(l.t).width > w - borderW * 3 && size > 8) {
      size -= 2
      ctx.font = `${l.weight ?? 700} ${size}px ${l.font ?? FONT}`
    }
    if (shadow || l.shadow) {
      ctx.fillStyle = l.shadow ?? shadow
      ctx.fillText(l.t, w / 2 + size * 0.04, y + size * 0.05)
    }
    if (l.outline) {
      ctx.lineWidth = l.outlineW ?? size * 0.12
      ctx.strokeStyle = l.outline
      ctx.lineJoin = 'round'
      ctx.strokeText(l.t, w / 2, y)
    }
    ctx.fillStyle = l.color
    ctx.fillText(l.t, w / 2, y)
    y += (l.size * 1.12) / 2
  }
  return c
}

// Room plate: "101 | REGULAR $41" on a cream plate with a teal frame. Repainted
// in place when the room changes (returns { canvas, draw(room) }).
export function makePlate() {
  const c = canvas(512, 144)
  const draw = ({ number, typeName, price, state }) => {
    const ctx = c.getContext('2d')
    ctx.clearRect(0, 0, 512, 144)
    roundRect(ctx, 6, 6, 500, 132, 18)
    ctx.fillStyle = '#1f9a8a'
    ctx.fill()
    roundRect(ctx, 18, 18, 476, 108, 10)
    ctx.fillStyle = '#fdf6e3'
    ctx.fill()
    ctx.fillStyle = '#123f3a'
    ctx.textBaseline = 'middle'
    ctx.textAlign = 'left'
    ctx.font = `700 78px ${FONT}`
    ctx.fillText(String(number), 34, 76)
    ctx.fillStyle = '#1f9a8a'
    ctx.fillRect(186, 34, 6, 76)
    const locked = state === 'locked'
    ctx.font = `700 40px ${FONT}`
    ctx.fillStyle = locked ? '#9b8a78' : '#1f6f66'
    ctx.fillText(locked ? 'CLOSED' : typeName, 210, 56)
    ctx.font = `700 38px ${FONT}`
    const status = { ready: ['VACANT', '#2a9d4b'], occupied: ['IN USE', '#d06a1e'], dirty: ['DIRTY', '#c23b2b'], reserved: ['BOOKED', '#2a72c2'], locked: ['', '#9b8a78'] }[state] ?? ['', '#000']
    ctx.fillStyle = '#e0533a'
    ctx.fillText(locked ? '' : `$${price}`, 210, 100)
    ctx.textAlign = 'right'
    ctx.fillStyle = status[1]
    ctx.font = `700 30px ${FONT}`
    ctx.fillText(status[0], 484, 100)
  }
  return { canvas: c, draw }
}

// Neon text on a dark box (colour map) plus its glow alone (emissive map).
export function paintNeon(text, { w = 512, h = 160, color = '#ff3d8b', bg = '#1d0f14', size = 96, font = FONT, off = [] } = {}) {
  const c = canvas(w, h)
  const ctx = c.getContext('2d')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, w, h)
  ctx.font = `700 ${size}px ${font}`
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  const total = ctx.measureText(text).width
  let x = (w - total) / 2
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    const cw = ctx.measureText(ch).width
    const dim = off.includes(i)
    ctx.shadowColor = dim ? 'transparent' : color
    ctx.shadowBlur = dim ? 0 : 18
    ctx.fillStyle = dim ? '#4a2a35' : color
    ctx.fillText(ch, x, h / 2 + 4)
    x += cw
  }
  ctx.shadowBlur = 0
  return c
}

// Wood grain for planks / sign posts (white-ish, tinted by the material).
export function paintWood(size = 256, seed = 61) {
  const n = fbm(size, 4, 4, seed)
  const c = canvas(size)
  const ctx = c.getContext('2d')
  const img = ctx.createImageData(size, size)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = y * size + x
      const ring = 0.5 + 0.5 * Math.sin(y * 0.18 + n[i] * 9)
      const k = 0.72 + ring * 0.2 + n[i] * 0.1
      img.data[i * 4] = 255 * k
      img.data[i * 4 + 1] = 235 * k
      img.data[i * 4 + 2] = 205 * k
      img.data[i * 4 + 3] = 255
    }
  }
  ctx.putImageData(img, 0, 0)
  return c
}

// Grime stain decal: irregular brown splat with alpha (sponge-scrubbable).
export function paintStain(seed = 1, size = 128) {
  const rand = mulberry32(seed)
  const c = canvas(size)
  const ctx = c.getContext('2d')
  for (let i = 0; i < 9; i++) {
    const x = size / 2 + (rand() - 0.5) * size * 0.45
    const y = size / 2 + (rand() - 0.5) * size * 0.45
    const r = size * (0.12 + rand() * 0.18)
    const g = ctx.createRadialGradient(x, y, 0, x, y, r)
    g.addColorStop(0, 'rgba(92,62,30,0.75)')
    g.addColorStop(0.7, 'rgba(110,78,40,0.45)')
    g.addColorStop(1, 'rgba(110,78,40,0)')
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fill()
  }
  return c
}

// Crack / water-stain overlay for the rundown second floor walls.
export function paintCracks(size = 256, seed = 71) {
  const rand = mulberry32(seed)
  const c = canvas(size)
  const ctx = c.getContext('2d')
  ctx.strokeStyle = 'rgba(90,55,35,0.75)'
  ctx.lineWidth = 2
  for (let k = 0; k < 4; k++) {
    let x = rand() * size
    let y = rand() * size
    ctx.beginPath()
    ctx.moveTo(x, y)
    for (let s = 0; s < 8; s++) {
      x += (rand() - 0.5) * 36
      y += rand() * 26
      ctx.lineTo(x, y)
    }
    ctx.stroke()
  }
  for (let k = 0; k < 3; k++) {
    const x = rand() * size
    const y = rand() * size
    const g = ctx.createRadialGradient(x, y, 0, x, y, 40)
    g.addColorStop(0, 'rgba(120,80,40,0.35)')
    g.addColorStop(1, 'rgba(120,80,40,0)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, size, size)
  }
  return c
}

export { FONT, roundRect }

// --- Room interiors ---------------------------------------------------------------
// Peach wallpaper with soft white four-point stars (tiles every ~1.6 m).
export function paintWallpaper(bg = '#f7b796', fg = 'rgba(255,246,232,0.85)', size = 256, seed = 81) {
  const rand = mulberry32(seed)
  const c = canvas(size)
  const ctx = c.getContext('2d')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, size, size)
  const n = fbm(size, 8, 3, seed)
  const img = ctx.getImageData(0, 0, size, size)
  for (let i = 0; i < n.length; i++) {
    const k = 0.94 + n[i] * 0.1
    img.data[i * 4] *= k
    img.data[i * 4 + 1] *= k
    img.data[i * 4 + 2] *= k
  }
  ctx.putImageData(img, 0, 0)
  ctx.fillStyle = fg
  const star = (cx, cy, r) => {
    ctx.beginPath()
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 - Math.PI / 2
      const rr = i % 2 === 0 ? r : r * 0.22
      ctx.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr)
    }
    ctx.closePath()
    ctx.fill()
  }
  const pts = [[0.25, 0.25, 30], [0.75, 0.75, 30], [0.75, 0.25, 16], [0.25, 0.75, 16], [0.5, 0.5, 9], [0, 0.5, 9]]
  for (const [x, y, r] of pts) {
    const jx = (rand() - 0.5) * 8
    const jy = (rand() - 0.5) * 8
    for (const ox of [-size, 0, size]) for (const oy of [-size, 0, size]) star(x * size + ox + jx, y * size + oy + jy, r)
  }
  return c
}

// Wainscot: vertical teal boards with light bevels and a cream cap line at the top.
export function paintWainscot(base = '#2cc394', w = 256, h = 256, boards = 4) {
  const c = canvas(w, h)
  const ctx = c.getContext('2d')
  const bw = w / boards
  for (let i = 0; i < boards; i++) {
    const g = ctx.createLinearGradient(i * bw, 0, (i + 1) * bw, 0)
    g.addColorStop(0, '#5fe0b4')
    g.addColorStop(0.08, base)
    g.addColorStop(0.9, base)
    g.addColorStop(1, '#1d8f6c')
    ctx.fillStyle = g
    ctx.fillRect(i * bw, 0, bw, h)
  }
  return c
}

// Carpet: warm beige with a sparse dot pattern and soft fibre noise.
export function paintCarpet(base = '#f0cf98', dot = '#fbe6c0', size = 256, seed = 91) {
  const n = fbm(size, 32, 3, seed)
  const c = canvas(size)
  const ctx = c.getContext('2d')
  const img = ctx.createImageData(size, size)
  const [r, g, b] = hexRgb(base)
  for (let i = 0; i < n.length; i++) {
    const k = 0.9 + n[i] * 0.15
    img.data[i * 4] = r * k
    img.data[i * 4 + 1] = g * k
    img.data[i * 4 + 2] = b * k
    img.data[i * 4 + 3] = 255
  }
  ctx.putImageData(img, 0, 0)
  ctx.fillStyle = dot
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      ctx.beginPath()
      ctx.ellipse((x + (y % 2) * 0.5) * (size / 8), (y + 0.5) * (size / 8), 5, 3, 0.4, 0, Math.PI * 2)
      ctx.fill()
    }
  }
  return c
}

// Drapes: deep vertical folds (used on both sides of each window inside).
export function paintDrape(base = '#ff7a12', w = 128, h = 256) {
  const c = canvas(w, h)
  const ctx = c.getContext('2d')
  const [r, g, b] = hexRgb(base)
  for (let x = 0; x < w; x++) {
    const k = 0.72 + 0.28 * (0.5 + 0.5 * Math.sin((x / w) * Math.PI * 8))
    ctx.fillStyle = `rgb(${r * k},${g * k},${b * k})`
    ctx.fillRect(x, 0, 1, h)
  }
  return c
}

// Bathroom tile: small mint checker with grout.
export function paintTile(a = '#a9dcc0', b = '#c7ead6', grout = '#e9f4ee', size = 256, n = 6) {
  const c = canvas(size)
  const ctx = c.getContext('2d')
  ctx.fillStyle = grout
  ctx.fillRect(0, 0, size, size)
  const s = size / n
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      ctx.fillStyle = (x + y) % 2 ? a : b
      ctx.fillRect(x * s + 2, y * s + 2, s - 4, s - 4)
      ctx.fillStyle = 'rgba(255,255,255,0.18)'
      ctx.fillRect(x * s + 2, y * s + 2, s - 4, 3)
    }
  }
  return c
}

// Fabric: soft noise on a base colour with a lighter band (blankets).
export function paintFabric(base = '#1f9e83', band = '#58c7a8', size = 128, seed = 95) {
  const n = fbm(size, 32, 2, seed)
  const c = canvas(size)
  const ctx = c.getContext('2d')
  const img = ctx.createImageData(size, size)
  const [r, g, b] = hexRgb(base)
  for (let i = 0; i < n.length; i++) {
    const k = 0.88 + n[i] * 0.2
    img.data[i * 4] = r * k
    img.data[i * 4 + 1] = g * k
    img.data[i * 4 + 2] = b * k
    img.data[i * 4 + 3] = 255
  }
  ctx.putImageData(img, 0, 0)
  if (band) {
    ctx.fillStyle = band
    ctx.globalAlpha = 0.7
    ctx.fillRect(0, size * 0.18, size, size * 0.05)
    ctx.globalAlpha = 1
  }
  return c
}

// --- Dirt decals (rooms + outside walls; game/clean.js, game/curb.js) --------------------------
// Grey fluffy dust bunnies with crumbs, for carpet patches cleaned with the vacuum.
export function paintDust(seed = 1, size = 128) {
  const rand = mulberry32(seed * 7 + 3)
  const c = canvas(size)
  const ctx = c.getContext('2d')
  for (let i = 0; i < 14; i++) {
    const x = size / 2 + (rand() - 0.5) * size * 0.55
    const y = size / 2 + (rand() - 0.5) * size * 0.55
    const r = size * (0.06 + rand() * 0.12)
    const g = ctx.createRadialGradient(x, y, 0, x, y, r)
    g.addColorStop(0, 'rgba(120,112,104,0.85)')
    g.addColorStop(0.6, 'rgba(140,132,122,0.55)')
    g.addColorStop(1, 'rgba(150,140,130,0)')
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fill()
  }
  for (let i = 0; i < 40; i++) {
    ctx.fillStyle = rand() < 0.5 ? 'rgba(160,110,50,0.9)' : 'rgba(90,80,70,0.9)'
    ctx.fillRect(size * 0.2 + rand() * size * 0.6, size * 0.2 + rand() * size * 0.6, 2 + rand() * 3, 2 + rand() * 3)
  }
  return c
}

// Muddy footprints and a brown puddle, for floors cleaned with the mop.
export function paintMud(seed = 1, size = 128) {
  const rand = mulberry32(seed * 13 + 5)
  const c = canvas(size)
  const ctx = c.getContext('2d')
  const g = ctx.createRadialGradient(size * 0.55, size * 0.6, 0, size * 0.55, size * 0.6, size * 0.32)
  g.addColorStop(0, 'rgba(98,66,34,0.8)')
  g.addColorStop(0.7, 'rgba(110,76,40,0.55)')
  g.addColorStop(1, 'rgba(110,76,40,0)')
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.ellipse(size * 0.55, size * 0.6, size * 0.32, size * 0.22, rand(), 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = 'rgba(84,56,28,0.85)'
  for (let i = 0; i < 4; i++) {
    const x = size * 0.18 + i * size * 0.16
    const y = size * (i % 2 ? 0.22 : 0.34)
    ctx.beginPath()
    ctx.ellipse(x, y, size * 0.045, size * 0.075, 0.3, 0, Math.PI * 2)
    ctx.fill()
    ctx.beginPath()
    ctx.ellipse(x + size * 0.01, y - size * 0.1, size * 0.03, size * 0.035, 0, 0, Math.PI * 2)
    ctx.fill()
  }
  return c
}

// Yellow-brown grime ring (toilet bowl, sink basin).
export function paintGrimeRing(size = 128) {
  const c = canvas(size)
  const ctx = c.getContext('2d')
  const g = ctx.createRadialGradient(size / 2, size / 2, size * 0.1, size / 2, size / 2, size / 2)
  g.addColorStop(0, 'rgba(150,120,40,0.15)')
  g.addColorStop(0.6, 'rgba(130,95,35,0.7)')
  g.addColorStop(0.85, 'rgba(110,80,30,0.9)')
  g.addColorStop(1, 'rgba(110,80,30,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, size, size)
  return c
}

// Smudgy hand prints for the bathroom mirror.
export function paintSmudge(seed = 1, size = 128) {
  const rand = mulberry32(seed * 3 + 1)
  const c = canvas(size)
  const ctx = c.getContext('2d')
  for (let i = 0; i < 6; i++) {
    const x = size * (0.2 + rand() * 0.6)
    const y = size * (0.2 + rand() * 0.6)
    const r = size * (0.08 + rand() * 0.1)
    const g = ctx.createRadialGradient(x, y, 0, x, y, r)
    g.addColorStop(0, 'rgba(120,110,90,0.55)')
    g.addColorStop(1, 'rgba(120,110,90,0)')
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fill()
  }
  return c
}

// Spray-paint graffiti: a fat outlined tag with drips and a few squiggles.
const TAGS = ['ZAP!', 'YO', 'KRUZ', 'WOW', 'RAD', 'BOOM', 'DUDE', 'MEOW']
export function paintGraffiti(seed = 1, w = 256, h = 160) {
  const rand = mulberry32(seed * 31 + 7)
  const c = canvas(w, h)
  const ctx = c.getContext('2d')
  const cols = ['#ff3d8b', '#2fd7ff', '#7cff4f', '#ffd23f', '#a35bff', '#ff7a12']
  const a = cols[Math.floor(rand() * cols.length)]
  const b = cols[Math.floor(rand() * cols.length)]
  // Spray cloud behind.
  for (let i = 0; i < 4; i++) {
    const x = w * (0.2 + rand() * 0.6)
    const y = h * (0.3 + rand() * 0.4)
    const g = ctx.createRadialGradient(x, y, 0, x, y, w * 0.25)
    g.addColorStop(0, `${b}88`)
    g.addColorStop(1, `${b}00`)
    ctx.fillStyle = g
    ctx.fillRect(0, 0, w, h)
  }
  const tag = TAGS[Math.floor(rand() * TAGS.length)]
  ctx.save()
  ctx.translate(w / 2, h / 2)
  ctx.rotate((rand() - 0.5) * 0.35)
  ctx.font = `700 ${Math.round(h * 0.48)}px ${FONT}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.lineJoin = 'round'
  ctx.lineWidth = 14
  ctx.strokeStyle = '#1b1b22'
  ctx.strokeText(tag, 0, 0)
  ctx.fillStyle = a
  ctx.fillText(tag, 0, 0)
  ctx.restore()
  // Drips.
  ctx.fillStyle = a
  for (let i = 0; i < 6; i++) {
    const x = w * (0.2 + rand() * 0.6)
    const y = h * (0.6 + rand() * 0.1)
    ctx.fillRect(x, y, 4, h * (0.1 + rand() * 0.25))
    ctx.beginPath()
    ctx.arc(x + 2, y + h * 0.3, 3, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.strokeStyle = b
  ctx.lineWidth = 6
  ctx.beginPath()
  ctx.moveTo(w * 0.08, h * 0.85)
  for (let i = 0; i < 6; i++) ctx.quadraticCurveTo(w * (0.15 + i * 0.13), h * (rand() < 0.5 ? 0.7 : 0.95), w * (0.2 + i * 0.13), h * 0.85)
  ctx.stroke()
  return c
}

// A paper flyer taped to a wall: LOST CAT / BAND TONIGHT / YARD SALE ...
const FLYERS = [
  ['LOST', 'CAT', '#e2382a'],
  ['BAND', 'TONIGHT', '#2f6fd0'],
  ['YARD', 'SALE', '#1f9a5a'],
  ['FREE', 'PIANO', '#a35bff'],
  ['GUITAR', 'LESSONS', '#ff7a12'],
  ['UFO', 'SEEN?', '#1b1b22'],
]
export function paintPoster(seed = 1, w = 128, h = 176) {
  const rand = mulberry32(seed * 17 + 11)
  const [l1, l2, col] = FLYERS[Math.floor(rand() * FLYERS.length)]
  const c = canvas(w, h)
  const ctx = c.getContext('2d')
  ctx.fillStyle = ['#fff8e6', '#fff36b', '#ffd6e8', '#d9f2ff'][Math.floor(rand() * 4)]
  ctx.fillRect(6, 6, w - 12, h - 12)
  ctx.fillStyle = col
  ctx.font = `700 30px ${FONT}`
  ctx.textAlign = 'center'
  ctx.fillText(l1, w / 2, 44)
  ctx.font = `700 24px ${FONT}`
  ctx.fillText(l2, w / 2, 74)
  ctx.fillStyle = 'rgba(0,0,0,0.25)'
  ctx.fillRect(28, 86, w - 56, 40)
  for (let i = 0; i < 6; i++) ctx.fillRect(14 + i * 17, 140, 10, 26) // tear-off strips
  ctx.fillStyle = 'rgba(230,225,200,0.85)'
  ctx.fillRect(2, 2, 26, 12)
  ctx.fillRect(w - 28, 2, 26, 12)
  return c
}
