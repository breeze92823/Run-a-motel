// Guests' cars. A car only exists while its guest stays: it drives in from the road when the
// guest checks in, parks nose-in on a free stall of the lot (row 1 by the rooms, else row 3), and
// when the guest checks out they walk to it, get in and the car backs out and drives away.
// Animated: smooth steering + speed, nose dips when braking, body roll in turns, brake and
// head lights, engine loop and exhaust puffs. Parked cars are solid; moving ones are not.
import { Group } from 'three'
import { LAYOUT } from '../config.js'
import { engineRate, loop as sfxLoop } from '../fx/sfx.js'
import { car as makeCar } from '../motel/props.js'
import { RAPIER, addFixed, removeCollider } from '../physics.js'

const COLORS = [
  ['#3cc7b8', '#f4efe2'],
  ['#e0322a', '#fff6e5'],
  ['#2f6fd0', '#f4efe2'],
  ['#f2c232', '#fff6e5'],
  ['#43c9b5', '#f6f0e4'],
  ['#e0322a', '#9fe08a'],
  ['#c9762b', '#f4efe2'],
  ['#8a63c9', '#f6f0e4'],
]
const STALL_X = [-10.4, -7.2, -4, -0.8, 2.4]
const ROW1 = { z: 2.6, aisle: 8 } // faces the rooms
const ROW3 = { z: 18.8, aisle: LAYOUT.lot.z1 - 2.1 } // back-to-back pair, entered from the front aisle
const LANE_X = LAYOUT.lot.x0 + 2.5 // the west strip of the lot is the drive lane
const ROAD_Z = LAYOUT.busLaneZ + 0.6
const FAR_X = 46
const SOUNDS = 4

const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a))

// Round the corners of a polyline (quadratic curves) so the car sweeps through its turns.
function rounded(pts, r) {
  if (pts.length < 3) return pts
  const out = [pts[0]]
  for (let i = 1; i < pts.length - 1; i++) {
    const a = pts[i - 1]
    const b = pts[i]
    const c = pts[i + 1]
    const la = Math.hypot(a.x - b.x, a.z - b.z)
    const lc = Math.hypot(c.x - b.x, c.z - b.z)
    const k = Math.min(r, la / 2, lc / 2)
    const p0 = { x: b.x + ((a.x - b.x) / la) * k, z: b.z + ((a.z - b.z) / la) * k, speed: b.speed }
    const p2 = { x: b.x + ((c.x - b.x) / lc) * k, z: b.z + ((c.z - b.z) / lc) * k, speed: b.speed }
    for (let s = 0; s <= 4; s++) {
      const t = s / 4
      const u = 1 - t
      out.push({ x: u * u * p0.x + 2 * u * t * b.x + t * t * p2.x, z: u * u * p0.z + 2 * u * t * b.z + t * t * p2.z, speed: b.speed })
    }
  }
  out.push(pts[pts.length - 1])
  return out
}

