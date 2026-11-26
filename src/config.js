// Every tunable constant lives here; the rest of src/ holds no theme values.

// --- Identity -------------------------------------------------------------
export const GAME_SLUG = 'run-a-motel' // slug registered on bloxity.io
export const GAME_TITLE = 'Run a Motel'

// Forces the Bloxity SDK and avatar CDN to be treated as unavailable (see .env.example).
export const DEV_MODE = import.meta.env.VITE_DEV_MODE === 'true'

// --- World (metres: +X east, +Z south, +Y up) -------------------------------
// The motel faces south (+Z) onto its parking lot and the highway; the player
// spawns on the lot looking north at the building.
export const GROUND_Y = 0
export const WORLD = {
  // The walkable square (invisible walls on its edge; the south one is just past the highway).
  plot: { x0: -35, x1: 35, z0: -38.6 },
  // The property fence (x, z points, posts + 1.75 m colliders) round the back and sides;
  // the front is open to the sidewalk. 70 x 64.1 m up to the sidewalk = ~4487 m2
  // (deepened for the 28.5 m lot).
  fence: [[-35, 25.2], [-35, -38.6], [35, -38.6], [35, 25.2]],
  groundSize: 1400, // the visible desert plane
  sandTile: 14, // m per sand texture tile
}
// The road: PLOTS.count motel plots (one per player in the room: backend ROOM_MAX_CLIENTS), 3 on
// each side of the main road, side by side (plot width apart). Every client draws its OWN plot at
// the coordinates above (all of src/motel and src/game work in them) and the other five around it
// (src/plots.js maps plot frames; the far side is turned 180 degrees round the road's centre line).
// Slot -> column (-1 west, 0 middle, 1 east); even slots on this side, odd ones across the road, so
// the first two players face each other.
export const PLOTS = {
  count: 6,
  width: 70, // = WORLD.plot x1 - x0: neighbours share a fence line
  columns: [0, 0, -1, -1, 1, 1],
  pad: { x: 150, z: 110 }, // half-size of the flat sand round the whole road (about its centre)
  detailRange: 75, // m: a remote motel's rooms, plates and furniture are only drawn this close to the camera
  detailRangeTouch: 45, // the same on phones / tablets (weaker GPUs)
  updateRange: 110, // m: its road sign's bulbs chase this close
}

// The other players (src/remotePlayers.js, src/presence.js; backend presence.ts).
export const NET = {
  poseEvery: 0.1, // s between pose messages while moving
  poseStill: 2, // s: a player standing still re-sends this often
  lookEvery: 1, // s between checks of the outfit / emote
  remoteMax: 5, // other players drawn (the room holds 6)
  remoteEase: 10, // 1/s: how fast the drawn position catches the latest pose
  remoteLead: 0.12, // s of dead reckoning past the latest pose
  remoteStale: 1.5, // s without a pose: the player stands still
  remoteSnap: 8, // m: a jump this far is a teleport (no glide)
  remoteTagRange: [30, 90], // m: name tags fade out over this camera distance
}

export const SPAWN = { x: -7, y: 0.05, z: 5.6 }
export const SPAWN_FACING = Math.PI // yaw the character faces on spawn (PI = toward -Z)

// --- Player modes (modes.js) -------------------------------------------------
// 'character' = third-person chase cam with the avatar on screen.
// 'player' = first-person, the camera is the player's eyes and the avatar is hidden.
// First person only (third person removed); list both again to bring back V / CAM / wheel switching.
export const MODES = ['player']
export const START_MODE = 'player'

// --- Physics (physics.js, player.js) ------------------------------------------
export const PHYSICS = {
  gravity: -22, // m/s^2 for dynamic bodies and the player
  fixedStep: 1 / 60, // s per physics tick; rendering interpolates between ticks
  maxSubSteps: 5, // a long frame never runs more ticks than this
  walkSpeed: 5.5, // m/s
  sprintSpeed: 9.5, // m/s with Shift held
  accel: 70, // m/s^2 toward the target velocity on the ground
  airAccel: 22, // m/s^2 steering while airborne
  decel: 60, // m/s^2 when no key is held
  turnSpeed: 12, // rad/s the body turns toward its heading
  jumpSpeed: 8.5, // m/s
  coyoteTime: 0.1, // s after leaving a ledge a jump still counts
  jumpBuffer: 0.12, // s a jump pressed before landing is remembered
  stepHeight: 0.45, // m autostep
  maxSlope: 50, // degrees the player can walk up
  snapToGround: 0.4, // m the controller stays glued to downward steps and slopes
  pushMass: 80, // kg the character weighs when shoving crates
  killY: -6, // sank this far: respawn
}
export const PLAYER_DIMS = { radius: 0.38, height: 1.8 } // capsule the character controller moves (0.76 m wide: fits the 1.12 m room doors and 0.95 m bathroom doorways)

// --- Look ------------------------------------------------------------------
export const RENDER = { exposure: 1.0 }
export const FOG = { near: 140, far: 560 }
// The two lighting moods lighting.js blends between (key N toggles).
export const TIME_OF_DAY = {
  transition: 2.5, // s to blend day <-> night
  day: {
    zenith: '#2f8fe8',
    horizon: '#bfe6ff',
    sunColor: '#fff1d6',
    // Warm desert afternoon: strong sun, sand-bounced fill.
    sunIntensity: 2.7,
    sunElevation: 52, // degrees above the horizon
    sunAzimuth: 28, // degrees, 0 = from +Z
    hemiSky: '#dff0ff',
    hemiGround: '#e2b97c',
    hemiIntensity: 0.85,
    envIntensity: 0.5,
    lampIntensity: 0,
    stars: 0,
    exposure: 0.95,
  },
  night: {
    zenith: '#050b22',
    horizon: '#24345e',
    sunColor: '#9fb4ff', // the moon
    sunIntensity: 0.55,
    sunElevation: 38,
    sunAzimuth: -60,
    hemiSky: '#3a4c80',
    hemiGround: '#1a1a22',
    hemiIntensity: 0.35,
    envIntensity: 0.25,
    lampIntensity: 30,
    stars: 1,
    exposure: 1.15,
  },
}
export const LIGHT = {
  shadowRange: 46, // half-width of the sun's shadow box (sharper than a bigger box, same map)
  shadowAhead: 0.32, // the box sits this much of its half-width ahead of the player, toward the view
  // Shadow casters (src/shadowCasters.js): pieces under this radius cast no shadow (under ~2 shadow
  // texels), nor do pieces inside a roofed room this far behind its front wall (the sun cannot reach).
  shadowMinRadius: 0.05,
  indoorSunReach: 2.6,
  lampColor: '#ffb35c',
  lampDistance: 22,
}

