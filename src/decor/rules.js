// Room decor rules (no three.js here, so economy.js and the UI can use them too):
// which furniture a room has in use, its stars, type, style (looks) score, what the
// next room type still needs, the nightly price, and the guest wealth tiers that
// clean, good-looking rooms attract. The tunables are DECOR in config.js.
import { DECOR, ECONOMY } from '../config.js'

export const ITEMS = DECOR.items
export const WALLS = DECOR.walls
export const FLOORS = DECOR.floors
export const TIERS = DECOR.guestTiers
export const CATEGORIES = DECOR.categories
const ITEM = Object.fromEntries(ITEMS.map((i) => [i.id, i]))
const WALL = Object.fromEntries(WALLS.map((w) => [w.id, w]))
const FLOOR = Object.fromEntries(FLOORS.map((f) => [f.id, f]))
const TIER = Object.fromEntries(TIERS.map((t) => [t.id, t]))

export const itemById = (id) => ITEM[id] ?? null
export const wallById = (id) => WALL[id] ?? WALLS[0]
export const floorById = (id) => FLOOR[id] ?? FLOORS[0]
export const tierById = (id) => TIER[id] ?? TIERS[1]
export const DEFAULT_WALL = WALLS[0].id
export const DEFAULT_FLOOR = FLOORS[0].id
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v)

// One item per slot: the latest id in the list wins its slot.
export function bySlot(items = []) {
  const slots = {}
  for (const id of items) {
    const it = ITEM[id]
    if (it) slots[it.slot] = id
  }
  return slots
}
export const inUse = (items) => Object.values(bySlot(items))

// The room's colour mood: the tones of the furniture in use (the plain bed is teal).
export function roomTones(items) {
  const count = {}
  const slots = bySlot(items)
  if (!slots.bed) count.teal = 1.5
  for (const id of Object.values(slots)) {
    const t = ITEM[id]?.tone
    if (t) count[t] = (count[t] ?? 0) + (ITEM[id].slot === 'bed' ? 1.5 : 1)
  }
  // Wood is neutral: it only sets the mood when nothing else does. Ties all count.
  const moods = Object.entries(count).filter(([t]) => t !== 'wood')
  const list = moods.length ? moods : Object.entries(count)
  const top = Math.max(...list.map(([, n]) => n))
  return list.filter(([, n]) => n >= top).map(([t]) => t)
}
// MATCH = the wall / floor goes with the furniture.
export const matches = (surface, items) => !!surface?.tones?.some((t) => roomTones(items).includes(t))

// What a room type needs beyond comfort points: [{ id, label, ok }] for `stars`.
function needsFor(stars, slots) {
  const has = (...ids) => ids.some((id) => Object.values(slots).includes(id))
  const list = []
  for (const req of DECOR.requires) {
    if (req.stars > stars) continue
    let ok = false
    if (req.anyOf) ok = has(...req.anyOf)
    if (req.slotPts) ok = (ITEM[slots[req.slotPts.slot]]?.pts ?? 0) >= req.slotPts.pts
    list.push({ id: req.id, label: req.label, icon: req.icon, ok, stars: req.stars, items: req.anyOf ?? ITEMS.filter((i) => i.slot === req.slotPts?.slot && i.pts >= req.slotPts.pts).map((i) => i.id) })
  }
  return list
}

