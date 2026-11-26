import { BufferAttribute, Group, Matrix4, Mesh } from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

// --- Baking: one mesh per material ------------------------------------------------
// Props are built from many small meshes (a palm is ~20); merging the ones
// that share a look keeps a set piece to a handful of draw calls (mobile).
const matKey = (m) => [m.type, m.color?.getHexString(), m.emissive?.getHexString(), m.vertexColors, m.side, m.flatShading, m.transparent, m.opacity, m.blending, m.map?.uuid, m.roughness, m.metalness, m.userData.k].join('|')
// Coarser: pieces that differ only in roughness / metalness / flat shading share one mesh (far
// away the difference does not show; the first piece's material is used).
const coarseKey = (m) => [m.type, m.color?.getHexString(), m.emissive?.getHexString(), m.vertexColors, m.side, m.transparent, m.opacity, m.blending, m.map?.uuid, m.userData.k].join('|')
const rel = new Matrix4()
export function bake(root, castShadow = false) {
  const meshes = []
  root.traverse((o) => o.isMesh && meshes.push(o))
  return bakeMeshes(meshes, root, castShadow)
}

// --- Folding plain colours ------------------------------------------------------------------------
// Most props are plain-coloured: a material with no textures, not glowing, opaque. Those that
// differ ONLY in colour can share one material if each piece carries its colour in its vertices
// (vertex colours, the same linear value the material had): the look is identical, but a merge
// needs one mesh per lighting kind instead of one per colour.
const MAPS = ['map', 'normalMap', 'emissiveMap', 'roughnessMap', 'metalnessMap', 'alphaMap', 'aoMap', 'bumpMap', 'lightMap', 'displacementMap', 'envMap', 'specularMap', 'clearcoatMap', 'sheenColorMap', 'transmissionMap']
const noCompile = new Mesh().material.onBeforeCompile
export function foldable(m) {
  if (!m || Array.isArray(m) || !(m.isMeshStandardMaterial || m.isMeshLambertMaterial || m.isMeshPhongMaterial)) return false
  if (m.vertexColors || m.transparent || m.opacity !== 1 || m.alphaTest > 0 || m.wireframe || !m.visible || m.userData.k != null) return false
  if (m.onBeforeCompile !== noCompile) return false
  if (MAPS.some((k) => m[k])) return false
  return !m.emissive || m.emissive.getHex() === 0 || m.emissiveIntensity === 0 // glowing ones change at night
}
// Everything about a foldable material except its colour.
const foldKey = (m) =>
  [m.type, m.side, m.shadowSide, m.flatShading, m.roughness, m.metalness, m.shininess, m.specular?.getHex(), m.fog, m.toneMapped, m.depthTest, m.depthWrite, m.polygonOffset, m.polygonOffsetFactor, m.polygonOffsetUnits, m.envMapIntensity, m.clearcoat, m.clearcoatRoughness, m.sheen, m.transmission, m.ior, m.dithering].join('|')
const folded = new Map() // foldKey -> the shared vertex-coloured material
function foldedMaterial(m) {
  const key = foldKey(m)
  let f = folded.get(key)
  if (!f) {
    f = m.clone()
    f.color.set(0xffffff)
    f.vertexColors = true
    f.name = 'folded'
    folded.set(key, f)
  }
  return f
}
// The folded materials made so far (src/main.js compiles their shaders while loading).
export const foldedMaterials = () => [...folded.values()]
// A material's folded twin, made now (so its shader can be compiled before it is first needed).
export const prepareFolded = (m) => (foldable(m) ? foldedMaterial(m) : null)
// A snapshot of what folding baked in, to notice when the game changes the material later.
export const foldState = (m) => `${m.color.getHex()}|${m.emissive?.getHex() ?? ''}|${m.emissiveIntensity ?? ''}|${m.roughness ?? ''}|${m.metalness ?? ''}|${m.opacity}|${m.visible}|${m.transparent}`

// The same for a chosen list of meshes (each kept where it is relative to `root`).
// cloneMaterials: each merged mesh gets its own copy of the material (for a snapshot of objects whose
// materials change later, e.g. a room's wallpaper).
// exact: one mesh per material OBJECT (and vertex layout), nothing dropped: whatever later changes
// a material (night glow, a sign's chasing bulbs) shows on the merged mesh exactly as before.
// fold: plain colours are folded (above) first; the rest follows the chosen key.
const layout = (g) => Object.entries(g.attributes).map(([n, a]) => `${n}:${a.itemSize}:${a.array.constructor.name}:${a.normalized}`).sort().join(',')
export function bakeMeshes(meshes, root, castShadow = false, { coarse = false, cloneMaterials = false, exact = false, fold = false } = {}) {
  const keyOf = exact ? (m, g) => `${m.uuid}|${layout(g)}` : coarse ? coarseKey : matKey
  root.updateMatrixWorld(true)
  const inv = root.matrixWorld.clone().invert()
  const groups = new Map() // key -> { mat, geos, own }
  const out = new Group()
  for (const o of meshes) {
    rel.multiplyMatrices(inv, o.matrixWorld)
    if (Array.isArray(o.material)) {
      out.add(new Mesh(o.geometry.clone().applyMatrix4(rel), cloneMaterials ? o.material.map((m) => m.clone()) : o.material)) // multi-material: kept as is
      continue
    }
    const geo = (o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone()).applyMatrix4(rel)
    if (fold && foldable(o.material)) {
      const c = o.material.color
      const n = geo.attributes.position.count
      const col = new Float32Array(n * 3)
      for (let i = 0; i < n; i++) col.set([c.r, c.g, c.b], i * 3)
      geo.setAttribute('color', new BufferAttribute(col, 3))
      const f = foldedMaterial(o.material)
      const key = `fold|${f.uuid}|${layout(geo)}`
      let e = groups.get(key)
      if (!e) groups.set(key, (e = { mat: f, geos: [], own: true }))
      e.geos.push(geo)
      continue
    }
    const key = keyOf(o.material, o.geometry)
    let e = groups.get(key)
    if (!e) groups.set(key, (e = { mat: o.material, geos: [], own: false }))
    e.geos.push(geo)
  }
  for (const { mat, geos, own } of groups.values()) {
    const names = Object.keys(geos[0].attributes).filter((n) => geos.every((g) => g.attributes[n]))
    for (const g of geos) {
      for (const n of Object.keys(g.attributes)) if (!names.includes(n)) g.deleteAttribute(n)
      g.morphAttributes = {}
      g.clearGroups()
    }
    const merged = mergeGeometries(geos)
    if (!merged && (exact || own)) {
      for (const g of geos) out.add(new Mesh(g, mat)) // could not merge: kept piece by piece
      continue
    }
    for (const g of geos) g.dispose()
    // A folded material is shared and never changes: it is not cloned.
    if (merged) out.add(new Mesh(merged, cloneMaterials && !own ? mat.clone() : mat))
  }
  out.traverse((o) => {
    if (o.isMesh) o.castShadow = castShadow
  })
  return out
}
