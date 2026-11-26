// Tool hotbar: a bottom-centre row of slots (HOTBAR in config). Number keys or a
// tap select a slot; the selected one grows teal with a white rim, its icon
// pops, and the select + tool sounds play. The trash slot shows the carried
// count ("0/12") instead of a name.
import './hotbar.css'
import { ECONOMY, HOTBAR } from '../config.js'
import { onKey } from '../input.js'
import { toolSfx as play } from '../fx/tools-sfx.js'
import { BRUSH_ICON, HAND_ICON, MOP_ICON, SPONGE_ICON, TRASH_ICON, VACUUM_ICON } from './icons.js'

const ICONS = { trash: TRASH_ICON, sponge: SPONGE_ICON, vacuum: VACUUM_ICON, mop: MOP_ICON, brush: BRUSH_ICON, hands: HAND_ICON }
const SOUND = { trash: 'bag', sponge: 'sponge', vacuum: 'vacuum', mop: 'mop', brush: 'brush', hands: 'hands' }

export function createHotbar({ onSelect } = {}) {
  const root = document.createElement('div')
  root.className = 'hotbar'
  const slots = new Map()
  let selected = null
  let trashLabel = null

  for (const def of HOTBAR.slots) {
    const b = document.createElement('button')
    b.type = 'button'
    b.className = 'hb-slot'
    b.dataset.id = def.id
    b.setAttribute('aria-label', `${def.label ?? def.id} (${def.key})`)
    b.innerHTML = `<span class="hb-key">${def.key}</span><span class="hb-icon">${ICONS[def.id] ?? ''}</span><span class="hb-label">${def.label ?? ''}</span>`
    // pointerdown: no click delay on touch, and the world never sees the press.
    b.addEventListener('pointerdown', (e) => {
      e.preventDefault()
      e.stopPropagation()
      select(def.id)
    })
    b.addEventListener('click', (e) => e.preventDefault())
    if (!def.label) trashLabel = b.querySelector('.hb-label')
    slots.set(def.id, b)
    onKey(`Digit${def.key}`, () => select(def.id))
    onKey(`Numpad${def.key}`, () => select(def.id))
  }
  root.append(...slots.values())
  document.body.appendChild(root)

  // Restarts a CSS animation class on `el`.
  function replay(el, cls) {
    el.classList.remove(cls)
    void el.offsetWidth
    el.classList.add(cls)
  }

  function select(id, { silent = false } = {}) {
    const b = slots.get(id)
    if (!b || id === selected) return
    slots.get(selected)?.classList.remove('sel', 'pop')
    selected = id
    b.classList.add('sel')
    replay(b, 'pop')
    if (!silent) {
      play('select')
      play(SOUND[id])
    }
    onSelect?.(id, { silent })
  }

  let lastCount = -1
  function setTrash(count, cap = ECONOMY.trashCapacity) {
    if (!trashLabel) return
    trashLabel.textContent = `${count}/${cap}`
    trashLabel.classList.toggle('full', count >= cap)
    if (lastCount >= 0 && count !== lastCount) replay(trashLabel, 'bump')
    lastCount = count
  }

  setTrash(0)
  select(HOTBAR.start, { silent: true })

  return {
    select,
    setTrash,
    get selected() {
      return selected
    },
    element: root,
  }
}