// Default (fallback) character look, used only when player.glb cannot load.
export const CHARACTER_COLORS = { skin: '#f2c79a', suit: '#2f6fd0', hair: '#4a2f1c' }

export const MATERIAL_PBR = {
  PLAYER: { roughness: 0.7, metalness: 0 },
  GROUND: { roughness: 0.95, metalness: 0 },
}

// --- Graphics presets, picked by the Bloxity graphics_quality setting ----------
export const GRAPHICS_PRESETS = {
  Low: { shadows: false, shadowMap: 512, antialias: false, dpr: 1, bloom: false, particles: 0.35 },
  Medium: { shadows: true, shadowMap: 1024, antialias: false, dpr: 1.25, bloom: false, particles: 0.6 },
  High: { shadows: true, shadowMap: 2048, antialias: true, dpr: 2, bloom: true, particles: 1 },
  Ultra: { shadows: true, shadowMap: 4096, antialias: true, dpr: 2, bloom: true, particles: 1 },
}

// Bloom (postfx.js): only HDR-bright pixels (above threshold, linear, before
// tone mapping) glow: neon rails, waterfall, VIP gate, particles. Sunlit sand
// stays under the threshold.
export const BLOOM = { strength: 0.6, radius: 0.35, threshold: 2.0 }
// Neon materials (propkit.js): k = HDR colour multiplier with bloom on; with
// bloom off they are capped at plainMax so they stay coloured, not white.
export const NEON = { k: 3.5, plainMax: 1.2 }

// Phones and tablets default to a lighter preset when the portal sends no value,
// and any preset is capped there (a phone at DPR 3 renders 9x the pixels; bloom
// is a full-screen multi-pass blur, so it stays off on phones).
export const COARSE_POINTER = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches
export const DEFAULT_GRAPHICS = COARSE_POINTER ? 'Medium' : 'High'
export const MOBILE_GRAPHICS_CAP = { dpr: 1.5, shadowMap: 1024, particles: 0.6 }

// The preset to render with on this device.
export function graphicsPreset(name) {
  const p = GRAPHICS_PRESETS[name] ?? GRAPHICS_PRESETS[DEFAULT_GRAPHICS]
  if (!COARSE_POINTER) return p
  const cap = MOBILE_GRAPHICS_CAP
  return { ...p, dpr: Math.min(p.dpr, cap.dpr), shadowMap: Math.min(p.shadowMap, cap.shadowMap), bloom: false, particles: Math.min(p.particles, cap.particles) }
}

// --- Touch controls (touch.js) --------------------------------------------------
export const TOUCH = {
  deadZone: 0.12, // fraction of the joystick radius that does nothing
  lookScale: 1.5, // touch drag pixels -> look, relative to a mouse pixel
  pinchPixelsPerNotch: 30, // finger spread change that equals one wheel notch
}

// --- Camera (camera.js) -------------------------------------------------------
export const CAMERA = {
  fov: 70,
  near: 0.1,
  far: 1200,
  startPitch: 0.14, // radians above the horizon (low chase cam)
  minPitch: -0.35,
  maxPitch: 1.25,
  firstPersonPitch: 1.45, // |pitch| limit looking up/down in player mode
  eyeHeight: 0.92, // eye height as a fraction of player height (player mode)
  distance: 12.4, // resting boom length, m
  minDistance: 2.5, // wheel in past this enters player mode
  maxDistance: 26,
  followLerp: 14, // 1/s: the one smoothing stage, on the point the camera follows
  targetHeight: 1.2, // look-at point as a fraction of player height
  lookSensitivity: 0.0026, // rad per pixel of mouse movement
  zoomStep: 0.9, // m per wheel notch
  zoomEase: 12, // 1/s the zoom glides to its target
  speedFov: 6, // degrees the FOV widens at sprint speed
  speedEase: 3, // 1/s the speed framing eases in and out
  clearEase: 6, // 1/s the boom eases back out once a wall stops blocking it
}

// --- Bloxity (bloxity.js, avatar/) -------------------------------------------------
// SDK setting keys this game listens for; registering a listener makes the control
// appear in the portal's settings menu.
export const SETTINGS = {
  graphics_quality: { def: DEFAULT_GRAPHICS, type: 'enum', values: ['Low', 'Medium', 'High', 'Ultra'] },
  camera_sensitivity: { def: '1', type: 'number', min: 0.1, max: 5 },
  show_fps: { def: 'false', type: 'bool' },
  fullscreen: { def: 'false', type: 'bool' },
  // Boxity's menu sliders, "0".."100" (src/fx/mixer.js): every sound, and the ambience (wind,
  // birds, crickets: the game has no music track, so music_volume drives that bed).
  master_volume: { def: '80', type: 'number', min: 0, max: 100 },
  music_volume: { def: '80', type: 'number', min: 0, max: 100 },
}

// The base rig, measured from player.glb: origin at the feet, 6.4 units tall at bind pose.
export const RIG_HEIGHT = 6.4
// Bind-pose values of the rig nodes the SDK proportions drive.
export const RIG = { armOffsetX: 2, legOffsetX: 0.6, neckOffsetY: 0.6 }
// getProportions() ranges, straight from the SDK spec; clamped before they reach the scene graph.
export const PROPORTIONS = {
  height: { def: 1, min: 0.5, max: 1.6 },
  shoulderWidth: { def: 1, min: 0.5, max: 1.5 },
  armLength: { def: 1, min: 0.05, max: 3 },
  legOffsetX: { def: 1, min: -0.7, max: 5 },
  torsoScaleX: { def: 1, min: 0.3, max: 2 },
  neckHeight: { def: 1, min: 0.94, max: 1.2 },
  headScale: { def: 1, min: 0.3, max: 2.6 },
}

