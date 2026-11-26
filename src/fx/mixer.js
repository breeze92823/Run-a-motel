// One volume + pause control over the game's WebAudio contexts (UI src/audio.js, world
// src/fx/sfx.js, FURNISH src/decor/sfx.js, tools src/fx/tools-sfx.js). Each module registers its
// output gain with the level it was designed at; the mixer scales it by Boxity's master_volume
// (and music_volume for the ambience bed) and silences everything during an ad break.

const outputs = [] // { gain: GainNode, base, bus: 'master' | 'music' }
const level = { master: 1, music: 1 }
let paused = false

// Boxity's sliders run "0".."100", default "80": the default plays the sounds as designed.
const toLevel = (v) => Math.max(0, Math.min(1.25, (Number(v) || 0) / 80))

function apply(o) {
  try {
    const v = paused ? 0 : o.base * level.master * (o.bus === 'music' ? level.music : 1)
    o.gain.gain.setTargetAtTime(v, o.gain.context.currentTime, 0.03)
  } catch {
    // A closed context: nothing to set.
  }
}

// gain: the module's output GainNode; base: its designed level.
export function addOutput(gain, base, bus = 'master') {
  const o = { gain, base, bus }
  outputs.push(o)
  apply(o)
  return {
    setBase(b) {
      o.base = b
      apply(o)
    },
  }
}

export function setMasterVolume(v) {
  level.master = toLevel(v)
  outputs.forEach(apply)
}
export function setMusicVolume(v) {
  level.music = toLevel(v)
  outputs.forEach(apply)
}
// Ad breaks: everything silent until the break ends.
export function setAudioPaused(on) {
  paused = !!on
  outputs.forEach(apply)
}
export const audioPaused = () => paused
