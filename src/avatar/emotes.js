// Boxity emotes on the player's rig. Boxity draws the emote picker; the portal sends the picked
// emote's catalogue id (bloxity.onEmote) and this plays its clip on top of the locomotion pose.
// Clips come from {apiUrl}/v1/avatar/emotes: { len, loop, tracks: { bone: [[t, xDeg, yDeg, zDeg]] } },
// DEGREE deltas over each bone's bind pose (euler XYZ, right-multiplied onto the bind quaternion),
// smoothstep between keys, clamped outside the key range, looping on t % len. Unknown ids and bone
// names are ignored silently; nothing here may throw into a frame.
import { Euler, Quaternion } from 'three'
import { boxityEnv } from '../bloxity.js'
import { BONE_NAMES } from './rig.js'

const DEG = Math.PI / 180
const BLEND = 0.1 // s to blend in / out
const RIG_BONES = new Set(BONE_NAMES) // rewritten by animator.js every frame

let catalogue = null
// id -> emote, fetched once (the catalogue grows without a game release: never hardcode ids).
export function loadEmotes() {
  catalogue ||= fetch(`${boxityEnv().apiUrl}/v1/avatar/emotes`)
    .then((r) => (r.ok ? r.json() : null))
    .then((j) => new Map((Array.isArray(j) ? j : j?.emotes ?? []).filter((e) => e?.id).map((e) => [String(e.id), e])))
    .catch(() => {
      catalogue = null // try again on the next emote
      return new Map()
    })
  return catalogue
}

function sample(keys, t) {
  if (t <= keys[0][0]) return keys[0]
  const last = keys[keys.length - 1]
  if (t >= last[0]) return last
  for (let i = 0; i < keys.length - 1; i++) {
    const a = keys[i]
    const b = keys[i + 1]
    if (t >= a[0] && t <= b[0]) {
      let s = (t - a[0]) / (b[0] - a[0] || 1)
      s = s * s * (3 - 2 * s)
      return [t, a[1] + (b[1] - a[1]) * s, a[2] + (b[2] - a[2]) * s, a[3] + (b[3] - a[3]) * s]
    }
  }
  return null
}

const qDelta = new Quaternion()
const qTarget = new Quaternion()
const qBase = new Quaternion()
const euler = new Euler()

export class EmotePlayer {
  // Created while the rig is in its bind pose (right after the avatar is built).
  constructor(root) {
    this.root = root
    this.bind = new Map()
    for (const [name, node] of Object.entries(root?.nodes ?? {})) if (node?.isBone || RIG_BONES.has(name) || /_Offset$/.test(name)) this.bind.set(name, node.quaternion.clone())
    this.clip = null
    this.time = 0
    this.weight = 0
    this.want = 0
    this.token = 0
  }

  get playing() {
    return !!this.clip && this.want > 0
  }

  async play(id) {
    const mine = ++this.token
    this.id = String(id) // what the others are told is playing (src/presence.js)
    try {
      const e = (await loadEmotes()).get(String(id))
      if (mine !== this.token || !e?.clip?.tracks) return
      this.clip = e.clip
      this.time = 0
      this.want = 1
    } catch {
      // Cosmetic only.
    }
  }

  stop() {
    this.token++
    this.want = 0
  }

  // After the animator's update. moving: the player walks / jumps, which ends the emote.
  update(dt, moving) {
    if (!this.clip) return
    try {
      if (moving) this.want = 0
      const step = dt / BLEND
      this.weight = this.want > this.weight ? Math.min(1, this.weight + step) : Math.max(0, this.weight - step)
      this.time += dt
      const len = this.clip.len > 0 ? this.clip.len : 1
      if (!this.clip.loop && this.time >= len) this.want = 0
      const t = this.clip.loop ? this.time % len : Math.min(this.time, len)
      for (const name in this.clip.tracks) {
        const keys = this.clip.tracks[name]
        const bone = this.root.nodes?.[name]
        const bind = this.bind.get(name)
        if (!bone || !bind || !Array.isArray(keys) || !keys.length) continue
        const v = sample(keys, t)
        if (!v) continue
        qTarget.copy(bind).multiply(qDelta.setFromEuler(euler.set(v[1] * DEG, v[2] * DEG, v[3] * DEG, 'XYZ')))
        // Rig bones hold this frame's locomotion pose; the others (e.g. the shoulder offsets) rest.
        qBase.copy(RIG_BONES.has(name) ? bone.quaternion : bind)
        bone.quaternion.copy(qBase).slerp(qTarget, this.weight)
      }
      if (this.weight <= 0 && this.want === 0) {
        for (const name in this.clip.tracks) if (!RIG_BONES.has(name)) this.root.nodes?.[name]?.quaternion.copy(this.bind.get(name) ?? this.root.nodes[name].quaternion)
        this.clip = null
      }
    } catch {
      this.clip = null
    }
  }
}
