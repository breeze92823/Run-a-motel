// One guest room's furnishing in the scene: the wallpaper / wainscot / floor overlays
// (per-room materials laid just in front of the shared, baked linings), a fixed anchor
// per furniture slot, the furniture objects themselves (the room's own fridge / TV / vanity
// and bed are reused, the rest are made here), their colliders, and the animations:
// furniture drops in with a squash-and-bounce and a dust ring, old pieces pop out, new
// wallpaper is rolled on from the floor up, a new floor unrolls from the west wall.
import { Box3, CylinderGeometry, Group, Mesh, MeshStandardMaterial, PlaneGeometry, Quaternion, Shape, ShapeGeometry, Vector3 } from 'three'
import { LAYOUT } from '../config.js'
import { RAPIER, addFixed, world } from '../physics.js'
import { DOOR_H, DOOR_W, FLOOR_Y } from '../motel/rooms.js'
import { bySlot, floorById, itemById, wallById, DEFAULT_FLOOR, DEFAULT_WALL } from './rules.js'
import { BED_OVERLAYS, makeItem } from './models.js'
import { bandTex, floorTex, wallTex } from './paint.js'

const FH = LAYOUT.building.floorH
const CEIL = FH - 0.14 // just under the ceiling slab
const BAND_TOP = FLOOR_Y + 1.05
const WALL_TILE = 1.6
const FLOOR_TILE = 1.4
const BUILT_IN = new Set(['fridge', 'tv', 'vanity'])
const SOLID_SLOTS = new Set(['seat', 'table', 'storage', 'machine', 'tub', 'plant', 'fan', 'night'])
const easeOut = (k) => 1 - Math.pow(1 - k, 3)

// Slot anchors in room-local metres: u = x - bounds.x0, v = z - bounds.z0 (front wall at
// v = depth). yaw turns the model's +Z front; y lifts it (wall art).
function anchors(W, D) {
  const bathX = W - 2.5 // bathroom alcove's west wall
  return {
    night: { u: 0.32, v: 6.62, yaw: Math.PI / 2 },
    lampFloor: { u: 0.32, v: 3.85, yaw: Math.PI / 2 },
    storage: { u: 1.55, v: 0.34, yaw: 0 },
    seat: { u: 3.4, v: 7.55, yaw: Math.PI / 2 },
    table: { u: 4.6, v: 7.55, yaw: -Math.PI / 2 },
    gadgetFloor: { u: 2.65, v: D - 0.35, yaw: Math.PI },
    fan: { u: W - 0.45, v: 3.2, yaw: -Math.PI / 2 - 0.5 },
    machine: { u: W - 0.48, v: 7.6, yaw: -Math.PI / 2 },
    tv: { u: W - 0.32, v: 5.5, yaw: -Math.PI / 2 },
    art: { u: 0.075, v: 5.3, y: FLOOR_Y + 1.95, yaw: Math.PI / 2 },
    rug: { u: 3.1, v: 5.0, yaw: Math.PI / 2 },
    plant: { u: W - 0.5, v: D - 0.65, yaw: Math.PI },
    tub: { u: bathX + 0.48, v: 0.93, yaw: Math.PI / 2 },
  }
}
// Top surfaces things sit on (lamp on the nightstand, radio on a table).
const TOP = { nightstand: 0.57, sideTable: 0.625, desk: 0.77, coffeeTable: 0.465 }

