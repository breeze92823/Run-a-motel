// World + gameplay sound, synthesised with WebAudio (no audio files):
//  - ambience: desert wind (filtered noise with gusts), birdsong by day,
//    crickets by night;
//  - positional loops: fountain water, neon hum by the sign, washer churn,
//    bus engine (PannerNodes; the listener follows the camera);
//  - one-shots: footsteps (sand / concrete / carpet), trash pop + bag rustle,
//    sponge squeak, sparkle chime, cash register, coins, desk bell, door
//    creak / thud, bed swoosh, dumpster clang, bus horn and air brakes,
//    furniture "ta-da", boards prying, UI clicks and a soft error buzz.
// The UI layer has its own src/audio.js for panel sounds; this file never
// touches it. Audio starts on the first user gesture.

import { Vector3 } from 'three'
import { addOutput } from './mixer.js'

let ctx = null
let master = null
let masterOut = null // mixer handle (Boxity master volume, ad-break mute)
let sfxBus = null
let ambBus = null
let noiseBuf = null
const loops = new Map()
let started = false
let muted = false

function makeNoise(seconds = 2) {
  const len = Math.floor(ctx.sampleRate * seconds)
  const b = ctx.createBuffer(1, len, ctx.sampleRate)
  const d = b.getChannelData(0)
  let last = 0
  for (let i = 0; i < len; i++) {
    const white = Math.random() * 2 - 1
    last = (last + 0.02 * white) / 1.02 // brown-ish
    d[i] = white * 0.6 + last * 3
  }
  return b
}

function start() {
  if (started) return
  started = true
  try {
    ctx = new (window.AudioContext || window.webkitAudioContext)()
  } catch {
    return
  }
  master = ctx.createGain()
  master.gain.value = 0.8
  const comp = ctx.createDynamicsCompressor()
  comp.threshold.value = -14
  comp.ratio.value = 4
  master.connect(comp).connect(ctx.destination)
  masterOut = addOutput(master, muted ? 0 : 0.8)
  sfxBus = ctx.createGain()
  sfxBus.gain.value = 0.9
  sfxBus.connect(master)
  ambBus = ctx.createGain()
  ambBus.gain.value = 0.55
  ambBus.connect(master)
  addOutput(ambBus, 0.55, 'music') // the ambience bed follows Boxity's music_volume
  noiseBuf = makeNoise(3)
  startAmbience()
}

export function installAudio() {
  const go = () => {
    start()
    if (ctx?.state === 'suspended') ctx.resume()
  }
  window.addEventListener('pointerdown', go, { capture: true })
  window.addEventListener('keydown', go, { capture: true })
  document.addEventListener('visibilitychange', () => {
    if (!ctx) return
    if (document.hidden) ctx.suspend()
    else if (!muted) ctx.resume()
  })
}

export function setMuted(on) {
  muted = on
  masterOut?.setBase(on ? 0 : 0.8)
}

const now = () => ctx.currentTime

function env(g, t, a, peak, d, sustain = 0.0001) {
  g.gain.cancelScheduledValues(t)
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(peak, t + a)
  g.gain.exponentialRampToValueAtTime(Math.max(0.0001, sustain), t + a + d)
}

// A positional source node chain ending at `dest` (or a panner when pos given).
function out(pos) {
  if (!pos) return sfxBus
  const p = ctx.createPanner()
  p.panningModel = 'HRTF'
  p.distanceModel = 'inverse'
  p.refDistance = 3
  p.maxDistance = 80
  p.rolloffFactor = 1.3
  p.positionX.value = pos.x
  p.positionY.value = pos.y ?? 1
  p.positionZ.value = pos.z
  p.connect(sfxBus)
  return p
}

function tone(type, freq, t, dur, peak, dest, { attack = 0.005, slide = 0, detune = 0 } = {}) {
  const o = ctx.createOscillator()
  o.type = type
  o.frequency.setValueAtTime(freq, t)
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq * slide), t + dur)
  o.detune.value = detune
  const g = ctx.createGain()
  env(g, t, attack, peak, dur)
  o.connect(g).connect(dest)
  o.start(t)
  o.stop(t + attack + dur + 0.05)
}

