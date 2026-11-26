// Procedural furniture for the FURNISH system. Every maker returns a Group standing on
// y = 0, centred on x / z, its front facing +Z (wall art: its back on z = 0). Moving
// parts set userData.anim(t, dt) (fan blades, glowing screens, the magic bed's stars).
// Bed variants are overlays in the room bed's own frame (headboard at x = 0, foot +X).
import {
  CircleGeometry,
  ConeGeometry,
  CylinderGeometry,
  DoubleSide,
  Group,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
  SphereGeometry,
  TorusGeometry,
} from 'three'
import { box, mat, rbox, textures } from '../motel/kit.js'
import { makeFridge, makeTV, makeVanity } from '../motel/rooms.js'
import { canvas, tex } from '../motel/paint.js'
import { mulberry32 } from '../textures.js'

const wood = () => mat('#c67a35', { map: textures().wood, roughness: 0.6 })
const woodLight = () => mat('#e7b874', { map: textures().wood, roughness: 0.65 })
const woodDark = () => mat('#7a4626', { map: textures().wood, roughness: 0.55 })
const brass = () => mat('#e2b33c', { metalness: 0.85, roughness: 0.3 })
const chrome = () => mat('#dfe5e8', { metalness: 0.9, roughness: 0.18 })
const glowMat = (color, k = 1.4) => new MeshStandardMaterial({ color, emissive: color, emissiveIntensity: k, roughness: 0.4 })

function cyl(g, rt, rb, h, m, x, y, z, seg = 16) {
  const c = new Mesh(new CylinderGeometry(rt, rb, h, seg), m)
  c.position.set(x, y, z)
  c.castShadow = true
  c.receiveShadow = true
  g.add(c)
  return c
}
function ball(g, r, m, x, y, z, seg = 12) {
  const s = new Mesh(new SphereGeometry(r, seg, Math.max(6, seg / 2 + 2)), m)
  s.position.set(x, y, z)
  s.castShadow = true
  g.add(s)
  return s
}
const knob = (g, x, y, z) => ball(g, 0.025, brass(), x, y, z, 8)

// --- Small canvas art -----------------------------------------------------------------------
const artCache = new Map()
function artTex(key, w, h, draw) {
  if (!artCache.has(key)) {
    const c = canvas(w, h)
    draw(c.getContext('2d'), w, h)
    artCache.set(key, tex(c, { wrap: false }))
  }
  return artCache.get(key)
}
const desertArt = () => artTex('desert', 256, 180, (ctx, w, h) => {
  const sky = ctx.createLinearGradient(0, 0, 0, h)
  sky.addColorStop(0, '#ff9a5a')
  sky.addColorStop(0.55, '#ffd27a')
  sky.addColorStop(0.56, '#e9a35c')
  sky.addColorStop(1, '#c9773e')
  ctx.fillStyle = sky
  ctx.fillRect(0, 0, w, h)
  ctx.fillStyle = '#fff1b8'
  ctx.beginPath()
  ctx.arc(w * 0.68, h * 0.42, 26, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#a4563a'
  ctx.beginPath()
  ctx.moveTo(0, h * 0.62)
  ctx.lineTo(w * 0.12, h * 0.38)
  ctx.lineTo(w * 0.32, h * 0.38)
  ctx.lineTo(w * 0.4, h * 0.6)
  ctx.closePath()
  ctx.fill()
  ctx.fillStyle = '#2f8a5c'
  const cactus = (x, s) => {
    ctx.fillRect(x, h - 70 * s, 12 * s, 70 * s)
    ctx.fillRect(x - 14 * s, h - 50 * s, 10 * s, 26 * s)
    ctx.fillRect(x - 14 * s, h - 30 * s, 20 * s, 8 * s)
    ctx.fillRect(x + 14 * s, h - 60 * s, 10 * s, 28 * s)
    ctx.fillRect(x + 6 * s, h - 38 * s, 18 * s, 8 * s)
  }
  cactus(w * 0.2, 1)
  cactus(w * 0.82, 0.7)
})
const portraitArt = () => artTex('portrait', 160, 200, (ctx, w, h) => {
  const bg = ctx.createRadialGradient(w / 2, h * 0.4, 10, w / 2, h / 2, h * 0.7)
  bg.addColorStop(0, '#3f7f72')
  bg.addColorStop(1, '#12302a')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, w, h)
  ctx.fillStyle = '#2a1a3a'
  ctx.beginPath()
  ctx.ellipse(w / 2, h * 0.95, w * 0.42, h * 0.32, 0, Math.PI, 0)
  ctx.fill()
  ctx.fillStyle = '#f2c9a0'
  ctx.beginPath()
  ctx.ellipse(w / 2, h * 0.42, w * 0.2, h * 0.18, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#5a3420'
  ctx.beginPath()
  ctx.ellipse(w / 2, h * 0.32, w * 0.23, h * 0.12, 0, Math.PI, 0)
  ctx.fill()
  ctx.fillStyle = '#e8c068'
  for (let i = 0; i < 5; i++) {
    ctx.beginPath()
    ctx.moveTo(w / 2 - 28 + i * 14, h * 0.2)
    ctx.lineTo(w / 2 - 21 + i * 14, h * 0.1)
    ctx.lineTo(w / 2 - 14 + i * 14, h * 0.2)
    ctx.fill()
  }
  ctx.fillRect(w / 2 - 30, h * 0.19, 60, 8)
})
const rugArt = (persian) => artTex(persian ? 'persian' : 'rug', 256, persian ? 180 : 256, (ctx, w, h) => {
  if (persian) {
    ctx.fillStyle = '#9c1f2e'
    ctx.fillRect(0, 0, w, h)
    ctx.strokeStyle = '#e8c068'
    ctx.lineWidth = 8
    ctx.strokeRect(12, 12, w - 24, h - 24)
    ctx.strokeStyle = '#1f3a6a'
    ctx.lineWidth = 6
    ctx.strokeRect(26, 26, w - 52, h - 52)
    ctx.fillStyle = '#e8c068'
    ctx.beginPath()
    ctx.moveTo(w / 2, h * 0.22)
    ctx.lineTo(w * 0.72, h / 2)
    ctx.lineTo(w / 2, h * 0.78)
    ctx.lineTo(w * 0.28, h / 2)
    ctx.closePath()
    ctx.fill()
    ctx.fillStyle = '#1f3a6a'
    ctx.beginPath()
    ctx.arc(w / 2, h / 2, 18, 0, Math.PI * 2)
    ctx.fill()
    const rand = mulberry32(5)
    ctx.fillStyle = '#f3e6c8'
    for (let i = 0; i < 40; i++) ctx.fillRect(34 + rand() * (w - 68), 34 + rand() * (h - 68), 3, 3)
  } else {
    const cols = ['#f2a6b8', '#fbe0e6', '#e86a8a', '#fbe0e6', '#f2a6b8', '#ffffff']
    for (let i = 0; i < cols.length; i++) {
      ctx.fillStyle = cols[i]
      ctx.beginPath()
      ctx.arc(w / 2, h / 2, (w / 2) * (1 - i / cols.length), 0, Math.PI * 2)
      ctx.fill()
    }
  }
})
const starQuilt = () => artTex('starQuilt', 128, 128, (ctx, w, h) => {
  ctx.fillStyle = '#6a3fc9'
  ctx.fillRect(0, 0, w, h)
  ctx.fillStyle = '#ffe58a'
  const rand = mulberry32(9)
  for (let i = 0; i < 14; i++) {
    const x = rand() * w
    const y = rand() * h
    const r = 3 + rand() * 4
    ctx.beginPath()
    for (let k = 0; k < 10; k++) {
      const a = (k / 10) * Math.PI * 2
      const rr = k % 2 ? r * 0.45 : r
      ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr)
    }
    ctx.fill()
  }
})
const stripeQuilt = () => artTex('stripeQuilt', 128, 128, (ctx, w, h) => {
  const cols = ['#f6c232', '#fff7e6', '#1f8a78', '#fff7e6']
  for (let i = 0; i < 8; i++) {
    ctx.fillStyle = cols[i % 4]
    ctx.fillRect(0, (i * h) / 8, w, h / 8)
  }
})