export function createRoomDecor(roomEntry, parent, { fx, sfx }) {
  const I = roomEntry.interior
  const b = I.bounds
  const W = b.x1 - b.x0
  const D = b.z1 - b.z0
  const A = anchors(W, D)
  const bx0 = b.x1 - 2.5
  const bz1 = b.z0 + 2.7
  const doorC = bx0 + 1.3
  const dw = 0.95
  const doorX = roomEntry.doorX
  const winX = roomEntry.cx + 1.2
  const group = new Group()
  group.name = `decor-${roomEntry.number}`
  parent.add(group)
  const toWorld = (u, v, y = FLOOR_Y) => new Vector3(b.x0 + u, y, b.z0 + v)

  // --- Wall + floor overlays ---------------------------------------------------------------------
  const wallMat = new MeshStandardMaterial({ roughness: 0.95, polygonOffset: true, polygonOffsetFactor: -1 })
  const bandMat = new MeshStandardMaterial({ roughness: 0.6, polygonOffset: true, polygonOffsetFactor: -1 })
  const floorMat = new MeshStandardMaterial({ roughness: 1, polygonOffset: true, polygonOffsetFactor: -1 })
  const panels = [] // { mesh, band }
  // A flat panel from (a0..a1) along a wall, y0..y1, growing up from y0 (origin at its bottom).
  function panel(axis, a0, a1, y0, y1, at, facing, band) {
    const w = a1 - a0
    const h = y1 - y0
    const geo = new PlaneGeometry(w, h)
    geo.translate(0, h / 2, 0)
    const uv = geo.attributes.uv
    for (let i = 0; i < uv.count; i++) uv.setXY(i, ((a0 + uv.getX(i) * w) / WALL_TILE), band ? uv.getY(i) : (y0 + uv.getY(i) * h) / WALL_TILE)
    const m = new Mesh(geo, band ? bandMat : wallMat)
    m.receiveShadow = true
    if (axis === 'x') {
      m.position.set((a0 + a1) / 2, y0, at)
      m.rotation.y = facing > 0 ? 0 : Math.PI
    } else {
      m.position.set(at, y0, (a0 + a1) / 2)
      m.rotation.y = facing > 0 ? Math.PI / 2 : -Math.PI / 2
    }
    group.add(m)
    panels.push({ mesh: m, band, h })
    return m
  }
  // Upper wallpaper sits 0.02 in front of the lining, the band 0.052 (in front of the boards).
  const UP = 0.022
  const BAND = 0.052
  // West wall (x = x0, facing +x) and east wall north of the bathroom (x = x1, facing -x).
  const wallsZ = [
    [b.z0, b.z1, b.x0 + 0.005, 1],
    [bz1 + 0.075, b.z1, b.x1 - 0.005, -1],
    [b.z0, bz1, bx0 - 0.075, -1], // bathroom alcove's outer west face
  ]
  for (const [z0, z1, x, f] of wallsZ) {
    panel('z', z0, z1, BAND_TOP, CEIL, x + f * UP, f, false)
    panel('z', z0, z1, FLOOR_Y, BAND_TOP, x + f * BAND, f, true)
  }
  // Back wall west of the bathroom (z = z0, facing +z) and the bathroom's front face.
  const wallsX = [
    [b.x0, bx0 - 0.07, b.z0 + 0.005, 1],
    [bx0 - 0.07, doorC - dw / 2, bz1 + 0.075, 1],
    [doorC + dw / 2, b.x1, bz1 + 0.075, 1],
  ]
  for (const [x0, x1, z, f] of wallsX) {
    panel('x', x0, x1, BAND_TOP, CEIL, z + f * UP, f, false)
    panel('x', x0, x1, FLOOR_Y, BAND_TOP, z + f * BAND, f, true)
  }
  panel('x', doorC - dw / 2, doorC + dw / 2, 2.36, CEIL, bz1 + 0.075 + UP + 0.01, 1, false)
  // Front wall (z = z1, facing -z): panels round the door and window openings.
  {
    const dL = doorX - DOOR_W / 2 - 0.1
    const dR = doorX + DOOR_W / 2 + 0.1
    const wL = winX - 1.05
    const wR = winX + 1.05
    const z = b.z1 - 0.02 - UP
    for (const [x0, x1, y0] of [[b.x0, dL, BAND_TOP], [dR, wL, BAND_TOP], [wR, b.x1, BAND_TOP], [dL, dR, FLOOR_Y + DOOR_H + 0.1], [wL, wR, 2.45]]) panel('x', x0, x1, y0, CEIL, z, -1, false)
    panel('x', b.x0, dL, FLOOR_Y, BAND_TOP, b.z1 - 0.04 - BAND, -1, true)
    panel('x', dR, b.x1, FLOOR_Y, BAND_TOP, b.z1 - 0.04 - BAND, -1, true)
  }
  // Floor: an L that skips the tiled bathroom. Local origin at the west wall so it can unroll.
  const floor = (() => {
    const s = new Shape()
    const pts = [[0, 0], [bx0 - 0.07 - b.x0, 0], [bx0 - 0.07 - b.x0, bz1 + 0.07 - b.z0], [W, bz1 + 0.07 - b.z0], [W, D], [0, D]]
    pts.forEach(([u, v], i) => (i ? s.lineTo(u, -v) : s.moveTo(u, -v)))
    s.closePath()
    const geo = new ShapeGeometry(s)
    const uv = geo.attributes.uv
    const pos = geo.attributes.position
    for (let i = 0; i < uv.count; i++) uv.setXY(i, (b.x0 + pos.getX(i)) / FLOOR_TILE, (b.z0 - pos.getY(i)) / FLOOR_TILE)
    const m = new Mesh(geo, floorMat)
    m.rotation.x = -Math.PI / 2
    m.position.set(b.x0, FLOOR_Y + 0.008, b.z0)
    m.receiveShadow = true
    group.add(m)
    return m
  })()

  // --- Furniture --------------------------------------------------------------------------------
  const builtIn = { fridge: I.furniture.fridge, tv: I.furniture.tv, vanity: I.furniture.vanity }
  for (const o of Object.values(builtIn)) o.userData.rest = { y: o.position.y, s: o.scale.x }
  const bed = I.bed
  const overlays = {}
  for (const [id, make] of Object.entries(BED_OVERLAYS)) {
    const o = make()
    o.visible = false
    bed.group.add(o)
    overlays[id] = o
  }
  let bedVariant = null
  let bedState = 'made'
  const baseSet = bed.set
  bed.set = (state) => {
    bedState = state
    baseSet(state, bedVariant === 'bed')
    for (const [id, o] of Object.entries(overlays)) {
      o.visible = bedVariant === id
      if (o.userData.made) o.userData.made.visible = state === 'made'
    }
  }
  const placed = {} // slot -> { id, obj, collider }
  const anims = []

  function anchorFor(slot, id, slots) {
    if (slot === 'lamp') {
      if (id === 'tableLamp' && slots.night) return { ...A.night, y: FLOOR_Y + TOP.nightstand }
      if (id === 'tableLamp' && slots.table) return { u: A.table.u + 0.25, v: A.table.v - 0.2, yaw: 0, y: FLOOR_Y + TOP[slots.table] }
      return A.lampFloor
    }
    if (slot === 'gadget') {
      if (slots.table) return { u: A.table.u - 0.1, v: A.table.v + 0.12, yaw: -Math.PI / 2, y: FLOOR_Y + TOP[slots.table] }
      return A.gadgetFloor
    }
    return A[slot]
  }
  function place(obj, a) {
    const p = toWorld(a.u, a.v, a.y ?? FLOOR_Y)
    obj.position.copy(p)
    obj.rotation.set(0, a.yaw ?? 0, 0)
    obj.userData.rest = { y: p.y, s: 1 }
  }
  const box3 = new Box3()
  const size = new Vector3()
  const centre = new Vector3()
  function addCollider(obj) {
    const yaw = obj.rotation.y
    obj.rotation.y = 0
    obj.updateMatrixWorld(true)
    box3.setFromObject(obj)
    obj.rotation.y = yaw
    obj.updateMatrixWorld(true)
    box3.getSize(size)
    box3.getCenter(centre)
    const q = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), yaw)
    const off = centre.sub(obj.position).applyQuaternion(q)
    return addFixed(RAPIER.ColliderDesc.cuboid(Math.max(0.05, size.x / 2 - 0.04), Math.max(0.05, size.y / 2), Math.max(0.05, size.z / 2 - 0.04)), { x: obj.position.x + off.x, y: obj.position.y + size.y / 2, z: obj.position.z + off.z }, q)
  }
  function dropColliders(p) {
    if (p?.collider && world) world.removeCollider(p.collider, true)
    if (p) p.collider = null
  }

  // A piece falls in from above: stretch while falling, squash on landing, settle.
  function dropIn(obj, onLand) {
    const rest = obj.userData.rest ?? { y: obj.position.y, s: 1 }
    anims.push({ kind: 'drop', obj, t: 0, rest, yaw: obj.rotation.y, onLand })
    obj.position.y = rest.y + 2.4
    obj.visible = true
  }
  function popOut(obj, done) {
    anims.push({ kind: 'pop', obj, t: 0, rest: obj.userData.rest ?? { y: obj.position.y, s: 1 }, done })
  }

  function setItem(slot, id, animate = false, slots = {}) {
    const prev = placed[slot]
    if (prev?.id === id) return
    // Out with the old piece.
    if (prev) {
      dropColliders(prev)
      if (slot === 'bed') {
        if (overlays[prev.id] && animate) {
          const o = overlays[prev.id]
          popOut(o, () => (o.scale.setScalar(1)))
        }
      } else if (BUILT_IN.has(prev.id)) {
        const o = builtIn[prev.id]
        if (animate) popOut(o, () => (o.visible = false, o.scale.setScalar(o.userData.rest.s)))
        else o.visible = false
      } else if (prev.obj) {
        const o = prev.obj
        if (animate) popOut(o, () => group.remove(o))
        else group.remove(o)
      }
      if (animate) {
        const w = prev.obj ? prev.obj.position : worldOf(slot)
        fx?.sparkle(w.x, w.y + 0.6, w.z, 10, '#ffffff')
      }
      delete placed[slot]
    }
    if (!id) {
      if (slot === 'bed') setBed(null, animate)
      return
    }
    // In with the new one.
    if (slot === 'bed') {
      setBed(id, animate)
      placed.bed = { id, obj: null }
      return
    }
    let obj
    if (BUILT_IN.has(id)) {
      obj = builtIn[id]
      obj.visible = true
    } else {
      obj = makeItem(id)
      place(obj, anchorFor(slot, id, slots))
      obj.traverse((m) => {
        if (m.isMesh) {
          m.castShadow = m.castShadow !== false
          m.receiveShadow = true
        }
      })
      group.add(obj)
    }
    const entry = { id, obj, collider: null }
    placed[slot] = entry
    if (SOLID_SLOTS.has(slot) && !BUILT_IN.has(id)) entry.collider = addCollider(obj)
    if (animate) dropIn(obj, () => land(obj, slot))
  }
  function setBed(id, animate) {
    bedVariant = id
    bed.set(bedState)
    if (animate && id) {
      const o = overlays[id] ?? bed.group
      if (overlays[id]) {
        o.userData.rest = { y: 0, s: 1 }
        dropIn(o, () => land(bed.group, 'bed'))
      } else {
        anims.push({ kind: 'squash', obj: bed.group, t: 0, rest: { y: bed.group.position.y, s: 1 } })
        land(bed.group, 'bed')
      }
    }
  }
  function land(obj, slot) {
    const p = slot === 'bed' ? toWorld(1.2, 5.3) : obj.position
    fx?.poof(p.x, p.y, p.z)
    fx?.dust(p.x, p.y + 0.05, p.z, 14, '#fff3dc', 1.2)
    sfx?.('land', p)
  }
  // Re-seats things that sit on other things (lamp on the nightstand, radio on the table).
  function relayout(slots) {
    for (const slot of ['lamp', 'gadget']) {
      const p = placed[slot]
      if (!p?.obj) continue
      const a = anchorFor(slot, p.id, slots)
      const to = toWorld(a.u, a.v, a.y ?? FLOOR_Y)
      if (to.distanceTo(p.obj.position) < 0.01) continue
      anims.push({ kind: 'hop', obj: p.obj, t: 0, from: p.obj.position.clone(), to, yaw: a.yaw ?? 0 })
      p.obj.userData.rest = { y: to.y, s: 1 }
    }
  }

  // --- Walls + floor ------------------------------------------------------------------------------
  let wallId = null
  let floorId = null
  function setWall(id, animate = false) {
    const w = wallById(id)
    if (wallId === w.id) return
    wallId = w.id
    const wt = wallTex(w)
    const bt = bandTex(w)
    if (!animate || !wallMat.map) {
      wallMat.map = wt
      bandMat.map = bt
      wallMat.needsUpdate = bandMat.needsUpdate = true
      return
    }
    // A wet coat rolls up each panel; the old paper is swapped underneath at the end.
    const coatWall = wallMat.clone()
    const coatBand = bandMat.clone()
    coatWall.map = wt
    coatBand.map = bt
    coatWall.polygonOffsetFactor = coatBand.polygonOffsetFactor = -3
    const coats = panels.map(({ mesh, band }) => {
      const c = new Mesh(mesh.geometry, band ? coatBand : coatWall)
      c.position.copy(mesh.position)
      c.rotation.copy(mesh.rotation)
      c.scale.set(1, 0.001, 1)
      group.add(c)
      return { c, band }
    })
    anims.push({ kind: 'paint', t: 0, coats, color: w.paint.fg, band: w.paint.band, done: () => {
      wallMat.map = wt
      bandMat.map = bt
      wallMat.needsUpdate = bandMat.needsUpdate = true
      for (const { c } of coats) group.remove(c)
      coatWall.dispose()
      coatBand.dispose()
    } })
  }
  function setFloor(id, animate = false) {
    const f = floorById(id)
    if (floorId === f.id) return
    floorId = f.id
    const ft = floorTex(f)
    if (!animate || !floorMat.map) {
      floorMat.map = ft
      floorMat.needsUpdate = true
      return
    }
    // The new floor unrolls from the west wall, a carpet roll riding its leading edge.
    const coatMat = floorMat.clone()
    coatMat.map = ft
    coatMat.polygonOffsetFactor = -2
    const coat = new Mesh(floor.geometry, coatMat)
    coat.rotation.copy(floor.rotation)
    coat.position.copy(floor.position)
    coat.position.y += 0.002
    coat.scale.set(0.001, 1, 1)
    group.add(coat)
    const roll = new Mesh(new CylinderGeometry(0.22, 0.22, D, 18), new MeshStandardMaterial({ map: ft, roughness: 1 }))
    roll.rotation.x = Math.PI / 2
    roll.position.set(b.x0, FLOOR_Y + 0.22, b.z0 + D / 2)
    roll.castShadow = true
    group.add(roll)
    anims.push({ kind: 'unroll', t: 0, coat, roll, color: f.paint.bg, done: () => {
      floorMat.map = ft
      floorMat.needsUpdate = true
      group.remove(coat)
      group.remove(roll)
      coatMat.dispose()
      roll.geometry.dispose()
      roll.material.dispose()
    } })
  }

  // --- State ----------------------------------------------------------------------------------------
  // state = { items: [ids in use], wall, floor }
  let current = { items: [], wall: null, floor: null }
  function apply(state, animate = false) {
    const slots = bySlot(state.items ?? [])
    const was = bySlot(current.items)
    const all = new Set([...Object.keys(slots), ...Object.keys(was), 'bed'])
    // Surfaces first so a lamp can land on a nightstand placed in the same step.
    for (const slot of ['night', 'table', ...[...all].filter((s) => s !== 'night' && s !== 'table')]) {
      if (!all.has(slot)) continue
      if ((slots[slot] ?? null) !== (placed[slot]?.id ?? null) || (slot === 'bed' && (slots.bed ?? null) !== bedVariant)) setItem(slot, slots[slot] ?? null, animate, slots)
    }
    relayout(slots)
    setWall(state.wall ?? DEFAULT_WALL, animate)
    setFloor(state.floor ?? DEFAULT_FLOOR, animate)
    current = { items: Object.values(slots), wall: wallId, floor: floorId }
  }

  function worldOf(slot) {
    if (slot === 'bed') return toWorld(1.2, 5.3, FLOOR_Y + 0.6)
    if (slot === 'wall') return toWorld(W / 2, D / 2, FLOOR_Y + 1.6)
    if (slot === 'floor') return toWorld(W / 2, D / 2, FLOOR_Y)
    const p = placed[slot]
    if (p?.obj) return p.obj.position.clone()
    const a = A[slot] ?? A.night
    return toWorld(a.u, a.v, a.y ?? FLOOR_Y)
  }

  // --- Per frame ------------------------------------------------------------------------------------
  let sparkT = 0
  function update(t, dt, night = 0) {
    for (let i = anims.length - 1; i >= 0; i--) {
      const a = anims[i]
      a.t += dt
      if (a.kind === 'drop') {
        const fall = 0.42
        const o = a.obj
        if (a.t < fall) {
          const k = a.t / fall
          o.position.y = a.rest.y + 2.4 * (1 - k * k)
          o.scale.set(a.rest.s * 0.9, a.rest.s * 1.14, a.rest.s * 0.9)
          o.rotation.y = a.yaw + (1 - k) * 0.7
        } else {
          if (!a.landed) {
            a.landed = true
            a.onLand?.()
          }
          const k = Math.min(1, (a.t - fall) / 0.5)
          const sq = Math.sin(k * Math.PI * 2.5) * (1 - k) * 0.22
          o.position.y = a.rest.y + Math.max(0, Math.sin(k * Math.PI * 2) * (1 - k) * 0.12)
          o.scale.set(a.rest.s * (1 + sq), a.rest.s * (1 - sq), a.rest.s * (1 + sq))
          o.rotation.y = a.yaw
          if (k >= 1) {
            o.position.y = a.rest.y
            o.scale.setScalar(a.rest.s)
            anims.splice(i, 1)
          }
        }
      } else if (a.kind === 'pop') {
        const k = Math.min(1, a.t / 0.32)
        const s = k < 0.35 ? 1 + (k / 0.35) * 0.18 : 1.18 * (1 - (k - 0.35) / 0.65)
        a.obj.scale.setScalar(a.rest.s * Math.max(0.001, s))
        a.obj.rotation.y += dt * 9
        if (k >= 1) {
          a.done?.()
          anims.splice(i, 1)
        }
      } else if (a.kind === 'squash') {
        const k = Math.min(1, a.t / 0.6)
        const sq = Math.sin(k * Math.PI * 3) * (1 - k) * 0.12
        a.obj.scale.set(1 + sq, 1 - sq, 1 + sq)
        if (k >= 1) {
          a.obj.scale.setScalar(1)
          anims.splice(i, 1)
        }
      } else if (a.kind === 'hop') {
        const k = Math.min(1, a.t / 0.35)
        a.obj.position.lerpVectors(a.from, a.to, easeOut(k))
        a.obj.position.y += Math.sin(k * Math.PI) * 0.4
        a.obj.rotation.y = a.yaw
        if (k >= 1) anims.splice(i, 1)
      } else if (a.kind === 'paint') {
        const dur = 1.1
        let allDone = true
        a.coats.forEach(({ c, band }, j) => {
          const k = Math.min(1, Math.max(0, (a.t - j * 0.05 - (band ? 0 : 0.25)) / dur))
          if (k < 1) allDone = false
          c.scale.y = Math.max(0.001, easeOut(k))
        })
        sparkT -= dt
        if (sparkT <= 0) {
          sparkT = 0.06
          const k = easeOut(Math.min(1, a.t / (dur + 0.25)))
          const y = FLOOR_Y + k * (CEIL - FLOOR_Y)
          const side = Math.floor(Math.random() * 4)
          const p = side === 0 ? toWorld(0.1, Math.random() * D, y) : side === 1 ? toWorld(W - 0.1, 3 + Math.random() * (D - 3), y) : side === 2 ? toWorld(Math.random() * (W - 2.6), 0.1, y) : toWorld(Math.random() * W, D - 0.12, y)
          fx?.sparkle(p.x, p.y, p.z, 3, a.color)
          if (Math.random() < 0.5) fx?.dust(p.x, p.y, p.z, 2, a.band, 0.3)
        }
        if (allDone) {
          a.done()
          anims.splice(i, 1)
        }
      } else if (a.kind === 'unroll') {
        const k = Math.min(1, a.t / 1.0)
        const e = easeOut(k)
        a.coat.scale.x = Math.max(0.001, e)
        a.roll.position.x = b.x0 + e * W
        a.roll.rotation.y = 0
        a.roll.rotation.z = -e * 12
        const r = 0.22 * (1 - e) + 0.04
        a.roll.scale.set(r / 0.22, 1, r / 0.22)
        a.roll.position.y = FLOOR_Y + r
        if (Math.random() < 0.5) fx?.dust(a.roll.position.x, FLOOR_Y + 0.05, b.z0 + Math.random() * D, 2, a.color, 0.4)
        if (k >= 1) {
          a.done()
          anims.splice(i, 1)
        }
      }
    }
    // Idle animations of the pieces in use; lamp shades glow brighter at night.
    for (const p of Object.values(placed)) {
      const o = p.obj
      if (!o?.visible) continue
      o.userData.anim?.(t, dt)
      if (o.userData.glow) o.userData.glow.emissiveIntensity = 0.35 + night * 1.4
    }
    for (const o of Object.values(overlays)) if (o.visible) o.userData.anim?.(t, dt)
  }

  return {
    number: roomEntry.number,
    group,
    bounds: b,
    centre: toWorld(W / 2, D / 2),
    size: { w: W, d: D },
    apply,
    get state() {
      return current
    },
    worldOf,
    update,
    busy: () => anims.length > 0,
  }
}
