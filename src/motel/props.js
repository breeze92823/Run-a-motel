// Hand-built props: palms and low-poly trees, bushes, cacti, flower beds and
// hanging baskets, street lamps, a mailbox, retro cars, trash cans, the
// dumpster, trash bags and big junk, litter pieces and a bus shelter.
// Each returns a Group positioned at its feet (y = 0).
import {
  CircleGeometry,
  ConeGeometry,
  CylinderGeometry,
  DodecahedronGeometry,
  DoubleSide,
  Group,
  IcosahedronGeometry,
  LatheGeometry,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
  SphereGeometry,
  TorusGeometry,
  Vector2,
} from 'three'
import { mulberry32 } from '../textures.js'
import { box, C, canvasTex, mat, rbox } from './kit.js'
import { paintSign } from './paint.js'

const leafGreens = ['#46b545', '#3aa13e', '#5cc54c']
function leafMat(i = 0) {
  return mat(leafGreens[i % 3], { flatShading: true, roughness: 0.85 })
}

function mesh(parent, geo, material, x = 0, y = 0, z = 0) {
  const m = new Mesh(geo, material)
  m.position.set(x, y, z)
  m.castShadow = true
  m.receiveShadow = true
  parent.add(m)
  return m
}

// A low-poly blob (icosahedron with jittered vertices) for bushes and canopies.
const blobCache = new Map()
function blobGeo(seed) {
  let g = blobCache.get(seed)
  if (g) return g
  g = new IcosahedronGeometry(1, 1)
  const rand = mulberry32(seed)
  const p = g.attributes.position
  const seen = new Map()
  for (let i = 0; i < p.count; i++) {
    const key = `${p.getX(i).toFixed(3)},${p.getY(i).toFixed(3)},${p.getZ(i).toFixed(3)}`
    let k = seen.get(key)
    if (k === undefined) seen.set(key, (k = 0.85 + rand() * 0.3))
    p.setXYZ(i, p.getX(i) * k, p.getY(i) * k, p.getZ(i) * k)
  }
  g.computeVertexNormals()
  blobCache.set(seed, g)
  return g
}

export function bush(seed = 1, scale = 1) {
  const g = new Group()
  const rand = mulberry32(seed)
  const n = 2 + Math.floor(rand() * 3)
  for (let i = 0; i < n; i++) {
    const r = (0.55 + rand() * 0.4) * scale
    const b = mesh(g, blobGeo(seed * 7 + i), leafMat(i + seed), (rand() - 0.5) * scale, r * 0.75, (rand() - 0.5) * scale)
    b.scale.set(r, r * 0.85, r)
  }
  return g
}

// Round-canopy desert tree (green or the yellow-blossom variety).
export function tree(seed = 1, yellow = false) {
  const g = new Group()
  const rand = mulberry32(seed)
  const trunk = mat('#8a5a33', { roughness: 1, flatShading: true })
  const h = 2.6 + rand() * 1.4
  const t = mesh(g, new CylinderGeometry(0.16, 0.26, h, 6), trunk, 0, h / 2, 0)
  t.rotation.z = (rand() - 0.5) * 0.15
  const canopy = yellow ? mat('#f3c834', { flatShading: true, roughness: 0.8 }) : leafMat(seed)
  for (let i = 0; i < 4; i++) {
    const r = 1.0 + rand() * 0.6
    const c = mesh(g, blobGeo(seed * 13 + i), i % 2 && !yellow ? leafMat(i) : canopy, (rand() - 0.5) * 1.6, h + 0.3 + rand() * 0.8, (rand() - 0.5) * 1.6)
    c.scale.setScalar(r)
  }
  return g
}

