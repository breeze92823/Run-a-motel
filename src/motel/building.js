// The motel block: a two-storey stucco building facing the lot, with a covered
// walkway and balcony, the starry orange fascia, the office (glass front with a
// lit lobby), ground-floor rooms 101..106, the rundown 2nd floor (boarded doors,
// broken railing, "after the pool" signs), the laundry annex (walk-in, working
// washers), the teal stairs and the vending / ice machines.
//
// Static parts are baked to a few draw calls; doors, plates, curtains, washer
// drums and sign bulbs stay live for the game to drive.
import {
  CircleGeometry,
  CylinderGeometry,
  DoubleSide,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  Object3D,
  PlaneGeometry,
  PointLight,
  SphereGeometry,
  TorusGeometry,
  BoxGeometry,
  Quaternion,
  Vector3,
} from 'three'
import { LAYOUT } from '../config.js'
import { bake } from '../bake.js'
import { RAPIER, addFixed } from '../physics.js'
import { neon } from '../propkit.js'
import { box, C, canvasTex, mat, rbox, stuccoMat, textures } from './kit.js'
import { makePlate, paintChecker, paintNeon, paintSign, tex } from './paint.js'
import { hangingBasket, trashCan } from './props.js'
import { buildRoom } from './rooms.js'
import { buildOffice } from './office.js'
import { buildLaundry } from './laundry.js'
import { buildKitchen } from './kitchen.js'

const B = LAYOUT.building
const FH = B.floorH
const FRONT = B.front
const BACK = B.front - B.depth
const COLZ = FRONT + B.walk // column line
const BAL_EDGE = COLZ + 0.35 // balcony slab front edge

function solid(hx, hy, hz, x, y, z, yaw = 0) {
  addFixed(RAPIER.ColliderDesc.cuboid(hx, hy, hz), { x, y, z }, yaw ? { x: 0, y: Math.sin(yaw / 2), z: 0, w: Math.cos(yaw / 2) } : null)
}

function signMesh(parent, c, w, h, x, y, z, ry = 0, extra = {}) {
  const m = new Mesh(new PlaneGeometry(w, h), new MeshStandardMaterial({ map: canvasTex(c), roughness: 0.6, transparent: true, ...extra }))
  m.position.set(x, y, z)
  m.rotation.y = ry
  parent.add(m)
  return m
}

// --- Doors & windows ---------------------------------------------------------------
// A hinged teal door in a white frame. Returns { pivot } (rotate pivot.rotation.y to open).
function makeDoor(statics, live, x, y, z, number) {
  const W = 1.12
  const H = 2.25
  const white = mat(C.white)
  box(statics, 0.14, H + 0.14, 0.16, white, x - W / 2 - 0.07, y + H / 2 + 0.07, z + 0.04)
  box(statics, 0.14, H + 0.14, 0.16, white, x + W / 2 + 0.07, y + H / 2 + 0.07, z + 0.04)
  box(statics, W + 0.42, 0.16, 0.18, white, x, y + H + 0.1, z + 0.05)
  box(statics, W + 0.1, 0.06, 0.3, mat('#d8cfbf'), x, y + 0.03, z + 0.12) // threshold

  const pivot = new Group()
  pivot.position.set(x - W / 2, y, z + 0.03)
  live.add(pivot)
  const leaf = new Group()
  leaf.position.x = W / 2
  pivot.add(leaf)
  const doorMat = mat(C.door, { roughness: 0.45 })
  const panelMat = mat('#33b5a4', { roughness: 0.45 })
  box(leaf, W, H, 0.07, doorMat, 0, H / 2, 0)
  box(leaf, W * 0.7, H * 0.36, 0.03, panelMat, 0, H * 0.72, 0.045)
  box(leaf, W * 0.7, H * 0.36, 0.03, panelMat, 0, H * 0.3, 0.045)
  box(leaf, W, 0.22, 0.02, mat('#c9c2b3', { metalness: 0.6, roughness: 0.35 }), 0, 0.13, 0.045) // kick plate
  const brass = mat(C.brass, { metalness: 0.85, roughness: 0.3 })
  const knob = new Mesh(new SphereGeometry(0.055, 12, 8), brass)
  knob.position.set(W / 2 - 0.12, 1.02, 0.08)
  knob.castShadow = true
  leaf.add(knob)
  box(leaf, 0.06, 0.2, 0.02, brass, W / 2 - 0.12, 1.02, 0.045)
  const peep = new Mesh(new CylinderGeometry(0.022, 0.022, 0.03, 10), brass)
  peep.rotation.x = Math.PI / 2
  peep.position.set(0, 1.62, 0.05)
  leaf.add(peep)
  // Small number plate on the door.
  const c = paintSign({ w: 160, h: 64, bg: '#f6d36b', border: '#b8862b', borderW: 6, radius: 8, lines: [{ t: String(number), size: 40, color: '#3a2a10' }] })
  const np = new Mesh(new PlaneGeometry(0.3, 0.12), new MeshStandardMaterial({ map: canvasTex(c), roughness: 0.4, metalness: 0.3 }))
  np.position.set(0, 1.88, 0.07)
  leaf.add(np)
  return { pivot }
}

