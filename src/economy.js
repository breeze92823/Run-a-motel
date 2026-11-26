// The motel's money and everything bought with it: upgrades (Upgrades window), staff (Hiring
// window), shop items (Shop window), rooms and their furniture, timed boosts, charges and cash
// investments. The game loop (src/game/*) earns money and reads the effect getters below; this
// module never simulates guests itself. The whole state is saved by net.js (snapshot/hydrate).
import { ECONOMY, FOOD } from './config.js'
import { AD_REWARD, MOTEL, SHOP, SPEED_STEP, STAFF, UPGRADES, POOL_PRICE } from './catalog.js'
import { evaluate, inUse } from './decor/rules.js'

const UPGRADE_LIST = Object.values(UPGRADES).flatMap((t) => t.items)
const UPGRADE = Object.fromEntries(UPGRADE_LIST.map((i) => [i.id, i]))
const STAFF_BY_ID = Object.fromEntries(STAFF.map((s) => [s.id, s]))
const SHOP_ITEMS = [...SHOP.forever, ...SHOP.now, ...SHOP.cash, SHOP.empire]
const SHOP_BY_ID = Object.fromEntries(SHOP_ITEMS.map((s) => [s.id, s]))
const FOREVER = new Set(SHOP.forever.map((s) => s.id))

const listeners = new Map() // event -> Set(fn)
const saveSections = new Map() // key -> { snapshot, hydrate }

function freshState() {
  return {
    money: ECONOMY?.startMoney ?? 150,
    owned: [], // upgrade + forever shop ids, 'pool', 'starter'
    repeats: {}, // repeat upgrade id -> times bought (nextRoom)
    staff: Object.fromEntries(STAFF.filter((s) => s.startLevel).map((s) => [s.id, s.startLevel])), // id -> level (0 = hired, no speed)
    boosts: {}, // id -> epoch ms it ends
    charges: {}, // id -> uses left
    invest: {}, // cash investment id -> epoch ms it pays out
    rooms: Object.fromEntries(MOTEL.roomsAtStart.map((n) => [n, { open: true, furniture: [] }])),
    cosmetics: [],
    tourists: 0, // called by the bus, not yet spawned by the game
    earned: 0, // lifetime income
    lastSeen: 0,
  }
}

let s = freshState()
let roomLooks = null // n -> { wall, floor } (decor layer)
// Recent income [epochMs, amount], for the offline-income rate.
let recent = []

function emit(evt, data) {
  for (const fn of listeners.get(evt) ?? []) {
    try {
      fn(data)
    } catch (err) {
      console.warn('[economy] listener failed', evt, err)
    }
  }
}
const changed = (why) => emit('change', why)

const now = () => Date.now()
const boostLeft = (id) => Math.max(0, ((s.boosts[id] ?? 0) - now()) / 1000)

