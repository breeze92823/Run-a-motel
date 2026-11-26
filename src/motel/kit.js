// Small modelling helpers shared by the motel builders: boxes with metre-scaled
// UVs, rounded boxes, cached materials, and the shared texture set.
import { BoxGeometry, CanvasTexture, Mesh, MeshStandardMaterial, RepeatWrapping, SRGBColorSpace, Vector2 } from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { paintCracks, paintCurtain, paintGrille, paintStain, paintStarBand, paintStucco, paintWood, tex } from './paint.js'
import { paintPlanks, paintPavement } from '../textures.js'

// Rescales a BoxGeometry's UVs so a texture tiles every `tile` metres
// (tileV defaults to tile). Face order: +x, -x, +y, -y, +z, -z (4 verts each).
export function boxUV(geo, w, h, d, tile = 1, tileV = tile) {
  const uv = geo.attributes.uv
  const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]]
  for (let f = 0; f < 6; f++) {
    const [su, sv] = dims[f]
    for (let k = 0; k < 4; k++) {
      const i = f * 4 + k
      uv.setXY(i, uv.getX(i) * (su / tile), uv.getY(i) * (sv / tileV))
    }
  }
  return geo
}

export function box(parent, w, h, d, mat, x = 0, y = 0, z = 0, tile = 0, tileV = tile) {
  const geo = new BoxGeometry(w, h, d)
  if (tile) boxUV(geo, w, h, d, tile, tileV)
  const m = new Mesh(geo, mat)
  m.position.set(x, y, z)
  m.castShadow = true
  m.receiveShadow = true
  parent.add(m)
  return m
}

const rbCache = new Map()
export function rbox(parent, w, h, d, r, mat, x = 0, y = 0, z = 0, seg = 2) {
  const key = `${w}|${h}|${d}|${r}|${seg}`
  let geo = rbCache.get(key)
  if (!geo) rbCache.set(key, (geo = new RoundedBoxGeometry(w, h, d, seg, r)))
  const m = new Mesh(geo, mat)
  m.position.set(x, y, z)
  m.castShadow = true
  m.receiveShadow = true
  parent.add(m)
  return m
}

const matCache = new Map()
// A cached standard material (same args = same instance, so baking merges them).
export function mat(color, opts = {}) {
  const key = color + JSON.stringify(opts, (k, v) => (v && v.isTexture ? v.uuid : v))
  let m = matCache.get(key)
  if (!m) matCache.set(key, (m = new MeshStandardMaterial({ color, roughness: 0.7, metalness: 0, ...opts })))
  return m
}

// The shared textures, painted once on first use.
let T = null
export function textures() {
  if (T) return T
  const stucco = paintStucco(512, 11)
  const pave = paintPavement({ base: '#f3ece0', alt: '#e6dccb', joint: '#c9bca5' }, 512, 4, 505)
  T = {
    stucco: tex(stucco.color),
    stuccoN: tex(stucco.normal, { srgb: false }),
    star: tex(paintStarBand()),
    curtain: tex(paintCurtain(), { wrap: false }),
    curtainPink: tex(paintCurtain('#f6c6c9', '#d9707e'), { wrap: false }),
    grille: tex(paintGrille(), { wrap: false }),
    wood: tex(paintWood()),
    planks: tex(paintPlanks(256, 4, 17).color ?? paintPlanks(256, 4, 17)),
    cracks: tex(paintCracks(), { wrap: false }),
    pave: tex(pave.color),
    paveN: tex(pave.normal, { srgb: false }),
    stains: [1, 2, 3, 4].map((s) => tex(paintStain(s), { wrap: false })),
  }
  return T
}

// Palette for the retro desert motel.
export const C = {
  wall: '#f4b47c',
  wallLow: '#e77f45',
  teal: '#27a596',
  tealDark: '#1d7d72',
  rail: '#4c9a83',
  white: '#fbf4e8',
  orange: '#f06a34',
  cream: '#fff3dc',
  door: '#2aa494',
  brass: '#e2b33c',
  concrete: '#efe6d6',
  glass: '#bfeff0',
}

export function stuccoMat(color) {
  const t = textures()
  return mat(color, { map: t.stucco, normalMap: t.stuccoN, normalScale: new Vector2(0.55, 0.55), roughness: 0.95 })
}

export function canvasTex(c) {
  const t = new CanvasTexture(c)
  t.colorSpace = SRGBColorSpace
  t.anisotropy = 8
  return t
}

export { RepeatWrapping }
