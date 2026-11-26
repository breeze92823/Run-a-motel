// FURNISH + guest-wealth sounds, synthesized with Web Audio (no files). Own context,
// started on the first gesture like hud/tools-sfx.js; every call is a no-op without it.
//   decorSfx('open' | 'close' | 'tab' | 'tap' | 'place' | 'land' | 'pop' | 'paint' | 'unroll' |
//            'buy' | 'star' (n) | 'tierUp' | 'error' | 'undo' | 'redo' | 'view' | 'match' |
//            'wealthy' | 'vip' | 'bigCash' | 'tryOn')
let ctx = null
let master = null
let noiseBuf = null
let volume = 0.55

function ensure() {
  if (ctx) return ctx
  const AC = window.AudioContext || window.webkitAudioContext
  if (!AC) return null
  try {
    ctx = new AC()
    master = ctx.createGain()
    master.gain.value = volume
    // A soft compressor keeps the stacked fanfares from clipping.
    const comp = ctx.createDynamicsCompressor()
    comp.threshold.value = -14
    comp.ratio.value = 4
    master.connect(comp).connect(ctx.destination)
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate)
    const d = noiseBuf.getChannelData(0)
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
  } catch {
    ctx = null
  }
  return ctx
}
const unlock = () => {
  if (ensure() && ctx.state === 'suspended') ctx.resume().catch(() => {})
}
window.addEventListener('pointerdown', unlock, { capture: true })
window.addEventListener('keydown', unlock, { capture: true })
export function setDecorVolume(v) {
  volume = v
  if (master) master.gain.value = v
}

function env(g, t, a, peak, d) {
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + a)
  g.gain.exponentialRampToValueAtTime(0.0001, t + a + d)
}
function tone(type, f, t, dur, peak, { attack = 0.005, slide = 0, detune = 0, pan = 0 } = {}) {
  const o = ctx.createOscillator()
  o.type = type
  o.frequency.setValueAtTime(f, t)
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, f * slide), t + attack + dur)
  o.detune.value = detune
  const g = ctx.createGain()
  env(g, t, attack, peak, dur)
  let n = o.connect(g)
  if (pan && ctx.createStereoPanner) {
    const p = ctx.createStereoPanner()
    p.pan.value = pan
    n = n.connect(p)
  }
  n.connect(master)
  o.start(t)
  o.stop(t + attack + dur + 0.05)
}
function noise(t, dur, peak, { type = 'bandpass', freq = 1000, q = 1, attack = 0.005, sweep = 0, lfo = 0 } = {}) {
  const s = ctx.createBufferSource()
  s.buffer = noiseBuf
  s.loop = true
  const f = ctx.createBiquadFilter()
  f.type = type
  f.frequency.setValueAtTime(freq, t)
  if (sweep) f.frequency.exponentialRampToValueAtTime(Math.max(40, freq * sweep), t + attack + dur)
  f.Q.value = q
  const g = ctx.createGain()
  env(g, t, attack, peak, dur)
  let tail = s.connect(f).connect(g)
  if (lfo) {
    // Rhythmic strokes (paint roller) through a tremolo.
    const trem = ctx.createGain()
    trem.gain.value = 0.5
    const o = ctx.createOscillator()
    o.frequency.value = lfo
    const depth = ctx.createGain()
    depth.gain.value = 0.5
    o.connect(depth).connect(trem.gain)
    o.start(t)
    o.stop(t + attack + dur + 0.05)
    tail = tail.connect(trem)
  }
  tail.connect(master)
  s.start(t, Math.random())
  s.stop(t + attack + dur + 0.05)
}