// Palm: curved segmented trunk and drooping frond blades.
const frondGeo = (() => {
  const g = new PlaneGeometry(0.9, 3.2, 1, 6)
  const p = g.attributes.position
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i) + 1.6 // 0..3.2 along the frond
    const x = p.getX(i)
    const taper = 1 - (y / 3.2) * 0.85
    p.setX(i, x * taper)
    p.setZ(i, -Math.pow(y / 3.2, 2) * 1.4 + Math.abs(x) * 0.25)
    p.setY(i, y)
  }
  g.computeVertexNormals()
  return g
})()
export function palm(seed = 1, height = 6) {
  const g = new Group()
  const rand = mulberry32(seed)
  const bark = [mat('#a87b4f', { flatShading: true, roughness: 1 }), mat('#94683f', { flatShading: true, roughness: 1 })]
  const segs = 9
  const lean = (rand() - 0.5) * 0.5
  let x = 0
  let y = 0
  for (let i = 0; i < segs; i++) {
    const t = i / segs
    const seg = mesh(g, new CylinderGeometry(0.2 - t * 0.06, 0.26 - t * 0.06, height / segs + 0.05, 7), bark[i % 2], x, y + height / segs / 2, 0)
    seg.rotation.z = -lean * 0.4
    x += Math.sin(lean * t) * (height / segs) * 0.8
    y += height / segs
  }
  const top = new Group()
  top.position.set(x, y, 0)
  g.add(top)
  const frondMats = [mat('#3fae3c', { side: DoubleSide, flatShading: true }), mat('#58c24a', { side: DoubleSide, flatShading: true })]
  const n = 9
  for (let i = 0; i < n; i++) {
    const f = new Mesh(frondGeo, frondMats[i % 2])
    f.castShadow = true
    f.rotation.order = 'YXZ'
    f.rotation.y = (i / n) * Math.PI * 2 + rand() * 0.3
    f.rotation.x = -0.9 - rand() * 0.4
    top.add(f)
  }
  mesh(top, new SphereGeometry(0.32, 7, 5), mat('#6b4a2a', { flatShading: true }), 0, 0, 0)
  for (let i = 0; i < 3; i++) mesh(top, new SphereGeometry(0.14, 6, 4), mat('#7a5a2a'), Math.cos(i * 2) * 0.25, -0.2, Math.sin(i * 2) * 0.25)
  return g
}

export function cactus(seed = 1) {
  const g = new Group()
  const rand = mulberry32(seed)
  const m = mat('#3f9a52', { flatShading: true, roughness: 0.8 })
  const h = 1.6 + rand() * 1.2
  mesh(g, new CylinderGeometry(0.28, 0.32, h, 8), m, 0, h / 2, 0)
  mesh(g, new SphereGeometry(0.28, 8, 5), m, 0, h, 0)
  for (const side of [-1, 1]) {
    if (rand() < 0.3) continue
    const ay = h * (0.35 + rand() * 0.25)
    const arm = mesh(g, new CylinderGeometry(0.17, 0.17, 0.6, 7), m, side * 0.45, ay, 0)
    arm.rotation.z = Math.PI / 2
    const up = 0.5 + rand() * 0.5
    mesh(g, new CylinderGeometry(0.17, 0.17, up, 7), m, side * 0.72, ay + up / 2, 0)
    mesh(g, new SphereGeometry(0.17, 7, 4), m, side * 0.72, ay + up, 0)
  }
  return g
}

// Low brick-edged planter with a flower bed.
export function planter(w, d, seed = 1, { brick = false, flowers = true } = {}) {
  const g = new Group()
  const rand = mulberry32(seed)
  const edge = brick ? mat('#e06a3e', { roughness: 0.9 }) : mat('#e9e1d2', { roughness: 0.9 })
  box(g, w, 0.4, 0.2, edge, 0, 0.2, d / 2 - 0.1)
  box(g, w, 0.4, 0.2, edge, 0, 0.2, -d / 2 + 0.1)
  box(g, 0.2, 0.4, d, edge, w / 2 - 0.1, 0.2, 0)
  box(g, 0.2, 0.4, d, edge, -w / 2 + 0.1, 0.2, 0)
  box(g, w - 0.4, 0.3, d - 0.4, mat('#5aa24a', { roughness: 1 }), 0, 0.18, 0)
  if (flowers) {
    const petals = ['#ff6fa8', '#ffd23f', '#ff8a3d', '#ffffff', '#c86bff'].map((c) => mat(c, { flatShading: true }))
    const stem = mat('#2f8a3a')
    const count = Math.floor(w * d * 2.2)
    for (let i = 0; i < count; i++) {
      const x = (rand() - 0.5) * (w - 0.6)
      const z = (rand() - 0.5) * (d - 0.6)
      box(g, 0.03, 0.3, 0.03, stem, x, 0.45, z)
      const f = mesh(g, new DodecahedronGeometry(0.09, 0), petals[i % petals.length], x, 0.62, z)
      f.rotation.y = rand() * 3
    }
  }
  return g
}

