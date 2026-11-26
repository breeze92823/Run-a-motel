// FURNISH mode: a full-screen room editor (the reference's layout). The camera lifts off
// the player and swoops to a cut-away view of the room (the roof and ceiling are clipped
// away), 3D (orbit: drag / wheel / pinch) or TOP. Left: DONE / UNDO / REDO / 3D-TOP /
// CANCEL. Top: the room bar (type, nightly price, stars to the next type, what it still
// needs, looks score, which guests it can host). Right: ITEMS (by category) / WALLS /
// FLOOR cards. Placing an item or trying on a wallpaper / floor edits a draft that shows
// in the room at once; DONE pays for what is new and celebrates, CANCEL puts it all back.
import './furnish.css'
import { HemisphereLight, Plane, PointLight, Quaternion, Vector3, Matrix4 } from 'three'
import { inputState } from '../input.js'
import { CATEGORIES, FLOORS, ITEMS, TIERS, WALLS, evaluate, itemById, bySlot } from './rules.js'
import { floorSwatch, wallSwatch } from './paint.js'
import { thumb, warmThumbs } from './thumbs.js'
import { decorSfx } from './sfx.js'
import { coinBurst, confetti, floatText } from '../ui/fx.js'

const CLIP_Y = 3.3
const TWEEN = 0.85
const MOVE_KEYS = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'ShiftLeft', 'ShiftRight', 'KeyE', 'KeyF', 'KeyV', 'KeyR', 'KeyN', 'Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6'])
const ease = (k) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2)
const money = (n) => `$${Math.floor(n).toLocaleString('en-US')}`
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])

function el(tag, cls, html = '') {
  const e = document.createElement(tag)
  if (cls) e.className = cls
  if (html) e.innerHTML = html
  return e
}
const COIN = '<svg viewBox="0 0 40 40" class="df-coin"><circle cx="20" cy="20" r="18" fill="#f5b915" stroke="#a86b00" stroke-width="3"/><circle cx="20" cy="20" r="12" fill="#ffd34a"/><text x="20" y="27" text-anchor="middle" font-size="18" font-weight="700" fill="#a86b00" font-family="Fredoka, sans-serif">$</text></svg>'
const MOON = '<svg viewBox="0 0 24 24" class="df-moon"><path d="M15 3a9 9 0 1 0 6 15A8 8 0 0 1 15 3z" fill="currentColor"/></svg>'
const ICON = {
  done: '<svg viewBox="0 0 48 48"><path d="M11 25l9 9 17-19" fill="none" stroke="#fff" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  undo: '<svg viewBox="0 0 48 48"><path d="M18 14l-8 8 8 8" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/><path d="M11 22h16a10 10 0 0 1 0 20h-6" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round"/></svg>',
  redo: '<svg viewBox="0 0 48 48"><path d="M30 14l8 8-8 8" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/><path d="M37 22H21a10 10 0 0 0 0 20h6" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round"/></svg>',
  cancel: '<svg viewBox="0 0 48 48"><path d="M14 14l20 20M34 14L14 34" stroke="#fff" stroke-width="7" stroke-linecap="round"/></svg>',
  view: '<svg viewBox="0 0 48 48"><path d="M24 8l16 8-16 8-16-8z" fill="#fff"/><path d="M8 16v16l16 8V24z" fill="#f2b36b"/><path d="M40 16v16l-16 8V24z" fill="#e0884a"/></svg>',
  top: '<svg viewBox="0 0 48 48"><path d="M24 10l16 9-16 9-16-9z" fill="#fff" stroke="#e0884a" stroke-width="3"/><path d="M16 19l8 4 8-4" fill="none" stroke="#e0884a" stroke-width="3"/></svg>',
  items: '<svg viewBox="0 0 48 48"><rect x="8" y="20" width="32" height="14" rx="5" fill="#2aa596"/><rect x="6" y="16" width="8" height="20" rx="4" fill="#1d7d72"/><rect x="34" y="16" width="8" height="20" rx="4" fill="#1d7d72"/><rect x="12" y="12" width="24" height="12" rx="5" fill="#58c7a8"/><rect x="10" y="34" width="4" height="6" fill="#7a4626"/><rect x="34" y="34" width="4" height="6" fill="#7a4626"/></svg>',
  walls: '<svg viewBox="0 0 48 48"><rect x="10" y="6" width="22" height="30" rx="3" fill="#f7b796" transform="rotate(-10 21 21)"/><path d="M12 12l16 0M12 20h16M12 28h16" stroke="#2aa596" stroke-width="3" transform="rotate(-10 21 21)"/><rect x="28" y="20" width="12" height="7" rx="2" fill="#e8574a"/><rect x="33" y="27" width="3" height="15" rx="1.5" fill="#7a4626"/></svg>',
  floor: '<svg viewBox="0 0 48 48"><path d="M24 10l18 10-18 10L6 20z" fill="#f2d39a"/><path d="M24 10l9 5-18 10-9-5z" fill="#c98a4b"/><path d="M33 15l9 5-9 5-9-5z" fill="#e0884a"/></svg>',
  arrow: '<svg viewBox="0 0 24 24"><path d="M5 12h12M12 6l6 6-6 6" fill="none" stroke="#2aa596" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  lock: '<svg viewBox="0 0 24 24"><rect x="5" y="10" width="14" height="11" rx="2" fill="#7f8c8a"/><path d="M8 10V7a4 4 0 0 1 8 0v3" fill="none" stroke="#7f8c8a" stroke-width="2.5"/></svg>',
  bed: '<svg viewBox="0 0 48 48"><rect x="6" y="24" width="36" height="10" rx="3" fill="#c67a35"/><rect x="8" y="18" width="32" height="8" rx="3" fill="#fffaf0"/><rect x="10" y="14" width="10" height="7" rx="3" fill="#f3e6c8"/><rect x="22" y="18" width="18" height="8" rx="3" fill="#2aa596"/><rect x="6" y="10" width="4" height="28" rx="2" fill="#7a4626"/><rect x="38" y="20" width="4" height="18" rx="2" fill="#7a4626"/></svg>',
}