export const economy = {
  get money() {
    return s.money
  },
  get earned() {
    return s.earned
  },

  on(evt, fn) {
    if (!listeners.has(evt)) listeners.set(evt, new Set())
    listeners.get(evt).add(fn)
    return () => listeners.get(evt)?.delete(fn)
  },

  // --- Money --------------------------------------------------------------------
  earn(amount, reason = '') {
    const n = Math.round(Number(amount))
    if (!Number.isFinite(n) || n <= 0) return
    s.money += n
    s.earned += n
    recent.push([now(), n])
    emit('earn', { amount: n, reason })
    changed('money')
  },
  canAfford: (n) => s.money >= n,
  spend(amount) {
    const n = Math.round(Number(amount))
    if (!Number.isFinite(n) || n < 0 || s.money < n) return false
    s.money -= n
    changed('money')
    return true
  },

  // --- Ownership ----------------------------------------------------------------
  has: (id) => s.owned.includes(id) || (STAFF_BY_ID[id] ? s.staff[id] !== undefined : false),
  staffLevel: (id) => s.staff[id] ?? -1, // -1 = not hired
  repeats: (id) => s.repeats[id] ?? 0,
  boostLeft,
  charges: (id) => s.charges[id] ?? 0,
  investReadyAt: (id) => s.invest[id] ?? 0,
  cosmetics: () => [...s.cosmetics],

  // --- Effects (read by the game loop) -------------------------------------------
  payMul: () => (economy.has('cash50') ? 1.5 : 1) * (economy.has('cash2x') ? 2 : 1) * (boostLeft(AD_REWARD.id) > 0 ? AD_REWARD.pay : 1),
  // The rewarded-ad boost (ui/windows.js, after the server checked the ad's token).
  grantAdBoost(id, seconds) {
    s.boosts[id] = Math.max(now(), s.boosts[id] ?? 0) + seconds * 1000
    changed('boost')
  },
  tipMax: () => (economy.has('towelPeacock') ? 0.3 : economy.has('towelElephant') ? 0.2 : 0) + (economy.has('sam') ? STAFF_BY_ID.sam.tip : 0),
  coffeeMul: () => (economy.has('premiumBeans') ? 2 : 1),
  // Food (config FOOD): what is on sale, what it costs, which stations run by themselves.
  foodOpen: (kind) => !FOOD[kind]?.unlock || economy.has(FOOD[kind].unlock),
  foodPrice: (kind) => Math.round((FOOD[kind]?.price ?? 0) * (kind === 'coffee' ? economy.coffeeMul() : 1) * economy.payMul()),
  foodAuto: (kind) => !!FOOD[kind]?.auto && economy.has(FOOD[kind].auto),
  coffeePrice: () => economy.foodPrice('coffee'),
  poolPerGuest: () => (economy.has('pool') ? (economy.has('coby') ? STAFF_BY_ID.coby.perGuest : 0) + (economy.has('jade') ? STAFF_BY_ID.jade.perGuest : 0) : 0),
  // Seconds between guests, given the game's own range with no advertising.
  guestEvery(base = ECONOMY?.guestEvery ?? [20, 30]) {
    let [lo, hi] = base
    for (const id of ['flyers', 'radio']) {
      if (boostLeft(id) > 0) [lo, hi] = [Math.min(lo, UPGRADE[id].guestEvery[0]), Math.min(hi, UPGRADE[id].guestEvery[1])]
    }
    if (economy.has('billboard')) hi = Math.min(hi, UPGRADE.billboard.guestMax)
    return [Math.min(lo, hi), hi]
  },
  adsActive: () => boostLeft('flyers') > 0 || boostLeft('radio') > 0,
  staffSpeed(id) {
    const lvl = s.staff[id]
    if (lvl === undefined) return 0
    return (1 + SPEED_STEP * lvl) * (id === 'rose' && economy.has('fastRose') ? 2 : 1)
  },
  cleanSpeedMul: () => (economy.has('superVacuum') ? 3 : 1),
  laundrySpeedMul: () => (economy.has('laundryChute') ? 1.6 : 1),
  megaBag: () => economy.has('megaBag'),
  autoCash: () => economy.has('autoCash'),
  runSpeedMul: () => (boostLeft('fastRun') > 0 ? SHOP_BY_ID.fastRun.run : 1),
  offlineMinutes() {
    const gus = MOTEL.offlineMinutes[Math.max(0, Math.min(MOTEL.offlineMinutes.length - 1, s.staff.gus ?? 0))]
    return Math.max(gus, economy.has('nightShift') ? MOTEL.nightShiftMinutes : 0)
  },
  useCharge(id) {
    if (!(s.charges[id] > 0)) return false
    s.charges[id]--
    changed('charges')
    return true
  },
  takeTourists() {
    const n = s.tourists
    s.tourists = 0
    return n
  },

  // --- Rooms ----------------------------------------------------------------------
  isRoomOpen: (n) => !!s.rooms[n]?.open,
  openRooms: () => Object.keys(s.rooms).map(Number).filter((n) => s.rooms[n].open).sort((a, b) => a - b),
  roomFurniture: (n) => [...(s.rooms[n]?.furniture ?? [])],
  // Stars, type, looks and price follow the furniture in use + the room's wallpaper / floor
  // (decor/rules.js; the decor layer tells us each room's looks through useRoomLooks).
  roomEval(n, extra = []) {
    const r = s.rooms[n]
    return evaluate({ items: [...(r?.furniture ?? []), ...extra], ...(roomLooks?.(n) ?? {}) })
  },
  roomStars(n) {
    const r = s.rooms[n]
    if (!r) return 0
    const stars = economy.roomEval(n).stars
    return r.magic ? Math.max(stars, comfortStars()) : stars
  },
  roomType(n) {
    const stars = economy.roomStars(n)
    let type = ECONOMY.roomTypes[0]
    for (const t of ECONOMY.roomTypes) if (stars >= t.minStars) type = t
    return type
  },
  // What a guest pays a night in room n (before payMul / wealth / tips), optionally with extra furniture.
  roomNightly(n, extra = []) {
    const r = s.rooms[n]
    const base = ECONOMY.basePrice?.[n - MOTEL.roomsAtStart[0]] ?? ECONOMY.basePrice?.at?.(-1) ?? 48
    const e = economy.roomEval(n, extra)
    const stars = Math.max(r?.magic ? comfortStars() : 0, e.stars)
    let add = 0
    for (const t of ECONOMY.roomTypes) if (stars >= t.minStars) add = t.priceAdd
    return base + e.furnNightly + add + e.styleNightly
  },
  useRoomLooks(fn) {
    roomLooks = fn
  },
  // The furniture in use, one per slot (FURNISH mode commits through this).
  setRoomFurniture(n, ids) {
    const r = s.rooms[n]
    if (!r) return false
    const before = economy.roomStars(n)
    r.furniture = inUse(ids.filter((id) => furnitureById(id)))
    emit('roomUpgraded', { room: n, id: 'furnish', stars: economy.roomStars(n), before })
    changed('rooms')
    return true
  },
  comfortRooms: () => economy.openRooms().filter((n) => economy.roomStars(n) >= comfortStars()).length,
  openRoom(n, price = 0) {
    if (economy.isRoomOpen(n) || !economy.spend(price)) return false
    s.rooms[n] = { ...(s.rooms[n] ?? { furniture: [] }), open: true }
    emit('roomOpened', { room: n })
    changed('rooms')
    return true
  },
  buyRoomUpgrade(n, id) {
    const r = s.rooms[n]
    const f = furnitureById(id)
    if (!r?.open || !f || r.furniture.includes(id) || !economy.spend(f.price)) return false
    r.furniture = [...r.furniture.filter((x) => furnitureById(x)?.slot !== f.slot), id]
    emit('roomUpgraded', { room: n, id, stars: economy.roomStars(n) })
    changed('rooms')
    return true
  },

  // --- Locks ------------------------------------------------------------------------
  // lock: { comfort: n, rooms: n, owns: id, pool: true }; null/undefined = open.
  isUnlocked(lock) {
    if (!lock) return true
    if (lock.comfort && economy.comfortRooms() < lock.comfort) return false
    if (lock.rooms && economy.openRooms().length < lock.rooms) return false
    if (lock.owns && !economy.has(lock.owns)) return false
    if (lock.pool && !economy.has('pool')) return false
    return true
  },

  // --- Buying -----------------------------------------------------------------------
  upgradePrice(id) {
    const u = UPGRADE[id]
    return u.kind === 'repeat' ? Math.round(u.price * Math.pow(u.grow ?? 1, s.repeats[id] ?? 0)) : u.price
  },
  // Next Room is spent when every upstairs room is open.
  upgradeMaxed: (id) => id === 'nextRoom' && MOTEL.nextRooms.every((n) => economy.isRoomOpen(n)),
  buyUpgrade(id) {
    const u = UPGRADE[id]
    if (!u || !economy.isUnlocked(u.lock)) return fail('locked')
    if (u.kind === 'once' && economy.has(id)) return fail('owned')
    if (economy.upgradeMaxed(id)) return fail('maxed')
    if (!economy.spend(economy.upgradePrice(id))) return fail('money')
    if (u.kind === 'once') s.owned.push(id)
    else if (u.kind === 'boost') s.boosts[id] = Math.max(now(), s.boosts[id] ?? 0) + u.seconds * 1000
    else s.repeats[id] = (s.repeats[id] ?? 0) + 1
    if (id === 'floor2') for (const n of MOTEL.floor2Rooms) openFree(n)
    if (id === 'nextRoom') openFree(MOTEL.nextRooms.find((n) => !economy.isRoomOpen(n)))
    return bought(id)
  },

  // Hiring: the first buy hires, later buys add a level. -> { ok, reason }
  staffPrice(id) {
    const st = STAFF_BY_ID[id]
    const lvl = s.staff[id]
    if (lvl === undefined) return st.price ?? st.levelPrice?.[0] ?? 0
    return st.levelPrice?.[lvl] ?? Infinity
  },
  staffMaxed(id) {
    const st = STAFF_BY_ID[id]
    const lvl = s.staff[id]
    if (lvl === undefined) return false
    if (st.maxLevel) return lvl >= st.maxLevel
    return lvl >= (st.levels ?? 0)
  },
  hire(id) {
    const st = STAFF_BY_ID[id]
    if (!st || !economy.isUnlocked(st.lock)) return fail('locked')
    if (economy.staffMaxed(id)) return fail('maxed')
    if (!economy.spend(economy.staffPrice(id))) return fail('money')
    s.staff[id] = s.staff[id] === undefined ? 0 : s.staff[id] + 1
    return bought(id)
  },

  shopItem: (id) => SHOP_BY_ID[id],
  shopOwned: (id) => (FOREVER.has(id) || SHOP_BY_ID[id]?.once ? s.owned.includes(id) : false),
  buyShop(id) {
    const it = SHOP_BY_ID[id]
    if (!it) return fail('unknown')
    if (economy.shopOwned(id)) return fail('owned')
    if (s.invest[id]) return economy.collect(id)
    if (id === 'magicBed' && !economy.magicBedUseful()) return fail('maxed')
    if (!economy.spend(it.price)) return fail('money')
    if (FOREVER.has(id) || it.once) s.owned.push(id)
    if (it.cash && !it.seconds) economy.earn(it.cash, 'bundle')
    if (it.cosmetics) for (const c of it.cosmetics) addCosmetic(c)
    if (it.charges) s.charges[id] = (s.charges[id] ?? 0) + it.charges
    if (it.tourists) {
      s.tourists += it.tourists
      emit('callBus', { tourists: it.tourists })
    }
    if (id === 'magicBed') magicBed()
    if (it.run) s.boosts[id] = Math.max(now(), s.boosts[id] ?? 0) + it.seconds * 1000
    if (it.value) s.invest[id] = now() + it.seconds * 1000 // a cash investment: pays `value` later
    if (it.gifts) for (const g of it.gifts) giveGift(g)
    return bought(id)
  },
  // The Magic Bed needs an open room below comfort to work on.
  magicBedUseful: () => economy.openRooms().some((n) => economy.roomStars(n) < comfortStars()),
  // Collects a matured cash investment.
  collect(id) {
    const it = SHOP_BY_ID[id]
    const at = s.invest[id]
    if (!it || !at) return fail('none')
    if (at > now()) return fail('wait')
    delete s.invest[id]
    economy.earn(it.value, 'invest')
    emit('collected', { id, amount: it.value })
    return { ok: true, id, amount: it.value }
  },

  // The pool: the NEXT card's third goal.
  poolPrice: () => POOL_PRICE,
  buyPool() {
    if (economy.has('pool')) return fail('owned')
    if (!economy.spend(POOL_PRICE)) return fail('money')
    s.owned.push('pool')
    return bought('pool')
  },

  // --- The NEXT card --------------------------------------------------------------
  // -> { id, title, sub, hint, progress (0..1), action: { label, price, run } | null, art }
  nextGoal: () => goals()[0],
  thenGoal: () => goals()[1] ?? null,

  // --- Offline income (Gus / Night Shift) -------------------------------------------
  incomePerSecond() {
    const t = now()
    const windowMs = MOTEL.incomeWindow * 1000
    recent = recent.filter(([at]) => t - at < windowMs)
    if (!recent.length) return 0
    const span = Math.max(60_000, t - recent[0][0])
    return recent.reduce((a, [, n]) => a + n, 0) / (span / 1000)
  },

  // --- Saving (net.js) -------------------------------------------------------------
  addSaveSection(key, snapshot, hydrate) {
    saveSections.set(key, { snapshot, hydrate })
  },
  snapshot() {
    const game = {}
    for (const [k, sec] of saveSections) {
      try {
        game[k] = sec.snapshot()
      } catch (err) {
        console.warn('[economy] save section failed', k, err)
      }
    }
    return {
      money: Math.floor(s.money),
      owned: [...s.owned],
      repeats: { ...s.repeats },
      staff: { ...s.staff },
      boosts: pruneTimes(s.boosts),
      charges: { ...s.charges },
      invest: { ...s.invest },
      rooms: Object.fromEntries(Object.entries(s.rooms).map(([n, r]) => [n, { open: !!r.open, furniture: [...r.furniture], ...(r.magic && { magic: true }) }])),
      cosmetics: [...s.cosmetics],
      tourists: s.tourists,
      earned: Math.floor(s.earned),
      rate: Math.round(economy.incomePerSecond() * 100) / 100,
      lastSeen: now(),
      game,
    }
  },
  // Loads a saved motel (or a fresh one for null). Returns the offline earnings granted.
  hydrate(doc, serverTime = now()) {
    s = freshState()
    recent = []
    if (doc && typeof doc === 'object') {
      if (Number.isFinite(doc.money)) s.money = doc.money
      if (Array.isArray(doc.owned)) s.owned = doc.owned.filter((id) => typeof id === 'string')
      if (doc.repeats) s.repeats = { ...doc.repeats }
      if (doc.staff) s.staff = { ...s.staff, ...doc.staff }
      if (doc.boosts) s.boosts = { ...doc.boosts }
      if (doc.charges) s.charges = { ...doc.charges }
      if (doc.invest) s.invest = { ...doc.invest }
      if (doc.rooms && typeof doc.rooms === 'object') {
        for (const [n, r] of Object.entries(doc.rooms)) {
          s.rooms[n] = { open: !!r?.open, furniture: Array.isArray(r?.furniture) ? r.furniture.filter((f) => furnitureById(f)) : [], ...(r?.magic && { magic: true }) }
        }
      }
      if (Array.isArray(doc.cosmetics)) s.cosmetics = [...doc.cosmetics]
      if (Number.isFinite(doc.tourists)) s.tourists = doc.tourists
      if (Number.isFinite(doc.earned)) s.earned = doc.earned
      for (const [k, sec] of saveSections) {
        if (doc.game?.[k] !== undefined) {
          try {
            sec.hydrate(doc.game[k])
          } catch (err) {
            console.warn('[economy] load section failed', k, err)
          }
        }
      }
    }
    // Offline income: the recent rate, for as long as Gus (or the Night Shift) covers.
    let offline = 0
    if (doc?.lastSeen && Number.isFinite(doc.rate) && doc.rate > 0) {
      const away = Math.max(0, (serverTime - doc.lastSeen) / 1000)
      offline = Math.floor(doc.rate * Math.min(away, economy.offlineMinutes() * 60))
      if (away < 60) offline = 0 // a reload, not an absence
    }
    changed('load')
    if (offline > 0) {
      economy.earn(offline, 'offline')
      emit('offline', { amount: offline, minutes: economy.offlineMinutes() })
    }
    return offline
  },
}

