// Motel plots on the main road (PLOTS in config.js). The room's players each own one plot (the
// backend hands out `plot` 0..5). Three plots stand on each side of the road, side by side.
//
// Frames: every plot has its own frame, the coordinates all of src/motel and src/game use (motel
// facing +Z, road at LAYOUT.road.z). A client plays in ITS plot's frame, so nothing in the game
// changes with the plot it got; the road, the desert and the other five plots are placed around it
// with plotMatrix(k, mine). The global frame is plot 0's: the near side keeps its orientation and
// slides along X, the far side is turned 180 degrees round the road's centre line.
import { Matrix4 } from 'three'
import { LAYOUT, PLOTS } from './config.js'

const ROAD_Z = LAYOUT.road.z

export const plotCount = PLOTS.count
export const sideOf = (k) => k % 2 // 0 = the near side (the global frame's), 1 = across the road
export const plotOffsetX = (k) => (PLOTS.columns[k] ?? 0) * PLOTS.width

// Plot k's frame -> the global frame.
export function plotToGlobal(k, out = new Matrix4()) {
  const x = plotOffsetX(k)
  if (sideOf(k) === 0) return out.makeTranslation(x, 0, 0)
  return out.makeRotationY(Math.PI).setPosition(x, 0, 2 * ROAD_Z)
}

const tmp = new Matrix4()
// Plot k's frame -> my plot's frame (what the scene is drawn in).
export function plotMatrix(k, mine, out = new Matrix4()) {
  plotToGlobal(mine, tmp).invert()
  return out.multiplyMatrices(tmp, plotToGlobal(k))
}

// The global frame -> my plot's frame (the shared desert, the road).
export function globalMatrix(mine, out = new Matrix4()) {
  return plotToGlobal(mine, out).invert()
}

// A point + heading in plot k's frame -> my plot's frame (remote players' poses).
export function toMine(k, mine, x, z, yaw) {
  const flip = sideOf(k) !== sideOf(mine)
  const dx = plotOffsetX(k) - plotOffsetX(mine)
  // Near side: same orientation, shifted; across: mirrored through the road's centre line.
  if (!flip) return { x: x + (sideOf(mine) === 0 ? dx : -dx), z, yaw }
  return { x: (sideOf(mine) === 0 ? dx : -dx) - x, z: 2 * ROAD_Z - z, yaw: yaw + Math.PI }
}