// Window: teal frame, sill, glass, lit curtain behind (emissive at night / when occupied).
function makeWindow(statics, live, x, y, z, w = 2.0, h = 1.35, curtainTex) {
  const teal = mat(C.teal, { roughness: 0.5 })
  const f = 0.12
  box(statics, w + f * 2, f, 0.14, teal, x, y + h + f / 2, z + 0.05)
  box(statics, f, h, 0.14, teal, x - w / 2 - f / 2, y + h / 2, z + 0.05)
  box(statics, f, h, 0.14, teal, x + w / 2 + f / 2, y + h / 2, z + 0.05)
  box(statics, f * 0.6, h, 0.1, teal, x, y + h / 2, z + 0.06) // mullion
  box(statics, w + 0.5, 0.1, 0.3, mat(C.white), x, y - 0.05, z + 0.12) // sill
  let curtainMat = null
  if (curtainTex) {
    curtainMat = new MeshStandardMaterial({ map: curtainTex, emissiveMap: curtainTex, emissive: '#ffcf8a', emissiveIntensity: 0.05, roughness: 0.9 })
    const curtain = new Mesh(new PlaneGeometry(w, h), curtainMat)
    curtain.position.set(x, y + h / 2, z + 0.01)
    live.add(curtain)
  }
  const glass = new Mesh(new PlaneGeometry(w, h), glassMat())
  glass.position.set(x, y + h / 2, z + 0.06)
  live.add(glass)
  return { curtain: curtainMat }
}

let _glass = null
function glassMat() {
  return (_glass ||= new MeshPhysicalMaterial({ color: '#d9fbff', roughness: 0.05, metalness: 0, transparent: true, opacity: 0.25, clearcoat: 1, envMapIntensity: 1.6, depthWrite: false, side: DoubleSide }))
}

// Window AC unit with a louvred grille and a drip stain.
function acUnit(statics, x, y, z) {
  const body = mat('#e7e4dc', { roughness: 0.6 })
  rbox(statics, 0.95, 0.5, 0.42, 0.04, body, x, y, z + 0.2)
  const g = new Mesh(new PlaneGeometry(0.85, 0.4), mat('#ffffff', { map: textures().grille, roughness: 0.6 }))
  g.position.set(x, y, z + 0.415)
  statics.add(g)
}

// Wall sconce: teal backplate, warm glass shade (lit at night).
function sconce(statics, live, bulbs, x, y, z) {
  box(statics, 0.18, 0.3, 0.05, mat(C.tealDark), x, y, z + 0.03)
  const bulb = new MeshStandardMaterial({ color: '#fff1b8', emissive: '#ffd36a', emissiveIntensity: 0.4, roughness: 0.3 })
  const shade = new Mesh(new CylinderGeometry(0.11, 0.13, 0.32, 12), bulb)
  shade.position.set(x, y + 0.02, z + 0.15)
  live.add(shade)
  bulbs.push(bulb)
}

// Boards nailed across a doorway or window (rundown / locked rooms).
function boards(parent, x, y, z, w, h, seed = 0) {
  const g = new Group()
  const wood = mat('#c99a5e', { map: textures().wood, roughness: 0.9 })
  const n = 3
  for (let i = 0; i < n; i++) {
    const tilt = ((i + seed) % 2 ? 1 : -1) * (0.18 + ((i * 7 + seed) % 5) * 0.03)
    const b = box(g, w + 0.4, 0.2, 0.05, wood, 0, h * (0.25 + i * 0.27), 0)
    b.rotation.z = tilt
  }
  g.position.set(x, y, z + 0.12)
  parent.add(g)
  return g
}

