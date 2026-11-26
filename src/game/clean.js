// Cleaning a room after a guest checks out. The room gets a list of tasks, each with
// its own tool and visible dirt:
//   strip the used sheets (HANDS) -> make the bed with a clean set (HANDS)
//   trash on the floor (BAG: walk over it)
//   dust bunnies on the carpet (VACUUM), carpet stains (SPONGE)
//   muddy footprints / puddles (MOP), the toilet (BRUSH), the sink + mirror (SPONGE)
// Holding E on a task fades its dirt (opacity + shrink) with bubbles / dust / water
// particles; the room's CLEAN % is done tasks / all tasks. Rose (housekeeper) works
// the same list one task at a time.
import { ECONOMY } from '../config.js'
import { messExtra } from './pacing.js'

const rnd = (a, b) => a + Math.random() * (b - a)
const rndi = (a, b) => Math.floor(rnd(a, b + 1))
const shuffle = (a) => a.map((v) => [Math.random(), v]).sort((x, y) => x[0] - y[0]).map((p) => p[1])

// Per kind: tool, prompt, hold time key, checklist row.
export const TASKS = {
  strip: { tool: 'hands', text: 'STRIP THE SHEETS', time: 'stripTime', icon: '🛏️', row: 'Strip the sheets' },
  make: { tool: 'hands', text: 'MAKE THE BED', time: 'makeTime', icon: '🛏️', row: 'Make the bed' },
  trash: { tool: 'trash', text: 'PICK UP TRASH', time: null, icon: '🗑️', row: 'Pick up trash' },
  dust: { tool: 'vacuum', text: 'VACUUM THE DUST', time: 'vacuumTime', icon: '🌀', row: 'Vacuum the carpet' },
  stain: { tool: 'sponge', text: 'SCRUB THE STAIN', time: 'scrubTime', icon: '🧽', row: 'Scrub the stains' },
  mud: { tool: 'mop', text: 'MOP THE FLOOR', time: 'mopTime', icon: '🧹', row: 'Mop the floor' },
  toilet: { tool: 'brush', text: 'SCRUB THE TOILET', time: 'toiletTime', icon: '🚽', row: 'Clean the toilet' },
  sink: { tool: 'sponge', text: 'WIPE THE SINK & MIRROR', time: 'sinkTime', icon: '🚰', row: 'Wipe sink & mirror' },
}
const ROW_ORDER = ['strip', 'make', 'trash', 'dust', 'stain', 'mud', 'toilet', 'sink']
export const TOOL_KEY = { trash: '1', sponge: '2', vacuum: '3', mop: '4', brush: '5', hands: '6' }

function setFade(task, p) {
  const meshes = task.meshes ?? []
  for (const m of meshes) {
    m.visible = p < 1
    if (!m.userData.base) m.userData.base = { s: m.scale.x, o: m.material.opacity ?? 1 }
    m.material.opacity = m.userData.base.o * (1 - p * 0.85)
    m.scale.setScalar(m.userData.base.s * (1 - p * 0.45))
  }
}

