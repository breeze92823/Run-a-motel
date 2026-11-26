// The Upgrades, Hiring and Shop windows. One modal layer holds whichever is open; every button
// buys through economy.js and the rows refresh in place on every economy change (and once a
// second while open, for the timers). Layout/scale: layout() sets --u and data-mode.
import { economy } from '../economy.js'
import { LOCK_TEXT, SHOP, SHOP_SECTIONS, STAFF, UPGRADE_TABS, UPGRADES } from '../catalog.js'
import { art, GIFT_ART } from './art.js'
import { sfx } from '../audio.js'
import { coinBurst, confetti, counter, floatText, money, pulse } from './fx.js'
import { adsAvailable, showRewarded } from '../bloxity.js'
import { claimAdReward, franchiseAndReload } from '../net.js'
import { AD_REWARD } from '../catalog.js'

const TAB_ART = { coffee: 'tabCoffee', rooms: 'tabRooms', ads: 'tabAds' }
const TITLES = { upgrades: 'UPGRADES', hiring: 'HIRING', shop: 'SHOP' }

function h(tag, cls = '', html = '') {
  const el = document.createElement(tag)
  if (cls) el.className = cls
  if (html) el.innerHTML = html
  return el
}
const icon = (id, tag = 'i') => `<${tag}>${art(id)}</${tag}>`
const clock = (s) => {
  s = Math.ceil(s)
  const m = Math.floor(s / 60)
  return m >= 60 ? `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}` : `${m}:${String(s % 60).padStart(2, '0')}`
}
// Font size (u) that fits `label` into `avail` u of button width (Fredoka is ~0.56em a char).
// Capitals and digits are wider than lower case.
const ems = (text) => [...text].reduce((w, c) => w + (/[A-Z0-9$]/.test(c) ? 0.64 : c === ' ' ? 0.28 : 0.52), 0)
function fit(label, base, avail) {
  return Math.max(16, Math.min(base, Math.floor(avail / Math.max(1, ems(label)))))
}
// Splits a lock text over two balanced lines (one line if it is short).
function twoLines(text) {
  const words = text.split(' ')
  if (text.length <= 10 || words.length < 2) return [text]
  let best = [text]
  let bestLen = Infinity
  for (let i = 1; i < words.length; i++) {
    const a = words.slice(0, i).join(' ')
    const b = words.slice(i).join(' ')
    const len = Math.max(a.length, b.length)
    if (len < bestLen) [best, bestLen] = [[a, b], len]
  }
  return best
}

// The text a locked item shows: the first requirement still missing.
function lockText(lock) {
  if (lock.comfort && economy.comfortRooms() < lock.comfort) return LOCK_TEXT.comfort(lock.comfort)
  if (lock.rooms && economy.openRooms().length < lock.rooms) return LOCK_TEXT.rooms(lock.rooms)
  if (lock.pool && !economy.has('pool')) return LOCK_TEXT.pool
  if (lock.owns && !economy.has(lock.owns)) return LOCK_TEXT.owns[lock.owns] ?? `after the ${lock.owns}`
  return ''
}

// --- Buttons --------------------------------------------------------------------------
// state: { kind: 'buy'|'have'|'lock'|'short'|'wait'|'collect', label, price, base, chars }
function paintButton(btn, st, { base = 44, avail = 206 } = {}) {
  // A "$X more" button also changes with the money, so that is part of its key.
  const key = JSON.stringify(st) + (st.kind === 'short' ? economy.money : '')
  if (btn._key === key) return
  btn._key = key
  btn.className = `mw-btn ${st.kind}${btn.classList.contains('mw-act') ? ' mw-act' : ''}`
  if (st.kind === 'lock') {
    const lines = twoLines(st.label)
    const size = Math.min(...lines.map((l) => fit(l, 34, avail * 0.74)))
    btn.innerHTML = `<i class="mw-padlock">${art('lock')}</i><span style="font-size:calc(var(--u) * ${size}px)">${lines.join('<br>')}</span>`
  } else if (st.kind === 'short') {
    const pct = Math.max(4, Math.min(100, (economy.money / st.price) * 100))
    const label = `${money(st.price - economy.money)} more`
    btn.innerHTML = `<span style="font-size:calc(var(--u) * ${fit(label, base, avail)}px)">${label}</span><div class="mw-bar"><i style="width:${pct}%"></i></div>`
  } else {
    btn.innerHTML = `<span style="font-size:calc(var(--u) * ${fit(st.label, base, avail)}px)">${st.label}</span>`
  }
}
const priced = (label, price) => (economy.canAfford(price) ? { kind: 'buy', label: label ? `${label} ${money(price)}` : `BUY ${money(price)}`, price } : { kind: 'short', price })