// --- Storage ----------------------------------------------------------------------------------
function nightstand() {
  const g = new Group()
  rbox(g, 0.5, 0.56, 0.44, 0.03, wood(), 0, 0.28, 0)
  box(g, 0.44, 0.18, 0.02, woodLight(), 0, 0.42, 0.22)
  knob(g, 0, 0.42, 0.24)
  box(g, 0.42, 0.02, 0.4, woodDark(), 0, 0.2, 0.01)
  rbox(g, 0.12, 0.16, 0.08, 0.02, mat('#e86a5a'), -0.1, 0.11, 0.08) // a book on the shelf
  return g
}
function fileCabinet() {
  const g = new Group()
  rbox(g, 0.5, 1.1, 0.55, 0.03, mat('#7fa6c9', { metalness: 0.4, roughness: 0.45 }), 0, 0.55, 0)
  for (let i = 0; i < 3; i++) {
    box(g, 0.44, 0.3, 0.02, mat('#93b9db', { metalness: 0.4, roughness: 0.4 }), 0, 0.22 + i * 0.34, 0.28)
    box(g, 0.16, 0.03, 0.03, chrome(), 0, 0.3 + i * 0.34, 0.3)
    box(g, 0.1, 0.05, 0.01, mat('#fffaf0'), 0, 0.24 + i * 0.34, 0.295)
  }
  return g
}
function toyChest() {
  const g = new Group()
  rbox(g, 0.95, 0.48, 0.52, 0.05, mat('#1f9e8a', { roughness: 0.6 }), 0, 0.24, 0)
  box(g, 0.97, 0.06, 0.54, mat('#f6c232'), 0, 0.12, 0)
  const lid = rbox(g, 0.97, 0.08, 0.54, 0.04, mat('#e8574a', { roughness: 0.6 }), 0, 0.53, -0.12)
  lid.rotation.x = -0.5
  ball(g, 0.12, mat('#3d8be0', { roughness: 0.4 }), -0.22, 0.52, 0.05)
  rbox(g, 0.16, 0.16, 0.16, 0.02, mat('#f6c232'), 0.12, 0.5, 0.06).rotation.y = 0.4
  cyl(g, 0.04, 0.04, 0.3, mat('#e8574a'), 0.3, 0.55, 0.02).rotation.z = 0.5
  return g
}
function dresser() {
  const g = new Group()
  rbox(g, 1.2, 0.86, 0.5, 0.03, wood(), 0, 0.45, 0)
  for (let r = 0; r < 3; r++) for (let c = 0; c < 2; c++) {
    box(g, 0.54, 0.22, 0.02, woodLight(), -0.29 + c * 0.58, 0.2 + r * 0.25, 0.25)
    knob(g, -0.29 + c * 0.58, 0.2 + r * 0.25, 0.27)
  }
  for (const x of [-0.55, 0.55]) box(g, 0.06, 0.06, 0.06, woodDark(), x, 0.03, 0.2)
  cyl(g, 0.07, 0.09, 0.22, mat('#f19cb0'), 0.35, 1.0, 0) // a vase
  ball(g, 0.07, mat('#ffd34a'), 0.35, 1.14, 0)
  return g
}
function bookcase() {
  const g = new Group()
  const W = 0.9
  const H = 1.75
  box(g, W, H, 0.04, woodDark(), 0, H / 2, -0.16)
  for (const x of [-W / 2, W / 2]) box(g, 0.05, H, 0.36, wood(), x, H / 2, 0)
  const rand = mulberry32(3)
  const cols = ['#e86a5a', '#3d8be0', '#f6c232', '#2aa596', '#8a62c9', '#f19cb0', '#5cbf4a']
  for (let s = 0; s < 5; s++) {
    const y = 0.03 + s * 0.42
    box(g, W, 0.04, 0.36, wood(), 0, y, 0)
    if (s === 4) continue
    let x = -W / 2 + 0.06
    while (x < W / 2 - 0.1) {
      const w = 0.05 + rand() * 0.05
      const h = 0.24 + rand() * 0.1
      const b = box(g, w, h, 0.24, mat(cols[Math.floor(rand() * cols.length)], { roughness: 0.8 }), x + w / 2, y + 0.02 + h / 2, 0.02)
      if (rand() < 0.15) b.rotation.z = 0.25
      x += w + 0.008
    }
  }
  return g
}
function vanityTable() {
  const g = new Group()
  const white = mat('#fbf1f6', { roughness: 0.4 })
  rbox(g, 1.0, 0.06, 0.45, 0.02, white, 0, 0.75, 0)
  for (const x of [-0.45, 0.45]) for (const z of [-0.18, 0.18]) cyl(g, 0.025, 0.02, 0.72, mat('#c9b3ef'), x, 0.36, z, 8)
  box(g, 0.5, 0.12, 0.4, mat('#c9b3ef'), 0, 0.66, 0)
  knob(g, 0, 0.66, 0.21)
  const frame = new Mesh(new TorusGeometry(0.3, 0.035, 8, 28), brass())
  frame.scale.set(0.85, 1.1, 1)
  frame.position.set(0, 1.18, -0.18)
  g.add(frame)
  const glass = new Mesh(new CircleGeometry(0.29, 28), mat('#e0f4fb', { metalness: 0.9, roughness: 0.05 }))
  glass.scale.set(0.85, 1.1, 1)
  glass.position.set(0, 1.18, -0.19)
  g.add(glass)
  cyl(g, 0.18, 0.18, 0.08, mat('#f19cb0', { roughness: 0.9 }), 0, 0.42, 0.42, 16) // stool
  cyl(g, 0.03, 0.03, 0.38, brass(), 0, 0.19, 0.42, 8)
  cyl(g, 0.04, 0.05, 0.1, mat('#e86a8a'), 0.3, 0.83, 0, 10) // perfume
  return g
}

