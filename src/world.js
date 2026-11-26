import {
  BoxGeometry,
  BufferAttribute,
  Color,
  CylinderGeometry,
  DoubleSide,
  ExtrudeGeometry,
  Group,
  IcosahedronGeometry,
  Mesh,
  MeshLambertMaterial,
  MeshStandardMaterial,
  Path,
  PlaneGeometry,
  Shape,
  ShapeGeometry,
  Vector2,
} from 'three'
import { Box3, Matrix4, Vector3 } from 'three'
import { LAYOUT, PLOTS, WORLD } from './config.js'
import { globalMatrix, plotCount, plotToGlobal } from './plots.js'
import { RAPIER, addFixed } from './physics.js'
import { mulberry32, paintSand, toTexture } from './textures.js'
import { canvas, paintAsphalt, tex } from './motel/paint.js'
import { std, put } from './propkit.js'
import { bake } from './bake.js'

// The desert round the main road and its six motel plots (src/plots.js):
//  - shared, in the global frame (buildGround's `block`, placed with setPlot): a flat sand pad
//    round all the plots (a hole where each plot's pool basin sinks in), rolling dunes beyond it,
//    mesas and a water tower on the horizon, the highway along the plots' fronts;
//  - per plot, in that plot's frame (buildPlotGround): the asphalt lot, the sidewalk and the fence;
//  - puffy clouds.
// Physically (the player's own plot only): the pad as boxes around the pool hole + an invisible fence.

const PAD = PLOTS.pad // half-size of the flat pad round the road's centre (m); dunes start past it
const CZ = LAYOUT.road.z // the pad is centred on the road (global frame)
const INNER = 110 // the colliders' pad half-size round the player's own plot

function smoothstep(a, b, x) {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

// Dune height at (x, z) (global frame) for points outside the pad: long wind-blown ridges.
function duneHeight(x, z) {
  const d = Math.max(Math.abs(x) - PAD.x, Math.abs(z - CZ) - PAD.z)
  const rise = smoothstep(0, 90, d)
  const ridge = Math.sin(x * 0.021 + Math.sin(z * 0.013) * 2.2) * 0.5 + 0.5
  const swell = Math.sin(z * 0.017 + x * 0.006) * 0.5 + 0.5
  const fine = Math.sin(x * 0.07 + z * 0.05) * 0.5 + 0.5
  return rise * (ridge * ridge * 26 + swell * 14 + fine * 3) + smoothstep(120, 400, d) * 30
}

function sandMaterial(repeat) {
  const sand = paintSand(256)
  const map = toTexture(sand.color, { repeat, srgb: true })
  const normalMap = toTexture(sand.normal, { repeat })
  return new MeshStandardMaterial({ map, normalMap, normalScale: new Vector2(0.5, 0.5), color: '#f6d28e', roughness: 1 })
}

function buildPad(root) {
  const { pool } = LAYOUT
  const s = new Shape()
  s.moveTo(-PAD.x, -(CZ - PAD.z))
  s.lineTo(-PAD.x, -(CZ + PAD.z))
  s.lineTo(PAD.x, -(CZ + PAD.z))
  s.lineTo(PAD.x, -(CZ - PAD.z))
  s.closePath()
  // Shape space is (x, -z) once rotated flat. One hole per plot's pool basin (global frame).
  const m = new Matrix4()
  const box = new Box3()
  for (let k = 0; k < plotCount; k++) {
    plotToGlobal(k, m)
    box.makeEmpty()
    box.expandByPoint(new Vector3(pool.x0, 0, pool.z0).applyMatrix4(m))
    box.expandByPoint(new Vector3(pool.x1, 0, pool.z1).applyMatrix4(m))
    const hole = new Path()
    hole.moveTo(box.min.x, -box.min.z)
    hole.lineTo(box.min.x, -box.max.z)
    hole.lineTo(box.max.x, -box.max.z)
    hole.lineTo(box.max.x, -box.min.z)
    hole.closePath()
    s.holes.push(hole)
  }
  const geo = new ShapeGeometry(s)
  geo.rotateX(-Math.PI / 2)
  // Shape UVs are metres: scale them to the sand tile.
  const uv = geo.attributes.uv
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / WORLD.sandTile, uv.getY(i) / WORLD.sandTile)
  const pad = new Mesh(geo, sandMaterial(1))
  pad.receiveShadow = true
  root.add(pad)
}

