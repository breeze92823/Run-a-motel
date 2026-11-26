// Entry point for the money UI: the Upgrades / Hiring / Shop windows, the money HUD, the
// save link (net.js) and the player speed boost hook. main.js calls initUi() once.
//   ui.open('upgrades' | 'staff' | 'hiring' | 'shop' [, 'coffee' | 'rooms' | 'ads'])
//   ui.close(), ui.toggle(which), ui.isOpen(), ui.toast(title, text)
import { injectStyles } from './styles.js'
import { createWindows } from './windows.js'
import { createHud } from './hud.js'
import { economy } from '../economy.js'
import { initNet, net } from '../net.js'
import { onReservedAreas } from '../bloxity.js'
import { onKey } from '../input.js'

let windows = null
let hud = null
let reserved = []

export const ui = {
  open: (which, tab) => windows?.open(which, tab),
  close: () => windows?.close(),
  toggle: (which, tab) => windows?.toggle(which, tab),
  isOpen: () => !!windows?.isOpen(),
  toast: (title, text) => hud?.toast(title, text),
}

export function initUi() {
  if (windows) return ui
  injectStyles()
  const toolbarBottom = () => reserved.filter((a) => a.id === 'toolbar').reduce((m, a) => Math.max(m, a.top + a.height), 0)
  windows = createWindows({ reservedTop: toolbarBottom })
  hud = createHud({ open: (which) => ui.toggle(which) })
  onReservedAreas((areas) => {
    reserved = areas
    hud.layout()
    windows.layout()
  })
  onKey('KeyU', () => ui.toggle('upgrades'))
  onKey('KeyH', () => ui.toggle('staff'))
  onKey('KeyB', () => ui.toggle('shop'))
  initNet()
  if (import.meta.env.DEV) window.__motelUi = { ui, economy, net }
  return ui
}

export { economy }