// --- Seating ----------------------------------------------------------------------------------
function deskChair() {
  const g = new Group()
  const red = mat('#e8574a', { roughness: 0.45 })
  rbox(g, 0.48, 0.07, 0.46, 0.03, red, 0, 0.47, 0)
  rbox(g, 0.46, 0.4, 0.06, 0.03, red, 0, 0.78, -0.2)
  for (const x of [-0.19, 0.19]) for (const z of [-0.18, 0.18]) cyl(g, 0.018, 0.018, 0.46, chrome(), x, 0.23, z, 8)
  box(g, 0.04, 0.3, 0.03, chrome(), 0, 0.6, -0.21)
  return g
}
function armchair() {
  const g = new Group()
  const fab = mat('#1f9e8a', { roughness: 0.95 })
  const dark = mat('#147a63', { roughness: 0.95 })
  rbox(g, 0.86, 0.22, 0.78, 0.07, fab, 0, 0.3, 0)
  rbox(g, 0.66, 0.14, 0.62, 0.06, mat('#58c7a8', { roughness: 1 }), 0, 0.46, 0.04)
  rbox(g, 0.86, 0.6, 0.18, 0.08, dark, 0, 0.68, -0.31)
  for (const x of [-0.37, 0.37]) rbox(g, 0.14, 0.32, 0.74, 0.06, dark, x, 0.52, 0)
  for (const x of [-0.34, 0.34]) for (const z of [-0.3, 0.3]) cyl(g, 0.03, 0.02, 0.2, woodDark(), x, 0.1, z, 8)
  rbox(g, 0.32, 0.28, 0.12, 0.06, mat('#ffd6a0', { roughness: 1 }), 0.12, 0.62, -0.18).rotation.z = 0.2
  return g
}
function loveseat() {
  const g = new Group()
  const fab = mat('#e86a8a', { roughness: 0.95 })
  const dark = mat('#c45a78', { roughness: 0.95 })
  rbox(g, 1.6, 0.24, 0.8, 0.07, dark, 0, 0.3, 0)
  for (const x of [-0.37, 0.37]) rbox(g, 0.7, 0.16, 0.64, 0.07, fab, x, 0.48, 0.05)
  for (const x of [-0.37, 0.37]) rbox(g, 0.7, 0.5, 0.18, 0.08, fab, x, 0.72, -0.3)
  for (const x of [-0.78, 0.78]) rbox(g, 0.16, 0.36, 0.78, 0.07, dark, x, 0.55, 0)
  for (const x of [-0.7, 0.7]) for (const z of [-0.3, 0.3]) cyl(g, 0.035, 0.02, 0.2, brass(), x, 0.1, z, 8)
  rbox(g, 0.3, 0.3, 0.12, 0.06, mat('#fbe0e6'), -0.55, 0.66, -0.16).rotation.z = -0.25
  return g
}

