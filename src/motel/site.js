// Everything around the building: the pool deck (a dry, leaf-strewn pool behind
// a "opens with a 5-star room" sign, pump with a lock tag, ladder, diving board,
// barricades — it fills with water once opened), the broken tiled fountain
// (fixable), the plank-fenced junk yard behind the motel (dumpster, trash
// bags, big junk), and the landscaping: palms, trees, bushes, cacti, street
// lamps, parked retro cars, the mailbox and the bus stop.
import {
  BoxGeometry,
  CircleGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DoubleSide,
  Group,
  IcosahedronGeometry,
  InstancedMesh,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  PlaneGeometry,
  RingGeometry,
  TorusGeometry,
} from 'three'
import { ECONOMY, LAYOUT, WORLD } from '../config.js'
import { RAPIER, addFixed } from '../physics.js'
import { mulberry32 } from '../textures.js'
import { box, C, canvasTex, mat, rbox, textures } from './kit.js'
import { paintSign, paintTile, tex } from './paint.js'
import { dressPool } from './poolside.js'
import { bush, busStop, cactus, dumpster, junk, mailbox, palm, rock, streetLamp, trashBag, tree } from './props.js'

const PLOT_HALF = WORLD.plot.x1 // half the plot's width (the plot is centred on x = 0)

function solid(hx, hy, hz, x, y, z, yaw = 0) {
  return addFixed(RAPIER.ColliderDesc.cuboid(hx, hy, hz), { x, y, z }, yaw ? { x: 0, y: Math.sin(yaw / 2), z: 0, w: Math.cos(yaw / 2) } : null)
}
function signPlane(parent, c, w, h, x, y, z, ry = 0) {
  const m = new Mesh(new PlaneGeometry(w, h), new MeshStandardMaterial({ map: canvasTex(c), roughness: 0.6, side: DoubleSide }))
  m.position.set(x, y, z)
  m.rotation.y = ry
  parent.add(m)
  return m
}

// Striped sawhorse barricade.
export function barricade() {
  const g = new Group()
  const c = document.createElement('canvas')
  c.width = 256
  c.height = 48
  const ctx = c.getContext('2d')
  ctx.fillStyle = '#ff8a1e'
  ctx.fillRect(0, 0, 256, 48)
  ctx.fillStyle = '#ffffff'
  for (let x = -40; x < 256; x += 56) {
    ctx.beginPath()
    ctx.moveTo(x, 48)
    ctx.lineTo(x + 28, 0)
    ctx.lineTo(x + 52, 0)
    ctx.lineTo(x + 24, 48)
    ctx.fill()
  }
  const m = mat('#ffffff', { map: canvasTex(c) })
  box(g, 1.8, 0.26, 0.05, m, 0, 0.95, 0)
  box(g, 1.8, 0.26, 0.05, m, 0, 0.55, 0)
  for (const x of [-0.8, 0.8]) {
    box(g, 0.07, 1.2, 0.07, mat('#f3f0ea'), x, 0.58, 0.15).rotation.x = 0.25
    box(g, 0.07, 1.2, 0.07, mat('#f3f0ea'), x, 0.58, -0.15).rotation.x = -0.25
  }
  return g
}