// Procedural animation (avatar/animator.js), ported from Clean Leaves for Loot.
// Rotations are radians in CHARACTER space: +X swings a limb backward, +Y yaws, +Z rolls.
const deg = (d) => (d * Math.PI) / 180
export const ANIM = {
  airborneDelay: 0.07, // s off the ground before the air pose (ignores a step down a ledge)
  // Walk -> run is one cycle at two depths; phase advances with distance travelled.
  locomotion: {
    minFrequency: 0.7,
    maxFrequency: 3.6,
    strideDistance: 3.8, // m per cycle
    idleSpeed: 0.6,
    walkSpeed: 2.5,
    runSpeed: 8,
    sprintSpeed: 13,
    hipSwing: { walk: deg(22), run: deg(42), sprint: deg(56) },
    kneeBend: { walk: deg(30), run: deg(58), sprint: deg(72) },
    armSwing: { walk: deg(18), run: deg(36), sprint: deg(52) },
    elbowBend: { walk: deg(14), run: deg(44), sprint: deg(70) },
    torsoTwist: { walk: deg(4), run: deg(7), sprint: deg(9) },
    torsoLean: { walk: deg(3), run: deg(10), sprint: deg(18) },
    headCounterTwist: { walk: deg(2), run: deg(4), sprint: deg(5) },
    torsoRoll: { walk: deg(2), run: deg(3), sprint: deg(3) },
    bob: { walk: 0.03, run: 0.07, sprint: 0.09 }, // m, on the avatar root
    bankAngle: deg(9),
    bankRate: 8,
  },
  idle: {
    breathFrequency: 0.35,
    breathAmount: deg(1.8),
    breathBob: 0.007,
    basePose: {
      ArmL1: { x: deg(-4), z: deg(8) },
      ArmL2: { x: deg(12) },
      ArmR1: { x: deg(-4), z: deg(-8) },
      ArmR2: { x: deg(12) },
      LegL1: { x: deg(-4) },
      LegR1: { x: deg(4) },
    },
  },
  airborne: {
    rise: {
      LegL1: { x: deg(-38) }, LegR1: { x: deg(8) }, LegL2: { x: deg(62) }, LegR2: { x: deg(40) },
      ArmL1: { x: deg(-40), z: deg(34) }, ArmR1: { x: deg(-30), z: deg(-34) },
      ArmL2: { x: deg(30) }, ArmR2: { x: deg(30) }, Spine1: { x: deg(6) },
    },
    fall: {
      LegL1: { x: deg(-14) }, LegR1: { x: deg(10) }, LegL2: { x: deg(22) }, LegR2: { x: deg(18) },
      ArmL1: { x: deg(-70), z: deg(40) }, ArmR1: { x: deg(-60), z: deg(-40) },
      ArmL2: { x: deg(20) }, ArmR2: { x: deg(20) }, Spine1: { x: deg(-4) },
    },
    velocityReference: 8, // m/s vertical speed that reads as fully rising / falling
  },
  landing: {
    duration: 0.16,
    pose: {
      LegL1: { x: deg(-34) }, LegR1: { x: deg(-34) }, LegL2: { x: deg(58) }, LegR2: { x: deg(58) },
      ArmL1: { x: deg(-18), z: deg(20) }, ArmR1: { x: deg(-18), z: deg(-20) }, Spine1: { x: deg(14) },
    },
    bobY: -0.2,
  },
  transitions: { toLocomotion: 0.14, toAirborne: 0.12, toLanding: 0.06 }, // s to blend a pose change
}

export const FONT_FAMILY = 'Fredoka'

export function clamp(n, min, max) {
  return n < min ? min : n > max ? max : n
}

// Coerce one raw SDK string against its SETTINGS entry.
export function coerceSetting(key, raw) {
  const spec = SETTINGS[key]
  if (!spec) return raw
  const value = raw === '' || raw == null ? spec.def : raw
  if (spec.type === 'bool') return value === 'true' || value === true
  if (spec.type === 'enum') return spec.values.includes(value) ? value : spec.def
  const n = Number(value)
  return clamp(Number.isFinite(n) ? n : Number(spec.def), spec.min, spec.max)
}

// --- Motel layout (metres; see motel/*.js) ----------------------------------------
// The two-storey block faces south (+Z). Ground floor: the office at its west
// end, then rooms 101..106; the 2nd floor (201..207) opens in a later phase.
export const LAYOUT = {
  road: { z: 34, width: 12 },
  sidewalk: { z0: 25.5, z1: 28 },
  // Three rows of 5 stalls (one by the walkway, a back-to-back pair mid-lot) with aisles
  // between; the west strip (x0..-12) is the walk-in lane up to the office.
  lot: { x0: -18, x1: 4, z0: -3, z1: 25.5, rows: [2.2, 13.6, 18.8] },
  building: { x0: -20, x1: 26, front: -6, depth: 10, floorH: 3.7, walk: 3.4 },
  office: { x0: -20, x1: -12 },
  rooms: { x0: -12, x1: 26, count: 6, first: 101 }, // ground floor
  upper: { x0: -20, x1: 26, count: 7, first: 201 }, // locked 2nd floor
  laundry: { x0: -28, x1: -20, front: -4, back: -12.5, height: 4.3 },
  stairs: { x0: 26.6, x1: 29, zBottom: 1.2, zTop: -3.4 },
  // Front strip by the sidewalk: fountain west of the lot, signs east of it.
  fountain: { x: -26.5, z: 1.6, r: 3.2, plaza: 1.6 },
  sign: { x: 32.3, z: 23.8 },
  // Behind the building, east of the junk yard.
  pool: { x0: 11, x1: 22, z0: -32.5, z1: -23.5, depth: 1.6, deck: { x0: 7, x1: 31, z0: -36.1, z1: -19.9 } },
  monument: { x: 11, z: 21.6 },
  vacancyBoard: { x: 21.5, z: 22.5 },
  busStop: { x: -6, z: 27 },
  busLaneZ: 30.6,
  // NPC lanes between the bus stop and the building: along the sidewalk, at the curb,
  // and across the lot aisle (the walkers then head up SPINE_X in game.js).
  npc: { streetZ: 26.2, curbZ: 25, lotZ: 24.2 },
  // Junk yard behind the building: a plank fence with the gate in its south side at the
  // west end (gate.side 'south' with x0/x1, or 'west' with z0/z1), the dumpster inside,
  // trash bags and big junk to clear out.
  junkYard: { x0: -26, x1: 0, z0: -35, z1: -22, gate: { side: 'south', x0: -26, x1: -21 } },
  dumpster: { x: -3.5, z: -24.4 },
  // Office (walk-in): the counter runs across the lobby; the player checks guests
  // in from behind it, guests line up in front and out of the door.
  officeDoorX: -17.6,
  counterZ: -10.6,
  deskPoint: { x: -16.6, z: -11.8 },
  queue: [[-16.6, -9.4], [-17.6, -8.0], [-17.6, -4.6], [-16.2, -4.0], [-14.8, -4.0], [-13.4, -4.0]],
  laundryPoint: { x: -24, z: -10.4 }, // inside the laundry, at the washer
  // Front desk (behind the counter): the ROOM KEYS board on the west wall, the cash pile next
  // to the register, the phone on the counter's return (room service calls).
  keyBoardPoint: { x: -19.0, z: -12.8 },
  cashPile: { x: -15.95, z: -10.95 }, // on the counter top
  cashPoint: { x: -15.95, z: -11.8 }, // where the player collects it
  phone: { x: -14.75, z: -12.75 }, // on the return counter
  phonePoint: { x: -15.5, z: -12.75 },
  // Food: three stations along the office's back wall, behind the counter (x = centre; the
  // player works them from z = stationZ + 0.95). Walk-in customers wait at the west end.
  stations: { coffee: -18.65, hotdog: -16.95, burger: -15.3 },
  stationZ: -15.3,
  foodServe: { x: -18.9, z: -11.8 }, // player side of the counter
  foodQueue: [[-18.9, -9.4], [-19.2, -8.2], [-19.2, -7.0]],
}

