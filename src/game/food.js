// Food and room service.
// - Guests staying in a room walk to the office for a coffee (later hot dogs and burgers),
//   wait at FOOD PICKUP and pay onto the counter's cash pile when served.
// - Guests in their rooms call the front desk: the red phone rings; ANSWER THE PHONE
//   gives a timed order ("Room 101 wants a hot dog · get it from the GRILL · 1:28")
//   that is carried to the room door; the guest leaves the money at the door (TAKE $X).
// - Every item is made at its station in 3 steps (hold E, see motel/kitchen.js); the
//   finished item is taken (carried in front of the player) and served. Stations only
//   work when there is an order ("NO HOT DOG ORDERS YET").
// - Automation: the AUTO machine upgrades run the 3 steps by themselves; Mia (staff)
//   answers the phone, makes food on the manual stations and serves / delivers it.
import { Vector3 } from 'three'
import { FOOD, FOOD_RULES, CURB, LAYOUT } from '../config.js'
import { makeFood } from '../motel/kitchen.js'
import { makePerson, randomLook, Walker } from '../motel/people.js'
import { walkInMul } from './pacing.js'

const rnd = (a, b) => a + Math.random() * (b - a)
const mmss = (s) => {
  const t = Math.max(0, Math.ceil(s))
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`
}
const KINDS = Object.keys(FOOD)

export function createFood(ctx) {
  const { scene, fx, hud, play, bank, call, kitchen, office, rooms, player, playerGroup, S, floorAt, P } = ctx
  const FRONT = P.FRONT
  const stations = {}
  for (const kind of KINDS) stations[kind] = { kind, st: kitchen[kind], stage: -1, p: 0, by: null, autoT: 0 }
  const open = (kind) => call('foodOpen', kind) ?? kind === 'coffee'
  const price = (kind) => call('foodPrice', kind) ?? FOOD[kind].price
  const isAuto = (kind) => !!call('foodAuto', kind)
  const openKinds = () => KINDS.filter(open)

  // --- Orders ------------------------------------------------------------------------------
  const customers = [] // walk-ins: { p, w, kind, stage, patience, slot }
  const roomOrders = [] // { rs, kind, timeLeft, by }
  const phone = { ringing: null, t: 0, ringSfx: 0 } // ringing = { rs, kind }
  let walkInT = FOOD_RULES.walkInFirst
  let seed = 500

  const waitingWalkIns = (kind) => customers.filter((c) => c.stage === 'waiting' && (!kind || c.kind === kind))
  const openOrders = (kind) => waitingWalkIns(kind).length + roomOrders.filter((o) => o.kind === kind).length + customers.filter((c) => c.kind === kind && c.stage === 'arriving').length
  function supply(kind) {
    let n = stations[kind].stage >= 0 ? 1 : 0
    if (S.carry?.kind === 'food' && S.carry.food === kind) n++
    if (mia?.item?.kind === kind) n++
    return n
  }
  const demand = (kind) => openOrders(kind) - supply(kind)

  // --- Walk-in customers ----------------------------------------------------------------------
  function pickKind() {
    const ks = openKinds()
    if (ks.length === 1 || Math.random() < 0.55) return 'coffee'
    return ks[1 + Math.floor(Math.random() * (ks.length - 1))]
  }
  // A guest staying in room `rs` steps out (same look as the guest) and walks to FOOD PICKUP.
  function spawnWalkIn(rs) {
    const p = makePerson(rs.guest?.look ?? randomLook(seed++ * 17))
    scene.add(p.group)
    const w = new Walker(p, rs.r.doorX, FRONT - 1.4, 0.18)
    const c = { p, w, rs, kind: pickKind(), stage: 'arriving', patience: FOOD_RULES.walkInPatience, slot: -1 }
    customers.push(c)
    routeQueue()
  }
  function routeQueue() {
    const q = customers.filter((c) => c.stage === 'arriving' || c.stage === 'waiting')
    q.forEach((c, i) => {
      if (c.slot === i) return
      const first = c.slot < 0
      c.slot = i
      const [tx, tz] = LAYOUT.foodQueue[Math.min(i, LAYOUT.foodQueue.length - 1)]
      if (!first && c.stage === 'arriving' && c.w.busy) {
        c.w.path[c.w.path.length - 1] = [tx, tz]
        return
      }
      const pts = first
        ? [[c.rs.r.doorX, FRONT + 0.8], [c.rs.r.doorX, P.WALK_Z], [P.DOOR_X, P.WALK_Z], [P.DOOR_X, FRONT + 1.4], [P.DOOR_X, FRONT - 1.6], [tx + 0.6, -8.2], [tx, tz]]
        : [[tx, tz]]
      c.w.go(pts, () => {
        c.stage = 'waiting'
        c.w.face(Math.PI)
      })
    })
  }
  function leave(c, angry) {
    c.stage = 'leaving'
    if (angry) {
      ctx.rate(1.8)
      hud.toast(`A customer got tired of waiting for ${FOOD[c.kind].name.toLowerCase()} 😠`)
    }
    // Back to their room.
    const dx = c.rs.r.doorX
    c.w.go([[P.DOOR_X + 0.3, -7.8], [P.DOOR_X, FRONT - 1.6], [P.DOOR_X, P.WALK_Z], [dx, P.WALK_Z], [dx, FRONT + 0.8], [dx, FRONT - 1.4]], () => {
      scene.remove(c.p.group)
      customers.splice(customers.indexOf(c), 1)
    })
    routeQueue()
  }
  function serveWalkIn(c, item, by = 'player') {
    c.stage = 'served'
    item.position.set(0.32, 1.0, 0.25)
    item.rotation.set(0, 0, 0)
    item.scale.setScalar(1.3)
    c.p.group.add(item)
    const pay = price(c.kind)
    const from = new Vector3(c.w.x, 1.4, c.w.z)
    play('pickup', from)
    fx.sparkle(from.x, 1.6, from.z, 12)
    hud.float(from.clone().setY(2.5), `${FOOD[c.kind].icon} thanks!`, '#ffffff')
    setTimeout(() => ctx.payCounter(pay, from), 350)
    ctx.rate(4.6, 0.3)
    if (by === 'player') hud.announce(`${FOOD[c.kind].icon} SERVED!`, `+$${pay} on the counter`, 1.8)
    setTimeout(() => leave(c, false), 900)
  }

  // --- Phone + room service ----------------------------------------------------------------------
  function onGuestSettled(rs) {
    rs.outings = 0
    if (Math.random() > FOOD_RULES.callChance + (openKinds().length - 1) * 0.12) return
    rs.callT = rnd(...FOOD_RULES.callDelay)
  }
  function onGuestLeft(rs) {
    // Their room's customer (out buying food) goes with them.
    for (let i = customers.length - 1; i >= 0; i--) {
      if (customers[i].rs !== rs) continue
      scene.remove(customers[i].p.group)
      customers.splice(i, 1)
    }
    routeQueue()
    rs.callT = 0
    if (phone.ringing?.rs === rs) phone.ringing = null
    for (let i = roomOrders.length - 1; i >= 0; i--) if (roomOrders[i].rs === rs) roomOrders.splice(i, 1)
  }
  function answer(byMia = false) {
    const r = phone.ringing
    if (!r) return
    phone.ringing = null
    if (r.rs.state !== 'occupied') return
    const o = { rs: r.rs, kind: r.kind, timeLeft: FOOD_RULES.orderTime, by: null }
    roomOrders.push(o)
    play('click')
    if (!byMia) hud.announce(`ROOM ${r.rs.r.number} WANTS ${FOOD[r.kind].name === 'COFFEE' ? 'A COFFEE' : `A ${FOOD[r.kind].name}`}`, `make it at the ${FOOD[r.kind].where} and bring it to the door`, 3)
  }
  function deliver(o, item, by = 'player') {
    roomOrders.splice(roomOrders.indexOf(o), 1)
    const r = o.rs.r
    const at = new Vector3(r.doorX, 1.2, FRONT + 0.3)
    fx.poof(at.x, 0.8, at.z)
    fx.sparkle(at.x, 1.4, at.z, 16)
    play('doorOpen', at)
    setTimeout(() => play('doorClose', at), 700)
    if (item) scene.remove(item)
    const pay = Math.round(price(o.kind) * (1 + FOOD_RULES.roomServiceTip))
    ctx.dropCash(pay, r.doorX + 0.35, FRONT + 0.75)
    ctx.rate(4.9, 0.4)
    if (by === 'player') hud.announce('ROOM SERVICE!', `room ${r.number} left $${pay} at the door`, 2.2)
  }

  // --- Mia (staff): answers the phone, makes and serves food -----------------------------------------
  let mia = null
  const MIA_HOME = [-17.9, -12.6]
  function ensureMia() {
    if (mia) return mia
    const p = makePerson({ skin: '#f1c7a1', shirt: '#ff8fb1', pants: '#2a3a5a', hair: '#6b3a1a', hairStyle: 2, hat: 'cap', hatColor: '#e2382a', face: 1, collar: '#ffffff', apron: '#ffffff' })
    scene.add(p.group)
    const w = new Walker(p, MIA_HOME[0], MIA_HOME[1], 0.2)
    mia = { p, w, task: null, item: null, t: 0 }
    return mia
  }
  const miaStep = () => FOOD_RULES.miaStepTime / Math.max(0.5, call('staffSpeed', 'mia') || 1)
  const officeOut = (x, z) => [[x, -14.3], [-13.3, -14.3], [-13.3, -9.0], [P.DOOR_X, -7.6], [P.DOOR_X, P.WALK_Z]]
  function updateMia(dt) {
    const m = ensureMia()
    m.w.update(dt, floorAt)
    if (m.w.busy) return
    const tk = m.task
    if (tk?.kind === 'work') {
      const s = stations[tk.food]
      m.t += dt
      const p = Math.min(1, m.t / miaStep())
      s.p = p
      s.st.set(s.stage, p)
      workFx(s, p)
      if (p >= 1) {
        stepDone(s)
        m.t = 0
        if (s.stage === 3) {
          s.by = null
          m.task = null
        }
      }
      return
    }
    if (tk?.kind === 'phone') {
      answer(true)
      m.task = null
      return
    }
    if (tk?.kind === 'take') {
      const s = stations[tk.food]
      if (s.stage === 3) {
        m.item = { kind: tk.food, obj: makeFood(tk.food) }
        m.item.obj.position.set(0, 1.1, 0.4)
        m.item.obj.scale.setScalar(1.4)
        m.p.group.add(m.item.obj)
        s.stage = -1
        s.p = 0
        s.st.set(-1, 0)
        play('pickup', { x: s.st.workAt.x, y: 1.2, z: s.st.workAt.z })
      }
      m.task = null
      return
    }
    if (tk?.kind === 'serve') {
      const c = waitingWalkIns(m.item?.kind)[0]
      if (c && m.item) {
        m.p.group.remove(m.item.obj)
        serveWalkIn(c, m.item.obj, 'mia')
        m.item = null
      }
      m.task = null
      return
    }
    if (tk?.kind === 'room') {
      const o = roomOrders.find((x) => x === tk.order)
      if (o && m.item) {
        m.p.group.remove(m.item.obj)
        deliver(o, null, 'mia')
        m.item = null
      }
      const back = officeOut(MIA_HOME[0], MIA_HOME[1]).reverse()
      const r = tk.order.rs.r
      m.task = { kind: 'back' }
      m.w.go([[r.doorX, P.WALK_Z], ...back, MIA_HOME], () => (m.task = null))
      return
    }
    if (tk?.kind === 'back') return
    // Pick the next job.
    if (phone.ringing) {
      m.task = { kind: 'phone' }
      m.w.go([[LAYOUT.phonePoint.x, LAYOUT.phonePoint.z]])
      return
    }
    if (m.item) {
      const kind = m.item.kind
      if (waitingWalkIns(kind).length) {
        m.task = { kind: 'serve' }
        m.w.go([[LAYOUT.foodServe.x + 0.4, LAYOUT.foodServe.z]], () => m.w.face(0))
        return
      }
      const o = roomOrders.find((x) => x.kind === kind && !x.by)
      if (o) {
        o.by = 'mia'
        const r = o.rs.r
        m.task = { kind: 'room', order: o }
        m.w.go([...officeOut(m.w.x, m.w.z), [r.doorX, P.WALK_Z], [r.doorX, FRONT + 0.9]])
        return
      }
      return
    }
    for (const kind of KINDS) {
      const s = stations[kind]
      if (s.stage === 3 && openOrders(kind) > (S.carry?.food === kind ? 1 : 0)) {
        m.task = { kind: 'take', food: kind }
        m.w.go([[s.st.x, s.st.z]], () => m.w.face(Math.PI))
        return
      }
    }
    for (const kind of KINDS) {
      const s = stations[kind]
      if (!open(kind) || isAuto(kind) || s.by) continue
      if ((s.stage === -1 && demand(kind) > 0) || (s.stage >= 0 && s.stage < 3 && !s.by && s.manual === false)) {
        if (s.stage === -1) s.stage = 0
        s.by = 'mia'
        m.t = 0
        m.task = { kind: 'work', food: kind }
        m.w.go([[s.st.x, s.st.z]], () => m.w.face(Math.PI))
        return
      }
    }
    if (Math.hypot(m.w.x - MIA_HOME[0], m.w.z - MIA_HOME[1]) > 0.3) m.w.go([MIA_HOME], () => m.w.face(0))
  }

  // --- Stations ------------------------------------------------------------------------------
  let workSfx = 0
  function workFx(s, p) {
    const a = s.st.steamAt
    const w = s.st.workAt
    workSfx -= 1 / 60
    const burst = workSfx <= 0
    if (burst) workSfx = 0.3
    if (s.kind === 'coffee' && s.stage === 1) {
      if (Math.random() < 0.3) fx.smoke(a.x, a.y + 0.2, a.z)
      if (burst) play('pour', a)
    } else if (s.stage === 0 && s.kind !== 'coffee') {
      if (Math.random() < 0.35) fx.smoke(a.x, a.y, a.z)
      if (burst) play('sizzle', a)
    } else if (s.kind === 'hotdog' && s.stage === 2) {
      if (burst) play('squeak', w)
    } else if (Math.random() < 0.15) fx.sparkle(w.x, w.y, w.z, 2)
    void p
  }
  function stepDone(s) {
    s.stage++
    s.p = 0
    s.st.set(s.stage, s.stage === 3 ? 1 : 0)
    const w = s.st.workAt
    fx.sparkle(w.x, w.y + 0.1, w.z, s.stage === 3 ? 22 : 8)
    play(s.stage === 3 ? 'chime' : 'pickup', w)
    if (s.stage === 3) hud.float(new Vector3(w.x, w.y + 0.6, w.z), `${FOOD[s.kind].icon} READY!`, '#ffe07a')
  }
  function take(s) {
    if (S.carry) {
      play('error')
      return hud.toast('Your hands are full')
    }
    const obj = makeFood(s.kind)
    obj.position.set(0, 1.12, 0.48)
    obj.scale.setScalar(1.5)
    playerGroup.add(obj)
    S.carry = { kind: 'food', food: s.kind, obj }
    ctx.toHands()
    s.stage = -1
    s.p = 0
    s.st.set(-1, 0)
    play('pickup', s.st.workAt)
    const dest = waitingWalkIns(s.kind).length ? 'FOOD PICKUP (west end of the counter)' : roomOrders.find((o) => o.kind === s.kind) ? `room ${roomOrders.find((o) => o.kind === s.kind).rs.r.number}` : null
    if (dest) hud.toast(`Bring it to ${dest}`)
  }
  function dropCarried() {
    const c = S.carry
    if (c?.kind !== 'food') return null
    playerGroup.remove(c.obj)
    S.carry = null
    return c.obj
  }

  // Put the carried food down (to use a tool): it goes back on its station as READY when the
  // station is free, otherwise it is binned. Returns 'station' | 'bin' | null.
  function putDown() {
    const c = S.carry
    if (c?.kind !== 'food') return null
    dropCarried()
    const s = stations[c.food]
    if (s && s.stage < 0 && open(c.food)) {
      s.stage = 3
      s.p = 0
      s.st.set(3, 1)
      play('pickup', s.st.workAt)
      return 'station'
    }
    return 'bin'
  }

  function gather(near, addC) {
    // Phone.
    if (phone.ringing && near(LAYOUT.phonePoint.x, LAYOUT.phonePoint.z, 1.5)) addC({ x: LAYOUT.phonePoint.x, z: LAYOUT.phonePoint.z, r: 1.5, text: 'ANSWER THE PHONE', run: () => answer(), prio: 5 })
    // Stations.
    for (const kind of KINDS) {
      const s = stations[kind]
      const st = s.st
      if (!near(st.x, st.z, 1.15)) continue
      const def = FOOD[kind]
      if (!open(kind)) {
        const up = def.unlock
        const cost = up ? call('upgradePrice', up) ?? 0 : 0
        addC({ x: st.x, z: st.z, r: 1.15, text: `UNLOCK ${def.station} · $${cost}`, warn: bank.money < cost, run: () => {
          const r = call('buyUpgrade', up)
          if (r?.ok) {
            play('tada', st.workAt)
            fx.sparkle(st.workAt.x, 1.6, st.workAt.z, 30)
            hud.announce(`${def.icon} ${def.station} OPEN!`, 'room service and walk-ins can order it now')
          } else {
            play('error')
            hud.toast('Not enough money')
          }
        }, prio: 1 })
        continue
      }
      if (s.stage === 3) {
        addC({ x: st.x, z: st.z, r: 1.15, text: S.carry ? 'HANDS FULL' : def.take, warn: !!S.carry, run: () => take(s), prio: 3 })
        continue
      }
      if (s.by === 'mia') {
        addC({ x: st.x, z: st.z, r: 1.15, text: 'MIA IS ON IT', warn: true, run: () => {}, prio: -3 })
        continue
      }
      if (isAuto(kind)) {
        addC({ x: st.x, z: st.z, r: 1.15, text: s.stage >= 0 ? `AUTO · ${def.steps[s.stage].text}…` : demand(kind) > 0 ? 'AUTO · STARTING…' : `NO ${def.name} ORDERS YET`, warn: true, run: () => {}, prio: -3 })
        continue
      }
      if (s.stage < 0 && demand(kind) <= 0) {
        addC({ x: st.x, z: st.z, r: 1.15, text: `NO ${def.name} ORDERS YET`, warn: true, run: () => {}, prio: -3 })
        continue
      }
      const stage = Math.max(0, s.stage)
      const step = def.steps[stage]
      addC({
        key: `${kind}:${stage}`,
        x: st.x,
        z: st.z,
        r: 1.15,
        text: `${step.text} · ${stage + 1}/3`,
        tool: 'hands',
        hold: step.hold,
        startP: s.stage === stage ? s.p : 0,
        progress: (p) => {
          s.stage = stage
          s.p = p
          st.set(stage, p)
          workFx(s, p)
        },
        run: () => {
          s.stage = stage
          stepDone(s)
        },
        prio: 2,
      })
    }
    // Serving.
    const c = S.carry
    if (c?.kind === 'food') {
      const fs = LAYOUT.foodServe
      const want = waitingWalkIns(c.food)[0]
      if (want && near(fs.x, fs.z, 1.6)) addC({ x: fs.x, z: fs.z, r: 1.6, text: `SERVE THE ${FOOD[c.food].name}`, run: () => serveWalkIn(want, dropCarried()), prio: 4 })
      else if (!want && waitingWalkIns().length && near(fs.x, fs.z, 1.6)) addC({ x: fs.x, z: fs.z, r: 1.6, text: `NOBODY HERE WANTS ${FOOD[c.food].name}`, warn: true, run: () => {}, prio: -1 })
      for (const o of roomOrders) {
        if (o.kind !== c.food || o.by === 'mia') continue
        const r = o.rs.r
        if (near(r.doorX, FRONT + 1.0, 1.7)) addC({ x: r.doorX, z: FRONT + 1.0, r: 1.7, text: `DELIVER ${FOOD[o.kind].name} · ROOM ${r.number}`, run: () => deliver(o, dropCarried()), prio: 5 })
      }
    }
  }

  // --- Per frame ------------------------------------------------------------------------------
  function update(dt, appeal) {
    // Station plates, locks, AUTO machines.
    for (const kind of KINDS) {
      const s = stations[kind]
      const st = s.st
      st.setLocked(!open(kind))
      st.setAuto(isAuto(kind))
      if (open(kind) && isAuto(kind) && s.by !== 'mia') {
        if (s.stage < 0 && demand(kind) > 0) {
          s.stage = 0
          s.p = 0
        }
        if (s.stage >= 0 && s.stage < 3) {
          s.p += dt / (FOOD[kind].autoTime / 3)
          st.set(s.stage, Math.min(1, s.p))
          workFx(s, s.p)
          if (s.p >= 1) stepDone(s)
        }
      }
      const orders = openOrders(kind)
      if (!open(kind)) st.setStatus('')
      else if (s.stage === 3) st.setStatus('READY!', '#2fa84f')
      else if (s.stage >= 0) st.setStatus(`STEP ${s.stage + 1}/3`, '#e8932a')
      else if (orders > 0) st.setStatus(`ORDERS: ${orders}`, '#e2382a')
      else st.setStatus(`NO ${FOOD[kind].name} ORDERS`, '#1f9a8a')
    }
    // Walk-ins.
    // A dirty lot slows walk-ins down (never stops them: someone always wants a coffee).
    const fewer = appeal < CURB.fewestBelow ? CURB.lowSlow * 2 : appeal < CURB.fewerBelow ? CURB.lowSlow : 1
    walkInT -= (dt * walkInMul()) / fewer
    if (walkInT <= 0) {
      // Only a guest staying in a room goes out for food (never an outsider).
      const out = customers.filter((c) => c.stage !== 'leaving' && c.stage !== 'served').length
      const who = rooms.filter((rs) => rs.state === 'occupied' && rs.guest && !customers.some((c) => c.rs === rs) && (rs.outings ?? 0) < FOOD_RULES.outingsPerStay)
      if (who.length && out < FOOD_RULES.walkInMax) {
        const rs = who[Math.floor(Math.random() * who.length)]
        rs.outings = (rs.outings ?? 0) + 1
        walkInT = rnd(...FOOD_RULES.walkInEvery)
        spawnWalkIn(rs)
      } else walkInT = 4
    }
    for (const c of [...customers]) {
      c.w.update(dt, floorAt)
      if (c.stage === 'waiting') {
        c.patience -= dt
        if (c.patience <= 0) leave(c, true)
      }
    }
    customers.forEach((c, i) => {
      const show = c.stage === 'waiting'
      hud.bubble(`food${i}`, () => ({ x: c.w.x, y: 2.45, z: c.w.z }), show ? `${FOOD[c.kind].icon} ${FOOD[c.kind].name} · $${price(c.kind)}` : null, c.patience < 20 ? 'want hot' : 'want')
    })
    for (let i = customers.length; i < customers.length + 3; i++) hud.bubble(`food${i}`, null, null)
    // Room service calls.
    for (const rs of rooms) {
      if (rs.state !== 'occupied' || !(rs.callT > 0)) continue
      rs.callT -= dt
      if (rs.callT <= 0) {
        if (phone.ringing || roomOrders.some((o) => o.rs === rs)) rs.callT = 6
        else {
          const ks = openKinds()
          const kind = ks.length > 1 && Math.random() < 0.7 ? ks[1 + Math.floor(Math.random() * (ks.length - 1))] : 'coffee'
          phone.ringing = { rs, kind }
          phone.t = FOOD_RULES.ringTime
          phone.ringSfx = 0
          hud.toast(`📞 Room ${rs.r.number} is calling · pick up the phone`)
        }
      }
    }
    const ph = office.phone
    if (phone.ringing) {
      phone.t -= dt
      phone.ringSfx -= dt
      if (phone.ringSfx <= 0) {
        phone.ringSfx = 1.3
        play('phone', { x: LAYOUT.phone.x, y: 1.3, z: LAYOUT.phone.z })
      }
      ph.rotation.z = Math.sin(performance.now() * 0.06) * 0.08
      ph.position.y = office.ctop + Math.abs(Math.sin(performance.now() * 0.03)) * 0.03
      if (phone.t <= 0) {
        hud.toast(`Room ${phone.ringing.rs.r.number} hung up · nobody answered`)
        ctx.rate(2.5)
        phone.ringing = null
      }
    } else {
      ph.rotation.z = 0
      ph.position.y = office.ctop
    }
    for (let i = roomOrders.length - 1; i >= 0; i--) {
      const o = roomOrders[i]
      o.timeLeft -= dt
      if (o.timeLeft <= 0) {
        roomOrders.splice(i, 1)
        hud.toast(`Room ${o.rs.r.number} gave up on the ${FOOD[o.kind].name.toLowerCase()} 😞`)
        ctx.rate(1.8)
      }
    }
    if (ctx.hired('mia')) updateMia(dt)
  }

  // Objective text for the most urgent food job, or null.
  function objective() {
    if (phone.ringing) return [`📞 Room ${phone.ringing.rs.r.number} is calling · pick up the phone (counter)`, 0, '📞']
    const c = S.carry
    if (c?.kind === 'food') {
      if (waitingWalkIns(c.food).length) return [`Serve the ${FOOD[c.food].name.toLowerCase()} at FOOD PICKUP`, 0.9, FOOD[c.food].icon]
      const o = roomOrders.find((x) => x.kind === c.food)
      if (o) return [`Bring the ${FOOD[c.food].name.toLowerCase()} to room ${o.rs.r.number} · ${mmss(o.timeLeft)}`, 0.9, FOOD[c.food].icon]
    }
    const o = roomOrders.filter((x) => x.by !== 'mia').sort((a, b) => a.timeLeft - b.timeLeft)[0]
    if (o) {
      const s = stations[o.kind]
      return [`Room ${o.rs.r.number} wants ${o.kind === 'coffee' ? 'a coffee' : `a ${FOOD[o.kind].name.toLowerCase()}`} · get it from the ${FOOD[o.kind].where} · ${mmss(o.timeLeft)}`, s.stage >= 0 ? (s.stage + 1) / 4 : 0, FOOD[o.kind].icon]
    }
    const w = waitingWalkIns()[0]
    if (w && !ctx.hired('mia')) {
      const s = stations[w.kind]
      return [`A customer wants ${w.kind === 'coffee' ? 'a coffee' : `a ${FOOD[w.kind].name.toLowerCase()}`} · make it at the ${FOOD[w.kind].where} (behind the counter)`, s.stage >= 0 ? (s.stage + 1) / 4 : 0, FOOD[w.kind].icon]
    }
    return null
  }

  return {
    gather,
    putDown,
    update,
    objective,
    onGuestSettled,
    onGuestLeft,
    stations,
    customers,
    roomOrders,
    phone,
    ring: (rs, kind = 'coffee') => {
      phone.ringing = { rs, kind }
      phone.t = FOOD_RULES.ringTime
    },
    spawnWalkIn,
  }
}