function noise(t, dur, peak, dest, { type = 'bandpass', freq = 1000, q = 1, attack = 0.005, sweep = 0 } = {}) {
  const s = ctx.createBufferSource()
  s.buffer = noiseBuf
  s.loop = true
  s.playbackRate.value = 0.8 + Math.random() * 0.4
  const f = ctx.createBiquadFilter()
  f.type = type
  f.frequency.setValueAtTime(freq, t)
  if (sweep) f.frequency.exponentialRampToValueAtTime(Math.max(40, freq * sweep), t + dur)
  f.Q.value = q
  const g = ctx.createGain()
  env(g, t, attack, peak, dur)
  s.connect(f).connect(g).connect(dest)
  s.start(t, Math.random() * 2)
  s.stop(t + attack + dur + 0.05)
}

// --- Ambience ----------------------------------------------------------------------
let ambience = null
function startAmbience() {
  // Wind: two noise layers through slowly wobbling low-pass filters.
  const mk = (freq, gain) => {
    const s = ctx.createBufferSource()
    s.buffer = noiseBuf
    s.loop = true
    const f = ctx.createBiquadFilter()
    f.type = 'lowpass'
    f.frequency.value = freq
    f.Q.value = 0.7
    const g = ctx.createGain()
    g.gain.value = gain
    s.connect(f).connect(g).connect(ambBus)
    s.start()
    return { f, g }
  }
  const windLow = mk(320, 0.16)
  const windHigh = mk(900, 0.03)
  // Crickets: a gated high sine pair, only audible at night.
  const cricket = ctx.createGain()
  cricket.gain.value = 0
  cricket.connect(ambBus)
  for (const f of [4200, 4630]) {
    const o = ctx.createOscillator()
    o.frequency.value = f
    const am = ctx.createOscillator()
    am.frequency.value = 22 + Math.random() * 6
    const amg = ctx.createGain()
    amg.gain.value = 0.5
    const vca = ctx.createGain()
    vca.gain.value = 0.5
    am.connect(amg).connect(vca.gain)
    o.connect(vca).connect(cricket)
    o.start()
    am.start()
  }
  ambience = { windLow, windHigh, cricket, night: 0, birdT: 3, gust: 0 }
}

function bird(t) {
  const base = 2200 + Math.random() * 1600
  const n = 2 + Math.floor(Math.random() * 4)
  const pan = ctx.createStereoPanner()
  pan.pan.value = Math.random() * 2 - 1
  pan.connect(ambBus)
  for (let i = 0; i < n; i++) tone('sine', base * (1 + Math.random() * 0.2), t + i * 0.11, 0.08, 0.035, pan, { slide: 1.35 + Math.random() * 0.3 })
}

// --- Positional loops -----------------------------------------------------------------
function loopNode(kind, pos) {
  const p = out(pos)
  const g = ctx.createGain()
  g.gain.value = 0
  g.connect(p)
  const nodes = []
  if (kind === 'fountain') {
    for (const [f, q, v] of [[600, 0.6, 0.5], [2400, 0.8, 0.25]]) {
      const s = ctx.createBufferSource()
      s.buffer = noiseBuf
      s.loop = true
      const bf = ctx.createBiquadFilter()
      bf.type = 'bandpass'
      bf.frequency.value = f
      bf.Q.value = q
      const vg = ctx.createGain()
      vg.gain.value = v
      s.connect(bf).connect(vg).connect(g)
      s.start()
      nodes.push(s)
    }
  } else if (kind === 'neon') {
    const o = ctx.createOscillator()
    o.type = 'sawtooth'
    o.frequency.value = 120
    const bf = ctx.createBiquadFilter()
    bf.type = 'lowpass'
    bf.frequency.value = 500
    const vg = ctx.createGain()
    vg.gain.value = 0.05
    o.connect(bf).connect(vg).connect(g)
    o.start()
    nodes.push(o)
  } else if (kind === 'washer') {
    const s = ctx.createBufferSource()
    s.buffer = noiseBuf
    s.loop = true
    const bf = ctx.createBiquadFilter()
    bf.type = 'lowpass'
    bf.frequency.value = 380
    const lfo = ctx.createOscillator()
    lfo.frequency.value = 1.3
    const lg = ctx.createGain()
    lg.gain.value = 0.35
    const vg = ctx.createGain()
    vg.gain.value = 0.55
    lfo.connect(lg).connect(vg.gain)
    s.connect(bf).connect(vg).connect(g)
    const o = ctx.createOscillator()
    o.frequency.value = 55
    const og = ctx.createGain()
    og.gain.value = 0.12
    o.connect(og).connect(g)
    s.start()
    lfo.start()
    o.start()
    nodes.push(s, lfo, o)
  } else if (kind === 'engine') {
    const o = ctx.createOscillator()
    o.type = 'sawtooth'
    o.frequency.value = 42
    const bf = ctx.createBiquadFilter()
    bf.type = 'lowpass'
    bf.frequency.value = 260
    const vg = ctx.createGain()
    vg.gain.value = 0.25
    o.connect(bf).connect(vg).connect(g)
    o.start()
    nodes.push(o)
    g.userData = { osc: o }
  } else if (kind === 'fan') {
    const s = ctx.createBufferSource()
    s.buffer = noiseBuf
    s.loop = true
    const bf = ctx.createBiquadFilter()
    bf.type = 'lowpass'
    bf.frequency.value = 220
    const vg = ctx.createGain()
    vg.gain.value = 0.25
    s.connect(bf).connect(vg).connect(g)
    s.start()
    nodes.push(s)
  }
  return { gain: g, panner: p, nodes, osc: g.userData?.osc }
}

