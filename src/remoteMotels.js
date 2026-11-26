// The other five motels on the road (src/plots.js), placed on the plots around the player's own and
// dressed from their owner's progress. The backend builds that from the owner's save (roster
// `motel`, backend src/motelView.ts): which rooms are open and their furniture, wallpaper and floor,
// the pool, the fountain, the junk yard and the rating, with the owner's name on the monument sign.
// A plot nobody stands on shows a fresh motel with "For Sale" on its sign. Looks only: no
// colliders, lamps, guests or game rules.
//
// Cost: a motel is thousands of small meshes and takes over a second to build, so the motel
// builders run ONCE, for a template that is never drawn. Its parts that never change are baked
// (bake.js, one mesh per look) and drawn for all five copies at once: one InstancedMesh per baked
// mesh, one instance per copy (a hidden instance is scaled to nothing), so the five cost the draw
// calls of one. Each copy is tested against the camera's view itself (an InstancedMesh is culled
// only as a whole): a copy out of view hides its instances, and a set no copy shows is not drawn. The parts that change are snapshots of the template:
//  - shared by all copies (instanced the same way): the pool closed / open, the fountain broken /
//    mended, each room's door boards (shown on closed rooms);
//  - per copy, re-baked when they change (at most one per frame): the furniture, wallpaper and
//    floor of every room (the template's rooms are dressed as that copy's, then baked), the junk
//    yard's remaining bags and junk;
//  - per copy, live: the room plates (their own canvases) and the three signs (built per copy).
// The rooms (interiors, doors, plates, furniture) are drawn only within PLOTS.detailRange of the
// camera.
import { Box3, Frustum, Group, InstancedMesh, Matrix4, Mesh, Vector3 } from 'three'
import { COARSE_POINTER, ECONOMY, LAYOUT, PLOTS, WORLD } from './config.js'
import { MOTEL } from './catalog.js'
import { withoutColliders } from './physics.js'
import { bakeMeshes } from './bake.js'
import { buildPlotGround } from './world.js'
import { buildMotel } from './motel/building.js'
import { buildSite } from './motel/site.js'
import { buildMonument, buildRoadSign, buildVacancyBoard } from './motel/signs.js'
import { canvasTex } from './motel/kit.js'
import { makePlate } from './motel/paint.js'
import { createRoomDecor } from './decor/room.js'
import { DEFAULT_FLOOR, DEFAULT_WALL, evaluate, itemById, typeFor } from './decor/rules.js'
import { plotCount, plotMatrix } from './plots.js'

const FOR_SALE = 'For Sale'
// Everything a copy draws, in its plot's frame (the plot up to the sidewalk, the tall signs).
const PLOT_BOX = new Box3(new Vector3(-WORLD.plot.x1, -2, WORLD.plot.z0 - 1), new Vector3(WORLD.plot.x1, 14, LAYOUT.sidewalk.z1))
const noop = () => {}
const noFx = new Proxy({}, { get: () => noop }) // the template never plays particles

// The view of a fresh motel (what a new player starts with).
const FRESH = { rooms: Object.fromEntries(MOTEL.roomsAtStart.map((n) => [n, { o: 1, f: [] }])), pool: 0, fountain: 0, rating: ECONOMY.startRating, bags: '', junk: '' }

export function parseView(text) {
  if (!text) return FRESH
  try {
    const v = JSON.parse(text)
    return v && typeof v === 'object' && v.rooms && typeof v.rooms === 'object' ? v : FRESH
  } catch {
    return FRESH
  }
}

// What a room's plate shows: its type and nightly price, from the furniture like the owner's game.
function roomLabel(number, st) {
  const items = (st?.f ?? []).filter((id) => itemById(id))
  const e = evaluate({ items, wall: st?.w ?? DEFAULT_WALL, floor: st?.l ?? DEFAULT_FLOOR })
  const comfort = ECONOMY.roomTypes.find((t) => t.id === 'comfort')?.minStars ?? 3
  const stars = Math.max(st?.m ? comfort : 0, e.stars)
  const type = typeFor(stars)
  const base = ECONOMY.basePrice?.[number - MOTEL.roomsAtStart[0]] ?? ECONOMY.basePrice?.at?.(-1) ?? 48
  return { typeName: type.name, price: base + e.furnNightly + type.priceAdd + e.styleNightly, items }
}