// Flower basket hanging on chains under the balcony.
export function hangingBasket(seed = 1) {
  const g = new Group()
  const rand = mulberry32(seed + 40)
  const chain = mat('#5a5a5a', { metalness: 0.7, roughness: 0.4 })
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2
    const c = box(g, 0.02, 0.7, 0.02, chain, Math.cos(a) * 0.17, -0.35, Math.sin(a) * 0.17)
    c.rotation.set(Math.sin(a) * 0.25, 0, -Math.cos(a) * 0.25)
  }
  const pot = new LatheGeometry([new Vector2(0.01, 0), new Vector2(0.28, 0.05), new Vector2(0.4, 0.25), new Vector2(0.42, 0.3)], 14)
  mesh(g, pot, mat('#2a9f8f', { side: DoubleSide }), 0, -1.0, 0)
  const greens = new Group()
  greens.position.y = -0.72
  g.add(greens)
  for (let i = 0; i < 5; i++) {
    const b = mesh(greens, blobGeo(seed * 3 + i), leafMat(i), (rand() - 0.5) * 0.5, rand() * 0.15, (rand() - 0.5) * 0.5)
    b.scale.setScalar(0.24 + rand() * 0.08)
  }
  const petals = ['#ff5f9e', '#ffcc33', '#ff7f3f', '#ffffff'].map((c) => mat(c, { flatShading: true }))
  for (let i = 0; i < 12; i++) mesh(greens, new DodecahedronGeometry(0.07, 0), petals[i % 4], (rand() - 0.5) * 0.7, 0.05 + rand() * 0.25, (rand() - 0.5) * 0.7)
  for (let i = 0; i < 4; i++) {
    const v = box(greens, 0.05, 0.45, 0.05, leafMat(i), (rand() - 0.5) * 0.7, -0.35, (rand() - 0.5) * 0.7)
    v.rotation.z = (rand() - 0.5) * 0.4
  }
  return g
}

// Teal outdoor trash can with a domed lid.
export function trashCan(x = 0, y = 0, z = 0) {
  const g = new Group()
  const body = mat('#2a9f8f', { roughness: 0.5 })
  mesh(g, new CylinderGeometry(0.3, 0.27, 0.85, 16), body, 0, 0.43, 0)
  for (const yy of [0.2, 0.68]) mesh(g, new TorusGeometry(0.3, 0.025, 6, 20), mat('#1f7c70'), 0, yy, 0).rotation.x = Math.PI / 2
  mesh(g, new SphereGeometry(0.31, 16, 6, 0, Math.PI * 2, 0, Math.PI / 2), mat('#222a2a', { roughness: 0.5 }), 0, 0.86, 0).scale.y = 0.35
  mesh(g, new CylinderGeometry(0.05, 0.05, 0.08, 8), mat('#222'), 0, 0.98, 0)
  g.position.set(x, y, z)
  return g
}

// Double-headed street lamp on a teal pole. Returns { group, bulb } (bulb material glows at night).
export function streetLamp() {
  const g = new Group()
  const pole = mat('#2a9f8f', { roughness: 0.4, metalness: 0.3 })
  mesh(g, new CylinderGeometry(0.12, 0.18, 7.5, 10), pole, 0, 3.75, 0)
  mesh(g, new CylinderGeometry(0.35, 0.4, 0.4, 10), pole, 0, 0.2, 0)
  const bulb = new MeshStandardMaterial({ color: '#fffbe8', emissive: '#ffe6a8', emissiveIntensity: 0.1 })
  for (const s of [-1, 1]) {
    box(g, 1.3, 0.1, 0.1, pole, s * 0.65, 7.3, 0)
    const head = mesh(g, new CylinderGeometry(0.15, 0.6, 0.28, 12), mat('#3a3330', { roughness: 0.5 }), s * 1.3, 7.25, 0)
    void head
    const lens = new Mesh(new CircleGeometry(0.52, 16), bulb)
    lens.rotation.x = Math.PI / 2
    lens.position.set(s * 1.3, 7.1, 0)
    g.add(lens)
  }
  return { group: g, bulb }
}

