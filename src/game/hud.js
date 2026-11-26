// The gameplay HUD (DOM): objective bar, bus / clean-sets / rating pills, the
// big centre announcements, the junk-yard progress bar, the in-room panel with
// the FURNISH button and menu, the tool hotbar with the action prompt (tap or
// hold it on touch), floating "+$" texts, speech bubbles and toasts.
import './hud.css'
import { Vector3 } from 'three'

const ICON = {
  bag: '<svg viewBox="0 0 64 64"><path d="M14 22h36l-4 34H18z" fill="#3fb3a0" stroke="#125a52" stroke-width="3"/><path d="M22 14c3-6 17-6 20 0" fill="none" stroke="#125a52" stroke-width="3"/><circle cx="40" cy="20" r="7" fill="#e2382a"/><path d="M18 26c6 6 14 4 18-2" fill="#f6d33c"/></svg>',
  sponge: '<svg viewBox="0 0 64 64"><path d="M10 26c0-8 8-12 22-12s22 4 22 12v12c0 8-8 12-22 12S10 46 10 38z" fill="#f6c232" stroke="#b07a00" stroke-width="3"/><circle cx="22" cy="28" r="3" fill="#d99a10"/><circle cx="36" cy="34" r="3.5" fill="#d99a10"/><circle cx="46" cy="26" r="2.5" fill="#d99a10"/></svg>',
  hands: '<svg viewBox="0 0 64 64"><path d="M20 58c-6-6-10-14-10-20l4-4 6 6V12a4 4 0 0 1 8 0v18-24a4 4 0 0 1 8 0v24-20a4 4 0 0 1 8 0v22-14a4 4 0 0 1 8 0v26c0 10-6 18-14 18z" fill="#f6c232" stroke="#b07a00" stroke-width="3" stroke-linejoin="round"/></svg>',
}

function el(tag, cls, html = '') {
  const e = document.createElement(tag)
  if (cls) e.className = cls
  e.innerHTML = html
  return e
}

