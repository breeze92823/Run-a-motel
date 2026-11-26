// The tool in the player's hand (hotbar selection): a mint trash bag or a yellow
// sponge, nothing for HANDS.
//   First person - a viewmodel bottom-right of the view that bobs with the walk,
//                  lags a little behind mouse look, and on a switch drops the old
//                  tool out of view and springs the new one up (ease-out-back).
//   Third person - the right arm lifts forward into a hold pose and the tool sits
//                  in the hand, popping in with the same spring.
import {
  CanvasTexture,
  Color,
  ConeGeometry,
  CylinderGeometry,
  SphereGeometry,
  Group,
  LatheGeometry,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  Quaternion,
  RepeatWrapping,
  SRGBColorSpace,
  TorusGeometry,
  Vector2,
  Vector3,
} from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { HELD } from './config.js'
import { player } from './player.js'
import { getPitch, getYaw } from './camera.js'
import { isFirstPerson } from './modes.js'
import { PoseBuffer } from './avatar/rig.js'

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v)
const easeOutBack = (t) => {
  const c = 1.9
  return 1 + (c + 1) * (t - 1) ** 3 + c * (t - 1) ** 2
}
const easeIn = (t) => t * t

// --- Models (origin = where the hand grips) -------------------------------------
let shared = null
function materials() {
  if (shared) return shared
  shared = {
    bag: new MeshStandardMaterial({ color: new Color('#80e6c0'), emissive: new Color('#2f8a6a'), emissiveIntensity: 0.35, roughness: 0.38, metalness: 0 }),
    bagDark: new MeshStandardMaterial({ color: new Color('#66d2ac'), emissive: new Color('#2f8a6a'), emissiveIntensity: 0.3, roughness: 0.45, metalness: 0 }),
    tie: new MeshStandardMaterial({ color: new Color('#f4c629'), roughness: 0.45 }),
    sponge: new MeshStandardMaterial({ map: spongeTexture(), bumpMap: spongeTexture(), bumpScale: 2.2, roughness: 0.95 }),
  }
  return shared
}

// Woven sponge top: warm yellow with a grid of small dimples.
let spongeTex = null
function spongeTexture() {
  if (spongeTex) return spongeTex
  const s = 128
  const c = document.createElement('canvas')
  c.width = c.height = s
  const g = c.getContext('2d')
  g.fillStyle = '#f8c51f'
  g.fillRect(0, 0, s, s)
  const step = 8
  for (let y = 0; y < s; y += step) {
    for (let x = 0; x < s; x += step) {
      const ox = (y / step) % 2 ? step / 2 : 0
      g.fillStyle = 'rgba(214,150,10,0.55)'
      g.beginPath()
      g.ellipse(x + ox + 4, y + 4, 2.6, 2, 0, 0, Math.PI * 2)
      g.fill()
      g.fillStyle = 'rgba(255,236,140,0.5)'
      g.fillRect(x + ox + 1, y + 1, 2, 1.5)
    }
  }
  spongeTex = new CanvasTexture(c)
  spongeTex.colorSpace = SRGBColorSpace
  spongeTex.wrapS = spongeTex.wrapT = RepeatWrapping
  spongeTex.repeat.set(2, 2)
  return spongeTex
}

// Lumpy knotted trash bag, ~0.42 m tall, gripped at the knot (origin).
function buildBag() {
  const m = materials()
  const g = new Group()
  // Body: a lathed sack, wrinkled by a little angular + vertical wobble.
  const prof = [
    [0.0, -0.42], [0.09, -0.415], [0.15, -0.395], [0.19, -0.35], [0.205, -0.29], [0.2, -0.22],
    [0.175, -0.16], [0.13, -0.11], [0.08, -0.075], [0.042, -0.05], [0.026, -0.03], [0.022, -0.012],
  ].map(([r, y]) => new Vector2(r, y))
  const body = new LatheGeometry(prof, 28)
  const pos = body.attributes.position
  const v = new Vector3()
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i)
    const a = Math.atan2(v.z, v.x)
    const r = Math.hypot(v.x, v.z)
    if (r < 1e-4) continue
    const k = 1 + 0.05 * Math.sin(a * 5 + v.y * 18) + 0.03 * Math.sin(a * 11 - v.y * 30) + 0.025 * Math.sin(v.y * 45)
    pos.setXYZ(i, (v.x / r) * r * k, v.y, (v.z / r) * r * k)
  }
  body.computeVertexNormals()
  const sack = new Mesh(body, m.bag)
  g.add(sack)
  // Gathered neck flaring into pointed ears above the tie.
  const ears = 6
  for (let i = 0; i < ears; i++) {
    const ear = new Mesh(new ConeGeometry(0.05, 0.17, 5), i % 2 ? m.bagDark : m.bag)
    const a = (i / ears) * Math.PI * 2 + (i % 2) * 0.2
    const out = new Vector3(Math.cos(a), 0, Math.sin(a))
    ear.position.set(out.x * 0.04, 0.06 + (i % 2) * 0.012, out.z * 0.04)
    // Point each flap up and outward like a gathered, knotted bag neck.
    ear.lookAt(ear.position.clone().addScaledVector(out, 0.07).add(new Vector3(0, 0.1, 0)))
    ear.rotateX(Math.PI / 2)
    ear.scale.set(1, 1, 0.4)
    g.add(ear)
  }
  const tie = new Mesh(new TorusGeometry(0.03, 0.009, 8, 18), m.tie)
  tie.rotation.x = Math.PI / 2
  tie.position.y = -0.008
  tie.scale.set(1, 1.15, 1)
  g.add(tie)
  g.traverse((o) => {
    if (o.isMesh) o.castShadow = true
  })
  return g
}