export function mailbox() {
  const g = new Group()
  box(g, 0.14, 1.1, 0.14, mat('#6b3f22'), 0, 0.55, 0)
  const red = mat('#e0322a', { roughness: 0.4 })
  rbox(g, 0.5, 0.5, 0.8, 0.12, red, 0, 1.3, 0)
  box(g, 0.04, 0.3, 0.05, mat('#f2c232'), 0.27, 1.45, 0.25)
  const c = paintSign({ w: 256, h: 96, bg: '#e0322a', border: null, lines: [{ t: 'MAIL ♥', size: 56, color: '#fff6e5' }] })
  const label = new Mesh(new PlaneGeometry(0.6, 0.22), new MeshStandardMaterial({ map: canvasTex(c) }))
  label.position.set(0.26, 1.3, 0)
  label.rotation.y = Math.PI / 2
  g.add(label)
  return g
}

// A boxy retro car (station wagon or sedan) in two tones with whitewall tyres.
export function car(color = '#3cc7b8', accent = '#f4efe2', { wagon = true, seed = 1 } = {}) {
  const g = new Group()
  const body = mat(color, { roughness: 0.35, metalness: 0.15 })
  const trim = mat(accent, { roughness: 0.4 })
  const chrome = mat('#e4e8ea', { metalness: 0.9, roughness: 0.2 })
  const glassM = new MeshStandardMaterial({ color: '#3b4f5c', roughness: 0.1, metalness: 0.3 })
  const L = 4.6
  rbox(g, 1.9, 0.6, L, 0.12, body, 0, 0.62, 0)
  box(g, 1.92, 0.12, L - 0.2, trim, 0, 0.78, 0) // side stripe
  const cabinL = wagon ? 2.9 : 2.0
  const cabinZ = wagon ? -0.45 : -0.1
  rbox(g, 1.7, 0.62, cabinL, 0.1, trim, 0, 1.2, cabinZ)
  box(g, 1.74, 0.42, cabinL - 0.3, glassM, 0, 1.2, cabinZ)
  box(g, 1.5, 0.4, 0.05, glassM, 0, 1.2, cabinZ + cabinL / 2 + 0.01)
  box(g, 1.85, 0.06, cabinL + 0.1, trim, 0, 1.53, cabinZ) // roof cap
  // Bumpers, grille, lights.
  box(g, 1.95, 0.16, 0.12, chrome, 0, 0.42, L / 2 + 0.03)
  box(g, 1.95, 0.16, 0.12, chrome, 0, 0.42, -L / 2 - 0.03)
  box(g, 1.1, 0.24, 0.04, chrome, 0, 0.66, L / 2 + 0.02)
  const headlight = new MeshStandardMaterial({ color: '#fffbe0', emissive: '#fff2b0', emissiveIntensity: 0.3 })
  for (const s of [-0.72, 0.72]) {
    mesh(g, new CylinderGeometry(0.12, 0.12, 0.05, 12), headlight, s, 0.68, L / 2 + 0.02).rotation.x = Math.PI / 2
    box(g, 0.24, 0.14, 0.04, mat('#d92020', { emissive: '#ff2020', emissiveIntensity: 0.2 }), s, 0.68, -L / 2 - 0.01)
  }
  // Wheels with whitewalls and hubcaps.
  const tyre = mat('#1d1d1f', { roughness: 0.9 })
  const wall = mat('#f5f2ea', { roughness: 0.6 })
  for (const [x, z] of [[-0.95, 1.4], [0.95, 1.4], [-0.95, -1.4], [0.95, -1.4]]) {
    const w = mesh(g, new CylinderGeometry(0.36, 0.36, 0.26, 16), tyre, x, 0.36, z)
    w.rotation.z = Math.PI / 2
    const ww = mesh(g, new CylinderGeometry(0.25, 0.25, 0.27, 16), wall, x, 0.36, z)
    ww.rotation.z = Math.PI / 2
    const hub = mesh(g, new CylinderGeometry(0.15, 0.15, 0.28, 12), chrome, x, 0.36, z)
    hub.rotation.z = Math.PI / 2
  }
  // Roof rack on wagons.
  if (wagon && seed % 2) {
    box(g, 1.5, 0.05, 0.05, chrome, 0, 1.62, cabinZ + 1)
    box(g, 1.5, 0.05, 0.05, chrome, 0, 1.62, cabinZ - 1)
    rbox(g, 1.0, 0.35, 1.2, 0.08, mat('#c9762b'), 0, 1.82, cabinZ)
  }
  return g
}

