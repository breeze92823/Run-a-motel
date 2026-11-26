import * as THREE from 'three'
import { ACESFilmicToneMapping, BoxGeometry, Clock, Group, Mesh, PCFSoftShadowMap, PerspectiveCamera, Scene, SRGBColorSpace, Vector3, WebGLRenderer } from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { CAMERA, MODES, PLAYER_DIMS, graphicsPreset, RENDER } from './config.js'
import * as bloxity from './bloxity.js'
import { install as installInput, onKey } from './input.js'
import { installTouch } from './touch.js'
import { createPlayerBody, interpolate as interpolatePlayer, player, resetPlayer, respawn } from './player.js'
import { setCameraSensitivity, syncYawToPlayer, update as updateCamera } from './camera.js'
import { onModeChanged, toggleMode } from './modes.js'
import { bodyCount, initPhysics, stepPhysics } from './physics.js'
import { createLighting } from './lighting.js'
import { buildGround, createWorld, landColliders } from './world.js'
import { createPostFx } from './postfx.js'
import { setNeonBloom } from './propkit.js'
import { buildDefaultCharacter, loadBaseCharacter } from './avatar/character.js'
import { applyProportions, attachEquippedAccessories } from './avatar/loader.js'
import { disposeAnimator, makeAnimator } from './avatar/animator.js'
import { createHotbar } from './hud/hotbar.js'
import { createHeld } from './held.js'
import { initUi } from './ui/index.js' // Upgrades / Hiring / Shop windows, money HUD, saves
import { RAPIER, addFixed } from './physics.js'
import { buildMotel } from './motel/building.js'
import { buildMonument, buildRoadSign, buildVacancyBoard } from './motel/signs.js'
import { buildSite } from './motel/site.js'
import { buildBus } from './motel/bus.js'
import { createParticles } from './fx/particles.js'
import { installAudio, updateAudio } from './fx/sfx.js'
import { createGame, setPhysics } from './game/game.js'
import { setAudioPaused, setMasterVolume, setMusicVolume } from './fx/mixer.js'
import { EmotePlayer, loadEmotes } from './avatar/emotes.js'
import { ui } from './ui/index.js'
import { myPlot, remoteRoster } from './net.js'
import { createRemoteMotels } from './remoteMotels.js'
import { createRemotePlayers } from './remotePlayers.js'
import { createPresence } from './presence.js'
import { pruneCasters } from './shadowCasters.js'
import { createStaticBatcher, proxyMaterials } from './staticBatch.js'
import { prepareFolded } from './bake.js'
import { createPerfHud } from './perfHud.js'
import { MAKERS as DECOR_MAKERS, makeItem, BED_OVERLAYS } from './decor/models.js'
import { makeFood } from './motel/kitchen.js'
import { makePerson, randomLook } from './motel/people.js'

// Boot order: Bloxity SDK -> renderer -> Rapier (async wasm) -> ground + sky + lighting,
// player body -> avatar (async, swaps in when ready) -> loop. The SDK is optional at every step.
let lighting = null
let renderer = null
let postfx = null

// Settings come from the portal's settings menu (or their defaults offline).
function applySetting(key, value) {
  if (key === 'camera_sensitivity') setCameraSensitivity(value)
  else if (key === 'master_volume') setMasterVolume(value)
  else if (key === 'music_volume') setMusicVolume(value)
  else if (key === 'fullscreen') bloxity.requestFullscreen(value)
  else if (key === 'graphics_quality' && renderer) {
    const next = graphicsPreset(value)
    renderer.shadowMap.enabled = next.shadows
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, next.dpr))
    lighting?.setShadows(next)
    postfx?.configure(next)
    setNeonBloom(next.bloom)
    postfx?.setSize(window.innerWidth, window.innerHeight)
  }
}
bloxity.onSetting(applySetting)
bloxity.init()

