// The money HUD: the money pill (top-right) and the Upgrades / Staff / Shop buttons (a column
// on the right edge, a row there on short screens). A red badge on a button counts what can be
// bought there right now. Also the welcome-back toast.
import { economy } from '../economy.js'
import { SHOP, STAFF, UPGRADES } from '../catalog.js'
import { art } from './art.js'
import { sfx } from '../audio.js'
import { coinBurst, counter, floatText, money, pulse } from './fx.js'

// The three round buttons, drawn here (the reference HUD's own glyphs).
const UP_ICON = `<svg viewBox="0 0 100 100"><defs><linearGradient id="mh-up" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe36a"/><stop offset="1" stop-color="#f2a412"/></linearGradient></defs>
<path d="M50 10 L84 48 H64 V84 H36 V48 H16 Z" fill="url(#mh-up)" stroke="#7a4a06" stroke-width="5" stroke-linejoin="round"/><path d="M50 20 L72 44 H58 V56" fill="none" stroke="#fff6c0" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" opacity=".8"/>
<path d="M82 12 l3 8 8 3 -8 3 -3 8 -3 -8 -8 -3 8 -3z" fill="#fff8d0" stroke="#e0a020" stroke-width="2"/></svg>`
const SHOP_ICON = `<svg viewBox="0 0 100 100"><path d="M36 34 C36 14 64 14 64 34" fill="none" stroke="#7a1a12" stroke-width="7" stroke-linecap="round"/>
<path d="M20 34 H80 L84 86 H16 Z" fill="#e8352a" stroke="#6e140e" stroke-width="5" stroke-linejoin="round"/><path d="M22 36 H52 L50 84 H18 Z" fill="#ff6a50" opacity=".55"/>
<path d="M50 44 l6 12 13 2 -9.5 9 2.5 13 -12 -6 -12 6 2.5 -13 -9.5 -9 13 -2z" fill="#ffd23d" stroke="#8a5a06" stroke-width="3.5" stroke-linejoin="round"/>
<path d="M82 8 l3 7 7 3 -7 3 -3 7 -3 -7 -7 -3 7 -3z" fill="#fff8d0" stroke="#e0a020" stroke-width="2"/></svg>`
const STAFF_ICON = `<svg viewBox="0 0 100 100"><g stroke="#2a1a3a" stroke-width="4" stroke-linejoin="round">
<path d="M8 92 C8 70 20 62 34 62 C48 62 58 70 58 92Z" fill="#2fb3a5"/><circle cx="34" cy="44" r="17" fill="#f5c89a"/><path d="M16 38 C18 22 50 20 52 38 L52 32 C48 18 20 18 16 32Z" fill="#1d7f78"/><path d="M14 36 H54 L52 30 H16Z" fill="#2fb3a5"/>
<path d="M44 92 C44 72 56 64 68 64 C82 64 94 72 94 92Z" fill="#e8473f"/><circle cx="68" cy="46" r="16" fill="#f8d0a8"/><path d="M52 46 C50 24 86 22 85 46 C84 36 74 32 62 34 C58 36 54 40 52 46Z" fill="#c4502a"/><circle cx="84" cy="30" r="7" fill="#c4502a"/></g>
<g fill="#2a1a3a"><circle cx="28" cy="46" r="2.6"/><circle cx="40" cy="46" r="2.6"/><circle cx="62" cy="48" r="2.6"/><circle cx="74" cy="48" r="2.6"/></g>
<g fill="none" stroke="#2a1a3a" stroke-width="2.6" stroke-linecap="round"><path d="M29 53 Q34 57 39 53"/><path d="M63 55 Q68 59 73 55"/></g></svg>`
const BUTTONS = [
  { id: 'upgrades', label: 'UPGRADES', icon: UP_ICON, key: 'U', cls: 'up' },
  { id: 'shop', label: 'SHOP', icon: SHOP_ICON, key: 'B', cls: 'shop' },
  { id: 'staff', label: 'STAFF', icon: STAFF_ICON, key: 'H', cls: 'staff' },
]

// How many things in each window can be bought now (for the red dots).
function affordable() {
  const up = Object.values(UPGRADES)
    .flatMap((t) => t.items)
    .filter((i) => i.kind !== 'boost' && economy.isUnlocked(i.lock) && !(i.kind === 'once' && economy.has(i.id)) && !economy.upgradeMaxed(i.id) && economy.canAfford(economy.upgradePrice(i.id))).length
  const goal = economy.nextGoal()
  const staff = STAFF.filter((s) => economy.staffLevel(s.id) < 0 && economy.isUnlocked(s.lock) && economy.canAfford(economy.staffPrice(s.id))).length
  const ready = [...SHOP.cash, SHOP.empire].filter((it) => {
    const at = economy.investReadyAt(it.id)
    return at && at <= Date.now()
  }).length
  return { upgrades: up + (goal.action && economy.canAfford(goal.action.price) ? 1 : 0), staff, shop: ready }
}