function buildDunes(root) {
  const size = WORLD.groundSize
  const seg = 140 // 10 m grid: vertices land exactly on the pad edge
  const geo = new PlaneGeometry(size, size, seg, seg)
  geo.rotateX(-Math.PI / 2)
  const pos = geo.attributes.position
  const colors = new Float32Array(pos.count * 3)
  const light = new Color('#ffdca0')
  const dark = new Color('#e3a75f')
  const c = new Color()
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i)
    const z = pos.getZ(i) + CZ // the plane is centred on the road
    const inside = Math.abs(x) < PAD.x && Math.abs(z - CZ) < PAD.z
    const y = inside ? -6 : duneHeight(x, z) - 0.05 // just under the pad where they meet it
    pos.setY(i, y)
    c.copy(dark).lerp(light, Math.min(1, 0.35 + y / 40 + Math.sin(x * 0.05) * 0.1))
    colors.set([c.r, c.g, c.b], i * 3)
  }
  geo.setAttribute('color', new BufferAttribute(colors, 3))
  geo.computeVertexNormals()
  const mat = sandMaterial(size / 18)
  mat.vertexColors = true
  mat.color.set('#ffffff')
  const dunes = new Mesh(geo, mat)
  dunes.position.z = CZ
  dunes.receiveShadow = true
  root.add(dunes)
}

// Layered red-rock mesas and buttes far out in the desert.
function buildMesas(root) {
  const rand = mulberry32(88)
  const bands = [new MeshStandardMaterial({ color: '#d9814e', roughness: 1, flatShading: true }), new MeshStandardMaterial({ color: '#c46a3f', roughness: 1, flatShading: true }), new MeshStandardMaterial({ color: '#e89a62', roughness: 1, flatShading: true })]
  const spots = [
    [-260, -330, 70], [-60, -400, 110], [180, -360, 80], [330, -200, 60], [-380, -120, 55], [420, 60, 70], [-430, 150, 60],
  ]
  for (const [x, z, w] of spots) {
    const mesa = new Group()
    let r = w
    let y = 0
    const layers = 3 + Math.floor(rand() * 2)
    for (let i = 0; i < layers; i++) {
      const h = 10 + rand() * 12
      const geo = new CylinderGeometry(r * 0.92, r, h, 9, 1)
      const m = new Mesh(geo, bands[i % bands.length])
      m.position.y = y + h / 2
      m.scale.z = 0.55 + rand() * 0.3
      mesa.add(m)
      y += h
      r *= 0.82
    }
    mesa.position.set(x, duneHeight(x, z) - 8, z)
    mesa.rotation.y = rand() * Math.PI
    root.add(mesa)
  }
}

// Highway: asphalt with white edge lines and a yellow dashed centre (one texture
// tile = 16 m of road).
function paintRoad() {
  const w = 512
  const h = 384
  const c = canvas(w, h)
  const ctx = c.getContext('2d')
  const a = paintAsphalt(256, 77).color
  for (let x = 0; x < w; x += 256) for (let y = 0; y < h; y += 256) ctx.drawImage(a, x, y)
  ctx.fillStyle = 'rgba(80,78,84,0.25)'
  ctx.fillRect(0, h * 0.2, w, h * 0.12) // tyre tracks
  ctx.fillRect(0, h * 0.68, w, h * 0.12)
  ctx.fillStyle = '#f1ede2'
  ctx.fillRect(0, 10, w, 9)
  ctx.fillRect(0, h - 19, w, 9)
  ctx.fillStyle = '#f2c232'
  ctx.fillRect(0, h / 2 - 12, w * 0.55, 8)
  ctx.fillRect(0, h / 2 + 4, w * 0.55, 8)
  return c
}

function buildRoad(root) {
  const { road } = LAYOUT
  const len = WORLD.groundSize
  const roadMat = new MeshStandardMaterial({ map: tex(paintRoad(), { repeatX: len / 16 }), roughness: 0.92 })
  const g = new PlaneGeometry(len, road.width)
  g.rotateX(-Math.PI / 2)
  const r = new Mesh(g, roadMat)
  r.position.set(0, 0.03, road.z)
  r.receiveShadow = true
  root.add(r)
  // Gravel shoulders.
  const shoulderMat = std('#cfb07d', { roughness: 1 })
  for (const side of [-1, 1]) {
    const sg = new PlaneGeometry(len, 1.6)
    sg.rotateX(-Math.PI / 2)
    const sm = new Mesh(sg, shoulderMat)
    sm.position.set(0, 0.025, road.z + side * (road.width / 2 + 0.8))
    sm.receiveShadow = true
    root.add(sm)
  }
}