// --- Renderer ---------------------------------------------------------------
const preset = graphicsPreset(bloxity.settings.graphics_quality)
renderer = new WebGLRenderer({ antialias: preset.antialias, powerPreference: 'high-performance' })
renderer.outputColorSpace = SRGBColorSpace
renderer.toneMapping = ACESFilmicToneMapping
renderer.toneMappingExposure = RENDER.exposure
renderer.shadowMap.enabled = preset.shadows
renderer.shadowMap.type = PCFSoftShadowMap
renderer.setPixelRatio(Math.min(window.devicePixelRatio, preset.dpr))
document.body.appendChild(renderer.domElement)
installInput(() => bloxity.showMenu(), renderer.domElement) // Esc opens the portal menu

const scene = new Scene()
const camera = new PerspectiveCamera(CAMERA.fov, 1, CAMERA.near, CAMERA.far)
postfx = createPostFx(renderer, scene, camera)
postfx.configure(preset)

function resize() {
  renderer.setSize(window.innerWidth, window.innerHeight)
  postfx.setSize(window.innerWidth, window.innerHeight)
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()
}
window.addEventListener('resize', resize)
resize()

for (const key of Object.keys(bloxity.settings)) applySetting(key, bloxity.settings[key])

// --- Physics + ground + sky --------------------------------------------------
bloxity.loadingStep('Starting physics')
await initPhysics()

lighting = createLighting(scene, renderer, preset)
const world = createWorld(scene) // clouds
// Scene children each builder adds are noted: the static batcher (below) merges them.
const added = (fn) => {
  const before = scene.children.length
  const out = fn()
  return { out, objects: scene.children.slice(before) }
}
const groundAdded = added(() => buildGround(scene)) // desert, dunes, mesas, the main road; this plot's lot, sidewalk, fence
const ground = groundAdded.out
landColliders()

// --- The motel -------------------------------------------------------------------
bloxity.loadingStep('Building the motel')
const motelAdded = added(() => buildMotel(scene)) // block, rooms, office, laundry, stairs, machines
const motel = motelAdded.out
const siteAdded = added(() => buildSite(scene, lighting)) // pool, fountain, junk yard, landscaping
const site = siteAdded.out
const signsAdded = added(() => ({ road: buildRoadSign(scene), monument: buildMonument(scene, bloxity.displayName?.() || 'Your'), board: buildVacancyBoard(scene) }))
const signs = signsAdded.out
const bus = buildBus(scene)
const fx = createParticles(scene, preset.particles ?? 1)
installAudio()

// --- The road's other five motels (src/plots.js) ------------------------------------
// This client always plays on its own plot's coordinates; the server's plot number only decides
// where the road, the desert and the other motels stand round it. Plot 0 until it answers.
bloxity.loadingStep('Building the road')
const remoteMotels = createRemoteMotels(scene)
remoteMotels.setPlot(0)

createPlayerBody()
syncYawToPlayer()

// --- Player avatar ----------------------------------------------------------
// The Bloxity base rig (player.glb; procedural fallback if it fails), dressed
// with the signed-in player's equipped cosmetics and body proportions. It
// rebuilds on customizer edits and sign-in/out.
const held = createHeld(scene, camera) // the hotbar tool in hand (viewmodel + avatar's hand)
const playerGroup = new Group()
scene.add(playerGroup)
let avatar = null
let animator = null
let emotes = null // Boxity emotes on this rig (avatar/emotes.js)
let outfit = null // the platform character kit's handle while the kit dresses the rig
let generation = 0
let avatarReady = false

function setAvatar(next, kit = null) {
  if (avatar) playerGroup.remove(avatar)
  disposeAnimator(animator)
  try {
    outfit?.dispose()
  } catch {
    // The old rig is thrown away anyway.
  }
  outfit = kit
  avatar = next
  playerGroup.add(avatar)
  emotes = new EmotePlayer(avatar) // reads the bind pose: before the animator moves a bone
  animator = makeAnimator(avatar)
  held.attachAvatar(avatar, animator)
}

setAvatar(buildDefaultCharacter()) // visible immediately; replaced once the rig loads