// --- Economy & rules (game/*.js). Everything is bought with money ($): the game
// has no premium currency.
export const ECONOMY = {
  startMoney: 60,
  startRating: 3.8,
  startCleanSets: 8, // enough for the first guests: the first wash comes much later
  busEvery: 75, // s between buses
  firstBus: 14, // s until the first bus
  nights: [1, 3], // a guest books 1..3 nights: pays price x nights
  nightSeconds: 22, // s one night lasts in the room
  deskPatience: 80, // s a guest waits at the desk before leaving unhappy (until you talk)
  noRoomPatience: 0.5, // patience runs this fast while no room is ready (you are cleaning one)
  // Rooms start at 1 star; each upgrade adds one. The type follows the stars.
  roomTypes: [
    { id: 'regular', name: 'REGULAR', minStars: 1, priceAdd: 0 },
    { id: 'comfort', name: 'COMFORT', minStars: 3, priceAdd: 18 },
    { id: 'deluxe', name: '5-STAR', minStars: 5, priceAdd: 52 },
  ],
  basePrice: [40, 44, 48, 52, 56, 60], // ground floor rooms 101..106 (a night)
  // Furniture bought for a room: each adds a star and raises the nightly price.
  roomUpgrades: null, // = DECOR.items (set below): furniture, one per slot, bought in FURNISH mode
  touristChance: 0.3, // a bus is a tour bus: its guests pay x touristPay
  touristPay: 1.3,
  openRooms: 1, // rooms open at the start (101); open the rest at their doors
  unlockRoom: [0, 120, 300, 650, 1300, 2500], // price to open each ground-floor room (~x2 a room: quick first rooms, slower later)
  // Cleaning a room after checkout (s of holding E; cleanSpeedMul divides them).
  zoneExtra: 0.35, // a zone hold (vacuum / mop / sponge) takes this share of a spot's time per extra spot
  stripTime: 1.2, // strip the used sheets (HANDS)
  makeTime: 1.6, // make the bed with a clean set (HANDS)
  vacuumTime: 1.4, // one dusty patch of carpet (VACUUM)
  mopTime: 1.5, // one muddy patch of floor (MOP)
  scrubTime: 1.6, // one carpet stain (SPONGE)
  toiletTime: 2.2, // the toilet (BRUSH)
  sinkTime: 1.5, // the bathroom sink + mirror (SPONGE)
  roomLitter: [2, 4], // trash left inside a room at checkout (BAG)
  roomStains: [1, 2], // carpet stains
  roomDust: [2, 3], // dusty carpet patches
  roomMud: [2, 3], // muddy footprints / puddles
  washLoad: 4, // clean sets per wash
  washTime: 16, // s per wash
  trashCapacity: 12,
  trashPay: 2, // $ per piece dumped
  litterEvery: 28, // s between new pieces of litter on the lot
  litterMax: 24,
  grimeMax: 8,
  grimeEvery: 42, // s between new grime stains
  yardBags: 14, // trash bags lying in the junk yard at the start
  yardJunk: 7, // big junk pieces (carried by hand, one at a time)
  yardBagPay: 3,
  yardJunkPay: 12,
  yardReward: 150, // bonus for clearing the whole yard
  carrySlow: 0.7, // walk speed while carrying big junk
  fountainCost: 60,
  fountainTime: 2.5,
  ratingWeight: 0.12, // how far one review moves the motel rating
}

// --- Pacing (src/game/pacing.js): easy at the start, steeper as the motel grows. `heat` =
// (open rooms - 1) x perRoom + franchise level x perFranchise; heat 0 (one room, first run) is
// the plain game. Demand grows with the rooms so every room bought earns more; the work grows
// with heat so staff and upgrades matter later.
// --- Drive-in guests (game.js driveIn, game/cars.js): between buses guests come by car, park on
// the lot and walk to the office, whether a room is ready or not (they wait while you clean), so
// there is always someone to serve. They drive off again at checkout (or if they give up).
export const DRIVE_IN = {
  first: 6, // s until the first car
  every: [20, 32], // s between cars at heat 0; / (1 + heat x perHeat) as the motel grows
  perHeat: 0.5,
  maxQueue: 3, // no new car while this many guests already wait at the desk
}

export const PACING = {
  heat: { perRoom: 1 / 9, perFranchise: 0.2, max: 1.6 },
  // Guests per bus: min = 1 + floor(open / minPerRooms), max = 1 + ceil(open x maxPerRoom)
  // (never below the old min(3, open + 1)), both capped by the desk queue.
  busGuests: { minPerRooms: 4, maxPerRoom: 0.5, cap: 6 },
  // Bus gap x (1 - (rating - at) x perStar), clamped: 5 stars ~x0.78, 2 stars ~x1.23.
  busRating: { at: 3.5, perStar: 0.15, min: 0.75, max: 1.3 },
  busRoomsCut: 3, // s off the bus gap for each open room after the first
  minBusGap: 15, // s, the shortest gap anything (adverts too) can make
  rush: { fromRooms: 3, chance: 0.1, perHeat: 0.1, extra: 2 }, // RUSH HOUR bus: +extra guests
  // What heat 1 does (linear in heat):
  patienceCut: 0.35, // desk patience x (1 - heat x patienceCut)
  messExtra: 2, // + trash / dust / stains / mud at checkout
  spawnFaster: 0.8, // lot litter, grime, graffiti, posters x(1 + heat x spawnFaster) as often
  walkInFaster: 0.6, // food walk-ins
}

