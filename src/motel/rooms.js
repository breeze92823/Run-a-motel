// Walk-in guest rooms (ground floor). Each room: a stucco front wall with real
// door and window openings, star wallpaper over a teal-board wainscot, dotted
// carpet, a wooden bed (made / used / stripped states, comfy-bed upgrade),
// a tiled bathroom alcove with a toilet, orange drapes, the inside of the AC,
// and the furniture players buy (mini fridge, colour TV, vanity sink).
import {
  CircleGeometry,
  CylinderGeometry,
  DoubleSide,
  ExtrudeGeometry,
  Group,
  LatheGeometry,
  Mesh,
  MeshStandardMaterial,
  Path,
  PlaneGeometry,
  Shape,
  SphereGeometry,
  TorusGeometry,
  Vector2,
} from 'three'
import { LAYOUT } from '../config.js'
import { RAPIER, addFixed } from '../physics.js'
import { box, C, canvasTex, mat, rbox, stuccoMat, textures } from './kit.js'
import { detailRoom } from './detail.js'
import { paintCarpet, paintDrape, paintDust, paintFabric, paintGrimeRing, paintMud, paintSign, paintSmudge, paintStain, paintTile, paintWainscot, paintWallpaper, tex } from './paint.js'

const B = LAYOUT.building
const FH = B.floorH
const FRONT = B.front
const BACK = B.front - B.depth
const FLOOR_Y = 0.2

export const DOOR_W = 1.12
export const DOOR_H = 2.25

let RT = null
// Interior textures/materials, made once and shared by every room (and the office/laundry).
export function interiorMats() {
  if (RT) return RT
  const wallpaper = tex(paintWallpaper())
  const wains = tex(paintWainscot())
  RT = {
    wallpaper: mat('#ffffff', { map: wallpaper, roughness: 0.95 }),
    wainscot: mat('#ffffff', { map: wains, roughness: 0.6 }),
    cap: mat('#fff1dc', { roughness: 0.6 }),
    carpet: mat('#ffffff', { map: tex(paintCarpet(), { repeatX: 1, repeatY: 1 }), roughness: 1 }),
    tile: mat('#ffffff', { map: tex(paintTile()), roughness: 0.3 }),
    bathFloor: mat('#ffffff', { map: tex(paintTile('#e3c08e', '#f1d9b0', '#f7ecd9', 256, 4)), roughness: 0.4 }),
    ceiling: mat('#fbf1e4', { roughness: 1 }),
    drape: mat('#ffffff', { map: tex(paintDrape(), { wrap: false }), roughness: 0.9, side: DoubleSide }),
    blanket: mat('#ffffff', { map: tex(paintFabric()), roughness: 0.95 }),
    quilt: mat('#ffffff', { map: tex(paintFabric('#e86a5a', '#ffd6a0', 128, 33)), roughness: 0.95 }),
    pillow: mat('#fbf3e2', { roughness: 1 }),
    sheet: mat('#fffaf0', { roughness: 1 }),
    woodBed: mat('#c67a35', { map: textures().wood, roughness: 0.65 }),
    woodLight: mat('#e7b874', { map: textures().wood, roughness: 0.7 }),
    brass: mat(C.brass, { metalness: 0.85, roughness: 0.3 }),
    porcelain: mat('#fbf7ef', { roughness: 0.2 }),
    chrome: mat('#dfe5e8', { metalness: 0.9, roughness: 0.18 }),
    stains: [1, 2, 3, 4].map((s) => new MeshStandardMaterial({ map: tex(paintStain(s + 10), { wrap: false }), transparent: true, depthWrite: false, roughness: 1, polygonOffset: true, polygonOffsetFactor: -2 })),
    dust: [1, 2, 3].map((s) => decalMat(paintDust(s))),
    mud: [1, 2, 3].map((s) => decalMat(paintMud(s))),
    grime: decalMat(paintGrimeRing()),
    smudge: decalMat(paintSmudge(4)),
  }
  return RT
}

