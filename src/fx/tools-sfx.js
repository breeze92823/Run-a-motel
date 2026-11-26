// Tool sounds for the hotbar (hud/hotbar.js), synthesized with Web Audio (no files).
// Its own context, started on the first gesture; every call is a no-op without it.
//   toolSfx('select') - hotbar slot pop
//   toolSfx('bag')    - plastic bag rustle (trash bag equipped)
//   toolSfx('sponge') - soft squish (sponge equipped)
//   toolSfx('hands')  - quick whoosh (hands / tool put away)
import { TOOL_SFX } from '../config.js'
import { addOutput } from './mixer.js'

let ctx = null
let master = null
let out = null // mixer handle (Boxity master volume, ad-break mute)
let noise = null // 1 s of white noise, shared by every noisy sound

function ensure() {
  if (ctx) return ctx
  const AC = window.AudioContext || window.webkitAudioContext
  if (!AC) return null
  try {
    ctx = new AC()
    master = ctx.createGain()
    master.gain.value = TOOL_SFX.volume
    master.connect(ctx.destination)
    out = addOutput(master, TOOL_SFX.volume)
    noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate)
    const d = noise.getChannelData(0)
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
  } catch {
    ctx = null
  }
  return ctx
}

function unlock() {
  const c = ensure()
  if (c && c.state === 'suspended') c.resume().catch(() => {})
}
for (const type of ['pointerdown', 'keydown']) window.addEventListener(type, unlock, { capture: true, passive: true })

export function setToolVolume(v) {
  out?.setBase(v)
}

function env(t, attack, peak, decay) {
  const g = ctx.createGain()
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(peak, t + attack)
  g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay)
  g.connect(master)
  return g
}

function tone(t, type, f0, f1, dur, peak, attack = 0.004) {
  const o = ctx.createOscillator()
  o.type = type
  o.frequency.setValueAtTime(f0, t)
  o.frequency.exponentialRampToValueAtTime(f1, t + dur)
  o.connect(env(t, attack, peak, dur))
  o.start(t)
  o.stop(t + attack + dur + 0.02)
}

// Filtered noise burst; the filter sweeps f0 -> f1.
function hiss(t, filterType, f0, f1, q, dur, peak, attack = 0.005) {
  const src = ctx.createBufferSource()
  src.buffer = noise
  src.playbackRate.value = 0.8 + Math.random() * 0.4
  const f = ctx.createBiquadFilter()
  f.type = filterType
  f.Q.value = q
  f.frequency.setValueAtTime(f0, t)
  f.frequency.exponentialRampToValueAtTime(f1, t + dur)
  src.connect(f)
  f.connect(env(t, attack, peak, dur))
  src.start(t, Math.random() * 0.5)
  src.stop(t + attack + dur + 0.02)
}

const SOUNDS = {
  // Bubbly UI pop: a quick upward chirp with a tiny click on top.
  select(t) {
    tone(t, 'sine', 520, 1180, 0.09, 0.32)
    tone(t + 0.012, 'triangle', 1040, 1560, 0.06, 0.08)
    hiss(t, 'highpass', 4000, 4000, 0.7, 0.02, 0.05, 0.001)
  },
  // Crinkly plastic: a cluster of tiny bright bursts.
  bag(t) {
    for (let i = 0; i < 6; i++) {
      const at = t + 0.03 + i * (0.025 + Math.random() * 0.03)
      hiss(at, 'bandpass', 3000 + Math.random() * 3500, 2200 + Math.random() * 2000, 2.5, 0.03 + Math.random() * 0.03, 0.22, 0.002)
    }
    hiss(t + 0.02, 'lowpass', 1800, 600, 0.8, 0.18, 0.08, 0.01)
  },
  // Wet squish: a falling low-passed noise plus a soft wobbling thud.
  sponge(t) {
    hiss(t + 0.02, 'lowpass', 2400, 260, 3.5, 0.2, 0.32, 0.015)
    hiss(t + 0.05, 'bandpass', 900, 380, 5, 0.12, 0.14, 0.01)
    tone(t + 0.02, 'sine', 240, 110, 0.14, 0.18, 0.01)
  },
  // Motor spin-up: a rising hum with an airy hiss.
  vacuum(t) {
    tone(t, 'sawtooth', 90, 180, 0.32, 0.05, 0.04)
    hiss(t, 'bandpass', 1200, 2600, 1.4, 0.3, 0.1, 0.04)
  },
  // Wet slap of mop strings.
  mop(t) {
    hiss(t + 0.01, 'lowpass', 1800, 300, 2, 0.22, 0.28, 0.01)
    tone(t + 0.02, 'sine', 180, 90, 0.12, 0.12, 0.01)
  },
  // Scratchy bristles.
  brush(t) {
    for (let i = 0; i < 3; i++) hiss(t + i * 0.05, 'highpass', 3500, 5000, 1, 0.04, 0.12, 0.003)
  },
  // Air whoosh for an empty hand.
  hands(t) {
    hiss(t, 'bandpass', 500, 1700, 1.2, 0.16, 0.16, 0.03)
  },
}

export function toolSfx(name) {
  if (!ensure() || !SOUNDS[name]) return
  if (ctx.state === 'suspended') ctx.resume().catch(() => {})
  try {
    SOUNDS[name](ctx.currentTime + 0.005)
  } catch {
    // A failed sound never breaks the game.
  }
}
