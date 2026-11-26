// Performance overlay, to measure on real devices instead of guessing. Shown in dev builds with F8,
// and in any build with `?perf` in the page address (works on phones, which have no F8).
// It reads, every frame:
//  - frame time (between frames) as fps + average / worst ms, and the game's own CPU time per frame;
//  - what the GPU was asked to draw: draw calls and triangles over ALL passes of the frame (scene,
//    shadow map, bloom) - three.js counts per render() call, so the overlay resets the counters
//    itself at the start of each frame;
//  - what is on the GPU (geometries, textures, shader programs) and the JS heap (Chrome only);
//  - the screen: canvas size, pixel ratio and the graphics preset;
//  - extra lines from the game (static batcher, other players).
// Text refreshes 4 times a second; nothing is drawn or counted while it is hidden except the cheap
// counters. Never covers Boxity's toolbar (top-left) or the hotbar: it sits on the left, mid-height, and lets
// taps through.
const STYLE = `position:fixed;left:calc(8px + env(safe-area-inset-left));top:46%;z-index:9999;pointer-events:none;
  font:600 clamp(9px,2.6vw,11px)/1.35 ui-monospace,Menlo,Consolas,monospace;color:#eafff3;background:rgba(10,18,24,.72);
  padding:6px 8px;border-radius:8px;white-space:pre-wrap;word-break:break-word;max-width:min(62vw,360px)`

export function createPerfHud(renderer, { preset = () => '', extra = () => [] } = {}) {
  const params = new URLSearchParams(location.search)
  let shown = params.has('perf')
  const el = document.createElement('div')
  el.style.cssText = STYLE
  el.style.display = shown ? 'block' : 'none'
  el.setAttribute('aria-hidden', 'true')
  document.body.appendChild(el)
  window.addEventListener('keydown', (e) => {
    if (e.code !== 'F8' || !(import.meta.env.DEV || params.has('perf'))) return
    shown = !shown
    el.style.display = shown ? 'block' : 'none'
    e.preventDefault()
  })

  renderer.info.autoReset = false // counted over the whole frame (reset in begin())
  const win = { frames: 0, time: 0, worst: 0, cpu: 0, calls: 0, tris: 0 }
  let last = performance.now()
  let cpuStart = 0

  return {
    // At the very start of the frame.
    begin() {
      const now = performance.now()
      const ms = now - last
      last = now
      cpuStart = now
      win.frames++
      win.time += ms
      win.worst = Math.max(win.worst, ms)
      renderer.info.reset()
    },
    // After everything of the frame (render included).
    end() {
      const info = renderer.info
      win.cpu += performance.now() - cpuStart
      win.calls += info.render.calls
      win.tris += info.render.triangles
      if (win.time < 250) return
      if (!shown) return void Object.assign(win, { frames: 0, time: 0, worst: 0, cpu: 0, calls: 0, tris: 0 })
      const n = Math.max(1, win.frames)
      const avg = win.time / n
      const heap = performance.memory ? `${Math.round(performance.memory.usedJSHeapSize / 1e6)} MB heap\n` : ''
      const c = renderer.domElement
      el.textContent =
        `${(1000 / avg).toFixed(0)} fps  ${avg.toFixed(1)} ms avg  ${win.worst.toFixed(1)} worst\n` +
        `cpu ${(win.cpu / n).toFixed(2)} ms/frame\n` +
        `${Math.round(win.calls / n)} draw calls  ${(win.tris / n / 1000).toFixed(0)}k tris\n` +
        `gpu: ${info.memory.geometries} geo  ${info.memory.textures} tex  ${info.programs?.length ?? '?'} shaders\n` +
        heap +
        `${c.width}x${c.height} @${renderer.getPixelRatio().toFixed(2)}  ${preset()}\n` +
        extra().join('\n')
      Object.assign(win, { frames: 0, time: 0, worst: 0, cpu: 0, calls: 0, tris: 0 })
    },
    get shown() {
      return shown
    },
  }
}
