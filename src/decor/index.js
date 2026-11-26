// The furnish system's front door, created once by the game loop:
//  - per room: the furniture in use (kept in the shared economy, so stars and goals see it),
//    the pieces it owns in storage, its wallpaper and floor (a 'decor' save section);
//  - the wallpapers / floors the motel owns (bought once, free in every room);
//  - room evaluation (stars, type, looks, MATCH, nightly price, which guests it can host);
//  - the guest wealth roll (clean + good-looking rooms attract richer guests);
//  - FURNISH mode (furnish.js) and the in-room bar.
import { Group } from 'three'
import { ECONOMY } from '../config.js'
import { DEFAULT_FLOOR, DEFAULT_WALL, FLOORS, ITEMS, TIERS, WALLS, evaluate, fits, inUse, itemById, nightly, reviewDelta, rollTier, tierOdds, topTier } from './rules.js'
import { createRoomDecor } from './room.js'
import { createFurnish } from './furnish.js'
import { decorSfx } from './sfx.js'

export function createDecor({ scene, camera, renderer, motelRooms, fx, bank, playerGroup, getNight = () => 0, getRating = () => 3.5, getClean = () => 1, isOpenRoom = (n) => bank.isRoomOpen?.(n) }) {
  const group = new Group()
  group.name = 'decor'
  scene.add(group)
  const rooms = new Map() // number -> room decor (scene)
  const byNumber = new Map(motelRooms.map((r) => [r.number, r]))
  for (const r of motelRooms) rooms.set(r.number, createRoomDecor(r, group, { fx, sfx: decorSfx }))

  // --- Saved state ----------------------------------------------------------------------------
  const S = {
    walls: [DEFAULT_WALL],
    floors: [DEFAULT_FLOOR],
    rooms: {}, // n -> { owned: [ids], wall, floor }
  }
  const localItems = new Map() // fallback when the economy can't store a room's list
  const roomS = (n) => (S.rooms[n] ??= { owned: [], wall: DEFAULT_WALL, floor: DEFAULT_FLOOR })
  const listeners = new Set()
  const changed = (n) => listeners.forEach((fn) => fn(n))

  function itemsOf(n) {
    const list = bank.roomFurniture?.(n) ?? localItems.get(n) ?? []
    return inUse(list.filter((id) => itemById(id)))
  }
  function setItems(n, ids) {
    if (typeof bank.setRoomFurniture === 'function') bank.setRoomFurniture(n, ids)
    else localItems.set(n, [...ids])
  }
  // The committed furnishing of a room.
  const committed = (n) => ({ items: itemsOf(n), wall: roomS(n).wall, floor: roomS(n).floor })
  const owns = (n, id) => roomS(n).owned.includes(id) || itemsOf(n).includes(id)
  const ownsWall = (id) => S.walls.includes(id)
  const ownsFloor = (id) => S.floors.includes(id)
  const basePrice = (n) => {
    const r = byNumber.get(n)
    return ECONOMY.basePrice?.[r?.index ?? 0] ?? ECONOMY.basePrice?.at?.(-1) ?? 48
  }
  const evalRoom = (n, state) => evaluate(state ?? committed(n))
  const priceOf = (n, state) => nightly(basePrice(n), evalRoom(n, state))

  bank.addSaveSection?.(
    'decor',
    () => ({ walls: [...S.walls], floors: [...S.floors], rooms: JSON.parse(JSON.stringify(S.rooms)) }),
    (o) => {
      if (!o || typeof o !== 'object') return
      const okWall = (id) => WALLS.some((w) => w.id === id)
      const okFloor = (id) => FLOORS.some((f) => f.id === id)
      S.walls = [DEFAULT_WALL, ...(o.walls ?? []).filter((id) => okWall(id) && id !== DEFAULT_WALL)]
      S.floors = [DEFAULT_FLOOR, ...(o.floors ?? []).filter((id) => okFloor(id) && id !== DEFAULT_FLOOR)]
      S.rooms = {}
      for (const [n, r] of Object.entries(o.rooms ?? {})) {
        S.rooms[n] = {
          owned: (r?.owned ?? []).filter((id) => itemById(id)),
          wall: okWall(r?.wall) ? r.wall : DEFAULT_WALL,
          floor: okFloor(r?.floor) ? r.floor : DEFAULT_FLOOR,
        }
      }
      for (const n of rooms.keys()) refresh(n)
    },
  )

  // Commits a furnishing: pays for what is new, then makes it the room's state.
  // -> { ok, cost, reason, before, after }
  function commit(n, draft) {
    const before = evalRoom(n)
    const cost = costOf(n, draft)
    if (cost > 0 && !bank.spend(cost)) return { ok: false, reason: 'money', cost, before }
    const r = roomS(n)
    for (const id of draft.items) if (!r.owned.includes(id)) r.owned.push(id)
    for (const id of itemsOf(n)) if (!r.owned.includes(id)) r.owned.push(id)
    if (!S.walls.includes(draft.wall)) S.walls.push(draft.wall)
    if (!S.floors.includes(draft.floor)) S.floors.push(draft.floor)
    r.wall = draft.wall
    r.floor = draft.floor
    setItems(n, inUse(draft.items))
    const after = evalRoom(n)
    changed(n)
    return { ok: true, cost, before, after }
  }
  // What a draft costs on top of what the room / motel already owns.
  function costOf(n, draft) {
    let cost = 0
    for (const id of inUse(draft.items)) if (!owns(n, id)) cost += itemById(id).price
    if (!ownsWall(draft.wall)) cost += WALLS.find((w) => w.id === draft.wall)?.price ?? 0
    if (!ownsFloor(draft.floor)) cost += FLOORS.find((f) => f.id === draft.floor)?.price ?? 0
    return cost
  }
  function refresh(n, animate = false) {
    if (furnish?.room() === n) return // the editor shows its draft
    rooms.get(n)?.apply(committed(n), animate)
  }
  bank.useRoomLooks?.((n) => ({ wall: roomS(n).wall, floor: roomS(n).floor }))

  // --- Guests -------------------------------------------------------------------------------------
  const openEvals = () => [...rooms.keys()].filter((n) => isOpenRoom(n)).map((n) => evalRoom(n))
  const guestContext = () => ({ rooms: openEvals(), rating: getRating(), clean: getClean() })

  const furnish = createFurnish({
    camera,
    renderer,
    playerGroup,
    fx,
    bank,
    rooms,
    api: {
      committed,
      evalRoom,
      priceOf,
      costOf,
      commit,
      owns,
      ownsWall,
      ownsFloor,
      topTier,
      odds: () => tierOdds(guestContext()),
      clean: getClean,
    },
  })

  let t = 0
  return {
    group,
    rooms,
    // Furnishing.
    refresh,
    refreshAll: () => rooms.forEach((_, n) => refresh(n)),
    committed,
    evalRoom,
    priceOf,
    itemsOf,
    owns,
    onChange: (fn) => (listeners.add(fn), () => listeners.delete(fn)),
    open: (n) => furnish.open(n),
    close: () => furnish.close(),
    isOpen: () => furnish.isOpen(),
    setRoomHud: (n, extra) => furnish.roomHud(n, extra),
    // Guests.
    tiers: TIERS,
    rollTier: () => rollTier(guestContext()),
    odds: () => tierOdds(guestContext()),
    fits: (tier, n) => fits(tier, evalRoom(n)),
    reviewDelta: (tier, n) => reviewDelta(tier, evalRoom(n), getClean()),
    topTier: (n) => topTier(evalRoom(n)),
    clean: getClean,
    // Per frame (after the camera update: furnish mode owns the camera while open).
    update(dt) {
      t += dt
      const night = getNight()
      for (const r of rooms.values()) r.update(t, dt, night)
      furnish.update(dt, t)
    },
    items: ITEMS,
  }
}

export { decorSfx }