export function createWindows({ reservedTop = () => 0 } = {}) {
  const layer = h('div', 'mw-layer')
  layer.innerHTML = '<div class="mw-backdrop"></div><div class="mw-stage"></div>'
  document.body.appendChild(layer)
  const stage = layer.querySelector('.mw-stage')
  layer.querySelector('.mw-backdrop').addEventListener('pointerdown', () => api.close())

  let kind = null
  let tab = 'coffee'
  let updaters = []
  let win = null
  let moneyPill = null
  let moneyCounter = null
  let timer = 0
  let closeTimer = 0
  let goalId = ''

  // --- layout ---------------------------------------------------------------------
  function layout() {
    const vv = window.visualViewport
    const w = vv?.width ?? window.innerWidth
    const hgt = vv?.height ?? window.innerHeight
    let mode
    let u
    if (w < hgt * 0.95 && w < 960) {
      mode = 'portrait'
      u = Math.min(w / 740, hgt / 1250)
    } else if (hgt < 600 || w < 1100) {
      mode = 'compact'
      u = Math.min(w / 1440, hgt / 640)
    } else {
      mode = 'wide'
      u = Math.min(w / 1920, hgt / 991) // 1u = 1px of the reference screenshots

    }
    layer.dataset.mode = mode
    layer.style.setProperty('--u', u.toFixed(4))
    const top = Math.max((mode === 'wide' ? 150 : 64) * u, reservedTop() + 4)
    stage.style.paddingTop = `max(env(safe-area-inset-top), ${top}px)`
    if (!win) return
    const baseW = kind === 'shop' ? 1340 : 1320
    if (mode === 'portrait') {
      win.style.setProperty('--mw-w', `${w - 24}px`)
      win.style.setProperty('--mw-h', `${Math.min(1250 * u, hgt - top - 16)}px`)
    } else {
      win.style.setProperty('--mw-w', `${baseW * u}px`)
      win.style.setProperty('--mw-h', `${Math.min(790 * u, hgt - top - 14)}px`)
    }
  }
  window.addEventListener('resize', layout)
  window.visualViewport?.addEventListener('resize', layout)

  // --- shell ------------------------------------------------------------------------
  function shell(title, cls) {
    const el = h('section', `mw-win ${cls}`)
    el.innerHTML = `
      <div class="mw-frame"><div class="mw-panel"></div></div>
      <div class="mw-ribbon"><i class="mw-spark l">${art('sparkle')}</i><span>${title}</span><i class="mw-spark r">${art('sparkle')}</i></div>
      <div class="mw-money"><i class="mw-coin">${art('coin')}</i><b></b></div>
      <button class="mw-close" aria-label="Close"></button>`
    el.querySelector('.mw-close').addEventListener('click', () => api.close())
    moneyPill = el.querySelector('.mw-money')
    moneyCounter = counter(moneyPill.querySelector('b'), economy.money)
    return el
  }
  function header(text) {
    const el = h('header', 'mw-head anim', `${icon('sparkle')}<h2>${text}</h2>${icon('sparkle')}`)
    return el
  }

  // --- purchase feedback --------------------------------------------------------------
  function feedback(res, row, btn, { big = false, price = 0 } = {}) {
    if (res.ok) {
      sfx(big ? 'hire' : 'buy')
      pulse(row, 'flash')
      pulse(btn, 'bought')
      if (moneyPill && price > 0) {
        coinBurst(moneyPill, btn, { count: Math.min(10, 4 + Math.floor(Math.log10(price + 1) * 2)) })
        floatText(moneyPill, `-${money(price)}`, true)
      }
      if (big) confetti(btn, 26)
    } else if (res.reason === 'money') {
      sfx('fail')
      pulse(row, 'shake')
      pulse(moneyPill, 'short')
    } else if (res.reason === 'locked') {
      sfx('locked')
      pulse(btn.querySelector('.mw-padlock'), 'wiggle')
    } else sfx('tap')
    refresh()
  }

  // --- Upgrades -------------------------------------------------------------------------
  function upgradeRow(item, i) {
    const row = h('div', 'mw-row')
    row.style.setProperty('--i', i)
    row.innerHTML = `<div class="mw-art">${art(item.art)}</div><div class="mw-info"><h3>${item.name}</h3><p>${item.desc}</p></div><div class="mw-sep"></div>`
    const info = row.querySelector('.mw-info')
    const chip = h('span', 'mw-chip')
    const btn = h('button', 'mw-btn')
    btn.style.setProperty('--i', i)
    row.appendChild(btn)
    btn.addEventListener('click', () => {
      const price = economy.upgradePrice(item.id)
      if (btn.classList.contains('have') || btn.classList.contains('wait')) return sfx('tap')
      feedback(economy.buyUpgrade(item.id), row, btn, { price, big: item.kind === 'once' && price >= 900 })
    })
    const update = () => {
      const locked = !economy.isUnlocked(item.lock)
      const owned = item.kind === 'once' && economy.has(item.id)
      row.classList.toggle('locked', locked && !owned)
      row.classList.toggle('owned', owned)
      let st
      if (owned) st = { kind: 'have', label: 'YOU HAVE IT' }
      else if (locked) st = { kind: 'lock', label: lockText(item.lock) }
      else if (economy.upgradeMaxed(item.id)) st = { kind: 'have', label: 'ALL OPEN' }
      else st = priced('', economy.upgradePrice(item.id))
      paintButton(btn, st)
      const left = item.kind === 'boost' ? economy.boostLeft(item.id) : 0
      if (left > 0) {
        chip.textContent = `ACTIVE ${clock(left)}`
        if (!chip.isConnected) info.appendChild(chip)
      } else chip.remove()
      if (item.id === 'nextRoom' && economy.repeats('nextRoom') > 0 && !chip.isConnected) {
        chip.textContent = `${economy.openRooms().length} ROOMS OPEN`
        info.appendChild(chip)
      }
    }
    updaters.push(update)
    update()
    return row
  }

  function nextCards(side) {
    const goal = economy.nextGoal()
    const then = economy.thenGoal()
    if (side) {
      const wrap = h('aside', 'mw-side')
      const card = h('div', 'mw-next')
      card.innerHTML = `<div class="mw-ribbon small"><i class="mw-spark l">${art('sparkle')}</i><span>NEXT</span><i class="mw-spark r">${art('sparkle')}</i></div>
        <div class="mw-medal">${art(goal.art)}</div><h4 style="font-size:calc(var(--u) * ${fit(goal.title, 31, 250)}px)">${goal.title}</h4><p class="sub">${goal.sub}</p><p class="hint">${goal.hint}</p>
        <div class="mw-prog"><i></i></div>`
      const thenCard = h('div', 'mw-then', `<i>${art('mystery')}</i><b>THEN...</b>`)
      if (!then) thenCard.style.visibility = 'hidden'
      wrap.append(card, thenCard)
      wireGoal(card, goal)
      return wrap
    }
    const row = h('div', 'mw-next-row')
    row.innerHTML = `<span class="tag">NEXT</span><i>${art(goal.art)}</i><div class="txt"><h4>${goal.title}</h4><p class="hint">${goal.hint}</p><div class="mw-prog"><i></i></div></div>`
    wireGoal(row, goal)
    return row
  }
  // The goal's progress bar and action button. The button always acts on the CURRENT goal
  // (its next piece of furniture changes after every buy); the card is re-rendered when the
  // goal itself moves on (refreshGoal).
  function wireGoal(card, goal) {
    const bar = card.querySelector('.mw-prog i')
    requestAnimationFrame(() => (bar.style.width = `${Math.round(goal.progress * 100)}%`))
    goalId = goal.id
    const btn = h('button', 'mw-btn mw-act')
    card.appendChild(btn)
    btn.addEventListener('click', () => {
      const g = economy.nextGoal()
      if (!g.action) return sfx('tap')
      if (g.action.kind === 'franchise') return franchiseClick(g, card, btn)
      const price = g.action.price
      if (!economy.canAfford(price)) return feedback({ ok: false, reason: 'money' }, card, btn)
      const ok = g.action.run()
      feedback({ ok, reason: ok ? '' : 'money' }, card, btn, { price })
    })
    const update = () => {
      if (btn._hold) return // the franchise button is asking / saving
      const g = economy.nextGoal()
      btn.style.display = g.action ? '' : 'none'
      if (g.action) paintButton(btn, g.action.price > 0 ? priced(g.action.label, g.action.price) : { kind: 'buy', label: g.action.label }, { base: 30, avail: 230 })
    }
    updaters.push(update)
    update()
  }
  // The franchise (rebirth) wipes the motel, so it asks first: tap once to arm, again to sell.
  // The new motel is stored on the server before the page reloads (net.js franchiseAndReload).
  function franchiseClick(g, card, btn) {
    const say = (label, ms) => {
      btn._key = ''
      paintButton(btn, { kind: 'buy', label }, { base: 30, avail: 230 })
      clearTimeout(btn._holdT)
      if (ms) btn._holdT = setTimeout(() => ((btn._hold = false), (btn._key = ''), refresh()), ms)
    }
    if (btn._busy) return
    if (!btn._hold) {
      btn._hold = true
      sfx('tap')
      pulse(btn, 'bought')
      return say(g.action.confirm ?? 'SURE?', 4000)
    }
    btn._busy = true
    say('SAVING…')
    franchiseAndReload().then((res) => {
      btn._busy = false
      if (res.ok) {
        sfx('hire')
        confetti(btn, 40)
        return say('OPENING YOUR NEW MOTEL…')
      }
      sfx('fail')
      pulse(card, 'shake')
      say(res.reason === 'offline' ? 'NOT CONNECTED · TRY AGAIN' : res.reason === 'save' ? 'SIGN IN TO SAVE IT FIRST' : 'NOT READY YET', 3000)
    })
  }
  // Swap in a fresh NEXT card when the goal moved on (with a celebration).
  function refreshGoal() {
    if (kind !== 'upgrades') return
    const goal = economy.nextGoal()
    const oldSide = stage.querySelector('.mw-side')
    const oldRow = win?.querySelector('.mw-next-row')
    if (goal.id === goalId) {
      // Same goal: just move the bar and texts.
      for (const card of [oldSide?.querySelector('.mw-next'), oldRow]) {
        if (!card) continue
        const bar = card.querySelector('.mw-prog i')
        if (bar) bar.style.width = `${Math.round(goal.progress * 100)}%`
        const hint = card.querySelector('.hint')
        if (hint && hint.textContent !== goal.hint) hint.textContent = goal.hint
        const sub = card.querySelector('.sub')
        if (sub && sub.textContent !== goal.sub) sub.textContent = goal.sub
      }
      return
    }
    const prev = goalId
    updaters = updaters.filter((u) => !u._goal)
    const n = updaters.length
    if (oldSide) {
      const side = nextCards(true)
      oldSide.replaceWith(side)
      side.querySelector('.mw-next').classList.add('done')
      if (prev) {
        sfx('goal')
        confetti(side.querySelector('.mw-next'), 40)
      }
    }
    if (oldRow) oldRow.replaceWith(nextCards(false))
    for (let i = n; i < updaters.length; i++) updaters[i]._goal = true
  }

  function renderUpgrades() {
    const panel = win.querySelector('.mw-panel')
    panel.innerHTML = ''
    const tabs = h('nav', 'mw-tabs')
    const body = h('div', 'mw-body')
    for (const key of UPGRADE_TABS) {
      const t = h('button', `mw-tab${key === tab ? ' on' : ''}`, `${icon(TAB_ART[key])}<b>${UPGRADES[key].tab}</b>`)
      t.addEventListener('click', () => {
        if (key === tab) return
        sfx('tab')
        tab = key
        renderUpgrades()
      })
      tabs.appendChild(t)
    }
    const list = h('div', 'mw-list')
    updaters = []
    const n0 = updaters.length
    list.appendChild(nextCards(false))
    for (let i = n0; i < updaters.length; i++) updaters[i]._goal = true
    UPGRADES[tab].items.forEach((item, i) => list.appendChild(upgradeRow(item, i)))
    body.append(header(UPGRADES[tab].title), list)
    panel.append(tabs, body)
    // The big NEXT card beside the window (wide screens).
    stage.querySelector('.mw-side')?.remove()
    const n1 = updaters.length
    stage.appendChild(nextCards(true))
    for (let i = n1; i < updaters.length; i++) updaters[i]._goal = true
  }

  // --- Hiring ------------------------------------------------------------------------------
  function staffRow(st, i) {
    const row = h('div', 'mw-row')
    row.style.setProperty('--i', i)
    const levels = st.levels ?? (st.maxLevel ? st.maxLevel : 0)
    row.classList.add('staff')
    row.innerHTML = `<div class="mw-art">${art(st.art)}</div><div class="mw-info"><h3 style="font-size:calc(var(--u) * ${fit(st.name, 36, 450)}px)">${st.name}</h3><p class="${st.small ? 'small' : ''}">${st.desc}</p></div><div class="mw-sep"></div>`
    const info = row.querySelector('.mw-info')
    let dots = null
    if (levels) {
      dots = h('div', `mw-dots${st.maxLevel ? ' lv' : ''}`, `${'<span></span>'.repeat(levels)}<em></em>`)
      info.appendChild(dots)
    }
    const btn = h('button', 'mw-btn')
    btn.style.setProperty('--i', i)
    row.appendChild(btn)
    btn.addEventListener('click', () => {
      if (btn.classList.contains('have')) return sfx('tap')
      const price = economy.staffPrice(st.id)
      const hiring = economy.staffLevel(st.id) < 0
      feedback(economy.hire(st.id), row, btn, { price, big: hiring })
    })
    let lastLvl = null
    const update = () => {
      const lvl = economy.staffLevel(st.id)
      const hired = lvl >= 0
      const locked = !hired && !economy.isUnlocked(st.lock)
      row.classList.toggle('locked', locked)
      if (dots) {
        const filled = st.maxLevel ? Math.max(0, lvl) : Math.max(0, lvl)
        if (filled !== lastLvl) {
          dots.querySelectorAll('span').forEach((d, k) => d.classList.toggle('on', k < filled))
          dots.querySelector('em').textContent = st.maxLevel ? `Lv ${Math.max(0, lvl)}/${st.maxLevel}` : `Speed ${filled}/${levels}`
          lastLvl = filled
        }
      }
      let s
      if (locked) s = { kind: 'lock', label: lockText(st.lock).toUpperCase().replace('AFTER 1 COMFORT ROOM', 'after 1 Comfort room') }
      else if (economy.staffMaxed(st.id)) s = { kind: 'have', label: st.levels ? 'MAX SPEED' : st.maxLevel ? 'MAX LEVEL' : 'HIRED' }
      else if (hired && !st.levels && !st.maxLevel) s = { kind: 'have', label: 'HIRED' }
      else s = priced(hired ? (st.maxLevel ? 'LV UP' : 'SPEED') : 'HIRE', economy.staffPrice(st.id))
      paintButton(btn, s)
    }
    updaters.push(update)
    update()
    return row
  }
  function renderHiring() {
    const panel = win.querySelector('.mw-panel')
    panel.innerHTML = ''
    const tabs = h('nav', 'mw-tabs', `<button class="mw-tab on">${icon('tabStaff')}<b>STAFF</b></button>`)
    const body = h('div', 'mw-body')
    const list = h('div', 'mw-list')
    updaters = []
    STAFF.forEach((st, i) => list.appendChild(staffRow(st, i)))
    body.append(header('HIRE A HELPER'), list)
    panel.append(tabs, body)
  }

  // --- Shop ------------------------------------------------------------------------------
  function shopCard(it, section, i, col) {
    const cash = section === 'cash' || section === 'empire'
    const card = h('div', `mw-card${section === 'now' ? ' now' : cash ? ' cash' : ''}${it.wide ? ' wide' : ''}${col === 1 ? ' mid' : ''}${section === 'empire' ? ' empire' : ''}`)
    card.style.setProperty('--i', i)
    const title = cash ? money(it.value) : it.name
    const sub = section === 'empire' ? `+ ${it.gifts.length} GIFTS` : cash ? `${it.name}` : it.desc
    card.innerHTML = `${it.ribbon ? `<div class="mw-ribbon-tag"><span>${it.ribbon}</span></div>` : ''}<div class="mw-art">${art(it.art)}</div>
      <div class="mw-info"><h3 style="font-size:calc(var(--u) * ${fit(title, 31, it.wide || section === 'empire' ? 400 : 228)}px)">${title}</h3><p class="${it.small ? 'small' : ''}"${it.small ? '' : ` style="font-size:calc(var(--u) * ${fit(sub, 24, it.wide || section === 'empire' ? 400 : 234)}px)"`}>${sub}</p></div>`
    const info = card.querySelector('.mw-info')
    const btn = h('button', 'mw-btn')
    btn.style.setProperty('--i', i)
    info.appendChild(btn)
    const badge = h('span', 'count')
    if (section === 'empire') {
      const gifts = h('div', 'gifts')
      for (const g of it.gifts) gifts.appendChild(h('div', 'gift', `<i>${art(GIFT_ART[g] ?? g)}</i><b>GIFT</b>`))
      card.appendChild(gifts)
    }
    btn.addEventListener('click', () => {
      if (btn.classList.contains('have') || btn.classList.contains('wait')) return sfx('tap')
      if (btn.classList.contains('collect')) {
        const res = economy.collect(it.id)
        if (res.ok) {
          sfx('coins')
          coinBurst(btn, moneyPill, { count: 12, onLand: (k) => k % 3 === 0 && sfx('coins') })
          floatText(moneyPill, `+${money(res.amount)}`)
          confetti(btn, 30)
          pulse(moneyPill, 'bump')
        }
        return refresh()
      }
      feedback(economy.buyShop(it.id), card, btn, { price: it.price, big: !!(it.gifts || it.once || section === 'forever') })
      if (it.cash && !it.seconds && economy.shopOwned(it.id)) floatText(btn, `+${money(it.cash)}`)
    })
    const update = () => {
      const owned = economy.shopOwned(it.id)
      card.classList.toggle('owned', owned)
      const at = economy.investReadyAt(it.id)
      let st
      if (owned) st = { kind: 'have', label: 'OWNED' }
      else if (it.id === 'magicBed' && !economy.magicBedUseful()) st = { kind: 'have', label: 'ALL ROOMS ★3' }
      else if (at && at > Date.now()) st = { kind: 'wait', label: `READY IN ${clock((at - Date.now()) / 1000)}` }
      else if (at) st = { kind: 'collect', label: `COLLECT ${money(it.value)}` }
      else st = economy.canAfford(it.price) ? { kind: 'buy', label: money(it.price), price: it.price } : { kind: 'short', price: it.price }
      paintButton(btn, st, { base: 30, avail: 186 })
      // Little status badges: charges left, boost time left.
      let text = ''
      if (it.charges && economy.charges(it.id) > 0) text = `${economy.charges(it.id)} LEFT`
      if (it.run && economy.boostLeft(it.id) > 0) text = clock(economy.boostLeft(it.id))
      if (cash && !at && it.seconds) text = `IN ${clock(it.seconds)}`
      if (text) {
        badge.textContent = text
        if (!badge.isConnected) card.appendChild(badge)
      } else badge.remove()
    }
    updaters.push(update)
    update()
    return card
  }
  // Rewarded ad (Boxity runs the ad): AD_REWARD.seconds of 2x income. Shown only inside Boxity
  // while it can serve an ad; granted only once the game server checked Boxity's reward token.
  function adCard(i) {
    const it = AD_REWARD
    const card = h('div', 'mw-card now wide')
    card.style.setProperty('--i', i)
    card.innerHTML = `<div class="mw-ribbon-tag"><span>FREE</span></div><div class="mw-art">${art(it.art)}</div>
      <div class="mw-info"><h3 style="font-size:calc(var(--u) * ${fit(it.name, 31, 400)}px)">${it.name}</h3><p style="font-size:calc(var(--u) * ${fit(it.desc, 24, 400)}px)">${it.desc}</p></div>`
    const btn = h('button', 'mw-btn')
    card.querySelector('.mw-info').appendChild(btn)
    const badge = h('span', 'count')
    let busy = false
    let note = ''
    btn.addEventListener('click', async () => {
      if (busy || economy.boostLeft(it.id) > 0) return sfx('tap')
      busy = true
      note = ''
      update()
      const r = await showRewarded(it.placement)
      const ok = r.status === 'completed' && (await claimAdReward(r.rewardToken, it.placement))
      busy = false
      if (ok) {
        economy.grantAdBoost(it.id, it.seconds)
        sfx('coins')
        confetti(btn, 30)
        pulse(moneyPill, 'bump')
      } else note = 'TRY AGAIN LATER'
      update()
    })
    const update = () => {
      card.style.display = adsAvailable() ? '' : 'none'
      const left = economy.boostLeft(it.id)
      let st
      if (busy) st = { kind: 'wait', label: 'LOADING AD...' }
      else if (left > 0) st = { kind: 'have', label: `2x ACTIVE ${clock(left)}` }
      else st = { kind: 'buy', label: note || '▶ WATCH AD' }
      paintButton(btn, st, { base: 30, avail: 186 })
      if (left > 0) {
        badge.textContent = clock(left)
        if (!badge.isConnected) card.appendChild(badge)
      } else badge.remove()
    }
    updaters.push(update)
    update()
    return card
  }

  function renderShop() {
    const panel = win.querySelector('.mw-panel')
    panel.innerHTML = ''
    const list = h('div', 'mw-list')
    updaters = []
    let i = 0
    {
      const grid = h('div', 'mw-grid two')
      grid.appendChild(adCard(i++))
      list.appendChild(grid)
    }
    for (const sec of SHOP_SECTIONS) {
      list.appendChild(h('div', 'mw-sec', `<b>${sec.title}</b>`))
      if (sec.key === 'empire') {
        const grid = h('div', 'mw-grid')
        grid.appendChild(shopCard(SHOP.empire, 'empire', i++, 0))
        list.appendChild(grid)
        continue
      }
      // Three to a row; `wide` items go two to a row.
      const items = SHOP[sec.key]
      const thirds = items.filter((it) => !it.wide)
      const wides = items.filter((it) => it.wide)
      if (thirds.length) {
        const grid = h('div', 'mw-grid')
        thirds.forEach((it, k) => grid.appendChild(shopCard(it, sec.key, i++, k % 3)))
        list.appendChild(grid)
      }
      if (wides.length) {
        const grid = h('div', 'mw-grid two')
        wides.forEach((it, k) => grid.appendChild(shopCard(it, sec.key, i++, k % 2 ? 1 : 0)))
        list.appendChild(grid)
      }
    }
    const body = h('div', 'mw-body')
    body.appendChild(list)
    panel.appendChild(body)
  }

  // --- refresh ------------------------------------------------------------------------------
  function refresh() {
    if (!kind) return
    for (const u of updaters) u()
    refreshGoal()
  }
  economy.on('change', (why) => {
    if (!kind) return
    const before = moneyCounter?.value ?? 0
    moneyCounter?.set(economy.money)
    if (economy.money > before && why === 'money') pulse(moneyPill, 'bump')
    refresh()
  })

  // Esc closes the window (before input.js turns it into the portal menu).
  window.addEventListener(
    'keydown',
    (e) => {
      if (kind && e.code === 'Escape') {
        e.stopImmediatePropagation()
        e.preventDefault()
        api.close()
      }
    },
    { capture: true },
  )

  const api = {
    get kind() {
      return kind
    },
    isOpen: () => !!kind,
    open(which, whichTab) {
      which = which === 'staff' ? 'hiring' : which
      if (!TITLES[which]) return
      if (whichTab && UPGRADES[whichTab]) tab = whichTab
      if (kind === which && !whichTab) return
      clearTimeout(closeTimer)
      layer.classList.remove('closing')
      stage.innerHTML = ''
      kind = which
      win = shell(TITLES[which], which)
      stage.appendChild(win)
      layer.classList.add('open')
      layout()
      if (which === 'upgrades') renderUpgrades()
      else if (which === 'hiring') renderHiring()
      else renderShop()
      sfx('open')
      try {
        if (document.pointerLockElement) document.exitPointerLock()
      } catch {
        // Ignore.
      }
      clearInterval(timer)
      timer = setInterval(refresh, 1000)
    },
    close() {
      if (!kind) return
      sfx('close')
      kind = null
      clearInterval(timer)
      layer.classList.add('closing')
      closeTimer = setTimeout(() => {
        layer.classList.remove('open', 'closing')
        stage.innerHTML = ''
        win = null
        updaters = []
      }, 210)
    },
    toggle(which, whichTab) {
      which = which === 'staff' ? 'hiring' : which
      if (kind === which) api.close()
      else api.open(which, whichTab)
    },
    layout,
  }
  layout()
  return api
}