function shownIn(o, root) {
  for (let p = o; p && p !== root; p = p.parent) if (!p.visible) return false
  return true
}
function under(o, set, root) {
  for (let p = o; p && p !== root; p = p.parent) if (set.has(p)) return true
  return false
}
// The drawn meshes under `roots` (relative to the template root).
function meshesUnder(roots, root) {
  const out = []
  for (const r of roots) r.traverse((o) => o.isMesh && !o.isSkinnedMesh && shownIn(o, root) && out.push(o))
  return out
}
const finish = (g) => {
  g.traverse((o) => o.isMesh && (o.receiveShadow = true))
  return g
}
// A shared bake drawn for every copy: one InstancedMesh per baked mesh, instance i = copy i. A copy
// that should not show it gets a matrix scaled to nothing, parked on a shown copy, so each mesh's
// bounds cover only the copies that show it (three.js then culls it like a single mesh). A set
// nobody shows is not drawn at all.
const NOTHING = new Vector3(0, 0, 0)
const parked = new Matrix4()
function instancedSet(bake, count) {
  const group = new Group()
  group.name = 'remote-shared'
  const meshes = bake.children.filter((m) => m.isMesh).map((m) => {
    const im = new InstancedMesh(m.geometry, m.material, count)
    im.receiveShadow = true
    im.matrixAutoUpdate = false
    group.add(im)
    return im
  })
  const mats = Array.from({ length: count }, () => new Matrix4())
  const shown = new Array(count).fill(false)
  let dirty = true
  return {
    group,
    set(i, matrix, on) {
      mats[i].copy(matrix)
      shown[i] = on
      dirty = true
    },
    commit() {
      if (!dirty) return
      dirty = false
      const anchor = shown.indexOf(true)
      group.visible = anchor >= 0
      if (anchor < 0) return
      parked.copy(mats[anchor]).scale(NOTHING)
      for (const im of meshes) {
        for (let i = 0; i < count; i++) im.setMatrixAt(i, shown[i] ? mats[i] : parked)
        im.instanceMatrix.needsUpdate = true
        im.computeBoundingSphere()
      }
    },
  }
}
function disposeBake(g, materials = false) {
  if (!g) return
  g.removeFromParent()
  g.traverse((o) => {
    if (!o.isMesh) return
    o.geometry.dispose()
    if (materials) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m.name !== 'folded' && m.dispose()) // folded ones are shared
  })
}

// --- The template --------------------------------------------------------------------------------
function buildTemplate() {
  const root = new Group()
  const t = withoutColliders(() => {
    buildPlotGround(root)
    const before = root.children.length
    const motel = buildMotel(root) // adds its `live` group (rooms, office, laundry), then the baked shell
    const live = root.children[before]
    const site = buildSite(root, null)
    const decorGroup = new Group()
    root.add(decorGroup)
    const decor = new Map(motel.rooms.map((r) => [r.number, createRoomDecor(r, decorGroup, { fx: noFx, sfx: noop })]))
    return { motel, live, site, decor, decorGroup }
  })
  const lights = []
  root.traverse((o) => o.isLight && lights.push(o))
  for (const l of lights) l.removeFromParent()
  root.updateMatrixWorld(true)
  const { motel, live, site, decor, decorGroup } = t
  const rooms = motel.rooms

  // What changes per copy (never in the shared static bake).
  const plates = new Map() // number -> the plate mesh
  root.traverse((o) => {
    if (!o.isMesh) return
    const r = rooms.find((x) => o.material?.map === x.plate.tex)
    if (r) plates.set(r.number, o)
  })
  const furnitureRoots = [decorGroup, ...rooms.flatMap((r) => [r.interior.bed.group, ...Object.values(r.interior.furniture ?? {})])]
  const yardPieces = [...(site.yard.bags ?? []), ...(site.yard.junks ?? [])]
  const dynamic = new Set([...rooms.map((r) => r.boards), ...plates.values(), ...furnitureRoots, site.pool.group, site.fountain.group, ...yardPieces])

  // The static parts, baked once: the shell (always drawn) and the rooms (drawn near the camera).
  const shell = []
  const inside = []
  const liveSet = new Set([live])
  root.traverse((o) => {
    if (!o.isMesh || o.isSkinnedMesh || !shownIn(o, root) || under(o, dynamic, root)) return
    ;(under(o, liveSet, root) ? inside : shell).push(o)
  })
  const bake = (meshes, opts) => finish(bakeMeshes(meshes, root, false, { coarse: true, fold: true, ...opts }))
  const statics = { shell: bake(shell), rooms: bake(inside) }

  // Shared snapshots of two-state parts (their materials copied: the template changes them later).
  const snap = (roots) => bake(meshesUnder(roots, root), { cloneMaterials: true })
  const pool = { closed: snap([site.pool.group]) }
  site.pool.open()
  site.pool.update(10, 0)
  root.updateMatrixWorld(true)
  pool.open = snap([site.pool.group])
  site.pool.close()
  const fountain = { broken: snap([site.fountain.group]) }
  site.fountain.fix()
  site.fountain.update(10, 0)
  root.updateMatrixWorld(true)
  fountain.fixed = snap([site.fountain.group])
  site.fountain.unfix()
  const boards = new Map(rooms.map((r) => [r.number, snap([r.boards])]))
  const plateBakes = new Map([...plates].map(([n, m]) => [n, { geometry: bakeMeshes([m], root).children[0]?.geometry, material: m.material }]))

  return {
    statics,
    pool,
    fountain,
    boards,
    plateBakes,
    // Per-copy snapshots: the template dressed as the copy, then baked.
    furniture(v) {
      for (const r of rooms) {
        const st = v.rooms?.[r.number]
        decor.get(r.number)?.apply({ items: roomLabel(r.number, st).items, wall: st?.w ?? DEFAULT_WALL, floor: st?.l ?? DEFAULT_FLOOR }, false)
        r.interior.bed.set('made')
      }
      root.updateMatrixWorld(true)
      return bake(meshesUnder(furnitureRoots, root), { cloneMaterials: true })
    },
    yard(v) {
      const flags = [String(v.bags ?? ''), String(v.junk ?? '')]
      const nBags = (site.yard.bags ?? []).length
      const keep = yardPieces.filter((o, i) => (i < nBags ? flags[0][i] : flags[1][i - nBags]) !== '1')
      return bake(meshesUnder(keep, root))
    },
    setNight: (k) => motel.setNight(k), // the bulbs' materials are shared with every copy's bake
  }
}