export function createCleaning({ fx, play, spawnLitter, scene }) {
  // Sets up the dirt and the task list for a room a guest just left.
  function dirty(rs) {
    const I = rs.r.interior
    const tasks = []
    rs.bed = 'used'
    tasks.push({ kind: 'strip', x: I.bedPoint.x, z: I.bedPoint.z, done: false, p: 0 })
    tasks.push({ kind: 'make', x: I.bedPoint.x, z: I.bedPoint.z, done: false, p: 0 })
    // Trash on the floor.
    // A bigger motel's guests leave more mess (pacing.js heat; none extra at the start).
    const more = messExtra()
    const nl = rndi(...ECONOMY.roomLitter) + more
    rs.litter = []
    for (let i = 0; i < nl; i++) {
      const [x, z] = I.litterSpots[i % I.litterSpots.length]
      const item = spawnLitter(x + rnd(-0.3, 0.3), z + rnd(-0.3, 0.3), rs.litter, 0.21)
      tasks.push({ kind: 'trash', item, x: item.x, z: item.z, done: false, p: 0 })
    }
    const pick = (spots, range) => shuffle(spots).slice(0, rndi(...range) + more)
    for (const s of pick(I.dustSpots, ECONOMY.roomDust)) tasks.push({ kind: 'dust', x: s.x, z: s.z, meshes: [s.mesh], done: false, p: 0 })
    for (const s of pick(I.stainSpots, ECONOMY.roomStains)) tasks.push({ kind: 'stain', x: s.x, z: s.z, meshes: [s.mesh], done: false, p: 0 })
    for (const s of pick(I.mudSpots, ECONOMY.roomMud)) tasks.push({ kind: 'mud', x: s.x, z: s.z, meshes: [s.mesh], done: false, p: 0 })
    tasks.push({ kind: 'toilet', x: I.toilet.x, z: I.toilet.z, at: I.toilet.at, meshes: I.toilet.meshes, done: false, p: 0 })
    tasks.push({ kind: 'sink', x: I.sink.x, z: I.sink.z, at: I.sink.at, meshes: I.sink.meshes, done: false, p: 0 })
    for (const t of tasks) {
      for (const m of t.meshes ?? []) {
        m.visible = true
        if (m.userData.base) {
          m.scale.setScalar(m.userData.base.s)
          m.material.opacity = m.userData.base.o
        }
      }
    }
    rs.tasks = tasks
    rs.cleanPct = 0
  }

  // Marks trash tasks done once the bag picked their litter up.
  function syncTrash(rs) {
    for (const t of rs.tasks ?? []) if (t.kind === 'trash' && !t.done && t.item.taken) t.done = true
  }

  const pct = (rs) => {
    const list = rs.tasks ?? []
    if (!list.length) return 1
    return list.filter((t) => t.done).length / list.length
  }

  // The checklist shown while standing in a dirty room: [{ icon, label, done, total, tool }].
  function checklist(rs) {
    const rows = []
    for (const kind of ROW_ORDER) {
      const ts = (rs.tasks ?? []).filter((t) => t.kind === kind)
      if (!ts.length) continue
      rows.push({ icon: TASKS[kind].icon, label: TASKS[kind].row, done: ts.filter((t) => t.done).length, total: ts.length, tool: TASKS[kind].tool, key: TOOL_KEY[TASKS[kind].tool] })
    }
    return rows
  }

  // The next thing to do in a room (objective text).
  function nextTask(rs) {
    for (const kind of ROW_ORDER) {
      const t = (rs.tasks ?? []).find((x) => x.kind === kind && !x.done && !(kind === 'make' && !stripped(rs)))
      if (t) return t
    }
    return null
  }
  const stripped = (rs) => rs.tasks?.find((t) => t.kind === 'strip')?.done

  // Interaction candidates for a dirty room.
  function gather(rs, near, addC, ctx) {
    const mul = ctx.speedMul()
    for (const t of rs.tasks ?? []) {
      if (t.done || t.kind === 'trash') continue
      const def = TASKS[t.kind]
      const r = t.kind === 'strip' || t.kind === 'make' ? 1.7 : t.kind === 'toilet' || t.kind === 'sink' ? 1.3 : 1.25
      if (!near(t.x, t.z, r)) continue
      if (t.kind === 'make') {
        if (!stripped(rs)) continue
        const sets = ctx.cleanSets()
        addC({ key: t, x: t.x, z: t.z, r, text: sets > 0 ? 'MAKE THE BED (1 CLEAN SET)' : 'NO CLEAN SHEETS · WASH THE LINEN', warn: sets <= 0, tool: 'hands', hold: sets > 0 ? ECONOMY.makeTime / mul : 0, startP: t.p, progress: (p, dt) => progress(rs, t, p, dt), run: () => finish(rs, t, ctx), prio: 1 })
        continue
      }
      if (t.kind === 'strip' && stripped(rs)) continue
      addC({ key: t, x: t.x, z: t.z, r, text: def.text, tool: def.tool, hold: ECONOMY[def.time] / mul, startP: t.p, progress: (p, dt) => progress(rs, t, p, dt), run: () => finish(rs, t, ctx), prio: 1 })
    }
  }

  let sfxT = 0
  // Called every frame while E is held on a task: dirt fades, particles, work sounds.
  function progress(rs, t, p, dt = 1 / 60) {
    t.p = Math.min(1, p)
    setFade(t, t.p)
    const at = t.at ?? { x: t.x, y: 0.35, z: t.z }
    sfxT -= dt
    const burst = sfxT <= 0
    if (burst) sfxT = 0.28
    switch (t.kind) {
      case 'dust':
        if (Math.random() < 0.6) fx.dust(at.x + rnd(-0.4, 0.4), 0.3, at.z + rnd(-0.4, 0.4), 2, '#9a9088', 0.3)
        if (burst) play('vacuum', at)
        break
      case 'mud':
        if (Math.random() < 0.5) fx.water(at.x + rnd(-0.3, 0.3), 0.3, at.z + rnd(-0.3, 0.3), 1)
        if (Math.random() < 0.3) fx.bubbles(at.x, 0.3, at.z, 1)
        if (burst) play('mop', at)
        break
      case 'stain':
      case 'sink':
        if (Math.random() < 0.5) fx.bubbles(at.x, at.y ?? 0.3, at.z, 2)
        if (burst) play('squeak', at)
        break
      case 'toilet':
        if (Math.random() < 0.5) fx.bubbles(at.x, at.y, at.z, 2)
        if (Math.random() < 0.2) fx.water(at.x, at.y + 0.1, at.z, 1)
        if (burst) play('brush', at)
        break
      default:
        if (Math.random() < 0.2) fx.dust(at.x, 0.9, at.z, 2, '#ffffff', 0.4)
        if (burst && Math.random() < 0.4) play('swoosh', at)
    }
  }

  // A task completed (by the player or by Rose).
  function finish(rs, t, ctx) {
    if (t.done) return
    if (t.kind === 'make') {
      if (!ctx.takeCleanSet()) {
        play('error')
        return ctx.toast('No clean sheets: wash the linen in the laundry')
      }
      rs.bed = 'made'
    }
    if (t.kind === 'strip') {
      rs.bed = 'stripped'
      ctx.addDirtyLinen(1)
    }
    t.done = true
    t.p = 1
    setFade(t, 1)
    const at = t.at ?? { x: t.x, y: 0.4, z: t.z }
    fx.sparkle(at.x, (at.y ?? 0.4) + 0.2, at.z, 14, t.kind === 'mud' || t.kind === 'sink' || t.kind === 'toilet' ? '#bff4ff' : '#fff2a8')
    if (t.kind === 'strip' || t.kind === 'make') {
      fx.dust(at.x, 0.9, at.z + 1, 10, '#ffffff', 0.8)
      play('swoosh', at)
    } else play('chime', at)
    ctx.onTaskDone(rs, t)
  }

  // Rose: does the next task in the room. Returns the task she did (or null).
  function staffStep(rs, ctx) {
    syncTrash(rs)
    const t = nextTask(rs)
    if (!t) return null
    if (t.kind === 'trash') {
      t.item.taken = true
      scene.remove(t.item.obj)
      t.done = true
      fx.sparkle(t.x, 0.4, t.z, 8)
      ctx.onTaskDone(rs, t)
      return t
    }
    if (t.kind === 'make' && ctx.cleanSets() <= 0) return null
    finish(rs, t, ctx)
    return t
  }

  return { dirty, pct, checklist, nextTask, gather, progress, finish, staffStep, syncTrash }
}
