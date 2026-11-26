// Close-up dressing for the pool (used by site.js buildPool): stone coping with a
// bullnose edge, a mosaic waterline band, lane line with T-ends and wall targets,
// main drains, return jets, skimmers with deck lids, underwater lights, step
// nosings, a better diving board, moving water with a rippled normal map and
// floor caustics, deck slot drains and stencils, a ring buoy, rules sign, pole
// rack, chemical buckets, hose reel, outdoor shower and a towel bin. Chaise
// loungers sit stacked while the pool is closed; once it opens they're laid out
// with cushions and towels under striped umbrellas with side tables, and a
// float ring + beach ball bob on the water.
import {
  AdditiveBlending,
  CircleGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  RepeatWrapping,
  SphereGeometry,
  TorusGeometry,
  Vector2,
} from 'three'
import { bake } from '../bake.js'
import { mulberry32 } from '../textures.js'
import { box, C, canvasTex, mat, rbox } from './kit.js'
import { canvas, FONT, paintSign, tex } from './paint.js'

// --- Textures --------------------------------------------------------------------------------
function paintCoping() {
  const c = canvas(256, 128)
  const ctx = c.getContext('2d')
  const r = mulberry32(81)
  ctx.fillStyle = '#f4ecdc'
  ctx.fillRect(0, 0, 256, 128)
  for (let i = 0; i < 1400; i++) {
    const v = 200 + Math.floor(r() * 50)
    ctx.fillStyle = `rgba(${v},${v - 8},${v - 22},0.5)`
    ctx.fillRect(r() * 256, r() * 128, 1 + r() * 2, 1 + r() * 2)
  }
  ctx.fillStyle = '#cbbfa8'
  ctx.fillRect(0, 0, 3, 128)
  ctx.fillRect(127, 0, 3, 128)
  return c
}
function paintMosaic() {
  const c = canvas(256, 64)
  const ctx = c.getContext('2d')
  const r = mulberry32(31)
  ctx.fillStyle = '#e8f6f7'
  ctx.fillRect(0, 0, 256, 64)
  const cols = ['#1f6f8b', '#2a8fb0', '#3fb4cf', '#1b5c78', '#58c7d8']
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 32; x++) {
      // A band of navy/white diamonds across the middle rows, random blues elsewhere.
      const dx = Math.abs(((x + 2) % 8) - 4)
      const inDiamond = y >= 2 && y <= 5 && dx + Math.abs(y - 3.5) < 3.2
      ctx.fillStyle = inDiamond ? (dx + Math.abs(y - 3.5) < 1.6 ? '#f6d33c' : '#ffffff') : cols[Math.floor(r() * cols.length)]
      ctx.fillRect(x * 8 + 0.6, y * 8 + 0.6, 6.8, 6.8)
    }
  }
  return c
}
// Tileable caustic web: bright where three integer-frequency waves cancel.
function paintCaustics(size = 256) {
  const c = canvas(size)
  const ctx = c.getContext('2d')
  const img = ctx.createImageData(size, size)
  const W = [[3, 1, 0.3], [-1, 4, 1.7], [2, -3, 4.1], [5, 2, 2.2]]
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = (x / size) * Math.PI * 2
      const v = (y / size) * Math.PI * 2
      let f = 0
      for (const [a, b, p] of W) f += Math.sin(a * u + b * v + p + Math.sin(b * u - a * v) * 0.8)
      const k = Math.pow(Math.max(0, 1 - Math.abs(f) * 0.55), 6)
      const i = (y * size + x) * 4
      img.data[i] = img.data[i + 1] = img.data[i + 2] = Math.round(255 * k)
      img.data[i + 3] = 255
    }
  }
  ctx.putImageData(img, 0, 0)
  return c
}
// Tileable ripple normal map.
function paintRipples(size = 256) {
  const c = canvas(size)
  const ctx = c.getContext('2d')
  const img = ctx.createImageData(size, size)
  const W = [[2, 1, 0.0, 1], [-1, 3, 1.3, 0.7], [4, -2, 2.6, 0.45], [1, 6, 0.7, 0.3], [-5, 3, 3.1, 0.25]]
  const h = (x, y) => {
    let s = 0
    for (const [a, b, p, amp] of W) s += Math.sin(((a * x + b * y) / size) * Math.PI * 2 + p) * amp
    return s
  }
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = h(x + 1, y) - h(x - 1, y)
      const dy = h(x, y + 1) - h(x, y - 1)
      const n = new Vector2(-dx * 6, -dy * 6)
      const l = Math.hypot(n.x, n.y, 1)
      const i = (y * size + x) * 4
      img.data[i] = Math.round((n.x / l * 0.5 + 0.5) * 255)
      img.data[i + 1] = Math.round((n.y / l * 0.5 + 0.5) * 255)
      img.data[i + 2] = Math.round((1 / l * 0.5 + 0.5) * 255)
      img.data[i + 3] = 255
    }
  }
  ctx.putImageData(img, 0, 0)
  return c
}
function stripes(a, b, n = 8, w = 256, h = 64) {
  const c = canvas(w, h)
  const ctx = c.getContext('2d')
  for (let i = 0; i < n; i++) {
    ctx.fillStyle = i % 2 ? b : a
    ctx.fillRect((i * w) / n, 0, w / n + 1, h)
  }
  return c
}
function stencil(text, w = 512, h = 128) {
  const c = canvas(w, h)
  const ctx = c.getContext('2d')
  ctx.clearRect(0, 0, w, h)
  ctx.fillStyle = 'rgba(31,111,139,0.85)'
  ctx.font = `800 ${Math.round(h * 0.62)}px ${FONT}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, w / 2, h / 2 + 4)
  return c
}
function paintRules() {
  const c = canvas(512, 640)
  const ctx = c.getContext('2d')
  ctx.fillStyle = '#fbf7ee'
  ctx.fillRect(0, 0, 512, 640)
  ctx.fillStyle = '#1f6f8b'
  ctx.fillRect(0, 0, 512, 120)
  ctx.fillStyle = '#fff'
  ctx.textAlign = 'center'
  ctx.font = `800 72px ${FONT}`
  ctx.fillText('POOL RULES', 256, 86)
  ctx.textAlign = 'left'
  ctx.fillStyle = '#23323a'
  ctx.font = `700 34px ${FONT}`
  ;['NO LIFEGUARD ON DUTY', 'SWIM AT OWN RISK', 'NO RUNNING', 'NO GLASS ON DECK', 'SHOWER BEFORE SWIM', 'HOURS 8AM – 10PM'].forEach((t, i) => {
    ctx.fillStyle = '#e2382a'
    ctx.beginPath(); ctx.arc(46, 180 + i * 72, 10, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = '#23323a'
    ctx.fillText(t, 74, 192 + i * 72, 420)
  })
  ctx.strokeStyle = '#1f6f8b'
  ctx.lineWidth = 12
  ctx.strokeRect(6, 6, 500, 628)
  return c
}

// --- Props -------------------------------------------------------------------------------------
const alu = () => mat('#d4dadd', { metalness: 0.85, roughness: 0.25 })
// Chaise lounger in local space: length along x (foot at -x, head at +x).
export function lounger({ cushion = null, towel = null, back = 0.62, flat = false } = {}) {
  const g = new Group()
  const frame = alu()
  const strapA = mat('#f6f2ea', { roughness: 0.5 })
  const strapB = mat(C.teal, { roughness: 0.5 })
  const L = 1.25 // seat part length
  const y = 0.33
  // Side rails + legs + wheels at the head end.
  for (const s of [-0.34, 0.34]) {
    const r = new Mesh(new CylinderGeometry(0.018, 0.018, L, 8), frame)
    r.rotation.z = Math.PI / 2
    r.position.set(-0.95 + L / 2, y, s)
    g.add(r)
    for (const x of [-0.88, 0.22]) {
      const leg = new Mesh(new CylinderGeometry(0.016, 0.016, y, 8), frame)
      leg.position.set(x, y / 2, s)
      g.add(leg)
    }
    const wheel = new Mesh(new CylinderGeometry(0.06, 0.06, 0.03, 12), mat('#3a3a3a'))
    wheel.rotation.x = Math.PI / 2
    wheel.position.set(0.22, 0.06, s + Math.sign(s) * 0.03)
    g.add(wheel)
  }
  // Webbing straps across the seat.
  for (let i = 0; i < 10; i++) box(g, 0.075, 0.012, 0.68, i % 2 ? strapB : strapA, -0.9 + i * 0.125, y + 0.012, 0)
  // Back rest (hinged at the head end of the seat).
  const bk = new Group()
  bk.position.set(-0.95 + L, y, 0)
  bk.rotation.z = flat ? 0 : back
  for (const s of [-0.34, 0.34]) {
    const r = new Mesh(new CylinderGeometry(0.018, 0.018, 0.7, 8), frame)
    r.rotation.z = Math.PI / 2
    r.position.set(0.35, 0, s)
    bk.add(r)
  }
  for (let i = 0; i < 6; i++) box(bk, 0.075, 0.012, 0.68, i % 2 ? strapB : strapA, 0.06 + i * 0.12, 0.012, 0)
  const cap = new Mesh(new CylinderGeometry(0.018, 0.018, 0.7, 8), frame)
  cap.rotation.x = Math.PI / 2
  cap.position.set(0.7, 0, 0)
  bk.add(cap)
  if (cushion) {
    rbox(bk, 0.68, 0.07, 0.62, 0.03, mat(cushion, { roughness: 0.9 }), 0.36, 0.05, 0)
    rbox(bk, 0.2, 0.1, 0.5, 0.05, mat('#fbf6ec', { roughness: 0.9 }), 0.6, 0.11, 0)
  }
  g.add(bk)
  if (!flat) {
    const prop = new Mesh(new CylinderGeometry(0.014, 0.014, 0.42, 8), frame)
    prop.position.set(-0.95 + L + 0.32, y - 0.02, 0)
    prop.rotation.z = -0.35
    g.add(prop)
  }
  if (cushion) rbox(g, L - 0.08, 0.07, 0.62, 0.03, mat(cushion, { roughness: 0.9 }), -0.95 + L / 2, y + 0.05, 0)
  if (towel) {
    rbox(g, 0.5, 0.05, 0.4, 0.02, mat(towel, { roughness: 1 }), -0.45, y + 0.11, 0.05)
    box(g, 0.51, 0.064, 0.06, mat('#ffffff', { roughness: 1 }), -0.45, y + 0.11, 0.18)
  }
  return g
}

function umbrella(colA, colB) {
  const g = new Group()
  const pole = mat('#f4efe6', { roughness: 0.4 })
  rbox(g, 0.5, 0.08, 0.5, 0.03, mat('#9aa1a4', { roughness: 0.6 }), 0, 0.04, 0)
  const p = new Mesh(new CylinderGeometry(0.03, 0.03, 2.5, 10), pole)
  p.position.y = 1.27
  g.add(p)
  const t = canvasTex(stripes(colA, colB, 8))
  t.wrapS = RepeatWrapping
  const canopyM = new MeshStandardMaterial({ map: t, roughness: 0.85, side: DoubleSide })
  const can = new Mesh(new ConeGeometry(1.35, 0.5, 8, 1, true), canopyM)
  can.position.y = 2.42
  g.add(can)
  const val = new Mesh(new CylinderGeometry(1.35, 1.35, 0.14, 8, 1, true), canopyM)
  val.position.y = 2.1
  g.add(val)
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8
    const rib = new Mesh(new CylinderGeometry(0.008, 0.008, 1.38, 5), pole)
    rib.position.set(Math.cos(a) * 0.66, 2.39, Math.sin(a) * 0.66)
    rib.rotation.set(0, -a, 0)
    rib.rotateZ(Math.PI / 2 - 0.35)
    g.add(rib)
  }
  const fin = new Mesh(new SphereGeometry(0.06, 10, 6), pole)
  fin.position.y = 2.7
  g.add(fin)
  return g
}

function sideTable() {
  const g = new Group()
  const top = new Mesh(new CylinderGeometry(0.36, 0.36, 0.03, 20), mat('#f6f2ea', { roughness: 0.35 }))
  top.position.y = 0.62
  g.add(top)
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2
    const leg = new Mesh(new CylinderGeometry(0.014, 0.014, 0.64, 6), alu())
    leg.position.set(Math.cos(a) * 0.25, 0.31, Math.sin(a) * 0.25)
    leg.rotation.set(Math.sin(a) * 0.12, 0, -Math.cos(a) * 0.12)
    g.add(leg)
  }
  // Drinks: a lemonade with a straw and an iced soda.
  const glassM = new MeshStandardMaterial({ color: '#f6e27a', roughness: 0.1, transparent: true, opacity: 0.75 })
  const cup = new Mesh(new CylinderGeometry(0.04, 0.032, 0.13, 12), glassM)
  cup.position.set(0.12, 0.7, 0.08)
  g.add(cup)
  const straw = new Mesh(new CylinderGeometry(0.005, 0.005, 0.18, 5), mat('#e2382a'))
  straw.position.set(0.13, 0.78, 0.08)
  straw.rotation.z = 0.25
  g.add(straw)
  const lemon = new Mesh(new CylinderGeometry(0.03, 0.03, 0.006, 10), mat('#f6d33c'))
  lemon.position.set(0.155, 0.765, 0.08)
  lemon.rotation.z = Math.PI / 2
  g.add(lemon)
  const can = new Mesh(new CylinderGeometry(0.033, 0.033, 0.12, 12), mat('#2f6fd0', { metalness: 0.6, roughness: 0.3 }))
  can.position.set(-0.1, 0.695, -0.06)
  g.add(can)
  return g
}

function ringBuoy() {
  const g = new Group()
  box(g, 0.1, 1.7, 0.1, mat('#f4efe6'), 0, 0.85, 0)
  box(g, 0.06, 0.06, 0.22, mat('#9aa1a4', { metalness: 0.6 }), 0, 1.55, 0.12)
  const t = canvasTex(stripes('#ff6a1e', '#ffffff', 8, 256, 32))
  const ring = new Mesh(new TorusGeometry(0.3, 0.075, 10, 28), new MeshStandardMaterial({ map: t, roughness: 0.6 }))
  ring.position.set(0, 1.25, 0.14)
  g.add(ring)
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4
    const r = new Mesh(new TorusGeometry(0.075, 0.012, 5, 10), mat('#f2e6c8'))
    r.position.set(Math.cos(a) * 0.3, 1.25 + Math.sin(a) * 0.3, 0.14)
    r.rotation.y = Math.PI / 2
    r.rotation.x = a
    g.add(r)
  }
  // Coiled throw rope hanging below.
  for (let i = 0; i < 3; i++) {
    const coil = new Mesh(new TorusGeometry(0.16 - i * 0.015, 0.012, 5, 18), mat('#f2e6c8'))
    coil.position.set(0, 0.75 - i * 0.02, 0.1)
    g.add(coil)
  }
  return g
}

function poleRack() {
  const g = new Group()
  const post = mat('#f4efe6')
  for (const x of [-0.8, 0.8]) {
    box(g, 0.08, 1.2, 0.08, post, x, 0.6, 0)
    for (const y of [0.55, 0.85, 1.1]) box(g, 0.05, 0.05, 0.16, mat('#9aa1a4', { metalness: 0.6 }), x, y, 0.08)
  }
  const aluM = alu()
  const rod = (y, len) => {
    const r = new Mesh(new CylinderGeometry(0.018, 0.018, len, 8), aluM)
    r.rotation.z = Math.PI / 2
    r.position.set(0, y + 0.04, 0.12)
    g.add(r)
    return r
  }
  // Leaf net.
  rod(0.55, 2.6)
  const net = new Mesh(new TorusGeometry(0.2, 0.015, 6, 16), mat('#2f6fd0'))
  net.position.set(1.48, 0.59, 0.12)
  net.rotation.y = Math.PI / 2
  g.add(net)
  const mesh = new Mesh(new CircleGeometry(0.2, 14), new MeshStandardMaterial({ color: '#1f3f6a', transparent: true, opacity: 0.55, side: DoubleSide }))
  mesh.position.copy(net.position)
  mesh.rotation.y = Math.PI / 2
  g.add(mesh)
  // Wall brush.
  rod(0.85, 2.4)
  box(g, 0.08, 0.08, 0.45, mat('#2a8fb0'), -1.25, 0.89, 0.12)
  // Shepherd's hook.
  rod(1.1, 2.6)
  const hook = new Mesh(new TorusGeometry(0.22, 0.018, 6, 16, Math.PI * 1.3), aluM)
  hook.position.set(1.52, 1.32, 0.12)
  hook.rotation.z = -Math.PI / 2
  g.add(hook)
  return g
}

function bucket(label, color) {
  const g = new Group()
  const b = new Mesh(new CylinderGeometry(0.17, 0.14, 0.38, 16), mat(color, { roughness: 0.4 }))
  b.position.y = 0.19
  g.add(b)
  const lid = new Mesh(new CylinderGeometry(0.18, 0.18, 0.03, 16), mat('#f4f4f4', { roughness: 0.4 }))
  lid.position.y = 0.39
  g.add(lid)
  const handle = new Mesh(new TorusGeometry(0.15, 0.008, 5, 14, Math.PI), mat('#bfc6c8', { metalness: 0.6 }))
  handle.position.y = 0.38
  g.add(handle)
  const lbl = new Mesh(new PlaneGeometry(0.22, 0.14), new MeshStandardMaterial({ map: canvasTex(paintSign({ w: 192, h: 120, bg: '#ffffff', border: color, borderW: 8, radius: 6, lines: [{ t: label, size: 30, color: '#23323a' }, { t: '⚠', size: 34, color: '#e2382a' }] })) }))
  lbl.position.set(0, 0.2, 0.158)
  lbl.rotation.x = -0.08
  g.add(lbl)
  return g
}

function hoseReel() {
  const g = new Group()
  const frame = mat('#2f8f4a', { roughness: 0.5 })
  for (const z of [-0.2, 0.2]) {
    const s = new Mesh(new CylinderGeometry(0.3, 0.3, 0.03, 18), frame)
    s.rotation.x = Math.PI / 2
    s.position.set(0, 0.42, z)
    g.add(s)
    box(g, 0.05, 0.42, 0.05, frame, -0.22, 0.21, z)
    box(g, 0.05, 0.42, 0.05, frame, 0.22, 0.21, z)
  }
  for (let i = 0; i < 6; i++) {
    const t = new Mesh(new TorusGeometry(0.2 - i * 0.004, 0.025, 6, 20), mat('#3fae5a', { roughness: 0.5 }))
    t.position.set(0, 0.42, -0.15 + i * 0.06)
    g.add(t)
  }
  const crank = box(g, 0.03, 0.22, 0.03, mat('#e9e9e9'), 0.08, 0.5, 0.24)
  crank.rotation.z = 0.5
  return g
}

function shower() {
  const g = new Group()
  const chrome = mat('#dfe5e8', { metalness: 0.9, roughness: 0.18 })
  rbox(g, 0.9, 0.04, 0.9, 0.01, mat('#cfd6d8', { roughness: 0.7 }), 0, 0.02, 0)
  for (let i = 0; i < 6; i++) box(g, 0.6, 0.006, 0.02, mat('#3a3a3a'), 0, 0.042, -0.15 + i * 0.06)
  const p = new Mesh(new CylinderGeometry(0.04, 0.045, 2.3, 12), chrome)
  p.position.y = 1.15
  g.add(p)
  const arm = new Mesh(new CylinderGeometry(0.025, 0.025, 0.45, 10), chrome)
  arm.rotation.z = Math.PI / 2
  arm.position.set(0.22, 2.28, 0)
  g.add(arm)
  const head = new Mesh(new CylinderGeometry(0.06, 0.13, 0.08, 16), chrome)
  head.position.set(0.44, 2.2, 0)
  g.add(head)
  const chain = new Mesh(new CylinderGeometry(0.006, 0.006, 0.6, 5), chrome)
  chain.position.set(0.2, 1.95, 0)
  g.add(chain)
  const ring = new Mesh(new TorusGeometry(0.035, 0.008, 5, 10), chrome)
  ring.position.set(0.2, 1.62, 0)
  g.add(ring)
  return g
}

function towelBin() {
  const g = new Group()
  const frame = mat('#d4dadd', { metalness: 0.8, roughness: 0.3 })
  rbox(g, 0.8, 0.06, 0.5, 0.02, frame, 0, 0.12, 0)
  rbox(g, 0.8, 0.06, 0.5, 0.02, frame, 0, 0.62, 0)
  for (const [x, z] of [[-0.38, -0.23], [0.38, -0.23], [-0.38, 0.23], [0.38, 0.23]]) {
    box(g, 0.03, 0.9, 0.03, frame, x, 0.5, z)
    const w = new Mesh(new CylinderGeometry(0.04, 0.04, 0.045, 10), mat('#3a3a3a'))
    w.rotation.x = Math.PI / 2
    w.position.set(x, 0.05, z)
    g.add(w)
  }
  const cols = ['#27a596', '#f6f2ea', '#f2b632', '#ff7fb0']
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 2; j++) {
      rbox(g, 0.34, 0.07, 0.4, 0.02, mat(cols[(i + j) % 4], { roughness: 1 }), -0.18 + j * 0.36, 0.7 + i * 0.075, 0)
    }
  }
  return g
}

// --- The dressing ------------------------------------------------------------------------------
// g: pool group, P: LAYOUT.pool, solid: collider helper, water: the water mesh (gets a
// rippled normal map). Returns { setOpen(open), update(dt, t, waterY, fill) }.
export function dressPool(g, P, solid, water) {
  const st = new Group() // baked
  const mx = (P.x0 + P.x1) / 2
  const mz = (P.z0 + P.z1) / 2
  const pw = P.x1 - P.x0
  const pd = P.z1 - P.z0
  const deep = -P.depth
  // Coping: 0.56 m stone slabs overhanging the wall by 6 cm, with a rounded bullnose.
  const copeT = tex(paintCoping())
  const cope = mat('#ffffff', { map: copeT, roughness: 0.6 })
  const nose = mat('#f7f0e2', { roughness: 0.45 })
  box(st, pw + 1.12, 0.12, 0.56, cope, mx, 0.08, P.z0 - 0.12, 1.2)
  box(st, pw + 1.12, 0.12, 0.56, cope, mx, 0.08, P.z1 + 0.12, 1.2)
  box(st, 0.56, 0.12, pd - 0.32, cope, P.x0 - 0.12, 0.08, mz, 1.2)
  box(st, 0.56, 0.12, pd - 0.32, cope, P.x1 + 0.12, 0.08, mz, 1.2)
  const bull = (len, x, z, alongX) => {
    const m = new Mesh(new CylinderGeometry(0.065, 0.065, len, 10), nose)
    m.position.set(x, 0.075, z)
    if (alongX) m.rotation.z = Math.PI / 2
    else m.rotation.x = Math.PI / 2
    st.add(m)
  }
  bull(pw - 0.32, mx, P.z0 + 0.16, true)
  bull(pw - 0.32, mx, P.z1 - 0.16, true)
  bull(pd - 0.32, P.x0 + 0.16, mz, false)
  bull(pd - 0.32, P.x1 - 0.16, mz, false)
  // Mosaic waterline band on all four walls.
  const mosT = tex(paintMosaic())
  const band = (len, x, z, ry) => {
    const t = mosT.clone()
    t.repeat.set(len / 1.2, 1)
    t.needsUpdate = true
    const m = new Mesh(new PlaneGeometry(len, 0.3), new MeshStandardMaterial({ map: t, roughness: 0.25, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }))
    m.position.set(x, -0.18, z)
    m.rotation.y = ry
    st.add(m)
  }
  band(pw - 0.2, mx, P.z0 + 0.106, 0)
  band(pw - 0.2, mx, P.z1 - 0.106, Math.PI)
  band(pd - 0.2, P.x0 + 0.106, mz, Math.PI / 2)
  band(pd - 0.2, P.x1 - 0.106, mz, -Math.PI / 2)
  // Lane line T-ends on the floor and wall targets.
  const navy = mat('#1f6f8b', { roughness: 0.35 })
  box(st, 0.18, 0.03, 1.0, navy, P.x0 + 0.6, deep + 0.045, mz) // 1 cm taller than the lane line
  box(st, 0.18, 0.03, 1.0, navy, P.x1 - 0.6, deep + 0.045, mz)
  for (const [x, s] of [[P.x0 + 0.105, 1], [P.x1 - 0.105, -1]]) {
    box(st, 0.01, P.depth - 0.55, 0.18, navy, x, deep + (P.depth - 0.55) / 2, mz)
    box(st, 0.01, 0.18, 0.8, navy, x, -0.75, mz)
    void s
  }
  // Main drains: square anti-vortex grates at the deep end.
  const grate = mat('#e9eef0', { roughness: 0.4 })
  const slotM = mat('#14323e')
  for (const z of [mz - 1.3, mz + 1.3]) {
    box(st, 0.5, 0.03, 0.5, grate, P.x0 + 2.2, deep + 0.04, z)
    for (let i = 0; i < 6; i++) box(st, 0.4, 0.044, 0.025, slotM, P.x0 + 2.2, deep + 0.04, z - 0.18 + i * 0.072)
  }
  // Return jets (chrome eyeballs) on the end walls.
  const chrome = mat('#dfe5e8', { metalness: 0.9, roughness: 0.18 })
  for (const [x, ry] of [[P.x0 + 0.1, Math.PI / 2], [P.x1 - 0.1, -Math.PI / 2]]) {
    for (const z of [mz - 2.5, mz + 2.5]) {
      const j = new Group()
      j.position.set(x, -0.62, z)
      j.rotation.y = ry
      const ring = new Mesh(new CylinderGeometry(0.06, 0.06, 0.03, 14), chrome)
      ring.rotation.x = Math.PI / 2
      ring.position.z = 0.015
      j.add(ring)
      const ball = new Mesh(new SphereGeometry(0.035, 10, 6), chrome)
      ball.position.z = 0.03
      j.add(ball)
      st.add(j)
    }
  }
  // Skimmers: dark throats at the waterline in the front wall, round lids on the deck.
  for (const x of [P.x0 + 6.5, P.x1 - 2.2]) {
    box(st, 0.42, 0.2, 0.02, slotM, x, -0.17, P.z1 - 0.1)
    box(st, 0.46, 0.03, 0.03, chrome, x, -0.06, P.z1 - 0.11)
    const lid = new Mesh(new CylinderGeometry(0.22, 0.22, 0.02, 20), mat('#f4f1ea', { roughness: 0.4 }))
    lid.position.set(x, 0.145, P.z1 + 0.62)
    st.add(lid)
    const lidRing = new Mesh(new TorusGeometry(0.2, 0.01, 5, 20), mat('#cfc6b4'))
    lidRing.rotation.x = Math.PI / 2
    lidRing.position.set(x, 0.156, P.z1 + 0.62)
    st.add(lidRing)
  }
  // Step nosings (navy tile edge on each tread).
  for (let i = 0; i < 4; i++) {
    const h = P.depth - i * (P.depth / 4)
    box(st, 2.0, 0.02, 0.06, navy, P.x1 - 1.2, -h + 0.37, P.z0 + 0.35 + i * 0.45 + 0.2)
  }
  // Ladder escutcheons + bumpers.
  for (const dx of [-0.3, 0.3]) {
    const e = new Mesh(new CylinderGeometry(0.06, 0.06, 0.02, 14), chrome)
    e.position.set(P.x0 + 3 + dx, 0.15, P.z1 + 0.3)
    st.add(e)
    const bump = new Mesh(new SphereGeometry(0.04, 8, 6), mat('#3a3a3a'))
    bump.position.set(P.x0 + 3 + dx, -0.6, P.z1 - 0.13)
    st.add(bump)
  }
  // Diving board: non-slip top, fulcrum, handrails, anchor bolts.
  const dbz = mz + 2
  const grit = mat('#d8c9a4', { roughness: 1 })
  box(st, 2.3, 0.012, 0.47, grit, P.x0 + 0.5, 0.612, dbz)
  const ful = new Mesh(new CylinderGeometry(0.07, 0.07, 0.62, 12), mat('#f2b632', { roughness: 0.4 }))
  ful.rotation.x = Math.PI / 2
  ful.position.set(P.x0 - 0.45, 0.5, dbz)
  st.add(ful)
  for (const s of [-0.38, 0.38]) {
    for (const x of [P.x0 - 1.25, P.x0 - 0.25]) {
      const post = new Mesh(new CylinderGeometry(0.025, 0.025, 1.05, 8), chrome)
      post.position.set(x, 0.52, dbz + s)
      st.add(post)
    }
    const rail = new Mesh(new CylinderGeometry(0.025, 0.025, 1.12, 8), chrome)
    rail.rotation.z = Math.PI / 2
    rail.position.set(P.x0 - 0.75, 1.05, dbz + s)
    st.add(rail)
  }
  for (const [dx, dz] of [[-0.3, -0.22], [0.3, -0.22], [-0.3, 0.22], [0.3, 0.22]]) {
    const b = new Mesh(new CylinderGeometry(0.025, 0.025, 0.02, 6), chrome)
    b.position.set(P.x0 - 0.9 + dx, 0.51, dbz + dz)
    st.add(b)
  }
  // Depth markers (coping + wall tiles) and deck stencils.
  const decalOpts = { transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }
  const depthM = new MeshStandardMaterial({ map: canvasTex(stencil('5 FT', 256, 128)), ...decalOpts })
  for (const [x, z, ry] of [[P.x0 + 1.2, P.z0 - 0.2, Math.PI], [P.x1 - 1.2, P.z1 + 0.25, 0], [P.x1 - 3.5, P.z0 - 0.2, Math.PI]]) {
    const m = new Mesh(new PlaneGeometry(0.6, 0.3), depthM)
    m.rotation.set(-Math.PI / 2, 0, ry)
    m.position.set(x, 0.146, z)
    st.add(m)
  }
  for (const [x, z, ry] of [[P.x0 + 1.2, P.z1 - 0.106, Math.PI], [P.x0 + 1.2, P.z0 + 0.106, 0]]) {
    const m = new Mesh(new PlaneGeometry(0.44, 0.22), depthM)
    m.rotation.y = ry
    m.position.set(x, -0.45, z + (z < mz ? 0.004 : -0.004))
    st.add(m)
  }
  const runM = new MeshStandardMaterial({ map: canvasTex(stencil('NO RUNNING')), ...decalOpts })
  for (const [z, ry] of [[P.z0 - 1.0, Math.PI], [P.z1 + 1.05, 0]]) {
    const m = new Mesh(new PlaneGeometry(2.2, 0.55), runM)
    m.rotation.set(-Math.PI / 2, 0, ry)
    m.position.set(mx, 0.066, z)
    st.add(m)
  }
  // Slot drains in the deck along both long sides.
  for (const z of [P.z0 - 1.6, P.z1 + 1.65]) {
    box(st, pw, 0.006, 0.08, mat('#bcb4a2', { roughness: 0.8 }), mx, 0.063, z)
    box(st, pw - 0.1, 0.012, 0.02, slotM, mx, 0.065, z)
  }

  // Always-there props: ring buoy, rules sign, pole rack, buckets, hose reel, shower.
  const put = (obj, x, z, ry = 0) => {
    obj.position.set(x, 0.06, z)
    obj.rotation.y = ry
    st.add(obj)
    return obj
  }
  put(ringBuoy(), P.x1 + 1.3, P.z1 + 1.15, Math.PI)
  solid(0.08, 0.9, 0.08, P.x1 + 1.3, 0.9, P.z1 + 1.15)
  const rules = new Group()
  for (const x of [-0.6, 0.6]) box(rules, 0.08, 2.2, 0.08, mat('#f4efe6'), x, 1.1, 0)
  rbox(rules, 1.4, 1.7, 0.06, 0.02, mat('#1f6f8b'), 0, 1.25, 0.04)
  const rm = new Mesh(new PlaneGeometry(1.3, 1.6), new MeshStandardMaterial({ map: canvasTex(paintRules()), roughness: 0.6 }))
  rm.position.set(0, 1.25, 0.075)
  rules.add(rm)
  put(rules, P.x1 + 4.2, P.z1 + 3.4, -0.35)
  solid(0.7, 1.1, 0.1, P.x1 + 4.2, 1.1, P.z1 + 3.4)
  put(poleRack(), P.x0 - 3.1, mz - 2.8, Math.PI / 2)
  solid(0.1, 0.6, 1.0, P.x0 - 3.1, 0.6, mz - 2.8)
  put(bucket('CHLORINE', '#2f6fd0'), P.x0 - 2.7, P.z1 + 0.35, 0.3)
  put(bucket('PH+', '#e2382a'), P.x0 - 3.15, P.z1 + 0.05, -0.2)
  put(hoseReel(), P.x0 - 3.3, P.z1 - 0.9, 0.2)
  solid(0.55, 0.5, 0.6, P.x0 - 3.0, 0.5, P.z1 - 0.3)
  put(shower(), P.x1 + 1.5, P.z0 - 1.5, Math.PI)
  solid(0.08, 1.2, 0.08, P.x1 + 1.5, 1.2, P.z0 - 1.5)
  g.add(bake(st, true))

  // Closed: loungers stacked by the east deck. Open: laid out with umbrellas.
  const stack = new Group()
  for (let i = 0; i < 4; i++) {
    const l = lounger({ flat: true })
    l.position.y = i * 0.13
    l.rotation.y = (i % 2) * 0.05
    stack.add(l)
  }
  stack.position.set(P.x1 + 3, 0.06, P.z0 + 2)
  stack.rotation.y = Math.PI / 2
  g.add(stack)
  solid(0.4, 0.5, 1.0, P.x1 + 3, 0.5, P.z0 + 2)
  const open = new Group()
  const cushions = ['#27a596', '#f06a34', '#2f6fd0', '#f2b632']
  const towels = ['#ff7fb0', '#f2b632', '#5ac46a', '#2f6fd0', null, '#e2382a']
  const lay = (x, z, ry, i) => {
    const l = lounger({ cushion: i % 3 === 2 ? null : cushions[i % 4], towel: towels[i % 6], back: 0.55 + (i % 3) * 0.12 })
    l.position.set(x, 0.06, z)
    l.rotation.y = ry
    open.add(l)
  }
  // East row (heads east) and south row (heads south).
  const ex = P.x1 + 2.8
  ;[P.z0 + 1.4, P.z0 + 3.1, P.z1 - 2.6, P.z1 - 0.9].forEach((z, i) => lay(ex, z, 0, i))
  const sz = P.z0 - 2.4
  ;[P.x0 + 2.5, P.x0 + 4.2, P.x1 - 3.5, P.x1 - 1.8].forEach((x, i) => lay(x, sz, Math.PI / 2, i + 4))
  const umbrellas = [
    [ex, P.z0 + 2.25, '#f06a34', '#fff3dc'],
    [ex, P.z1 - 1.75, '#27a596', '#fff3dc'],
    [P.x0 + 3.35, sz, '#2f6fd0', '#ffffff'],
    [P.x1 - 2.65, sz, '#e2382a', '#fff3dc'],
  ]
  for (const [x, z, a, b] of umbrellas) {
    const u = umbrella(a, b)
    u.position.set(x, 0.06, z)
    u.rotation.y = x * 0.7
    open.add(u)
    const t = sideTable()
    t.position.set(x, 0.06, z)
    open.add(t)
  }
  const bin = towelBin()
  bin.position.set(P.x1 + 2.8, 0.06, P.z0 - 1.6)
  open.add(bin)
  open.visible = false
  g.add(open)
  const openSolids = []
  // Floating toys.
  const floatRing = new Mesh(new TorusGeometry(0.42, 0.16, 12, 28), new MeshStandardMaterial({ map: canvasTex(stripes('#ff7fb0', '#ffffff', 10, 256, 32)), roughness: 0.3 }))
  floatRing.rotation.x = Math.PI / 2
  const ballTex = canvasTex(stripes('#e2382a', '#ffffff', 6, 256, 128))
  const ball = new Mesh(new SphereGeometry(0.22, 18, 12), new MeshStandardMaterial({ map: ballTex, roughness: 0.35 }))
  const toys = [floatRing, ball]
  for (const t of toys) {
    t.visible = false
    g.add(t)
  }

  // Water: rippled normal map + caustics on the floor.
  const nT = tex(paintRipples(), { srgb: false })
  nT.repeat.set(pw / 3, pd / 3)
  water.material.normalMap = nT
  water.material.normalScale = new Vector2(0.45, 0.45)
  water.material.roughness = 0.04
  water.material.needsUpdate = true
  const cT = tex(paintCaustics(), { srgb: false })
  cT.repeat.set(pw / 2.2, pd / 2.2)
  const caustics = []
  for (let i = 0; i < 2; i++) {
    const t = i ? cT.clone() : cT
    if (i) {
      t.repeat.set(pw / 3.1, pd / 3.1)
      t.needsUpdate = true
    }
    const m = new Mesh(new PlaneGeometry(pw - 0.22, pd - 0.22), new MeshBasicMaterial({ map: t, color: new Color('#9feaff'), transparent: true, opacity: 0, blending: AdditiveBlending, depthWrite: false }))
    m.rotation.x = -Math.PI / 2
    m.position.set(mx, deep + 0.075 + i * 0.01, mz) // above the lane line, T-ends and drains
    m.visible = false
    g.add(m)
    caustics.push(m)
  }
  // Underwater lights (glow once the pool is open).
  const lensM = new MeshStandardMaterial({ color: '#eaffff', emissive: '#9ff2ff', emissiveIntensity: 0, roughness: 0.1 })
  for (const [x, z, ry] of [[mx - 2.5, P.z0 + 0.1, 0], [mx + 2.5, P.z0 + 0.1, 0], [mx, P.z1 - 0.1, Math.PI]]) {
    const l = new Group()
    l.position.set(x, -0.95, z)
    l.rotation.y = ry
    const rim = new Mesh(new CylinderGeometry(0.17, 0.17, 0.03, 20), chrome)
    rim.rotation.x = Math.PI / 2
    rim.position.z = 0.015
    l.add(rim)
    const lens = new Mesh(new CircleGeometry(0.14, 20), lensM)
    lens.position.z = 0.042 // 1.2 cm in front of the rim face
    l.add(lens)
    g.add(l)
  }

  let isOpen = false
  return {
    setOpen(v) {
      isOpen = v
      open.visible = v
      stack.visible = !v
      if (v && !openSolids.length) {
        // Colliders for the laid-out loungers and umbrella tables.
        for (const z of [P.z0 + 1.4, P.z0 + 3.1, P.z1 - 2.6, P.z1 - 0.9]) openSolids.push(solid(0.95, 0.35, 0.36, ex, 0.4, z))
        for (const x of [P.x0 + 2.5, P.x0 + 4.2, P.x1 - 3.5, P.x1 - 1.8]) openSolids.push(solid(0.36, 0.35, 0.95, x, 0.4, sz))
        for (const [x, z] of umbrellas) openSolids.push(solid(0.36, 0.5, 0.36, x, 0.5, z))
        openSolids.push(solid(0.42, 0.5, 0.27, P.x1 + 2.8, 0.5, P.z0 - 1.6))
      }
    },
    update(dt, t, waterY, fill) {
      if (!isOpen) return
      nT.offset.set(t * 0.015, t * 0.009)
      const k = Math.max(0, (fill - 0.5) * 2)
      caustics[0].material.map.offset.set(t * 0.025, t * 0.012)
      caustics[1].material.map.offset.set(-t * 0.018, t * 0.021)
      for (const c of caustics) {
        c.visible = k > 0
        c.material.opacity = 0.22 * k
      }
      lensM.emissiveIntensity = 1.6 * k
      const show = fill > 0.95
      floatRing.visible = ball.visible = show
      if (show) {
        floatRing.position.set(mx + 2 + Math.sin(t * 0.13) * 1.5, waterY + 0.05 + Math.sin(t * 1.7) * 0.025, mz - 1 + Math.cos(t * 0.11) * 1.2)
        floatRing.rotation.z = t * 0.05
        ball.position.set(mx - 2.5 + Math.cos(t * 0.09) * 1.2, waterY + 0.12 + Math.sin(t * 2.1 + 1) * 0.03, mz + 1.5 + Math.sin(t * 0.1) * 0.9)
        ball.rotation.set(t * 0.3, t * 0.2, 0)
      }
    },
  }
}