// A see-through decal material (each mesh gets its own clone so it can fade while cleaned).
function decalMat(c) {
  return new MeshStandardMaterial({ map: tex(c, { wrap: false }), transparent: true, depthWrite: false, roughness: 1, polygonOffset: true, polygonOffsetFactor: -2 })
}
// A flat decal on the floor (or any plane), with its own material for fading.
function decal(parent, material, w, x, y, z, rotX = -Math.PI / 2, rotZ = 0) {
  const m = new Mesh(new PlaneGeometry(w, w), material.clone())
  m.rotation.x = rotX
  m.rotation.z = rotZ
  m.position.set(x, y, z)
  m.visible = false
  parent.add(m)
  return m
}

// Scales an extrusion's cap UVs (shape space = metres) so the texture tiles every `tile` m.
function scaleUV(geo, tile) {
  const uv = geo.attributes.uv
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / tile, uv.getY(i) / tile)
  return geo
}

// A wall slab in the XY plane with rectangular holes, extruded `depth` toward +Z from z.
export function holedWall(parent, x0, x1, y0, y1, holes, z, depth, material, tile) {
  const s = new Shape()
  s.moveTo(x0, y0)
  s.lineTo(x1, y0)
  s.lineTo(x1, y1)
  s.lineTo(x0, y1)
  s.closePath()
  for (const [hx0, hx1, hy0, hy1] of holes) {
    const h = new Path()
    h.moveTo(hx0, hy0)
    h.lineTo(hx0, hy1)
    h.lineTo(hx1, hy1)
    h.lineTo(hx1, hy0)
    h.closePath()
    s.holes.push(h)
  }
  const geo = scaleUV(new ExtrudeGeometry(s, { depth, bevelEnabled: false }), tile)
  const m = new Mesh(geo, material)
  m.position.z = z
  m.castShadow = true
  m.receiveShadow = true
  parent.add(m)
  return m
}

function solid(hx, hy, hz, x, y, z) {
  return addFixed(RAPIER.ColliderDesc.cuboid(hx, hy, hz), { x, y, z })
}

// Wallpaper + wainscot lining on one face of a wall running along X (facing +Z or -Z).
function liningX(statics, x0, x1, z, facing, top = FH - 0.1) {
  const M = interiorMats()
  const w = x1 - x0
  const cx = (x0 + x1) / 2
  box(statics, w, top - FLOOR_Y, 0.02, M.wallpaper, cx, (top + FLOOR_Y) / 2, z, 1.6)
  box(statics, w, 1.05, 0.04, M.wainscot, cx, FLOOR_Y + 0.525, z + facing * 0.02, 1.6, 1.05)
  box(statics, w, 0.07, 0.07, M.cap, cx, FLOOR_Y + 1.08, z + facing * 0.03)
}
// Same for a wall running along Z (facing +X or -X).
function liningZ(statics, z0, z1, x, facing, top = FH - 0.1) {
  const M = interiorMats()
  const d = z1 - z0
  const cz = (z0 + z1) / 2
  box(statics, 0.02, top - FLOOR_Y, d, M.wallpaper, x, (top + FLOOR_Y) / 2, cz, 1.6)
  box(statics, 0.04, 1.05, d, M.wainscot, x + facing * 0.02, FLOOR_Y + 0.525, cz, 1.6, 1.05)
  box(statics, 0.07, 0.07, d, M.cap, x + facing * 0.03, FLOOR_Y + 1.08, cz)
}