// --- Pool ------------------------------------------------------------------------------
function buildPool(scene) {
  const P = LAYOUT.pool
  const D = P.deck
  const g = new Group()
  const deck = mat('#f3ead9', { map: textures().pave, normalMap: textures().paveN, roughness: 0.9 })
  // Deck slabs around the basin (thin, flush with the ground).
  const slab = (x0, x1, z0, z1) => box(g, x1 - x0, 0.06, z1 - z0, deck, (x0 + x1) / 2, 0.03, (z0 + z1) / 2, 2)
  slab(D.x0, P.x0, D.z0, D.z1)
  slab(P.x1, D.x1, D.z0, D.z1)
  slab(P.x0, P.x1, D.z0, P.z0)
  slab(P.x0, P.x1, P.z1, D.z1)
  if (D.ext) slab(D.ext.x0, D.ext.x1, D.ext.z0, D.ext.z1)
  // Coping, mosaic waterline, drains, lights, deck props: poolside.js (dressPool below).
  const cope = mat('#fbf6ec', { roughness: 0.5 })
  const pw = P.x1 - P.x0
  const pd = P.z1 - P.z0
  const small = pw < 9 // a corner pool: the closed-state props sit on the south deck
  const closedAt = small
    ? { sign: [P.x0 + 0.9, P.z1 + 1.5], pump: [P.x0 - 1.0, P.z1 + 1.2], barricades: [[P.x0 + 2.9, P.z1 + 1.0, 0.1], [P.x1 - 1.0, P.z1 + 1.1, -0.15]] }
    : { sign: [P.x0 - 2.3, P.z1 + 2.5], pump: [P.x0 - 1.5, P.z1 + 1.2], barricades: [[P.x0 + 2, P.z1 + 1.0, 0.1], [P.x1 - 1.5, P.z1 + 1.1, -0.15]] }
  // Basin: tiled walls + floor, a dark waterline band, depth markings.
  const tileM = mat('#ffffff', { map: tex(paintTile('#6fb7c8', '#9fd2dc', '#d8eef2', 256, 8), { repeatX: 1, repeatY: 1 }), roughness: 0.35 })
  const deep = -P.depth
  const wall = (w, d, x, z) => box(g, w, P.depth, d, tileM, x, deep / 2, z, 1.2)
  wall(pw, 0.1, (P.x0 + P.x1) / 2, P.z0 + 0.05)
  wall(pw, 0.1, (P.x0 + P.x1) / 2, P.z1 - 0.05)
  wall(0.1, pd, P.x0 + 0.05, (P.z0 + P.z1) / 2)
  wall(0.1, pd, P.x1 - 0.05, (P.z0 + P.z1) / 2)
  box(g, pw - 0.2, 0.05, pd - 0.2, tileM, (P.x0 + P.x1) / 2, deep, (P.z0 + P.z1) / 2, 1.2)
  // Lane line down the middle of the floor (its T-ends are in poolside.js).
  box(g, pw - 1, 0.02, 0.18, mat('#1f6f8b'), (P.x0 + P.x1) / 2, deep + 0.04, (P.z0 + P.z1) / 2)
  // Steps at the shallow end (so you can climb out).
  for (let i = 0; i < 4; i++) {
    const h = P.depth - i * (P.depth / 4)
    box(g, 2.0, 0.12, 0.45, cope, P.x1 - 1.2, -h + 0.3, P.z0 + 0.35 + i * 0.45)
    solid(1.0, 0.08, 0.23, P.x1 - 1.2, -h + 0.3, P.z0 + 0.35 + i * 0.45)
  }
  solid(pw / 2, 0.1, pd / 2, (P.x0 + P.x1) / 2, deep - 0.1, (P.z0 + P.z1) / 2)
  // Ladder.
  const chrome = mat('#e4e8ea', { metalness: 0.9, roughness: 0.2 })
  for (const dx of [-0.3, 0.3]) {
    const rail = new Mesh(new TorusGeometry(0.35, 0.035, 8, 14, Math.PI), chrome)
    rail.position.set(P.x0 + 3 + dx, 0.45, P.z1 - 0.05)
    rail.rotation.y = Math.PI / 2
    g.add(rail)
    box(g, 0.06, 1.2, 0.06, chrome, P.x0 + 3 + dx, -0.4, P.z1 - 0.35)
  }
  for (let i = 0; i < 3; i++) box(g, 0.6, 0.04, 0.12, chrome, P.x0 + 3, -0.2 - i * 0.35, P.z1 - 0.35)
  // Diving board on a teal stand at the deep end.
  const dbz = (P.z0 + P.z1) / 2 + Math.min(2, pd / 2 - 1.2)
  box(g, 0.8, 0.5, 0.6, mat(C.teal), P.x0 - 0.9, 0.25, dbz)
  const board = rbox(g, 2.8, 0.1, 0.55, 0.04, mat('#5fc6b1', { roughness: 0.4 }), P.x0 + 0.3, 0.55, dbz)
  board.rotation.z = -0.03
  solid(0.4, 0.3, 0.3, P.x0 - 0.9, 0.3, dbz)

  // Dry-pool dressing: dead leaves, a green puddle, a few bits of trash.
  const dry = new Group()
  const leafMats = ['#e98a2f', '#d46a1f', '#f2a73a'].map((c) => mat(c, { side: DoubleSide, roughness: 1 }))
  const rand = mulberry32(12)
  const leafGeo = new PlaneGeometry(0.22, 0.12)
  for (let i = 0; i < 70; i++) {
    const l = new Mesh(leafGeo, leafMats[i % 3])
    l.rotation.set(-Math.PI / 2 + (rand() - 0.5) * 0.6, 0, rand() * 6)
    const cluster = i % 3
    const cxp = [P.x0 + 3, P.x1 - 3, (P.x0 + P.x1) / 2][cluster]
    const czp = [P.z0 + Math.min(2, pd * 0.3), P.z1 - Math.min(2.5, pd * 0.3), (P.z0 + P.z1) / 2][cluster]
    l.position.set(cxp + (rand() - 0.5) * Math.min(3, pw * 0.3), deep + 0.05 + rand() * 0.02, czp + (rand() - 0.5) * Math.min(2.5, pd * 0.4))
    dry.add(l)
  }
  const puddle = new Mesh(new CircleGeometry(Math.min(1.8, pd * 0.32), 24), new MeshStandardMaterial({ color: '#8fa64a', transparent: true, opacity: 0.75, roughness: 0.1 }))
  puddle.rotation.x = -Math.PI / 2
  puddle.scale.set(1.4, 1, 1)
  puddle.position.set((P.x0 + P.x1) / 2 - 1, deep + 0.04, (P.z0 + P.z1) / 2 + Math.min(1, pd * 0.1))
  dry.add(puddle)
  g.add(dry)
  // Water (hidden until the pool opens).
  const waterMat = new MeshStandardMaterial({ color: '#3fc7e8', transparent: true, opacity: 0.78, roughness: 0.05, metalness: 0.1 })
  const water = new Mesh(new PlaneGeometry(pw - 0.2, pd - 0.2), waterMat)
  water.rotation.x = -Math.PI / 2
  water.position.set((P.x0 + P.x1) / 2, deep, (P.z0 + P.z1) / 2)
  water.visible = false
  g.add(water)

  // "POOL OPENS WITH A 5-STAR ROOM" sign on a post.
  const signC = paintSign({ w: 640, h: 300, bg: '#f6f1e6', border: '#d9d2c2', borderW: 8, radius: 6, lines: [{ t: 'POOL', size: 80, color: '#2f6fd0' }, { t: 'OPENS WITH A', size: 66, color: '#2f6fd0' }, { t: '5-STAR ROOM', size: 74, color: '#2f6fd0' }] })
  const sign = new Group()
  box(sign, 0.08, 2.4, 0.08, mat('#cfcac0'), 0, 1.2, 0)
  signPlane(sign, signC, 2.0, 0.94, 0, 2.2, 0.05)
  sign.position.set(closedAt.sign[0], 0, closedAt.sign[1])
  sign.rotation.y = 0.35
  g.add(sign)
  solid(0.1, 1.2, 0.1, closedAt.sign[0], 1.2, closedAt.sign[1])
  // Pool pump with a locked "5★ ROOM" tag.
  const pump = new Group()
  rbox(pump, 1.1, 0.12, 0.8, 0.03, mat('#e8dcc4'), 0, 0.06, 0)
  const tank = new Mesh(new CylinderGeometry(0.28, 0.3, 0.85, 16), mat('#1f9e83', { roughness: 0.35 }))
  tank.position.set(-0.2, 0.55, 0)
  pump.add(tank)
  const motor = new Mesh(new CylinderGeometry(0.17, 0.17, 0.5, 14), mat('#e9efe9', { roughness: 0.4 }))
  motor.rotation.z = Math.PI / 2
  motor.position.set(0.25, 0.3, 0.1)
  pump.add(motor)
  box(pump, 0.05, 0.6, 0.05, mat('#1f9e83'), 0.45, 0.4, -0.25)
  const tagC = paintSign({ w: 256, h: 180, bg: '#fbf6ec', border: '#1f9e83', borderW: 12, radius: 10, lines: [{ t: '🔒 5★', size: 56, color: '#333' }, { t: 'ROOM', size: 48, color: '#333' }] })
  signPlane(pump, tagC, 0.45, 0.32, 0.45, 0.85, -0.25)
  pump.position.set(closedAt.pump[0], 0, closedAt.pump[1])
  pump.rotation.y = -0.4
  g.add(pump)
  solid(0.55, 0.5, 0.4, closedAt.pump[0], 0.5, closedAt.pump[1])
  // Barricades by the pool and the stairs.
  const barricades = []
  for (const [x, z, r] of closedAt.barricades) {
    const b = barricade()
    b.position.set(x, 0, z)
    b.rotation.y = r
    g.add(b)
    barricades.push(b)
    solid(0.9, 0.6, 0.25, x, 0.6, z, r)
  }
  // Close-up dressing: coping, mosaic, drains, jets, lights, loungers, umbrellas, props.
  const dress = dressPool(g, P, solid, water)
  scene.add(g)
  let fill = 0
  let open = false
  return {
    open() {
      if (open) return
      open = true
      water.visible = true
      dress.setOpen(true)
      for (const b of barricades) b.visible = false
      sign.visible = false
    },
    // Back to closed and dry (src/remoteMotels.js: a plot whose new owner has no pool yet).
    close() {
      if (!open) return
      open = false
      fill = 0
      water.visible = false
      water.position.y = deep
      dry.visible = true
      dress.update(0, 0, deep, 0) // hides the caustics, lights and floating toys
      dress.setOpen(false)
      for (const b of barricades) b.visible = true
      sign.visible = true
    },
    isOpen: () => open,
    update(dt, t) {
      if (open && fill < 1) {
        fill = Math.min(1, fill + dt / 6)
        water.position.y = deep + fill * (P.depth - 0.25)
        dry.visible = fill < 0.5
      }
      if (open) waterMat.color.setHSL(0.53, 0.75, 0.55 + Math.sin(t * 1.3) * 0.02)
      dress.update(dt, t, water.position.y, fill)
    },
    group: g, // the whole pool (src/remoteMotels.js bakes it open and closed)
    center: { x: (P.x0 + P.x1) / 2, z: (P.z0 + P.z1) / 2 },
  }
}

