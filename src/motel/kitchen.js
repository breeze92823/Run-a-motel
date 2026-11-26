// The food corner behind the office counter: three stations along the back wall
// (COFFEE BAR, HOT DOGS, BURGERS). Each makes one item at a time in three steps
// that the game drives with set(stage, p):
//   stage 0..2 = step being worked on (p 0..1 = how far), stage 3 = finished item
//   waiting to be taken, stage -1 = empty station.
// Coffee:  cup from the stack -> brew under the spout (stream, rising coffee) -> lid on.
// Hot dog: sausage browns and rolls on the grill -> jumps into a bun -> ketchup and
//          mustard zig-zags appear.
// Burger:  patty browns and flips -> bun, patty, cheese, lettuce, top bun stack up ->
//          a paper box rises around it and closes.
// Locked stations wear a COMING SOON board; AUTO machines get a glowing AUTO plate.
// makeFood(kind) builds the finished item (carried by the player, held by customers).
import { CylinderGeometry, DoubleSide, Group, Mesh, MeshBasicMaterial, MeshStandardMaterial, PlaneGeometry, SphereGeometry, TorusGeometry } from 'three'
import { FOOD, LAYOUT } from '../config.js'
import { RAPIER, addFixed } from '../physics.js'
import { box, canvasTex, mat, rbox, textures } from './kit.js'
import { paintSign } from './paint.js'

const FLOOR_Y = 0.2
const TOP = FLOOR_Y + 0.95 // counter top height
const lerp = (a, b, t) => a + (b - a) * t
const clamp01 = (v) => Math.max(0, Math.min(1, v))
const ease = (t) => t * t * (3 - 2 * t)

function cyl(parent, r0, r1, h, m, x = 0, y = 0, z = 0, seg = 14) {
  const c = new Mesh(new CylinderGeometry(r0, r1, h, seg), m)
  c.position.set(x, y, z)
  c.castShadow = true
  parent.add(c)
  return c
}
function plate(parent, canvasEl, w, h, x, y, z, ry = 0) {
  const m = new Mesh(new PlaneGeometry(w, h), new MeshStandardMaterial({ map: canvasTex(canvasEl), transparent: true, roughness: 0.7, side: DoubleSide }))
  m.position.set(x, y, z)
  m.rotation.y = ry
  parent.add(m)
  return m
}
// Colour-changing material (each station needs its own so cooking can tint it).
const own = (color, o = {}) => new MeshStandardMaterial({ color, roughness: 0.6, ...o })

// --- Finished items ------------------------------------------------------------------------
export function makeFood(kind) {
  const g = new Group()
  if (kind === 'coffee') {
    cyl(g, 0.06, 0.045, 0.15, mat('#fbf7ef', { roughness: 0.5 }), 0, 0.075, 0)
    cyl(g, 0.061, 0.058, 0.04, mat('#2fb3a5'), 0, 0.08, 0)
    cyl(g, 0.065, 0.065, 0.02, mat('#3b2a22', { roughness: 0.4 }), 0, 0.16, 0)
    cyl(g, 0.02, 0.03, 0.02, mat('#3b2a22'), 0.02, 0.175, 0)
  } else if (kind === 'hotdog') {
    const bun = rbox(g, 0.26, 0.07, 0.1, 0.035, mat('#e8a650', { roughness: 0.8 }), 0, 0.035, 0)
    void bun
    const s = new Mesh(new CylinderGeometry(0.03, 0.03, 0.3, 10), mat('#b8452a', { roughness: 0.4 }))
    s.rotation.z = Math.PI / 2
    s.position.y = 0.08
    g.add(s)
    for (let i = 0; i < 5; i++) box(g, 0.05, 0.012, 0.015, mat(i % 2 ? '#ffd23f' : '#e2382a'), -0.1 + i * 0.05, 0.112, (i % 2 ? 1 : -1) * 0.01)
  } else {
    // A burger in its red paper box.
    rbox(g, 0.2, 0.09, 0.2, 0.02, mat('#e2382a', { roughness: 0.6 }), 0, 0.045, 0)
    const lid = rbox(g, 0.2, 0.05, 0.2, 0.02, mat('#f2c232', { roughness: 0.6 }), 0, 0.115, 0)
    void lid
    box(g, 0.21, 0.02, 0.05, mat('#ffffff'), 0, 0.1, 0.08)
  }
  g.traverse((o) => {
    if (o.isMesh) o.castShadow = true
  })
  return g
}