// Chunky kitchen sponge, 0.17 x 0.06 x 0.11 m, centred on the grip.
function buildSponge() {
  const mesh = new Mesh(new RoundedBoxGeometry(0.17, 0.06, 0.11, 3, 0.018), materials().sponge)
  mesh.castShadow = true
  const g = new Group()
  g.add(mesh)
  return g
}

// Shared plain materials for the long-handled tools.
let toolMats = null
function tm() {
  if (toolMats) return toolMats
  const std = (color, o = {}) => new MeshStandardMaterial({ color: new Color(color), roughness: 0.5, ...o })
  toolMats = {
    red: std('#e8473f', { roughness: 0.35 }),
    bagCloth: std('#ffd2a8', { roughness: 0.95 }),
    grey: std('#8e9aa3', { metalness: 0.4, roughness: 0.35 }),
    black: std('#2e2e33'),
    wood: std('#c98b55', { roughness: 0.7 }),
    blue: std('#3d8be0', { roughness: 0.4 }),
    strings: std('#f4ead2', { roughness: 1 }),
    teal: std('#2fb3a5', { roughness: 0.4 }),
    bristle: std('#f4f2ec', { roughness: 0.9 }),
  }
  return toolMats
}
const cyl = (r0, r1, h, m, seg = 10) => {
  const mesh = new Mesh(new CylinderGeometry(r0, r1, h, seg), m)
  mesh.castShadow = true
  return mesh
}

// Upright vacuum, ~1.0 m: grip at the origin, the head down at -Y.
function buildVacuum() {
  const m = tm()
  const g = new Group()
  const grip = cyl(0.022, 0.022, 0.16, m.black)
  grip.rotation.z = Math.PI / 2
  g.add(grip)
  const pole = cyl(0.016, 0.016, 0.5, m.black)
  pole.position.y = -0.25
  g.add(pole)
  const body = new Mesh(new RoundedBoxGeometry(0.2, 0.36, 0.14, 3, 0.05), m.red)
  body.position.set(0, -0.62, 0.02)
  body.castShadow = true
  g.add(body)
  const bag = new Mesh(new RoundedBoxGeometry(0.14, 0.24, 0.04, 2, 0.02), m.bagCloth)
  bag.position.set(0, -0.6, 0.09)
  g.add(bag)
  const head = new Mesh(new RoundedBoxGeometry(0.34, 0.07, 0.18, 2, 0.03), m.grey)
  head.position.set(0, -0.84, 0.05)
  head.castShadow = true
  g.add(head)
  for (const x of [-0.13, 0.13]) {
    const w = cyl(0.03, 0.03, 0.03, m.black, 12)
    w.rotation.z = Math.PI / 2
    w.position.set(x, -0.87, -0.04)
    g.add(w)
  }
  return g
}

// Mop, ~1.1 m: wooden stick, blue clamp, a skirt of cream strings.
function buildMop() {
  const m = tm()
  const g = new Group()
  const stick = cyl(0.016, 0.016, 1.0, m.wood)
  stick.position.y = -0.45
  g.add(stick)
  const clamp = new Mesh(new RoundedBoxGeometry(0.16, 0.05, 0.06, 2, 0.02), m.blue)
  clamp.position.y = -0.96
  g.add(clamp)
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2
    const s = cyl(0.012, 0.016, 0.2, m.strings, 5)
    s.position.set(Math.cos(a) * 0.06, -1.06, Math.sin(a) * 0.04)
    s.rotation.set(Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5)
    g.add(s)
  }
  return g
}