export function createHud({ onAction, onHold, onFurnish }) {
  const root = el('div', 'mh')
  document.body.appendChild(root)

  // Objective.
  const obj = el('div', 'mh-obj', '<div class="ico">🛋️</div><div class="txt"></div><div class="bar"><i></i></div>')
  root.appendChild(obj)
  const objTxt = obj.querySelector('.txt')
  const objIco = obj.querySelector('.ico')
  const objBar = obj.querySelector('.bar i')

  // Pills.
  const pills = el('div', 'mh-pills')
  const bus = el('div', 'mh-pill', '<span class="v">BUS IN 1:00</span>')
  const sets = el('div', 'mh-pill', '<span>🧺</span><span class="v">6</span><small>CLEAN SETS</small>')
  const rating = el('div', 'mh-pill', '<span class="star">★</span><span class="v">3.8</span><span class="lbl">MOTEL</span>')
  const appeal = el('div', 'mh-pill', '<span>✨</span><span class="v">100%</span><small>CURB APPEAL</small>')
  const cash = el('div', 'mh-pill cash', '<span>💵</span><span class="v">$0</span><small>ON COUNTER</small>')
  pills.append(bus, sets, appeal, cash, rating)

  // In-room cleaning checklist (left side).
  const check = el('div', 'mh-check', '<h4></h4><div class="pct"><i></i><b></b></div><ul></ul>')
  root.appendChild(check)
  let lastCheck = ''
  root.appendChild(pills)

  // Announcement.
  const ann = el('div', 'mh-ann', '<b></b><span></span>')
  root.appendChild(ann)
  let annTimer = 0

  // Junk yard bar.
  const yard = el('div', 'mh-yard', '<div class="track"><div class="fill"></div><div class="t"></div></div><div class="h"></div>')
  root.appendChild(yard)

  // Room panel + furnish button.
  const room = el('div', 'mh-room', '<div class="bed">🛏️</div><div class="col"><div class="badge"></div><div class="price"></div></div><div class="col"><div class="next"></div><div class="stars"></div></div><div class="item"><div class="i"></div><div class="plus"></div></div>')
  root.appendChild(room)
  const furnish = el('div', 'mh-furnish tap', '🛋️ FURNISH <kbd>F</kbd>')
  furnish.addEventListener('pointerdown', (e) => {
    e.preventDefault()
    e.stopPropagation()
    onFurnish()
  })
  root.appendChild(furnish)

  // Bottom: prompt + hotbar.
  const bottom = el('div', 'mh-bottom')
  const prompt = el('div', 'mh-prompt tap', '<kbd>E</kbd><span class="t"></span><div class="hold"></div>')
  const promptT = prompt.querySelector('.t')
  const promptHold = prompt.querySelector('.hold')
  prompt.addEventListener('pointerdown', (e) => {
    e.preventDefault()
    e.stopPropagation()
    onAction()
    onHold(true)
  })
  const release = () => onHold(false)
  prompt.addEventListener('pointerup', release)
  prompt.addEventListener('pointercancel', release)
  prompt.addEventListener('pointerleave', release)
  bottom.append(prompt)
  root.appendChild(bottom)

  // Floaters, bubbles, toast, menu.
  const layer = el('div', '')
  layer.style.cssText = 'position:absolute;inset:0;overflow:hidden'
  root.appendChild(layer)
  const toast = el('div', 'mh-toast')
  root.appendChild(toast)
  let toastTimer = 0
  const menu = el('div', 'mh-menu')
  root.appendChild(menu)
  menu.addEventListener('pointerdown', (e) => {
    if (e.target === menu) closeMenu()
  })
  function closeMenu() {
    menu.classList.remove('on')
  }

  let placeT = 0
  const floaters = [] // { el, pos, age }
  const bubbles = new Map() // id -> { el, getPos }
  const v = new Vector3()
  let lastBus = ''

  return {
    setObjective(text, progress = 0, icon = '🛋️') {
      if (objTxt.textContent !== text) objTxt.textContent = text
      objIco.textContent = icon
      objBar.style.width = `${Math.round(Math.max(0, Math.min(1, progress)) * 100)}%`
    },
    setPills({ busText, busHot, cleanSets, motelRating, curb = 100, curbWarn = false, curbBad = false, counter = 0 }) {
      appeal.querySelector('.v').textContent = `${curb}%`
      appeal.classList.toggle('warn', curbWarn && !curbBad)
      appeal.classList.toggle('bad', curbBad)
      cash.style.display = counter > 0 ? '' : 'none'
      cash.querySelector('.v').textContent = `$${counter}`
      if (busText !== lastBus) {
        bus.querySelector('.v').textContent = busText
        lastBus = busText
      }
      bus.classList.toggle('hot', !!busHot)
      sets.querySelector('.v').textContent = String(cleanSets)
      rating.querySelector('.v').textContent = motelRating.toFixed(1)
    },
    announce(title, sub = '', seconds = 3.2) {
      ann.querySelector('b').textContent = title
      ann.querySelector('span').textContent = sub
      ann.classList.remove('on')
      void ann.offsetWidth
      ann.classList.add('on')
      annTimer = seconds
    },
    setYard(show, pct = 0, hint = '') {
      yard.classList.toggle('on', show)
      if (!show) return
      yard.querySelector('.fill').style.width = `${Math.round(pct * 100)}%`
      yard.querySelector('.t').textContent = `DUMPSTER · ${Math.round(pct * 100)}%`
      yard.querySelector('.h').textContent = hint
    },
    // info = null | { typeName, price, nextLabel, stars, item: { icon, nightly } | null }
    setRoom(info) {
      const on = !!info
      room.classList.toggle('on', on)
      furnish.classList.toggle('on', on)
      obj.classList.toggle('below-room', on)
      ann.classList.toggle('below-room', on)
      check.classList.toggle('below-room', on)
      if (!on) return
      room.querySelector('.badge').textContent = info.typeName
      room.querySelector('.price').textContent = `$${info.price} / night`
      room.querySelector('.next').textContent = info.nextLabel
      room.querySelector('.stars').innerHTML = '<b>' + '★'.repeat(info.stars) + '</b>' + '★'.repeat(Math.max(0, 5 - info.stars))
      const item = room.querySelector('.item')
      item.style.display = info.item ? '' : 'none'
      if (info.item) {
        item.querySelector('.i').textContent = info.item.icon
        item.querySelector('.plus').textContent = `+$${info.item.nightly} / night`
      }
    },
    // title + pct + rows [{ icon, label, done, total, key }] | rows null hides it
    setChecklist(title, pct, rows) {
      check.classList.toggle('on', !!rows)
      if (!rows) return
      const sig = title + pct + JSON.stringify(rows)
      if (sig === lastCheck) return
      lastCheck = sig
      check.querySelector('h4').textContent = title
      check.querySelector('.pct i').style.width = `${Math.round(pct * 100)}%`
      check.querySelector('.pct b').textContent = `${Math.round(pct * 100)}% CLEAN`
      check.querySelector('ul').innerHTML = rows
        .map((r) => `<li class="${r.done >= r.total ? 'ok' : ''}"><span class="i">${r.done >= r.total ? '✅' : r.icon}</span><span class="l">${r.label}${r.total > 1 ? ` ${r.done}/${r.total}` : ''}</span>${r.key && r.done < r.total ? `<kbd>${r.key}</kbd>` : ''}</li>`)
        .join('')
    },
    // A world-space tag over a room door: info = { pct (0..1), text, done } | null.
    roomTag(id, getPos, info) {
      const key = `tag:${id}`
      let b = bubbles.get(key)
      if (!info) {
        if (b) {
          b.el.remove()
          bubbles.delete(key)
        }
        return
      }
      if (!b) {
        b = { el: el('div', 'mh-tag', '<b></b><div class="bar"><i></i></div>'), getPos }
        layer.appendChild(b.el)
        bubbles.set(key, b)
      }
      b.getPos = getPos
      b.el.classList.toggle('done', !!info.done)
      const t = b.el.querySelector('b')
      if (t.textContent !== info.text) t.textContent = info.text
      b.el.querySelector('.bar i').style.width = `${Math.round(info.pct * 100)}%`
    },
    // p = null | { text, hold (0..1), warn }
    setPrompt(p) {
      prompt.classList.toggle('on', !!p)
      if (!p) return
      if (promptT.textContent !== p.text) promptT.textContent = p.text
      prompt.classList.toggle('warn', !!p.warn)
      promptHold.style.width = `${Math.round((p.hold ?? 0) * 100)}%`
    },
    float(pos, text, color) {
      const e = el('div', 'mh-float', text)
      if (color) e.style.color = color
      layer.appendChild(e)
      floaters.push({ el: e, pos: pos.clone ? pos.clone() : new Vector3(pos.x, pos.y, pos.z), age: 0 })
    },
    bubble(id, getPos, text, cls = '') {
      let b = bubbles.get(id)
      if (!text) {
        if (b) {
          b.el.remove()
          bubbles.delete(id)
        }
        return
      }
      if (!b) {
        b = { el: el('div', 'mh-bubble'), getPos }
        layer.appendChild(b.el)
        bubbles.set(id, b)
      }
      b.getPos = getPos ?? b.getPos
      b.el.className = `mh-bubble ${cls}`
      if (b.el.textContent !== text) b.el.textContent = text
    },
    toast(text) {
      toast.textContent = text
      toast.classList.add('on')
      toastTimer = 2
    },
    // items: [{ id, icon, name, sub, price, owned, afford }]
    openMenu(title, sub, items, onBuy) {
      menu.innerHTML = ''
      const card = el('div', 'card', `<h2>${title}</h2><p>${sub}</p>`)
      const grid = el('div', 'grid')
      for (const it of items) {
        const c = el('div', `it${it.owned ? ' own' : ''}`, `<div class="i">${it.icon}</div><div class="n">${it.name}</div><div class="s">${it.sub}</div>`)
        const b = el('button', '', it.owned ? 'OWNED' : `$${it.price}`)
        b.disabled = it.owned || !it.afford
        b.addEventListener('click', () => onBuy(it.id))
        c.appendChild(b)
        grid.appendChild(c)
      }
      const close = el('button', 'close', 'CLOSE')
      close.addEventListener('click', closeMenu)
      card.append(grid, close)
      menu.appendChild(card)
      menu.classList.add('on')
    },
    closeMenu,
    menuOpen: () => menu.classList.contains('on'),
    update(dt, camera) {
      // Keep the action prompt just above the tool hotbar, wherever its layout puts it.
      placeT -= dt
      if (placeT <= 0) {
        placeT = 0.5
        const hb = document.querySelector('.hotbar')
        const r = hb?.getBoundingClientRect()
        if (r && r.height) bottom.style.bottom = `${Math.round(window.innerHeight - r.top + 10)}px`
      }
      if (annTimer > 0) {
        annTimer -= dt
        if (annTimer <= 0) ann.classList.remove('on')
      }
      if (toastTimer > 0) {
        toastTimer -= dt
        if (toastTimer <= 0) toast.classList.remove('on')
      }
      const w = window.innerWidth
      const h = window.innerHeight
      for (let i = floaters.length - 1; i >= 0; i--) {
        const f = floaters[i]
        f.age += dt
        if (f.age > 1.4) {
          f.el.remove()
          floaters.splice(i, 1)
          continue
        }
        v.copy(f.pos).project(camera)
        f.el.style.left = `${(v.x * 0.5 + 0.5) * w}px`
        f.el.style.top = `${(-v.y * 0.5 + 0.5) * h}px`
        f.el.style.display = v.z < 1 ? '' : 'none'
      }
      for (const b of bubbles.values()) {
        const p = b.getPos()
        const far = camera.position.distanceTo(v.set(p.x, p.y, p.z)) > 32
        v.project(camera)
        const vis = !far && v.z < 1 && Math.abs(v.x) < 1.1 && Math.abs(v.y) < 1.1
        b.el.style.display = vis ? '' : 'none'
        if (vis) {
          b.el.style.left = `${(v.x * 0.5 + 0.5) * w}px`
          b.el.style.top = `${(-v.y * 0.5 + 0.5) * h}px`
        }
      }
    },
  }
}