// --- Shared station shell --------------------------------------------------------------------
function shell(parent, x, z, kind) {
  const def = FOOD[kind]
  const g = new Group()
  g.position.set(x, 0, z)
  parent.add(g)
  const wood = mat('#b5652e', { map: textures().wood, roughness: 0.6 })
  const panel = mat('#d58a4a', { map: textures().wood, roughness: 0.6 })
  rbox(g, 1.5, 0.93, 0.7, 0.03, wood, 0, FLOOR_Y + 0.465, 0)
  for (const sx of [-0.37, 0.37]) {
    box(g, 0.66, 0.66, 0.03, panel, sx, FLOOR_Y + 0.44, 0.355)
    box(g, 0.14, 0.04, 0.04, mat('#f2c232', { metalness: 0.6, roughness: 0.3 }), sx, FLOOR_Y + 0.7, 0.38)
  }
  rbox(g, 1.58, 0.06, 0.78, 0.02, mat('#8a4a22', { map: textures().wood, roughness: 0.5 }), 0, TOP - 0.02, 0)
  box(g, 1.52, 0.04, 0.02, mat('#e2382a'), 0, TOP - 0.06, 0.39)
  addFixed(RAPIER.ColliderDesc.cuboid(0.78, 0.6, 0.38), { x, y: 0.6, z })
  // Hanging menu board.
  const sign = paintSign({ w: 512, h: 150, bg: '#fff4e0', border: '#e2382a', borderW: 10, radius: 26, lines: [{ t: `${def.icon} ${def.station}`, size: 72, color: '#c8352a' }] })
  plate(g, sign, 1.2, 0.35, 0, 2.55, -0.3)
  // Status plate (NO ORDERS / step text) redrawn by the game.
  const statusC = document.createElement('canvas')
  statusC.width = 384
  statusC.height = 72
  const statusTex = canvasTex(statusC)
  const status = new Mesh(new PlaneGeometry(0.9, 0.17), new MeshBasicMaterial({ map: statusTex, transparent: true }))
  status.position.set(0, 2.24, -0.3)
  g.add(status)
  let lastStatus = ''
  function setStatus(text, color = '#1f9a8a') {
    const key = text + color
    if (key === lastStatus) return
    lastStatus = key
    const ctx = statusC.getContext('2d')
    ctx.clearRect(0, 0, 384, 72)
    if (text) {
      const c = paintSign({ w: 384, h: 72, bg: color, border: '#ffffff', borderW: 6, radius: 30, lines: [{ t: text, size: text.length > 16 ? 28 : 36, color: '#ffffff' }] })
      ctx.drawImage(c, 0, 0)
    }
    statusTex.needsUpdate = true
  }
  // AUTO plate (shown once the machine upgrade is bought).
  const autoC = paintSign({ w: 256, h: 80, bg: '#14202a', border: '#5ad27a', borderW: 8, radius: 14, lines: [{ t: 'AUTO', size: 54, color: '#5ad27a' }] })
  const autoPlate = new Mesh(new PlaneGeometry(0.34, 0.11), new MeshBasicMaterial({ map: canvasTex(autoC) }))
  autoPlate.position.set(0.55, TOP + 0.06, 0.4)
  autoPlate.visible = false
  g.add(autoPlate)
  // COMING SOON board covering a locked station.
  const lockC = paintSign({ w: 512, h: 300, bg: '#c98b55', border: '#7a4a28', borderW: 16, radius: 10, lines: [{ t: 'COMING', size: 84, color: '#fff4e0' }, { t: 'SOON', size: 84, color: '#fff4e0' }, { t: def.name, size: 46, color: '#ffe07a' }] })
  const lock = new Group()
  rbox(lock, 1.4, 0.8, 0.05, 0.02, mat('#a86a3b', { map: textures().wood, roughness: 0.8 }), 0, TOP + 0.4, 0.05)
  plate(lock, lockC, 1.3, 0.76, 0, TOP + 0.4, 0.085)
  g.add(lock)
  // Equipment and the item being made live in `gear` (hidden while locked).
  const gear = new Group()
  g.add(gear)
  return { g, gear, lock, autoPlate, setStatus }
}