// Green steel dumpster with two lids (the left one propped open).
export function dumpster() {
  const g = new Group()
  const green = mat('#2f8a4a', { roughness: 0.55, metalness: 0.25 })
  const dark = mat('#1f5f33', { roughness: 0.6, metalness: 0.25 })
  rbox(g, 3.0, 1.5, 1.8, 0.06, green, 0, 0.95, 0)
  box(g, 3.1, 0.12, 1.9, dark, 0, 1.72, 0)
  for (const x of [-1.2, 0, 1.2]) box(g, 0.08, 1.3, 0.06, dark, x, 0.95, 0.92)
  const lidL = box(g, 1.48, 0.06, 1.85, mat('#202a25'), -0.75, 1.8, 0)
  lidL.rotation.x = -1.1
  lidL.position.set(-0.75, 2.3, -0.75)
  box(g, 1.48, 0.06, 1.85, mat('#202a25'), 0.75, 1.8, 0)
  // Wheels and side pockets.
  for (const [x, z] of [[-1.3, 0.7], [1.3, 0.7], [-1.3, -0.7], [1.3, -0.7]]) mesh(g, new CylinderGeometry(0.14, 0.14, 0.12, 10), mat('#222'), x, 0.14, z).rotation.z = Math.PI / 2
  for (const s of [-1, 1]) box(g, 0.14, 0.2, 1.2, dark, s * 1.56, 1.3, 0)
  const c = paintSign({ w: 300, h: 100, bg: '#f4efe2', border: '#1f5f33', borderW: 8, radius: 8, lines: [{ t: 'TRASH ONLY', size: 46, color: '#1f5f33' }] })
  const label = new Mesh(new PlaneGeometry(1.1, 0.36), new MeshStandardMaterial({ map: canvasTex(c) }))
  label.position.set(0.6, 1.15, 0.96)
  g.add(label)
  // A garbage heap peeking out of the open side.
  for (let i = 0; i < 4; i++) mesh(g, blobGeo(90 + i), mat(['#6b5a3a', '#3b3b3b', '#7a6a4a', '#2f2f2f'][i], { flatShading: true }), -0.9 + i * 0.25, 1.65, -0.2 + (i % 2) * 0.3).scale.setScalar(0.35)
  return g
}

// Tied brown trash bag (lumpy) with a knot on top.
const bagGeo = (() => {
  const g = new SphereGeometry(0.42, 12, 9)
  const p = g.attributes.position
  const rand = mulberry32(5)
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i)
    const k = 1 + (rand() - 0.5) * 0.12
    p.setXYZ(i, p.getX(i) * k * (y < 0 ? 1.05 : 1 - y * 0.6), y * 0.85, p.getZ(i) * k * (y < 0 ? 1.05 : 1 - y * 0.6))
  }
  g.computeVertexNormals()
  return g
})()
export function trashBag(seed = 1) {
  const g = new Group()
  const tint = ['#7a5a2c', '#5e4a2a', '#2f3133', '#7f6a3a'][seed % 4]
  const m = mat(tint, { roughness: 0.35, metalness: 0.05 })
  mesh(g, bagGeo, m, 0, 0.34, 0)
  mesh(g, new ConeGeometry(0.1, 0.22, 7), m, 0, 0.78, 0)
  for (const s of [-1, 1]) {
    const ear = mesh(g, new ConeGeometry(0.05, 0.18, 5), m, s * 0.07, 0.88, 0)
    ear.rotation.z = -s * 0.8
  }
  g.rotation.y = seed * 1.7
  return g
}