export function createCars({ scene, fx }) {
  const stalls = []
  for (const x of STALL_X) stalls.push({ x, z: ROW1.z, aisle: ROW1.aisle, row: 1, taken: false })
  for (const x of STALL_X) stalls.push({ x, z: ROW3.z, aisle: ROW3.aisle, row: 3, taken: false })
  const pool = []
  const active = []
  const soundBusy = new Array(SOUNDS).fill(false)
  let built = 0

  function build() {
    const [c, a] = COLORS[built % COLORS.length]
    const model = makeCar(c, a, { wagon: built % 3 !== 2, seed: built })
    built++
    const root = new Group()
    root.add(model)
    root.visible = false // hidden: warms the shaders at load, shown when it drives in
    scene.add(root)
    return { root, model, lights: model.userData.lights, yaw: Math.PI, v: 0, state: 'idle', path: [], i: 0, stall: null, collider: null, snd: -1, wantLeave: false, bob: Math.random() * 6, smokeT: 0, onGone: null }
  }
  for (let i = 0; i < 3; i++) pool.push(build())

  function pickStall() {
    const free = (row) => stalls.filter((s) => s.row === row && !s.taken)
    const a = free(1)
    const list = a.length ? a : free(3)
    return list.length ? list[Math.floor(Math.random() * list.length)] : null
  }

  function startSound(c) {
    c.snd = soundBusy.indexOf(false)
    if (c.snd >= 0) soundBusy[c.snd] = true
  }
  function stopSound(c) {
    if (c.snd < 0) return
    sfxLoop(`car${c.snd}`, 'engine', { x: c.root.position.x, y: 0.6, z: c.root.position.z }, 0)
    soundBusy[c.snd] = false
    c.snd = -1
  }

  function follow(c, path) {
    c.path = path
    c.i = 0
  }

  // A guest checked in: a car drives in and parks. Returns null when the lot is full.
  function arrive() {
    const s = pickStall()
    if (!s) return null
    s.taken = true
    const c = pool.pop() ?? build()
    c.stall = s
    c.state = 'arriving'
    c.wantLeave = false
    c.v = 0
    c.yaw = Math.PI / 2 // facing east along the road
    c.root.position.set(-FAR_X + 4, 0, ROAD_Z)
    c.root.rotation.y = c.yaw
    c.root.visible = true
    c.model.rotation.set(0, 0, 0)
    const drive = [{ x: c.root.position.x, z: ROAD_Z, speed: 9 }, { x: LANE_X, z: ROAD_Z, speed: 9 }, { x: LANE_X, z: LAYOUT.lot.z1 + 0.8, speed: 6 }]
    drive.push({ x: LANE_X, z: s.aisle, speed: 4.5 }, { x: s.x, z: s.aisle, speed: 4.5 }, { x: s.x, z: s.z, speed: 3 })
    follow(c, rounded(drive, 4))
    startSound(c)
    active.push(c)
    c.x = s.x
    c.z = s.z
    return c
  }

  // The guest is in: back out and drive away (waits if the car is still arriving).
  function depart(c) {
    if (!c) return
    if (c.state === 'arriving') {
      c.wantLeave = true
      return
    }
    if (c.state !== 'parked') return
    if (c.collider) removeCollider(c.collider)
    c.collider = null
    c.state = 'leaving'
    const s = c.stall
    const back = [
      { x: s.x, z: s.z + 3.4, rev: true, speed: 2.2 }, // backing out is always toward +Z (the aisle)
      { x: s.x + 2.3, z: s.aisle + 0.6, rev: true, speed: 2.2 },
    ]
    const fwd = [
      { x: s.x - 3.2, z: s.aisle - 0.2, speed: 4 },
      { x: LANE_X, z: s.aisle - 0.2, speed: 4.5 },
      { x: LANE_X, z: LAYOUT.lot.z1 + 0.8, speed: 6 },
      { x: LANE_X + 4, z: ROAD_Z, speed: 8 },
      { x: FAR_X, z: ROAD_Z, speed: 9 },
    ]
    follow(c, [...back, ...rounded(fwd, 4)])
    startSound(c)
    c.v = 0
  }

  function park(c) {
    const s = c.stall
    c.state = 'parked'
    c.v = 0
    c.root.position.set(s.x, 0, s.z)
    c.yaw = Math.PI
    c.root.rotation.y = c.yaw
    c.collider = addFixed(RAPIER.ColliderDesc.cuboid(1.0, 0.9, 2.35), { x: s.x, y: 0.9, z: s.z })
    stopSound(c)
    if (c.wantLeave) depart(c)
  }

  function gone(c) {
    stopSound(c)
    c.state = 'idle'
    c.root.visible = false
    c.stall.taken = false
    c.stall = null
    active.splice(active.indexOf(c), 1)
    pool.push(c)
  }

  function step(c, dt) {
    const p = c.path[c.i]
    const pos = c.root.position
    const last = c.i === c.path.length - 1
    let dx = p.x - pos.x
    let dz = p.z - pos.z
    let dist = Math.hypot(dx, dz)
    if (dist < (last ? 0.12 : 0.9)) {
      if (last) {
        if (c.state === 'arriving') park(c)
        else gone(c)
        return
      }
      c.i++
      return
    }
    const want = p.rev ? Math.atan2(-dx, -dz) : Math.atan2(dx, dz)
    const diff = wrap(want - c.yaw)
    const turn = Math.max(-2.4 * dt, Math.min(2.4 * dt, diff))
    c.yaw += turn
    const align = Math.max(0.3, Math.cos(Math.min(Math.abs(diff), 1.4)))
    let target = p.speed * align
    if (last) target = Math.min(target, 0.6 + dist * 0.9) // ease into the stall
    const prev = c.v
    c.v += (target - c.v) * Math.min(1, dt * 2.6)
    const move = Math.min(c.v * dt, dist)
    const sign = p.rev ? -1 : 1
    pos.x += Math.sin(c.yaw) * move * sign
    pos.z += Math.cos(c.yaw) * move * sign
    c.root.rotation.y = c.yaw
    // Body language: nose dips when braking, lifts when pulling away, leans in turns, rumbles.
    const acc = (c.v - prev) / Math.max(dt, 1e-4)
    c.bob += dt * (6 + c.v * 2)
    const pitch = Math.max(-0.045, Math.min(0.045, acc * 0.012 * -sign)) + Math.sin(c.bob) * 0.004 * Math.min(1, c.v)
    const roll = Math.max(-0.06, Math.min(0.06, (turn / Math.max(dt, 1e-4)) * c.v * -0.008))
    c.model.rotation.x += (pitch - c.model.rotation.x) * Math.min(1, dt * 8)
    c.model.rotation.z += (roll - c.model.rotation.z) * Math.min(1, dt * 8)
    // Lights.
    const braking = acc < -0.6 || p.rev
    c.lights.head.emissiveIntensity = 1.6
    c.lights.tail.emissiveIntensity = braking ? 2.2 : 0.5
    // Exhaust puff out of the back.
    c.smokeT -= dt
    if (c.smokeT <= 0) {
      c.smokeT = 0.12
      const bx = pos.x - Math.sin(c.yaw) * 2.4
      const bz = pos.z - Math.cos(c.yaw) * 2.4
      fx.smoke(bx, 0.4, bz)
    }
    // Engine.
    if (c.snd >= 0) {
      const name = `car${c.snd}`
      sfxLoop(name, 'engine', { x: pos.x, y: 0.6, z: pos.z }, 0.12 + Math.min(0.4, c.v * 0.04))
      engineRate(name, 0.2 + c.v * 0.08)
    }
  }

  function update(dt) {
    for (const c of [...active]) {
      if (c.state === 'parked') {
        c.lights.head.emissiveIntensity = 0.3
        c.lights.tail.emissiveIntensity = 0.2
        continue
      }
      step(c, dt)
    }
  }

  return { arrive, depart, update }
}