// Sets a named positional loop's level (0 = silent) and position.
export function loop(name, kind, pos, level) {
  if (!ctx) return
  let l = loops.get(name)
  if (!l) {
    if (level <= 0) return
    l = loopNode(kind, pos)
    loops.set(name, l)
  }
  l.gain.gain.setTargetAtTime(level, now(), 0.15)
  if (pos && l.panner.positionX) {
    l.panner.positionX.setTargetAtTime(pos.x, now(), 0.05)
    l.panner.positionY.setTargetAtTime(pos.y ?? 1, now(), 0.05)
    l.panner.positionZ.setTargetAtTime(pos.z, now(), 0.05)
  }
  return l
}
export function engineRate(name, r) {
  const l = loops.get(name)
  if (l?.osc) l.osc.frequency.setTargetAtTime(38 + r * 30, now(), 0.2)
}

// Per-frame: listener follows the camera; ambience follows day/night.
export function updateAudio(camera, dt, night) {
  if (!ctx) return
  const l = ctx.listener
  const p = camera.position
  const fwd = camera.getWorldDirection(_v)
  if (l.positionX) {
    l.positionX.value = p.x
    l.positionY.value = p.y
    l.positionZ.value = p.z
    l.forwardX.value = fwd.x
    l.forwardY.value = fwd.y
    l.forwardZ.value = fwd.z
    l.upX.value = 0
    l.upY.value = 1
    l.upZ.value = 0
  } else {
    l.setPosition(p.x, p.y, p.z)
    l.setOrientation(fwd.x, fwd.y, fwd.z, 0, 1, 0)
  }
  if (!ambience) return
  ambience.night += (night - ambience.night) * Math.min(1, dt)
  ambience.gust += dt
  const gust = 0.5 + 0.5 * Math.sin(ambience.gust * 0.21) * Math.sin(ambience.gust * 0.13 + 1)
  ambience.windLow.f.frequency.value = 220 + gust * 380
  ambience.windLow.g.gain.value = 0.1 + gust * 0.12
  ambience.windHigh.g.gain.value = 0.01 + gust * 0.03
  ambience.cricket.gain.value = ambience.night * 0.018
  ambience.birdT -= dt
  if (ambience.birdT <= 0) {
    ambience.birdT = 4 + Math.random() * 9
    if (ambience.night < 0.5) bird(now())
  }
}
const _v = new Vector3()