// Everything about a room's furnishing. room = { items: [ids in use], wall, floor }.
export function evaluate(room = {}) {
  const items = room.items ?? []
  const slots = bySlot(items)
  const used = Object.values(slots).map((id) => ITEM[id])
  const pts = used.reduce((s, it) => s + it.pts, 0)
  let stars = 1
  for (let s = 2; s <= 5; s++) {
    if (pts < DECOR.starPoints[s - 1]) break
    if (needsFor(s, slots).some((n) => n.stars === s && !n.ok)) break
    stars = s
  }
  const wall = wallById(room.wall)
  const floor = floorById(room.floor)
  const matchWall = matches(wall, items)
  const matchFloor = matches(floor, items)
  const style = clamp(Math.round(DECOR.baseStyle + wall.style + floor.style + (matchWall ? DECOR.matchStyle : 0) + (matchFloor ? DECOR.matchStyle : 0) + used.reduce((s, it) => s + (it.style ?? 0), 0)), 0, 100)
  const type = typeFor(stars)
  const nextType = ECONOMY.roomTypes.find((t) => t.minStars > stars) ?? null
  const nextStars = Math.min(5, stars + 1)
  const needNext = needsFor(nextStars, slots).filter((n) => n.stars === nextStars)
  const ptsNext = DECOR.starPoints[nextStars - 1]
  const furnNightly = used.reduce((s, it) => s + (it.nightly ?? 0), 0)
  return {
    items: Object.values(slots),
    slots,
    pts,
    stars,
    type,
    nextType,
    nextStars: stars >= 5 ? null : nextStars,
    ptsNext,
    ptsToNext: Math.max(0, ptsNext - pts),
    needNext, // what the next star still needs ([] = only points)
    style,
    look: lookFor(style),
    wall,
    floor,
    matchWall,
    matchFloor,
    tones: roomTones(items),
    furnNightly,
    styleNightly: Math.round(style * DECOR.stylePrice),
  }
}

export function typeFor(stars) {
  let t = ECONOMY.roomTypes[0]
  for (const rt of ECONOMY.roomTypes) if (stars >= rt.minStars) t = rt
  return t
}
export function lookFor(style) {
  let l = DECOR.looks[0]
  for (const k of DECOR.looks) if (style >= k.min) l = k
  return l
}

// The nightly price a regular guest pays: base + furniture + room type + looks.
export function nightly(base, room) {
  const e = room.stars ? room : evaluate(room)
  return base + e.furnNightly + e.type.priceAdd + e.styleNightly
}

// --- Guests -----------------------------------------------------------------------------
// Can this guest tier stay in a room (stars + looks)?
export const fits = (tier, e) => e.stars >= tier.minStars && e.style >= tier.minStyle

// How strongly the motel pulls rich guests, 0..1: the best room's looks and stars, the
// rating, and how clean the whole place is (a dirty lot scares the rich away).
export function attraction({ rooms, rating = 3.5, clean = 1 }) {
  const best = rooms.reduce((b, e) => (e.style + e.stars * 12 > b.style + b.stars * 12 ? e : b), { style: 0, stars: 1 })
  const A = DECOR.attract
  let a = A.style * (best.style / 100) + A.stars * ((best.stars - 1) / 4) + A.rating * clamp((rating - 1) / 4, 0, 1) + A.clean * clamp(clean, 0, 1)
  if (clean < A.dirtyBelow) a *= clean / A.dirtyBelow
  return clamp(a, 0, 1)
}

// Rolls the next guest's wealth tier. rooms = evaluations of the OPEN rooms.
export function rollTier({ rooms, rating, clean, rand = Math.random }) {
  const a = attraction({ rooms, rating, clean })
  const w = TIERS.map((t) => (rooms.some((e) => fits(t, e)) ? Math.max(0, t.weight[0] + t.weight[1] * Math.pow(a, t.weight[2])) : 0))
  const sum = w.reduce((s, x) => s + x, 0)
  let r = rand() * sum
  for (let i = 0; i < TIERS.length; i++) {
    r -= w[i]
    if (r <= 0) return TIERS[i]
  }
  return TIERS[1]
}
// Chances (0..1) per tier, for the UI.
export function tierOdds({ rooms, rating, clean }) {
  const a = attraction({ rooms, rating, clean })
  const w = TIERS.map((t) => (rooms.some((e) => fits(t, e)) ? Math.max(0, t.weight[0] + t.weight[1] * Math.pow(a, t.weight[2])) : 0))
  const sum = w.reduce((s, x) => s + x, 0) || 1
  return Object.fromEntries(TIERS.map((t, i) => [t.id, w[i] / sum]))
}
// The best tier a room can host.
export function topTier(e) {
  let best = TIERS[0]
  for (const t of TIERS) if (fits(t, e)) best = t
  return best
}
// Review score adjustment for a tier staying in a room, with the motel this clean.
export function reviewDelta(tier, e, clean) {
  let d = 0
  if (!fits(tier, e)) d -= 0.9
  else if (e.style >= tier.minStyle + 20) d += 0.3
  d -= tier.picky * (1 - clamp(clean, 0, 1))
  return d
}