// --- Furniture ------------------------------------------------------------------------
// Bed in local space: headboard at x = 0, foot toward +x, centred on z = 0.
function makeBed() {
  const M = interiorMats()
  const g = new Group()
  const L = 2.25
  const W = 1.75
  // Frame with drawer fronts.
  rbox(g, L, 0.38, W, 0.05, M.woodBed, L / 2, 0.34, 0)
  for (const side of [-1, 1]) {
    for (let i = 0; i < 2; i++) {
      box(g, 0.82, 0.24, 0.03, M.woodLight, 0.65 + i * 0.95, 0.33, side * (W / 2 + 0.01))
      box(g, 0.14, 0.03, 0.03, M.brass, 0.65 + i * 0.95, 0.38, side * (W / 2 + 0.03))
    }
  }
  box(g, 0.08, 0.5, W + 0.08, M.woodBed, L + 0.02, 0.38, 0) // footboard
  for (const z of [-W / 2, W / 2]) box(g, 0.1, 0.36, 0.1, M.woodBed, L - 0.02, 0.18, z)
  // Headboard: posts with brass finials and an upholstered teal panel.
  for (const z of [-W / 2 - 0.02, W / 2 + 0.02]) {
    box(g, 0.14, 1.45, 0.14, M.woodBed, 0.05, 0.72, z)
    const ball = new Mesh(new SphereGeometry(0.09, 12, 8), M.brass)
    ball.position.set(0.05, 1.5, z)
    g.add(ball)
  }
  box(g, 0.12, 0.14, W + 0.1, M.woodBed, 0.05, 1.4, 0)
  rbox(g, 0.1, 0.72, W - 0.12, 0.05, mat('#147a63', { roughness: 0.9 }), 0.06, 0.95, 0)
  for (let r = 0; r < 2; r++) for (let k = 0; k < 4; k++) {
    const b = new Mesh(new SphereGeometry(0.025, 6, 4), mat('#0c5a48'))
    b.position.set(0.12, 0.8 + r * 0.3, -0.6 + k * 0.4)
    g.add(b)
  }
  // Mattress + sheet.
  const mattress = rbox(g, L - 0.15, 0.24, W - 0.08, 0.08, M.sheet, L / 2 + 0.03, 0.65, 0)
  void mattress
  // Bedding (swapped by state).
  const made = new Group()
  const blanket = rbox(made, 1.55, 0.09, W, 0.04, M.blanket, L - 0.8, 0.8, 0)
  void blanket
  box(made, 0.3, 0.1, W + 0.01, mat('#58c7a8', { roughness: 1 }), 0.62, 0.81, 0) // folded edge
  for (const z of [-0.42, 0.42]) {
    const p = rbox(made, 0.42, 0.18, 0.66, 0.08, M.pillow, 0.36, 0.86, z)
    p.rotation.z = 0.25
  }
  const accent = new Mesh(new SphereGeometry(0.17, 12, 8), mat('#0f6e58'))
  accent.scale.set(0.6, 1, 1)
  accent.position.set(0.5, 0.92, 0)
  made.add(accent)
  g.add(made)
  const towels = new Group()
  for (let i = 0; i < 3; i++) {
    rbox(towels, 0.42, 0.07, 0.55, 0.03, M.sheet, 0, 0.88 + i * 0.075, 0)
    box(towels, 0.43, 0.02, 0.06, mat('#27a596'), 0, 0.88 + i * 0.075, 0.2)
  }
  towels.position.set(L - 0.55, 0, 0.45)
  towels.rotation.y = 0.15
  g.add(towels)
  // Used bed: crumpled blanket and pillows thrown about.
  const used = new Group()
  const crumple = rbox(used, 1.3, 0.2, 1.5, 0.08, M.blanket, L - 0.9, 0.85, 0.1)
  crumple.rotation.set(0.1, 0.35, 0.06)
  const lump = rbox(used, 0.6, 0.25, 0.7, 0.1, M.blanket, L - 0.5, 0.92, -0.4)
  lump.rotation.y = -0.5
  const p1 = rbox(used, 0.42, 0.18, 0.66, 0.08, M.pillow, 0.55, 0.86, -0.3)
  p1.rotation.set(0.4, 0.8, 0.2)
  const p2 = rbox(used, 0.42, 0.18, 0.66, 0.08, M.pillow, L + 0.4, 0.25, 0.7)
  p2.rotation.set(1.2, 0.3, 0)
  used.visible = false
  g.add(used)
  // Comfy upgrade: plush topper, quilt runner, extra pillows, a taller tufted crown.
  const comfy = new Group()
  rbox(comfy, L - 0.2, 0.12, W - 0.04, 0.06, M.sheet, L / 2 + 0.03, 0.83, 0)
  box(comfy, 0.6, 0.1, W + 0.04, M.quilt, L - 0.45, 0.9, 0)
  for (const z of [-0.3, 0.3]) {
    const p = rbox(comfy, 0.38, 0.22, 0.5, 0.1, mat('#ffd6a0'), 0.55, 1.02, z)
    p.rotation.z = 0.3
  }
  rbox(comfy, 0.14, 0.4, W + 0.2, 0.08, mat('#147a63', { roughness: 0.9 }), 0.05, 1.68, 0)
  comfy.visible = false
  g.add(comfy)
  return {
    group: g,
    set(state, isComfy) {
      made.visible = state === 'made'
      towels.visible = state === 'made'
      used.visible = state === 'used'
      comfy.visible = isComfy && state !== 'stripped'
    },
  }
}