// Toilet brush, ~0.5 m: teal handle, round white bristle head.
function buildBrush() {
  const m = tm()
  const g = new Group()
  const cap = new Mesh(new SphereGeometry(0.03, 10, 8), m.teal)
  g.add(cap)
  const handle = cyl(0.016, 0.02, 0.34, m.teal)
  handle.position.y = -0.17
  g.add(handle)
  const neck = cyl(0.012, 0.012, 0.06, m.grey)
  neck.position.y = -0.37
  g.add(neck)
  const head = new Mesh(new SphereGeometry(0.075, 14, 10), m.bristle)
  head.scale.set(1, 1.2, 1)
  head.position.y = -0.46
  head.castShadow = true
  g.add(head)
  return g
}

const BUILDERS = { trash: buildBag, sponge: buildSponge, vacuum: buildVacuum, mop: buildMop, brush: buildBrush }

// --- Switch animation state ---------------------------------------------------------
// shown: the tool on screen; wanted: the hotbar selection. A change runs
// stow (shown drops away) then equip (wanted springs up).
function makeSwitcher() {
  return { shown: null, wanted: null, phase: 'idle', t: 0 }
}

function stepSwitcher(s, dt) {
  if (s.phase === 'idle' && s.wanted !== s.shown) {
    s.phase = s.shown ? 'stow' : 'equip'
    s.t = 0
    if (!s.shown) s.shown = s.wanted
  }
  s.t += dt
  if (s.phase === 'stow' && s.t >= HELD.stowTime) {
    s.shown = s.wanted
    s.phase = s.shown ? 'equip' : 'idle'
    s.t = 0
  } else if (s.phase === 'equip' && s.t >= HELD.equipTime) {
    s.phase = 'idle'
    s.t = 0
    if (s.wanted !== s.shown) stepSwitcher(s, 0)
  }
}

// 0 = fully away, 1 = at rest (overshoots during equip).
function presence(s) {
  if (!s.shown) return 0
  if (s.phase === 'stow') return 1 - easeIn(clamp(s.t / HELD.stowTime, 0, 1))
  if (s.phase === 'equip') return easeOutBack(clamp(s.t / HELD.equipTime, 0, 1))
  return 1
}