// --- Tables ------------------------------------------------------------------------------------
function sideTable() {
  const g = new Group()
  cyl(g, 0.36, 0.36, 0.05, wood(), 0, 0.6, 0, 24)
  cyl(g, 0.05, 0.07, 0.55, woodDark(), 0, 0.3, 0, 12)
  cyl(g, 0.24, 0.26, 0.04, woodDark(), 0, 0.02, 0, 20)
  return g
}
function desk() {
  const g = new Group()
  rbox(g, 1.2, 0.06, 0.6, 0.02, wood(), 0, 0.74, 0)
  rbox(g, 0.4, 0.5, 0.56, 0.02, wood(), 0.38, 0.46, 0)
  for (let i = 0; i < 2; i++) {
    box(g, 0.34, 0.2, 0.02, woodLight(), 0.38, 0.35 + i * 0.23, 0.29)
    knob(g, 0.38, 0.35 + i * 0.23, 0.31)
  }
  for (const z of [-0.25, 0.25]) box(g, 0.05, 0.71, 0.05, woodDark(), -0.55, 0.36, z)
  rbox(g, 0.3, 0.02, 0.22, 0.01, mat('#fffaf0'), -0.2, 0.78, 0.05).rotation.y = 0.2 // papers
  cyl(g, 0.01, 0.01, 0.16, mat('#2f4a6e'), 0.05, 0.78, 0.08, 6).rotation.z = Math.PI / 2
  return g
}
function coffeeTable() {
  const g = new Group()
  const glass = new MeshStandardMaterial({ color: '#cdeef4', transparent: true, opacity: 0.45, roughness: 0.05, metalness: 0.2 })
  rbox(g, 1.1, 0.03, 0.62, 0.015, glass, 0, 0.45, 0)
  for (const x of [-0.5, 0.5]) for (const z of [-0.26, 0.26]) cyl(g, 0.02, 0.02, 0.44, brass(), x, 0.22, z, 8)
  box(g, 1.04, 0.02, 0.02, brass(), 0, 0.43, 0.28)
  box(g, 1.04, 0.02, 0.02, brass(), 0, 0.43, -0.28)
  rbox(g, 0.28, 0.06, 0.2, 0.02, mat('#8a62c9'), -0.25, 0.5, 0) // books
  rbox(g, 0.24, 0.05, 0.18, 0.02, mat('#f6c232'), -0.24, 0.55, 0.01)
  ball(g, 0.08, mat('#e86a5a'), 0.3, 0.52, 0.05)
  return g
}