function makeToilet() {
  const M = interiorMats()
  const g = new Group()
  const bowl = new LatheGeometry([new Vector2(0.12, 0), new Vector2(0.16, 0.05), new Vector2(0.12, 0.2), new Vector2(0.2, 0.34), new Vector2(0.24, 0.42), new Vector2(0.22, 0.44)], 16)
  const bm = new Mesh(bowl, M.porcelain)
  bm.castShadow = true
  g.add(bm)
  const seat = new Mesh(new TorusGeometry(0.19, 0.04, 8, 18), mat('#e9a64a', { roughness: 0.5 }))
  seat.rotation.x = Math.PI / 2
  seat.position.y = 0.45
  g.add(seat)
  const water = new Mesh(new CircleGeometry(0.15, 16), mat('#a6dcef', { roughness: 0.05 }))
  water.rotation.x = -Math.PI / 2
  water.position.y = 0.4
  g.add(water)
  rbox(g, 0.5, 0.42, 0.2, 0.04, M.porcelain, 0, 0.72, -0.25)
  rbox(g, 0.55, 0.06, 0.24, 0.03, mat('#e9a64a', { roughness: 0.5 }), 0, 0.95, -0.25)
  box(g, 0.08, 0.03, 0.03, M.chrome, 0.18, 0.86, -0.14)
  return g
}

export function makeFridge() {
  const M = interiorMats()
  const g = new Group()
  rbox(g, 0.66, 0.92, 0.62, 0.08, mat('#9fe3cf', { roughness: 0.3 }), 0, 0.46, 0)
  box(g, 0.6, 0.02, 0.01, mat('#7cc7b2'), 0, 0.72, 0.315)
  box(g, 0.05, 0.3, 0.05, M.chrome, 0.24, 0.5, 0.34)
  box(g, 0.66, 0.05, 0.6, M.chrome, 0, 0.06, 0)
  // Ice bucket on top.
  const bucket = new Mesh(new CylinderGeometry(0.12, 0.09, 0.18, 14), M.chrome)
  bucket.position.set(-0.12, 1.01, 0)
  g.add(bucket)
  return g
}

export function makeTV() {
  const M = interiorMats()
  const g = new Group()
  rbox(g, 1.3, 0.8, 0.5, 0.04, M.woodBed, 0, 0.4, 0) // dresser
  for (let i = 0; i < 2; i++) {
    box(g, 0.56, 0.3, 0.02, M.woodLight, -0.3 + i * 0.6, 0.45, 0.26)
    box(g, 0.14, 0.03, 0.03, M.brass, -0.3 + i * 0.6, 0.5, 0.28)
  }
  rbox(g, 0.72, 0.56, 0.5, 0.08, mat('#8b5a33', { roughness: 0.5 }), 0, 1.08, -0.02)
  const screenMat = new MeshStandardMaterial({ color: '#2c3e45', emissive: '#7fd3ff', emissiveIntensity: 0, roughness: 0.15 })
  const screen = new Mesh(new PlaneGeometry(0.5, 0.38), screenMat)
  screen.position.set(-0.06, 1.09, 0.235)
  g.add(screen)
  for (let k = 0; k < 2; k++) {
    const knob = new Mesh(new CylinderGeometry(0.03, 0.03, 0.03, 8), M.chrome)
    knob.rotation.x = Math.PI / 2
    knob.position.set(0.27, 1.17 - k * 0.12, 0.24)
    g.add(knob)
  }
  for (const s of [-1, 1]) {
    const a = box(g, 0.015, 0.45, 0.015, M.chrome, s * 0.1, 1.55, -0.05)
    a.rotation.z = -s * 0.45
  }
  return { group: g, screen: screenMat }
}