async function loadAvatar() {
  // The SDK fires twice per change (optimistic + confirmed); only the newest load may land.
  const mine = ++generation
  try {
    const group = await loadBaseCharacter()
    if (mine !== generation) return
    // Preferred: Boxity's character kit draws the whole look (every slot, skin, body shape) on
    // our player.glb rig. Without it (switched off, custom character): the manual path.
    const kit = group.nodes?.Rig1 ? await bloxity.dressCharacter(THREE, GLTFLoader, group) : null
    if (mine !== generation) return void kit?.dispose()
    if (!kit) {
      const equipped = bloxity.authState.user ? bloxity.getEquippedAvatar() : null
      await attachEquippedAccessories(group, equipped, { skinTextureUrl: bloxity.getSkinTextureUrl() })
      if (mine !== generation) return
      applyProportions(group, bloxity.authState.user ? bloxity.getProportions() : null)
    }
    setAvatar(group, kit)
  } finally {
    if (mine === generation) avatarReady = true
  }
}

let signedIn = null
bloxity.subscribeAuth((s) => {
  const now = !!s.user
  if (now !== signedIn) {
    signedIn = now
    loadAvatar() // also runs once at start to swap in the real rig
  }
})
bloxity.onAvatarChanged(loadAvatar)
bloxity.onProportionsChanged(() => {
  if (outfit) return void loadAvatar() // the kit owns the body shape: redress with the new key
  applyProportions(avatar, bloxity.getProportions())
  held.attachAvatar(avatar, animator)
})
bloxity.onRespawnRequest(respawn)

// Emotes: Boxity's wheel picks one, the rig plays it until it ends, the player moves, or the
// portal takes it off. The catalogue loads at startup when the SDK is there.
if (bloxity.sdk()) void loadEmotes()
bloxity.onEmote((id) => (id ? emotes?.play(id) : emotes?.stop()))

// --- The other players (src/remotePlayers.js) + what they are told of this one (src/presence.js)
const remotes = createRemotePlayers({ scene, camera, THREE, GLTFLoader, getPlot: () => remoteMotels.plot })
const presence = createPresence({ emote: () => (emotes?.playing ? emotes.id : '') })

// Chat: Boxity draws the chat UI; each message shows as a bubble over its sender's head for
// Boxity's bubble time (the local player's, or the other player with that name).
bloxity.onChat((m) => {
  if (!m.bubble) return
  if (m.isLocalPlayer) bloxity.attachChatBubble(THREE, playerGroup, m.bubble, { height: PLAYER_DIMS.height + 0.55 })
  else remotes.bubble(m)
})

// Who stands on which plot (the roster): the other motels are dressed from their owners' saves.
let ownersT = 0
function syncPlots(dt) {
  const k = myPlot()
  if (k >= 0 && k !== remoteMotels.plot) {
    remoteMotels.setPlot(k)
    ground.setPlot(k)
  }
  ownersT -= dt
  if (ownersT > 0) return
  ownersT = 0.5
  const owners = new Map()
  for (const [, p] of remoteRoster()) if (p.plot >= 0) owners.set(p.plot, { name: p.username || 'Player', motel: p.motel || '' })
  remoteMotels.sync(owners)
}

// Ad breaks (Boxity may start one at any time): the simulation stops and every sound is muted.
let adBreak = false
bloxity.onAdBreak((on) => {
  adBreak = on
  setAudioPaused(on)
})

// --- Modes + keys --------------------------------------------------------------
onModeChanged((mode) => {
  playerGroup.visible = mode !== 'player' // first person: you are the camera
})
const canSwitchMode = MODES.length > 1 // first person only: no V key, no CAM button
if (canSwitchMode) onKey('KeyV', toggleMode)
onKey('KeyN', () => lighting.toggleDayNight())
onKey('KeyR', respawn)
installTouch({ mode: canSwitchMode ? toggleMode : null, day: () => lighting.toggleDayNight(), respawn })

// --- Tool hotbar (1 bag, 2 sponge, 3 vacuum, 4 mop, 5 brush, 6 hands) ----------
const hotbar = createHotbar({ onSelect: (id) => held.setTool(id) })
held.setTool(hotbar.selected)

