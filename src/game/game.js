// The motel game loop. You start with the office and room 101.
// Front desk: a bus drops guests who queue at the counter. TALK to the guest (they say
// which room type and how many nights), GIVE KEY from the ROOM KEYS board (the key
// glows and flies to the guest), then TAKE $ (bills land on the counter's cash pile).
// COLLECT the pile to bank it (AUTO CASH does it for you). Sam can run the desk.
// Rooms: guests sleep, check out and leave the room dirty; clean.js lists the jobs
// (sheets, trash, dust, stains, mud, toilet, sink) with the right tool each; the room
// shows its CLEAN % and celebrates at 100%. Rose cleans, Lou does the laundry.
// Food (food.js): walk-in coffee customers and room service by phone, made in 3 steps.
// Curb appeal (curb.js): lot litter, walkway grime, graffiti and posters; a run-down
// motel gets no guests. Also: junk yard, dumpster, fountain, pool, furnishing rooms.
// Money, upgrades, staff and room furniture live in the shared economy (bank).
import { BoxGeometry, Mesh, MeshStandardMaterial, PlaneGeometry, PointLight, Vector3 } from 'three'
import { CURB, DRIVE_IN, ECONOMY, LAYOUT, PACING, PHYSICS, QUEUE } from '../config.js'
import { bank, call, openPanel, panelOpen } from './bank.js'
import { createHud } from './hud.js'
import { createDecor, decorSfx } from '../decor/index.js'
import { play, loop as sfxLoop, engineRate } from '../fx/sfx.js'
import { inputState, onKey } from '../input.js'
import { litter as makeLitter } from '../motel/props.js'
import { makePerson, randomLook, Walker } from '../motel/people.js'
import { mat } from '../motel/kit.js'
import { interiorMats } from '../motel/rooms.js'
import { createCleaning } from './clean.js'
import { createCars } from './cars.js'
import { createCurb } from './curb.js'
import { createFood } from './food.js'
import { busGap, busGuests, pacing, patienceMul, rushHour, setPacing, spawnMul } from './pacing.js'

const B = LAYOUT.building
const FRONT = B.front
const WALK_Z = FRONT + 1.6 // NPC lane along the walkway
const SPINE_X = -14.4 // NPC lane down the lot
const ROAD_EXIT_X = -70
const { streetZ: STREET_Z, curbZ: CURB_Z, lotZ: LOT_Z } = LAYOUT.npc
const DOOR_X = LAYOUT.officeDoorX
const rnd = (a, b) => a + Math.random() * (b - a)
const rndi = (a, b) => Math.floor(rnd(a, b + 1))
const dist2 = (ax, az, bx, bz) => (ax - bx) ** 2 + (az - bz) ** 2

const GUEST_TYPES = [
  { id: 'traveler', name: 'TRAVELER', icon: '🧳' },
  { id: 'tourist', name: 'TOURIST', icon: '📸' },
  { id: 'trucker', name: 'TRUCKER', icon: '🚚' },
  { id: 'cowboy', name: 'COWBOY', icon: '🤠' },
  { id: 'surfer', name: 'SURFER', icon: '🏄' },
  { id: 'granny', name: 'GRANNY', icon: '👵' },
]

