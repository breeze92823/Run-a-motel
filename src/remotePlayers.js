// The other players in the room (the drawing half of presence; src/presence.js sends this player's,
// the backend relays everybody's through the roster, net.js remoteRoster()).
//  - Each one walks on their own plot (src/plots.js): their pose is in that plot's frame and is
//    placed with toMine(), so everyone sees everyone on the right motel.
//  - Their look is Boxity's: the character kit dresses the base rig from their outfit key (skin,
//    every cosmetic slot, body shape); where the kit cannot, the manual path (avatar/loader.js)
//    draws the equipped items, skin texture and proportions they sent. Their Boxity emote plays on
//    the rig (avatar/emotes.js), and their chat messages show as a bubble over their head.
//  - Poses arrive ~10 times a second: the drawn position eases toward the latest one pushed a little
//    ahead along the estimated velocity (dead reckoning, NET.remoteLead) and snaps on a teleport.
import { Group } from 'three'
import { NET, PLAYER_DIMS } from './config.js'
import { attachChatBubble, canDress, dressCharacter } from './bloxity.js'
import { remoteRoster } from './net.js'
import { toMine } from './plots.js'
import { buildDefaultCharacter, loadBaseCharacter } from './avatar/character.js'
import { applyProportions, attachEquippedAccessories } from './avatar/loader.js'
import { disposeAnimator, makeAnimator } from './avatar/animator.js'
import { EmotePlayer } from './avatar/emotes.js'
import { label } from './propkit.js'

const now = () => performance.now() / 1000
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a))

function parseLook(text) {
  if (!text) return null
  try {
    const v = JSON.parse(text)
    return v && typeof v === 'object' ? v : null
  } catch {
    return null
  }
}