// --- Game rules (guests, cleaning, laundry, junk yard, staff, bus) -------------------
setPhysics(addFixed, RAPIER)
const game = createGame({
  renderer,
  scene,
  camera,
  lighting,
  player,
  playerGroup,
  motel,
  site,
  signs,
  bus,
  fx,
  hotbar,
  held,
  playerName: () => {
    const n = bloxity.displayName?.()
    return !n || n === 'Offline' ? 'Your' : n
  },
})

// --- Draw-call savers (src/shadowCasters.js, src/staticBatch.js) ------------------
// Casters whose shadow cannot show stop casting; then the motel, site, signs and this plot's
// ground are merged by map cell. Whatever the game later changes is un-merged on its own.
const ownMotel = [...groundAdded.objects.filter((o) => o !== ground.block), ...motelAdded.objects, ...siteAdded.objects, ...signsAdded.objects]
for (const o of ownMotel) pruneCasters(o, [motel.laundry.basket?.group])
let batcher = null
let casterT = 0
const viewDir = new Vector3()
function startBatching() {
  const roots = ownMotel.map((root) => ({ root, cell: motelAdded.objects.includes(root) ? 10 : 24, group: motelAdded.objects.includes(root) ? 'motel' : siteAdded.objects.includes(root) ? 'site' : signsAdded.objects.includes(root) ? 'signs' : 'ground' }))
  if (game.decor?.group) roots.push({ root: game.decor.group, cell: 10, group: 'motel' }) // the furniture
  batcher = createStaticBatcher(scene, {
    roots,
    // Moving every frame: never merged.
    exclude: [motel.office.blades /* the ceiling fan */, motel.laundry.washer?.drum, motel.laundry.clock],
    // Known movers: checked every frame, so they are never drawn stale (merged again once still).
    watch: [
      ...motel.rooms.flatMap((r) => [r.boards, r.interior.bed?.group, r.door]),
      ...(motel.office.keys ?? []),
      motel.office.cashPile,
      motel.office.door?.pivot,
      motel.laundry.basket?.group,
      motel.laundry.door?.pivot,
      ...(site.yard.bags ?? []),
      ...(site.yard.junks ?? []),
    ],
  })
}

// --- Shaders, compiled while loading --------------------------------------------------
// The first time a material kind is drawn, the browser compiles its shader and the game hitches.
// Everything in the scene (hidden too) is compiled now, plus what only appears later: every piece
// of furniture, the food, a few guests, and the vertex-coloured twins the batcher will merge
// plain colours into. They are compiled with the scene's real lights, then thrown away.
async function warmShaders() {
  const extra = new Group()
  extra.name = 'shader-warmup'
  for (const id of Object.keys(DECOR_MAKERS)) extra.add(makeItem(id))
  for (const make of Object.values(BED_OVERLAYS)) extra.add(make())
  for (const kind of ['coffee', 'hotdog', 'burger']) extra.add(makeFood(kind))
  for (let i = 0; i < 6; i++) extra.add(makePerson(randomLook(i * 7 + 1)).group)
  const twins = new Set()
  scene.traverse((o) => {
    const f = o.isMesh && prepareFolded(o.material)
    if (f) twins.add(f)
  })
  extra.traverse((o) => {
    const f = o.isMesh && prepareFolded(o.material)
    if (f) twins.add(f)
  })
  for (const m of [...twins, ...proxyMaterials()]) extra.add(new Mesh(new BoxGeometry(0.1, 0.1, 0.1), m))
  extra.position.y = -500 // never seen; compile does not draw anyway
  scene.add(extra)
  const t0 = performance.now()
  try {
    await Promise.race([postfx.compile(scene), new Promise((r) => setTimeout(r, 8000))])
  } catch (err) {
    console.warn('[main] shader warm-up failed', err)
  }
  postfx.render() // one frame through the bloom passes and the shadow pass compiles theirs
  scene.remove(extra)
  if (import.meta.env.DEV) console.info(`[main] shaders compiled in ${Math.round(performance.now() - t0)} ms (${renderer.info.programs?.length ?? '?'} programs)`)
}
bloxity.loadingStep('Preparing shaders')
await warmShaders()