// --- One-shots ----------------------------------------------------------------------------
const S = {
  step(surface = 'sand', pos) {
    const t = now()
    const d = out(pos)
    if (surface === 'sand') noise(t, 0.09, 0.08, d, { type: 'lowpass', freq: 900, q: 0.5 })
    else if (surface === 'carpet') noise(t, 0.06, 0.05, d, { type: 'lowpass', freq: 500, q: 0.5 })
    else {
      noise(t, 0.04, 0.09, d, { type: 'bandpass', freq: 2200, q: 1.5 })
      tone('sine', 140, t, 0.05, 0.05, d)
    }
  },
  pickup(pos) {
    const t = now()
    const d = out(pos)
    tone('sine', 520, t, 0.12, 0.22, d, { slide: 2.2 })
    tone('triangle', 1040, t + 0.03, 0.1, 0.08, d, { slide: 1.6 })
    noise(t, 0.12, 0.06, d, { type: 'highpass', freq: 3000 })
  },
  rustle(pos) {
    const t = now()
    noise(t, 0.25, 0.12, out(pos), { type: 'bandpass', freq: 3500, q: 0.8, sweep: 0.6 })
  },
  squeak(pos) {
    const t = now()
    const d = out(pos)
    noise(t, 0.18, 0.09, d, { type: 'bandpass', freq: 1800 + Math.random() * 900, q: 6, sweep: 1.4 })
    tone('sine', 1500 + Math.random() * 600, t, 0.08, 0.025, d, { slide: 1.3 })
  },
  chime(pos) {
    const t = now()
    const d = out(pos)
    ;[1047, 1319, 1568, 2093].forEach((f, i) => tone('sine', f, t + i * 0.07, 0.5, 0.12, d))
    ;[2637, 3136].forEach((f, i) => tone('triangle', f, t + 0.28 + i * 0.05, 0.4, 0.04, d))
  },
  register(pos) {
    const t = now()
    const d = out(pos)
    noise(t, 0.05, 0.2, d, { type: 'bandpass', freq: 2500, q: 2 }) // key clack
    noise(t + 0.06, 0.15, 0.18, d, { type: 'lowpass', freq: 1200, q: 0.8 }) // drawer slide
    for (const [f, a] of [[2637, 0.18], [3520, 0.12], [5274, 0.06]]) tone('sine', f, t + 0.16, 0.9, a, d)
  },
  coins(pos) {
    const t = now()
    const d = out(pos)
    for (let i = 0; i < 5; i++) tone('triangle', 2400 + Math.random() * 1800, t + i * 0.045 + Math.random() * 0.02, 0.12, 0.06, d)
  },
  bell(pos) {
    const t = now()
    const d = out(pos)
    for (const [f, a] of [[1760, 0.2], [4420, 0.07], [6150, 0.04]]) tone('sine', f, t, 1.4, a, d, { attack: 0.002 })
  },
  doorOpen(pos) {
    const t = now()
    const d = out(pos)
    tone('sawtooth', 180, t, 0.35, 0.03, d, { slide: 1.6 })
    noise(t, 0.08, 0.07, d, { type: 'bandpass', freq: 1200, q: 2 })
  },
  doorClose(pos) {
    const t = now()
    const d = out(pos)
    tone('sine', 90, t, 0.18, 0.25, d, { slide: 0.6 })
    noise(t, 0.06, 0.15, d, { type: 'lowpass', freq: 800 })
    tone('square', 1800, t + 0.02, 0.03, 0.03, d)
  },
  swoosh(pos) {
    noise(now(), 0.4, 0.16, out(pos), { type: 'bandpass', freq: 600, q: 0.7, sweep: 4, attack: 0.08 })
  },
  clang(pos) {
    const t = now()
    const d = out(pos)
    for (const [f, a] of [[180, 0.25], [432, 0.15], [811, 0.1], [1290, 0.06]]) tone('triangle', f, t, 0.7, a, d, { attack: 0.002 })
    noise(t, 0.15, 0.2, d, { type: 'lowpass', freq: 1500 })
  },
  thud(pos) {
    const t = now()
    const d = out(pos)
    tone('sine', 110, t, 0.2, 0.3, d, { slide: 0.5 })
    noise(t, 0.1, 0.12, d, { type: 'lowpass', freq: 600 })
  },
  horn(pos) {
    const t = now()
    const d = out(pos)
    for (const f of [311, 392]) {
      tone('sawtooth', f, t, 0.32, 0.07, d, { attack: 0.02 })
      tone('sawtooth', f, t + 0.42, 0.45, 0.07, d, { attack: 0.02 })
    }
  },
  brakes(pos) {
    noise(now(), 0.6, 0.12, out(pos), { type: 'highpass', freq: 4000, attack: 0.02 })
  },
  tada(pos) {
    const t = now()
    const d = out(pos)
    ;[523, 659, 784].forEach((f, i) => tone('triangle', f, t + i * 0.08, 0.25, 0.14, d))
    ;[1047, 1319].forEach((f) => tone('sine', f, t + 0.26, 0.8, 0.1, d))
    noise(t, 0.3, 0.1, d, { type: 'bandpass', freq: 800, q: 0.6, sweep: 3 })
  },
  pry(pos) {
    const t = now()
    const d = out(pos)
    tone('sawtooth', 220, t, 0.25, 0.05, d, { slide: 0.6 })
    noise(t + 0.15, 0.2, 0.18, d, { type: 'bandpass', freq: 700, q: 1.2 })
  },
  click() {
    const t = now()
    tone('sine', 900, t, 0.05, 0.08, sfxBus, { slide: 1.3 })
  },
  error() {
    const t = now()
    tone('square', 180, t, 0.12, 0.05, sfxBus)
    tone('square', 150, t + 0.13, 0.15, 0.05, sfxBus)
  },
  levelUp() {
    const t = now()
    ;[523, 659, 784, 1047, 1319].forEach((f, i) => tone('triangle', f, t + i * 0.09, 0.35, 0.1, sfxBus))
  },
  splash(pos) {
    noise(now(), 0.5, 0.2, out(pos), { type: 'bandpass', freq: 1400, q: 0.5, sweep: 0.4, attack: 0.01 })
  },
  announce() {
    const t = now()
    tone('sine', 880, t, 0.18, 0.1, sfxBus)
    tone('sine', 1320, t + 0.15, 0.3, 0.1, sfxBus)
  },
  // --- Work sounds (played in bursts while a hold task runs) ---
  sizzle(pos) {
    const t = now()
    const d = out(pos)
    noise(t, 0.35, 0.07, d, { type: 'highpass', freq: 5200, q: 0.6, attack: 0.02 })
    for (let i = 0; i < 3; i++) noise(t + Math.random() * 0.25, 0.03, 0.05, d, { type: 'bandpass', freq: 3000 + Math.random() * 3000, q: 3 })
  },
  pour(pos) {
    const t = now()
    noise(t, 0.35, 0.08, out(pos), { type: 'bandpass', freq: 700 + Math.random() * 300, q: 2.5, sweep: 1.5, attack: 0.03 })
  },
  vacuum(pos) {
    const t = now()
    const d = out(pos)
    tone('sawtooth', 110, t, 0.3, 0.03, d, { attack: 0.03 })
    noise(t, 0.3, 0.07, d, { type: 'bandpass', freq: 1800, q: 0.8, attack: 0.03 })
  },
  mop(pos) {
    const t = now()
    noise(t, 0.28, 0.1, out(pos), { type: 'lowpass', freq: 1400, q: 1.2, sweep: 0.4, attack: 0.02 })
  },
  brush(pos) {
    const t = now()
    const d = out(pos)
    for (let i = 0; i < 4; i++) noise(t + i * 0.06, 0.05, 0.06, d, { type: 'highpass', freq: 4200, q: 1 })
  },
  cash(pos) {
    const t = now()
    const d = out(pos)
    for (let i = 0; i < 3; i++) noise(t + i * 0.07, 0.08, 0.1, d, { type: 'bandpass', freq: 2600 + i * 400, q: 1.5 })
    tone('sine', 1320, t + 0.2, 0.25, 0.06, d)
  },
  key(pos) {
    const t = now()
    const d = out(pos)
    for (let i = 0; i < 4; i++) tone('triangle', 3200 + Math.random() * 2400, t + i * 0.05, 0.15, 0.05, d, { attack: 0.002 })
  },
  phone(pos) {
    const t = now()
    const d = out(pos)
    for (let i = 0; i < 10; i++) tone('square', i % 2 ? 1250 : 1500, t + i * 0.05, 0.05, 0.035, d, { attack: 0.002 })
  },
}

export function play(name, pos) {
  if (!ctx || muted) return
  try {
    S[name]?.(pos)
  } catch (err) {
    console.warn('[sfx]', name, err)
  }
}
