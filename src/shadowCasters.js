// Shadow casters that cannot show are switched off (the sun's shadow pass draws every caster in
// its box, so each one costs a draw call per frame):
//  - pieces smaller than LIGHT.shadowMinRadius: their shadow would be under ~2 texels of the map;
//  - pieces inside a roofed room deeper than LIGHT.indoorSunReach behind its front wall: the sun
//    only comes in through the doors and windows (52 degrees up by day), never that far.
// The office keeps all its casters: its whole front is glass.
import { Box3, Sphere } from 'three'
import { LAYOUT, LIGHT } from './config.js'

const B = LAYOUT.building
const L = LAYOUT.laundry
const reach = LIGHT.indoorSunReach
// Roofed rooms as world boxes (x, y, z), front = +Z.
export const INDOOR = [
  // Ground-floor rooms (east of the office), under the 2nd floor.
  new Box3().set({ x: LAYOUT.office.x1, y: -1, z: B.front - B.depth }, { x: B.x1, y: B.floorH * 2, z: B.front - reach }),
  // The laundry.
  new Box3().set({ x: L.x0, y: -1, z: L.back }, { x: L.x1, y: L.height, z: L.front - reach }),
]

const box = new Box3()
const sphere = new Sphere()

// Switches off the casters under `root` that cannot show; `keep` = objects (and their subtrees)
// that move about (e.g. the laundry basket that is carried outside). Already-checked meshes are
// skipped, so this can run again on a group that grows (the furniture).
export function pruneCasters(root, keep = []) {
  const kept = new Set(keep.filter(Boolean))
  const isKept = (o) => {
    for (let p = o; p; p = p.parent) if (kept.has(p)) return true
    return false
  }
  root.updateMatrixWorld(true)
  let off = 0
  root.traverse((o) => {
    if (!o.isMesh || !o.castShadow || o.userData.casterChecked || isKept(o)) return
    o.userData.casterChecked = true
    const g = o.geometry
    if (!g.boundingSphere) g.computeBoundingSphere()
    sphere.copy(g.boundingSphere).applyMatrix4(o.matrixWorld)
    let hide = sphere.radius < LIGHT.shadowMinRadius
    if (!hide) {
      box.setFromObject(o)
      hide = INDOOR.some((room) => room.containsBox(box))
    }
    if (hide) {
      o.castShadow = false
      off++
    }
  })
  return off
}
