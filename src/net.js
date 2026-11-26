// The game server link (Colyseus, ../Run-a-motel-backend): joins the `world` room, loads the
// player's motel (economy.js) from the `progress` answer and saves it back with `saveProgress`
// { motel } (debounced, and when the tab hides/closes). The client keeps no progress in the
// browser: guests (and sessions with no server) play on a fresh motel that lasts the page.
import { Client } from '@colyseus/sdk'
import { DEV_MODE } from './config.js'
import { economy } from './economy.js'
import { authState, canResolveServer, getPfp, launchRoomId, locateRoom, resolveServerEndpoint, subscribeAuth, updateRoom } from './bloxity.js'

// Local dev talks to `npm start` in the backend; production builds resolve the pod through
// the Bloxity matchmaker.
const SERVER_URL = import.meta.env.DEV ? import.meta.env.VITE_SERVER_URL_DEV || 'ws://localhost:2567' : ''
const NET = { saveDebounce: 2, saveEvery: 15, retry: 2, retryMax: 30, rejoin: 1 }

export const net = { room: null, connected: false, hydrated: false }

function storedId(key, make) {
  try {
    let id = localStorage.getItem(key)
    if (!id) localStorage.setItem(key, (id = make()))
    return id
  } catch {
    return make()
  }
}
const rand = () => Math.random().toString(36).slice(2, 8)
const GUEST = storedId('run-a-motel.guest', () => `guest-${rand()}`)
// Dev mode has no Bloxity sign-in: a stable per-browser id so the dev save survives reloads.
const DEV = DEV_MODE ? storedId('run-a-motel.dev', () => `dev-${rand()}`) : ''

function identity() {
  if (DEV) return { userId: DEV, username: `Dev ${DEV.slice(4)}` }
  const u = authState.user
  const id = u && (u._id || u.id || u.userId || u.uid)
  if (!id) return { userId: GUEST, username: authState.guest?.displayName || authState.guest?.username || 'Guest' }
  return { userId: String(id), username: String(u.displayName || u.username || u.name || 'Player') }
}
const isGuestId = (id) => id.startsWith('guest-')
const hasServer = () => !!(SERVER_URL || canResolveServer())

let sentId = ''
let lastSaved = ''
let debounce = 0
let clockOffset = 0
export const serverNow = () => Date.now() + clockOffset
const keepClock = (msg) => {
  if (typeof msg?.serverTime === 'number') clockOffset = msg.serverTime - Date.now()
}

function send(type, payload) {
  try {
    net.room?.send(type, payload)
  } catch (err) {
    console.warn('[net] send failed', type, err)
  }
}

// Sends the motel if it changed since the last save (never before the load answered).
export function saveNow() {
  clearTimeout(debounce)
  if (!net.connected || !net.hydrated || isGuestId(sentId)) return
  const motel = economy.snapshot()
  const { lastSeen, rate, ...stable } = motel
  const key = JSON.stringify(stable)
  if (key === lastSaved && !document.hidden) return
  lastSaved = key
  send('saveProgress', { motel })
}
function saveSoon() {
  clearTimeout(debounce)
  debounce = setTimeout(saveNow, NET.saveDebounce * 1000)
}

function attach(room) {
  net.room = room
  net.connected = true
  room.onMessage('progress', (doc) => {
    keepClock(doc)
    net.hydrated = true
    lastSaved = ''
    if (doc?.motel) economy.hydrate(doc.motel, serverNow())
    saveNow()
  })
  room.onMessage('noProgress', (msg) => {
    // A new account (or guest / no database): keep the motel being played and save it.
    keepClock(msg)
    net.hydrated = true
    lastSaved = ''
    saveNow()
  })
  room.onMessage('serverError', () => {
    net.hydrated = false
    console.warn('[net] the server could not read the save; saving is off for this session')
  })
  // Messages other features use; registered so Colyseus doesn't warn about them.
  for (const type of ['spins', 'daily', 'leaderboard', 'spinResult', 'dailyResult']) room.onMessage(type, () => {})
  room.onLeave(() => {
    if (net.room !== room) return
    net.room = null
    net.connected = false
    net.hydrated = false
    updateRoom('')
    setTimeout(connect, NET.rejoin * 1000)
  })
}

let launchRoom = launchRoomId()
async function joinLaunchRoom(options) {
  const id = launchRoom
  launchRoom = ''
  if (!id) return null
  try {
    if (SERVER_URL) return { room: await new Client(SERVER_URL).joinById(id.split('~').pop(), options), relay: '' }
    const at = await locateRoom(id)
    if (at) return { room: await new Client(at.endpoint).joinById(at.roomId, options), relay: at.relayRoomId }
  } catch (err) {
    console.info('[net] the invited room is gone or full; matchmaking instead', err?.message ?? err)
  }
  return null
}
async function joinAnyRoom(options) {
  if (SERVER_URL) return { room: await new Client(SERVER_URL).joinOrCreate('world', options), relay: '' }
  const { endpoint, relayRoomId } = await resolveServerEndpoint(/^(guest|dev)-/.test(options.userId) ? undefined : options.userId)
  return { room: await new Client(endpoint).joinOrCreate('world', options), relay: relayRoomId }
}

let connecting = false
let retryIn = NET.retry
async function connect() {
  if (!hasServer() || connecting || net.connected) return
  connecting = true
  try {
    const id = identity()
    sentId = id.userId
    const options = { ...id, pfp: getPfp() }
    const { room, relay } = (await joinLaunchRoom(options)) ?? (await joinAnyRoom(options))
    retryIn = NET.retry
    attach(room)
    updateRoom(relay ? `${relay}~${room.roomId}` : room.roomId)
  } catch (err) {
    console.info(`[net] could not reach the server (retrying in ${retryIn}s); progress is not saved meanwhile`, err?.message ?? err)
    setTimeout(connect, retryIn * 1000)
    retryIn = Math.min(retryIn * 2, NET.retryMax)
  } finally {
    connecting = false
  }
}

export function initNet() {
  economy.on('change', (why) => why !== 'load' && saveSoon())
  setInterval(() => !document.hidden && saveNow(), NET.saveEvery * 1000)
  window.addEventListener('pagehide', saveNow)
  document.addEventListener('visibilitychange', () => document.hidden && saveNow())
  if (!hasServer()) return console.info('[net] no game server configured; progress lasts this page')
  subscribeAuth((s) => {
    if (!s.ready && !DEV) return
    if (!net.connected) return void connect()
    const id = identity()
    if (id.userId === sentId) return send('identify', { username: id.username, pfp: getPfp() })
    // Save under the OLD identity first, then switch: the server answers progress/noProgress.
    saveNow()
    net.hydrated = false
    sentId = id.userId
    send('identify', { ...id, pfp: getPfp() })
  })
  if (DEV) connect()
}
