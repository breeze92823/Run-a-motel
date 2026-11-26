// Canvas painters for the furnish system: wallpapers (pattern + wainscot band), floors and
// the card swatches the FURNISH panel shows. Each texture is painted once per design and
// cached; every pattern tiles seamlessly.
import { canvas, paintCarpet, paintChecker, paintTile, paintWallpaper, tex } from '../motel/paint.js'
import { fbm, hexRgb, mulberry32 } from '../textures.js'

const SIZE = 256
const shade = (hex, k) => {
  const [r, g, b] = hexRgb(hex)
  const f = (v) => Math.max(0, Math.min(255, Math.round(k >= 0 ? v + (255 - v) * k : v * (1 + k))))
  return `rgb(${f(r)},${f(g)},${f(b)})`
}
// Draws fn at (x, y) and its wrapped copies, so a motif crossing an edge tiles.
function wrap(size, x, y, r, fn) {
  for (const ox of [-size, 0, size]) for (const oy of [-size, 0, size]) {
    const px = x + ox
    const py = y + oy
    if (px + r < 0 || py + r < 0 || px - r > size || py - r > size) continue
    fn(px, py)
  }
}
function grain(ctx, size, seed, amount = 0.08) {
  const n = fbm(size, 16, 3, seed)
  const img = ctx.getImageData(0, 0, size, size)
  for (let i = 0; i < n.length; i++) {
    const k = 1 - amount / 2 + n[i] * amount
    img.data[i * 4] *= k
    img.data[i * 4 + 1] *= k
    img.data[i * 4 + 2] *= k
  }
  ctx.putImageData(img, 0, 0)
}
function paw(ctx, x, y, s, rot) {
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(rot)
  ctx.beginPath()
  ctx.ellipse(0, s * 0.35, s * 0.55, s * 0.45, 0, 0, Math.PI * 2)
  ctx.fill()
  for (const [tx, ty] of [[-0.62, -0.3], [-0.22, -0.65], [0.22, -0.65], [0.62, -0.3]]) {
    ctx.beginPath()
    ctx.ellipse(tx * s, ty * s, s * 0.2, s * 0.26, 0, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()
}
function flower(ctx, x, y, r, petal, centre) {
  ctx.fillStyle = petal
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2
    ctx.beginPath()
    ctx.ellipse(x + Math.cos(a) * r * 0.55, y + Math.sin(a) * r * 0.55, r * 0.48, r * 0.3, a, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.fillStyle = centre
  ctx.beginPath()
  ctx.arc(x, y, r * 0.28, 0, Math.PI * 2)
  ctx.fill()
}

// --- Wallpaper patterns ---------------------------------------------------------------------
function paintPattern(p, seed = 7) {
  if (p.kind === 'stars') return paintWallpaper(p.bg, p.fg, SIZE, 81)
  const c = canvas(SIZE)
  const ctx = c.getContext('2d')
  const rand = mulberry32(seed)
  ctx.fillStyle = p.bg
  ctx.fillRect(0, 0, SIZE, SIZE)
  switch (p.kind) {
    case 'stripes': {
      const n = 8
      const w = SIZE / n
      for (let i = 0; i < n; i += 2) {
        ctx.fillStyle = p.fg
        ctx.fillRect(i * w, 0, w, SIZE)
        ctx.fillStyle = 'rgba(255,255,255,0.45)'
        ctx.fillRect(i * w + w * 1.45, 0, 2, SIZE)
      }
      break
    }
    case 'dots': {
      ctx.fillStyle = p.fg
      for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
        const cx = (x + (y % 2) * 0.5) * (SIZE / 4) + SIZE / 8
        const cy = y * (SIZE / 4) + SIZE / 8
        wrap(SIZE, cx, cy, 14, (px, py) => {
          ctx.beginPath()
          ctx.arc(px, py, 11, 0, Math.PI * 2)
          ctx.fill()
        })
      }
      break
    }
    case 'diamonds': {
      ctx.strokeStyle = p.fg
      ctx.lineWidth = 3
      const s = SIZE / 4
      for (let i = -4; i <= 8; i++) {
        ctx.beginPath()
        ctx.moveTo(i * s, 0)
        ctx.lineTo(i * s + SIZE, SIZE)
        ctx.moveTo(i * s, 0)
        ctx.lineTo(i * s - SIZE, SIZE)
        ctx.stroke()
      }
      ctx.fillStyle = '#ffffff'
      for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
        ctx.beginPath()
        ctx.arc(x * s + s / 2, y * s + s / 2, 4, 0, Math.PI * 2)
        ctx.fill()
      }
      break
    }
    case 'flowers': {
      for (let i = 0; i < 9; i++) {
        const x = ((i % 3) + (Math.floor(i / 3) % 2) * 0.5) * (SIZE / 3) + rand() * 10
        const y = Math.floor(i / 3) * (SIZE / 3) + SIZE / 6 + rand() * 10
        const r = 20 + rand() * 8
        wrap(SIZE, x, y, r * 1.4, (px, py) => flower(ctx, px, py, r, p.fg, '#fff7e0'))
      }
      break
    }
    case 'paws': {
      ctx.fillStyle = p.fg
      for (let i = 0; i < 8; i++) {
        const x = ((i % 4) + (Math.floor(i / 4) % 2) * 0.5) * (SIZE / 4)
        const y = Math.floor(i / 4) * (SIZE / 2) + SIZE / 4
        const rot = rand() * 0.8 - 0.4
        wrap(SIZE, x, y, 26, (px, py) => paw(ctx, px, py, 16, rot))
      }
      break
    }
    case 'panels': {
      const n = 4
      const w = SIZE / n
      for (let i = 0; i < n; i++) {
        ctx.fillStyle = p.fg
        ctx.fillRect(i * w + 6, 0, 3, SIZE)
        ctx.fillRect(i * w + w - 9, 0, 3, SIZE)
        ctx.fillStyle = 'rgba(255,255,255,0.35)'
        ctx.fillRect(i * w + 10, 0, 2, SIZE)
      }
      break
    }
    case 'damask': {
      ctx.fillStyle = p.fg
      ctx.strokeStyle = p.fg
      ctx.lineWidth = 3
      const motif = (x, y) => {
        ctx.save()
        ctx.translate(x, y)
        ctx.beginPath()
        ctx.moveTo(0, -34)
        ctx.bezierCurveTo(22, -20, 22, 8, 0, 34)
        ctx.bezierCurveTo(-22, 8, -22, -20, 0, -34)
        ctx.stroke()
        ctx.beginPath()
        ctx.moveTo(0, -18)
        ctx.lineTo(9, 0)
        ctx.lineTo(0, 18)
        ctx.lineTo(-9, 0)
        ctx.closePath()
        ctx.fill()
        for (const s of [-1, 1]) {
          ctx.beginPath()
          ctx.arc(s * 16, -22, 6, 0, Math.PI * 2)
          ctx.stroke()
          ctx.beginPath()
          ctx.arc(s * 16, 22, 6, 0, Math.PI * 2)
          ctx.stroke()
        }
        ctx.restore()
      }
      for (const [x, y] of [[64, 64], [192, 192], [192, 64], [64, 192]]) wrap(SIZE, x, y, 44, (px, py) => ((x + y) % 256 === 0 ? motif(px, py) : (ctx.beginPath(), ctx.arc(px, py, 5, 0, Math.PI * 2), ctx.fill())))
      break
    }
    default:
      break
  }
  grain(ctx, SIZE, seed + 3, 0.07)
  return c
}

// Wainscot boards in the band colour (bevelled, like the motel's teal boards).
function paintBand(color, w = SIZE, h = SIZE, boards = 4) {
  const c = canvas(w, h)
  const ctx = c.getContext('2d')
  const bw = w / boards
  for (let i = 0; i < boards; i++) {
    const g = ctx.createLinearGradient(i * bw, 0, (i + 1) * bw, 0)
    g.addColorStop(0, shade(color, 0.35))
    g.addColorStop(0.08, color)
    g.addColorStop(0.9, color)
    g.addColorStop(1, shade(color, -0.3))
    ctx.fillStyle = g
    ctx.fillRect(i * bw, 0, bw, h)
  }
  return c
}

// --- Floors -------------------------------------------------------------------------------------
function paintFloor(p, seed = 17) {
  switch (p.kind) {
    case 'carpet':
      return paintCarpet(p.bg, p.fg, SIZE, seed)
    case 'checker': {
      const c = paintChecker(p.fg, p.bg, SIZE, 4)
      const ctx = c.getContext('2d')
      ctx.fillStyle = 'rgba(255,255,255,0.08)'
      for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) ctx.fillRect(x * 64 + 4, y * 64 + 4, 56, 6)
      grain(ctx, SIZE, seed, 0.05)
      return c
    }
    case 'tiles':
      return paintTile(p.bg, p.fg, '#eef6f1', SIZE, 6)
    default:
      break
  }
  const c = canvas(SIZE)
  const ctx = c.getContext('2d')
  const rand = mulberry32(seed)
  ctx.fillStyle = p.bg
  ctx.fillRect(0, 0, SIZE, SIZE)
  if (p.kind === 'planks') {
    const rows = 6
    const h = SIZE / rows
    for (let r = 0; r < rows; r++) {
      const off = rand() * SIZE
      ctx.fillStyle = shade(p.bg, (rand() - 0.5) * 0.18)
      ctx.fillRect(0, r * h, SIZE, h)
      ctx.strokeStyle = p.fg
      ctx.globalAlpha = 0.35
      for (let k = 0; k < 4; k++) {
        ctx.beginPath()
        const y = r * h + 4 + rand() * (h - 8)
        ctx.moveTo(0, y)
        ctx.bezierCurveTo(SIZE * 0.3, y + rand() * 6 - 3, SIZE * 0.7, y + rand() * 6 - 3, SIZE, y)
        ctx.stroke()
      }
      ctx.globalAlpha = 1
      ctx.fillStyle = shade(p.fg, -0.35)
      ctx.fillRect(0, r * h, SIZE, 2)
      ctx.fillRect(off % SIZE, r * h, 2, h)
      ctx.fillRect((off + SIZE / 2) % SIZE, r * h, 2, h)
    }
  } else if (p.kind === 'parquet') {
    const s = SIZE / 4
    for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
      const vertical = (x + y) % 2 === 0
      for (let k = 0; k < 4; k++) {
        ctx.fillStyle = shade(k % 2 ? p.fg : p.bg, (rand() - 0.5) * 0.15)
        if (vertical) ctx.fillRect(x * s + (k * s) / 4, y * s, s / 4 - 1, s - 1)
        else ctx.fillRect(x * s, y * s + (k * s) / 4, s - 1, s / 4 - 1)
      }
    }
    grain(ctx, SIZE, seed, 0.12)
  } else if (p.kind === 'pawCarpet') {
    const base = paintCarpet(p.bg, p.bg, SIZE, seed)
    ctx.drawImage(base, 0, 0)
    ctx.fillStyle = p.fg
    for (let i = 0; i < 6; i++) {
      const x = ((i % 3) + (Math.floor(i / 3) % 2) * 0.5) * (SIZE / 3)
      const y = Math.floor(i / 3) * (SIZE / 2) + SIZE / 4
      wrap(SIZE, x, y, 26, (px, py) => paw(ctx, px, py, 15, rand() - 0.5))
    }
  } else if (p.kind === 'velvet') {
    const n = fbm(SIZE, 24, 3, seed)
    const img = ctx.getImageData(0, 0, SIZE, SIZE)
    const [r, g, b] = hexRgb(p.bg)
    for (let i = 0; i < n.length; i++) {
      const k = 0.85 + n[i] * 0.3
      img.data[i * 4] = r * k
      img.data[i * 4 + 1] = g * k
      img.data[i * 4 + 2] = b * k
    }
    ctx.putImageData(img, 0, 0)
    ctx.strokeStyle = p.fg
    ctx.lineWidth = 2
    ctx.globalAlpha = 0.6
    for (let i = -4; i <= 8; i++) {
      ctx.beginPath()
      ctx.moveTo(i * 64, 0)
      ctx.lineTo(i * 64 + SIZE, SIZE)
      ctx.moveTo(i * 64, 0)
      ctx.lineTo(i * 64 - SIZE, SIZE)
      ctx.stroke()
    }
    ctx.globalAlpha = 1
  } else if (p.kind === 'marble') {
    const n = fbm(SIZE, 4, 5, seed)
    const img = ctx.getImageData(0, 0, SIZE, SIZE)
    const [r, g, b] = hexRgb(p.bg)
    const [vr, vg, vb] = hexRgb(p.fg)
    for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
      const i = y * SIZE + x
      const v = Math.pow(Math.abs(Math.sin((x + y) * 0.02 + n[i] * 9)), 10)
      img.data[i * 4] = r + (vr - r) * v
      img.data[i * 4 + 1] = g + (vg - g) * v
      img.data[i * 4 + 2] = b + (vb - b) * v
    }
    ctx.putImageData(img, 0, 0)
    ctx.fillStyle = 'rgba(160,150,140,0.5)'
    ctx.fillRect(0, 0, SIZE, 2)
    ctx.fillRect(0, SIZE / 2, SIZE, 2)
    ctx.fillRect(0, 0, 2, SIZE)
    ctx.fillRect(SIZE / 2, 0, 2, SIZE)
  }
  return c
}