// --- Main block -----------------------------------------------------------------------
export function buildMotel(scene) {
  const statics = new Group() // baked
  const live = new Group() // kept as separate meshes
  scene.add(live)
  const t = textures()
  const wall = stuccoMat(C.wall)
  const wallLow = stuccoMat(C.wallLow)
  const white = mat(C.white, { roughness: 0.6 })
  const teal = mat(C.teal, { roughness: 0.5 })
  const orange = mat(C.orange, { roughness: 0.6 })
  const ceiling = mat('#fbf6ee', { roughness: 0.9 })
  const concrete = mat('#f1e9dc', { map: t.pave, normalMap: t.paveN, roughness: 0.9 })
  const starMat = mat('#ffffff', { map: t.star, roughness: 0.55 })
  const bulbs = [] // sconce / ceiling materials that light up at night
  const W = B.x1 - B.x0
  const cx = (B.x0 + B.x1) / 2

  // Walls: two storeys of stucco, darker band at the bottom of the ground floor.
  // Ground floor front from the office's east edge (the office builds its own glass front).
  const gx0 = LAYOUT.office.x1
  const gw = B.x1 - gx0
  const gcx = (gx0 + B.x1) / 2
  void gw, gcx, wallLow
  box(statics, W, FH, 0.3, wall, cx, FH * 1.5, FRONT - 0.15, 3)
  box(statics, W, 0.08, 0.1, teal, cx, FH + 1.02, FRONT + 0.05)
  box(statics, W, 0.9, 0.05, stuccoMat('#eb9a62'), cx, FH + 0.45, FRONT + 0.02, 3)
  box(statics, W, FH, 0.3, wall, cx, FH * 1.5, BACK + 0.15, 3)
  box(statics, B.x1 - gx0, FH, 0.3, wall, (gx0 + B.x1) / 2, FH / 2, BACK + 0.15, 3)
  box(statics, 0.3, FH * 2, B.depth, wall, B.x0 + 0.15, FH, (FRONT + BACK) / 2, 3)
  box(statics, 0.3, FH * 2, B.depth, wall, B.x1 - 0.15, FH, (FRONT + BACK) / 2, 3)
  // Back wall details: small bathroom windows and pipes.
  for (let x = B.x0 + 4; x < B.x1 - 2; x += 6.5) {
    for (const y of x < gx0 ? [FH + 1.9] : [1.9, FH + 1.9]) {
      box(statics, 0.9, 0.55, 0.1, teal, x, y, BACK - 0.03)
      box(statics, 0.75, 0.42, 0.04, mat('#cfe9ea', { roughness: 0.2 }), x, y, BACK - 0.08)
    }
  }
  box(statics, 0.12, FH * 2, 0.12, mat('#b9b4aa', { metalness: 0.5, roughness: 0.4 }), B.x1 - 3, FH, BACK - 0.1)

  // Walkway slab (raised, concrete) and the curb.
  const walkD = B.walk + 0.6
  box(statics, W + 1.8, 0.2, walkD, concrete, cx + 0.9, 0.1, FRONT + walkD / 2, 2)
  box(statics, W + 1.8, 0.2, 0.18, mat('#e0d5c2'), cx + 0.9, 0.1, FRONT + walkD + 0.09)
  addFixed(RAPIER.ColliderDesc.cuboid((W + 1.8) / 2, 0.1, walkD / 2 + 0.09), { x: cx + 0.9, y: 0.1, z: FRONT + walkD / 2 + 0.09 })

  // Columns: two-storey white posts with teal bases and caps.
  const colXs = []
  for (let i = 0; i <= 7; i++) colXs.push(B.x0 + 0.35 + (i * (W - 0.7)) / 7)
  for (const x of colXs) {
    box(statics, 0.42, FH * 2, 0.42, white, x, FH, COLZ)
    box(statics, 0.56, 0.5, 0.56, teal, x, 0.45, COLZ)
    box(statics, 0.52, 0.12, 0.52, teal, x, FH - 0.45, COLZ)
    box(statics, 0.56, 0.4, 0.56, teal, x, FH + 0.2, COLZ)
    solid(0.28, FH, 0.28, x, FH, COLZ)
  }

  // Balcony slab, ceiling and the starry fascia on its edge (both levels).
  const slabD = BAL_EDGE - FRONT
  box(statics, W + 0.6, 0.3, slabD, concrete, cx, FH - 0.15, FRONT + slabD / 2, 2)
  box(statics, W + 0.6, 0.02, slabD, ceiling, cx, FH - 0.31, FRONT + slabD / 2)
  solid((W + 0.6) / 2, 0.15, slabD / 2, cx, FH - 0.15, FRONT + slabD / 2)
  const fasciaH = 0.72
  for (const y of [FH - 0.05, FH * 2 + 0.2]) {
    box(statics, W + 0.9, fasciaH, 0.22, starMat, cx, y, BAL_EDGE + 0.1, 2.9, fasciaH)
    box(statics, W + 0.95, 0.1, 0.28, teal, cx, y - fasciaH / 2 - 0.04, BAL_EDGE + 0.1)
    box(statics, W + 0.95, 0.12, 0.3, mat('#fff3e2'), cx, y + fasciaH / 2 + 0.05, BAL_EDGE + 0.1)
    for (const sx of [B.x0 - 0.35, B.x1 + 0.35]) box(statics, 0.22, fasciaH, slabD + 0.3, starMat, sx, y, FRONT + slabD / 2, 2.9, fasciaH)
  }
  // Roof canopy and the main roof with a parapet cap.
  box(statics, W + 0.6, 0.25, slabD, ceiling, cx, FH * 2 + 0.05, FRONT + slabD / 2)
  box(statics, W + 0.4, 0.5, B.depth + 0.4, orange, cx, FH * 2 + 0.25, (FRONT + BACK) / 2)
  box(statics, W + 0.8, 0.3, 0.5, orange, cx, FH * 2 + 0.65, BACK + 0.05)
  box(statics, 2.2, 1.2, 2.2, mat('#d9d4ca', { roughness: 0.5, metalness: 0.3 }), B.x1 - 6, FH * 2 + 1.1, BACK + 3) // rooftop AC
  box(statics, 1.4, 1.0, 1.4, mat('#d9d4ca', { roughness: 0.5, metalness: 0.3 }), B.x0 + 9, FH * 2 + 1.0, BACK + 3.5)

  // Round ceiling lights under the balcony and canopy.
  const ceilLight = new MeshStandardMaterial({ color: '#fffaf0', emissive: '#fff1c4', emissiveIntensity: 0.2 })
  bulbs.push(ceilLight)
  const discGeo = new CylinderGeometry(0.28, 0.28, 0.05, 20)
  for (let i = 0; i < 7; i++) {
    const x = (colXs[i] + colXs[i + 1]) / 2
    for (const y of [FH - 0.33, FH * 2 - 0.1]) {
      const d = new Mesh(discGeo, ceilLight)
      d.position.set(x, y, FRONT + slabD / 2)
      live.add(d)
    }
  }

  // Balcony railing (2nd floor): balusters, top rail; a broken stretch in the middle.
  const railMat = mat(C.rail, { roughness: 0.55 })
  const balGeo = new BoxGeometry(0.06, 0.95, 0.06)
  const balXs = []
  for (let x = B.x0 + 0.5; x < B.x1 - 0.4; x += 0.32) balXs.push(x)
  const bal = new InstancedMesh(balGeo, railMat, balXs.length)
  const m4 = new Matrix4()
  const q = new Quaternion()
  const e = new Object3D()
  let n = 0
  balXs.forEach((x, i) => {
    const broken = x > 2 && x < 4.2
    e.position.set(x, FH + 0.5, COLZ + 0.05)
    e.rotation.set(0, 0, broken ? (i % 3 === 0 ? 0.5 : i % 3 === 1 ? -0.35 : 0) : 0)
    if (broken && i % 3 === 2) e.position.y = FH + 0.05 // knocked over
    if (broken && i % 3 === 2) e.rotation.set(0, 0.3, Math.PI / 2)
    e.updateMatrix()
    bal.setMatrixAt(n++, e.matrix)
  })
  bal.count = n
  bal.castShadow = true
  live.add(bal)
  const railA = box(statics, 2 - B.x0 + 0.2, 0.1, 0.12, railMat, (B.x0 + 2) / 2, FH + 1.02, COLZ + 0.05)
  const railB = box(statics, B.x1 - 4.2, 0.1, 0.12, railMat, (B.x1 + 4.2) / 2, FH + 1.02, COLZ + 0.05)
  const sag = box(statics, 2.4, 0.1, 0.12, railMat, 3.1, FH + 0.72, COLZ + 0.12)
  sag.rotation.z = 0.24
  box(statics, W, 0.08, 0.1, railMat, cx, FH + 0.08, COLZ + 0.05)
  void railA, railB, q, m4
  solid(W / 2, 0.6, 0.08, cx, FH + 0.6, COLZ + 0.05)

  // --- Ground floor: office + rooms ---
  const office = buildOffice(statics, live)
  const kitchen = buildKitchen(live)
  // Outside wall spots where vandals spray graffiti (SPONGE) or stick posters (HANDS);
  // game/curb.js fills them over time. `stand` = where the player works from.
  const wallSpots = []
  const rooms = []
  const R = LAYOUT.rooms
  const rw = (R.x1 - R.x0) / R.count
  for (let i = 0; i < R.count; i++) {
    const rcx = R.x0 + rw * (i + 0.5)
    const number = R.first + i
    const doorX = rcx - 1.55
    const winX = rcx + 1.2
    const rx0 = R.x0 + rw * i
    const rx1 = rx0 + rw
    const interior = buildRoom(statics, live, rx0, rx1, doorX, winX, i)
    const door = makeDoor(statics, live, doorX, 0.2, FRONT, number)
    makeWindow(statics, live, winX, 1.15, FRONT, 2.1, 1.3, null)
    // Lower orange band and teal trim outside, either side of the door.
    for (const [a, b2] of [[rx0, doorX - 0.7], [doorX + 0.7, rx1]]) {
      box(statics, b2 - a, 1.0, 0.06, wallLow, (a + b2) / 2, 0.5, FRONT + 0.03, 3)
      box(statics, b2 - a, 0.08, 0.1, teal, (a + b2) / 2, 1.02, FRONT + 0.05)
    }
    acUnit(statics, rcx + 1.2, 0.62, FRONT)
    sconce(statics, live, bulbs, doorX + 0.95, 2.05, FRONT)
    // Doormat.
    box(statics, 1.0, 0.03, 0.62, mat('#d4502f', { roughness: 1 }), doorX, 0.215, FRONT + 0.55)
    // Room plate above the door (repainted by the game).
    const plate = makePlate()
    plate.draw({ number, typeName: 'REGULAR', price: 0, state: 'ready' })
    const plateTex = canvasTex(plate.canvas)
    const pm = new Mesh(new PlaneGeometry(1.5, 0.42), new MeshStandardMaterial({ map: plateTex, roughness: 0.5 }))
    pm.position.set(doorX + 0.1, 2.85, FRONT + 0.08)
    live.add(pm)
    box(statics, 1.6, 0.5, 0.05, mat(C.tealDark), doorX + 0.1, 2.85, FRONT + 0.03)
    // Graffiti on the wall between rooms, a poster between door and window.
    if (i < R.count - 1) wallSpots.push({ kind: 'graffiti', x: rx1, y: 1.85, z: FRONT + 0.08, ry: 0, w: 1.5, h: 0.95, stand: { x: rx1, z: FRONT + 1.1 } })
    wallSpots.push({ kind: 'poster', x: rcx - 0.35, y: 1.45, z: FRONT + 0.08, ry: 0, w: 0.36, h: 0.5, stand: { x: rcx - 0.35, z: FRONT + 1.0 } })
    // Boards (removed when the room is opened).
    const locked = boards(live, doorX, 0.25, FRONT, 1.1, 2.2, i)
    rooms.push({
      number,
      index: i,
      cx: rcx,
      doorX,
      door: door.pivot,
      front: { x: doorX, z: FRONT + 1.0 }, // stand here to use the door
      inside: { x: doorX, z: FRONT - 1.2 },
      interior,
      plate: { draw: plate.draw, tex: plateTex },
      boards: locked,
    })
  }
  // Posters on the walkway columns, graffiti on the back wall (junk yard side).
  for (let i = 1; i < colXs.length - 1; i++) wallSpots.push({ kind: 'poster', x: colXs[i], y: 1.4, z: COLZ + 0.23, ry: 0, w: 0.34, h: 0.46, stand: { x: colXs[i], z: COLZ + 1.0 } })
  for (let k = 0; k < 6; k++) {
    const x = R.x0 - 0.75 + k * 6.5
    wallSpots.push({ kind: 'graffiti', x, y: 1.3, z: BACK - 0.02, ry: Math.PI, w: 1.8, h: 1.1, stand: { x, z: BACK - 1.1 } })
  }
  // Trash cans by the columns and hanging flower baskets under the balcony.
  for (let i = 1; i < 7; i += 2) live.add(trashCan(colXs[i] + 0.6, 0.2, COLZ - 0.2))
  for (let i = 0; i < 7; i += 1) {
    if (i === 0) continue
    const hb = hangingBasket(i)
    hb.position.set((colXs[i] + colXs[i + 1]) / 2 + 0.8, FH - 0.32, COLZ - 0.1)
    live.add(hb)
  }

  // --- Rundown 2nd floor ---
  const U = LAYOUT.upper
  const uw = (U.x1 - U.x0) / U.count
  const stain = mat('#ffffff', { map: t.cracks, transparent: true, depthWrite: false, roughness: 1 })
  for (let i = 0; i < U.count; i++) {
    const ucx = U.x0 + uw * (i + 0.5)
    const doorX = ucx - 1.5
    makeDoor(statics, live, doorX, FH, FRONT, U.first + i)
    boards(live, doorX, FH + 0.05, FRONT + 0.05, 1.1, 2.2, i + 3)
    makeWindow(statics, live, ucx + 1.25, FH + 1.15, FRONT, 2.0, 1.25, t.curtain)
    boards(live, ucx + 1.25, FH + 1.0, FRONT + 0.1, 2.0, 1.4, i)
    acUnit(statics, ucx + 1.25, FH + 0.62, FRONT)
    const s = new Mesh(new PlaneGeometry(2.4, 2.4), stain)
    s.position.set(ucx - 0.2, FH + 2.2, FRONT + 0.02)
    s.rotation.z = i * 1.3
    statics.add(s)
  }
  // "2nd floor after the pool" signs hung on the railing.
  const upperSign = paintSign({ w: 512, h: 220, bg: '#fff4e0', border: '#e2382a', borderW: 18, dots: true, dotColor: '#ffe9a8', lines: [{ t: '2ND FLOOR', size: 92, color: '#e2382a' }, { t: 'AFTER THE POOL', size: 54, color: '#c22c1f' }] })
  const upperTex = canvasTex(upperSign)
  for (const x of [B.x0 + 4.5, cx + 1, B.x1 - 4]) {
    const m = new Mesh(new PlaneGeometry(2.3, 1.0), new MeshStandardMaterial({ map: upperTex, roughness: 0.6 }))
    m.position.set(x, FH + 0.85, COLZ + 0.16)
    m.rotation.z = (x % 3) * 0.02 - 0.02
    live.add(m)
  }
  // Debris on the balcony: loose planks, a tipped bucket, a broken hanging lamp.
  const wood = mat('#b98852', { map: t.wood, roughness: 0.95 })
  const debris = [[-14, 0.4, 0.2], [-2, -0.6, 0.5], [9, 0.9, -0.3], [18, -0.3, 0.1], [22, 0.5, 0.7]]
  for (const [x, ry, rz] of debris) {
    const p = box(statics, 2.2, 0.06, 0.22, wood, x, FH + 0.1, FRONT + 1.6)
    p.rotation.set(0, ry, rz * 0.2)
  }
  for (const x of [-9, 6, 15]) {
    const lamp = new Group()
    box(lamp, 0.02, 0.6, 0.02, mat('#333'), 0, -0.3, 0)
    const shade = new Mesh(new CylinderGeometry(0.15, 0.55, 0.35, 14, 1, true), mat(C.teal, { side: DoubleSide }))
    shade.position.y = -0.7
    lamp.add(shade)
    lamp.rotation.z = 0.5
    lamp.position.set(x, FH * 2 - 0.1, FRONT + 1.7)
    live.add(lamp)
  }

  // --- Laundry annex, stairs, machines ---
  const laundry = buildLaundry(statics, live)
  buildStairs(statics)
  buildMachines(statics, live)

  // Shell colliders: the floor slab (rooms + office at walkway height), the 2nd
  // floor block above, the back wall and both end walls.
  solid(W / 2, 0.1, B.depth / 2, cx, 0.1, (FRONT + BACK) / 2)
  solid(W / 2 + 0.3, FH / 2 + 0.3, B.depth / 2, cx, FH * 1.5, (FRONT + BACK) / 2)
  solid((B.x1 - gx0) / 2, FH / 2, 0.16, (gx0 + B.x1) / 2, FH / 2, BACK + 0.15)
  solid(0.16, FH, B.depth / 2, B.x0 + 0.15, FH, (FRONT + BACK) / 2)
  solid(0.16, FH, B.depth / 2, B.x1 - 0.15, FH, (FRONT + BACK) / 2)

  // Bake the static shell.
  const baked = bake(statics, true)
  baked.traverse((o) => {
    if (o.isMesh) o.receiveShadow = true
  })
  scene.add(baked)

  return {
    rooms,
    office,
    laundry,
    kitchen,
    wallSpots,
    // Night lighting: sconces, ceiling discs and curtains glow.
    setNight(k) {
      for (const b of bulbs) b.emissiveIntensity = 0.2 + k * 2.6
    },
  }
}