export function createHud({ open }) {
  const root = document.createElement('div')
  root.className = 'mh-root'
  root.innerHTML = `<div class="mh-money"><i class="mw-coin">${art('coin')}</i><b></b></div><div class="mh-side"></div>`
  document.body.appendChild(root)
  const pill = root.querySelector('.mh-money')
  const num = counter(pill.querySelector('b'), economy.money)
  const side = root.querySelector('.mh-side')
  const buttons = {}
  for (const b of BUTTONS) {
    const el = document.createElement('button')
    el.className = `mh-btn ${b.cls}`
    el.setAttribute('aria-label', b.label)
    el.innerHTML = `<i>${b.icon}</i><b>${b.label}</b><span class="key">${b.key}</span><span class="dot"></span>`
    el.addEventListener('click', () => {
      sfx('tap')
      open(b.id)
    })
    side.appendChild(el)
    buttons[b.id] = el
  }
  pill.addEventListener('click', () => open('shop'))

  // --- layout: scale, then fit round the touch buttons and the game's status pills ----------
  // Money pill top-right; the button column on the right edge from ~safe-top + 140px (the
  // game's BUS / CLEAN SETS / rating pills sit between them), a row there on short screens.
  function layout() {
    const w = window.innerWidth
    const hgt = window.innerHeight
    const u = Math.max(0.42, Math.min(1, Math.min(w / 1920, hgt / 991)))
    root.style.setProperty('--u', u.toFixed(4))
    // Narrow phones: the game's objective bar spans the top, so the pill goes under the
    // status-pill row and the buttons under it. Elsewhere: top-right, left of the touch
    // day/respawn buttons when those sit up there.
    const narrow = w < 640
    const touchTop = document.querySelector('.touch-top')
    const tr = touchTop && touchTop.offsetParent ? touchTop.getBoundingClientRect() : null
    const dodge = tr && tr.width && tr.top < 120 && !narrow
    pill.style.right = dodge ? `${w - tr.left + 10}px` : 'max(env(safe-area-inset-right), 14px)'
    const pillTop = narrow ? 128 : 14
    pill.style.top = `calc(env(safe-area-inset-top) + ${pillTop}px)`
    const top = narrow ? pillTop + 70 * u + 26 : 140
    const colH = (3 * 110 + 2 * 32) * u
    // Keep clear of the touch jump/run cluster (bottom-right) when it is shown.
    const cluster = document.querySelector('.touch-cluster')
    const cr = cluster && cluster.offsetParent ? cluster.getBoundingClientRect() : null
    const floor = cr && cr.height ? cr.top - 10 : hgt - 12
    side.style.top = `calc(env(safe-area-inset-top) + ${top}px)`
    side.style.right = 'max(env(safe-area-inset-right), 12px)'
    side.style.flexDirection = top + colH <= floor ? 'column' : 'row'
  }
  window.addEventListener('resize', layout)
  // The touch controls appear on the first finger: re-place then.
  window.addEventListener('pointerdown', () => requestAnimationFrame(layout), { capture: true, passive: true })

  function dots() {
    const n = affordable()
    for (const [id, el] of Object.entries(buttons)) {
      el.classList.toggle('alert', n[id] > 0)
      el.querySelector('.dot').textContent = n[id] > 9 ? '9+' : String(n[id])
    }
  }

  // --- money changes ------------------------------------------------------------------
  let lastFloat = 0
  let pending = 0
  economy.on('earn', ({ amount, reason }) => {
    pending += amount
    const t = performance.now()
    // A "+$" label at most ~3 times a second; small earnings add up into the next one.
    if (t - lastFloat > 320 || reason === 'offline' || reason === 'invest') {
      lastFloat = t
      floatText(pill, `+${money(pending)}`)
      pending = 0
      pulse(pill, 'bump')
      if (reason !== 'invest') sfx('coins')
    }
  })
  economy.on('change', (why) => {
    num.set(economy.money, why === 'load')
    dots()
  })
  economy.on('offline', ({ amount, minutes }) => {
    toast('WELCOME BACK!', `Gus kept the motel running: +${money(amount)} (up to ${minutes} min)`)
    coinBurst({ x: window.innerWidth / 2, y: window.innerHeight * 0.25 }, pill, { count: 14 })
  })

  function toast(title, text) {
    const t = document.createElement('div')
    t.className = 'mh-toast'
    t.innerHTML = `<b>${title}</b><span>${text}</span>`
    root.appendChild(t)
    setTimeout(() => t.remove(), 3700)
  }

  // Timed things (investments ripen, boosts end) need the dots refreshed now and then.
  setInterval(dots, 1000)
  layout()
  dots()
  return { layout, toast, pill, setVisible: (on) => (root.style.display = on ? '' : 'none') }
}
