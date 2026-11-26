// Pacing: an easy start that gets steeper as the motel grows. `heat` (0 with one room on the
// first run) rises with every open room and every franchise level; the game, cleaning, curb and
// food modules read it through the helpers below. At heat 0 every rule is the plain game, so the
// first minutes stay forgiving. Tunables: PACING in config.js.
import { PACING } from '../config.js'

export const pacing = { heat: 0, openRooms: 1, franchise: 0 }

// Called once a frame by game.js.
export function setPacing(openRooms, franchise = 0) {
  const h = PACING.heat
  pacing.openRooms = Math.max(1, openRooms)
  pacing.franchise = Math.max(0, franchise)
  pacing.heat = Math.min(h.max, (pacing.openRooms - 1) * h.perRoom + pacing.franchise * h.perFranchise)
}

// Guests getting off one bus: [min, max]. More open rooms bring more guests (capped by the queue).
export function busGuests(open = pacing.openRooms) {
  const b = PACING.busGuests
  const max = Math.min(b.cap, Math.max(Math.min(3, open + 1), 1 + Math.ceil(open * b.maxPerRoom)))
  const min = Math.min(max, 1 + Math.floor(open / b.minPerRooms))
  return [min, max]
}

// Seconds between buses before adverts: a good rating and a bigger motel bring them sooner.
export function busGap(base, rating, open = pacing.openRooms) {
  const r = PACING.busRating
  const mul = Math.max(r.min, Math.min(r.max, 1 - (rating - r.at) * r.perStar))
  return Math.max(PACING.minBusGap, base * mul - (open - 1) * PACING.busRoomsCut)
}

// Is this bus a RUSH HOUR bus (extra guests)? Never before `rush.fromRooms` rooms are open.
export function rushHour(open = pacing.openRooms) {
  const r = PACING.rush
  return open >= r.fromRooms && Math.random() < r.chance + pacing.heat * r.perHeat
}

// The challenge side: less patience, messier rooms, faster litter / vandals / walk-ins.
export const patienceMul = () => Math.max(0.4, 1 - pacing.heat * PACING.patienceCut)
export const messExtra = () => Math.round(pacing.heat * PACING.messExtra)
export const spawnMul = () => 1 + pacing.heat * PACING.spawnFaster
export const walkInMul = () => 1 + pacing.heat * PACING.walkInFaster
