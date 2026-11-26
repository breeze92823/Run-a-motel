// Screen-space juice for the windows and HUD: coins that fly into the money pill, floating
// "+$40" numbers, confetti and a tweened money counter. DOM-only, no per-frame allocations
// beyond the few short-lived particles.
import { art } from './art.js'

let layer = null
function fxLayer() {
  if (!layer) {
    layer = document.createElement('div')
    layer.className = 'mw-fx'
    document.body.appendChild(layer)
  }
  return layer
}

const center = (el) => {
  const r = el.getBoundingClientRect()
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 }
}

// Coins burst out of `from` (element or {x,y}) and fly into `to` (element). onLand runs per coin.
export function coinBurst(from, to, { count = 8, onLand } = {}) {
  if (!from || !to) return
  const a = from.getBoundingClientRect ? center(from) : from
  const b = center(to)
  const root = fxLayer()
  const svg = art('coin')
  for (let i = 0; i < count; i++) {
    const c = document.createElement('div')
    c.className = 'coin'
    c.innerHTML = svg
    root.appendChild(c)
    const ang = Math.random() * Math.PI * 2
    const spread = 50 + Math.random() * 60
    const mid = { x: a.x + Math.cos(ang) * spread, y: a.y + Math.sin(ang) * spread - 30 }
    const delay = i * 40
    const anim = c.animate(
      [
        { transform: `translate(${a.x}px, ${a.y}px) scale(.4)`, opacity: 0 },
        { transform: `translate(${mid.x}px, ${mid.y}px) scale(1.1)`, opacity: 1, offset: 0.35 },
        { transform: `translate(${b.x}px, ${b.y}px) scale(.6)`, opacity: 0.9 },
      ],
      { duration: 700 + Math.random() * 200, delay, easing: 'cubic-bezier(.4,0,.6,1)', fill: 'both' },
    )
    anim.onfinish = () => {
      c.remove()
      onLand?.(i)
    }
  }
}

// A floating "+$40" (or "-$40") label at an element or point.
export function floatText(at, text, minus = false) {
  const p = at?.getBoundingClientRect ? center(at) : at
  if (!p) return
  const el = document.createElement('div')
  el.className = `float${minus ? ' minus' : ''}`
  el.textContent = text
  el.style.left = `${p.x}px`
  el.style.top = `${p.y}px`
  fxLayer().appendChild(el)
  setTimeout(() => el.remove(), 1200)
}

const CONFETTI = ['#e84a3f', '#2aa596', '#ffc52e', '#5cbf4a', '#3d8be0', '#fdf3dc']
export function confetti(at, count = 28) {
  const p = at?.getBoundingClientRect ? center(at) : at
  if (!p) return
  const root = fxLayer()
  for (let i = 0; i < count; i++) {
    const c = document.createElement('div')
    c.className = 'confetti'
    c.style.background = CONFETTI[i % CONFETTI.length]
    root.appendChild(c)
    const ang = -Math.PI / 2 + (Math.random() - 0.5) * 2.4
    const v = 120 + Math.random() * 160
    const dx = Math.cos(ang) * v
    const dy = Math.sin(ang) * v
    const spin = (Math.random() - 0.5) * 1080
    c.animate(
      [
        { transform: `translate(${p.x}px, ${p.y}px) rotate(0deg)`, opacity: 1 },
        { transform: `translate(${p.x + dx}px, ${p.y + dy}px) rotate(${spin / 2}deg)`, opacity: 1, offset: 0.45 },
        { transform: `translate(${p.x + dx * 1.3}px, ${p.y + dy + 220}px) rotate(${spin}deg)`, opacity: 0 },
      ],
      { duration: 1100 + Math.random() * 400, easing: 'cubic-bezier(.2,.6,.4,1)', fill: 'both' },
    ).onfinish = () => c.remove()
  }
}

export const money = (n) => `$${Math.floor(n).toLocaleString('en-US')}`

// A number label that counts toward its target instead of jumping.
export function counter(el, start = 0) {
  let shown = start
  let target = start
  let raf = 0
  el.textContent = money(shown)
  const step = () => {
    const diff = target - shown
    if (Math.abs(diff) < 1) shown = target
    else shown += diff * 0.18 + Math.sign(diff) * 0.5
    el.textContent = money(shown)
    raf = shown === target ? 0 : requestAnimationFrame(step)
  }
  return {
    set(v, instant = false) {
      target = v
      if (instant) {
        shown = v
        el.textContent = money(v)
        return
      }
      if (!raf) raf = requestAnimationFrame(step)
    },
    get value() {
      return target
    },
  }
}

// Restart a CSS one-shot animation class on an element.
export function pulse(el, cls) {
  if (!el) return
  el.classList.remove(cls)
  void el.offsetWidth
  el.classList.add(cls)
  setTimeout(() => el.classList.remove(cls), 700)
}