// --- Fountain ---------------------------------------------------------------------------
function buildFountain(scene) {
  const F = LAYOUT.fountain
  const g = new Group()
  // Plaza of warm tiles.
  const plaza = new Mesh(new CircleGeometry(F.r + F.plaza, 8), mat('#f2d9ae', { map: textures().pave, roughness: 0.9 }))
  plaza.rotation.x = -Math.PI / 2
  plaza.rotation.z = Math.PI / 8
  plaza.position.y = 0.025
  plaza.receiveShadow = true
  g.add(plaza)
  // Octagonal basin wall built from colourful tile blocks.
  const tileCols = ['#f6e7c8', '#8fd0b8', '#f3b17a', '#fbf1dc', '#e8cfa2']
  const sides = 8
  const R = F.r
  for (let i = 0; i < sides; i++) {
    const a0 = (i / sides) * Math.PI * 2 + Math.PI / 8
    const a1 = ((i + 1) / sides) * Math.PI * 2 + Math.PI / 8
    const segs = 4
    for (let k = 0; k < segs; k++) {
      const t0 = k / segs
      const t1 = (k + 1) / segs
      const x0 = Math.cos(a0) * R + (Math.cos(a1) - Math.cos(a0)) * R * t0
      const z0 = Math.sin(a0) * R + (Math.sin(a1) - Math.sin(a0)) * R * t0
      const x1 = Math.cos(a0) * R + (Math.cos(a1) - Math.cos(a0)) * R * t1
      const z1 = Math.sin(a0) * R + (Math.sin(a1) - Math.sin(a0)) * R * t1
      const len = Math.hypot(x1 - x0, z1 - z0)
      const b = box(g, len - 0.04, 0.75, 0.55, mat(tileCols[(i * 3 + k) % tileCols.length], { roughness: 0.5 }), (x0 + x1) / 2, 0.375, (z0 + z1) / 2)
      b.rotation.y = -Math.atan2(z1 - z0, x1 - x0)
      const cap = box(g, len + 0.02, 0.12, 0.7, mat('#fbf4e6', { roughness: 0.5 }), (x0 + x1) / 2, 0.8, (z0 + z1) / 2)
      cap.rotation.y = b.rotation.y
    }
    // Agave pots on the corners.
    if (i % 2 === 0) {
      const pot = new Mesh(new CylinderGeometry(0.4, 0.3, 0.5, 10), mat('#d2743a'))
      pot.position.set(Math.cos(a0) * R, 1.1, Math.sin(a0) * R)
      g.add(pot)
      const agave = new Group()
      for (let k = 0; k < 9; k++) {
        const blade = new Mesh(new ConeGeometry(0.08, 0.7, 4), mat('#e3b23c', { flatShading: true }))
        blade.position.y = 0.3
        blade.rotation.set(Math.cos(k * 0.7) * 0.7, k, Math.sin(k * 0.7) * 0.7)
        agave.add(blade)
      }
      agave.position.copy(pot.position)
      agave.position.y += 0.2
      g.add(agave)
    }
  }
  // Basin floor: dry sand + cracks + debris when broken.
  const floorM = new MeshStandardMaterial({ color: '#e9c98d', roughness: 1 }) // its own: fix() recolours it
  const fl = new Mesh(new CircleGeometry(R - 0.25, 8), floorM)
  fl.rotation.x = -Math.PI / 2
  fl.rotation.z = Math.PI / 8
  fl.position.y = 0.3
  g.add(fl)
  const waterMat = new MeshStandardMaterial({ color: '#58cde6', transparent: true, opacity: 0.8, roughness: 0.05 })
  const water = new Mesh(new CircleGeometry(R - 0.25, 8), waterMat)
  water.rotation.x = -Math.PI / 2
  water.rotation.z = Math.PI / 8
  water.position.y = 0.62
  water.visible = false
  g.add(water)
  // Tiered centrepiece; the top bowl lies broken on the ground.
  const stone = mat('#f0c89a', { roughness: 0.6 })
  const teal = mat('#7cc6b0', { roughness: 0.6 })
  const pedestal = new Mesh(new CylinderGeometry(0.45, 0.7, 1.6, 10), stone)
  pedestal.position.y = 1.1
  g.add(pedestal)
  const bowl = new Mesh(new CylinderGeometry(1.8, 0.5, 0.45, 12), teal)
  bowl.position.y = 2.0
  g.add(bowl)
  const stem = new Mesh(new CylinderGeometry(0.2, 0.3, 1.0, 10), stone)
  stem.position.y = 2.7
  g.add(stem)
  const topBowl = new Mesh(new CylinderGeometry(0.9, 0.3, 0.32, 12), mat('#f3b17a', { roughness: 0.5 }))
  const topWhole = { pos: [0, 3.3, 0], rot: [0, 0, 0] }
  const topBroken = { pos: [1.6, 0.45, 1.2], rot: [0.9, 0.3, 0.5] }
  topBowl.position.set(...topBroken.pos)
  topBowl.rotation.set(...topBroken.rot)
  g.add(topBowl)
  const finial = new Mesh(new ConeGeometry(0.16, 0.5, 8), stone)
  finial.position.set(0, 3.7, 0)
  finial.visible = false
  g.add(finial)
  const debris = new Group()
  const drand = mulberry32(5)
  for (let i = 0; i < 10; i++) {
    const d = box(debris, 0.15 + drand() * 0.3, 0.06, 0.12 + drand() * 0.25, mat(tileCols[i % 5]), (drand() - 0.5) * F.r * 1.3, 0.33, (drand() - 0.5) * F.r * 1.3)
    d.rotation.y = drand() * 3
  }
  for (let i = 0; i < 5; i++) {
    const tw = new Mesh(new IcosahedronGeometry(0.28, 1), mat('#b0884e', { roughness: 1, wireframe: true }))
    tw.position.set((drand() - 0.5) * F.r * 1.1, 0.5, (drand() - 0.5) * F.r * 1.1)
    debris.add(tw)
  }
  g.add(debris)
  g.position.set(F.x, 0, F.z)
  scene.add(g)
  // Colliders: the basin ring as eight boxes, the centrepiece.
  for (let i = 0; i < sides; i++) {
    const a = ((i + 0.5) / sides) * Math.PI * 2 + Math.PI / 8
    const len = 2 * R * Math.sin(Math.PI / sides)
    solid(len / 2, 0.45, 0.35, F.x + Math.cos(a) * R * Math.cos(Math.PI / sides), 0.45, F.z + Math.sin(a) * R * Math.cos(Math.PI / sides), -a + Math.PI / 2)
  }
  addFixed(RAPIER.ColliderDesc.cylinder(1.3, 0.7), { x: F.x, y: 1.3, z: F.z })
  let fixed = false
  let lerp = 0
  return {
    point: { x: F.x, z: F.z + R + 0.8 },
    isFixed: () => fixed,
    fix() {
      fixed = true
      debris.visible = false
      finial.visible = true
      water.visible = true
      floorM.color.set('#7fd6e8')
    },
    // Back to broken (src/remoteMotels.js: a plot whose new owner has not mended theirs yet).
    unfix() {
      fixed = false
      lerp = 0
      debris.visible = true
      finial.visible = false
      water.visible = false
      floorM.color.set('#e9c98d')
      topBowl.position.set(...topBroken.pos)
      topBowl.rotation.set(...topBroken.rot)
    },
    update(dt, t) {
      if (fixed && lerp < 1) {
        lerp = Math.min(1, lerp + dt * 1.2)
        const e = lerp * lerp * (3 - 2 * lerp)
        topBowl.position.set(topBroken.pos[0] * (1 - e), topBroken.pos[1] + (topWhole.pos[1] - topBroken.pos[1]) * e + Math.sin(e * Math.PI) * 1.2, topBroken.pos[2] * (1 - e))
        topBowl.rotation.set(topBroken.rot[0] * (1 - e), topBroken.rot[1] * (1 - e), topBroken.rot[2] * (1 - e))
      }
      if (fixed) water.position.y = 0.62 + Math.sin(t * 2) * 0.01
    },
    group: g, // the whole fountain (src/remoteMotels.js bakes it broken and mended)
    spouts: [
      { x: F.x, y: 3.9, z: F.z },
      { x: F.x, y: 2.25, z: F.z },
    ],
  }
}
// --- Junk yard ------------------------------------------------------------------------------
function buildYard(scene) {
  const Y = LAYOUT.junkYard
  const g = new Group()
  // Packed-dirt ground.
  const dirt = new Mesh(new PlaneGeometry(Y.x1 - Y.x0, Y.z1 - Y.z0), mat('#b98b57', { map: textures().stucco, roughness: 1 }))
  dirt.rotation.x = -Math.PI / 2
  dirt.position.set((Y.x0 + Y.x1) / 2, 0.02, (Y.z0 + Y.z1) / 2)
  dirt.receiveShadow = true
  g.add(dirt)
  // Plank fence: vertical boards in varied browns (instanced), two rails.
  const boardGeo = new BoxGeometry(0.28, 2.4, 0.08)
  const runs = []
  const edge = (x0, z0, x1, z1) => runs.push([x0, z0, x1, z1])
  const westGate = Y.gate.side === 'west'
  edge(Y.x0, Y.z0, Y.x1, Y.z0) // back
  edge(Y.x1, Y.z0, Y.x1, Y.z1) // east
  if (westGate) {
    edge(Y.x0, Y.z1, Y.x1, Y.z1) // south
    edge(Y.x0, Y.z0, Y.x0, Y.gate.z0) // west, either side of the gate
    edge(Y.x0, Y.gate.z1, Y.x0, Y.z1)
  } else {
    edge(Y.x0, Y.z0, Y.x0, Y.z1) // west
    edge(Y.gate.x1, Y.z1, Y.x1, Y.z1) // south, after the gate
  }
  let count = 0
  for (const [x0, z0, x1, z1] of runs) count += Math.ceil(Math.hypot(x1 - x0, z1 - z0) / 0.3)
  const fence = new InstancedMesh(boardGeo, new MeshStandardMaterial({ map: textures().wood, roughness: 0.9 }), count)
  const o = new Object3D()
  const col = new Color()
  const rand = mulberry32(31)
  let n = 0
  for (const [x0, z0, x1, z1] of runs) {
    const len = Math.hypot(x1 - x0, z1 - z0)
    const k = Math.ceil(len / 0.3)
    const yaw = Math.atan2(-(z1 - z0), x1 - x0)
    for (let i = 0; i < k; i++) {
      const t = (i + 0.5) / k
      o.position.set(x0 + (x1 - x0) * t, 1.2 + (rand() - 0.5) * 0.12, z0 + (z1 - z0) * t)
      o.rotation.set(0, yaw, (rand() - 0.5) * 0.04)
      o.updateMatrix()
      fence.setMatrixAt(n, o.matrix)
      fence.setColorAt(n, col.set(['#7a4a26', '#8b5a30', '#6b3d1f', '#9a6638'][Math.floor(rand() * 4)]))
      n++
    }
    const cx = (x0 + x1) / 2
    const cz = (z0 + z1) / 2
    for (const y of [0.6, 1.8]) {
      const rail = box(g, len, 0.12, 0.08, mat('#5e3a1e'), cx, y, cz)
      rail.rotation.y = yaw
      rail.position.x += Math.sin(yaw) * 0.08
      rail.position.z += Math.cos(yaw) * 0.08
    }
    solid(len / 2, 1.2, 0.1, cx, 1.2, cz, yaw)
  }
  fence.castShadow = true
  fence.receiveShadow = true
  g.add(fence)
  // Gate posts, an open gate leaf swung outward, and the sign beside the gate.
  const yardSign = paintSign({ w: 420, h: 140, bg: '#f6d33c', border: '#3b2a1a', borderW: 10, radius: 8, lines: [{ t: 'JUNK YARD', size: 70, color: '#3b2a1a' }] })
  if (westGate) {
    const gw = Y.gate.z1 - Y.gate.z0
    for (const z of [Y.gate.z0, Y.gate.z1]) box(g, 0.3, 2.8, 0.3, mat('#5e3a1e'), Y.x0, 1.4, z)
    const gate = box(g, gw - 0.4, 2.0, 0.08, mat('#8b5a30', { map: textures().wood }), 0, 1.1, 0)
    gate.position.set(Y.x0 - gw / 2 + 0.2, 1.1, Y.gate.z0 - 0.2)
    signPlane(g, yardSign, 1.6, 0.53, Y.x0 - 0.12, 2.55, (Y.gate.z0 + Y.gate.z1) / 2, -Math.PI / 2) // over the gateway
  } else {
    for (const x of [Y.gate.x0, Y.gate.x1]) box(g, 0.3, 2.8, 0.3, mat('#5e3a1e'), x, 1.4, Y.z1)
    const gate = box(g, Y.gate.x1 - Y.gate.x0 - 0.4, 2.0, 0.08, mat('#8b5a30', { map: textures().wood }), 0, 1.1, 0)
    gate.position.set(Y.gate.x0 - 0.2, 1.1, Y.z1 + (Y.gate.x1 - Y.gate.x0) / 2 - 0.2)
    gate.rotation.y = Math.PI / 2
    signPlane(g, yardSign, 1.6, 0.53, (Y.gate.x1 + Y.gate.x1 + 3) / 2, 2.0, Y.z1 + 0.1)
  }
  scene.add(g)

  // Dumpster.
  const dump = dumpster()
  dump.position.set(LAYOUT.dumpster.x, 0, LAYOUT.dumpster.z)
  dump.rotation.y = Math.PI
  scene.add(dump)
  solid(1.55, 1.0, 0.95, LAYOUT.dumpster.x, 1.0, LAYOUT.dumpster.z)

  // Trash bags in clusters + big junk pieces.
  const prand = mulberry32(77)
  const bags = []
  const clusters = [[-22, -31], [-16, -33], [-10, -29], [-19, -26], [-7, -33]]
  for (let i = 0; i < ECONOMY.yardBags; i++) {
    const [cx, cz] = clusters[i % clusters.length]
    const b = trashBag(i)
    b.position.set(cx + (prand() - 0.5) * 2.4, 0, cz + (prand() - 0.5) * Math.min(2, Y.z1 - Y.z0 - 1))
    b.scale.setScalar(0.9 + prand() * 0.3)
    scene.add(b)
    bags.push(b)
  }
  const junks = []
  const junkSpots = [[-23, -28], [-13, -31.5], [-6, -28], [-18, -33.5], [-11, -25.5], [-3, -31], [-21, -24]]
  for (let i = 0; i < ECONOMY.yardJunk; i++) {
    const j = junk(i % 7)
    const [x, z] = junkSpots[i % junkSpots.length]
    j.position.set(x, 0, z)
    j.rotation.y = prand() * Math.PI
    scene.add(j)
    junks.push(j)
  }
  return {
    bags,
    junks,
    dumpPoint: { x: LAYOUT.dumpster.x - 2.2, z: LAYOUT.dumpster.z + 0.4 },
    inside: (x, z) => x > Y.x0 - (Y.gate.side === 'west' ? 1.5 : 0) && x < Y.x1 && z > Y.z0 && z < Y.z1 + (Y.gate.side === 'west' ? 0 : 1.5),
  }
}