// Big junk pieces (carried by hand): mattress, tyre stack, old TV, broken chair,
// fridge, crate of scrap, bed frame.
export function junk(kind) {
  const g = new Group()
  if (kind === 0) {
    rbox(g, 1.6, 0.3, 2.1, 0.12, mat('#e9d9b8', { roughness: 1 }), 0, 0.15, 0)
    for (let i = 0; i < 3; i++) mesh(g, new CircleGeometry(0.18 + i * 0.06, 12), mat('#b39a6a', { roughness: 1 }), -0.3 + i * 0.35, 0.305, 0.2 - i * 0.3).rotation.x = -Math.PI / 2
    g.userData.size = 1.2
  } else if (kind === 1) {
    const tyre = mat('#202022', { roughness: 0.9 })
    for (let i = 0; i < 3; i++) {
      const t = mesh(g, new TorusGeometry(0.38, 0.16, 8, 18), tyre, (i % 2) * 0.05, 0.16 + i * 0.3, 0)
      t.rotation.x = Math.PI / 2
    }
    g.userData.size = 0.8
  } else if (kind === 2) {
    rbox(g, 0.9, 0.75, 0.75, 0.08, mat('#7a5a3a', { roughness: 0.7 }), 0, 0.42, 0)
    box(g, 0.66, 0.52, 0.03, mat('#3a4a48', { roughness: 0.2 }), -0.08, 0.45, 0.38)
    for (let k = 0; k < 2; k++) mesh(g, new CylinderGeometry(0.05, 0.05, 0.05, 8), mat('#ccc'), 0.34, 0.6 - k * 0.2, 0.38).rotation.x = Math.PI / 2
    const ant = box(g, 0.02, 0.5, 0.02, mat('#999'), 0.1, 1.0, 0)
    ant.rotation.z = 0.5
    const crack = box(g, 0.4, 0.02, 0.01, mat('#cfd'), -0.1, 0.5, 0.4)
    crack.rotation.z = 0.7
    g.userData.size = 0.8
  } else if (kind === 3) {
    const wood = mat('#a8703e', { roughness: 0.9 })
    box(g, 0.7, 0.08, 0.7, wood, 0, 0.5, 0)
    box(g, 0.7, 0.8, 0.08, wood, 0, 0.95, -0.31)
    for (const [x, z, r] of [[-0.3, -0.3, 0], [0.3, -0.3, 0], [-0.3, 0.3, 0.4], [0.3, 0.3, 0]]) box(g, 0.07, 0.5, 0.07, wood, x, 0.25, z).rotation.z = r
    g.rotation.z = 0.25
    g.userData.size = 0.8
  } else if (kind === 4) {
    rbox(g, 0.85, 1.6, 0.8, 0.1, mat('#e8ebe4', { roughness: 0.4 }), 0, 0.8, 0)
    box(g, 0.05, 0.4, 0.05, mat('#b9bec0', { metalness: 0.8, roughness: 0.3 }), 0.32, 1.2, 0.42)
    box(g, 0.86, 0.02, 0.02, mat('#c2c6c0'), 0, 1.05, 0.41)
    mesh(g, new CircleGeometry(0.2, 10), mat('#c9a35a', { roughness: 1 }), -0.1, 0.4, 0.41)
    g.rotation.z = -0.12
    g.userData.size = 1.0
  } else if (kind === 5) {
    const wood = mat('#c9a06a', { roughness: 0.95 })
    for (let i = 0; i < 4; i++) box(g, 1.0, 0.1, 0.18, wood, 0, 0.1 + i * 0.2, 0.42).rotation.y = i * 0.02
    box(g, 1.0, 0.8, 0.85, mat('#a57a48', { roughness: 0.95 }), 0, 0.4, 0)
    for (let i = 0; i < 3; i++) box(g, 0.5, 0.05, 0.05, mat('#888', { metalness: 0.7 }), (i - 1) * 0.25, 0.9, (i - 1) * 0.2).rotation.y = i
    g.userData.size = 0.9
  } else {
    const metal = mat('#7b8a8c', { metalness: 0.6, roughness: 0.5 })
    box(g, 1.5, 0.06, 0.06, metal, 0, 0.6, 0.9)
    box(g, 1.5, 0.06, 0.06, metal, 0, 0.6, -0.9)
    box(g, 0.06, 0.06, 1.8, metal, 0.72, 0.6, 0)
    box(g, 0.06, 0.06, 1.8, metal, -0.72, 0.6, 0)
    box(g, 1.5, 0.9, 0.06, metal, 0, 0.9, -0.92)
    for (const [x, z] of [[-0.72, -0.9], [0.72, -0.9], [-0.72, 0.9], [0.72, 0.9]]) box(g, 0.06, 0.6, 0.06, metal, x, 0.3, z)
    g.rotation.x = 0.06
    g.userData.size = 1.1
  }
  return g
}

