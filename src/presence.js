// Tells the other players in the room where this one is and how they look (the sending half of
// presence; src/remotePlayers.js draws the others, the backend's presence.ts bounds both).
//  - `pose` every NET.poseEvery s while moving (NET.poseStill when standing): feet position and
//    heading in this player's own plot frame (the receivers place the plot, src/plots.js), speed
//    and whether they are on the ground.
//  - `look` when it changed (checked every NET.lookEvery s, and again on every new session): the
//    Boxity outfit key (the character kit's input), the manual-path look JSON and the emote playing.
import { NET } from './config.js'
import { avatarLook, getOutfitKey } from './bloxity.js'
import { net, sendLook, sendPose } from './net.js'
import { player } from './player.js'

export function createPresence({ emote }) {
  let poseT = 0
  let lookT = 0
  let still = 0
  let lastLook = ''
  let lastJoin = -1
  const last = { x: NaN, y: NaN, z: NaN, yaw: NaN, grounded: null }

  return {
    update(dt) {
      if (!net.connected) return
      poseT -= dt
      lookT -= dt
      still += dt
      if (lookT <= 0 || net.joins !== lastJoin) {
        lookT = NET.lookEvery
        const look = { outfit: getOutfitKey(), avatar: avatarLook(), emote: emote() || '' }
        const key = JSON.stringify(look)
        if (key !== lastLook || net.joins !== lastJoin) {
          if (net.joins !== lastJoin) still = NET.poseStill // a fresh session: the pose goes out too
          lastLook = key
          lastJoin = net.joins
          sendLook(look)
        }
      }
      if (poseT <= 0) {
        poseT = NET.poseEvery
        const p = player.renderPosition
        const yaw = player.facing
        const moved = Math.abs(p.x - last.x) > 0.02 || Math.abs(p.y - last.y) > 0.02 || Math.abs(p.z - last.z) > 0.02 || Math.abs(yaw - last.yaw) > 0.02
        if (moved || player.grounded !== last.grounded || still >= NET.poseStill) {
          still = 0
          Object.assign(last, { x: p.x, y: p.y, z: p.z, yaw, grounded: player.grounded })
          sendPose({ x: p.x, y: p.y, z: p.z, yaw, speed: Math.hypot(player.velocity.x, player.velocity.z), grounded: player.grounded })
        }
      }
    },
  }
}