export function makeVanity() {
  const M = interiorMats()
  const g = new Group()
  rbox(g, 1.0, 0.82, 0.55, 0.04, M.woodLight, 0, 0.41, 0)
  box(g, 0.44, 0.6, 0.02, mat('#d9a35f'), -0.23, 0.42, 0.28)
  box(g, 0.44, 0.6, 0.02, mat('#d9a35f'), 0.23, 0.42, 0.28)
  rbox(g, 1.08, 0.06, 0.6, 0.02, mat('#f5efe6', { roughness: 0.25 }), 0, 0.85, 0)
  const basin = new Mesh(new CylinderGeometry(0.22, 0.16, 0.08, 18), M.porcelain)
  basin.position.set(0, 0.86, 0.02)
  g.add(basin)
  const tap = box(g, 0.04, 0.2, 0.04, M.chrome, 0, 0.98, -0.18)
  void tap
  box(g, 0.04, 0.04, 0.14, M.chrome, 0, 1.07, -0.12)
  // Mirror with a teal frame.
  rbox(g, 0.8, 0.95, 0.04, 0.05, mat(C.teal), 0, 1.65, -0.26)
  box(g, 0.68, 0.82, 0.01, mat('#d8f2f6', { metalness: 0.9, roughness: 0.05 }), 0, 1.65, -0.235)
  return g
}