// --- Loop -------------------------------------------------------------------
const clock = new Clock()
let shownLoading = true
let readySince = 0

// Performance overlay (src/perfHud.js): F8 in dev, `?perf` in the address anywhere.
const perf = createPerfHud(renderer, {
  preset: () => `${bloxity.settings.graphics_quality ?? ''}`,
  extra: () => {
    const b = batcher?.stats
    return [
      b ? `batch: ${b.batched} merged in ${b.chunks} cells, ${b.live} live` : 'batch: not started',
      `road: ${remoteMotels.copies.filter((c) => c.inView).length}/${remoteMotels.copies.length} motels in view, ${remotes.count} players`,
    ]
  },
})

renderer.setAnimationLoop(() => {
  perf.begin()
  const dt = Math.min(clock.getDelta(), 0.1) // clamp huge frames (tab switch, breakpoint)
  const elapsed = clock.elapsedTime

  // An ad covers the game: nothing moves (the frame is only redrawn) until the break ends.
  if (adBreak) {
    postfx.render()
    return void perf.end()
  }

  stepPhysics(dt) // runs the player controller + world at the fixed rate, interpolates bodies
  interpolatePlayer()

  const p = player.renderPosition
  playerGroup.position.set(p.x, p.y, p.z)
  playerGroup.rotation.y = player.facing
  const speed = Math.hypot(player.velocity.x, player.velocity.z)
  animator?.update(dt, {
    grounded: player.grounded,
    speed,
    verticalVelocity: player.velocity.y,
    turn: 0,
  })
  emotes?.update(dt, speed > 0.4 || !player.grounded)

  // Screen ads: a full-screen window or the FURNISH editor is a 'panel', the rest 'gameplay'.
  if (!shownLoading) bloxity.adScreen(ui.isOpen() || game.decor?.isOpen?.() ? 'panel' : 'gameplay')

  updateCamera(camera, dt)
  held.update(dt)
  game.update(dt, elapsed)
  syncPlots(dt)
  remoteMotels.update(dt, elapsed, camera, lighting.isNight())
  remotes.update(dt)
  presence.update(dt)
  fx.setScale(renderer.domElement.height / (2 * Math.tan((camera.fov * Math.PI) / 360)))
  fx.update(dt)
  updateAudio(camera, dt, lighting.isNight() ? 1 : 0)
  world.update(dt, elapsed)
  lighting.update(dt, playerGroup.position, camera.getWorldDirection(viewDir))
  postfx.render()
  batcher?.update(dt) // after the render: the matrices it compares are fresh
  perf.end()
  casterT -= dt
  if (casterT <= 0) {
    casterT = 2
    if (game.decor?.group) pruneCasters(game.decor.group) // furniture comes and goes
  }

  // Loading ends once the scene has drawn and the avatar has had its chance (max ~5 s).
  if (shownLoading) {
    readySince += dt
    if (avatarReady || readySince > 5) {
      shownLoading = false
      bloxity.notifyFirstFrame()
      setTimeout(startBatching, 2500) // once the save has dressed the motel
    }
  }
})

window.addEventListener('beforeunload', bloxity.teardown)

initUi()

// Dev-only console hook, e.g. __game.teleport(-24, 0, 6, Math.PI / 2)
if (import.meta.env.DEV) {
  const teleport = (x, y, z, facing = player.facing) => {
    resetPlayer({ x, y, z }, facing)
    syncYawToPlayer()
  }
  window.__game = { player, scene, renderer, camera, postfx, bodies: bodyCount, toggleMode, teleport, hotbar, held, game, motel, site, bus, fx, remoteMotels, remotes, ground, get batcher() { return batcher }, emote: (id) => (id ? emotes?.play(id) : emotes?.stop()), get emotes() { return emotes }, get avatar() { return avatar } }
}