// --- Decor -------------------------------------------------------------------------------------
function tableLamp() {
  const g = new Group()
  ball(g, 0.12, mat('#2aa596', { roughness: 0.3 }), 0, 0.12, 0, 14)
  cyl(g, 0.02, 0.02, 0.2, brass(), 0, 0.3, 0, 8)
  const shade = cyl(g, 0.1, 0.2, 0.22, new MeshStandardMaterial({ color: '#fff3dc', emissive: '#ffd9a0', emissiveIntensity: 0.35, side: DoubleSide, roughness: 0.8 }), 0, 0.48, 0, 18)
  shade.castShadow = false
  g.userData.glow = shade.material
  return g
}
function floorLamp() {
  const g = new Group()
  cyl(g, 0.2, 0.22, 0.04, brass(), 0, 0.02, 0, 20)
  cyl(g, 0.02, 0.02, 1.55, brass(), 0, 0.8, 0, 8)
  const shade = cyl(g, 0.16, 0.3, 0.32, new MeshStandardMaterial({ color: '#fff3dc', emissive: '#ffd9a0', emissiveIntensity: 0.35, side: DoubleSide, roughness: 0.8 }), 0, 1.65, 0, 20)
  shade.castShadow = false
  g.userData.glow = shade.material
  return g
}
function framed(w, h, frameMat, map, ornate) {
  const g = new Group()
  const t = ornate ? 0.09 : 0.06
  box(g, w + t * 2, t, 0.05, frameMat, 0, h / 2 + t / 2, 0.025)
  box(g, w + t * 2, t, 0.05, frameMat, 0, -h / 2 - t / 2, 0.025)
  box(g, t, h, 0.05, frameMat, -w / 2 - t / 2, 0, 0.025)
  box(g, t, h, 0.05, frameMat, w / 2 + t / 2, 0, 0.025)
  if (ornate) for (const x of [-1, 1]) for (const y of [-1, 1]) ball(g, 0.05, frameMat, x * (w / 2 + t / 2), y * (h / 2 + t / 2), 0.05, 8)
  const pic = new Mesh(new PlaneGeometry(w, h), new MeshStandardMaterial({ map, roughness: 0.7 }))
  pic.position.z = 0.02
  g.add(pic)
  return g
}
const painting = () => framed(1.0, 0.7, woodDark(), desertArt(), false)
const portrait = () => framed(0.72, 0.9, mat('#e2b33c', { metalness: 0.8, roughness: 0.3 }), portraitArt(), true)
function rug() {
  const g = new Group()
  const m = new Mesh(new CircleGeometry(1.05, 40), new MeshStandardMaterial({ map: rugArt(false), roughness: 1, polygonOffset: true, polygonOffsetFactor: -1 }))
  m.rotation.x = -Math.PI / 2
  m.position.y = 0.006
  m.receiveShadow = true
  g.add(m)
  return g
}
function persianRug() {
  const g = new Group()
  const m = new Mesh(new PlaneGeometry(2.4, 1.7), new MeshStandardMaterial({ map: rugArt(true), roughness: 1, polygonOffset: true, polygonOffsetFactor: -1 }))
  m.rotation.x = -Math.PI / 2
  m.position.y = 0.006
  m.receiveShadow = true
  g.add(m)
  const fringe = mat('#f3e6c8')
  for (const x of [-1.22, 1.22]) box(g, 0.05, 0.01, 1.6, fringe, x, 0.008, 0)
  return g
}
function plant() {
  const g = new Group()
  cyl(g, 0.22, 0.16, 0.36, mat('#d9774a', { roughness: 0.8 }), 0, 0.18, 0, 16)
  cyl(g, 0.21, 0.21, 0.02, mat('#5a3a22'), 0, 0.35, 0, 16)
  cyl(g, 0.03, 0.04, 0.7, mat('#8a6a3a'), 0, 0.7, 0, 8)
  const leaf = mat('#3faa5c', { side: DoubleSide, roughness: 0.7 })
  const leaves = new Group()
  for (let i = 0; i < 7; i++) {
    const l = new Mesh(new ConeGeometry(0.1, 0.75, 4, 1), leaf)
    const a = (i / 7) * Math.PI * 2
    l.position.set(Math.cos(a) * 0.28, 1.05, Math.sin(a) * 0.28)
    l.rotation.set(Math.sin(a) * 1.1, 0, -Math.cos(a) * 1.1)
    l.scale.set(1, 1, 0.25)
    l.castShadow = true
    leaves.add(l)
  }
  g.add(leaves)
  g.userData.anim = (t) => {
    leaves.rotation.z = Math.sin(t * 1.3) * 0.03
    leaves.rotation.x = Math.cos(t * 1.1) * 0.03
  }
  return g
}
function orchid() {
  const g = new Group()
  cyl(g, 0.18, 0.2, 0.7, mat('#fbf1f6', { roughness: 0.3 }), 0, 0.35, 0, 16) // pedestal
  cyl(g, 0.12, 0.09, 0.18, mat('#8a62c9'), 0, 0.79, 0, 14)
  const stem = mat('#4f8a3a')
  for (let i = 0; i < 3; i++) {
    const a = i * 2.1
    const s = cyl(g, 0.008, 0.008, 0.55, stem, Math.cos(a) * 0.04, 1.12, Math.sin(a) * 0.04, 5)
    s.rotation.set(Math.sin(a) * 0.25, 0, Math.cos(a) * 0.25)
    for (let k = 0; k < 4; k++) ball(g, 0.045, mat(k % 2 ? '#f19cd8' : '#ffffff', { roughness: 0.6 }), Math.cos(a) * (0.08 + k * 0.04), 1.2 + k * 0.08, Math.sin(a) * (0.08 + k * 0.04), 8)
  }
  for (let i = 0; i < 3; i++) {
    const l = new Mesh(new SphereGeometry(0.12, 10, 6), mat('#3f8f4a'))
    l.scale.set(1, 0.18, 0.45)
    l.position.set(Math.cos(i * 2) * 0.1, 0.9, Math.sin(i * 2) * 0.1)
    l.rotation.y = i * 2
    g.add(l)
  }
  return g
}