// --- Stairs (to the closed 2nd floor) with a barricade --------------------------------
function buildStairs(statics) {
  const S = LAYOUT.stairs
  const teal = mat(C.teal, { roughness: 0.45 })
  const tread = mat('#8b9496', { roughness: 0.6, metalness: 0.2 })
  const runZ = S.zBottom - S.zTop
  const len = Math.hypot(runZ, FH)
  const ang = Math.atan2(FH, runZ)
  const w = S.x1 - S.x0
  const xm = (S.x0 + S.x1) / 2
  const steps = 14
  for (let i = 0; i < steps; i++) {
    const t = (i + 0.5) / steps
    box(statics, w - 0.1, 0.06, runZ / steps + 0.05, tread, xm, t * FH, S.zBottom - t * runZ)
  }
  for (const x of [S.x0, S.x1]) {
    const s = box(statics, 0.1, 0.32, len, teal, x, FH / 2, (S.zBottom + S.zTop) / 2)
    s.rotation.x = ang
    const r = box(statics, 0.07, 0.07, len + 0.4, teal, x, FH / 2 + 1.0, (S.zBottom + S.zTop) / 2)
    r.rotation.x = ang
    for (let i = 0; i <= 4; i++) {
      const t = i / 4
      box(statics, 0.06, 1.0, 0.06, teal, x, t * FH + 0.5, S.zBottom - t * runZ)
    }
  }
  // Landing on posts, joined to the balcony.
  box(statics, w + 0.6, 0.25, B.walk + 0.4, mat('#efe6d6'), xm - 0.3, FH - 0.12, FRONT + (B.walk + 0.4) / 2)
  for (const [x, z] of [[S.x1, FRONT + 0.2], [S.x1, COLZ + 0.3]]) box(statics, 0.18, FH, 0.18, teal, x, FH / 2, z)
  box(statics, 0.07, 0.07, B.walk + 0.4, teal, S.x1, FH + 1.0, FRONT + (B.walk + 0.4) / 2)
  solid((w + 0.6) / 2, 0.12, (B.walk + 0.4) / 2, xm - 0.3, FH - 0.12, FRONT + (B.walk + 0.4) / 2)
  // Ramp collider for the flight.
  const q = new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), ang)
  addFixed(RAPIER.ColliderDesc.cuboid(w / 2, 0.1, len / 2), { x: xm, y: FH / 2 - 0.08, z: (S.zBottom + S.zTop) / 2 }, q)

  // Barricade at the foot: striped sawhorse + sign. Blocks the way up for now.
  const g = new Group()
  const stripe = paintSign({ w: 256, h: 48, bg: '#ff8a1e', border: null, radius: 0, lines: [] })
  const ctx = stripe.getContext('2d')
  ctx.fillStyle = '#ffffff'
  for (let x = -40; x < 256; x += 56) {
    ctx.beginPath()
    ctx.moveTo(x, 48)
    ctx.lineTo(x + 28, 0)
    ctx.lineTo(x + 52, 0)
    ctx.lineTo(x + 24, 48)
    ctx.fill()
  }
  const stripeMat = mat('#ffffff', { map: canvasTex(stripe) })
  box(g, w + 0.6, 0.28, 0.06, stripeMat, 0, 0.95, 0)
  box(g, w + 0.6, 0.28, 0.06, stripeMat, 0, 0.55, 0)
  for (const x of [-w / 2, w / 2]) {
    const a = box(g, 0.07, 1.2, 0.07, mat('#f3f0ea'), x, 0.58, 0.15)
    a.rotation.x = 0.25
    const b = box(g, 0.07, 1.2, 0.07, mat('#f3f0ea'), x, 0.58, -0.15)
    b.rotation.x = -0.25
  }
  g.position.set(xm, 0, S.zBottom + 0.9)
  statics.add(g)
  solid(w / 2 + 0.4, 1.2, 0.2, xm, 1.2, S.zBottom + 0.9)
  const sign = paintSign({ w: 300, h: 200, bg: '#fff4e0', border: '#e2382a', borderW: 10, radius: 10, lines: [{ t: '★★★★★ ROOM', size: 38, color: '#e2382a' }, { t: '1. POOL', size: 34, color: '#333' }, { t: '2. 2ND FLOOR', size: 34, color: '#333' }] })
  signMesh(statics, sign, 0.75, 0.5, xm, 1.45, S.zBottom + 0.95)
}