const S = {
  open(t) {
    noise(t, 0.5, 0.12, { type: 'bandpass', freq: 400, q: 0.8, sweep: 6, attack: 0.12 })
    ;[523, 659, 784, 1047, 1319].forEach((f, i) => tone('triangle', f, t + 0.12 + i * 0.05, 0.3, 0.07))
    tone('sine', 2093, t + 0.4, 0.6, 0.04)
  },
  close(t) {
    noise(t, 0.4, 0.1, { type: 'bandpass', freq: 2400, q: 0.8, sweep: 0.15, attack: 0.05 })
    ;[784, 659, 523].forEach((f, i) => tone('triangle', f, t + i * 0.05, 0.18, 0.05))
  },
  tab(t) {
    tone('sine', 620, t, 0.07, 0.12, { slide: 1.6 })
    noise(t, 0.04, 0.05, { type: 'highpass', freq: 3000 })
  },
  tap(t) {
    tone('triangle', 880, t, 0.05, 0.08, { slide: 1.25 })
  },
  tryOn(t) {
    tone('sine', 740, t, 0.08, 0.1, { slide: 1.4 })
    tone('sine', 1480, t + 0.05, 0.12, 0.05)
    noise(t, 0.15, 0.05, { type: 'highpass', freq: 5000 })
  },
  place(t) {
    noise(t, 0.38, 0.12, { type: 'bandpass', freq: 2600, q: 0.7, sweep: 0.2, attack: 0.03 })
    tone('sine', 900, t, 0.35, 0.05, { slide: 0.4 })
  },
  land(t) {
    tone('sine', 120, t, 0.22, 0.4, { slide: 0.45 })
    noise(t, 0.12, 0.18, { type: 'lowpass', freq: 700 })
    tone('square', 320, t + 0.01, 0.04, 0.03)
    ;[1568, 2093, 2637].forEach((f, i) => tone('sine', f, t + 0.08 + i * 0.05, 0.35, 0.05))
  },
  pop(t) {
    tone('sine', 400, t, 0.1, 0.16, { slide: 2.6 })
    noise(t, 0.08, 0.06, { type: 'bandpass', freq: 3000, q: 2 })
  },
  paint(t) {
    noise(t, 1.25, 0.16, { type: 'bandpass', freq: 900, q: 1.4, sweep: 1.8, attack: 0.08, lfo: 5 })
    noise(t + 0.05, 1.2, 0.05, { type: 'highpass', freq: 4500, attack: 0.1 })
    ;[659, 784, 988, 1319].forEach((f, i) => tone('sine', f, t + 1.0 + i * 0.06, 0.3, 0.05))
  },
  unroll(t) {
    noise(t, 0.95, 0.14, { type: 'lowpass', freq: 600, q: 0.8, sweep: 2, attack: 0.05 })
    for (let i = 0; i < 6; i++) tone('sine', 90 + i * 6, t + i * 0.15, 0.08, 0.12)
    tone('sine', 80, t + 0.95, 0.25, 0.35, { slide: 0.5 })
    noise(t + 0.95, 0.12, 0.12, { type: 'lowpass', freq: 500 })
  },
  buy(t) {
    noise(t, 0.05, 0.18, { type: 'bandpass', freq: 2500, q: 2 })
    noise(t + 0.05, 0.14, 0.14, { type: 'lowpass', freq: 1200, q: 0.8 })
    for (const [f, a] of [[2637, 0.16], [3520, 0.11], [5274, 0.05]]) tone('sine', f, t + 0.14, 0.9, a)
    for (let i = 0; i < 7; i++) tone('triangle', 2200 + Math.random() * 2200, t + 0.25 + i * 0.045, 0.12, 0.05, { pan: Math.random() - 0.5 })
  },
  star(t, n = 0) {
    const f = [1047, 1175, 1319, 1568, 1760, 2093][Math.min(5, n)]
    tone('sine', f, t, 0.45, 0.14)
    tone('triangle', f * 2, t, 0.25, 0.05)
    noise(t, 0.2, 0.04, { type: 'highpass', freq: 6000 })
  },
  tierUp(t) {
    const chords = [[523, 659, 784], [587, 740, 880], [659, 831, 988], [784, 988, 1175, 1568]]
    chords.forEach((c, i) => c.forEach((f) => {
      tone('sawtooth', f, t + i * 0.16, i === 3 ? 0.9 : 0.15, 0.035, { attack: 0.02, detune: (Math.random() - 0.5) * 12 })
      tone('triangle', f, t + i * 0.16, i === 3 ? 0.9 : 0.15, 0.05, { attack: 0.01 })
    }))
    noise(t + 0.48, 1.0, 0.08, { type: 'highpass', freq: 6000, attack: 0.01 })
    tone('sine', 98, t + 0.48, 0.6, 0.3, { slide: 0.7 })
  },
  error(t) {
    tone('square', 190, t, 0.1, 0.05)
    tone('square', 150, t + 0.11, 0.14, 0.05)
  },
  undo(t) {
    tone('triangle', 900, t, 0.12, 0.09, { slide: 0.55 })
  },
  redo(t) {
    tone('triangle', 500, t, 0.12, 0.09, { slide: 1.8 })
  },
  view(t) {
    noise(t, 0.45, 0.1, { type: 'bandpass', freq: 700, q: 0.6, sweep: 3, attack: 0.1 })
  },
  match(t) {
    ;[1568, 1976, 2349, 3136].forEach((f, i) => tone('sine', f, t + i * 0.06, 0.4, 0.06, { pan: (i - 1.5) * 0.4 }))
  },
  wealthy(t) {
    ;[523, 659, 784, 988, 1175, 1319, 1568, 1976].forEach((f, i) => tone('sine', f, t + i * 0.035, 0.6, 0.06, { pan: (i / 7 - 0.5) * 0.8 }))
    noise(t, 0.8, 0.04, { type: 'highpass', freq: 7000, attack: 0.2 })
  },
  vip(t) {
    // Trumpet-ish fanfare + a bell.
    const notes = [[392, 0, 0.12], [392, 0.14, 0.12], [392, 0.28, 0.12], [523, 0.42, 0.5], [659, 0.95, 0.18], [784, 1.15, 0.8]]
    for (const [f, at, d] of notes) {
      tone('sawtooth', f, t + at, d, 0.05, { attack: 0.03 })
      tone('square', f * 2, t + at, d, 0.012, { attack: 0.03 })
    }
    for (const [f, a] of [[1760, 0.12], [4420, 0.04]]) tone('sine', f, t + 1.15, 1.6, a, { attack: 0.002 })
    noise(t + 1.15, 1.2, 0.07, { type: 'highpass', freq: 6500 })
  },
  bigCash(t) {
    for (let i = 0; i < 14; i++) tone('triangle', 2000 + Math.random() * 2800, t + i * 0.04 + Math.random() * 0.02, 0.14, 0.05, { pan: Math.random() - 0.5 })
    for (const [f, a] of [[2637, 0.12], [3951, 0.06]]) tone('sine', f, t + 0.1, 0.8, a)
  },
}

export function decorSfx(name, arg) {
  if (!ensure() || ctx.state !== 'running') return
  try {
    S[name]?.(ctx.currentTime + 0.01, arg)
  } catch (err) {
    console.warn('[decor sfx]', name, err)
  }
}