// --- Electronics ---------------------------------------------------------------------------------
function screen(g, w, h, x, y, z, color = '#7fd3ff') {
  const m = new MeshStandardMaterial({ color: '#2c3e45', emissive: color, emissiveIntensity: 0.9, roughness: 0.15 })
  const s = new Mesh(new PlaneGeometry(w, h), m)
  s.position.set(x, y, z)
  g.add(s)
  return m
}
function bigTv() {
  const g = new Group()
  rbox(g, 1.9, 0.55, 0.5, 0.04, woodDark(), 0, 0.28, 0)
  for (let i = 0; i < 3; i++) {
    box(g, 0.56, 0.36, 0.02, wood(), -0.6 + i * 0.6, 0.28, 0.26)
    knob(g, -0.6 + i * 0.6, 0.28, 0.28)
  }
  rbox(g, 1.7, 1.0, 0.1, 0.03, mat('#1d2226', { roughness: 0.3 }), 0, 1.15, -0.05)
  const scr = screen(g, 1.58, 0.88, 0, 1.15, 0.006, '#9fe3ff')
  g.userData.anim = (t) => (scr.emissiveIntensity = 0.75 + Math.sin(t * 7) * 0.06 + Math.sin(t * 2.3) * 0.08)
  return g
}
function radio() {
  const g = new Group()
  rbox(g, 0.5, 0.32, 0.22, 0.06, mat('#2aa596', { roughness: 0.35 }), 0, 0.16, 0)
  const grille = new Mesh(new CircleGeometry(0.1, 20), mat('#f3e6c8', { roughness: 0.9 }))
  grille.position.set(-0.1, 0.16, 0.112)
  g.add(grille)
  box(g, 0.16, 0.08, 0.01, mat('#ffe9a8', { emissive: '#ffcf6a', emissiveIntensity: 0.4 }), 0.12, 0.2, 0.112)
  for (const x of [0.07, 0.17]) cyl(g, 0.025, 0.025, 0.03, chrome(), x, 0.09, 0.12, 10).rotation.x = Math.PI / 2
  cyl(g, 0.005, 0.005, 0.35, chrome(), 0.18, 0.45, -0.05, 4).rotation.z = -0.4
  return g
}
function floorFan() {
  const g = new Group()
  cyl(g, 0.2, 0.22, 0.04, mat('#7fb7d8'), 0, 0.02, 0, 20)
  cyl(g, 0.02, 0.02, 0.95, chrome(), 0, 0.5, 0, 8)
  ball(g, 0.08, mat('#7fb7d8'), 0, 1.0, -0.06, 12)
  const cage = new Mesh(new TorusGeometry(0.24, 0.01, 6, 28), chrome())
  cage.position.set(0, 1.0, 0.04)
  g.add(cage)
  const blades = new Group()
  for (let i = 0; i < 3; i++) {
    const b = new Mesh(new SphereGeometry(0.1, 8, 4), mat('#bfe6ff', { side: DoubleSide }))
    b.scale.set(1.8, 0.7, 0.15)
    b.position.set(Math.cos((i / 3) * Math.PI * 2) * 0.12, Math.sin((i / 3) * Math.PI * 2) * 0.12, 0)
    b.rotation.z = (i / 3) * Math.PI * 2
    blades.add(b)
  }
  blades.position.set(0, 1.0, 0.04)
  g.add(blades)
  g.userData.anim = (t, dt) => (blades.rotation.z -= dt * 14)
  return g
}
function sodaMachine() {
  const g = new Group()
  rbox(g, 0.9, 1.9, 0.72, 0.05, mat('#e23a3a', { roughness: 0.35 }), 0, 0.95, 0)
  const panel = glowMat('#fff2d0', 0.6)
  box(g, 0.5, 1.1, 0.02, panel, -0.12, 1.15, 0.36)
  const cans = ['#e23a3a', '#3d8be0', '#f6c232', '#5cbf4a']
  for (let r = 0; r < 4; r++) for (let c = 0; c < 3; c++) cyl(g, 0.05, 0.05, 0.14, mat(cans[(r + c) % 4], { metalness: 0.5, roughness: 0.3 }), -0.28 + c * 0.16, 0.75 + r * 0.26, 0.38, 10)
  box(g, 0.14, 0.5, 0.02, mat('#1d2226'), 0.3, 1.25, 0.37)
  box(g, 0.5, 0.18, 0.04, mat('#1d2226'), -0.12, 0.3, 0.36)
  box(g, 0.8, 0.18, 0.02, glowMat('#ffffff', 0.8), 0, 1.78, 0.37)
  g.userData.anim = (t) => (panel.emissiveIntensity = 0.55 + Math.sin(t * 3) * 0.08)
  return g
}
function arcade() {
  const g = new Group()
  const body = mat('#1f6fb0', { roughness: 0.4 })
  rbox(g, 0.75, 1.15, 0.8, 0.04, body, 0, 0.58, 0)
  rbox(g, 0.75, 0.75, 0.55, 0.04, body, 0, 1.45, -0.12)
  box(g, 0.77, 0.22, 0.3, mat('#f6c232'), 0, 1.85, -0.05)
  box(g, 0.68, 0.14, 0.02, glowMat('#ff5fa8', 1.6), 0, 1.86, 0.11)
  const scr = screen(g, 0.55, 0.45, 0, 1.42, 0.16, '#7cff9a')
  scr.emissiveIntensity = 1.2
  box(g, 0.75, 0.06, 0.4, mat('#1d2226'), 0, 1.0, 0.25)
  cyl(g, 0.015, 0.015, 0.12, chrome(), -0.15, 1.08, 0.28, 6)
  ball(g, 0.035, mat('#e23a3a'), -0.15, 1.15, 0.28, 8)
  for (let i = 0; i < 3; i++) ball(g, 0.03, mat(['#f6c232', '#3d8be0', '#e23a3a'][i]), 0.05 + i * 0.09, 1.04, 0.3, 8)
  g.userData.anim = (t) => (scr.emissiveIntensity = 1.0 + (Math.sin(t * 11) > 0.6 ? 0.4 : 0) + Math.sin(t * 3) * 0.1)
  return g
}
function jukebox() {
  const g = new Group()
  const body = woodDark()
  rbox(g, 0.9, 1.1, 0.6, 0.04, body, 0, 0.55, 0)
  const arch = new Mesh(new CylinderGeometry(0.45, 0.45, 0.6, 24, 1, false, -Math.PI / 2, Math.PI), body)
  arch.rotation.z = Math.PI / 2
  arch.rotation.y = Math.PI / 2
  arch.position.set(0, 1.1, 0)
  g.add(arch)
  const neons = [glowMat('#ff5fa8', 1.6), glowMat('#ffd34a', 1.6), glowMat('#5fd8ff', 1.6)]
  const tube = new Mesh(new TorusGeometry(0.4, 0.03, 8, 30, Math.PI), neons[0])
  tube.position.set(0, 1.1, 0.31)
  g.add(tube)
  for (const s of [-1, 1]) box(g, 0.05, 0.9, 0.04, neons[1], s * 0.4, 0.62, 0.31)
  box(g, 0.6, 0.3, 0.02, glowMat('#fff2d0', 0.7), 0, 1.02, 0.31)
  for (let i = 0; i < 6; i++) box(g, 0.04, 0.32, 0.02, mat('#d9c39e', { metalness: 0.6, roughness: 0.3 }), -0.25 + i * 0.1, 0.45, 0.31)
  box(g, 0.7, 0.06, 0.04, neons[2], 0, 0.22, 0.31)
  g.userData.anim = (t) => neons.forEach((m, i) => (m.emissiveIntensity = 1.2 + Math.sin(t * 4 + i * 2.1) * 0.6))
  return g
}