// --- helpers ------------------------------------------------------------------------
function fail(reason) {
  emit('failed', { reason })
  return { ok: false, reason }
}
function bought(id) {
  emit('bought', { id })
  changed('bought')
  return { ok: true, id }
}
function comfortStars() {
  return ECONOMY.roomTypes.find((t) => t.id === 'comfort')?.minStars ?? 3
}
function furnitureById(id) {
  return ECONOMY.roomUpgrades.find((f) => f.id === id)
}
function openFree(n) {
  if (n === undefined || economy.isRoomOpen(n)) return
  s.rooms[n] = { open: true, furniture: [] }
  emit('roomOpened', { room: n })
}
function addCosmetic(id) {
  if (!s.cosmetics.includes(id)) s.cosmetics.push(id)
  emit('cosmetic', { id })
}
function giveGift(id) {
  if (FOREVER.has(id)) {
    if (!s.owned.includes(id)) s.owned.push(id)
  } else if (id === 'magicBed') magicBed()
}
// The Magic Bed makes the open room with the fewest stars a comfort room.
function magicBed() {
  const rooms = economy.openRooms().filter((n) => economy.roomStars(n) < comfortStars())
  const n = rooms.sort((a, b) => economy.roomStars(a) - economy.roomStars(b) || a - b)[0]
  if (n === undefined) return
  s.rooms[n].magic = true
  emit('roomUpgraded', { room: n, id: 'magicBed', stars: economy.roomStars(n) })
}
function pruneTimes(map) {
  const t = now()
  return Object.fromEntries(Object.entries(map).filter(([, at]) => at > t))
}