// --- Food (game/food.js, motel/kitchen.js). Every item is made by hand in 3 steps (hold E
// on the station); an AUTO machine upgrade runs the steps by itself and Mia makes and
// serves everything. Coffee is open from the start; the stands are unlocked with money.
export const FOOD = {
  coffee: {
    name: 'COFFEE', icon: '☕', price: 6, station: 'COFFEE BAR', where: 'COFFEE BAR',
    steps: [{ text: 'TAKE A CUP', hold: 0.6 }, { text: 'BREW THE COFFEE', hold: 1.8 }, { text: 'PUT THE LID ON', hold: 0.7 }],
    take: 'TAKE THE COFFEE', unlock: null, unlockPrice: 0, auto: 'autoCoffee', autoTime: 8,
  },
  hotdog: {
    name: 'HOT DOG', icon: '🌭', price: 12, station: 'HOT DOGS', where: 'GRILL',
    steps: [{ text: 'GRILL THE SAUSAGE', hold: 2.2 }, { text: 'ADD A BUN', hold: 0.8 }, { text: 'ADD KETCHUP & MUSTARD', hold: 1.2 }],
    take: 'TAKE A HOT DOG', unlock: 'hotdogStand', auto: 'autoHotdog', autoTime: 11,
  },
  burger: {
    name: 'BURGER', icon: '🍔', price: 20, station: 'BURGERS', where: 'BURGER GRILL',
    steps: [{ text: 'GRILL THE PATTY', hold: 2.6 }, { text: 'STACK THE BURGER', hold: 1.4 }, { text: 'WRAP IT UP', hold: 0.9 }],
    take: 'TAKE A BURGER', unlock: 'burgerGrill', auto: 'autoBurger', autoTime: 14,
  },
}
export const FOOD_RULES = {
  walkInEvery: [20, 34], // s between walk-in customers at the office (coffee from the start)
  walkInFirst: 8,
  walkInMax: 3,
  walkInPatience: 80, // s a walk-in waits for the order
  callChance: 0.6, // a guest in a room calls room service once per stay
  callDelay: [5, 14], // s after they settle in
  ringTime: 25, // s the phone rings before they give up
  orderTime: 95, // s to bring a room service order
  roomServiceTip: 0.5, // room service pays price x (1 + tip)
  miaStepTime: 1.6, // s Mia spends on each step (her speed level shortens it)
}

// --- Curb appeal (game/curb.js): litter on the parking lot, grime on the walkway, graffiti
// and posters on the outside walls. It never stops guests coming (that killed the start):
// below `fewerBelow` % one guest fewer gets off each bus, below `fewestBelow` only half of them
// (at least one), drive-in cars and food walk-ins come less often, and a dirty lot means
// poorer guests (decor attraction) and lower reviews.
export const CURB = {
  graffitiEvery: [75, 115], // s between new graffiti
  posterEvery: [55, 85], // s between new posters
  graffitiMax: 6,
  posterMax: 8,
  startGraffiti: 1,
  startPosters: 1,
  grace: 120, // s before the first new graffiti / poster on a new motel (the start stays tidy)
  graffitiTime: 2.2, // s to scrub graffiti off (SPONGE)
  posterTime: 0.8, // s to tear a poster down (HANDS)
  cost: { litter: 1.2, grime: 2.2, graffiti: 7, poster: 4 }, // % appeal lost per piece
  startLitter: 3, // lot litter / walkway grime at the start (the motel opens looking fine)
  startGrime: 1,
  lowKeep: 0.5, // below fewestBelow: this share of a bus's guests still get off (at least 1)
  lowSlow: 1.8, // below fewerBelow: drive-ins and walk-ins come this much less often (x2 below fewestBelow)
  fewestBelow: 35,
  fewerBelow: 60,
  cleanBonus: 2, // $ for each graffiti / poster removed
}

export const SHOP = [
  { id: 'bigBag', name: 'Big Trash Bag', desc: 'Carry 25 pieces of trash', price: 150, icon: 'bag' },
  { id: 'turboSponge', name: 'Turbo Sponge', desc: 'Scrub stains twice as fast', price: 120, icon: 'sponge' },
  { id: 'shoes', name: 'Running Shoes', desc: 'Walk and sprint 25% faster', price: 220, icon: 'shoes' },
  { id: 'cart', name: 'Laundry Cart', desc: 'Washes give 7 clean sets', price: 300, icon: 'cart' },
]

export const STAFF = [
  { id: 'maid', name: 'Housekeeper', desc: 'Cleans dirty rooms on their own (uses clean sets)', price: 450, icon: 'maid' },
  { id: 'clerk', name: 'Desk Clerk', desc: 'Checks guests in when you are away', price: 600, icon: 'clerk' },
]

// --- Hotbar + held tools (hud/hotbar.js, held.js, fx/tools-sfx.js) -------------------
// Bottom-centre tool bar. `key` is the number shown on the slot and the key that
// selects it (Digit/Numpad); a slot without `label` shows the trash count.
export const HOTBAR = {
  slots: [
    { id: 'trash', key: '1' },
    { id: 'sponge', key: '2', label: 'SPONGE' },
    { id: 'vacuum', key: '3', label: 'VACUUM' },
    { id: 'mop', key: '4', label: 'MOP' },
    { id: 'brush', key: '5', label: 'BRUSH' },
    { id: 'hands', key: '6', label: 'HANDS' },
  ],
  start: 'hands',
}

