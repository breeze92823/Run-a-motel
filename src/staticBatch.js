// Static batching for the player's own motel: the many small meshes that are not changing right now
// are merged (bake.js, exact: one mesh per material object, plain colours folded into vertex
// colours) into chunks of the map, so a frame and its shadow pass draw a few hundred meshes instead
// of thousands. Nothing has to be declared static:
//  - Every visible, opaque, plain mesh under the given roots joins the chunk of its map cell (cells
//    keep frustum culling useful); its original waits on a layer no camera draws (HIDDEN) while the
//    game keeps changing it as before. The roots are scanned again every SCAN_EVERY s, so what the
//    game adds later (furniture, litter, food) joins too.
//  - Every frame a slice of the members (all of the `watch`ed ones: known movers such as doors and
//    beds) is compared with what was merged: world matrix, visibility (the whole parent chain),
//    material (and a folded material's colour etc.), geometry, castShadow. One that changed is drawn
//    by itself at once and its chunk re-merges (one chunk per frame).
//  - A piece left alone for SETTLE s (a door shut again, a bed made) is merged again.
// Merged meshes keep their materials, so material changes (night glow, chasing bulbs) still show.
// Shadows: a shadow map only needs shapes, so each chunk's casters also become shadow proxies, one
// mesh per material side (positions only). A proxy's main-pass draw is cancelled before it is
// issued (onBeforeRender sets a negative draw range; three.js then skips the draw), so it is drawn
// only into the shadow map, where the colours never mattered. The visible merged meshes cast none.
import { BackSide, BufferGeometry, DoubleSide, FrontSide, Group, Matrix4, Mesh, MeshBasicMaterial, Vector3 } from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { bakeMeshes, foldable, foldState } from './bake.js'

const Mesh_onBeforeRender = new Mesh().onBeforeRender // three.js's no-op: anything else draws with custom logic
const HIDDEN = 31 // the layer the originals wait on (cameras and shadow cameras draw layer 0)
const EPS = 1e-5
const SETTLE = 6 // s a released piece must stay unchanged to be merged again
const SCAN_EVERY = 2 // s between looks for new pieces under the roots

function chainVisible(o, scene) {
  let p = o
  for (; p && p !== scene; p = p.parent) if (!p.visible) return false
  return p === scene // false when detached
}
function attached(o, scene) {
  let p = o
  while (p && p !== scene) p = p.parent
  return p === scene
}
function transparent(m) {
  return (Array.isArray(m) ? m : [m]).some((x) => x.transparent || x.alphaTest > 0 || x.opacity < 1)
}

// --- Shadow proxies -----------------------------------------------------------------------------
const proxyMats = new Map() // `${side}|${shadowSide}` -> material (only its sides matter)
function proxyMat(m) {
  const key = `${m.side}|${m.shadowSide}`
  let pm = proxyMats.get(key)
  if (!pm) proxyMats.set(key, (pm = new MeshBasicMaterial({ side: m.side, shadowSide: m.shadowSide })))
  return pm
}
// The proxies' materials for the usual sides (src/main.js compiles their shaders while loading).
export const proxyMaterials = () => [FrontSide, DoubleSide, BackSide].map((side) => proxyMat({ side, shadowSide: null }))
function skipInView(_r, _s, _c, geometry) {
  geometry.drawRange.count = -1 // main pass: no draw (WebGLRenderer returns on a negative count)
}
function restoreForShadow(_r, _s, _c, geometry) {
  geometry.drawRange.count = Infinity
}
const rel = new Matrix4()
// The shapes of `meshes` (opaque, single material) merged per material side, for the shadow pass only.
function shadowProxies(meshes, scene) {
  const inv = scene.matrixWorld.clone().invert()
  const bySide = new Map()
  for (const o of meshes) {
    const pm = proxyMat(o.material)
    rel.multiplyMatrices(inv, o.matrixWorld)
    const src = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry
    const g = new BufferGeometry()
    g.setAttribute('position', src.attributes.position.clone())
    g.applyMatrix4(rel)
    if (src !== o.geometry) src.dispose()
    if (!bySide.has(pm)) bySide.set(pm, [])
    bySide.get(pm).push(g)
  }
  const out = new Group()
  for (const [pm, geos] of bySide) {
    const merged = mergeGeometries(geos)
    for (const g of geos) g.dispose()
    if (!merged) continue
    const proxy = new Mesh(merged, pm)
    proxy.castShadow = true
    proxy.receiveShadow = false
    proxy.onBeforeRender = skipInView
    proxy.onAfterRender = restoreForShadow
    proxy.matrixAutoUpdate = false
    proxy.name = 'shadow-proxy'
    out.add(proxy)
  }
  return out
}