// --- Coffee bar ------------------------------------------------------------------------------
function coffeeStation(parent, x, z) {
  const s = shell(parent, x, z, 'coffee')
  const { gear } = s
  const cup = mat('#fbf7ef', { roughness: 0.5 })
  // Cup stack (left).
  for (let i = 0; i < 5; i++) cyl(gear, 0.06, 0.045, 0.15, cup, -0.5, TOP + 0.075 + i * 0.035, 0.05)
  cyl(gear, 0.062, 0.058, 0.03, mat('#2fb3a5'), -0.5, TOP + 0.08, 0.05)
  // Espresso machine (centre).
  const body = mat('#efe5d2', { roughness: 0.35 })
  rbox(gear, 0.5, 0.66, 0.42, 0.04, body, 0, TOP + 0.33, -0.1)
  rbox(gear, 0.5, 0.06, 0.5, 0.02, mat('#2a2f33'), 0, TOP + 0.03, -0.06) // drip tray
  box(gear, 0.42, 0.012, 0.3, mat('#8e9aa3', { metalness: 0.6 }), 0, TOP + 0.065, 0.0)
  box(gear, 0.4, 0.16, 0.02, mat('#2a3a3f'), 0, TOP + 0.5, 0.115) // display panel
  const screen = new MeshStandardMaterial({ color: '#2fd7ff', emissive: '#2fd7ff', emissiveIntensity: 0.6 })
  box(gear, 0.18, 0.08, 0.01, screen, -0.06, TOP + 0.5, 0.127)
  cyl(gear, 0.025, 0.025, 0.01, mat('#e2382a', { emissive: '#e2382a', emissiveIntensity: 0.4 }), 0.12, TOP + 0.5, 0.13).rotation.x = Math.PI / 2
  box(gear, 0.2, 0.06, 0.1, mat('#2a2f33'), 0, TOP + 0.36, 0.08) // group head
  cyl(gear, 0.018, 0.012, 0.06, mat('#8e9aa3', { metalness: 0.7 }), 0, TOP + 0.3, 0.1)
  // Bean hopper.
  const glass = new MeshStandardMaterial({ color: '#e3f4f7', transparent: true, opacity: 0.45, roughness: 0.05 })
  cyl(gear, 0.13, 0.09, 0.22, glass, 0, TOP + 0.77, -0.12)
  cyl(gear, 0.11, 0.08, 0.14, mat('#6b3b1f', { roughness: 0.9 }), 0, TOP + 0.74, -0.12) // beans sit 1 cm above the hopper's base
  cyl(gear, 0.14, 0.14, 0.03, mat('#2a2f33'), 0, TOP + 0.89, -0.12)
  // Lid stack (right).
  for (let i = 0; i < 6; i++) cyl(gear, 0.065, 0.065, 0.018, mat('#3b2a22', { roughness: 0.4 }), 0.5, TOP + 0.012 + i * 0.022, 0.05)
  // The cup being made.
  const work = new Group()
  gear.add(work)
  cyl(work, 0.06, 0.045, 0.15, cup, 0, 0.075, 0)
  cyl(work, 0.061, 0.058, 0.04, mat('#2fb3a5'), 0, 0.08, 0)
  const liquid = cyl(work, 0.055, 0.045, 0.13, mat('#6b3b1f', { roughness: 0.2 }), 0, 0.07, 0)
  const lid = new Group()
  cyl(lid, 0.065, 0.065, 0.02, mat('#3b2a22', { roughness: 0.4 }), 0, 0, 0)
  cyl(lid, 0.02, 0.03, 0.02, mat('#3b2a22'), 0.02, 0.015, 0)
  work.add(lid)
  const stream = cyl(gear, 0.008, 0.008, 0.16, mat('#6b3b1f', { roughness: 0.2 }), 0, TOP + 0.2, 0.1, 6)
  const cupHome = { x: -0.5, y: TOP + 0.25, z: 0.05 }
  const spout = { x: 0, y: TOP + 0.07, z: 0.1 }
  function set(stage, p) {
    work.visible = stage >= 0
    stream.visible = stage === 1 && p > 0.02 && p < 0.98
    screen.emissiveIntensity = stage === 1 ? 1.4 + Math.sin(p * 40) * 0.4 : 0.6
    if (stage < 0) return
    let k = stage === 0 ? ease(p) : 1
    work.position.set(lerp(cupHome.x, spout.x, k), lerp(cupHome.y, spout.y, k) + Math.sin(k * Math.PI) * 0.18, lerp(cupHome.z, spout.z, k))
    work.rotation.z = stage === 0 ? Math.sin(k * Math.PI) * 0.4 : 0
    liquid.visible = stage >= 1
    liquid.scale.y = stage === 1 ? Math.max(0.05, p) : 1
    liquid.position.y = 0.01 + 0.065 * liquid.scale.y
    lid.visible = stage >= 2
    if (stage === 2) {
      const l = ease(p)
      lid.position.set(lerp(0.5, 0, l), lerp(0.25, 0.16, l) + Math.sin(l * Math.PI) * 0.15, lerp(-0.05, 0, l))
      lid.rotation.x = (1 - l) * 2
    } else lid.position.set(0, 0.16, 0)
    if (stage === 3) lid.rotation.x = 0
  }
  set(-1, 0)
  return { ...s, set, steamAt: { x: x + spout.x, y: TOP + 0.3, z: z + spout.z }, workAt: { x: x, y: TOP + 0.2, z: z + 0.1 } }
}