// Litter: crumpled cup with straw, soda can, banana peel, paper bag, wrapper.
export function litter(kind) {
  const g = new Group()
  if (kind === 0) {
    mesh(g, new CylinderGeometry(0.09, 0.07, 0.24, 10), mat('#ffffff'), 0, 0.12, 0)
    box(g, 0.181, 0.05, 0.181, mat('#e0322a'), 0, 0.14, 0)
    const straw = box(g, 0.02, 0.22, 0.02, mat('#e0322a'), 0.02, 0.3, 0)
    straw.rotation.z = 0.2
  } else if (kind === 1) {
    const can = mesh(g, new CylinderGeometry(0.06, 0.06, 0.2, 12), mat(['#e0322a', '#2f6fd0', '#f2c232'][Math.floor(Math.random() * 3)], { metalness: 0.6, roughness: 0.3 }), 0, 0.06, 0)
    can.rotation.z = Math.PI / 2
  } else if (kind === 2) {
    const peel = mat('#f6d33c', { flatShading: true })
    for (let i = 0; i < 3; i++) {
      const p = box(g, 0.06, 0.02, 0.25, peel, 0, 0.02, 0)
      p.rotation.y = (i / 3) * Math.PI * 2
      p.position.set(Math.sin(p.rotation.y) * 0.1, 0.02, Math.cos(p.rotation.y) * 0.1)
    }
    mesh(g, new SphereGeometry(0.06, 6, 4), mat('#c7a52a'), 0, 0.05, 0)
  } else if (kind === 3) {
    const bag = rbox(g, 0.28, 0.32, 0.18, 0.03, mat('#c9a06a', { roughness: 1 }), 0, 0.12, 0)
    bag.rotation.x = Math.PI / 2 - 0.2
  } else {
    mesh(g, new DodecahedronGeometry(0.1, 0), mat('#f3f0e8', { flatShading: true }), 0, 0.08, 0)
  }
  g.rotation.y = Math.random() * Math.PI * 2
  return g
}

// Bus stop: shelter with bench and a sign on a pole.
export function busStop() {
  const g = new Group()
  const teal = mat('#2a9f8f', { roughness: 0.4, metalness: 0.2 })
  const glassM = new MeshStandardMaterial({ color: '#cfeff2', transparent: true, opacity: 0.35, roughness: 0.05 })
  for (const x of [-1.6, 1.6]) for (const z of [-0.6, 0.6]) box(g, 0.1, 2.4, 0.1, teal, x, 1.2, z)
  box(g, 3.6, 0.12, 1.6, mat('#f06a34'), 0, 2.45, 0)
  box(g, 3.2, 1.6, 0.04, glassM, 0, 1.3, -0.6)
  box(g, 0.04, 1.6, 1.1, glassM, -1.6, 1.3, 0)
  box(g, 2.6, 0.08, 0.45, mat('#c9a06a'), 0, 0.5, -0.3)
  for (const x of [-1.1, 1.1]) box(g, 0.08, 0.5, 0.4, teal, x, 0.25, -0.3)
  box(g, 0.08, 3.2, 0.08, mat('#888', { metalness: 0.6 }), 2.2, 1.6, 0.4)
  const c = paintSign({ w: 256, h: 256, bg: '#2a9f8f', border: '#ffffff', borderW: 10, radius: 128, lines: [{ t: 'BUS', size: 84, color: '#ffffff' }, { t: 'STOP', size: 56, color: '#fff2c0' }] })
  const s = new Mesh(new CircleGeometry(0.42, 24), new MeshStandardMaterial({ map: canvasTex(c), side: DoubleSide }))
  s.position.set(2.2, 3.0, 0.45)
  g.add(s)
  return g
}

// Ground rocks.
export function rock(seed = 1, s = 1) {
  const g = new Group()
  const m = mesh(g, blobGeo(200 + seed), mat(['#d39a63', '#c48853', '#e2ad74'][seed % 3], { flatShading: true, roughness: 1 }), 0, 0.2 * s, 0)
  m.scale.set(0.6 * s, 0.4 * s, 0.5 * s)
  return g
}

export { C }
