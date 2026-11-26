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
import { LAYOUT, WORLD } from './config.js'
import { RAPIER, addFixed } from './physics.js'
import { mulberry32, paintSand, toTexture } from './textures.js'
import { canvas, paintAsphalt, tex } from './motel/paint.js'
import { std, put } from './propkit.js'

// The desert around the motel:
//  - a flat sand pad (with a hole where the pool basin sinks in),
//  - rolling dunes rising beyond it, mesas and a water tower on the horizon,
//  - the highway along the south edge, the asphalt lot and the sidewalk,
//  - puffy clouds.
// Physically: the pad as boxes around the pool hole + an invisible fence.

const INNER = 110 // half-size of the flat pad (m); dunes start past it

function smoothstep(a, b, x) {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

// Dune height at (x, z) for points outside the pad: long wind-blown ridges.
function duneHeight(x, z) {
  const d = Math.max(Math.abs(x), Math.abs(z)) - INNER
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
  s.moveTo(-INNER, -INNER)
  s.lineTo(INNER, -INNER)
  s.lineTo(INNER, INNER)
  s.lineTo(-INNER, INNER)
  s.closePath()
  // Shape space is (x, -z) once rotated flat.
  const hole = new Path()
  hole.moveTo(pool.x0, -pool.z0)
  hole.lineTo(pool.x0, -pool.z1)
  hole.lineTo(pool.x1, -pool.z1)
  hole.lineTo(pool.x1, -pool.z0)
  hole.closePath()
  s.holes.push(hole)
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
    const z = pos.getZ(i)
    const inside = Math.abs(x) < INNER && Math.abs(z) < INNER
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
  const { road, sidewalk, lot } = LAYOUT
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

  // Parking lot asphalt.
  const lotTex = paintAsphalt(512, 21, 1)
  const lw = lot.x1 - lot.x0
  const ld = lot.z1 - lot.z0
  const lotMat = new MeshStandardMaterial({ map: tex(lotTex.color, { repeatX: lw / 12, repeatY: ld / 12 }), normalMap: tex(lotTex.normal, { repeatX: lw / 12, repeatY: ld / 12, srgb: false }), color: '#d9d4cc', roughness: 0.95 })
  const lg = new PlaneGeometry(lw, ld)
  lg.rotateX(-Math.PI / 2)
  const lm = new Mesh(lg, lotMat)
  lm.position.set((lot.x0 + lot.x1) / 2, 0.02, (lot.z0 + lot.z1) / 2)
  lm.receiveShadow = true
  root.add(lm)

  // Parking stripes: stalls nose-in facing the rooms, plus a row along the lot middle.
  const stripe = std('#f4efe2', { roughness: 0.8 })
  const yellow = std('#f0c040', { roughness: 0.8 })
  const stripeGeo = new BoxGeometry(0.16, 0.02, 5.2)
  for (let x = -12; x <= 24; x += 3.2) put(root, stripeGeo, stripe, x, 0.035, 2.2, false).receiveShadow = true
  for (let x = -38; x <= -22; x += 3.2) put(root, stripeGeo, stripe, x, 0.035, 3.5, false).receiveShadow = true
  for (let x = -6; x <= 22; x += 3.2) {
    put(root, stripeGeo, stripe, x, 0.035, 15, false)
    put(root, stripeGeo, stripe, x, 0.035, 22.5, false)
  }
  const lane = new BoxGeometry(lw - 6, 0.02, 0.18)
  put(root, lane, yellow, (lot.x0 + lot.x1) / 2, 0.035, 9, false)
  put(root, lane, yellow, (lot.x0 + lot.x1) / 2, 0.035, 29.5, false)
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
  for (const [x, z, yaw] of [[-8, 26, Math.PI / 2], [10, 26, Math.PI / 2], [-30, 12, 0]]) {
    const a = new Mesh(ag, yellow)
    a.position.set(x, 0.04, z)
    a.rotation.y = yaw
    a.scale.setScalar(1.3)
    root.add(a)
  }

  // Sidewalk along the road: raised concrete with a curb face.
  const walkMat = std('#efe6d6', { roughness: 0.9 })
  const swD = sidewalk.z1 - sidewalk.z0
  const sw = new Mesh(new BoxGeometry(len * 0.25, 0.18, swD), walkMat)
  sw.position.set(0, 0.09, (sidewalk.z0 + sidewalk.z1) / 2)
  sw.receiveShadow = true
  root.add(sw)
  // Joints every 2 m.
  const joint = std('#cfc4b0')
  const jg = new BoxGeometry(0.05, 0.01, swD)
  for (let x = -170; x <= 170; x += 2) put(root, jg, joint, x, 0.185, (sidewalk.z0 + sidewalk.z1) / 2, false)
}

// Wire fence on wooden posts around the property edge (the walkable limit), and
// a water tower off in the dunes.
function buildFenceAndTower(root) {
  const post = new MeshStandardMaterial({ color: '#8a5a34', roughness: 1 })
  const wire = new MeshStandardMaterial({ color: '#6d6a66', roughness: 0.6, metalness: 0.4 })
  const h = WORLD.half
  const pg = new BoxGeometry(0.22, 1.6, 0.22)
  const posts = new Group()
  const add = (x, z) => put(posts, pg, post, x, 0.8, z, false)
  for (let x = -h; x <= h; x += 6) add(x, -h)
  for (let z = -h; z <= h - 30; z += 6) {
    add(-h, z)
    add(h, z)
  }
  for (const y of [0.75, 1.3]) {
    put(posts, new BoxGeometry(h * 2, 0.03, 0.03), wire, 0, y, -h, false)
    put(posts, new BoxGeometry(0.03, 0.03, h * 2 - 30), wire, -h, y, -15, false)
    put(posts, new BoxGeometry(0.03, 0.03, h * 2 - 30), wire, h, y, -15, false)
  }
  root.add(posts)

  // Water tower.
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
  return group
}

export function buildGround(root) {
  buildPad(root)
  buildDunes(root)
  buildMesas(root)
  buildRoad(root)
  buildFenceAndTower(root)
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
  const h = WORLD.half
  const wall = (x, z, hx, hz) => addFixed(RAPIER.ColliderDesc.cuboid(hx, 3, hz), { x, y: 3, z })
  wall(0, -h, h, 0.4)
  wall(0, LAYOUT.road.z + 4, h, 0.4) // south: just past the highway
  wall(-h, 0, 0.4, h)
  wall(h, 0, 0.4, h)
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