// One plot's lot, sidewalk and fence (in that plot's frame). Materials are shared by all six.
let lotMats = null
export function buildPlotGround(root) {
  const { sidewalk, lot } = LAYOUT
  const len = PLOTS.width

  // Parking lot asphalt.
  const lw = lot.x1 - lot.x0
  const ld = lot.z1 - lot.z0
  if (!lotMats) {
    const lotTex = paintAsphalt(512, 21, 1)
    lotMats = {
      lot: new MeshStandardMaterial({ map: tex(lotTex.color, { repeatX: lw / 12, repeatY: ld / 12 }), normalMap: tex(lotTex.normal, { repeatX: lw / 12, repeatY: ld / 12, srgb: false }), color: '#d9d4cc', roughness: 0.95 }),
      stripe: std('#f4efe2', { roughness: 0.8 }),
      yellow: std('#f0c040', { roughness: 0.8 }),
      walk: std('#efe6d6', { roughness: 0.9 }),
      joint: std('#cfc4b0'),
    }
  }
  const lotMat = lotMats.lot
  const lg = new PlaneGeometry(lw, ld)
  lg.rotateX(-Math.PI / 2)
  const lm = new Mesh(lg, lotMat)
  lm.position.set((lot.x0 + lot.x1) / 2, 0.02, (lot.z0 + lot.z1) / 2)
  lm.receiveShadow = true
  root.add(lm)

  // Parking stripes: one row of stalls nose-in facing the rooms; the aisle runs in front.
  const { stripe, yellow } = lotMats
  const stripeGeo = new BoxGeometry(0.16, 0.02, 5.2)
  for (const z of lot.rows) for (let x = -12; x <= lot.x1 + 0.01; x += 3.2) put(root, stripeGeo, stripe, x, 0.035, z, false).receiveShadow = true
  // Painted arrows toward the office.
  const arrowShape = new Shape()
  arrowShape.moveTo(0, 0.9)
  arrowShape.lineTo(0.75, 0)
  arrowShape.lineTo(0.28, 0)
  arrowShape.lineTo(0.28, -1)
  arrowShape.lineTo(-0.28, -1)
  arrowShape.lineTo(-0.28, 0)
  arrowShape.lineTo(-0.75, 0)
  arrowShape.closePath()
  const ag = new ShapeGeometry(arrowShape)
  ag.rotateX(-Math.PI / 2)
  for (const [x, z, yaw] of [[-6, 7.9, Math.PI / 2], [1, 7.9, Math.PI / 2], [-6, 23.4, Math.PI / 2], [1, 23.4, Math.PI / 2]]) {
    const a = new Mesh(ag, yellow)
    a.position.set(x, 0.04, z)
    a.rotation.y = yaw
    a.scale.setScalar(1.0)
    root.add(a)
  }

  // Sidewalk along the road: raised concrete with a curb face.
  const walkMat = lotMats.walk
  const swD = sidewalk.z1 - sidewalk.z0
  const sw = new Mesh(new BoxGeometry(len, 0.18, swD), walkMat)
  sw.position.set(0, 0.09, (sidewalk.z0 + sidewalk.z1) / 2)
  sw.receiveShadow = true
  root.add(sw)
  // Joints every 2 m.
  const jg = new BoxGeometry(0.05, 0.01, swD)
  for (let x = -len / 2 + 1; x < len / 2; x += 2) put(root, jg, lotMats.joint, x, 0.185, (sidewalk.z0 + sidewalk.z1) / 2, false)
  buildFence(root)
}

// Wire fence on wooden posts along WORLD.fence (the property line; open where the lot
// meets the sidewalk).
function buildFence(root) {
  const post = new MeshStandardMaterial({ color: '#8a5a34', roughness: 1 })
  const wire = new MeshStandardMaterial({ color: '#6d6a66', roughness: 0.6, metalness: 0.4 })
  const pts = WORLD.fence
  const pg = new BoxGeometry(0.22, 1.6, 0.22)
  const posts = new Group()
  const add = (x, z) => put(posts, pg, post, x, 0.8, z, false)
  add(pts[0][0], pts[0][1])
  for (let i = 1; i < pts.length; i++) {
    const [ax, az] = pts[i - 1]
    const [bx, bz] = pts[i]
    const len = Math.hypot(bx - ax, bz - az)
    const n = Math.max(1, Math.round(len / 4))
    for (let k = 1; k <= n; k++) add(ax + ((bx - ax) * k) / n, az + ((bz - az) * k) / n)
    for (const y of [0.75, 1.3]) {
      const w = put(posts, new BoxGeometry(len, 0.03, 0.03), wire, (ax + bx) / 2, y, (az + bz) / 2, false)
      w.rotation.y = -Math.atan2(bz - az, bx - ax)
    }
  }
  root.add(posts)
}

// A water tower off in the dunes behind the road (global frame).
function buildTower(root) {
  const tower = new Group()
  const wood = new MeshStandardMaterial({ color: '#b9a58a', roughness: 1 })
  const tank = new MeshStandardMaterial({ color: '#d9d2c4', roughness: 0.8 })
  for (const [x, z] of [[-2, -2], [2, -2], [-2, 2], [2, 2]]) {
    const leg = put(tower, new BoxGeometry(0.3, 14, 0.3), wood, x * 0.9, 7, z * 0.9)
    leg.rotation.set(z * 0.02, 0, -x * 0.02)
  }
  put(tower, new CylinderGeometry(3.2, 3.2, 4.5, 16), tank, 0, 16, 0)
  put(tower, new CylinderGeometry(0.3, 3.5, 1.6, 16), tank, 0, 19, 0)
  tower.position.set(85, 0, -120)
  root.add(tower)
}

