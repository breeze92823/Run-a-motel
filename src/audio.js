// UI sound effects for the windows and HUD, synthesized with WebAudio (no files to load).
// The context starts on the first pointer/key press (browsers block audio before a gesture).
// World and gameplay sounds are src/fx/sfx.js.

import { addOutput } from './fx/mixer.js'

let ctx = null
let master = null
let out = null // mixer handle (Boxity master volume, ad-break mute)
let volume = 0.55

function ac() {
  if (ctx) return ctx
  try {
    const AC = window.AudioContext || window.webkitAudioContext
    if (!AC) return null
    ctx = new AC()
    master = ctx.createGain()
    master.gain.value = volume
    master.connect(ctx.destination)
    out = addOutput(master, volume)
  } catch {
    ctx = null
  }
  return ctx
}
function unlock() {
  const c = ac()
  if (c?.state === 'suspended') c.resume().catch(() => {})
}
if (typeof window !== 'undefined') {
  window.addEventListener('pointerdown', unlock, { capture: true, passive: true })
  window.addEventListener('keydown', unlock, { capture: true })
}

export function setUiVolume(v) {
  volume = Math.max(0, Math.min(1, v))
  out?.setBase(volume)
}

// One enveloped oscillator note.
function tone({ freq = 440, to = null, type = 'sine', at = 0, dur = 0.12, gain = 0.3, attack = 0.005 }) {
  const c = ac()
  if (!c || c.state !== 'running') return
  const t = c.currentTime + at
  const o = c.createOscillator()
  const g = c.createGain()
  o.type = type
  o.frequency.setValueAtTime(freq, t)
  if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur)
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(gain, t + attack)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  o.connect(g).connect(master)
  o.start(t)
  o.stop(t + dur + 0.02)
}

// Filtered noise burst (whooshes, paper, register drawer).
function noise({ at = 0, dur = 0.2, gain = 0.2, from = 800, to = 3000, q = 1, type = 'bandpass' }) {
  const c = ac()
  if (!c || c.state !== 'running') return
  const t = c.currentTime + at
  const len = Math.ceil(c.sampleRate * dur)
  const buf = c.createBuffer(1, len, c.sampleRate)
  const d = buf.getChannelData(0)
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1
  const src = c.createBufferSource()
  src.buffer = buf
  const f = c.createBiquadFilter()
  f.type = type
  f.Q.value = q
  f.frequency.setValueAtTime(from, t)
  f.frequency.exponentialRampToValueAtTime(to, t + dur)
  const g = c.createGain()
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(gain, t + dur * 0.3)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  src.connect(f).connect(g).connect(master)
  src.start(t)
}

const SOUNDS = {
  // Window pops open: an upward whoosh + a bubbly blip.
  open() {
    noise({ dur: 0.22, gain: 0.12, from: 500, to: 4000 })
    tone({ freq: 520, to: 880, type: 'triangle', at: 0.05, dur: 0.12, gain: 0.22 })
  },
  close() {
    noise({ dur: 0.18, gain: 0.1, from: 3000, to: 500 })
    tone({ freq: 660, to: 330, type: 'triangle', dur: 0.12, gain: 0.18 })
  },
  // Side tab: a woody click.
  tab() {
    tone({ freq: 900, to: 600, type: 'square', dur: 0.05, gain: 0.08 })
    tone({ freq: 1400, type: 'sine', at: 0.01, dur: 0.06, gain: 0.1 })
  },
  tap() {
    tone({ freq: 700, to: 500, type: 'triangle', dur: 0.06, gain: 0.15 })
  },
  // Cash register: drawer rattle + "cha-ching" bell.
  buy() {
    noise({ dur: 0.12, gain: 0.18, from: 2000, to: 1200, q: 3 })
    tone({ freq: 1318, type: 'triangle', at: 0.08, dur: 0.25, gain: 0.22 })
    tone({ freq: 1760, type: 'triangle', at: 0.16, dur: 0.45, gain: 0.25 })
    tone({ freq: 2637, type: 'sine', at: 0.16, dur: 0.35, gain: 0.08 })
  },
  // A hire / big purchase: a short major fanfare.
  hire() {
    const notes = [523, 659, 784, 1047]
    notes.forEach((f, i) => tone({ freq: f, type: 'triangle', at: i * 0.07, dur: 0.22, gain: 0.2 }))
    tone({ freq: 1568, type: 'sine', at: 0.3, dur: 0.4, gain: 0.1 })
  },
  // Not enough money: a low double buzz.
  fail() {
    tone({ freq: 180, type: 'sawtooth', dur: 0.11, gain: 0.12 })
    tone({ freq: 150, type: 'sawtooth', at: 0.13, dur: 0.16, gain: 0.12 })
  },
  // Locked: a padlock clunk.
  locked() {
    noise({ dur: 0.08, gain: 0.2, from: 900, to: 300, q: 2, type: 'lowpass' })
    tone({ freq: 240, to: 120, type: 'square', dur: 0.09, gain: 0.1 })
  },
  // Coins landing (money counter / collect).
  coins() {
    for (let i = 0; i < 5; i++) tone({ freq: 1800 + Math.random() * 900, type: 'sine', at: i * 0.05, dur: 0.12, gain: 0.09 })
  },
  // A goal reached (NEXT card complete).
  goal() {
    const notes = [784, 988, 1175, 1568]
    notes.forEach((f, i) => tone({ freq: f, type: 'square', at: i * 0.09, dur: 0.18, gain: 0.07 }))
  },
}

export function sfx(name) {
  try {
    SOUNDS[name]?.()
  } catch {
    // Audio is never worth a crash.
  }
}