// roots: [{ root, cell (m), group }] (roots of one group share chunks); exclude: subtrees that are
// never merged (they change every frame: a spinning fan); watch: subtrees checked every frame.
export function createStaticBatcher(scene, { roots, exclude = [], watch = [], perFrame = 240 }) {
  const skip = new Set(exclude.filter(Boolean))
  const watched = new Set(watch.filter(Boolean))
  const under = (o, set) => {
    for (let p = o; p && p !== scene; p = p.parent) if (set.has(p)) return true
    return false
  }
  const chunks = new Map() // key -> { members: Set, bake, shadow, dirty, receive }
  const recs = new Map() // mesh -> record
  const slow = [] // records checked round robin
  const fast = [] // records checked every frame
  const centre = new Vector3()
  let clock = 0

  function snapshot(rec) {
    const o = rec.o
    rec.m = Float32Array.from(o.matrixWorld.elements)
    rec.mat = o.material
    rec.geo = o.geometry
    rec.ver = o.geometry.attributes.position.version
    rec.cast = o.castShadow
    rec.fold = foldable(o.material) ? foldState(o.material) : null
    rec.shown = chainVisible(o, scene)
  }
  function changed(rec) {
    const { o } = rec
    if (o.material !== rec.mat || o.geometry !== rec.geo || o.geometry.attributes.position?.version !== rec.ver || o.castShadow !== rec.cast) return true
    if (rec.fold !== null && foldState(o.material) !== rec.fold) return true
    if (chainVisible(o, scene) !== rec.shown) return true
    const e = o.matrixWorld.elements
    for (let i = 0; i < 16; i++) if (Math.abs(e[i] - rec.m[i]) > EPS) return true
    return false
  }
  function chunkFor(rec) {
    const g = rec.o.geometry
    if (!g.boundingSphere) g.computeBoundingSphere()
    centre.copy(g.boundingSphere.center).applyMatrix4(rec.o.matrixWorld)
    const key = `${rec.group}:${Math.floor(centre.x / rec.cell)}:${Math.floor(centre.z / rec.cell)}:${rec.o.receiveShadow ? 1 : 0}`
    let chunk = chunks.get(key)
    if (!chunk) chunks.set(key, (chunk = { members: new Set(), bake: null, shadow: null, dirty: true, receive: rec.o.receiveShadow }))
    return chunk
  }
  // A plain, visible, opaque mesh can be merged.
  const mergeable = (o) => o.isMesh && !o.isSkinnedMesh && !o.isInstancedMesh && !o.morphTargetInfluences && o.geometry?.attributes?.position && !Array.isArray(o.material) && !transparent(o.material) && o.onBeforeRender === Mesh_onBeforeRender
  function join(rec) {
    snapshot(rec)
    rec.chunk = chunkFor(rec)
    rec.chunk.members.add(rec.o)
    rec.chunk.dirty = true
    rec.merged = true
  }
  function release(rec) {
    rec.merged = false
    rec.o.layers.set(0)
    rec.chunk.members.delete(rec.o)
    rec.chunk.dirty = true
    rec.chunk = null
    snapshot(rec)
    rec.since = clock
  }
  function forget(rec) {
    if (rec.merged) release(rec)
    recs.delete(rec.o)
    rec.gone = true
  }

  // New pieces under the roots (at start, then every SCAN_EVERY s).
  function scan() {
    scene.updateMatrixWorld(true)
    for (const { root, cell, group = root.uuid } of roots) {
      root.traverse((o) => {
        if (recs.has(o) || !mergeable(o) || o.layers.mask !== 1 || !chainVisible(o, scene) || under(o, skip)) return
        const rec = { o, cell, group, merged: false, since: clock, gone: false }
        recs.set(o, rec)
        ;(under(o, watched) ? fast : slow).push(rec)
        join(rec)
      })
    }
  }

  const drop = (g) => {
    if (!g) return
    g.removeFromParent()
    g.traverse((x) => x.isMesh && x.geometry.dispose())
  }
  function rebake(chunk) {
    drop(chunk.bake)
    drop(chunk.shadow)
    chunk.bake = chunk.shadow = null
    chunk.dirty = false
    if (!chunk.members.size) return
    const list = [...chunk.members]
    const b = bakeMeshes(list, scene, false, { exact: true, fold: true })
    b.name = 'static-batch'
    b.matrixAutoUpdate = false
    b.traverse((x) => {
      if (!x.isMesh) return
      x.castShadow = false
      x.receiveShadow = chunk.receive
      x.matrixAutoUpdate = false
    })
    scene.add(b)
    chunk.bake = b
    const casters = list.filter((o) => o.castShadow)
    if (casters.length) {
      chunk.shadow = shadowProxies(casters, scene)
      chunk.shadow.name = 'static-shadow'
      chunk.shadow.matrixAutoUpdate = false
      scene.add(chunk.shadow)
    }
    for (const o of list) o.layers.set(HIDDEN)
  }

  function check(rec) {
    if (rec.gone) return
    if (!attached(rec.o, scene)) return forget(rec)
    if (rec.merged) {
      if (changed(rec)) release(rec)
    } else if (changed(rec)) {
      snapshot(rec)
      rec.since = clock
    } else if (rec.shown && clock - rec.since > SETTLE && rec.o.layers.mask === 1 && mergeable(rec.o)) {
      join(rec) // left alone long enough: merged again
    }
  }

  scan()
  for (const chunk of chunks.values()) rebake(chunk)

  let cursor = 0
  let scanT = SCAN_EVERY
  return {
    get stats() {
      let merged = 0
      for (const r of recs.values()) if (r.merged) merged++
      return { chunks: chunks.size, batched: merged, live: recs.size - merged, watched: fast.length }
    },
    // After the render (the matrices it compares are then fresh). dt in seconds.
    update(dt = 1 / 60) {
      clock += dt
      for (const rec of fast) check(rec)
      let n = Math.min(perFrame, slow.length)
      while (n-- > 0) {
        cursor = (cursor + 1) % slow.length
        check(slow[cursor])
      }
      scanT -= dt
      if (scanT <= 0) {
        scanT = SCAN_EVERY
        for (const list of [fast, slow]) {
          for (let i = list.length - 1; i >= 0; i--) if (list[i].gone) list.splice(i, 1)
        }
        scan()
      }
      for (const chunk of chunks.values()) {
        if (!chunk.dirty) continue
        rebake(chunk)
        break // one per frame
      }
    },
  }
}