// --- Bath ----------------------------------------------------------------------------------------
function tub() {
  const g = new Group()
  const pink = mat('#f29bb0', { roughness: 0.3 })
  const white = mat('#fbf7ef', { roughness: 0.15 })
  // A long rounded basin: two half-cylinder ends + a straight middle, all open at the top.
  const L = 1.5
  const W = 0.72
  const H = 0.55
  const body = new Group()
  for (const x of [-(L - W) / 2, (L - W) / 2]) {
    const end = new Mesh(new CylinderGeometry(W / 2, W / 2.4, H, 24), pink)
    end.position.set(x, 0.18 + H / 2, 0)
    end.castShadow = true
    body.add(end)
  }
  box(body, L - W, H, W * 0.9, pink, 0, 0.18 + H / 2, 0)
  rbox(body, L + 0.02, 0.06, W + 0.04, 0.03, white, 0, 0.18 + H, 0)
  g.add(body)
  const water = new Mesh(new PlaneGeometry(L - 0.2, W - 0.16), mat('#9fdcf0', { roughness: 0.05, metalness: 0.1 }))
  water.rotation.x = -Math.PI / 2
  water.position.y = 0.18 + H - 0.02
  g.add(water)
  for (const x of [-L / 2 + 0.18, L / 2 - 0.18]) for (const z of [-0.22, 0.22]) {
    ball(g, 0.06, brass(), x, 0.08, z, 10)
    cyl(g, 0.03, 0.05, 0.14, brass(), x, 0.16, z, 8)
  }
  cyl(g, 0.02, 0.02, 0.3, chrome(), -L / 2 + 0.08, 0.95, 0, 8)
  const spout = cyl(g, 0.02, 0.02, 0.2, chrome(), -L / 2 + 0.16, 1.08, 0, 8)
  spout.rotation.z = Math.PI / 2
  for (let i = 0; i < 4; i++) ball(g, 0.06 + i * 0.01, mat('#ffffff', { transparent: true, opacity: 0.85 }), -0.2 + i * 0.15, 0.18 + H, (i % 2) * 0.1 - 0.05, 8)
  return g
}