// --- Hot dog stand ---------------------------------------------------------------------------
function hotdogStation(parent, x, z) {
  const s = shell(parent, x, z, 'hotdog')
  const { gear } = s
  // Grill (left) with a red hood.
  const gx = -0.42
  rbox(gear, 0.6, 0.12, 0.42, 0.02, mat('#2fb3a5', { roughness: 0.4 }), gx, TOP + 0.06, -0.02)
  box(gear, 0.52, 0.02, 0.34, mat('#2a2f33', { roughness: 0.5 }), gx, TOP + 0.125, -0.02)
  const heat = new MeshStandardMaterial({ color: '#5a1a10', emissive: '#ff5a1f', emissiveIntensity: 0.4 })
  for (let i = 0; i < 5; i++) box(gear, 0.5, 0.012, 0.02, heat, gx, TOP + 0.137, -0.15 + i * 0.065)
  const hood = rbox(gear, 0.6, 0.08, 0.38, 0.03, mat('#e2382a', { roughness: 0.4 }), gx, TOP + 0.4, -0.22)
  hood.rotation.x = -1.1
  box(gear, 0.2, 0.03, 0.03, mat('#fbf7ef'), gx, TOP + 0.56, -0.32)
  // Raw sausages waiting, bun basket (centre-back), plate (centre-front).
  for (let i = 0; i < 3; i++) {
    const r = new Mesh(new CylinderGeometry(0.03, 0.03, 0.26, 8), mat('#e88a8a', { roughness: 0.5 }))
    r.rotation.z = Math.PI / 2
    r.position.set(-0.42, TOP + 0.03, 0.27 - i * 0.0)
    r.position.x = -0.62 + i * 0.07
    r.position.z = 0.3
    r.rotation.y = 1.5
    gear.add(r)
  }
  cyl(gear, 0.2, 0.16, 0.12, mat('#8a4a22', { roughness: 0.9 }), 0.08, TOP + 0.06, -0.18)
  for (let i = 0; i < 3; i++) rbox(gear, 0.22, 0.06, 0.08, 0.03, mat('#e8a650', { roughness: 0.8 }), 0.08 + (i - 1) * 0.05, TOP + 0.14 + i * 0.02, -0.18 + (i - 1) * 0.06)
  cyl(gear, 0.17, 0.15, 0.02, mat('#fbf7ef', { roughness: 0.3 }), 0.1, TOP + 0.01, 0.15)
  // Ketchup + mustard (right).
  const ketchup = new Group()
  cyl(ketchup, 0.045, 0.05, 0.2, mat('#e2382a', { roughness: 0.3 }), 0, 0.1, 0)
  cyl(ketchup, 0.012, 0.03, 0.06, mat('#e2382a'), 0, 0.23, 0)
  ketchup.position.set(0.5, TOP, 0.02)
  gear.add(ketchup)
  const mustard = new Group()
  cyl(mustard, 0.045, 0.05, 0.2, mat('#ffd23f', { roughness: 0.3 }), 0, 0.1, 0)
  cyl(mustard, 0.012, 0.03, 0.06, mat('#ffd23f'), 0, 0.23, 0)
  mustard.position.set(0.62, TOP, -0.08)
  gear.add(mustard)
  // Work item.
  const sausageMat = own('#e88a8a', { roughness: 0.45 })
  const sausage = new Mesh(new CylinderGeometry(0.032, 0.032, 0.3, 10), sausageMat)
  sausage.castShadow = true
  gear.add(sausage)
  const bun = new Group()
  rbox(bun, 0.28, 0.05, 0.11, 0.025, mat('#e8a650', { roughness: 0.8 }), 0, 0.025, 0)
  for (const sz of [-1, 1]) {
    const half = rbox(bun, 0.28, 0.06, 0.03, 0.015, mat('#f2c06e', { roughness: 0.8 }), 0, 0.06, sz * 0.045)
    half.rotation.x = sz * 0.25
  }
  bun.position.set(0.1, TOP + 0.02, 0.15)
  gear.add(bun)
  const sauce = []
  for (let i = 0; i < 8; i++) {
    const d = box(gear, 0.045, 0.014, 0.016, mat(i % 2 ? '#ffd23f' : '#e2382a'), 0.1 - 0.12 + (i % 4) * 0.06 + (i >= 4 ? 0.03 : 0), TOP + 0.122, 0.15 + (i % 2 ? 0.012 : -0.012))
    d.rotation.y = i % 2 ? 0.6 : -0.6
    sauce.push(d)
  }
  const raw = [0xe8 / 255, 0x8a / 255, 0x8a / 255]
  const done = [0xa2 / 255, 0x46 / 255, 0x2a / 255]
  function set(stage, p) {
    const vis = stage >= 0
    sausage.visible = vis
    bun.visible = stage >= 1
    heat.emissiveIntensity = stage === 0 ? 1.2 + Math.sin(p * 50) * 0.3 : 0.4
    for (const d of sauce) d.visible = false
    ketchup.rotation.z = 0
    mustard.rotation.z = 0
    if (!vis) return
    const cook = stage === 0 ? p : 1
    sausageMat.color.setRGB(lerp(raw[0], done[0], cook), lerp(raw[1], done[1], cook), lerp(raw[2], done[2], cook))
    if (stage === 0) {
      sausage.position.set(gx, TOP + 0.17, -0.02)
      sausage.rotation.set(p * Math.PI * 6, 0, Math.PI / 2)
    } else if (stage === 1) {
      const k = ease(clamp01((p - 0.3) / 0.7))
      bun.scale.setScalar(Math.max(0.01, ease(clamp01(p / 0.3))))
      sausage.position.set(lerp(gx, 0.1, k), lerp(TOP + 0.17, TOP + 0.085, k) + Math.sin(k * Math.PI) * 0.25, lerp(-0.02, 0.15, k))
      sausage.rotation.set(k * Math.PI * 2, 0, Math.PI / 2)
    } else {
      bun.scale.setScalar(1)
      sausage.position.set(0.1, TOP + 0.085, 0.15)
      sausage.rotation.set(0, 0, Math.PI / 2)
    }
    if (stage === 2) {
      const n = Math.floor(p * sauce.length + 0.001)
      for (let i = 0; i < n; i++) sauce[i].visible = true
      ketchup.rotation.z = p < 0.5 ? Math.sin(p * Math.PI * 2) * 1.6 : 0
      mustard.rotation.z = p >= 0.5 ? Math.sin((p - 0.5) * Math.PI * 2) * 1.6 : 0
    }
    if (stage === 3) for (const d of sauce) d.visible = true
  }
  set(-1, 0)
  return { ...s, set, steamAt: { x: x + gx, y: TOP + 0.25, z: z - 0.02 }, workAt: { x: x + 0.1, y: TOP + 0.15, z: z + 0.15 } }
}