// The tool models and how they are held. Sizes are metres.
export const HELD = {
  // First person: the tool floats bottom-right of the view. `ndc` is where its
  // grip sits on screen (-1..1, so it stays put on any aspect), `dist` how far in
  // front of the eye (m), `rot` its tilt (rad, camera space).
  view: {
    trash: { ndc: [0.42, -0.1], dist: 0.9, rot: [0.22, -0.35, 0.06], scale: 0.5 },
    sponge: { ndc: [0.3, -0.5], dist: 0.6, rot: [0.95, 0.2, 0.35], scale: 1.45 },
    vacuum: { ndc: [0.38, -0.55], dist: 1.0, rot: [0.5, -0.3, 0.1], scale: 0.75 },
    mop: { ndc: [0.4, -0.6], dist: 1.0, rot: [0.55, -0.3, 0.15], scale: 0.7 },
    brush: { ndc: [0.36, -0.45], dist: 0.75, rot: [0.6, -0.2, 0.2], scale: 0.9 },
  },
  equipTime: 0.32, // s for the new tool to rise into view (ease-out-back)
  stowTime: 0.12, // s for the old tool to drop out of view first
  dropDistance: 0.35, // m the tool travels below its rest spot
  bobAmount: 0.012, // m view bob per stride while walking
  swayAmount: 0.0009, // rad of lag per pixel of mouse look
  // Third person: the right arm is raised forward and the tool sits in the hand.
  holdArm: { x: deg(-88), z: deg(-4) },
  holdEase: 12, // 1/s the arm blends into / out of the hold pose
  hand: {
    trash: { pos: [0, -0.1, 0.03], rot: [0, 0, 0], scale: 1.25 },
    sponge: { pos: [0, -0.01, 0.13], rot: [0.25, 0, 0], scale: 1.15 },
    vacuum: { pos: [0, -0.05, 0.05], rot: [-1.15, 0, 0], scale: 1 },
    mop: { pos: [0, -0.05, 0.05], rot: [-1.15, 0, 0], scale: 1 },
    brush: { pos: [0, -0.02, 0.06], rot: [-1.0, 0, 0], scale: 1 },
  },
  useSpeed: 16, // rad/s of the scrub / push-pull motion while working
}

// Hotbar tool sounds (fx/tools-sfx.js); volume is 0..1.
export const TOOL_SFX = { volume: 0.6 }