// --- The holder -------------------------------------------------------------------
export function createHeld(scene, camera) {
  // First-person viewmodel: follows the camera each frame.
  const view = new Group()
  view.name = 'viewmodel'
  scene.add(view)
  const viewItems = {}
  for (const id in BUILDERS) {
    const item = BUILDERS[id]()
    item.visible = false
    item.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = false
        o.frustumCulled = false
      }
    })
    view.add(item)
    viewItems[id] = item
  }

  const vs = makeSwitcher()
  const hs = makeSwitcher()
  // Working: the tool scrubs / pushes back and forth while a hold task runs.
  let using = 0
  let usingWanted = false
  let usePhase = 0
  const setUsing = (on) => (usingWanted = !!on)
  let bobPhase = 0
  let bobAmp = 0
  let lastYaw = getYaw()
  let lastPitch = getPitch()
  const sway = { x: 0, y: 0 }

  // Third person: an anchor in the right hand of the current avatar.
  let hand = null // { anchor, items, animator }
  const tmpPose = new PoseBuffer()

  function attachAvatar(avatar, animator) {
    if (hand) hand.anchor.removeFromParent()
    hand = null
    const arm = avatar?.nodes?.ArmR1
    if (!arm || !animator) return
    // Measure in a clean pose: no bank / bob, arm at rest for the hand spot, then
    // the hold pose for the grip orientation (tool upright while the arm is out).
    const rot = avatar.rotation.clone()
    const posY = avatar.position.y
    avatar.rotation.set(0, 0, 0)
    avatar.position.y = 0
    animator.rig.resetToBindPose()
    avatar.updateMatrixWorld(true)
    const rootQ = avatar.getWorldQuaternion(new Quaternion())
    const armScale = arm.getWorldScale(new Vector3())
    const shoulder = arm.getWorldPosition(new Vector3())
    const down = new Vector3(0, -1, 0).applyQuaternion(rootQ)
    const back = new Vector3(0, 0, -1).applyQuaternion(rootQ)
    // The arm hangs 2.4 rig units, its mesh 0.4 units behind the pivot (character.js).
    const handWorld = shoulder.addScaledVector(down, 2.25 * armScale.y).addScaledVector(back, 0.4 * armScale.z)
    const localPos = arm.worldToLocal(handWorld.clone())

    tmpPose.reset()
    tmpPose.set('ArmR1', HELD.holdArm.x, 0, HELD.holdArm.z)
    animator.rig.applyPose(tmpPose)
    avatar.updateMatrixWorld(true)
    const armQ = arm.getWorldQuaternion(new Quaternion())
    const localQ = armQ.invert().multiply(rootQ)

    avatar.rotation.copy(rot)
    avatar.position.y = posY
    animator.rig.resetToBindPose()

    const anchor = new Group()
    anchor.name = 'held-anchor'
    anchor.position.copy(localPos)
    anchor.quaternion.copy(localQ)
    anchor.scale.set(1 / armScale.x, 1 / armScale.y, 1 / armScale.z)
    arm.add(anchor)
    const items = {}
    for (const id in BUILDERS) {
      const item = BUILDERS[id]()
      const h = HELD.hand[id]
      item.position.fromArray(h.pos)
      item.rotation.fromArray(h.rot)
      item.scale.setScalar(h.scale ?? 1)
      item.visible = false
      const pivot = new Group()
      pivot.add(item)
      anchor.add(pivot)
      items[id] = pivot
    }
    hand = { anchor, items, animator }
    hs.shown = null
    hs.phase = 'idle'
  }

  function setTool(id) {
    const tool = BUILDERS[id] ? id : null
    vs.wanted = tool
    hs.wanted = tool
  }

  const q = new Quaternion()
  const m = new Matrix4()
  function update(dt) {
    const fp = isFirstPerson()
    stepSwitcher(vs, dt)
    stepSwitcher(hs, dt)
    using += ((usingWanted ? 1 : 0) - using) * Math.min(1, dt * 10)
    usePhase += dt * (HELD.useSpeed ?? 16)
    const wob = Math.sin(usePhase) * using

    // --- first person ---
    view.visible = fp
    if (fp) {
      const speed = Math.hypot(player.velocity.x, player.velocity.z)
      const moving = player.grounded && speed > 0.5
      bobAmp += ((moving ? Math.min(1, speed / 8) : 0) - bobAmp) * (1 - Math.exp(-8 * dt))
      bobPhase += dt * (moving ? 2 + speed * 0.9 : 1.2)
      const yaw = getYaw()
      const pitch = getPitch()
      let dy = yaw - lastYaw
      if (dy > Math.PI) dy -= Math.PI * 2
      if (dy < -Math.PI) dy += Math.PI * 2
      const dp = pitch - lastPitch
      lastYaw = yaw
      lastPitch = pitch
      const k = 1 - Math.exp(-10 * dt)
      sway.x += (clamp(dy * 0.9, -0.12, 0.12) - sway.x) * k
      sway.y += (clamp(dp * 0.9, -0.12, 0.12) - sway.y) * k

      view.position.copy(camera.position)
      view.quaternion.copy(camera.quaternion)
      const p = presence(vs)
      for (const id in viewItems) {
        const item = viewItems[id]
        const on = id === vs.shown && p > 0.001
        item.visible = on
        if (!on) continue
        const cfg = HELD.view[id]
        const away = 1 - p
        const bx = Math.sin(bobPhase) * HELD.bobAmount * bobAmp
        const by = -Math.abs(Math.cos(bobPhase)) * HELD.bobAmount * bobAmp
        const idle = Math.sin(bobPhase * 0.9) * 0.004 * (1 - bobAmp)
        const tanV = Math.tan((camera.fov * Math.PI) / 360) * cfg.dist
        item.position.set(
          cfg.ndc[0] * tanV * camera.aspect + bx + sway.x * 0.35,
          cfg.ndc[1] * tanV + by + idle - away * HELD.dropDistance - sway.y * 0.25,
          -cfg.dist,
        )
        item.rotation.set(cfg.rot[0] + away * 0.6 + wob * 0.22, cfg.rot[1] + sway.x * 1.2 + wob * 0.12, cfg.rot[2] - away * 0.5 + bx * 4)
        item.position.x += wob * 0.05
        item.position.z += Math.cos(usePhase) * 0.04 * using
        item.scale.setScalar(cfg.scale)
      }
    } else {
      lastYaw = getYaw()
      lastPitch = getPitch()
    }

    // --- third person ---
    if (hand) {
      const p = presence(hs)
      for (const id in hand.items) {
        const pivot = hand.items[id]
        const on = id === hs.shown && p > 0.001
        pivot.children[0].visible = on
        if (on) {
          pivot.scale.setScalar(Math.max(0.001, p))
          pivot.rotation.x = wob * 0.35
          pivot.rotation.z = Math.cos(usePhase) * 0.2 * using
        }
      }
      // The arm stays raised while a tool is wanted or still shrinking away.
      const holding = hs.wanted || hs.shown ? 1 : 0
      hand.animator.hold = holding
    }
  }

  return { setTool, setUsing, attachAvatar, update, view }
}