// --- Vending + ice machines under / beside the stairs ---------------------------------------
function buildMachines(statics, live) {
  const S = LAYOUT.stairs
  // Soda machine under the landing, facing east.
  const g = new Group()
  rbox(g, 0.9, 2.0, 0.85, 0.05, mat('#d92d27', { roughness: 0.35 }), 0, 1.0, 0)
  const front = paintSign({ w: 256, h: 512, bg: '#f7f2ea', border: '#d92d27', borderW: 10, radius: 6, lines: [{ t: 'ICE', size: 60, color: '#d92d27' }, { t: 'COLD', size: 60, color: '#d92d27' }, { t: 'SODA', size: 72, color: '#1d7d72' }] })
  const fm = new Mesh(new PlaneGeometry(0.55, 1.2), new MeshStandardMaterial({ map: canvasTex(front), emissiveMap: canvasTex(front), emissive: '#ffffff', emissiveIntensity: 0.25 }))
  fm.position.set(-0.1, 1.25, 0.431)
  g.add(fm)
  box(g, 0.2, 0.6, 0.03, mat('#333'), 0.3, 1.2, 0.43)
  box(g, 0.5, 0.18, 0.05, mat('#222'), -0.1, 0.35, 0.43)
  g.rotation.y = Math.PI / 2
  g.position.set(S.x0 + 0.6, 0, FRONT + 1.2)
  statics.add(g)
  solid(0.45, 1, 0.45, S.x0 + 0.6, 1, FRONT + 1.2)

  // Ice machine against the east wall, facing the pool deck.
  const ice = new Group()
  rbox(ice, 1.1, 1.9, 0.8, 0.06, mat('#eef3f5', { roughness: 0.3, metalness: 0.2 }), 0, 0.95, 0)
  const label = paintSign({ w: 256, h: 110, bg: '#2f7fd0', border: '#ffffff', borderW: 8, radius: 10, lines: [{ t: 'ICE', size: 78, color: '#ffffff' }] })
  const lm = new Mesh(new PlaneGeometry(0.7, 0.3), new MeshStandardMaterial({ map: canvasTex(label) }))
  lm.position.set(0, 1.55, 0.41)
  ice.add(lm)
  box(ice, 0.8, 0.5, 0.04, mat('#b8c3c8', { metalness: 0.7, roughness: 0.3 }), 0, 0.8, 0.41)
  ice.rotation.y = Math.PI / 2
  ice.position.set(B.x1 + 0.45, 0, FRONT - 4.5)
  statics.add(ice)
  solid(0.42, 0.95, 0.55, B.x1 + 0.45, 0.95, FRONT - 4.5)
  void live
}