// --- Furnishing (src/decor/*): furniture, wallpapers, floors, room stars, looks and the
// guest wealth tiers. Every price is money ($): nothing in the game is sold for a premium
// currency, so the reference's Robux items carry a fair, slightly high money price.
export const DECOR = {
  // Points needed for 1..5 stars (index = stars - 1); `requires` gates a star on top.
  starPoints: [0, 1, 3, 6, 10],
  requires: [
    { id: 'bath', stars: 3, label: 'SINK OR TUB', icon: 'vanity', anyOf: ['vanity', 'tub'] },
    { id: 'tv', stars: 4, label: 'A TV', icon: 'tv', anyOf: ['tv', 'bigTv'] },
    { id: 'bigBed', stars: 5, label: 'A KING OR MAGIC BED', icon: 'kingBed', slotPts: { slot: 'bed', pts: 3 } },
    { id: 'tub', stars: 5, label: 'A CLAWFOOT TUB', icon: 'tub', anyOf: ['tub'] },
  ],
  baseStyle: 8, // a plain room's looks score (0..100)
  matchStyle: 8, // a wall / floor that MATCHES the furniture
  stylePrice: 0.3, // $ a night per looks point
  looks: [
    { min: 0, name: 'PLAIN', color: '#9fb3b0' },
    { min: 20, name: 'CUTE', color: '#5cbf4a' },
    { min: 40, name: 'STYLISH', color: '#2aa596' },
    { min: 60, name: 'CHIC', color: '#8a62c9' },
    { min: 80, name: 'LUXURY', color: '#e3a417' },
  ],
  categories: [
    { id: 'all', name: 'ALL ITEMS', icon: 'bed' },
    { id: 'beds', name: 'BEDS', icon: 'kingBed' },
    { id: 'seating', name: 'SEATING', icon: 'deskChair' },
    { id: 'tables', name: 'TABLES', icon: 'sideTable' },
    { id: 'storage', name: 'STORAGE', icon: 'dresser' },
    { id: 'decor', name: 'DECOR', icon: 'painting' },
    { id: 'electronics', name: 'ELECTRONICS', icon: 'tv' },
    { id: 'bath', name: 'BATH', icon: 'tub' },
  ],
  // pts = comfort points (stars), nightly = $ a night, style = looks points, tone = colour
  // mood (walls / floors with that tone MATCH), minStars = room stars needed to buy it.
  // One item per slot; owned items stay in the room's storage and can be swapped back free.
  items: [
    { id: 'bed', name: 'Comfy Bed', cat: 'beds', slot: 'bed', price: 240, pts: 2, nightly: 14, style: 3, tone: 'rose' },
    { id: 'kingBed', name: 'King Bed', cat: 'beds', slot: 'bed', price: 700, pts: 3, nightly: 24, style: 8, tone: 'teal' },
    { id: 'starBed', name: 'Magic Bed', cat: 'beds', slot: 'bed', price: 1500, pts: 3, nightly: 38, style: 16, tone: 'lilac', minStars: 4 },
    { id: 'deskChair', name: 'Desk Chair', cat: 'seating', slot: 'seat', price: 45, pts: 1, nightly: 3, style: 1, tone: 'rose' },
    { id: 'armchair', name: 'Armchair', cat: 'seating', slot: 'seat', price: 160, pts: 1, nightly: 7, style: 4, tone: 'teal' },
    { id: 'loveseat', name: 'Loveseat', cat: 'seating', slot: 'seat', price: 420, pts: 2, nightly: 13, style: 7, tone: 'rose', minStars: 2 },
    { id: 'sideTable', name: 'Side Table', cat: 'tables', slot: 'table', price: 50, pts: 1, nightly: 3, style: 1, tone: 'wood' },
    { id: 'desk', name: 'Writing Desk', cat: 'tables', slot: 'table', price: 180, pts: 1, nightly: 6, style: 3, tone: 'wood' },
    { id: 'coffeeTable', name: 'Glass Table', cat: 'tables', slot: 'table', price: 380, pts: 2, nightly: 12, style: 6, tone: 'gold', minStars: 3 },
    { id: 'nightstand', name: 'Nightstand', cat: 'storage', slot: 'night', price: 45, pts: 1, nightly: 3, style: 1, tone: 'wood' },
    { id: 'fileCabinet', name: 'File Cabinet', cat: 'storage', slot: 'storage', price: 50, pts: 1, nightly: 2, style: 0, tone: 'sky' },
    { id: 'toyChest', name: 'Toy Chest', cat: 'storage', slot: 'storage', price: 60, pts: 1, nightly: 4, style: 2, tone: 'teal' },
    { id: 'dresser', name: 'Dresser', cat: 'storage', slot: 'storage', price: 90, pts: 1, nightly: 6, style: 2, tone: 'wood' },
    { id: 'bookcase', name: 'Bookcase', cat: 'storage', slot: 'storage', price: 120, pts: 1, nightly: 7, style: 3, tone: 'wood' },
    { id: 'vanityTable', name: 'Vanity Table', cat: 'storage', slot: 'storage', price: 140, pts: 1, nightly: 8, style: 5, tone: 'lilac' },
    { id: 'tableLamp', name: 'Table Lamp', cat: 'decor', slot: 'lamp', price: 40, pts: 1, nightly: 2, style: 2, tone: 'teal' },
    { id: 'floorLamp', name: 'Floor Lamp', cat: 'decor', slot: 'lamp', price: 110, pts: 1, nightly: 5, style: 4, tone: 'gold' },
    { id: 'painting', name: 'Desert Painting', cat: 'decor', slot: 'art', price: 70, pts: 0, nightly: 3, style: 5, tone: 'teal' },
    { id: 'portrait', name: 'Gold Portrait', cat: 'decor', slot: 'art', price: 300, pts: 1, nightly: 9, style: 12, tone: 'gold', minStars: 3 },
    { id: 'rug', name: 'Round Rug', cat: 'decor', slot: 'rug', price: 80, pts: 0, nightly: 3, style: 5, tone: 'rose' },
    { id: 'persianRug', name: 'Persian Rug', cat: 'decor', slot: 'rug', price: 350, pts: 1, nightly: 9, style: 12, tone: 'gold', minStars: 3 },
    { id: 'plant', name: 'Potted Palm', cat: 'decor', slot: 'plant', price: 55, pts: 0, nightly: 2, style: 4, tone: 'mint' },
    { id: 'orchid', name: 'Orchid Stand', cat: 'decor', slot: 'plant', price: 180, pts: 0, nightly: 5, style: 8, tone: 'lilac', minStars: 2 },
    { id: 'fridge', name: 'Mini Fridge', cat: 'electronics', slot: 'fridge', price: 90, pts: 1, nightly: 8, style: 1, tone: 'mint' },
    { id: 'tv', name: 'Color TV', cat: 'electronics', slot: 'tv', price: 220, pts: 2, nightly: 16, style: 2, tone: 'wood' },
    { id: 'bigTv', name: 'Big TV', cat: 'electronics', slot: 'tv', price: 1000, pts: 2, nightly: 30, style: 6, tone: 'wood', minStars: 3 },
    { id: 'radio', name: 'Retro Radio', cat: 'electronics', slot: 'gadget', price: 60, pts: 1, nightly: 4, style: 2, tone: 'teal', sub: 'floor or table' },
    { id: 'floorFan', name: 'Floor Fan', cat: 'electronics', slot: 'fan', price: 70, pts: 1, nightly: 4, style: 1, tone: 'sky' },
    { id: 'sodaMachine', name: 'Soda Machine', cat: 'electronics', slot: 'machine', price: 900, pts: 1, nightly: 15, style: 4, tone: 'rose', minStars: 3 },
    { id: 'arcade', name: 'Arcade Machine', cat: 'electronics', slot: 'machine', price: 950, pts: 1, nightly: 16, style: 6, tone: 'sky', minStars: 3 },
    { id: 'jukebox', name: 'Jukebox', cat: 'electronics', slot: 'machine', price: 1200, pts: 1, nightly: 18, style: 9, tone: 'gold', minStars: 4 },
    { id: 'vanity', name: 'Vanity Sink', cat: 'bath', slot: 'vanity', price: 90, pts: 1, nightly: 13, style: 2, tone: 'wood' },
    { id: 'tub', name: 'Clawfoot Tub', cat: 'bath', slot: 'tub', price: 220, pts: 1, nightly: 13, style: 5, tone: 'rose' },
  ],
  // Wallpapers and floors: looks only (no stars) but they raise the room's style, which is
  // what pulls the wealthy guests in. Bought once, then free in every room.
  walls: [
    { id: 'blush', name: 'Blush', price: 0, style: 0, tones: ['rose', 'gold'], paint: { kind: 'stars', bg: '#f7b796', fg: 'rgba(255,246,232,0.85)', band: '#2cc394' } },
    { id: 'mintStripes', name: 'Mint Stripes', price: 60, style: 6, tones: ['teal', 'mint'], paint: { kind: 'stripes', bg: '#c9f0e2', fg: '#a4e3cf', band: '#2cc394' } },
    { id: 'roseDots', name: 'Rose Dots', price: 60, style: 6, tones: ['rose', 'lilac'], paint: { kind: 'dots', bg: '#f9d3da', fg: '#f19cb0', band: '#c45a78' } },
    { id: 'skyDiamonds', name: 'Sky Diamonds', price: 70, style: 8, tones: ['sky', 'teal'], paint: { kind: 'diamonds', bg: '#d3e8f8', fg: '#9cc3e6', band: '#4a7fb8' } },
    { id: 'butterFlowers', name: 'Butter Flowers', price: 70, style: 8, tones: ['gold', 'cream'], paint: { kind: 'flowers', bg: '#fbe9bd', fg: '#f2b632', band: '#2cc394' } },
    { id: 'lilacStripes', name: 'Lilac Stripes', price: 60, style: 6, tones: ['lilac'], paint: { kind: 'stripes', bg: '#e6daf8', fg: '#c9b3ef', band: '#8a62c9' } },
    { id: 'sage', name: 'Sage', price: 40, style: 4, tones: ['mint', 'wood', 'cream'], paint: { kind: 'plain', bg: '#e3ecd6', fg: '#d3dfc3', band: '#3fae84' } },
    { id: 'retroFlowers', name: 'Retro Flowers', price: 80, style: 10, tones: ['rose', 'gold', 'wood'], paint: { kind: 'flowers', bg: '#f7c19a', fg: '#e8774a', band: '#b04a2a' } },
    { id: 'midnightPaws', name: 'Midnight Paws', price: 150, style: 12, tones: ['lilac', 'sky'], paint: { kind: 'paws', bg: '#1f2433', fg: '#3c4466', band: '#5d5f7a' } },
    { id: 'pinkPaws', name: 'Pink Paws', price: 90, style: 8, tones: ['rose'], paint: { kind: 'paws', bg: '#f8c0cc', fg: '#ee8ea4', band: '#e06a88' } },
    { id: 'candyPanels', name: 'Candy Panels', price: 100, style: 9, tones: ['rose', 'cream'], paint: { kind: 'panels', bg: '#f7cddb', fg: '#e8a2bb', band: '#c45a78' } },
    { id: 'goldDamask', name: 'Gold Damask', price: 450, style: 20, tones: ['gold', 'teal', 'wood'], minStars: 3, paint: { kind: 'damask', bg: '#2c6a5e', fg: '#e8c068', band: '#1d4a42' } },
    { id: 'royalVelvet', name: 'Royal Velvet', price: 700, style: 26, tones: ['lilac', 'gold'], minStars: 4, paint: { kind: 'damask', bg: '#4a2a6a', fg: '#d7b36a', band: '#2a1640' } },
  ],
  floors: [
    { id: 'beigeCarpet', name: 'Beige Carpet', price: 0, style: 0, tones: ['cream', 'wood'], paint: { kind: 'carpet', bg: '#f0cf98', fg: '#fbe6c0' } },
    { id: 'tealCarpet', name: 'Teal Carpet', price: 50, style: 5, tones: ['teal', 'mint'], paint: { kind: 'carpet', bg: '#47bdb0', fg: '#8fdccf' } },
    { id: 'roseCarpet', name: 'Rose Carpet', price: 50, style: 5, tones: ['rose', 'lilac'], paint: { kind: 'carpet', bg: '#f2a9bb', fg: '#fbd3dd' } },
    { id: 'oakPlanks', name: 'Oak Planks', price: 90, style: 8, tones: ['wood', 'cream', 'gold'], paint: { kind: 'planks', bg: '#c98a4b', fg: '#a8683a' } },
    { id: 'walnutPlanks', name: 'Walnut Planks', price: 90, style: 8, tones: ['wood', 'teal'], paint: { kind: 'planks', bg: '#7c4b2a', fg: '#5e3820' } },
    { id: 'creamChecker', name: 'Cream Checker', price: 80, style: 7, tones: ['cream', 'gold', 'wood'], paint: { kind: 'checker', bg: '#f1e4c8', fg: '#d9c39e' } },
    { id: 'mintTiles', name: 'Mint Tiles', price: 80, style: 7, tones: ['mint', 'teal', 'sky'], paint: { kind: 'tiles', bg: '#a9dcc0', fg: '#c7ead6' } },
    { id: 'dinerChecker', name: 'Diner Checker', price: 100, style: 9, tones: ['rose', 'sky', 'teal'], paint: { kind: 'checker', bg: '#151515', fg: '#f7f3ea' } },
    { id: 'cocoaParquet', name: 'Cocoa Parquet', price: 150, style: 12, tones: ['wood', 'gold'], paint: { kind: 'parquet', bg: '#7a4726', fg: '#9a5e33' } },
    { id: 'pawCarpet', name: 'Paw Carpet', price: 70, style: 6, tones: ['rose'], paint: { kind: 'pawCarpet', bg: '#f7b3c0', fg: '#ee8ea4' } },
    { id: 'nightPaws', name: 'Night Paws', price: 90, style: 7, tones: ['lilac', 'sky'], paint: { kind: 'pawCarpet', bg: '#20242f', fg: '#3c4466' } },
    { id: 'redVelvet', name: 'Red Velvet', price: 320, style: 16, tones: ['gold', 'rose'], minStars: 3, paint: { kind: 'velvet', bg: '#a3122a', fg: '#c92a44' } },
    { id: 'marble', name: 'Marble', price: 550, style: 22, tones: ['cream', 'gold', 'sky'], minStars: 4, paint: { kind: 'marble', bg: '#f3efe8', fg: '#b9b2a6' } },
  ],
  // Guest wealth. A guest pays nightly x payMul and tips up to `tip`; they only stay
  // happily in a room with minStars and a looks score of minStyle. Odds per tier:
  // weight[0] + weight[1] * attraction ^ weight[2] (attraction 0..1, rules.attraction).
  guestTiers: [
    { id: 'backpacker', name: 'BACKPACKER', icon: '🎒', payMul: 0.85, tip: 0, minStars: 1, minStyle: 0, patience: 1.2, picky: 0.2, weight: [0.9, -0.8, 1], look: { shirt: '#7aa95c', pants: '#5b6b7a', hat: 'cap' } },
    { id: 'regular', name: 'TRAVELER', icon: '🧳', payMul: 1, tip: 0.05, minStars: 1, minStyle: 0, patience: 1, picky: 0.4, weight: [1, 0, 1] },
    { id: 'business', name: 'BUSINESS', icon: '💼', payMul: 1.3, tip: 0.12, minStars: 3, minStyle: 25, patience: 0.85, picky: 0.8, weight: [0, 1.6, 1], look: { shirt: '#2f4a6e', pants: '#1f2a3a' }, aura: '#bfe6ff' },
    { id: 'wealthy', name: 'WEALTHY', icon: '💎', payMul: 1.8, tip: 0.25, minStars: 4, minStyle: 45, patience: 0.75, picky: 1.2, weight: [0, 1.8, 2], look: { shirt: '#8a3fc9', pants: '#2a1a3a', hat: 'sun' }, aura: '#e7c6ff' },
    { id: 'vip', name: 'VIP', icon: '👑', payMul: 2.6, tip: 0.4, minStars: 5, minStyle: 70, patience: 0.65, picky: 1.6, weight: [0, 2.2, 3], look: { shirt: '#f3efe6', pants: '#c9a227', hat: 'sun' }, aura: '#ffd34a' },
  ],
  // Attraction weights (sum 1) and how dirt cuts it: below `dirtyBelow` cleanliness the
  // pull drops in proportion, so a filthy lot keeps the rich away whatever the rooms are.
  // patience: x the desk patience (rich guests wait less).
  attract: { style: 0.4, stars: 0.2, rating: 0.15, clean: 0.25, dirtyBelow: 0.5 },
}
ECONOMY.roomUpgrades = DECOR.items