// --- A whole room ------------------------------------------------------------------------
// Builds one room between x0 and x1. Returns the room's live handles.
export function buildRoom(statics, live, x0, x1, doorX, winX, index) {
  const M = interiorMats()
  const t = textures()
  const ix0 = x0 + 0.1
  const ix1 = x1 - 0.1
  const iz0 = BACK + 0.3
  const iz1 = FRONT - 0.3
  const cx = (ix0 + ix1) / 2
  const W = ix1 - ix0

  // Front wall with door + window openings (stucco outside), lining inside.
  const dH = [doorX - DOOR_W / 2, doorX + DOOR_W / 2, FLOOR_Y, FLOOR_Y + DOOR_H]
  const wH = [winX - 1.05, winX + 1.05, 1.15, 2.47] // top 2 cm above the frame head's underside
  holedWall(statics, x0, x1, 0, FH, [dH, wH], FRONT - 0.3, 0.3, stuccoMat(C.wall), 3)
  const lining = holedWall(statics, ix0, ix1, FLOOR_Y, FH - 0.1, [dH, wH], iz1 - 0.02, 0.01, M.wallpaper, 1.6)
  void lining
  // Wainscot + cap stop 5 cm inside the jambs, so their ends never share a face with them.
  const jL = dH[0] - 0.05
  const jR = dH[1] + 0.05
  box(statics, jL - ix0, 1.05, 0.04, M.wainscot, (ix0 + jL) / 2, FLOOR_Y + 0.525, iz1 - 0.04, 1.6, 1.05)
  box(statics, ix1 - jR, 1.05, 0.04, M.wainscot, (jR + ix1) / 2, FLOOR_Y + 0.525, iz1 - 0.04, 1.6, 1.05)
  box(statics, jL - ix0, 0.07, 0.07, M.cap, (ix0 + jL) / 2, FLOOR_Y + 1.08, iz1 - 0.05)
  box(statics, ix1 - jR, 0.07, 0.07, M.cap, (jR + ix1) / 2, FLOOR_Y + 1.08, iz1 - 0.05)
  // Window reveal (inner sill) and door jambs inside.
  box(statics, 2.2, 0.08, 0.36, M.cap, winX, 1.13, FRONT - 0.2)
  box(statics, 0.1, DOOR_H + 0.1, 0.1, M.cap, dH[0] - 0.05, FLOOR_Y + DOOR_H / 2, iz1 - 0.05)
  box(statics, 0.1, DOOR_H + 0.1, 0.1, M.cap, dH[1] + 0.05, FLOOR_Y + DOOR_H / 2, iz1 - 0.05)
  box(statics, DOOR_W + 0.3, 0.1, 0.1, M.cap, doorX, FLOOR_Y + DOOR_H + 0.05, iz1 - 0.05)
  // Front wall colliders: either side of the door, and above it.
  solid((dH[0] - x0) / 2, FH / 2, 0.16, (x0 + dH[0]) / 2, FH / 2, FRONT - 0.15)
  solid((x1 - dH[1]) / 2, FH / 2, 0.16, (dH[1] + x1) / 2, FH / 2, FRONT - 0.15)
  solid(DOOR_W / 2, (FH - DOOR_H) / 2, 0.16, doorX, DOOR_H + (FH - DOOR_H) / 2 + FLOOR_Y, FRONT - 0.15)

  // Partition on the west side (each room owns its west wall; the last also its east).
  const partition = (x) => {
    box(statics, 0.2, FH - 0.1, B.depth - 0.3, mat('#f4e3cf'), x, (FH - 0.1) / 2, (BACK + FRONT) / 2)
    solid(0.1, FH / 2, (B.depth - 0.3) / 2, x, FH / 2, (BACK + FRONT) / 2)
  }
  partition(x0)
  if (index === LAYOUT.rooms.count - 1) partition(x1)
  liningZ(statics, iz0, iz1, ix0 + 0.005, 1)
  // East + back linings cover the bedroom only: the bathroom alcove (back-right, 2.5 x 2.7 m,
  // built below) has its own tile, which the wainscot would otherwise poke through.
  liningZ(statics, iz0 + 2.7 + 0.07, iz1, ix1 - 0.005, -1)
  liningX(statics, ix0, ix1 - 2.5 - 0.07, iz0 + 0.005, 1)

  // Floor, ceiling and the ceiling light.
  const carpetTex = M.carpet.map
  carpetTex.repeat.set(1 / 1.4, 1 / 1.4)
  const floor = new Mesh(new PlaneGeometry(W, iz1 - iz0), M.carpet)
  floor.rotation.x = -Math.PI / 2
  floor.position.set(cx, FLOOR_Y + 0.005, (iz0 + iz1) / 2)
  floor.receiveShadow = true
  // World-space UVs so neighbouring rooms line up.
  const fu = floor.geometry.attributes.uv
  for (let i = 0; i < fu.count; i++) fu.setXY(i, (fu.getX(i) * W) / 1.4, (fu.getY(i) * (iz1 - iz0)) / 1.4)
  statics.add(floor)
  box(statics, W, 0.06, iz1 - iz0, M.ceiling, cx, FH - 0.1, (iz0 + iz1) / 2)
  const lightMat = new MeshStandardMaterial({ color: '#fffaf0', emissive: '#fff0c8', emissiveIntensity: 0.6 })
  const fixture = new Mesh(new SphereGeometry(0.32, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), lightMat)
  fixture.rotation.x = Math.PI
  fixture.position.set(cx - 0.6, FH - 0.13, (iz0 + iz1) / 2 + 0.5)
  live.add(fixture)

  // Bathroom alcove (back-right): tiled walls, doorway, toilet.
  const bx0 = ix1 - 2.5
  const bz1 = iz0 + 2.7
  const doorC = bx0 + 1.3
  const dw = 0.95
  const tile = M.tile
  const wallH = FH - 0.1 - FLOOR_Y
  // Side wall (x = bx0), tiled inside, wallpaper outside.
  box(statics, 0.14, wallH, bz1 - iz0, tile, bx0, FLOOR_Y + wallH / 2, (iz0 + bz1) / 2, 0.9)
  liningZ(statics, iz0, bz1, bx0 - 0.075, -1)
  solid(0.08, FH / 2, (bz1 - iz0) / 2, bx0, FH / 2, (iz0 + bz1) / 2)
  // Front wall pieces around the doorway.
  const seg = (a, b2) => {
    box(statics, b2 - a, wallH, 0.14, tile, (a + b2) / 2, FLOOR_Y + wallH / 2, bz1, 0.9)
    liningX(statics, a, b2, bz1 + 0.075, 1)
    solid((b2 - a) / 2, FH / 2, 0.08, (a + b2) / 2, FH / 2, bz1)
  }
  seg(bx0 - 0.07, doorC - dw / 2)
  seg(doorC + dw / 2, ix1)
  box(statics, dw, FH - 0.1 - 2.35, 0.14, tile, doorC, 2.35 + (FH - 0.1 - 2.35) / 2, bz1)
  box(statics, dw, FH - 0.1 - 2.35, 0.02, M.wallpaper, doorC, 2.35 + (FH - 0.1 - 2.35) / 2, bz1 + 0.08)
  // Tile on the bathroom's back and outer side walls, a green band with a yellow pinstripe.
  box(statics, ix1 - bx0, wallH, 0.02, tile, (bx0 + ix1) / 2, FLOOR_Y + wallH / 2, iz0 + 0.02, 0.9)
  box(statics, 0.02, wallH, bz1 - iz0, tile, ix1 - 0.02, FLOOR_Y + wallH / 2, (iz0 + bz1) / 2, 0.9)
  const band = mat('#1fb36d', { roughness: 0.4 })
  const pin = mat('#f6d33c', { roughness: 0.4 })
  box(statics, ix1 - bx0, 0.16, 0.03, band, (bx0 + ix1) / 2, 1.3, iz0 + 0.04)
  box(statics, ix1 - bx0, 0.03, 0.035, pin, (bx0 + ix1) / 2, 1.4, iz0 + 0.04)
  box(statics, 0.03, 0.16, bz1 - iz0, band, ix1 - 0.04, 1.3, (iz0 + bz1) / 2)
  box(statics, 0.03, 0.16, bz1 - iz0, band, bx0 + 0.08, 1.3, (iz0 + bz1) / 2)
  const bfloor = new Mesh(new PlaneGeometry(ix1 - bx0, bz1 - iz0), M.bathFloor)
  bfloor.rotation.x = -Math.PI / 2
  bfloor.position.set((bx0 + ix1) / 2, FLOOR_Y + 0.01, (iz0 + bz1) / 2)
  statics.add(bfloor)
  const toilet = makeToilet()
  toilet.position.set(doorC, FLOOR_Y, iz0 + 0.45)
  statics.add(toilet)
  const roll = new Mesh(new CylinderGeometry(0.07, 0.07, 0.11, 12), mat('#f0a43a'))
  roll.rotation.z = Math.PI / 2
  roll.position.set(doorC + 0.5, 0.78, iz0 + 0.12) // on the back wall, clear of the tub strip
  statics.add(roll)
  solid(0.25, 0.4, 0.3, doorC, 0.6, iz0 + 0.4)

  // Window inside: rod, orange drapes, the AC's inner face.
  box(statics, 2.9, 0.04, 0.04, M.brass, winX, 2.62, iz1 - 0.12)
  for (const s of [-1, 1]) {
    const d = new Mesh(new PlaneGeometry(0.75, 1.7), M.drape)
    d.position.set(winX + s * 1.25, 1.75, iz1 - 0.12)
    d.rotation.y = Math.PI
    statics.add(d)
  }
  rbox(statics, 1.1, 0.48, 0.32, 0.05, mat('#f2e8d6', { roughness: 0.6 }), winX, 0.62, iz1 - 0.2)

  // Bed against the west wall.
  const bed = makeBed()
  const bedZ = (iz0 + iz1) / 2 + 0.6
  bed.group.position.set(ix0 + 0.06, FLOOR_Y, bedZ)
  live.add(bed.group)
  solid(1.15, 0.45, 0.9, ix0 + 1.18, 0.6, bedZ)

  // Purchasable furniture (hidden until bought).
  const fridge = makeFridge()
  fridge.position.set(ix0 + 0.45, FLOOR_Y, iz0 + 0.45)
  fridge.visible = false
  live.add(fridge)
  const tv = makeTV()
  tv.group.position.set(ix1 - 0.3, FLOOR_Y, bedZ + 0.2)
  tv.group.rotation.y = -Math.PI / 2
  tv.group.visible = false
  live.add(tv.group)
  const vanity = makeVanity()
  vanity.position.set(bx0 - 0.75, FLOOR_Y, iz0 + 0.35)
  vanity.visible = false
  live.add(vanity)

  // Carpet stain decals (shown when the room is left dirty).
  const stainSpots = [
    [cx + 0.4, bedZ - 1.9],
    [ix0 + 2.8, bedZ + 1.4],
    [cx - 0.8, iz1 - 1.3],
  ].map(([x, z], k) => {
    const s = new Mesh(new PlaneGeometry(1.1, 1.1), M.stains[(k + index) % 4])
    s.rotation.x = -Math.PI / 2
    s.rotation.z = k * 1.7
    s.position.set(x, FLOOR_Y + 0.015, z)
    s.visible = false
    live.add(s)
    return { mesh: s, x, z }
  })
  // Dust bunnies on the carpet (VACUUM).
  const dustSpots = [
    [ix0 + 2.9, bedZ - 0.3],
    [cx + 1.6, iz1 - 1.6],
    [cx - 0.3, bedZ - 3.0],
  ].map(([x, z], k) => ({ mesh: decal(live, M.dust[(k + index) % 3], 1.0, x, FLOOR_Y + 0.018, z, -Math.PI / 2, k * 2.1), x, z }))
  // Muddy footprints / puddles (MOP): the entrance, the middle, the bathroom floor.
  const mudSpots = [
    [doorX, iz1 - 0.9],
    [cx + 0.6, (iz0 + iz1) / 2 + 0.2],
    [bx0 + 0.65, iz0 + 1.7],
  ].map(([x, z], k) => ({ mesh: decal(live, M.mud[(k + index) % 3], 1.2, x, FLOOR_Y + 0.02 + k * 0.001, z, -Math.PI / 2, k * 1.3 + index), x, z }))
  // Toilet grime (BRUSH): a dirty ring in the bowl and a smear on the tank.
  const tx = doorC
  const tz = iz0 + 0.45
  const ring = decal(live, M.grime, 0.36, tx, FLOOR_Y + 0.415, tz)
  const tankSmear = decal(live, M.smudge, 0.4, tx, FLOOR_Y + 0.75, tz - 0.14, 0)
  // Bathroom sink + mirror on the east wall (SPONGE): grime in the basin, smudges on the glass.
  const sx = ix1 - 0.3
  const sz = iz0 + 1.85
  rbox(statics, 0.5, 0.12, 0.5, 0.03, M.porcelain, sx, FLOOR_Y + 0.82, sz)
  box(statics, 0.12, 0.7, 0.12, M.porcelain, sx + 0.1, FLOOR_Y + 0.4, sz)
  const sinkBowl = new Mesh(new CylinderGeometry(0.18, 0.13, 0.05, 16), mat('#e9f2f4', { roughness: 0.15 }))
  sinkBowl.position.set(sx, FLOOR_Y + 0.865, sz)
  statics.add(sinkBowl)
  box(statics, 0.04, 0.16, 0.04, M.chrome, sx + 0.2, FLOOR_Y + 0.95, sz)
  box(statics, 0.14, 0.03, 0.03, M.chrome, sx + 0.14, FLOOR_Y + 1.02, sz)
  rbox(statics, 0.04, 0.8, 0.62, 0.02, mat(C.teal), ix1 - 0.04, FLOOR_Y + 1.6, sz)
  box(statics, 0.012, 0.68, 0.5, mat('#d8f2f6', { metalness: 0.9, roughness: 0.05 }), ix1 - 0.065, FLOOR_Y + 1.6, sz)
  const basinGrime = decal(live, M.grime, 0.34, sx, FLOOR_Y + 0.893, sz)
  const mirrorSmudge = decal(live, M.smudge, 0.55, ix1 - 0.075, FLOOR_Y + 1.6, sz, 0, 0)
  mirrorSmudge.rotation.set(0, -Math.PI / 2, 0)
  // Fixed fittings (trim, switches, blinds, bathroom accessories): src/motel/detail.js.
  detailRoom(statics, live, { ix0, ix1, iz0, iz1, doorX, doorW: DOOR_W, winX, bx0, bz1, doorC, dw, bedZ, fixture: fixture.position })
  // Where trash lands at checkout.
  const litterSpots = [[cx + 1.2, bedZ - 1.2], [ix0 + 1.0, bedZ - 1.3], [cx + 0.2, iz1 - 0.8], [ix1 - 0.6, bz1 + 0.6], [ix0 + 2.6, iz1 - 1.8]]
  // Room light (the game moves one point light into the room the player is in).
  return {
    bounds: { x0: ix0, x1: ix1, z0: iz0, z1: iz1 },
    bed,
    bedPoint: { x: ix0 + 1.2, z: bedZ - 1.35 },
    furniture: { fridge, tv: tv.group, vanity },
    tvScreen: tv.screen,
    fixture: lightMat,
    stainSpots,
    litterSpots,
    dustSpots,
    mudSpots,
    toilet: { meshes: [ring, tankSmear], x: tx, z: tz + 0.75, at: { x: tx, y: FLOOR_Y + 0.5, z: tz } },
    sink: { meshes: [basinGrime, mirrorSmudge], x: sx - 0.6, z: sz, at: { x: sx, y: FLOOR_Y + 0.95, z: sz } },
    doorX,
    center: { x: cx, z: (iz0 + iz1) / 2 },
  }
}

export { FLOOR_Y, BACK, FRONT, canvasTex, paintSign }