// --- A copy ------------------------------------------------------------------------------------------
// A copy's own parts: plates, signs, furniture and yard (the shared parts are instanced).
function buildCopy(T) {
  const root = new Group()
  root.name = 'remote-motel'
  root.matrixAutoUpdate = false
  const near = new Group() // drawn only near the camera
  root.add(near)
  const plates = new Map()
  for (const [n, p] of T.plateBakes) {
    if (!p.geometry) continue
    const plate = makePlate()
    const mat = p.material.clone()
    mat.map = canvasTex(plate.canvas)
    near.add(new Mesh(p.geometry, mat))
    plates.set(n, { draw: plate.draw, tex: mat.map })
  }
  const signGroup = new Group()
  const signs = withoutColliders(() => ({ road: buildRoadSign(signGroup), monument: buildMonument(signGroup, FOR_SALE), board: buildVacancyBoard(signGroup) }))
  const lights = []
  signGroup.traverse((o) => o.isLight && lights.push(o))
  for (const l of lights) l.removeFromParent()
  // Baked too (the canvases and the chasing bulbs' materials stay live; no shadows).
  const signMeshes = meshesUnder([signGroup], signGroup)
  const signBake = finish(bakeMeshes(signMeshes, signGroup))
  for (const m of signMeshes) m.visible = false
  signGroup.add(signBake)
  root.add(signGroup)
  return { root, near, plates, signs, furniture: null, yard: null, plot: -1, centre: new Vector3(), bounds: new Box3(), isNear: true, inView: true, have: {}, want: { view: FRESH }, look: null, shownKey: null }
}

const KEYS = {
  furniture: (v) => JSON.stringify(Object.entries(v.rooms ?? {}).map(([n, r]) => [n, r?.f, r?.w, r?.l])),
  yard: (v) => `${v.bags ?? ''}|${v.junk ?? ''}`,
}

// The cheap parts: canvases repainted (the shared parts follow in showShared).
function dressNow(c, v, name) {
  let hasRoom = false
  for (const [n, p] of c.plates) {
    const st = v.rooms?.[n]
    if (st?.o) hasRoom = true
    const key = JSON.stringify(st ?? null)
    if (p.key !== key) {
      p.key = key
      const label = roomLabel(n, st)
      p.draw({ number: n, typeName: label.typeName, price: label.price, state: st?.o ? 'ready' : 'locked' })
      p.tex.needsUpdate = true
    }
  }
  c.signs.road.setVacancy(hasRoom)
  c.signs.board.setVacancy(hasRoom)
  const look = `${name}|${v.rating}`
  if (look !== c.look) {
    c.look = look
    c.signs.monument.set(name, Number(v.rating) || ECONOMY.startRating)
  }
}