// The goal chain behind the NEXT / THEN... cards.
function roomGoal(id, title, sub, target) {
  const stars = comfortStars()
  const open = economy.openRooms()
  const room = open.filter((n) => economy.roomStars(n) < target).sort((a, b) => economy.roomStars(b) - economy.roomStars(a) || a - b)[0]
  if (room === undefined) return null
  const have = economy.roomStars(room)
  // The next pieces to buy: what the next star still needs first, then the cheapest comfort.
  const e = economy.roomEval(room)
  const inRoom = economy.roomFurniture(room)
  const needs = new Set((e.needNext ?? []).filter((nd) => !nd.ok).flatMap((nd) => nd.items))
  const missing = ECONOMY.roomUpgrades
    .filter((f) => !inRoom.includes(f.id) && (f.minStars ?? 0) <= have && (f.pts > 0 || needs.has(f.id)) && !(e.slots[f.slot] && furnitureById(e.slots[f.slot]).pts >= f.pts))
    .sort((a, b) => (needs.has(b.id) ? 1 : 0) - (needs.has(a.id) ? 1 : 0) || a.price - b.price)
  const next = missing[0]
  const names = missing.slice(0, 2).map((f) => f.name.toLowerCase())
  return {
    id,
    title,
    sub: sub ?? `Guests pay $${economy.roomNightly(room, missing.slice(0, Math.max(1, e.ptsToNext)).map((f) => f.id))} a night`,
    hint: `Room ${room} ★${have}/${target}: ${needs.size ? 'buy' : 'add'} a ${names.join(' or a ')}`,
    progress: have / target,
    art: target >= MOTEL.deluxeStars ? 'deluxe' : 'comfort',
    action: next ? { label: `ADD ${next.name.split(' ').pop().toUpperCase()}`, price: next.price, run: () => economy.buyRoomUpgrade(room, next.id) } : null,
  }
}
function goals() {
  const list = []
  const comfort = economy.comfortRooms()
  const open = economy.openRooms().length
  if (open < 3) {
    const n = MOTEL.roomsAtStart[0] + open
    const price = ECONOMY.unlockRoom?.[open] ?? 0
    list.push({
      id: `open${n}`, title: `OPEN ROOM ${n}`, sub: 'More rooms, more guests', hint: `Walk to the door of room ${n}`, progress: Math.min(1, economy.money / Math.max(1, price)), art: 'door',
      action: { label: 'OPEN', price, run: () => economy.openRoom(n, price) },
    })
  }
  if (!economy.has('hotdogStand')) {
    const price = UPGRADE.hotdogStand.price
    list.push({ id: 'hotdog', title: 'HOT DOG STAND', sub: 'Room service sells hot dogs', hint: 'Grill, bun, ketchup & mustard', progress: Math.min(1, economy.money / price), art: 'hotdog', action: { label: 'BUY', price, run: () => economy.buyUpgrade('hotdogStand').ok } })
  }
  if (comfort < 1) list.push(roomGoal('comfort1', 'COMFORT ROOM', null, comfortStars()))
  if (comfort < 2) list.push({ ...roomGoal('comfort2', '2 COMFORT ROOMS', 'Unlocks Mia and the pool', comfortStars()), ...(comfort < 1 && { hint: 'Then a second room ★3', progress: 0 }) })
  if (!economy.has('pool')) {
    list.push({
      id: 'pool', title: 'THE POOL', sub: 'Guests swim and stay happy', hint: comfort < 2 ? 'Needs 2 comfort rooms' : 'Build it out back', progress: Math.min(1, economy.money / POOL_PRICE), art: 'pool',
      action: comfort >= 2 ? { label: 'BUILD', price: POOL_PRICE, run: () => economy.buyPool().ok } : null,
    })
  }
  if (!economy.has('floor2')) {
    const price = UPGRADE.floor2.price
    list.push({
      id: 'floor2', title: '2ND FLOOR', sub: '4 more rooms upstairs', hint: economy.has('pool') ? 'Fix up the stairs' : 'After the pool', progress: Math.min(1, economy.money / price), art: 'floor2',
      action: economy.has('pool') ? { label: 'FIX UP', price, run: () => economy.buyUpgrade('floor2').ok } : null,
    })
  }
  const deluxe = roomGoal('deluxe', '5-STAR ROOM', null, MOTEL.deluxeStars)
  if (deluxe) list.push(deluxe)
  if (!list.length || !list[0]) list.push({ id: 'done', title: 'MOTEL EMPIRE', sub: 'Every goal is done!', hint: 'Keep the guests happy', progress: 1, art: 'comfort', action: null })
  return list.filter(Boolean)
}

if (import.meta.env?.DEV && typeof window !== 'undefined') window.__economy = economy