export function createGame({ scene, camera, renderer, lighting, player, playerGroup, motel, site, signs, bus, fx, playerName, hotbar, held }) {
  const rooms = motel.rooms
  const office = motel.office
  const laundry = motel.laundry
  const yard = site.yard
  const fountain = site.fountain
  const pool = site.pool

  // --- State ---------------------------------------------------------------------------
  const S = {
    tool: hotbar?.selected ?? 'hands',
    bag: 0,
    carry: null, // { kind: 'junk', obj } | { kind: 'basket' } | { kind: 'food', food, obj }
    cleanSets: ECONOMY.startCleanSets,
    dirtyLinen: 0,
    rating: ECONOMY.startRating,
    busTimer: ECONOMY.firstBus,
    carTimer: DRIVE_IN.first,
    calmUntil: 0, // no drive-ins until then (just after a bus)
    nextTour: false,
    holdKey: false,
    holdT: 0,
    holdRef: null,
    seenGuests: new Set(),
    yardDone: false,
    register: 0, // cash on the counter, waiting to be collected
    drops: [], // cash left at room doors: { x, z, amount, obj }
    appeal: 100,
  }
  const bagCap = () => (call('megaBag') ? 60 : ECONOMY.trashCapacity)
  const roomState = rooms.map((r) => ({
    r,
    state: bank.isRoomOpen(r.number) ? 'ready' : 'locked',
    guest: null,
    bed: 'made',
    tasks: [],
    litter: [],
    doorOpen: 0,
    collider: null,
    celebrate: 0,
    bounce: 0,
  }))
  const rate = (score, w = 1) => {
    S.rating += (score - S.rating) * ECONOMY.ratingWeight * w
    S.rating = Math.max(1, Math.min(5, S.rating))
  }
  const hired = (id) => !!bank.has?.(id)
  const speedMul = () => call('cleanSpeedMul') ?? 1

  // --- HUD -----------------------------------------------------------------------------
  let action = null
  const hud = createHud({
    onAction: () => press(),
    onHold: (on) => (S.holdKey = on),
    onFurnish: () => openFurnish(),
  })
  onKey('KeyF', () => openFurnish())
  onKey('KeyE', () => {
    S.holdKey = true
    press()
  })
  window.addEventListener('keyup', (e) => {
    if (e.code === 'KeyE') S.holdKey = false
  })
  window.addEventListener('blur', () => (S.holdKey = false))

  // The tool hotbar (src/hud/hotbar.js) owns the selection and keys 1..6.
  function setTool(id) {
    if (S.tool === id) return
    hotbar?.select(id)
    S.tool = id
  }
  function syncTool() {
    const id = hotbar?.selected
    if (!id) return
    // Picking a tool while carrying puts the item down (it used to pin HANDS with no way out
    // once the food's order was gone).
    if (S.carry && id !== 'hands') putDown()
    S.tool = id
  }

  // --- Room plates, keys, colliders -----------------------------------------------------
  const typeFor = (stars) => {
    let t = ECONOMY.roomTypes[0]
    for (const rt of ECONOMY.roomTypes) if (stars >= rt.minStars) t = rt
    return t
  }
  const starsOf = (n) => Math.max(1, Math.min(5, bank.roomStars(n) || 1))
  function priceOf(rs) {
    const n = rs.r.number
    if (bank.roomNightly) return bank.roomNightly(n)
    const furn = bank.roomFurniture(n) || []
    const extra = furn.reduce((s, id) => s + (ECONOMY.roomUpgrades.find((u) => u.id === id)?.nightly ?? 0), 0)
    return ECONOMY.basePrice[rs.r.index] + extra + typeFor(starsOf(n)).priceAdd
  }
  // Furnishing (src/decor): furniture, wallpaper + floor per room, FURNISH mode, and the guest
  // wealth tiers that clean, good-looking rooms attract.
  const cleanliness = () => {
    const open = roomState.filter((rs) => rs.state !== 'locked')
    const dirty = open.filter((rs) => rs.state === 'dirty').length
    return 0.7 * ((S.appeal ?? 80) / 100) + 0.3 * (open.length ? 1 - dirty / open.length : 1)
  }
  const decor = createDecor({
    scene,
    camera,
    renderer,
    motelRooms: rooms,
    fx,
    bank,
    playerGroup,
    getNight: () => night,
    getRating: () => S.rating,
    getClean: cleanliness,
  })
  bank.on?.('roomUpgraded', (e) => {
    if (e?.room == null) return
    decor.refresh(e.room, true)
    const after = bank.roomStars(e.room)
    if (e.id !== 'furnish' && after >= 3 && (e.before ?? after - 1) < 3) hud.announce(`ROOM ${e.room} IS NOW COMFORT!`, `$${bank.roomNightly?.(e.room) ?? ''} a night`)
  })
  const keyOf = (rs) => office.keys[rs.r.index]
  for (const k of office.keys) k.userData.parent = k.parent
  function refreshRoom(rs) {
    const n = rs.r.number
    if (rs.state === 'locked' && bank.isRoomOpen(n)) {
      rs.state = 'ready'
      rs.bed = 'made'
    }
    const type = typeFor(starsOf(n))
    rs.r.plate.draw({ number: n, typeName: type.name, price: priceOf(rs), state: rs.state === 'locked' ? 'locked' : rs.state })
    rs.r.plate.tex.needsUpdate = true
    rs.r.boards.visible = rs.state === 'locked'
    decor.refresh(n)
    rs.r.interior.bed.set(rs.bed)
    const key = keyOf(rs)
    if (key && !key.userData.out) key.visible = rs.state !== 'occupied' && rs.state !== 'locked'
  }
  for (const rs of roomState) {
    rs.collider = motelPhysics.addFixed(motelPhysics.RAPIER.ColliderDesc.cuboid(0.58, 1.2, 0.12), { x: rs.r.doorX, y: 1.4, z: FRONT - 0.15 })
    refreshRoom(rs)
  }
  bank.on?.('change', () => roomState.forEach(refreshRoom))
  bank.on?.('bought', (e) => {
    if (e?.id === 'pool') openPool()
    roomState.forEach(refreshRoom)
    refreshBoards()
  })
  bank.on?.('callBus', (e) => {
    S.nextTour = (e?.tourists ?? 0) > 0
    S.busTimer = Math.min(S.busTimer, 1)
  })

  // --- Interior light that follows the player into rooms --------------------------------
  const roomLight = new PointLight('#ffe7c2', 0, 9, 1.4)
  scene.add(roomLight)
  function roomAt(x, z) {
    for (const rs of roomState) {
      const b = rs.r.interior.bounds
      if (x > b.x0 && x < b.x1 && z > b.z0 && z < b.z1) return rs
    }
    return null
  }
  const inBox = (b, x, z) => x > b.x0 && x < b.x1 && z > b.z0 && z < b.z1
  function floorAt(x, z) {
    if (z < FRONT + B.walk + 0.6 && z > B.front - B.depth && x > B.x0 && x < B.x1 + 1.8) return 0.2
    if (inBox(laundry.bounds, x, z)) return 0.12
    if (z > LAYOUT.sidewalk.z0 && z < LAYOUT.sidewalk.z1) return 0.18
    return 0
  }

  // --- Outdoor litter (parking lot) + walkway grime ---------------------------------------
  const outdoorLitter = []
  function spawnLitter(x, z, list = outdoorLitter, y = null) {
    const obj = makeLitter(rndi(0, 4))
    obj.position.set(x, y ?? floorAt(x, z), z)
    scene.add(obj)
    const item = { obj, x, z, taken: false }
    list.push(item)
    return item
  }
  function randomLotSpot() {
    const L = LAYOUT.lot
    if (Math.random() < 0.3) return [rnd(-12, 25), rnd(FRONT + 0.6, FRONT + B.walk)]
    return [rnd(L.x0 + 2, L.x1 - 2), rnd(L.z0 + 1, L.z1 - 2)]
  }
  for (let i = 0; i < CURB.startLitter; i++) spawnLitter(...randomLotSpot())
  let litterT = ECONOMY.litterEvery
  const grime = []
  const grimeMats = interiorMats().stains
  function spawnGrime() {
    const x = rnd(-11, 25)
    const z = rnd(FRONT + 0.6, FRONT + B.walk - 0.3)
    const m = new Mesh(new PlaneGeometry(1.1, 1.1), grimeMats[rndi(0, 3)].clone())
    m.rotation.x = -Math.PI / 2
    m.rotation.z = Math.random() * 6
    m.position.set(x, 0.205, z)
    scene.add(m)
    grime.push({ mesh: m, x, z, p: 0 })
  }
  for (let i = 0; i < CURB.startGrime; i++) spawnGrime()
  let grimeT = ECONOMY.grimeEvery

  // --- Junk yard ---------------------------------------------------------------------------
  const yardBags = yard.bags.map((obj) => ({ obj, x: obj.position.x, z: obj.position.z, taken: false, yard: true }))
  const yardJunk = yard.junks.map((obj) => ({ obj, x: obj.position.x, z: obj.position.z, taken: false }))
  const yardTotal = yardBags.length + yardJunk.length
  const yardLeft = () => yardBags.filter((b) => !b.taken).length + yardJunk.filter((j) => !j.taken).length

  // --- Cash: bills flying around, the counter pile, money left at doors ---------------------
  const billGeo = new BoxGeometry(0.17, 0.014, 0.08)
  const billMat = new MeshStandardMaterial({ color: '#5cbf4a', roughness: 0.6 })
  const billBand = new MeshStandardMaterial({ color: '#f2c232', roughness: 0.5 })
  const flyingBills = [] // { obj, from, to, t, delay, done }
  const pilePos = new Vector3(LAYOUT.cashPile.x, office.ctop + 0.05, LAYOUT.cashPile.z)
  const head = () => new Vector3(player.position.x, player.position.y + 1.2, player.position.z)
  function flyBills(from, to, n, onDone) {
    n = Math.max(1, Math.min(8, n))
    for (let i = 0; i < n; i++) {
      const obj = new Mesh(billGeo, billMat)
      obj.position.copy(from)
      scene.add(obj)
      flyingBills.push({ obj, from: from.clone(), to: typeof to === 'function' ? to : to.clone(), t: 0, delay: i * 0.07, done: i === n - 1 ? onDone : null })
    }
  }
  function refreshPile() {
    const g = office.cashPile
    while (g.children.length) g.remove(g.children[0])
    const stacks = Math.min(12, Math.ceil(S.register / 15))
    for (let i = 0; i < stacks; i++) {
      const b = new Mesh(billGeo, billMat)
      b.position.set(((i % 3) - 1) * 0.1, 0.01 + Math.floor(i / 3) * 0.018, (i % 2) * 0.02)
      b.rotation.y = (i * 0.37) % 0.5
      g.add(b)
      if (i % 3 === 0) {
        const band = new Mesh(new BoxGeometry(0.03, 0.016, 0.082), billBand)
        band.position.copy(b.position)
        g.add(band)
      }
    }
  }
  const auto = () => !!call('autoCash')
  // A customer pays: bills fly onto the counter pile (or to you with AUTO CASH).
  function payCounter(amount, from) {
    const n = Math.ceil(amount / 10)
    if (auto()) {
      flyBills(from, head, n, () => {
        bank.earn(amount, 'cash')
        hud.float(head().setY(player.position.y + 2.4), `+$${amount}`)
        play('register', player.position)
      })
      return
    }
    play('cash', from)
    flyBills(from, pilePos, n, () => {
      S.register += amount
      refreshPile()
      hud.float(pilePos.clone().setY(pilePos.y + 0.6), `$${amount} on the counter`, '#bfffbf')
      play('coins', pilePos)
    })
  }
  function collectCash() {
    const n = S.register
    if (n <= 0) return
    S.register = 0
    refreshPile()
    flyBills(pilePos, head, Math.ceil(n / 15), () => {
      bank.earn(n, 'register')
      hud.float(head().setY(player.position.y + 2.4), `+$${n}`)
      fx.coins(player.position.x, player.position.y + 1.4, player.position.z, 14)
      play('register', player.position)
    })
  }
  function dropCash(amount, x, z) {
    const at = new Vector3(x, 1.2, z)
    if (auto()) {
      flyBills(at, head, Math.ceil(amount / 10), () => {
        bank.earn(amount, 'tip')
        hud.float(head().setY(player.position.y + 2.4), `+$${amount}`)
        play('coins', player.position)
      })
      return
    }
    const obj = new Mesh(billGeo, billMat)
    obj.scale.set(1.6, 4, 1.6)
    obj.position.set(x, 0.27, z)
    scene.add(obj)
    S.drops.push({ x, z, amount, obj })
    play('cash', at)
  }
  function takeDrop(d) {
    S.drops.splice(S.drops.indexOf(d), 1)
    scene.remove(d.obj)
    flyBills(new Vector3(d.x, 0.4, d.z), head, Math.ceil(d.amount / 10), () => {
      bank.earn(d.amount, 'tip')
      hud.float(head().setY(player.position.y + 2.4), `+$${d.amount}`)
      play('coins', player.position)
    })
  }

  // --- Modules: cleaning, curb appeal, food -------------------------------------------------
  const clean = createCleaning({ fx, play, spawnLitter, scene })
  const cleanCtx = {
    speedMul,
    cleanSets: () => S.cleanSets,
    takeCleanSet: () => (S.cleanSets > 0 ? (S.cleanSets--, true) : false),
    addDirtyLinen: (n) => (S.dirtyLinen += n),
    toast: (t) => hud.toast(t),
    inside: (rs) => roomAt(player.position.x, player.position.z) === rs,
    pos: () => ({ x: player.position.x, z: player.position.z }),
    onTaskDone: (rs, t) => {
      void t
      refreshRoom(rs)
      checkRoomClean(rs)
    },
  }
  const curb = createCurb({ scene, spots: motel.wallSpots ?? [], fx, play, bank, hud })
  const appealNow = () => curb.appeal(outdoorLitter.filter((l) => !l.taken).length, grime.length)
  const food = createFood({
    scene, fx, hud, play, bank, call, kitchen: motel.kitchen, office, rooms: roomState, player, playerGroup, S, floorAt, hired,
    P: { FRONT, WALK_Z, SPINE_X, DOOR_X, EXIT_X: ROAD_EXIT_X, STREET_Z, CURB_Z, LOT_Z },
    rate,
    payCounter,
    dropCash,
    toHands: () => setTool('hands'),
  })

  // --- Guests ---------------------------------------------------------------------------------
  const guests = []
  const queue = []
  let guestSeed = 1
  const wantName = (g) => {
    const m = wantMin(g)
    return m >= 5 ? '5-STAR' : m >= 4 ? '★4 ROOM' : m >= 3 ? 'COMFORT' : 'REGULAR'
  }
  function spawnGuest(x, z, tourist, car = null) {
    const look = randomLook(guestSeed++ * 31 + Math.floor(Math.random() * 999))
    if (tourist) {
      look.hat = 'sun'
      look.shirt = ['#ff7fb0', '#f2b632', '#5ac46a'][rndi(0, 2)]
    }
    const pre = decor.rollTier()
    if (pre.look) Object.assign(look, pre.look)
    const p = makePerson(look)
    scene.add(p.group)
    const w = new Walker(p, x, z, 0.18)
    w.pace = rnd(0.82, 1.18) // people walk at their own speed: no marching in step
    const typeIdx = tourist ? 1 : look.hat === 'cap' ? 2 : look.hat === 'cowboy' ? 3 : look.hairStyle === 2 && look.hair === '#d9d4cc' ? 5 : look.suitcase ? 0 : 4
    // Wealth: richer guests come when the motel is clean and the rooms look good.
    const tier = pre
    const want = tier.minStars >= 5 ? '5-star' : tier.minStars >= 3 ? 'comfort' : 'regular'
    const g = { id: guestSeed, p, w, look, tourist, want, tier, auraT: 0, nights: rndi(...ECONOMY.nights), type: GUEST_TYPES[typeIdx], stage: 'arriving', patience: ECONOMY.deskPatience * (tier?.patience ?? 1) * patienceMul(), room: null, stay: 0 }
    if (car) g.car = car // a drive-in guest: they walk back to it when they leave
    guests.push(g)
    // Nobody waits in a line longer than QUEUE.max: they get angry and go at once.
    if (queue.length >= QUEUE.max) return turnAway(g)
    queue.push(g)
    routeQueue()
    return g
  }
  function turnAway(g) {
    g.stage = 'leaving'
    rate(QUEUE.fullScore, QUEUE.fullWeight)
    play('error')
    hud.float(new Vector3(g.w.x, 2.4, g.w.z), '😠 too long!', '#ff7a6a')
    if (clock - (S.fullToastAt ?? -99) > 8) {
      S.fullToastAt = clock
      hud.toast('The line is too long: a guest left angry 😠 · check guests in faster')
    }
    if (leaveByCar(g, [])) return g
    g.w.go([[ROAD_EXIT_X, STREET_Z]], () => removeGuest(g))
    return g
  }
  // A drive-in guest: the car parks, the guest gets out beside it and walks to the office.
  function driveIn() {
    return cars.arrive((c) => {
      const g = spawnGuest(c.x + 1.6, c.z, false, c)
      if (!hired('sam') && queue.length === 1) hud.toast(`A guest drove in · ${roomState.some((rs) => rs.state === 'ready') ? 'check them in at the desk' : 'get a room clean for them!'}`)
      return g
    })
  }
  // Leaves through their parked car when they have one (else false).
  function leaveByCar(g, from) {
    const car = g.car
    if (!car || car.state !== 'parked') return false
    const gx = car.x + 1.6
    g.w.go([...from, [gx, WALK_Z], [gx, car.z]], () => {
      g.p.group.visible = false
      cars.depart(car)
      removeGuest(g)
    })
    return true
  }
  function queueSlot(i) {
    const q = LAYOUT.queue
    return q[Math.min(i, q.length - 1)]
  }
  function pathToSlot(g, slot) {
    const [tx, tz] = slot
    const outside = g.w.z > FRONT
    const pts = []
    if (g.stage === 'arriving' && g.car) pts.push([g.w.x, WALK_Z])
    else if (g.stage === 'arriving') pts.push([g.w.x, CURB_Z], [SPINE_X, LOT_Z], [SPINE_X, FRONT + 2.2])
    if ((outside || g.stage === 'arriving') && tz < FRONT) pts.push([DOOR_X, FRONT + 1.4], [DOOR_X, FRONT - 1.6])
    pts.push([tx, tz])
    return pts
  }
  function routeQueue() {
    queue.forEach((g, i) => {
      const slot = queueSlot(i)
      if (g.slot === i) return
      g.slot = i
      const arrived = () => {
        if (g.stage === 'arriving' || g.stage === 'queueing') g.stage = 'queued'
        if (queue.indexOf(g) === 0) atCounter(g)
        g.w.face(Math.PI)
      }
      // Still walking in: only move the end of the walk, never send them back to the road.
      if (g.stage === 'arriving' && g.started && g.w.busy) {
        g.w.path[g.w.path.length - 1] = [slot[0], slot[1]]
        return
      }
      g.started = true
      g.w.go(pathToSlot(g, slot), arrived)
      if (g.stage === 'queued') g.stage = 'queueing'
    })
  }
  function atCounter(g) {
    g.w.face(Math.PI)
    play('bell', { x: LAYOUT.deskPoint.x, y: 1.4, z: LAYOUT.counterZ })
    const t = g.tier
    if (t && t.payMul > 1) {
      // A rich guest walks in: fanfare, sparkles, a headline.
      decorSfx(t.id === 'vip' ? 'vip' : 'wealthy')
      fx.sparkle(g.w.x, 1.6, g.w.z, t.id === 'vip' ? 50 : 30, t.aura ?? '#fff2a8')
      fx.coins(g.w.x, 2.0, g.w.z, t.id === 'vip' ? 16 : 8)
      hud.announce(`${t.icon} ${t.name} GUEST!`, `pays x${t.payMul} for a ★${t.minStars} room with LOOKS ${t.minStyle}+`, 3)
    } else if (!hired('sam')) hud.announce('NEW GUEST!', 'go to the desk')
    if (!S.seenGuests.has(g.type.id)) {
      S.seenGuests.add(g.type.id)
      drawGuestsBoard()
    }
  }
  const wantMin = (g) => g.tier?.minStars ?? (g.want === 'regular' ? 1 : g.want === 'comfort' ? 3 : 5)
  const fitsRoom = (g, rs) => (g.tier ? decor.fits(g.tier, rs.r.number) : starsOf(rs.r.number) >= wantMin(g))
  function pickRoom(g) {
    const ready = roomState.filter((rs) => rs.state === 'ready')
    if (!ready.length) return null
    const fits = ready.filter((rs) => fitsRoom(g, rs)).sort((a, b) => starsOf(a.r.number) - starsOf(b.r.number))
    return fits[0] ?? ready.sort((a, b) => starsOf(b.r.number) - starsOf(a.r.number))[0]
  }
  const front = () => (queue[0] && queue[0].stage !== 'queueing' && queue[0].stage !== 'arriving' ? queue[0] : null)

  // Desk step 1: TALK. The guest says what they want and you pick their room.
  function talk(byClerk = false) {
    const g = front()
    if (!g || g.stage !== 'queued') return false
    const rs = pickRoom(g)
    if (!rs) {
      if (!byClerk) {
        hud.toast('No clean room ready! Clean a room first')
        play('error')
      }
      return false
    }
    rs.state = 'reserved'
    rs.guest = g
    g.room = rs
    g.matched = fitsRoom(g, rs)
    // A rich guest only pays their premium for a room that fits them.
    g.wealth = g.matched ? g.tier?.payMul ?? 1 : Math.min(1, g.tier?.payMul ?? 1)
    g.pay = Math.round(priceOf(rs) * g.nights * (call('payMul') ?? 1) * (g.tourist ? ECONOMY.touristPay : 1) * g.wealth)
    g.stage = 'talked'
    refreshRoom(rs)
    play('click')
    const rich = g.tier && g.tier.payMul > 1
    if (!byClerk) hud.announce(`${g.tier?.icon ?? g.type.icon} ${wantName(g)} · ${g.nights} NIGHT${g.nights > 1 ? 'S' : ''}`, rich && !g.matched ? `no room nice enough for a ${g.tier.name} guest: they pay the normal rate · room ${rs.r.number}` : `give them the key to room ${rs.r.number} · ROOM KEYS board${rich ? ` · pays x${g.tier.payMul}` : ''}`, 2.6)
    return true
  }
  // Desk step 2: GIVE KEY. The key leaves the board and flies into the guest's hand.
  function giveKey() {
    const g = front()
    if (!g || g.stage !== 'talked') return false
    const key = keyOf(g.room)
    g.stage = 'keyFlying'
    key.userData.out = true
    key.visible = true
    key.userData.tag.emissiveIntensity = 0
    const from = key.getWorldPosition(new Vector3())
    scene.attach(key)
    play('key', from)
    flyingKeys.push({ key, g, from, t: 0 })
    return true
  }
  const flyingKeys = []
  const cars = createCars({ scene, fx })
  // Desk step 3: TAKE $. The guest pays (bills to the counter pile) and walks to the room.
  function takePayment(byClerk = false) {
    const g = front()
    if (!g || g.stage !== 'keyed') return false
    queue.shift()
    routeQueue()
    payCounter(g.pay, new Vector3(g.w.x, 1.3, g.w.z))
    fx.coins(g.w.x, 1.5, g.w.z, g.wealth > 1 ? 24 : 10)
    if (g.wealth > 1.2) {
      decorSfx('bigCash')
      fx.sparkle(g.w.x, 1.8, g.w.z, 20, '#ffd34a')
    }
    const rs = g.room
    if (!byClerk) hud.announce(`WELCOME! · ROOM ${rs.r.number}`, `${g.nights} night${g.nights > 1 ? 's' : ''} · $${g.pay}`, 2.4)
    const r = rs.r
    g.stage = 'toRoom'
    g.car ??= cars.arrive() // their car drives in and parks on the lot (none when the lot is full)
    const bp = r.interior.bedPoint
    g.w.go([[DOOR_X, FRONT - 1.6], [DOOR_X, WALK_Z], [r.doorX, WALK_Z], [r.doorX, FRONT + 0.8], [r.doorX, FRONT - 1.4], [bp.x + 0.6, bp.z]], () => {
      g.stage = 'inRoom'
      g.stay = g.nights * ECONOMY.nightSeconds
      g.p.group.visible = false
      returnKey(rs, false)
      rs.state = 'occupied'
      refreshRoom(rs)
      r.interior.tvScreen.emissiveIntensity = 1.4
      food.onGuestSettled(rs)
    })
    return true
  }
  // The key goes back on its hook (hidden while the room is occupied).
  function returnKey(rs) {
    const key = keyOf(rs)
    if (!key.userData.out) return
    key.userData.out = false
    key.userData.parent.attach(key)
    key.position.copy(key.userData.home)
    key.rotation.set(0, Math.PI / 2, 0)
    key.scale.setScalar(1)
    refreshRoom(rs)
  }
  function checkOut(g) {
    const rs = g.room
    const r = rs.r
    g.p.group.visible = true
    g.stage = 'leaving'
    r.interior.tvScreen.emissiveIntensity = 0
    food.onGuestLeft(rs)
    leaveDirty(rs)
    // Review.
    let score = 4 + (g.matched ? 0.5 : -0.8) + (starsOf(r.number) >= 3 ? 0.4 : 0) + (g.waited > 30 ? -0.6 : 0.2) + (S.appeal - 70) / 60 + (g.tier ? decor.reviewDelta(g.tier, r.number) : 0)
    if (fountain.isFixed()) score += 0.2
    if (pool.isOpen()) score += 0.3
    score = Math.max(1, Math.min(5, score))
    rate(score)
    if (pool.isOpen()) {
      const pp = call('poolPerGuest') ?? 0
      if (pp > 0) bank.earn(pp, 'pool')
    }
    const tipMax = Math.max(call('tipMax') ?? 0, g.matched ? g.tier?.tip ?? 0 : 0)
    const tip = tipMax ? Math.round(priceOf(rs) * g.wealth * (0.4 + Math.random() * 0.6) * tipMax) : 0
    if (tip > 0 && g.wealth > 1.2) decorSfx('bigCash')
    if (tip > 0) dropCash(tip, r.doorX - 0.35, FRONT + 0.75)
    hud.float(new Vector3(r.doorX, 2.9, FRONT + 0.6), '★'.repeat(Math.round(score)), '#ffd34a')
    g.w.x = r.doorX
    g.w.z = FRONT - 1.4
    const car = g.car
    if (car && car.state === 'parked') {
      // Walk to the car through the gap beside it, get in, and drive off.
      const gx = car.x + 1.6
      g.w.go([[r.doorX, FRONT + 0.8], [r.doorX, WALK_Z], [gx, WALK_Z], [gx, car.z]], () => {
        g.p.group.visible = false
        cars.depart(car)
        removeGuest(g)
      })
      return
    }
    cars.depart(car)
    g.w.go([[r.doorX, FRONT + 0.8], [r.doorX, WALK_Z], [SPINE_X, WALK_Z], [SPINE_X, LOT_Z], [SPINE_X, STREET_Z], [ROAD_EXIT_X, STREET_Z]], () => removeGuest(g))
  }
  // The room as a guest leaves it: used bed, trash, dust, stains, mud, a dirty bathroom.
  function leaveDirty(rs) {
    rs.state = 'dirty'
    rs.guest = null
    clean.dirty(rs)
    refreshRoom(rs)
  }
  function guestLeavesAngry(g) {
    const i = queue.indexOf(g)
    if (i >= 0) queue.splice(i, 1)
    if (g.room && g.room.state === 'reserved') {
      returnKey(g.room)
      g.room.state = 'ready'
      g.room.guest = null
      refreshRoom(g.room)
    }
    routeQueue()
    rate(1.5)
    hud.toast('A guest got tired of waiting and left 😠')
    g.stage = 'leaving'
    if (leaveByCar(g, [[DOOR_X, FRONT - 1.6], [DOOR_X, WALK_Z]])) return
    g.w.go([[DOOR_X, FRONT - 1.6], [DOOR_X, WALK_Z], [SPINE_X, WALK_Z], [SPINE_X, LOT_Z], [SPINE_X, STREET_Z], [ROAD_EXIT_X, STREET_Z]], () => removeGuest(g))
  }
  function removeGuest(g) {
    scene.remove(g.p.group)
    guests.splice(guests.indexOf(g), 1)
  }

  // --- Staff NPCs (shown when hired) --------------------------------------------------------
  const staff = {}
  function ensureStaff(id) {
    if (staff[id]) return staff[id]
    let look
    let pos
    if (id === 'rose') {
      look = { skin: '#fbd9b8', shirt: '#ffb3c8', pants: '#ffb3c8', dress: '#ff9fbd', apron: '#ffffff', hair: '#d0411f', hairStyle: 2, hat: 'maid', face: 0, collar: '#ffffff' }
      pos = [-13.6, WALK_Z]
    } else if (id === 'sam') {
      look = { skin: '#8d5a3b', shirt: '#e2382a', pants: '#1f1f24', hair: '#1c1c1c', hairStyle: 0, hat: 'cap', hatColor: '#1f9a8a', face: 0, collar: '#f6d33c' }
      pos = [office.clerkSpot.x + 0.4, office.clerkSpot.z - 0.3]
    } else {
      look = { skin: '#e0ac7e', shirt: '#7fe0c4', pants: '#2a3a5a', hair: '#3b2414', hairStyle: 0, hat: 'cap', hatColor: '#1f9a8a', face: 1, collar: '#ffffff' }
      pos = [LAYOUT.laundryPoint.x + 1.2, LAYOUT.laundryPoint.z + 0.6]
    }
    const p = makePerson(look)
    scene.add(p.group)
    const w = new Walker(p, pos[0], pos[1], 0.2)
    w.face(id === 'sam' ? 0 : Math.PI)
    staff[id] = { p, w, home: pos, task: null, t: 0 }
    return staff[id]
  }

  // --- Laundry ---------------------------------------------------------------------------------
  const washer = { state: 'idle', t: 0, load: 0 }
  function startWash(load) {
    washer.state = 'washing'
    washer.load = load
    const fast = call('useCharge', 'rushWash')
    washer.t = fast ? 0.5 : ECONOMY.washTime / (call('laundrySpeedMul') ?? 1)
    laundry.washer.led.emissiveIntensity = 2
    play('swoosh', { x: laundry.washer.x, y: 1, z: laundry.washer.z })
  }
  function foldWash() {
    const sets = washer.load * (ECONOMY.washLoad / 2)
    S.cleanSets += Math.max(1, Math.round(sets))
    washer.state = 'idle'
    washer.load = 0
    laundry.washer.led.emissiveIntensity = 0
    const p = { x: laundry.shelf.x, y: 1.4, z: laundry.shelf.z }
    fx.sparkle(p.x, p.y, p.z, 16)
    play('chime', p)
    hud.toast(`Linen folded: ${S.cleanSets} clean sets`)
  }
  function refreshLaundry() {
    laundry.shelf.draw(S.cleanSets)
    laundry.shelf.stacks.forEach((s, i) => (s.visible = i < Math.min(S.cleanSets, 12)))
    const n = S.dirtyLinen
    laundry.basket.pile.visible = n > 0 && S.carry?.kind !== 'basket'
    laundry.basket.pile.position.y = Math.min(0.35, 0.05 + n * 0.06)
    laundry.basket.group.visible = S.carry?.kind !== 'basket'
  }

  // --- Boards in the office -------------------------------------------------------------------
  function drawGuestsBoard() {
    office.guestsBoard.draw(GUEST_TYPES.map((t) => ({ known: S.seenGuests.has(t.id), icon: t.icon, name: t.name })))
  }
  function refreshBoards() {
    const cards = [
      { id: 'lou', name: 'LOU', icon: '🧺' },
      { id: 'rose', name: 'ROSE', icon: '🧹' },
      { id: 'mia', name: 'MIA', icon: '🌭' },
      { id: 'sam', name: 'SAM', icon: '🛎️' },
      { id: 'gus', name: 'GUS', icon: '🌙' },
    ].map((c) => ({ known: true, icon: c.icon, name: c.name, tag: hired(c.id) ? 'WORKING' : 'HIRE', tagColor: hired(c.id) ? '#5ad27a' : '#ffd23f' }))
    office.helpBoard.draw(cards)
  }
  drawGuestsBoard()
  refreshBoards()

  // --- Fountain / pool ----------------------------------------------------------------------
  function openPool() {
    if (pool.isOpen()) return
    pool.open()
    hud.announce('POOL IS OPEN!', 'guests love a swim · +rating')
    play('levelUp')
    play('splash', { x: pool.center.x, y: 0, z: pool.center.z })
  }
  if (bank.has?.('pool')) pool.open()

  // --- Interactions ------------------------------------------------------------------------------
  // Candidate: { key, x, z, r, text, hold, tool, warn, run, prio, startP, progress(p, dt) }
  const cands = []
  const addC = (c) => cands.push(c)
  const ppos = new Vector3()
  function gather() {
    cands.length = 0
    const px = player.position.x
    const pz = player.position.z
    const near = (x, z, r) => dist2(px, pz, x, z) < r * r
    // Front desk.
    const d = LAYOUT.deskPoint
    const g = front()
    if (g && near(d.x, d.z, 1.6)) {
      if (g.stage === 'queued') {
        const ready = roomState.some((rs) => rs.state === 'ready')
        addC({ x: d.x, z: d.z, r: 1.6, text: ready ? 'TALK' : 'NO CLEAN ROOM YET', warn: !ready, run: () => talk(), prio: ready ? 3 : -2 })
      } else if (g.stage === 'talked') addC({ x: d.x, z: d.z, r: 1.6, text: `GET KEY ${g.room.r.number} · ROOM KEYS BOARD`, warn: true, run: () => {}, prio: -2 })
      else if (g.stage === 'keyed') addC({ x: d.x, z: d.z, r: 1.6, text: `TAKE $${g.pay}`, run: () => takePayment(), prio: 3 })
    }
    const kb = LAYOUT.keyBoardPoint
    if (g?.stage === 'talked' && near(kb.x, kb.z, 1.7)) addC({ x: kb.x, z: kb.z, r: 1.7, text: `GIVE KEY ${g.room.r.number}`, run: () => giveKey(), prio: 4 })
    // Cash on the counter + money left at doors.
    const cp = LAYOUT.cashPoint
    if (S.register > 0 && near(cp.x, cp.z, 1.3)) addC({ x: cp.x, z: cp.z, r: 1.3, text: `COLLECT CASH · $${S.register}`, run: () => collectCash(), prio: 1 })
    for (const dr of S.drops) if (near(dr.x, dr.z, 1.4)) addC({ x: dr.x, z: dr.z, r: 1.4, text: `TAKE $${dr.amount}`, run: () => takeDrop(dr), prio: 4 })
    // Help wanted board.
    const hb = office.helpBoard
    if (near(hb.x, hb.z, 1.8)) addC({ x: hb.x, z: hb.z, r: 1.8, text: 'HELP WANTED', run: () => openPanel('staff') })
    // Food: stations, phone, serving, deliveries.
    food.gather(near, addC)
    // Rooms: locked doors, sleeping guests, cleaning.
    for (const rs of roomState) {
      const r = rs.r
      if (rs.state === 'locked' && near(r.doorX, FRONT + 1, 1.8)) {
        const price = ECONOMY.unlockRoom[r.index]
        addC({ x: r.doorX, z: FRONT + 1, r: 1.8, text: `OPEN ROOM ${r.number} · $${price}`, warn: bank.money < price, run: () => openRoom(rs, price) })
      }
      if (rs.state === 'occupied' && near(r.doorX, FRONT + 0.8, 1.4)) addC({ x: r.doorX, z: FRONT + 0.8, r: 1.4, text: 'GUESTS INSIDE · DO NOT DISTURB', warn: true, run: () => play('error'), prio: -3 })
      if (rs.state === 'dirty') clean.gather(rs, near, addC, cleanCtx)
    }
    // Curb appeal: graffiti + posters on the outside walls.
    curb.gather(near, addC, speedMul())
    // Walkway grime.
    for (const s of grime) {
      if (!near(s.x, s.z, 1.2)) continue
      addC({ key: s, x: s.x, z: s.z, r: 1.2, text: 'SCRUB THE GRIME', tool: 'sponge', hold: ECONOMY.scrubTime / speedMul(), startP: s.p, progress: (p) => {
        s.p = p
        s.mesh.material.opacity = 1 - p * 0.85
        s.mesh.scale.setScalar(1 - p * 0.5)
        if (Math.random() < 0.5) fx.bubbles(s.x, 0.35, s.z, 2)
      }, run: () => finishGrime(s) })
    }
    // Dumpster.
    const dp = yard.dumpPoint
    if (near(dp.x, dp.z, 2.6)) {
      if (S.carry?.kind === 'junk') addC({ x: dp.x, z: dp.z, r: 2.6, text: 'THROW IT IN', run: () => throwJunk(), prio: 4 })
      else if (S.bag > 0) addC({ x: dp.x, z: dp.z, r: 2.6, text: `EMPTY BAG (+$${S.bag * ECONOMY.trashPay})`, run: () => emptyBag(), prio: 3 })
    }
    // Big junk.
    if (!S.carry) for (const j of yardJunk) if (!j.taken && near(j.x, j.z, 1.7)) addC({ x: j.x, z: j.z, r: 1.7, text: 'CARRY JUNK', tool: 'hands', run: () => carryJunk(j) })
    // Laundry: basket, washer.
    const bh = laundry.basket.home
    if (!S.carry && S.dirtyLinen > 0 && near(bh.x, bh.z, 1.5)) addC({ x: bh.x, z: bh.z, r: 1.5, text: `CARRY LAUNDRY BASKET (${S.dirtyLinen})`, tool: 'hands', run: () => pickBasket() })
    const wp = laundry.washer
    if (near(wp.x, wp.z, 1.8)) {
      if (washer.state === 'idle' && S.carry?.kind === 'basket') addC({ x: wp.x, z: wp.z, r: 1.8, text: 'WASH THE SHEETS', run: () => washBasket(), prio: 4 })
      else if (washer.state === 'done') addC({ key: 'fold', x: wp.x, z: wp.z, r: 1.8, text: 'FOLD CLEAN SHEETS', tool: 'hands', hold: 1.0, run: () => foldWash() })
      else if (washer.state === 'washing') addC({ x: wp.x, z: wp.z, r: 1.8, text: `WASHING… ${Math.ceil(washer.t)}s`, warn: true, run: () => {}, prio: -1 })
      else if (washer.state === 'idle' && !S.carry) addC({ x: wp.x, z: wp.z, r: 1.8, text: S.dirtyLinen ? 'BRING THE BASKET HERE' : 'NO DIRTY SHEETS', warn: true, run: () => {}, prio: -2 })
    }
    if (S.carry?.kind === 'basket' && near(bh.x, bh.z, 1.3)) addC({ x: bh.x, z: bh.z, r: 1.3, text: 'PUT BASKET DOWN', run: () => dropBasket() })
    // Fountain.
    const fp = fountain.point
    if (!fountain.isFixed() && near(fp.x, fp.z, 2.4)) addC({ key: 'fountain', x: fp.x, z: fp.z, r: 2.4, text: `FIX FOUNTAIN · $${ECONOMY.fountainCost}`, warn: bank.money < ECONOMY.fountainCost, hold: ECONOMY.fountainTime, tool: 'hands', run: () => fixFountain() })
    // Pick the best: highest priority, then nearest.
    let best = null
    let bestScore = Infinity
    for (const c of cands) {
      const sc = dist2(px, pz, c.x, c.z) - (c.prio ?? 0) * 4
      if (sc < bestScore) {
        bestScore = sc
        best = c
      }
    }
    return best
  }

  // The right tool comes out by itself when you press / hold E on its job. The only thing that
  // stops it is carrying something (the basket / junk pins HANDS): put it down first.
  const needsTool = (c) => !!c.tool && c.tool !== 'hands' && c.tool !== S.tool && !!S.carry
  function autoTool(c) {
    if (c.tool && c.tool !== S.tool && !needsTool(c)) setTool(c.tool)
  }
  function press() {
    if (hud.menuOpen() || panelOpen() || decor.isOpen()) return
    const c = action
    if (!c) return
    // E on a tool job while carrying: put the item down, then the tool comes out.
    if (needsTool(c)) putDown()
    autoTool(c)
    if (!c.hold && !c.warn) {
      c.run()
      action = null
    }
  }

  function openRoom(rs, price) {
    if (!(bank.openRoom?.(rs.r.number, price))) {
      play('error')
      return hud.toast('Not enough money')
    }
    rs.state = 'ready'
    rs.bed = 'made'
    const p = { x: rs.r.doorX, y: 1.2, z: FRONT + 0.3 }
    fx.dust(p.x, 0.5, p.z, 18, '#c99a5e', 1.2)
    fx.sparkle(p.x, 1.5, p.z, 20)
    play('pry', p)
    setTimeout(() => play('tada', p), 300)
    hud.announce(`ROOM ${rs.r.number} IS OPEN!`, 'ready for guests')
    refreshRoom(rs)
  }
  function finishGrime(s) {
    grime.splice(grime.indexOf(s), 1)
    scene.remove(s.mesh)
    fx.sparkle(s.x, 0.4, s.z, 12, '#bff4ff')
    play('chime', { x: s.x, y: 0.4, z: s.z })
  }
  function checkRoomClean(rs) {
    if (rs.state !== 'dirty') return
    clean.syncTrash(rs)
    if (clean.pct(rs) < 1) return
    rs.state = 'ready'
    rs.litter = []
    rs.celebrate = 3
    rs.bounce = 1
    refreshRoom(rs)
    const c = rs.r.interior.center
    for (let i = 0; i < 6; i++) setTimeout(() => fx.sparkle(c.x + rnd(-2.5, 2.5), rnd(0.5, 2.5), c.z + rnd(-3.5, 3.5), 24, i % 2 ? '#bff4ff' : '#fff2a8'), i * 150)
    fx.poof(rs.r.doorX, 1, FRONT + 0.4)
    play('levelUp')
    setTimeout(() => play('tada', { x: c.x, y: 1.5, z: c.z }), 350)
    hud.announce(`ROOM ${rs.r.number} IS 100% CLEAN!`, 'ready for the next guest ✨')
  }
  function emptyBag() {
    const pay = S.bag * ECONOMY.trashPay
    bank.earn(pay, 'trash')
    const p = new Vector3(LAYOUT.dumpster.x, 2.2, LAYOUT.dumpster.z)
    hud.float(p, `+$${pay}`)
    fx.dust(p.x, 1.8, p.z, 10, '#8a7a5a', 0.8)
    play('clang', p)
    S.bag = 0
  }
  function carryJunk(j) {
    j.taken = true
    S.carry = { kind: 'junk', obj: j.obj, item: j, home: { y: j.obj.position.y, s: j.obj.scale.x, r: j.obj.rotation.clone() } }
    scene.remove(j.obj)
    j.obj.position.set(0, 2.25, 0)
    j.obj.rotation.set(0, 0, 0)
    j.obj.scale.setScalar(0.62)
    playerGroup.add(j.obj)
    fx.dust(j.x, 0.2, j.z, 12)
    play('thud', { x: j.x, y: 0.5, z: j.z })
  }
  // Junk set down at your feet (to use a tool); pick it up again later.
  function dropJunk() {
    const j = S.carry
    S.carry = null
    playerGroup.remove(j.obj)
    scene.add(j.obj)
    const it = j.item
    it.x = player.position.x
    it.z = player.position.z
    it.taken = false
    j.obj.position.set(it.x, j.home?.y ?? 0, it.z)
    if (j.home?.r) j.obj.rotation.copy(j.home.r)
    j.obj.scale.setScalar(j.home?.s ?? 1)
    play('thud', { x: it.x, y: 0.5, z: it.z })
  }
  // Whatever you carry goes down so a tool can come out: the basket goes back home, junk drops
  // at your feet, food goes back on its station (or the bin when the station is busy again).
  function putDown() {
    const c = S.carry
    if (!c) return
    if (c.kind === 'basket') {
      dropBasket()
      hud.toast('Put the laundry basket back')
    } else if (c.kind === 'junk') {
      dropJunk()
      hud.toast('Put the junk down · carry it to the dumpster later')
    } else if (c.kind === 'food') {
      const where = food.putDown()
      hud.toast(where === 'station' ? 'Put the food back on its station' : 'Binned the food')
    } else S.carry = null
  }
  const carryName = () => ({ basket: 'basket', junk: 'junk', food: 'food' })[S.carry?.kind] ?? 'item'
  let flying = null // junk arcing into the dumpster
  function throwJunk() {
    const j = S.carry
    S.carry = null
    playerGroup.remove(j.obj)
    j.obj.scale.setScalar(0.62)
    scene.add(j.obj)
    const from = new Vector3(player.position.x, 2.4, player.position.z)
    const to = new Vector3(LAYOUT.dumpster.x, 1.6, LAYOUT.dumpster.z)
    flying = { obj: j.obj, from, to, t: 0 }
    bank.earn(ECONOMY.yardJunkPay, 'junk')
    hud.float(to.clone().setY(2.6), `+$${ECONOMY.yardJunkPay}`)
    yardProgress()
  }
  function yardProgress() {
    if (!S.yardDone && yardLeft() === 0) {
      S.yardDone = true
      bank.earn(ECONOMY.yardReward, 'yard')
      hud.announce('JUNK YARD CLEARED!', `+$${ECONOMY.yardReward} bonus`)
      play('levelUp')
    }
  }
  function pickBasket() {
    S.carry = { kind: 'basket' }
    setTool('hands')
    const g = laundry.basket.group
    g.parent.remove(g)
    g.position.set(0, 1.05, 0.55)
    g.scale.setScalar(0.85)
    playerGroup.add(g)
    play('rustle', { x: player.position.x, y: 1, z: player.position.z })
  }
  function dropBasket(home = true) {
    const g = laundry.basket.group
    playerGroup.remove(g)
    scene.add(g)
    g.scale.setScalar(1)
    const h = laundry.basket.home
    if (home) g.position.set(h.x, h.y, h.z)
    S.carry = null
    play('thud', h)
  }
  function washBasket() {
    const load = S.dirtyLinen
    S.dirtyLinen = 0
    dropBasket()
    startWash(load)
    hud.toast('Washing… come back to fold the clean sheets')
  }
  function fixFountain() {
    if (!bank.spend(ECONOMY.fountainCost)) {
      play('error')
      return hud.toast('Not enough money')
    }
    fountain.fix()
    rate(5, 1.2)
    hud.announce('FOUNTAIN FIXED!', 'guests love it · +rating')
    play('tada', fountain.point)
    play('splash', fountain.point)
    fx.sparkle(LAYOUT.fountain.x, 3, LAYOUT.fountain.z, 40, '#bff4ff')
  }

  // Furnish menu for the room the player is standing in.
  let currentRoom = null
  function openFurnish() {
    if (decor.isOpen() || panelOpen()) return
    if (!currentRoom) return hud.toast('Walk into a room to furnish it')
    if (S.carry) return hud.toast('Put down what you are carrying first')
    hud.closeMenu?.()
    hud.setPrompt(null)
    decor.open(currentRoom.r.number)
  }

  // --- Objective ------------------------------------------------------------------------------
  function objective() {
    const g = front()
    if (g && !hired('sam')) {
      if (g.stage === 'queued') return roomState.some((rs) => rs.state === 'ready') ? ['Check in the guest · TALK at the desk', 0.1, '🛎️'] : ['A guest is waiting · clean a room first!', 0, '🧹']
      if (g.stage === 'talked') return [`Give key ${g.room.r.number} · ROOM KEYS board (west wall)`, 0.45, '🔑']
      if (g.stage === 'keyed') return [`Take $${g.pay} from the guest`, 0.8, '💵']
    }
    const fo = food.objective()
    if (fo) return fo
    if (S.carry?.kind === 'basket') return ['Bring the basket to the washer in the laundry', 0.5, '🧺']
    const dirty = roomState.find((rs) => rs.state === 'dirty')
    if (dirty) {
      const t = clean.nextTask(dirty)
      const pct = clean.pct(dirty)
      let what = 'finish cleaning'
      if (t) {
        const tool = { strip: 'HANDS', make: 'HANDS', trash: 'BAG 1', dust: 'VACUUM 3', stain: 'SPONGE 2', mud: 'MOP 4', toilet: 'BRUSH 5', sink: 'SPONGE 2' }[t.kind]
        const verb = { strip: 'strip the sheets', make: S.cleanSets > 0 ? 'make the bed' : 'wash sheets in the laundry first', trash: 'pick up the trash', dust: 'vacuum the dust', stain: 'scrub the stains', mud: 'mop the mud', toilet: 'scrub the toilet', sink: 'wipe sink & mirror' }[t.kind]
        what = `${verb} (${tool})`
      }
      return [`Room ${dirty.r.number} is ${Math.round(pct * 100)}% clean: ${what}`, pct, '🧹']
    }
    if (washer.state === 'done') return ['The laundry is done: fold the clean sheets', 1, '🧺']
    if (S.cleanSets <= 1 && S.dirtyLinen > 0) return ['Low on clean sheets: bring the basket to the washer', 0.3, '🧺']
    if (S.register >= 30) return [`Collect $${S.register} from the counter`, 0.9, '💵']
    if (S.appeal < CURB.fewerBelow) {
      const bits = []
      if (curb.count('graffiti')) bits.push(`graffiti ${curb.count('graffiti')} (SPONGE)`)
      if (curb.count('poster')) bits.push(`posters ${curb.count('poster')} (HANDS)`)
      if (outdoorLitter.length) bits.push(`lot trash ${outdoorLitter.length} (BAG)`)
      return [`Guests skip dirty motels! Curb appeal ${S.appeal}%: clean ${bits.slice(0, 2).join(', ')}`, S.appeal / 100, '✨']
    }
    const goal = call('nextGoal')
    if (goal?.title) return [goal.hint ? `${goal.title} · ${goal.hint}` : goal.title, goal.progress ?? 0, '🛋️']
    return ['Keep your motel spotless and the guests happy', 1, '⭐']
  }

  // --- Saving (stored by the UI layer's net.js through the economy) ------------------------------
  call('addSaveSection', 'game', () => ({
    cleanSets: S.cleanSets,
    dirtyLinen: S.dirtyLinen,
    rating: Math.round(S.rating * 100) / 100,
    register: S.register,
    fountain: fountain.isFixed(),
    bags: yardBags.map((b) => (b.taken ? 1 : 0)).join(''),
    junk: yardJunk.map((b) => (b.taken ? 1 : 0)).join(''),
    seen: [...S.seenGuests],
  }), (o) => {
    if (!o) return
    if (Number.isFinite(o.cleanSets)) S.cleanSets = o.cleanSets
    if (Number.isFinite(o.dirtyLinen)) S.dirtyLinen = o.dirtyLinen
    if (Number.isFinite(o.rating)) S.rating = o.rating
    if (Number.isFinite(o.register)) {
      S.register = o.register
      refreshPile()
    }
    if (o.fountain && !fountain.isFixed()) fountain.fix()
    const apply = (list, str) => [...(str ?? '')].forEach((c, i) => {
      if (c === '1' && list[i] && !list[i].taken) {
        list[i].taken = true
        scene.remove(list[i].obj)
      }
    })
    apply(yardBags, o.bags)
    apply(yardJunk, o.junk)
    S.yardDone = yardLeft() === 0
    for (const id of o.seen ?? []) S.seenGuests.add(id)
    drawGuestsBoard()
    roomState.forEach(refreshRoom)
  })

  window.__motel = {
    decor,
    state: S, rooms: roomState, guests, queue, food, curb, clean,
    leaveDirty: (i) => leaveDirty(roomState[i]),
    talk, giveKey, takePayment, collectCash,
    spawnGuest: () => spawnGuest(LAYOUT.busStop.x, LAYOUT.sidewalk.z0 + 1.7, false),
    // Dev: does the next cleaning job in room i (like Rose).
    cleanStep: (i) => clean.staffStep(roomState[i], cleanCtx),
    appeal: appealNow,
  }

  // --- Per-frame ---------------------------------------------------------------------------------
  const suckers = [] // trash flying into the bag
  let stepDist = 0
  let lastPX = player.position.x
  let lastPZ = player.position.z
  let night = 0
  let moteT = 0
  const baseWalk = PHYSICS.walkSpeed
  const baseSprint = PHYSICS.sprintSpeed
  let lastAnnBus = ''
  let clock = 0

  function update(dt, t) {
    clock += dt
    setPacing(roomState.filter((rs) => rs.state !== 'locked').length, call('franchiseLevel') ?? 0)
    syncTool()
    const px = player.position.x
    const pz = player.position.z
    night += ((lighting.isNight() ? 1 : 0) - night) * Math.min(1, dt * 0.5)
    motel.setNight(night)
    S.appeal = appealNow()

    // Carry slowdown.
    const slow = S.carry?.kind === 'junk' || S.carry?.kind === 'basket' ? ECONOMY.carrySlow : 1
    PHYSICS.walkSpeed = baseWalk * slow
    PHYSICS.sprintSpeed = baseSprint * slow

    // Drive-in guests between buses (clean rooms or not: they wait while you clean). Natural, not
    // a steady stream: random gaps with quiet spells, rarer while someone already waits, none
    // right after a bus.
    S.carTimer -= dt
    if (S.carTimer <= 0) {
      const slow = S.appeal < CURB.fewestBelow ? CURB.lowSlow * 2 : S.appeal < CURB.fewerBelow ? CURB.lowSlow : 1
      const mean = (DRIVE_IN.mean / (1 + pacing.heat * DRIVE_IN.perHeat)) * slow
      S.carTimer = Math.min(DRIVE_IN.maxGap * slow, Math.max(DRIVE_IN.minGap, -Math.log(1 - Math.random()) * mean))
      const room = queue.length < QUEUE.max && (queue.length === 0 || Math.random() < DRIVE_IN.whileWaiting)
      if (room && clock >= S.calmUntil) driveIn()
    }

    // Bus schedule.
    if (bus.state === 'away') {
      S.busTimer -= dt
      if (S.busTimer <= 0) {
        const tourists = S.nextTour || (call('takeTourists') ?? 0) > 0
        bus.arrive(() => busStopped(tourists), tourists)
        S.busTourists = tourists
        play('horn', { x: LAYOUT.busStop.x, y: 2, z: LAYOUT.busLaneZ })
        S.nextTour = false
      }
    }
    bus.update(dt)
    const ex = bus.exhaust()
    if (bus.state !== 'away') {
      if (Math.random() < 0.4) fx.smoke(ex.x, ex.y, ex.z)
      sfxLoop('bus', 'engine', { x: bus.x, y: 1, z: LAYOUT.busLaneZ }, 0.9)
      engineRate('bus', bus.state === 'stopped' ? 0.1 : 0.7)
    } else sfxLoop('bus', 'engine', { x: bus.x, y: 1, z: LAYOUT.busLaneZ }, 0)

    // Litter + grime + vandals build up over time.
    litterT -= dt
    if (litterT <= 0) {
      litterT = ECONOMY.litterEvery / spawnMul()
      if (outdoorLitter.length < ECONOMY.litterMax) spawnLitter(...randomLotSpot())
    }
    grimeT -= dt
    if (grimeT <= 0) {
      grimeT = ECONOMY.grimeEvery / spawnMul()
      if (grime.length < ECONOMY.grimeMax) spawnGrime()
    }
    curb.update(dt * spawnMul())

    // The bag comes out by itself when you walk up to trash while there is no tool job in reach
    // (a tool job switches the tool itself when you hold E), then walking over the trash sucks it in.
    if (S.tool !== 'trash' && !S.carry && !S.holdKey && !action?.tool && S.bag < bagCap()) {
      const lists = [outdoorLitter, yardBags, ...roomState.map((rs) => rs.litter)]
      if (lists.some((list) => list.some((it) => !it.taken && dist2(px, pz, it.x, it.z) < 1.5 * 1.5))) setTool('trash')
    }
    // Trash bag: walking over trash sucks it in.
    if (S.tool === 'trash' && !S.carry) {
      const cap = bagCap()
      const lists = [outdoorLitter, yardBags, ...roomState.map((rs) => rs.litter)]
      for (const list of lists) {
        for (const it of list) {
          if (it.taken || dist2(px, pz, it.x, it.z) > 1.7 * 1.7) continue
          if (S.bag >= cap) {
            if (!S.fullWarned) hud.toast('Bag full! Empty it in the dumpster behind the motel')
            S.fullWarned = true
            break
          }
          it.taken = true
          S.bag += it.yard ? 2 : 1
          S.fullWarned = false
          suckers.push({ obj: it.obj, t: 0, from: it.obj.position.clone() })
          play('pickup', it.obj.position)
          if (it.yard) yardProgress()
        }
      }
      for (let i = outdoorLitter.length - 1; i >= 0; i--) if (outdoorLitter[i].taken) outdoorLitter.splice(i, 1)
      for (const rs of roomState) if (rs.state === 'dirty') checkRoomClean(rs)
    }
    ppos.set(px, player.position.y + 1.1, pz)
    for (let i = suckers.length - 1; i >= 0; i--) {
      const s = suckers[i]
      s.t += dt * 3.2
      const k = Math.min(1, s.t)
      s.obj.position.lerpVectors(s.from, ppos, k * k)
      s.obj.position.y += Math.sin(k * Math.PI) * 0.8
      s.obj.scale.setScalar(Math.max(0.01, 1 - k))
      s.obj.rotation.y += dt * 12
      if (k >= 1) {
        scene.remove(s.obj)
        suckers.splice(i, 1)
        fx.suck(s.from, ppos)
        play('rustle', ppos)
      }
    }
    if (flying) {
      flying.t += dt * 1.6
      const k = Math.min(1, flying.t)
      flying.obj.position.lerpVectors(flying.from, flying.to, k)
      flying.obj.position.y += Math.sin(k * Math.PI) * 2.2
      flying.obj.rotation.x += dt * 5
      if (k >= 1) {
        scene.remove(flying.obj)
        fx.dust(flying.to.x, 1.8, flying.to.z, 16, '#8a7a5a', 1)
        play('clang', flying.to)
        flying = null
      }
    }
    // Bills in flight.
    for (let i = flyingBills.length - 1; i >= 0; i--) {
      const b = flyingBills[i]
      if (b.delay > 0) {
        b.delay -= dt
        continue
      }
      b.t += dt * 2.4
      const k = Math.min(1, b.t)
      const to = typeof b.to === 'function' ? b.to() : b.to
      b.obj.position.lerpVectors(b.from, to, k)
      b.obj.position.y += Math.sin(k * Math.PI) * 0.7
      b.obj.rotation.set(k * 9, k * 7, 0)
      if (k >= 1) {
        scene.remove(b.obj)
        flyingBills.splice(i, 1)
        b.done?.()
      }
    }
    for (const dr of S.drops) {
      dr.obj.rotation.y += dt * 2
      dr.obj.position.y = 0.3 + Math.sin(clock * 4 + dr.x) * 0.04
    }
    // Keys in flight: board -> guest's hand.
    for (let i = flyingKeys.length - 1; i >= 0; i--) {
      const f = flyingKeys[i]
      f.t += dt * 1.8
      const k = Math.min(1, f.t)
      const to = new Vector3(f.g.w.x, 1.3, f.g.w.z)
      f.key.position.lerpVectors(f.from, to, k)
      f.key.position.y += Math.sin(k * Math.PI) * 0.9
      f.key.rotation.y += dt * 14
      f.key.scale.setScalar(1 + Math.sin(k * Math.PI) * 1.2)
      if (Math.random() < 0.4) fx.sparkle(f.key.position.x, f.key.position.y, f.key.position.z, 1, '#ffe07a')
      if (k >= 1) {
        flyingKeys.splice(i, 1)
        f.g.p.group.attach(f.key)
        f.key.position.set(0.34, 1.0, 0.28)
        f.key.rotation.set(0, 0, 0)
        f.key.scale.setScalar(1.6)
        f.g.stage = 'keyed'
        play('key', to)
        fx.sparkle(to.x, to.y, to.z, 10, '#ffe07a')
      }
    }
    // The key you have to give glows on the board.
    const fg = front()
    for (const rs of roomState) {
      const key = keyOf(rs)
      if (!key.userData.out) key.userData.tag.emissiveIntensity = fg?.stage === 'talked' && fg.room === rs ? 0.6 + Math.sin(clock * 7) * 0.5 : 0
    }

    // Interaction prompt + holding.
    action = hud.menuOpen() || panelOpen() || decor.isOpen() ? null : gather()
    let using = false
    if (action?.hold) {
      if (action.key !== S.holdRef) {
        S.holdRef = action.key
        S.holdT = (action.startP ?? 0) * action.hold
      }
      const wrong = needsTool(action)
      const holding = S.holdKey && !wrong && !action.warn
      if (holding) {
        autoTool(action)
        S.holdT += dt * (action.tool === 'sponge' && bank.has?.('turboSponge') ? 2 : 1)
        const p = Math.min(1, S.holdT / action.hold)
        action.progress?.(p, dt)
        using = !!action.tool && action.tool !== 'hands'
        if (!action.progress && Math.random() < 0.2) fx.dust(action.x, 0.6, action.z, 2, '#ffffff', 0.4)
        if (S.holdT >= action.hold) {
          S.holdT = 0
          S.holdRef = null
          action.run()
        }
      }
      hud.setPrompt({ text: wrong ? `${action.text} · E puts down the ${carryName()}` : `${action.text} · HOLD`, hold: S.holdT / action.hold, warn: action.warn })
    } else {
      S.holdRef = null
      if (action) hud.setPrompt({ text: needsTool(action) ? `${action.text} · E puts down the ${carryName()}` : action.text, warn: action.warn })
      else hud.setPrompt(null)
    }
    held?.setUsing?.(using)

    // Doors: open for whoever is near (not for occupied / locked rooms, except the guest).
    const near = (x, z, r) => dist2(px, pz, x, z) < r * r
    for (const rs of roomState) {
      const r = rs.r
      let open = false
      if (rs.state !== 'locked') {
        if (rs.state !== 'occupied' && near(r.doorX, FRONT, 2.2)) open = true
        for (const g of guests) if (g.room === rs && (g.stage === 'toRoom' || g.stage === 'leaving') && dist2(g.w.x, g.w.z, r.doorX, FRONT) < 6) open = true
        for (const c of food.customers) if (c.rs === rs && dist2(c.w.x, c.w.z, r.doorX, FRONT) < 6) open = true // a guest out for food
        const rose = staff.rose
        if (rose && rose.task === rs && dist2(rose.w.x, rose.w.z, r.doorX, FRONT) < 6) open = true
      }
      const before = rs.doorOpen
      rs.doorOpen += ((open ? 1 : 0) - rs.doorOpen) * Math.min(1, dt * 6)
      r.door.rotation.y = rs.doorOpen * 1.45
      if (before < 0.5 && rs.doorOpen >= 0.5) play('doorOpen', { x: r.doorX, y: 1.2, z: FRONT })
      if (before > 0.5 && rs.doorOpen <= 0.5) play('doorClose', { x: r.doorX, y: 1.2, z: FRONT })
      rs.collider?.setEnabled(rs.doorOpen < 0.35)
      // Celebration after a full clean: sparkles drift up, the bed bounces.
      if (rs.celebrate > 0) {
        rs.celebrate -= dt
        const c = r.interior.center
        if (Math.random() < 0.5) fx.sparkle(c.x + rnd(-2.6, 2.6), rnd(0.3, 2.2), c.z + rnd(-3.6, 3.6), 3, Math.random() < 0.5 ? '#bff4ff' : '#fff2a8')
      }
      if (rs.bounce > 0) {
        rs.bounce = Math.max(0, rs.bounce - dt * 1.5)
        const k = Math.sin((1 - rs.bounce) * Math.PI * 4) * rs.bounce * 0.12
        r.interior.bed.group.scale.set(1 - k * 0.5, 1 + k, 1 - k * 0.5)
      }
      // CLEAN % tag over the door.
      let tag = null
      if (rs.state === 'dirty') {
        const pc = clean.pct(rs)
        tag = { pct: pc, text: `🧹 ROOM ${r.number} · ${Math.round(pc * 100)}% CLEAN` }
      } else if (rs.celebrate > 0) tag = { pct: 1, text: `✨ ROOM ${r.number} · 100% CLEAN!`, done: true }
      hud.roomTag(r.number, () => ({ x: r.doorX + 0.1, y: 3.45, z: FRONT + 0.3 }), tag)
    }
    // Office door.
    let officeOpen = near(DOOR_X, FRONT, 2.4)
    for (const g of guests) if (dist2(g.w.x, g.w.z, DOOR_X, FRONT) < 6) officeOpen = true
    for (const c of food.customers) if (dist2(c.w.x, c.w.z, DOOR_X, FRONT) < 6) officeOpen = true
    office.door.pivot.rotation.y += ((officeOpen ? 1.4 : 0) - office.door.pivot.rotation.y) * Math.min(1, dt * 6)
    // Laundry door: opens for the player or Lou.
    const ld = laundry.door
    if (ld.pivot) {
      const lou = staff.lou
      const laundryOpen = near(ld.x, ld.z, 2.4) || (lou && dist2(lou.w.x, lou.w.z, ld.x, ld.z) < 6)
      ld.pivot.rotation.y += ((laundryOpen ? 1.4 : 0) - ld.pivot.rotation.y) * Math.min(1, dt * 6)
    }
    office.blades.rotation.y += dt * 5
    // Laundry clock hands.
    const d = new Date()
    laundry.clock[0].rotation.z = -((d.getHours() % 12) / 12) * Math.PI * 2
    laundry.clock[1].rotation.z = -(d.getMinutes() / 60) * Math.PI * 2

    cars.update(dt)
    // Guests.
    for (const g of [...guests]) {
      g.w.update(dt, floorAt)
      if (g.tier?.aura && g.p.group.visible) {
        g.auraT -= dt
        if (g.auraT <= 0) {
          g.auraT = g.tier.id === 'vip' ? 0.07 : 0.14
          fx.sparkle(g.w.x + (Math.random() - 0.5) * 0.5, 0.3 + Math.random() * 1.6, g.w.z + (Math.random() - 0.5) * 0.5, g.tier.id === 'vip' ? 3 : 1, g.tier.aura)
        }
      }
      if (g.stage === 'queued') {
        g.waited = (g.waited ?? 0) + dt
        if (queue[0] === g) {
          // While no room is ready they give you time to clean one.
          g.patience -= dt * (roomState.some((rs) => rs.state === 'ready') ? 1 : ECONOMY.noRoomPatience)
          if (g.patience <= 0) guestLeavesAngry(g)
        }
      }
      if (g.stage === 'inRoom') {
        g.stay -= dt
        if (g.stay <= 0) checkOut(g)
      }
    }
    // Wants bubble over the guest at the counter.
    let bub = null
    if (fg?.stage === 'queued') bub = `${fg.tier?.icon ?? fg.type.icon} ${fg.tier && fg.tier.payMul > 1 ? `${fg.tier.name} · ` : ''}🛏️ ${wantName(fg)} · ${fg.nights}🌙`
    else if (fg?.stage === 'talked') bub = `🔑 Key ${fg.room.r.number} please!`
    else if (fg?.stage === 'keyed') bub = `💵 $${fg.pay}`
    hud.bubble('want', () => ({ x: fg.w.x, y: 2.5, z: fg.w.z }), bub, fg?.patience < 20 && fg?.stage === 'queued' ? 'want hot' : 'want')

    // Food, phone, walk-ins, Mia.
    food.update(dt, S.appeal)

    // Staff.
    if (hired('sam')) {
      const sam = ensureStaff('sam')
      sam.w.update(dt, floorAt)
      sam.w.face(0)
      const g = front()
      const playerAtDesk = near(LAYOUT.deskPoint.x, LAYOUT.deskPoint.z, 1.8) || near(LAYOUT.keyBoardPoint.x, LAYOUT.keyBoardPoint.z, 1.8)
      if (g && !playerAtDesk && (g.stage === 'queued' || g.stage === 'talked' || g.stage === 'keyed')) {
        sam.t += dt * (call('staffSpeed', 'sam') || 1)
        if (sam.t > 1.6) {
          sam.t = 0
          if (g.stage === 'queued') talk(true)
          else if (g.stage === 'talked') giveKey()
          else takePayment(true)
        }
      }
    }
    if (hired('rose')) {
      const rose = ensureStaff('rose')
      rose.w.update(dt, floorAt)
      if (!rose.task && !rose.w.busy) {
        const target = roomState.find((rs) => rs.state === 'dirty' && !rs.claimed)
        if (target) {
          target.claimed = true
          rose.task = target
          const r = target.r
          rose.w.go([[rose.w.x, WALK_Z], [r.doorX, WALK_Z], [r.doorX, FRONT + 0.8], [r.doorX, FRONT - 1.4], [r.interior.center.x, r.interior.center.z]], () => (rose.t = 0))
        }
      }
      if (rose.task && !rose.w.busy) {
        rose.t += dt * (call('staffSpeed', 'rose') || 1)
        if (Math.random() < 0.15) fx.bubbles(rose.w.x, 0.5, rose.w.z, 2)
        if (rose.t > 2.4) {
          rose.t = 0
          const rs = rose.task
          const did = rs.state === 'dirty' ? clean.staffStep(rs, cleanCtx) : null
          if (did) {
            const at = did.at ?? { x: did.x, z: did.z }
            rose.w.go([[at.x + 0.4, at.z + 0.4]])
          }
          if (!did || rs.state !== 'dirty') {
            rs.claimed = false
            rose.task = null
            const r = rs.r
            rose.w.go([[r.doorX, FRONT - 1.4], [r.doorX, FRONT + 0.8], [r.doorX, WALK_Z], [rose.home[0], rose.home[1]]], () => rose.w.face(0))
            if (!did && rs.state === 'dirty') hud.toast(`Rose needs clean sheets for room ${rs.r.number}`)
          }
        }
      }
    }
    if (hired('lou')) {
      const lou = ensureStaff('lou')
      lou.w.update(dt, floorAt)
      lou.t += dt * (call('staffSpeed', 'lou') || 1)
      if (lou.t > 4) {
        lou.t = 0
        if (washer.state === 'done') foldWash()
        else if (washer.state === 'idle' && S.dirtyLinen > 0 && S.carry?.kind !== 'basket') {
          const load = S.dirtyLinen
          S.dirtyLinen = 0
          startWash(load)
        }
      }
    }

    // Laundry chute (upgrade): used sheets slide straight into the washer and the clean sets go
    // to the shelf by themselves: no basket trips.
    if (bank.has?.('laundryChute')) {
      if (washer.state === 'done') foldWash()
      else if (washer.state === 'idle' && S.dirtyLinen > 0 && S.carry?.kind !== 'basket') {
        const load = S.dirtyLinen
        S.dirtyLinen = 0
        startWash(load)
      }
    }

    // Washer.
    if (washer.state === 'washing') {
      washer.t -= dt
      laundry.washer.drum.rotation.z -= dt * 9
      laundry.washer.suds.opacity = Math.min(0.85, laundry.washer.suds.opacity + dt)
      if (Math.random() < 0.3) fx.bubbles(laundry.washer.x, 0.9, laundry.washer.z - 0.5, 1)
      sfxLoop('washer', 'washer', { x: laundry.washer.x, y: 0.6, z: laundry.washer.z - 0.5 }, 0.8)
      if (washer.t <= 0) {
        washer.state = 'done'
        laundry.washer.led.emissiveIntensity = 0.5
        play('bell', { x: laundry.washer.x, y: 1, z: laundry.washer.z })
        if (near(laundry.washer.x, laundry.washer.z, 12)) hud.toast('Wash done! Fold the clean sheets')
      }
    } else {
      laundry.washer.suds.opacity = Math.max(0, laundry.washer.suds.opacity - dt)
      sfxLoop('washer', 'washer', { x: laundry.washer.x, y: 0.6, z: laundry.washer.z }, 0)
    }
    refreshLaundry()

    // Fountain + pool + signs.
    fountain.update(dt, t)
    pool.update(dt, t)
    if (fountain.isFixed()) {
      for (const sp of fountain.spouts) fx.water(sp.x, sp.y, sp.z, 2)
      if (Math.random() < 0.6) {
        const a = Math.random() * Math.PI * 2
        fx.splash(LAYOUT.fountain.x + Math.cos(a) * 1.8, 0.65, LAYOUT.fountain.z + Math.sin(a) * 1.8)
      }
    }
    sfxLoop('fountain', 'fountain', { x: LAYOUT.fountain.x, y: 1.5, z: LAYOUT.fountain.z }, fountain.isFixed() ? 1 : 0)
    sfxLoop('neon', 'neon', { x: LAYOUT.sign.x, y: 5, z: LAYOUT.sign.z }, 0.6)
    sfxLoop('fan', 'fan', { x: LAYOUT.deskPoint.x, y: 3, z: LAYOUT.counterZ }, 0.5)
    const hasRoom = roomState.some((rs) => rs.state === 'ready')
    signs.road.setVacancy(hasRoom)
    signs.board.setVacancy(hasRoom)
    signs.road.update(dt, t)
    signs.monument.set(playerName(), S.rating)

    // Ambient particles.
    moteT -= dt
    if (moteT <= 0) {
      moteT = 0.12
      if (night < 0.5) fx.motes(px, pz)
      else fx.firefly(px, pz)
    }

    // Footsteps.
    const moved = Math.hypot(px - lastPX, pz - lastPZ)
    lastPX = px
    lastPZ = pz
    if (player.grounded && moved < 2) {
      stepDist += moved
      const stride = inputState.sprint ? 1.6 : 1.1
      if (stepDist > stride) {
        stepDist = 0
        const inside = roomAt(px, pz)
        const fy = floorAt(px, pz)
        const surface = inside ? 'carpet' : fy > 0.05 || (pz > LAYOUT.lot.z0 && pz < LAYOUT.lot.z1 && px > LAYOUT.lot.x0 && px < LAYOUT.lot.x1) ? 'hard' : 'sand'
        play('step', surface === 'hard' ? 'concrete' : surface)
        if (surface === 'sand' && inputState.sprint) fx.dust(px, 0, pz, 3, '#f0d29a', 0.5)
      }
    }

    // Room panel, cleaning checklist + interior light.
    const rs = roomAt(px, pz)
    currentRoom = rs && rs.state !== 'locked' ? rs : null
    if (currentRoom) {
      const n = currentRoom.r.number
      const stars = starsOf(n)
      hud.setRoom({ typeName: typeFor(stars).name, price: priceOf(currentRoom), nextLabel: '', stars, item: null })
      decor.setRoomHud(n)
      const c = currentRoom.r.interior.center
      roomLight.position.set(c.x, 2.9, c.z)
      roomLight.intensity += (5 - roomLight.intensity) * Math.min(1, dt * 4)
    } else {
      hud.setRoom(null)
      decor.setRoomHud(null)
      roomLight.intensity *= 0.9
    }
    if (currentRoom?.state === 'dirty') hud.setChecklist(`ROOM ${currentRoom.r.number}`, clean.pct(currentRoom), clean.checklist(currentRoom))
    else hud.setChecklist('', 0, null)

    // Junk yard bar.
    if (yard.inside(px, pz) && !S.yardDone) {
      const pct = 1 - yardLeft() / yardTotal
      const hint = S.carry?.kind === 'junk' ? 'carry it to the dumpster and press E' : yardJunk.some((j) => !j.taken) && (S.tool === 'hands' || !yardBags.some((b) => !b.taken)) ? 'big junk: press 6 (HANDS) and carry it in' : 'trash bags: press 1 (BAG) and walk over them'
      hud.setYard(true, pct, hint)
    } else hud.setYard(false)

    // HUD pills + objective.
    let busText
    let busHot = false
    if (bus.state === 'stopped' || bus.state === 'arriving') {
      busText = 'BUS IS HERE!'
      busHot = true
    } else {
      const m = Math.max(0, Math.ceil(S.busTimer))
      const mmss = `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`
      busText = S.nextTour ? `BUS · PAY x${ECONOMY.touristPay} · ${mmss}` : `BUS IN ${mmss}`
      busHot = S.nextTour
    }
    if (busText === 'BUS IS HERE!' && lastAnnBus !== busText) {
      if (S.appeal < CURB.fewestBelow) hud.announce('BUS IS HERE!', `a dirty lot scares guests off · curb appeal ${S.appeal}%`)
      else if (S.busTourists) hud.announce('TOURISTS!', `x${ECONOMY.touristPay} a night while they are here`)
      else hud.announce('BUS IS HERE!', 'guests are on their way to the office')
      play('announce')
    }
    lastAnnBus = busText
    hud.setPills({ busText, busHot, cleanSets: S.cleanSets, motelRating: S.rating, curb: S.appeal, curbWarn: S.appeal < CURB.fewerBelow, curbBad: S.appeal < CURB.fewestBelow, counter: S.register })
    const [ot, op, oi] = objective()
    hud.setObjective(ot, op, oi)
    hotbar?.setTrash(S.bag, bagCap())
    hud.update(dt, camera)
    decor.update(dt)
  }

  function busStopped(tourists) {
    play('brakes', { x: bus.x, y: 1, z: LAYOUT.busLaneZ })
    // Places left in the desk line + up to QUEUE.turnAway who turn up to a full line and leave.
    const free = Math.max(0, QUEUE.max - queue.length) + QUEUE.turnAway
    const openN = roomState.filter((rs) => rs.state !== 'locked').length
    // Demand grows with the motel (pacing.js): more rooms, more guests per bus; now and then a rush.
    const rush = rushHour(openN)
    let n = Math.max(0, Math.min(free, rndi(...busGuests(openN)) + (tourists ? 1 : 0) + (rush ? PACING.rush.extra : 0)))
    const ap = appealNow()
    if (rush && n > 0 && ap >= CURB.fewestBelow) {
      hud.announce('RUSH HOUR!', `${n} guests are coming · get the rooms ready`, 3)
      play('announce')
    }
    // A dirty lot trims the bus, never empties it (at least one guest always gets off).
    if (ap < CURB.fewestBelow && n > 1) {
      const kept = Math.max(1, Math.round(n * CURB.lowKeep))
      hud.announce(`ONLY ${kept} GUEST${kept > 1 ? 'S' : ''} GOT OFF`, `curb appeal ${ap}% · clean the lot, posters and graffiti for more`, 4)
      n = kept
    } else if (ap < CURB.fewerBelow && n > 1) {
      n -= 1
      hud.toast(`1 guest stayed on the bus · curb appeal ${ap}%: clean outside for more`)
    }
    const dp = bus.doorPoint
    // They step off one by one at uneven intervals (and then walk at their own pace).
    let at = 0
    for (let i = 0; i < n; i++) {
      setTimeout(() => spawnGuest(dp.x - i * 0.3, dp.z + 0.2, tourists), at)
      at += rnd(1200, 3400)
    }
    S.calmUntil = clock + DRIVE_IN.afterBus + at / 1000
    setTimeout(() => {
      bus.depart()
      // A good rating and a bigger motel bring the bus sooner; adverts sooner still (never under minBusGap).
      const gap = busGap(ECONOMY.busEvery, S.rating, openN)
      const ge = call('guestEvery', [gap * 0.9, gap * 1.1]) ?? [gap, gap]
      S.busTimer = Math.max(PACING.minBusGap, rnd(ge[0], ge[1]))
      S.nextTour = Math.random() < ECONOMY.touristChance
      play('horn', { x: bus.x, y: 2, z: LAYOUT.busLaneZ })
    }, at + 2500)
  }

  return { update, hud, state: S, decor }
}

// Physics helpers are injected (keeps this module free of a hard import cycle).
const motelPhysics = { addFixed: null, RAPIER: null }
export function setPhysics(addFixed, RAPIER) {
  motelPhysics.addFixed = addFixed
  motelPhysics.RAPIER = RAPIER
}

export { mat }