export function createRemotePlayers({ scene, camera, THREE, GLTFLoader, getPlot }) {
  const entities = new Map() // sessionId -> entity
  const cam = camera.position

  function create(id, p, at) {
    const ent = {
      id,
      group: new Group(),
      avatar: null,
      animator: null,
      emotes: null,
      emote: '',
      kit: null,
      gen: 0,
      lookKey: null,
      name: '',
      tag: null,
      bubble: null,
      target: { ...at },
      vel: { x: 0, y: 0, z: 0 },
      sampleAt: now(),
      pos: { x: at.x, y: at.y, z: at.z },
      yaw: at.yaw,
      plot: p.plot,
      dead: false,
    }
    ent.group.name = `remote-${id}`
    ent.group.position.set(at.x, at.y, at.z)
    ent.group.rotation.y = at.yaw
    scene.add(ent.group)
    setAvatar(ent, buildDefaultCharacter()) // shown at once; the real rig replaces it
    return ent
  }

  function setAvatar(ent, next) {
    if (ent.avatar) ent.group.remove(ent.avatar)
    disposeAnimator(ent.animator)
    ent.avatar = next
    ent.group.add(next)
    ent.emotes = new EmotePlayer(next) // reads the bind pose: before the animator moves a bone
    ent.animator = makeAnimator(next)
    if (ent.emote) void ent.emotes.play(ent.emote)
  }

  // A fresh rig dressed by the character kit from the outfit key, else by the manual path from the
  // look JSON, else plain. Only the newest request lands.
  async function dress(ent, outfit, lookText) {
    const mine = ++ent.gen
    const group = await loadBaseCharacter()
    if (ent.dead || mine !== ent.gen) return
    let kit = null
    if (outfit && canDress(outfit) && group.nodes?.Rig1) kit = await dressCharacter(THREE, GLTFLoader, group, outfit)
    if (ent.dead || mine !== ent.gen) return void kit?.dispose?.()
    if (!kit) {
      const look = parseLook(lookText)
      if (look?.equipped) await attachEquippedAccessories(group, look.equipped, { skinTextureUrl: look.skin || null })
      if (ent.dead || mine !== ent.gen) return
      if (look?.proportions) applyProportions(group, look.proportions)
    }
    const old = ent.kit
    ent.kit = kit
    setAvatar(ent, group)
    try {
      old?.dispose?.()
    } catch {
      // The old rig is gone anyway.
    }
  }

  function destroy(ent) {
    ent.dead = true
    ent.gen++
    try {
      ent.kit?.dispose?.()
    } catch {
      // Ignore.
    }
    ent.bubble?.remove?.()
    disposeAnimator(ent.animator)
    ent.tag?.material.map?.dispose()
    ent.tag?.material.dispose()
    ent.group.removeFromParent()
  }

  function setName(ent, name) {
    ent.name = name
    if (ent.tag) {
      ent.group.remove(ent.tag)
      ent.tag.material.map?.dispose()
      ent.tag.material.dispose()
    }
    ent.tag = label(name || 'Player', 0.55, { color: '#ffffff', outline: '#10162a', outlineWidth: 14 })
    ent.tag.renderOrder = 5
    ent.tag.position.set(0, PLAYER_DIMS.height + 0.6, 0)
    ent.group.add(ent.tag)
  }

  // Pose samples -> target + velocity estimate (a big jump is a teleport: no glide).
  function readPose(ent, at, t) {
    const T = ent.target
    if (Math.abs(at.x - T.x) + Math.abs(at.y - T.y) + Math.abs(at.z - T.z) + Math.abs(wrap(at.yaw - T.yaw)) < 1e-4) return
    const dt = Math.max(0.05, t - ent.sampleAt)
    if (Math.hypot(at.x - T.x, at.y - T.y, at.z - T.z) > NET.remoteSnap) {
      ent.vel.x = ent.vel.y = ent.vel.z = 0
      ent.pos.x = at.x
      ent.pos.y = at.y
      ent.pos.z = at.z
      ent.yaw = at.yaw
    } else {
      ent.vel.x = (at.x - T.x) / dt
      ent.vel.y = (at.y - T.y) / dt
      ent.vel.z = (at.z - T.z) / dt
    }
    Object.assign(T, at)
    ent.sampleAt = t
  }

  function move(ent, dt, t) {
    const age = t - ent.sampleAt
    const stale = age > NET.remoteStale
    const lead = stale ? 0 : Math.min(age, NET.remoteLead)
    const T = ent.target
    const k = 1 - Math.exp(-NET.remoteEase * dt)
    ent.pos.x += (T.x + ent.vel.x * lead - ent.pos.x) * k
    ent.pos.y += (T.y + ent.vel.y * lead - ent.pos.y) * k
    ent.pos.z += (T.z + ent.vel.z * lead - ent.pos.z) * k
    ent.yaw = wrap(ent.yaw + wrap(T.yaw - ent.yaw) * k)
    ent.group.position.set(ent.pos.x, ent.pos.y, ent.pos.z)
    ent.group.rotation.y = ent.yaw
    return stale
  }

  return {
    get count() {
      return entities.size
    },
    // A Boxity chat message from another player: a bubble over their head (matched by name).
    bubble(message) {
      const name = String(message?.username ?? '').toLowerCase()
      if (!name || !message.bubble) return
      for (const ent of entities.values()) {
        if (ent.name.toLowerCase() !== name) continue
        ent.bubble?.remove?.()
        ent.bubble = attachChatBubble(THREE, ent.group, message.bubble, { height: PLAYER_DIMS.height + 1.05 })
      }
    },
    update(dt) {
      const mine = getPlot()
      const t = now()
      const seen = new Set()
      for (const [id, p] of remoteRoster()) {
        if (!(p.plot >= 0) || mine < 0) continue // not seated yet
        seen.add(id)
        const at = { ...toMine(p.plot, mine, p.x, p.z, p.yaw), y: p.y }
        let ent = entities.get(id)
        if (ent && ent.plot !== p.plot) {
          destroy(ent) // their plot moved under them (a rejoin): start clean
          entities.delete(id)
          ent = null
        }
        if (!ent) entities.set(id, (ent = create(id, p, at)))
        const name = p.username || 'Player'
        if (name !== ent.name) setName(ent, name)
        const lookKey = `${p.outfit}|${p.avatar}`
        if (lookKey !== ent.lookKey) {
          ent.lookKey = lookKey
          void dress(ent, p.outfit, p.avatar)
        }
        if (p.emote !== ent.emote) {
          ent.emote = p.emote
          if (p.emote) void ent.emotes?.play(p.emote)
          else ent.emotes?.stop()
        }
        readPose(ent, at, t)
        const stale = move(ent, dt, t)
        const speed = stale ? 0 : p.speed
        const vy = stale ? 0 : Math.max(-30, Math.min(30, ent.vel.y))
        ent.animator?.update(dt, { grounded: p.grounded, speed, verticalVelocity: vy, turn: 0 })
        ent.emotes?.update(dt, speed > 0.4 || !p.grounded)
        // The name tag fades with the camera's distance.
        if (ent.tag) {
          const c = Math.hypot(ent.pos.x - cam.x, ent.pos.y + 2 - cam.y, ent.pos.z - cam.z)
          const [a0, a1] = NET.remoteTagRange
          const a = 1 - Math.min(1, Math.max(0, (c - a0) / (a1 - a0)))
          ent.tag.material.opacity = a
          ent.tag.visible = a > 0.01
        }
      }
      for (const [id, ent] of entities) {
        if (seen.has(id)) continue
        destroy(ent) // left the room (or its session was replaced)
        entities.delete(id)
      }
    },
  }
}