// --- Landscaping ---------------------------------------------------------------------------
function buildLandscape(scene, lighting) {
  const add = (obj, x, z, ry = 0) => {
    obj.position.set(x, 0, z)
    obj.rotation.y = ry
    scene.add(obj)
    return obj
  }
  // Scenery stays on this plot (and behind it): the neighbouring plots stand either side.
  const mine = ([x, z]) => Math.abs(x) <= PLOT_HALF - 1 && z <= LAYOUT.sidewalk.z1
  // Palms.
  const palms = [[-33.5, 5.8], [-19.5, 5.6], [5, 5.6], [-19.5, 24.6], [5, 24.6], [-30, 16], [-24, 22.5], [30, 14], [32.5, -1], [32.5, -12], [-32.5, -9], [-32.5, -36], [4.5, -34], [33, -37], [-14, -37], [20, -37.5], [-42, 2], [-44, -16], [42, -6], [-48, -34], [-42, 20], [42, 18]].filter(mine)
  palms.forEach(([x, z], i) => {
    add(palm(i + 1, 5.5 + (i % 3)), x, z)
    addFixed(RAPIER.ColliderDesc.cylinder(2, 0.3), { x, y: 2, z })
  })
  // Trees (green + yellow blossom).
  const trees = [[-44, -8, false], [-48, 8, true], [40, -22, true], [48, -2, false], [-40, -38, false], [24, -40, true], [-8, -40, false], [54, -36, true], [-60, -20, false]].filter(mine)
  trees.forEach(([x, z, y], i) => {
    add(tree(i + 3, y), x, z)
    addFixed(RAPIER.ColliderDesc.cylinder(1.5, 0.3), { x, y: 1.5, z })
  })
  // Bushes along the lot edges and the building corners.
  const bushes = [[-19.6, 3], [25.5, 5.9], [-19.6, 14], [5.4, 12], [12, 10], [24, 12], [-30, 9], [-33, 24], [26.5, 24.5], [32.5, -7], [32.5, -18], [-32.5, -16], [4, -24], [4, -30], [-32.5, -28], [-38, 4], [38, 2], [-40, -24], [40, -14]].filter(mine)
  bushes.forEach(([x, z], i) => add(bush(i + 11, 0.9 + (i % 3) * 0.2), x, z))
  // Planters with flowers at the lot corners.
  // Cacti and rocks out in the sand.
  const cacti = [[-52, 8], [-60, -12], [-48, -38], [58, 44], [64, -6], [44, -40], [18, -46], [-24, -46], [-66, 40], [70, 20]].filter(mine)
  cacti.forEach(([x, z], i) => add(cactus(i + 2), x, z, i))
  for (let i = 0; i < 26; i++) {
    const r = mulberry32(400 + i)
    const a = r() * Math.PI * 2
    const d = 50 + r() * 26
    if (!mine([Math.cos(a) * d, Math.sin(a) * d])) continue
    add(rock(i, 0.6 + r() * 1.2), Math.cos(a) * d, Math.sin(a) * d, r() * 3)
  }
  // Street lamps (lit at night).
  const lampSpots = [[-17.4, 24.8], [3.4, 24.8], [-17.4, 9.5], [3.4, 9.5], [-33.5, 2.5], [-33.5, 24.6], [17.2, 24.9], [-33, -20], [33, -20]]
  const lampBulbs = []
  for (const [x, z] of lampSpots) {
    const l = streetLamp()
    add(l.group, x, z, Math.PI / 2)
    addFixed(RAPIER.ColliderDesc.cylinder(3.75, 0.2), { x, y: 3.75, z })
    lighting?.addLamp(x, 6.8, z, l.bulb)
    lampBulbs.push(l.bulb)
  }
  // No parked cars here: guests' cars drive in and out of the lot (game/cars.js).
  // Mailbox by the monument, bus stop on the sidewalk.
  add(mailbox(), LAYOUT.monument.x + 5.2, LAYOUT.monument.z + 1.6, -0.3)
  addFixed(RAPIER.ColliderDesc.cylinder(0.8, 0.2), { x: LAYOUT.monument.x + 5.2, y: 0.8, z: LAYOUT.monument.z + 1.6 })
  const bs = busStop()
  add(bs, LAYOUT.busStop.x, LAYOUT.busStop.z + 0.4)
  solid(1.7, 1.2, 0.08, LAYOUT.busStop.x, 1.2, LAYOUT.busStop.z - 0.2)
  return { lampBulbs }
}

export function buildSite(scene, lighting) {
  const pool = buildPool(scene)
  const fountain = buildFountain(scene)
  const yard = buildYard(scene)
  const land = buildLandscape(scene, lighting)
  return { pool, fountain, yard, land }
}

export { RingGeometry }