// --- Burger grill ----------------------------------------------------------------------------
function burgerStation(parent, x, z) {
  const s = shell(parent, x, z, 'burger')
  const { gear } = s
  const gx = -0.42
  // Flat-top griddle with a splash guard.
  rbox(gear, 0.62, 0.1, 0.46, 0.02, mat('#8e9aa3', { metalness: 0.6, roughness: 0.3 }), gx, TOP + 0.05, -0.02)
  const plateMat = new MeshStandardMaterial({ color: '#2a2f33', emissive: '#ff5a1f', emissiveIntensity: 0.05, roughness: 0.4 })
  box(gear, 0.56, 0.02, 0.38, plateMat, gx, TOP + 0.105, -0.02)
  box(gear, 0.62, 0.18, 0.02, mat('#8e9aa3', { metalness: 0.6 }), gx, TOP + 0.19, -0.25)
  // Spatula.
  box(gear, 0.1, 0.01, 0.12, mat('#cfd6db', { metalness: 0.8 }), gx + 0.2, TOP + 0.12, 0.18)
  box(gear, 0.02, 0.02, 0.2, mat('#2a2f33'), gx + 0.2, TOP + 0.13, 0.32)
  // Ingredient trays (back) + wrapper stack (right).
  const trays = [['#e8a650', 0.0], ['#ffd23f', 0.17], ['#5cbf4a', 0.34]]
  for (const [c, dx] of trays) {
    rbox(gear, 0.15, 0.05, 0.15, 0.01, mat('#cfd6db', { metalness: 0.5 }), 0.0 + dx, TOP + 0.025, -0.22)
    box(gear, 0.12, 0.03, 0.12, mat(c, { roughness: 0.8 }), 0.0 + dx, TOP + 0.055, -0.22)
  }
  for (let i = 0; i < 4; i++) rbox(gear, 0.2, 0.02, 0.2, 0.01, mat(i % 2 ? '#e2382a' : '#f2c232'), 0.55, TOP + 0.012 + i * 0.022, 0.12)
  cyl(gear, 0.15, 0.14, 0.02, mat('#fbf7ef', { roughness: 0.3 }), 0.12, TOP + 0.01, 0.15)
  // Work item: patty + stack parts + box.
  const pattyMat = own('#d9776a', { roughness: 0.7 })
  const patty = cyl(gear, 0.075, 0.075, 0.035, pattyMat, 0, 0, 0, 16)
  const stackAt = { x: 0.12, y: TOP + 0.02, z: 0.15 }
  const parts = new Group()
  parts.position.set(stackAt.x, stackAt.y, stackAt.z)
  gear.add(parts)
  const bunBottom = cyl(parts, 0.08, 0.075, 0.035, mat('#e8a650', { roughness: 0.8 }), 0, 0.017, 0, 16)
  const cheese = box(parts, 0.15, 0.012, 0.15, mat('#ffd23f'), 0, 0.075, 0)
  cheese.rotation.y = 0.78
  const lettuce = cyl(parts, 0.09, 0.09, 0.012, mat('#5cbf4a', { roughness: 0.9 }), 0, 0.088, 0, 10)
  const top = new Mesh(new SphereGeometry(0.082, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat('#efab4f', { roughness: 0.7 }))
  top.scale.y = 0.65
  parts.add(top)
  const boxG = new Group()
  rbox(boxG, 0.22, 0.12, 0.22, 0.02, mat('#e2382a', { roughness: 0.6 }), 0, 0.06, 0)
  const boxLid = new Group()
  rbox(boxLid, 0.22, 0.04, 0.22, 0.02, mat('#f2c232', { roughness: 0.6 }), 0, 0, 0.11)
  boxLid.position.set(0, 0.13, -0.11)
  boxG.add(boxLid)
  boxG.position.set(stackAt.x, stackAt.y, stackAt.z)
  gear.add(boxG)
  const raw = [0xd9 / 255, 0x77 / 255, 0x6a / 255]
  const done = [0x7a / 255, 0x3b / 255, 0x1f / 255]
  function set(stage, p) {
    const vis = stage >= 0
    patty.visible = vis
    parts.visible = stage >= 1
    boxG.visible = stage >= 2
    plateMat.emissiveIntensity = stage === 0 ? 0.5 + Math.sin(p * 40) * 0.15 : 0.05
    if (!vis) return
    const cook = stage === 0 ? p : 1
    pattyMat.color.setRGB(lerp(raw[0], done[0], cook), lerp(raw[1], done[1], cook), lerp(raw[2], done[2], cook))
    if (stage === 0) {
      patty.position.set(gx, TOP + 0.13 + (p > 0.45 && p < 0.6 ? Math.sin(((p - 0.45) / 0.15) * Math.PI) * 0.2 : 0), -0.02)
      patty.rotation.x = p > 0.45 && p < 0.6 ? ((p - 0.45) / 0.15) * Math.PI : 0
    } else if (stage === 1) {
      // Bottom bun pops in, the patty hops over, then cheese, lettuce and the top bun drop on.
      bunBottom.scale.setScalar(Math.max(0.01, ease(clamp01(p / 0.15))))
      const k = ease(clamp01((p - 0.15) / 0.25))
      patty.position.set(lerp(gx, stackAt.x, k), lerp(TOP + 0.13, stackAt.y + 0.052, k) + Math.sin(k * Math.PI) * 0.22, lerp(-0.02, stackAt.z, k))
      patty.rotation.x = k * Math.PI * 2
      const drop = (part, from, to, y) => {
        const t = ease(clamp01((p - from) / (to - from)))
        part.visible = p > from
        part.position.y = y + (1 - t) * 0.25
      }
      drop(cheese, 0.42, 0.58, 0.075)
      drop(lettuce, 0.58, 0.74, 0.088)
      drop(top, 0.76, 0.95, 0.095)
    } else {
      bunBottom.scale.setScalar(1)
      patty.position.set(stackAt.x, stackAt.y + 0.052, stackAt.z)
      patty.rotation.x = 0
      cheese.visible = lettuce.visible = top.visible = true
      cheese.position.y = 0.075
      lettuce.position.y = 0.088
      top.position.y = 0.095
    }
    if (stage === 2) {
      const k = ease(clamp01(p / 0.6))
      boxG.scale.set(1, Math.max(0.01, k), 1)
      boxLid.rotation.x = -2.2 * (1 - ease(clamp01((p - 0.6) / 0.4)))
    } else if (stage === 3) {
      boxG.scale.set(1, 1, 1)
      boxLid.rotation.x = 0
    }
    // Once boxed, hide the burger inside.
    const boxed = stage === 3 || (stage === 2 && p > 0.85)
    parts.visible = stage >= 1 && !boxed
    patty.visible = !boxed
  }
  set(-1, 0)
  return { ...s, set, steamAt: { x: x + gx, y: TOP + 0.25, z: z - 0.02 }, workAt: { x: x + stackAt.x, y: TOP + 0.15, z: z + stackAt.z } }
}

// --- All three ---------------------------------------------------------------------------------
export function buildKitchen(parent) {
  const z = LAYOUT.stationZ
  const st = {
    coffee: coffeeStation(parent, LAYOUT.stations.coffee, z),
    hotdog: hotdogStation(parent, LAYOUT.stations.hotdog, z),
    burger: burgerStation(parent, LAYOUT.stations.burger, z),
  }
  for (const [kind, s] of Object.entries(st)) {
    s.kind = kind
    s.x = LAYOUT.stations[kind]
    s.z = z + 0.95 // where the player stands
    s.setLocked = (on) => {
      s.lock.visible = on
      s.gear.visible = !on
    }
    s.setAuto = (on) => (s.autoPlate.visible = on)
  }
  return st
}

export { TorusGeometry }