// --- Beds (overlays on the room's bed; L = 2.25 along +X, W = 1.75 along Z) ---------------------------
const BL = 2.25
const BW = 1.75
function kingBedOverlay() {
  const g = new Group()
  const head = new Group()
  rbox(head, 0.14, 1.25, BW + 0.3, 0.08, mat('#147a63', { roughness: 0.9 }), 0.06, 1.15, 0)
  for (let r = 0; r < 3; r++) for (let k = 0; k < 5; k++) ball(head, 0.03, mat('#0c5a48'), 0.14, 0.85 + r * 0.25, -0.7 + k * 0.35, 6)
  box(head, 0.06, 0.08, BW + 0.32, brass(), 0.08, 1.8, 0)
  g.add(head)
  const made = new Group()
  rbox(made, 1.6, 0.11, BW + 0.04, 0.05, mat('#ffffff', { map: stripeQuilt(), roughness: 0.95 }), BL - 0.78, 0.83, 0)
  for (const z of [-0.45, 0, 0.45]) {
    const p = rbox(made, 0.4, 0.2, 0.5, 0.09, mat(z ? '#fff7e6' : '#f6c232'), 0.42, 0.92, z)
    p.rotation.z = 0.28
  }
  g.add(made)
  g.userData.made = made
  return g
}
function starBedOverlay() {
  const g = new Group()
  const head = new Group()
  rbox(head, 0.14, 1.1, BW + 0.2, 0.1, mat('#4a2a8a', { roughness: 0.7 }), 0.06, 1.05, 0)
  // A glowing crescent moon on the headboard.
  const moonMat = glowMat('#ffe58a', 1.4)
  const moon = new Mesh(new TorusGeometry(0.22, 0.06, 8, 24, Math.PI * 1.2), moonMat)
  moon.rotation.set(0, Math.PI / 2, 0.6)
  moon.position.set(0.15, 1.35, 0)
  head.add(moon)
  g.add(head)
  const made = new Group()
  rbox(made, 1.6, 0.11, BW + 0.04, 0.05, mat('#ffffff', { map: starQuilt(), roughness: 0.9, emissive: '#2a1060', emissiveIntensity: 0.25 }), BL - 0.78, 0.83, 0)
  for (const z of [-0.42, 0.42]) {
    const p = rbox(made, 0.42, 0.2, 0.62, 0.09, mat('#c9b3ef'), 0.4, 0.92, z)
    p.rotation.z = 0.28
  }
  g.add(made)
  g.userData.made = made
  // Little floating stars that bob above the bed.
  const stars = []
  const starMat = glowMat('#fff2a8', 2)
  for (let i = 0; i < 5; i++) {
    const s = new Mesh(new SphereGeometry(0.045, 8, 6), starMat)
    s.position.set(0.4 + i * 0.4, 1.6, -0.6 + (i % 3) * 0.6)
    g.add(s)
    stars.push(s)
  }
  g.userData.anim = (t) => {
    moonMat.emissiveIntensity = 1.2 + Math.sin(t * 2) * 0.3
    stars.forEach((s, i) => {
      s.position.y = 1.5 + Math.sin(t * 1.6 + i * 1.3) * 0.15
      s.scale.setScalar(0.8 + Math.sin(t * 5 + i) * 0.3)
    })
  }
  return g
}
// The comfy bed as a standalone model (for its card picture; in the room it is the bed's own overlay).
function bedModel(variant) {
  const g = new Group()
  const frame = new Group()
  rbox(frame, BL, 0.38, BW, 0.05, wood(), BL / 2, 0.34, 0)
  rbox(frame, BL - 0.15, 0.24, BW - 0.08, 0.08, mat('#fffaf0', { roughness: 1 }), BL / 2 + 0.03, 0.65, 0)
  box(frame, 0.08, 0.5, BW + 0.08, wood(), BL + 0.02, 0.38, 0)
  for (const z of [-BW / 2 - 0.02, BW / 2 + 0.02]) box(frame, 0.14, 1.45, 0.14, wood(), 0.05, 0.72, z)
  g.add(frame)
  if (variant === 'kingBed') g.add(kingBedOverlay())
  else if (variant === 'starBed') g.add(starBedOverlay())
  else {
    rbox(g, 1.55, 0.12, BW, 0.05, mat('#e86a5a', { roughness: 0.95 }), BL - 0.8, 0.84, 0)
    box(g, 0.6, 0.1, BW + 0.04, mat('#ffd6a0'), BL - 0.45, 0.9, 0)
    for (const z of [-0.42, 0.42]) rbox(g, 0.42, 0.2, 0.62, 0.09, mat('#fbf3e2'), 0.4, 0.9, z).rotation.z = 0.28
    rbox(g, 0.1, 0.72, BW - 0.12, 0.05, mat('#147a63'), 0.06, 0.95, 0)
  }
  g.rotation.y = -Math.PI / 2
  const wrapG = new Group()
  g.position.z = -BL / 2
  wrapG.add(g)
  return wrapG
}

// id -> maker (fresh object each call).
export const MAKERS = {
  bed: () => bedModel('bed'),
  kingBed: () => bedModel('kingBed'),
  starBed: () => bedModel('starBed'),
  deskChair,
  armchair,
  loveseat,
  sideTable,
  desk,
  coffeeTable,
  nightstand,
  fileCabinet,
  toyChest,
  dresser,
  bookcase,
  vanityTable,
  tableLamp,
  floorLamp,
  painting,
  portrait,
  rug,
  persianRug,
  plant,
  orchid,
  fridge: () => makeFridge(),
  tv: () => makeTV().group,
  bigTv,
  radio,
  floorFan,
  sodaMachine,
  arcade,
  jukebox,
  vanity: () => makeVanity(),
  tub,
}
export const BED_OVERLAYS = { kingBed: kingBedOverlay, starBed: starBedOverlay }
export const makeItem = (id) => MAKERS[id]?.() ?? new Group()
