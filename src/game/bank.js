// Bridge to the shared economy (src/economy.js, owned by the UI layer): money,
// owned upgrades / staff, room furniture and effect multipliers. If that module
// is not in the tree yet, a small local stand-in with the same API keeps the
// game playable. Only $ money exists: nothing is ever sold for a premium currency.
import { ECONOMY } from '../config.js'

const eco = Object.values(import.meta.glob('../economy.js', { eager: true }))[0]?.economy
const uiMod = Object.values(import.meta.glob('../ui/index.js', { eager: true }))[0]

function localEconomy() {
  const listeners = new Map()
  const emit = (e, d) => (listeners.get(e) ?? []).forEach((fn) => fn(d))
  const owned = new Set()
  const rooms = new Map() // number -> { open, furniture: [] }
  for (let i = 0; i < 6; i++) rooms.set(101 + i, { open: i < ECONOMY.openRooms, furniture: [] })
  const api = {
    money: ECONOMY.startMoney,
    earn(n) {
      api.money += n
      emit('change')
      emit('earn', { amount: n })
    },
    spend(n) {
      if (api.money < n) return false
      api.money -= n
      emit('change')
      return true
    },
    canAfford: (n) => api.money >= n,
    on(e, fn) {
      if (!listeners.has(e)) listeners.set(e, [])
      listeners.get(e).push(fn)
      return () => listeners.set(e, listeners.get(e).filter((f) => f !== fn))
    },
    has: (id) => owned.has(id),
    staffLevel: (id) => (owned.has(id) ? 1 : 0),
    payMul: () => 1,
    tipMax: () => 0,
    guestEvery: (base) => base,
    staffSpeed: (id) => (owned.has(id) ? 1 : 0),
    cleanSpeedMul: () => 1,
    laundrySpeedMul: () => 1,
    megaBag: () => false,
    autoCash: () => true,
    takeTourists: () => 0,
    useCharge: () => false,
    isRoomOpen: (n) => !!rooms.get(n)?.open,
    openRoom(n, price) {
      const r = rooms.get(n)
      if (!r || r.open || !api.spend(price)) return false
      r.open = true
      emit('change')
      return true
    },
    roomFurniture: (n) => rooms.get(n)?.furniture ?? [],
    roomStars: (n) => Math.min(5, 1 + (rooms.get(n)?.furniture.length ?? 0)),
    buyRoomUpgrade(n, id) {
      const r = rooms.get(n)
      const up = ECONOMY.roomUpgrades.find((u) => u.id === id)
      if (!r || !up || r.furniture.includes(id) || !api.spend(up.price)) return false
      r.furniture.push(id)
      emit('change')
      emit('bought', { id: `room:${n}:${id}` })
      return true
    },
    addSaveSection() {},
  }
  return api
}

export const bank = eco ?? localEconomy()
export const usingSharedEconomy = !!eco

// Optional hooks with safe fallbacks.
export const call = (name, ...args) => (typeof bank[name] === 'function' ? bank[name](...args) : undefined)
export function openPanel(name, tab) {
  try {
    uiMod?.ui?.open?.(name, tab)
  } catch (err) {
    console.warn('[bank] ui.open failed', err)
  }
}
export const panelOpen = () => {
  try {
    return !!uiMod?.ui?.isOpen?.()
  } catch {
    return false
  }
}