export function createFurnish({ camera, renderer, playerGroup, fx, bank, rooms, api }) {
  let root = null
  const ui = {}
  const S = {
    open: false,
    closing: false,
    n: null,
    room: null,
    draft: null,
    base: null, // committed state when opened
    undo: [],
    redo: [],
    tab: 'items',
    cat: 'all',
    view: '3d',
    collapsed: false,
    tween: 0, // 0..1 into furnish view
    yaw: 0.35,
    pitch: 0.95,
    dist: 11,
    yawT: 0.35,
    pitchT: 0.95,
    distT: 11,
    lastEval: null,
    lastTiers: null,
    celebrating: 0,
  }
  // Camera blending.
  const saved = { pos: new Vector3(), quat: new Quaternion() }
  const pose = { pos: new Vector3(), quat: new Quaternion() }
  const target = new Vector3()
  const clip = new Plane(new Vector3(0, -1, 0), 40)
  const m4 = new Matrix4()
  const tmpQ = new Quaternion()
  const tmpV = new Vector3()
  const lights = { hemi: new HemisphereLight('#fff6e6', '#c9a77a', 0), point: new PointLight('#fff0d6', 0, 14, 1.2) }
  let lightsAdded = false
  let wasVisible = true // the avatar's visibility before the editor hid it

  // --- DOM ---------------------------------------------------------------------------------------
  function build() {
    root = el('div', 'df')
    root.innerHTML = `
      <div class="df-view"></div>
      <div class="df-left">
        <button class="df-rb done" data-act="done"><i>${ICON.done}</i><span>DONE</span><b class="df-cart"></b></button>
        <button class="df-rb undo" data-act="undo"><i>${ICON.undo}</i><span>UNDO</span></button>
        <button class="df-rb redo" data-act="redo"><i>${ICON.redo}</i><span>REDO</span></button>
        <button class="df-rb view" data-act="view"><i class="v3">${ICON.view}</i><i class="vt">${ICON.top}</i><span>3D</span></button>
        <button class="df-rb cancel" data-act="cancel"><i>${ICON.cancel}</i><span>CANCEL</span></button>
      </div>
      <div class="df-top">
        <div class="df-bar"></div>
        <div class="df-hint"><span></span></div>
      </div>
      <button class="df-collapse" data-act="collapse">${ICON.arrow}</button>
      <div class="df-panel">
        <div class="df-tabs">
          <button class="df-tab on" data-tab="items"><i>${ICON.items}</i><span>ITEMS</span></button>
          <button class="df-tab" data-tab="walls"><i>${ICON.walls}</i><span>WALLS</span></button>
          <button class="df-tab" data-tab="floor"><i>${ICON.floor}</i><span>FLOOR</span></button>
        </div>
        <div class="df-body">
          <div class="df-cats"></div>
          <div class="df-main">
            <div class="df-head"></div>
            <div class="df-grid"></div>
          </div>
        </div>
      </div>
      <div class="df-money">${COIN}<span class="v"></span><small class="pend"></small></div>
      <div class="df-banner"><b></b><span></span></div>`
    document.body.appendChild(root)
    for (const k of ['view', 'left', 'top', 'bar', 'hint', 'panel', 'cats', 'head', 'grid', 'money', 'banner', 'cart', 'collapse']) ui[k] = root.querySelector(`.df-${k}`)
    ui.hintT = ui.hint.querySelector('span')
    ui.moneyV = ui.money.querySelector('.v')
    ui.pend = ui.money.querySelector('.pend')
    // Buttons (pointer events: work for touch and mouse alike).
    root.addEventListener('pointerdown', (e) => {
      const b = e.target.closest('[data-act],[data-tab],[data-cat],[data-card]')
      if (!b || !root.contains(b)) return
      e.preventDefault()
      e.stopPropagation()
      bump(b)
      if (b.dataset.act) action(b.dataset.act)
      else if (b.dataset.tab) setTab(b.dataset.tab)
      else if (b.dataset.cat) setCat(b.dataset.cat)
      else if (b.dataset.card) tapCard(b.dataset.kind, b.dataset.card, b)
    })
    // Orbit: drag / wheel / pinch on the free part of the screen.
    const pointers = new Map()
    let pinch = 0
    ui.view.addEventListener('pointerdown', (e) => {
      ui.view.setPointerCapture?.(e.pointerId)
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
      if (pointers.size === 2) pinch = spread()
    })
    ui.view.addEventListener('pointermove', (e) => {
      const p = pointers.get(e.pointerId)
      if (!p) return
      const dx = e.clientX - p.x
      const dy = e.clientY - p.y
      p.x = e.clientX
      p.y = e.clientY
      if (pointers.size === 2) {
        const s = spread()
        if (pinch > 0) S.distT = clampDist(S.distT * (pinch / Math.max(1, s)))
        pinch = s
        return
      }
      S.yawT -= dx * 0.008
      if (S.view === '3d') S.pitchT = Math.min(1.35, Math.max(0.45, S.pitchT + dy * 0.005))
    })
    const up = (e) => {
      pointers.delete(e.pointerId)
      if (pointers.size < 2) pinch = 0
    }
    ui.view.addEventListener('pointerup', up)
    ui.view.addEventListener('pointercancel', up)
    ui.view.addEventListener('wheel', (e) => {
      e.preventDefault()
      S.distT = clampDist(S.distT * (e.deltaY > 0 ? 1.1 : 0.9))
    }, { passive: false })
    function spread() {
      const [a, b] = [...pointers.values()]
      return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0
    }
    // Keys: block the game's keys while furnishing; shortcuts for the editor.
    window.addEventListener('keydown', (e) => {
      if (!S.open) return
      if (e.code === 'Escape') {
        e.preventDefault()
        e.stopImmediatePropagation()
        action('cancel')
        return
      }
      if (e.code === 'Enter') action('done')
      else if ((e.ctrlKey || e.metaKey) && e.code === 'KeyZ') action(e.shiftKey ? 'redo' : 'undo')
      else if ((e.ctrlKey || e.metaKey) && e.code === 'KeyY') action('redo')
      else if (e.code === 'KeyT') action('view')
      if (MOVE_KEYS.has(e.code) || e.code === 'KeyT' || e.code === 'KeyZ' || e.code === 'KeyY' || e.code === 'Enter') {
        e.preventDefault()
        e.stopImmediatePropagation()
      }
    }, { capture: true })
    buildCats()
  }
  const clampDist = (d) => Math.min(17, Math.max(5.5, d))
  function bump(b, cls = 'bump') {
    b.classList.remove(cls)
    void b.offsetWidth
    b.classList.add(cls)
  }
  function layoutMode() {
    const w = window.innerWidth
    const h = window.innerHeight
    const portrait = h > w * 1.05
    const k = portrait ? Math.min(0.8, Math.max(0.42, w / 820)) : Math.min(1.1, Math.max(0.45, Math.min(w / 1920, h / 991)))
    document.documentElement.style.setProperty('--s', k.toFixed(3))
    if (root) root.dataset.mode = portrait ? 'portrait' : h < 520 ? 'compact' : 'wide'
  }
  layoutMode()
  window.addEventListener('resize', layoutMode)

  function buildCats() {
    ui.cats.innerHTML = ''
    for (const c of CATEGORIES) {
      const b = el('button', `df-cat${c.id === S.cat ? ' on' : ''}`)
      b.dataset.cat = c.id
      b.title = c.name
      const img = el('img')
      img.alt = ''
      const url = thumb(c.icon, (u) => (img.src = u))
      if (url) img.src = url
      b.appendChild(img)
      ui.cats.appendChild(b)
    }
  }

  // --- Draft helpers --------------------------------------------------------------------------------
  const evalDraft = () => evaluate(S.draft)
  const cost = () => api.costOf(S.n, S.draft)
  const snapshot = () => ({ items: [...S.draft.items], wall: S.draft.wall, floor: S.draft.floor })
  function pushUndo() {
    S.undo.push(snapshot())
    if (S.undo.length > 60) S.undo.shift()
    S.redo.length = 0
  }
  function setDraft(next, animate = true) {
    S.draft = { items: Object.values(bySlot(next.items)), wall: next.wall, floor: next.floor }
    S.room.apply(S.draft, animate)
    renderAll(true)
  }

  // --- Actions -----------------------------------------------------------------------------------------
  function action(a) {
    if (S.celebrating > 0 && a !== 'collapse') return
    switch (a) {
      case 'done':
        return done()
      case 'cancel':
        return cancel()
      case 'undo':
        if (!S.undo.length) return fail(root.querySelector('.df-rb.undo'))
        S.redo.push(snapshot())
        decorSfx('undo')
        return setDraft(S.undo.pop())
      case 'redo':
        if (!S.redo.length) return fail(root.querySelector('.df-rb.redo'))
        S.undo.push(snapshot())
        decorSfx('redo')
        return setDraft(S.redo.pop())
      case 'view':
        S.view = S.view === '3d' ? 'top' : '3d'
        root.classList.toggle('top', S.view === 'top')
        root.querySelector('.df-rb.view span').textContent = S.view === '3d' ? 'TOP' : '3D'
        S.pitchT = S.view === 'top' ? 1.53 : 0.95
        S.distT = S.view === 'top' ? Math.max(S.distT, 12) : 11
        decorSfx('view')
        return
      case 'collapse':
        S.collapsed = !S.collapsed
        root.classList.toggle('collapsed', S.collapsed)
        decorSfx('tab')
        return
      default:
    }
  }
  function fail(btn, msg) {
    if (btn) bump(btn, 'shake')
    decorSfx('error')
    if (msg) flashHint(msg, true)
  }
  let hintFlash = 0
  function flashHint(text, bad = false) {
    ui.hintT.textContent = text
    ui.hint.classList.toggle('bad', bad)
    bump(ui.hint, 'pop')
    hintFlash = 2.2
  }

  function setTab(tab) {
    if (S.tab === tab) return
    S.tab = tab
    root.querySelectorAll('.df-tab').forEach((t) => t.classList.toggle('on', t.dataset.tab === tab))
    root.dataset.tab = tab
    decorSfx('tab')
    renderGrid(true)
    renderHint()
  }
  function setCat(cat) {
    S.cat = cat
    ui.cats.querySelectorAll('.df-cat').forEach((c) => c.classList.toggle('on', c.dataset.cat === cat))
    decorSfx('tab')
    renderGrid(true)
  }

  // Tap a card: place / remove an item, or try on a wallpaper / floor.
  function tapCard(kind, id, card) {
    const e = evalDraft()
    if (kind === 'item') {
      const it = itemById(id)
      if (S.draft.items.includes(id)) {
        // Back into storage.
        pushUndo()
        decorSfx('pop')
        setDraft({ ...S.draft, items: S.draft.items.filter((x) => x !== id) })
        return
      }
      if ((it.minStars ?? 0) > e.stars) return fail(card, `${it.name} needs a ★${it.minStars} room`)
      const extra = api.owns(S.n, id) ? 0 : it.price
      const replaced = S.draft.items.find((x) => itemById(x).slot === it.slot)
      const freed = replaced && !api.owns(S.n, replaced) ? itemById(replaced).price : 0
      const need = cost() - freed + extra
      if (need > bank.money) return fail(card, `Need ${money(need - bank.money)} more`)
      pushUndo()
      decorSfx('place')
      flyToRoom(card, it.slot, () => setDraft({ ...S.draft, items: [...S.draft.items.filter((x) => itemById(x).slot !== it.slot), id] }))
      return
    }
    const list = kind === 'wall' ? WALLS : FLOORS
    const s = list.find((w) => w.id === id)
    if ((kind === 'wall' ? S.draft.wall : S.draft.floor) === id) return
    if ((s.minStars ?? 0) > e.stars) return fail(card, `${s.name} needs a ★${s.minStars} room`)
    const ownsIt = kind === 'wall' ? api.ownsWall(id) : api.ownsFloor(id)
    const prevId = kind === 'wall' ? S.draft.wall : S.draft.floor
    const prevOwned = kind === 'wall' ? api.ownsWall(prevId) : api.ownsFloor(prevId)
    const prevPrice = prevOwned ? 0 : list.find((w) => w.id === prevId)?.price ?? 0
    const need = cost() - prevPrice + (ownsIt ? 0 : s.price)
    if (need > bank.money) return fail(card, `Need ${money(need - bank.money)} more`)
    pushUndo()
    decorSfx(kind === 'wall' ? 'paint' : 'unroll')
    setDraft({ ...S.draft, [kind === 'wall' ? 'wall' : 'floor']: id })
    const after = evalDraft()
    if (kind === 'wall' ? after.matchWall : after.matchFloor) {
      setTimeout(() => {
        decorSfx('match')
        floatText(card, `MATCH! +${8} LOOKS`)
        const c = S.room.worldOf(kind)
        fx?.sparkle(c.x, c.y + 0.5, c.z, 26, '#fff2a8')
      }, kind === 'wall' ? 900 : 700)
    }
  }

  // The card's picture flies into the room, then the piece drops in.
  function flyToRoom(card, slot, then) {
    const img = card.querySelector('img')
    const p = S.room.worldOf(slot)
    tmpV.copy(p).project(camera)
    const to = { x: (tmpV.x * 0.5 + 0.5) * window.innerWidth, y: (-tmpV.y * 0.5 + 0.5) * window.innerHeight - 40 }
    const r = (img ?? card).getBoundingClientRect()
    if (!img?.src || tmpV.z > 1) return then()
    const f = el('img', 'df-fly')
    f.src = img.src
    root.appendChild(f)
    const from = { x: r.left + r.width / 2, y: r.top + r.height / 2 }
    const mid = { x: (from.x + to.x) / 2, y: Math.min(from.y, to.y) - 120 }
    f.animate(
      [
        { transform: `translate(${from.x}px, ${from.y}px) translate(-50%,-50%) scale(1)`, opacity: 1 },
        { transform: `translate(${mid.x}px, ${mid.y}px) translate(-50%,-50%) scale(0.9) rotate(-12deg)`, opacity: 1, offset: 0.5 },
        { transform: `translate(${to.x}px, ${to.y}px) translate(-50%,-50%) scale(0.35)`, opacity: 0.2 },
      ],
      { duration: 380, easing: 'cubic-bezier(.4,0,.7,1)' },
    ).onfinish = () => {
      f.remove()
      then()
    }
  }

  function done() {
    const before = api.evalRoom(S.n)
    const price = cost()
    const same = S.draft.wall === S.base.wall && S.draft.floor === S.base.floor && S.draft.items.length === S.base.items.length && S.draft.items.every((x) => S.base.items.includes(x))
    if (same) return close()
    if (price > bank.money) return fail(root.querySelector('.df-rb.done'), `Need ${money(price - bank.money)} more`)
    const res = api.commit(S.n, S.draft)
    if (!res.ok) return fail(root.querySelector('.df-rb.done'), 'Not enough money')
    const doneBtn = root.querySelector('.df-rb.done')
    if (price > 0) {
      decorSfx('buy')
      coinBurst(ui.money, doneBtn, { count: 10 })
      floatText(ui.money, `-${money(price)}`, true)
    } else decorSfx('land')
    const after = res.after
    const c = S.room.centre
    fx?.sparkle(c.x, 1.8, c.z, 40)
    // Stars gained ring out one by one.
    for (let s = before.stars + 1; s <= after.stars; s++) setTimeout(() => decorSfx('star', s), 250 + (s - before.stars) * 160)
    const tierUp = after.type.id !== before.type.id && after.stars > before.stars
    const newGuests = TIERS.filter((t) => !(before.stars >= t.minStars && before.style >= t.minStyle) && after.stars >= t.minStars && after.style >= t.minStyle)
    if (tierUp || newGuests.length) {
      S.celebrating = 2.2
      const title = tierUp ? `ROOM ${S.n} IS NOW ${after.type.name}!` : `${newGuests.at(-1).icon} ${newGuests.at(-1).name} GUESTS!`
      const sub = newGuests.length ? `now attracts ${newGuests.map((t) => `${t.icon} ${t.name}`).join(' · ')}` : `${money(api.priceOf(S.n))} a night`
      banner(title, sub)
      setTimeout(() => decorSfx(tierUp ? 'tierUp' : newGuests.at(-1).id === 'vip' ? 'vip' : 'wealthy'), 350)
      confetti(ui.banner, 60)
      setTimeout(() => confetti({ x: window.innerWidth * 0.3, y: window.innerHeight * 0.4 }, 40), 300)
      for (let i = 0; i < 6; i++) setTimeout(() => fx?.sparkle(c.x + (Math.random() - 0.5) * 4, 1 + Math.random() * 1.5, c.z + (Math.random() - 0.5) * 6, 18, i % 2 ? '#ffd34a' : '#fff2a8'), i * 180)
      setTimeout(() => close(true), 2100)
    } else {
      S.celebrating = 0.6
      setTimeout(() => close(true), 550)
    }
  }
  function cancel() {
    S.room.apply(S.base, true)
    decorSfx('close')
    close(false, true)
  }
  function banner(title, sub) {
    ui.banner.querySelector('b').textContent = title
    ui.banner.querySelector('span').textContent = sub
    bump(ui.banner, 'on')
  }

  // --- Rendering -------------------------------------------------------------------------------------------
  function renderAll(changed = false) {
    renderBar(changed)
    renderGrid()
    renderHint()
    renderMoney()
    root.querySelector('.df-rb.undo').classList.toggle('dim', !S.undo.length)
    root.querySelector('.df-rb.redo').classList.toggle('dim', !S.redo.length)
  }
  function renderMoney() {
    ui.moneyV.textContent = money(bank.money)
    const c = cost()
    ui.pend.textContent = c > 0 ? `-${money(c)}` : ''
    ui.cart.textContent = c > 0 ? money(c) : ''
    ui.cart.classList.toggle('on', c > 0)
    root.querySelector('.df-rb.done').classList.toggle('warn', c > bank.money)
  }

  // The room bar (also used by the in-room HUD).
  function barHtml(n, e, { compact = false } = {}) {
    const price = api.priceOf(n, e === S.lastEval ? S.draft : undefined)
    const top = api.topTier(e)
    const toNext = e.nextType ? `TO ${e.nextType.name} · ${money(price - e.type.priceAdd + e.nextType.priceAdd)}+` : `${e.type.name} · MAXED`
    const stars = Array.from({ length: 5 }, (_, i) => `<i class="st${i < e.stars ? ' on' : ''}">★</i>`).join('')
    const needs = (e.needNext ?? []).map((nd) => `<span class="nd${nd.ok ? ' ok' : ''}" title="${esc(nd.label)}"><img data-thumb="${nd.icon}" alt="">${nd.ok ? '<b>✓</b>' : '<b>!</b>'}</span>`).join('')
    const pts = e.nextStars ? `<span class="pts">★ ${e.pts}/${e.ptsNext}</span>` : ''
    const guests = TIERS.map((t) => `<span class="gt${e.stars >= t.minStars && e.style >= t.minStyle ? ' on' : ''}" title="${t.name}: ★${t.minStars} room, looks ${t.minStyle}+">${t.icon}</span>`).join('')
    return `
      <div class="b-ico">${ICON.bed}<i>★</i></div>
      <div class="b-col"><div class="b-type">${e.type.name}</div><div class="b-price">${money(price)} / ${money(Math.round(price * top.payMul))}${MOON}</div></div>
      <div class="b-sep"></div>
      <div class="b-col"><div class="b-next">${toNext}</div><div class="b-stars">${stars}</div></div>
      <div class="b-sep"></div>
      <div class="b-col b-needs"><div class="b-needrow">${needs}${pts}</div><div class="b-look" style="--c:${e.look.color}"><span>LOOKS ${e.style}</span><em>${e.look.name}</em><u style="width:${e.style}%"></u></div></div>
      ${compact ? '' : `<div class="b-sep"></div><div class="b-col b-guests"><div class="b-gl">GUESTS</div><div class="b-gs">${guests}</div></div>`}`
  }
  function fillThumbs(scope) {
    scope.querySelectorAll('img[data-thumb]').forEach((img) => {
      const url = thumb(img.dataset.thumb, (u) => (img.src = u))
      if (url) img.src = url
    })
  }
  function renderBar(changed) {
    const e = evalDraft()
    const prev = S.lastEval
    S.lastEval = e
    ui.bar.innerHTML = barHtml(S.n, e)
    fillThumbs(ui.bar)
    if (!changed || !prev) {
      S.lastTiers = TIERS.filter((t) => e.stars >= t.minStars && e.style >= t.minStyle).map((t) => t.id)
      return
    }
    // Stars gained / lost pop, newly attracted guests light up.
    const st = ui.bar.querySelectorAll('.b-stars .st')
    for (let i = prev.stars; i < e.stars; i++) {
      st[i]?.classList.add('gain')
      setTimeout(() => decorSfx('star', i + 1), 200 + (i - prev.stars) * 150)
    }
    for (let i = e.stars; i < prev.stars; i++) st[i]?.classList.add('lose')
    if (e.type.id !== prev.type.id) bump(ui.bar.querySelector('.b-type'), 'pop')
    if (e.style !== prev.style) bump(ui.bar.querySelector('.b-look'), e.style > prev.style ? 'pop' : 'shake')
    const tiers = TIERS.filter((t) => e.stars >= t.minStars && e.style >= t.minStyle).map((t) => t.id)
    const gained = tiers.filter((id) => !S.lastTiers?.includes(id))
    S.lastTiers = tiers
    ui.bar.querySelectorAll('.b-gs .gt').forEach((g, i) => {
      if (gained.includes(TIERS[i].id)) g.classList.add('gain')
    })
    if (gained.length) {
      const t = TIERS.find((x) => x.id === gained.at(-1))
      setTimeout(() => {
        decorSfx(t.id === 'vip' ? 'vip' : 'wealthy')
        flashHint(`${t.icon} ${t.name} guests will stay here · pay x${t.payMul}`)
      }, 500)
    }
  }
  function renderHint() {
    if (hintFlash > 0) return
    ui.hint.classList.remove('bad')
    const e = S.lastEval ?? evalDraft()
    let text
    if (S.tab === 'walls') text = `Tap one to try it on · LOOKS ${e.style} ${e.look.name}`
    else if (S.tab === 'floor') text = 'MATCH = goes with your furniture'
    else {
      const need = e.needNext?.find((nd) => !nd.ok)
      if (need) text = `Buy ${need.label} for ★${e.nextStars}`
      else if (e.nextStars) text = `Add ★${e.ptsToNext} more comfort for a ★${e.nextStars} room`
      else text = 'Five stars! Raise the LOOKS to pull in VIPs'
    }
    ui.hintT.textContent = text
  }

  function itemCard(it, e) {
    const inUse = S.draft.items.includes(it.id)
    const owned = api.owns(S.n, it.id)
    const locked = (it.minStars ?? 0) > e.stars
    const need = !inUse && (e.needNext ?? []).some((nd) => !nd.ok && nd.items.includes(it.id))
    const afford = owned || it.price + cost() <= bank.money
    const badge = need || it.pts === 0
      ? `<span class="tag money">+$${it.nightly}${MOON}</span>`
      : `<span class="tag stars">${'★'.repeat(it.pts)}</span>`
    const price = inUse ? '<span class="pr use">IN USE</span>' : owned ? '<span class="pr own">OWNED</span>' : `<span class="pr${afford ? '' : ' poor'}">${COIN}${it.price.toLocaleString('en-US')}</span>`
    return `<button class="df-card item${inUse ? ' use' : ''}${locked ? ' locked' : ''}${need ? ' need' : ''}" data-card="${it.id}" data-kind="item">
      ${price}${badge}${need ? '<span class="bang">!</span>' : ''}
      <img data-thumb="${it.id}" alt="">
      <span class="nm">${esc(it.name)}</span>${it.sub ? `<span class="sub">${esc(it.sub)}</span>` : ''}
      ${locked ? `<span class="lk">${ICON.lock}★${it.minStars} ROOM</span>` : ''}</button>`
  }
  function surfaceCard(kind, s, e) {
    const inUse = (kind === 'wall' ? S.draft.wall : S.draft.floor) === s.id
    const owned = kind === 'wall' ? api.ownsWall(s.id) : api.ownsFloor(s.id)
    const locked = (s.minStars ?? 0) > e.stars
    const match = s.tones.some((t) => e.tones.includes(t))
    const afford = owned || s.price + cost() <= bank.money
    const sw = kind === 'wall' ? wallSwatch(s) : floorSwatch(s)
    return `<button class="df-card surf${inUse ? ' use' : ''}${locked ? ' locked' : ''}" data-card="${s.id}" data-kind="${kind}">
      <span class="sw" style="background-image:url(${sw})"></span>
      ${inUse ? '<span class="inuse">IN USE</span>' : ''}${match ? '<span class="match">MATCH</span>' : ''}
      <span class="nm">${esc(s.name)}</span>
      <span class="pr${owned ? ' own' : afford ? '' : ' poor'}">${owned ? 'OWNED' : `${COIN}${s.price}`}</span>
      <span class="sty">+${s.style} LOOKS</span>
      ${locked ? `<span class="lk">${ICON.lock}★${s.minStars} ROOM</span>` : ''}</button>`
  }
  function renderGrid(anim = false) {
    const e = S.lastEval ?? evalDraft()
    let html
    if (S.tab === 'items') {
      const cat = CATEGORIES.find((c) => c.id === S.cat)
      ui.head.textContent = cat.name
      const order = CATEGORIES.map((c) => c.id)
      const needed = (it) => ((e.needNext ?? []).some((nd) => !nd.ok && nd.items.includes(it.id)) ? 0 : 1)
      const list = ITEMS.filter((i) => S.cat === 'all' || i.cat === S.cat).slice().sort((a, b) => needed(a) - needed(b) || order.indexOf(a.cat) - order.indexOf(b.cat) || a.price - b.price)
      html = list.map((it) => itemCard(it, e)).join('')
    } else if (S.tab === 'walls') {
      ui.head.textContent = 'WALLS · LOOKS'
      html = WALLS.map((w) => surfaceCard('wall', w, e)).join('')
    } else {
      ui.head.textContent = 'FLOOR · LOOKS'
      html = FLOORS.map((f) => surfaceCard('floor', f, e)).join('')
    }
    const scroll = ui.grid.scrollTop
    ui.grid.innerHTML = html
    ui.grid.classList.toggle('three', S.tab !== 'items')
    fillThumbs(ui.grid)
    if (anim) {
      ui.grid.scrollTop = 0
      ui.grid.querySelectorAll('.df-card').forEach((c, i) => {
        c.style.animationDelay = `${Math.min(i, 12) * 25}ms`
        c.classList.add('in')
      })
    } else ui.grid.scrollTop = scroll
  }

  // --- Open / close -----------------------------------------------------------------------------------------
  function open(n) {
    if (S.open || S.closing) return false
    const room = rooms.get(n)
    if (!room) return false
    if (!root) build()
    layoutMode()
    S.open = true
    S.n = n
    S.room = room
    S.base = api.committed(n)
    S.draft = { ...S.base, items: [...S.base.items] }
    S.undo = []
    S.redo = []
    S.lastEval = null
    S.celebrating = 0
    hintFlash = 0
    S.view = '3d'
    root.classList.remove('top', 'collapsed')
    S.collapsed = false
    root.querySelector('.df-rb.view span').textContent = 'TOP'
    // Orbit starts from where the player looks, swinging round to the front-ish 3/4 view.
    S.yaw = S.yawT = 0.35
    S.pitch = S.pitchT = 0.95
    S.dist = S.distT = 11
    saved.pos.copy(camera.position)
    saved.quat.copy(camera.quaternion)
    S.tween = 0
    target.set(room.centre.x, 0.9, room.centre.z)
    document.exitPointerLock?.()
    for (const k of Object.keys(inputState.move)) inputState.move[k] = 0
    if (playerGroup) {
      wasVisible = playerGroup.visible
      playerGroup.visible = false
    }
    renderer.clippingPlanes = [clip]
    if (!lightsAdded) {
      room.group.parent.add(lights.hemi, lights.point)
      lightsAdded = true
    }
    lights.point.position.set(room.centre.x, 3.0, room.centre.z)
    document.body.classList.add('df-furnishing')
    root.classList.add('on')
    root.dataset.tab = S.tab
    warmThumbs([...CATEGORIES.map((c) => c.icon), ...ITEMS.map((i) => i.id)])
    renderAll()
    renderGrid(true)
    decorSfx('open')
    return true
  }
  function close(committed = false, cancelled = false) {
    if (!S.open) return
    S.open = false
    S.closing = true
    root.classList.remove('on')
    root.classList.add('leaving')
    if (!committed && !cancelled) S.room.apply(S.base, false)
    if (!cancelled) decorSfx('close')
    camera.clearViewOffset()
  }
  function finishClose() {
    S.closing = false
    root.classList.remove('leaving')
    renderer.clippingPlanes = []
    if (playerGroup) playerGroup.visible = wasVisible // hidden again in first person
    document.body.classList.remove('df-furnishing')
    lights.hemi.intensity = 0
    lights.point.intensity = 0
    camera.clearViewOffset()
  }

  // --- Per frame (after the chase camera has placed the camera) --------------------------------------------
  let refreshT = 0
  function update(dt) {
    if (!S.open && !S.closing) return
    if (S.celebrating > 0) S.celebrating -= dt
    if (hintFlash > 0) {
      hintFlash -= dt
      if (hintFlash <= 0) renderHint()
    }
    // Keep the player still while the editor is up.
    if (S.open) {
      inputState.move.x = inputState.move.z = 0
      inputState.jump = false
      refreshT -= dt
      if (refreshT <= 0) {
        refreshT = 0.5
        renderMoney()
      }
    }
    S.tween = Math.max(0, Math.min(1, S.tween + (S.open ? dt : -dt * 1.25) / TWEEN))
    const k = ease(S.tween)
    // Orbit pose.
    const sm = 1 - Math.pow(0.0001, dt)
    S.yaw += (S.yawT - S.yaw) * sm
    S.pitch += (S.pitchT - S.pitch) * sm
    S.dist += (S.distT - S.dist) * sm
    const cp = Math.cos(S.pitch)
    pose.pos.set(target.x + Math.sin(S.yaw) * cp * S.dist, target.y + Math.sin(S.pitch) * S.dist, target.z + Math.cos(S.yaw) * cp * S.dist)
    m4.lookAt(pose.pos, target, tmpV.set(0, 1, 0))
    pose.quat.setFromRotationMatrix(m4)
    if (S.open) {
      camera.position.lerpVectors(saved.pos, pose.pos, k)
      camera.quaternion.slerpQuaternions(saved.quat, pose.quat, k)
    } else {
      // Closing: blend from the editor view back to wherever the chase cam is now.
      tmpQ.copy(camera.quaternion)
      tmpV.copy(camera.position)
      camera.position.lerpVectors(tmpV, pose.pos, k)
      camera.quaternion.slerpQuaternions(tmpQ, pose.quat, k)
    }
    camera.updateMatrixWorld()
    // Roof lifts away, fill light comes up, the view slides clear of the panel.
    clip.constant = CLIP_Y + (1 - k) * 30
    lights.hemi.intensity = k * 0.9
    lights.point.intensity = k * 8
    if (S.open && root) {
      const portrait = root.dataset.mode === 'portrait'
      const pr = S.collapsed ? null : ui.panel.getBoundingClientRect()
      const w = window.innerWidth
      const h = window.innerHeight
      const ox = pr && !portrait ? (pr.width * k) / 2 : 0
      const oy = pr && portrait ? ((h - pr.top) * k) / 2 : 0
      camera.setViewOffset(w, h, ox, oy, w, h)
    }
    if (!S.open && S.tween <= 0) finishClose()
  }

  // --- In-room bar (outside the editor) ---------------------------------------------------------------------
  let hudEl = null
  let hudKey = ''
  function roomHud(n) {
    if (!hudEl) {
      hudEl = el('div', 'df-roomhud')
      hudEl.innerHTML = '<div class="df-bar compact"></div><button class="df-furnish"><i></i><span>FURNISH</span><kbd>F</kbd></button>'
      document.body.appendChild(hudEl)
      hudEl.querySelector('.df-furnish i').innerHTML = ICON.items
      hudEl.querySelector('.df-furnish').addEventListener('pointerdown', (e) => {
        e.preventDefault()
        e.stopPropagation()
        if (hudEl.dataset.n) open(Number(hudEl.dataset.n))
      })
    }
    const show = n != null && !S.open && !S.closing
    hudEl.classList.toggle('on', show)
    document.body.classList.toggle('df-inroom', show)
    if (!show) return
    const e = api.evalRoom(n)
    const key = `${n}|${e.stars}|${e.style}|${e.items.join()}|${api.priceOf(n)}`
    if (key === hudKey) return
    hudKey = key
    hudEl.dataset.n = n
    S.lastEval = null
    hudEl.querySelector('.df-bar').innerHTML = barHtml(n, e, { compact: true })
    fillThumbs(hudEl)
  }

  return { open, close: () => (S.open ? cancel() : null), isOpen: () => S.open || S.closing, room: () => (S.open ? S.n : null), update, roomHud }
}