export function createRemoteMotels(scene) {
  let T = null
  let shared = null // the instanced sets
  const copies = [] // one per other plot (mine excluded)
  let mine = -1
  let night = 0
  const frustum = new Frustum()
  const viewProj = new Matrix4()

  // Which shared parts copy i shows (where, near the camera or not, pool, fountain, open rooms).
  function showShared(i) {
    const c = copies[i]
    const v = c.want.view
    const key = `${c.root.matrix.elements.join(',')}|${c.inView}|${c.isNear}|${v.pool ? 1 : 0}${v.fountain ? 1 : 0}|${Object.entries(v.rooms ?? {}).filter(([, r]) => r?.o).map(([n]) => n)}`
    if (key === c.shownKey) return
    c.shownKey = key
    const m = c.root.matrix
    const on = c.inView
    const near = on && c.isNear
    shared.shell.set(i, m, on)
    shared.rooms.set(i, m, near)
    shared.poolOpen.set(i, m, on && !!v.pool)
    shared.poolClosed.set(i, m, on && !v.pool)
    shared.fountainFixed.set(i, m, on && !!v.fountain)
    shared.fountainBroken.set(i, m, on && !v.fountain)
    for (const [n, b] of shared.boards) b.set(i, m, near && !v.rooms?.[n]?.o)
  }
  const eachSet = (fn) => {
    for (const [k, set] of Object.entries(shared)) if (k !== 'boards') fn(set)
    for (const set of shared.boards.values()) fn(set)
  }

  // One per-copy snapshot re-baked (the first that is out of date). False = all done.
  function step() {
    for (const c of copies) {
      const v = c.want.view
      if (c.want.furniture !== c.have.furniture) {
        disposeBake(c.furniture, true)
        c.furniture = T.furniture(v)
        c.near.add(c.furniture)
        c.have.furniture = c.want.furniture
        return true
      }
      if (c.want.yard !== c.have.yard) {
        disposeBake(c.yard)
        c.yard = T.yard(v)
        c.root.add(c.yard)
        c.have.yard = c.want.yard
        return true
      }
    }
    return false
  }

  function place() {
    const others = []
    for (let k = 0; k < plotCount; k++) if (k !== mine) others.push(k)
    others.forEach((k, i) => {
      const c = copies[i]
      c.plot = k
      plotMatrix(k, mine, c.root.matrix)
      c.root.matrixWorldNeedsUpdate = true
      c.centre.set(0, 0, -6).applyMatrix4(c.root.matrix) // the building's front, the camera's yardstick
      c.bounds.copy(PLOT_BOX).applyMatrix4(c.root.matrix)
      showShared(i)
    })
  }

  const api = {
    // The plot this client plays on (the server's answer; 0 before it): the copies take the rest.
    // The first call builds the template and all five copies (it runs during loading).
    setPlot(k) {
      if (k === mine || k < 0 || k >= plotCount) return
      const first = !copies.length
      if (first) {
        T = buildTemplate()
        const n = plotCount - 1
        shared = {
          shell: instancedSet(T.statics.shell, n),
          rooms: instancedSet(T.statics.rooms, n),
          poolOpen: instancedSet(T.pool.open, n),
          poolClosed: instancedSet(T.pool.closed, n),
          fountainFixed: instancedSet(T.fountain.fixed, n),
          fountainBroken: instancedSet(T.fountain.broken, n),
          boards: new Map([...T.boards].map(([num, b]) => [num, instancedSet(b, n)])),
        }
        eachSet((set) => scene.add(set.group))
        for (let i = 0; i < n; i++) {
          const c = buildCopy(T)
          copies.push(c)
          scene.add(c.root)
        }
      }
      mine = k
      place()
      if (first) {
        api.sync(new Map())
        while (step());
      }
      eachSet((set) => set.commit())
    },
    get plot() {
      return mine
    },
    // owners: Map plot -> { name, motel (view JSON) } of the players in the room.
    sync(owners) {
      copies.forEach((c, i) => {
        const o = owners.get(c.plot)
        const v = o ? parseView(o.motel) : FRESH
        c.want = { view: v, furniture: KEYS.furniture(v), yard: KEYS.yard(v) }
        dressNow(c, v, o?.name || FOR_SALE)
        showShared(i)
      })
    },
    update(dt, t, camera, isNight) {
      if (!T) return
      step() // at most one snapshot re-baked per frame
      night += ((isNight ? 1 : 0) - night) * Math.min(1, dt * 0.5)
      T.setNight(night)
      const cam = camera.position
      camera.updateMatrixWorld()
      viewProj.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse)
      frustum.setFromProjectionMatrix(viewProj)
      copies.forEach((c, i) => {
        const d = Math.hypot(c.centre.x - cam.x, c.centre.z - cam.z)
        const near = d < (COARSE_POINTER ? PLOTS.detailRangeTouch : PLOTS.detailRange)
        const inView = frustum.intersectsBox(c.bounds)
        if (near !== c.isNear || inView !== c.inView) {
          c.near.visible = c.isNear = near
          c.root.visible = c.inView = inView
          showShared(i)
        }
        if (d < PLOTS.updateRange) c.signs.road.update(dt, t) // chasing bulbs (material colours)
      })
      eachSet((set) => set.commit())
    },
    copies,
  }
  return api
}