// --- Cached textures + swatches ----------------------------------------------------------------
const cache = new Map()
function cached(key, make) {
  if (!cache.has(key)) cache.set(key, make())
  return cache.get(key)
}
export const wallCanvas = (w) => cached(`wc:${w.id}`, () => paintPattern(w.paint, w.id.length * 13))
export const bandCanvas = (w) => cached(`bc:${w.id}`, () => paintBand(w.paint.band))
export const floorCanvas = (f) => cached(`fc:${f.id}`, () => paintFloor(f.paint, f.id.length * 7))
export const wallTex = (w) => cached(`wt:${w.id}`, () => tex(wallCanvas(w)))
export const bandTex = (w) => cached(`bt:${w.id}`, () => tex(bandCanvas(w)))
export const floorTex = (f) => cached(`ft:${f.id}`, () => tex(floorCanvas(f)))

// Card swatch: the pattern on top, the band below (walls), or the floor tile.
export function wallSwatch(w) {
  return cached(`ws:${w.id}`, () => {
    const c = canvas(200, 140)
    const ctx = c.getContext('2d')
    const pat = ctx.createPattern(wallCanvas(w), 'repeat')
    ctx.setTransform(0.55, 0, 0, 0.55, 0, 0)
    ctx.fillStyle = pat
    ctx.fillRect(0, 0, 200 / 0.55, 100 / 0.55)
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.drawImage(bandCanvas(w), 0, 0, 256, 256, 0, 100, 200, 40)
    ctx.fillStyle = 'rgba(255,255,255,0.7)'
    ctx.fillRect(0, 98, 200, 4)
    return c.toDataURL()
  })
}
export function floorSwatch(f) {
  return cached(`fs:${f.id}`, () => {
    const c = canvas(200, 140)
    const ctx = c.getContext('2d')
    ctx.setTransform(0.7, 0, 0, 0.7, 0, 0)
    ctx.fillStyle = ctx.createPattern(floorCanvas(f), 'repeat')
    ctx.fillRect(0, 0, 200 / 0.7, 140 / 0.7)
    return c.toDataURL()
  })
}