function makeClouds() {
  const rand = mulberry32(2024)
  const geo = new IcosahedronGeometry(1, 3)
  const mat = new MeshLambertMaterial({ color: '#ffffff', emissive: '#dcebff', emissiveIntensity: 0.62, fog: false })
  const group = new Group()
  for (let i = 0; i < 24; i++) {
    const ang = rand() * Math.PI * 2
    const dist = 230 + rand() * 180
    const cloud = new Group()
    const puffs = 5 + Math.floor(rand() * 4)
    const len = 22 + rand() * 26
    for (let p = 0; p < puffs; p++) {
      const t = p / (puffs - 1) - 0.5
      const r = (1 - Math.abs(t) * 1.1) * (8 + rand() * 6)
      const puff = new Mesh(geo, mat)
      puff.scale.set(r, r * 0.7, r)
      puff.position.set(t * len, r * 0.2 + rand() * 3, (rand() - 0.5) * 8)
      cloud.add(puff)
    }
    const flat = new Mesh(geo, mat)
    flat.scale.set(len * 0.62, 3.5, 9)
    cloud.add(flat)
    cloud.position.set(Math.cos(ang) * dist, 70 + rand() * 60, Math.sin(ang) * dist)
    cloud.lookAt(0, cloud.position.y, 0)
    group.add(cloud)
  }
  // ~180 puffs share one material: merged into one mesh (the whole sky turns as a group).
  return bake(group)
}

// The shared desert + road (`block`, global frame) and the player's own plot's ground. setPlot(k)
// places the block round plot k (the one this client plays on; 0 until the server says).
export function buildGround(root) {
  const block = new Group()
  block.name = 'road-block'
  block.matrixAutoUpdate = false
  buildPad(block)
  buildDunes(block)
  buildMesas(block)
  buildRoad(block)
  buildTower(block)
  root.add(block)
  buildPlotGround(root)
  const setPlot = (k) => {
    globalMatrix(k, block.matrix)
    block.matrixWorldNeedsUpdate = true
  }
  setPlot(0)
  return { block, setPlot }
}

// The pad's colliders: four slabs around the pool hole, and the fence.
export function landColliders() {
  const { pool } = LAYOUT
  const H = INNER
  const box = (x0, x1, z0, z1) => addFixed(RAPIER.ColliderDesc.cuboid((x1 - x0) / 2, 1, (z1 - z0) / 2), { x: (x0 + x1) / 2, y: -1, z: (z0 + z1) / 2 }, null, { friction: 0.9 })
  box(-H, pool.x0, -H, H)
  box(pool.x1, H, -H, H)
  box(pool.x0, pool.x1, -H, pool.z0)
  box(pool.x0, pool.x1, pool.z1, H)
  const { x0, x1, z0 } = WORLD.plot
  const z1 = LAYOUT.road.z + 4 // south: just past the highway
  const wall = (x, z, hx, hz) => addFixed(RAPIER.ColliderDesc.cuboid(hx, 3, hz), { x, y: 3, z })
  const cx = (x0 + x1) / 2
  const cz = (z0 + z1) / 2
  wall(cx, z0 - 0.4, (x1 - x0) / 2 + 0.4, 0.4)
  wall(cx, z1, (x1 - x0) / 2 + 0.4, 0.4)
  wall(x0 - 0.4, cz, 0.4, (z1 - z0) / 2)
  wall(x1 + 0.4, cz, 0.4, (z1 - z0) / 2)
  // The property fence: 1.75 m tall (over a jump, under the chase camera's ray).
  const pts = WORLD.fence
  for (let i = 1; i < pts.length; i++) {
    const [ax, az] = pts[i - 1]
    const [bx, bz] = pts[i]
    const yaw = -Math.atan2(bz - az, bx - ax)
    const q = { x: 0, y: Math.sin(yaw / 2), z: 0, w: Math.cos(yaw / 2) }
    addFixed(RAPIER.ColliderDesc.cuboid(Math.hypot(bx - ax, bz - az) / 2 + 0.12, 0.875, 0.12), { x: (ax + bx) / 2, y: 0.875, z: (az + bz) / 2 }, q)
  }
}

// Clouds drift slowly round the sky.
export function createWorld(scene) {
  const clouds = makeClouds()
  scene.add(clouds)
  return {
    update(dt) {
      clouds.rotation.y += dt * 0.0025
    },
  }
}

export { duneHeight, DoubleSide, ExtrudeGeometry }
