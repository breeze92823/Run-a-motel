// The tour bus: a long two-tone coach (cream top, sunflower-yellow skirt, orange
// pinstripe) that drives in along the highway, stops at the bus stop, folds its
// door open to drop guests, and drives off. Wheels spin; the body sways a
// little as it brakes.
import { CylinderGeometry, Group, Mesh, MeshStandardMaterial, PlaneGeometry } from 'three'
import { LAYOUT } from '../config.js'
import { box, canvasTex, mat, rbox } from './kit.js'
import { paintSign } from './paint.js'

export function buildBus(scene) {
  const g = new Group()
  const body = new Group()
  g.add(body)
  const L = 11
  const cream = mat('#f6efdf', { roughness: 0.4 })
  const yellow = mat('#f6c232', { roughness: 0.4 })
  const orange = mat('#f06a34', { roughness: 0.4 })
  const glass = new MeshStandardMaterial({ color: '#1f4f7a', roughness: 0.1, metalness: 0.3 })
  const chrome = mat('#e4e8ea', { metalness: 0.9, roughness: 0.2 })
  // Bus points along +X (front = +X).
  rbox(body, L, 1.5, 2.55, 0.15, yellow, 0, 1.15, 0)
  rbox(body, L, 1.5, 2.5, 0.25, cream, 0, 2.55, 0)
  // Stripes stand 1 cm proud of the window glass (1.285) so their faces never share a plane.
  box(body, L + 0.02, 0.18, 2.59, orange, 0, 1.85, 0)
  box(body, L + 0.02, 0.06, 2.59, mat('#e2382a'), 0, 1.68, 0)
  // Side windows with sloped glare streaks.
  for (const s of [-1, 1]) {
    for (let i = 0; i < 6; i++) {
      const x = -L / 2 + 1.3 + i * 1.45
      if (s === -1 && i === 5) continue // door side (faces the sidewalk, -Z)
      box(body, 1.2, 0.95, 0.03, glass, x, 2.55, s * 1.27)
      const glare = box(body, 0.1, 0.9, 0.02, mat('#8fb7d6'), x + 0.25, 2.55, s * 1.29)
      glare.rotation.z = 0.5
    }
  }
  // Windscreen, headlights, grille, bumper.
  box(body, 0.06, 1.1, 2.2, glass, L / 2 + 0.01, 2.5, 0)
  box(body, 0.1, 0.5, 1.4, chrome, L / 2 + 0.03, 1.0, 0)
  box(body, 0.2, 0.25, 2.6, chrome, L / 2 + 0.06, 0.5, 0)
  box(body, 0.2, 0.25, 2.6, chrome, -L / 2 - 0.06, 0.5, 0)
  const head = new MeshStandardMaterial({ color: '#fffbe0', emissive: '#fff2b0', emissiveIntensity: 0.4 })
  for (const z of [-0.95, 0.95]) {
    const h = new Mesh(new CylinderGeometry(0.17, 0.17, 0.08, 14), head)
    h.rotation.z = Math.PI / 2
    h.position.set(L / 2 + 0.06, 1.1, z)
    body.add(h)
    box(body, 0.06, 0.3, 0.2, mat('#d92020', { emissive: '#ff2020', emissiveIntensity: 0.3 }), -L / 2 - 0.02, 1.2, z)
  }
  // Destination board.
  const dest = paintSign({ w: 512, h: 96, bg: '#1d1d1d', border: '#444', borderW: 6, radius: 6, lines: [{ t: 'MOTEL ROW', size: 60, color: '#ffb020' }] })
  const dm = new Mesh(new PlaneGeometry(1.6, 0.3), new MeshStandardMaterial({ map: canvasTex(dest), emissiveMap: canvasTex(dest), emissive: '#ffffff', emissiveIntensity: 0.6 }))
  dm.rotation.y = Math.PI / 2
  dm.position.set(L / 2 + 0.05, 3.15, 0)
  body.add(dm)
  // Side livery.
  const livery = paintSign({ w: 640, h: 110, bg: 'rgba(0,0,0,0)', border: null, lines: [{ t: 'DESERT LINE TOURS ✦', size: 72, color: '#e2482c' }] })
  const lm = new MeshStandardMaterial({ map: canvasTex(livery), transparent: true })
  for (const s of [-1, 1]) {
    const p = new Mesh(new PlaneGeometry(4.2, 0.72), lm)
    p.position.set(-0.8, 1.15, s * 1.3)
    if (s === -1) p.rotation.y = Math.PI
    body.add(p)
  }
  // Roof AC pod.
  rbox(body, 2.4, 0.35, 1.6, 0.12, cream, -1.5, 3.4, 0)
  // Folding door (door side = -Z, toward the sidewalk).
  const doorL = new Group()
  const doorR = new Group()
  for (const [d, x] of [[doorL, L / 2 - 1.45], [doorR, L / 2 - 0.95]]) {
    box(d, 0.5, 2.3, 0.05, glass, 0.25, 0, 0)
    box(d, 0.52, 0.08, 0.06, chrome, 0.25, 1.1, 0)
    d.position.set(x - 0.25, 1.65, -1.28)
    body.add(d)
  }
  // Wheels.
  const wheels = []
  const tyre = mat('#1b1b1d', { roughness: 0.9 })
  const hubM = mat('#d9d9d9', { metalness: 0.8, roughness: 0.3 })
  for (const x of [-L / 2 + 1.8, L / 2 - 2.0]) {
    for (const z of [-1.2, 1.2]) {
      const w = new Group()
      const t = new Mesh(new CylinderGeometry(0.55, 0.55, 0.4, 18), tyre)
      t.rotation.x = Math.PI / 2
      w.add(t)
      const hub = new Mesh(new CylinderGeometry(0.3, 0.3, 0.42, 12), hubM)
      hub.rotation.x = Math.PI / 2
      w.add(hub)
      w.position.set(x, 0.55, z)
      g.add(w)
      wheels.push(w)
    }
  }
  g.traverse((o) => {
    if (o.isMesh) o.castShadow = true
  })
  scene.add(g)

  const laneZ = LAYOUT.busLaneZ
  const stopX = LAYOUT.busStop.x + 3.5 // door lines up with the shelter
  const startX = -170
  const endX = 260
  g.position.set(startX, 0, laneZ)
  g.visible = false

  let state = 'away' // away | arriving | stopped | leaving
  let x = startX
  let v = 0
  let timer = 0
  let doorOpen = 0
  let onStop = null
  return {
    get state() {
      return state
    },
    get x() {
      return x
    },
    doorPoint: { x: stopX + L / 2 - 1.2, z: laneZ - 1.9 },
    // Starts a visit; onStop() fires once the door is open, then call depart().
    arrive(cb, tourists = false) {
      if (state !== 'away') return false
      state = 'arriving'
      x = startX
      v = 22
      onStop = cb
      g.visible = true
      orange.color.set(tourists ? '#e2382a' : '#f06a34')
      return true
    },
    depart() {
      if (state === 'stopped') {
        state = 'leaving'
        timer = 0
      }
    },
    update(dt) {
      if (state === 'away') return
      if (state === 'arriving') {
        const remaining = stopX - x
        const target = Math.max(1.6, Math.min(22, remaining * 0.7))
        v += (target - v) * Math.min(1, dt * 2.5)
        x += v * dt
        body.rotation.z = -Math.min(0.03, (22 - v) * 0.0025) * (remaining < 30 ? 1 : 0)
        if (remaining < 0.15) {
          x = stopX
          v = 0
          state = 'stopped'
          timer = 0
        }
      } else if (state === 'stopped') {
        timer += dt
        body.rotation.z *= 0.9
        doorOpen = Math.min(1, doorOpen + dt * 2)
        if (onStop && doorOpen >= 1) {
          const fn = onStop
          onStop = null
          fn()
        }
      } else if (state === 'leaving') {
        doorOpen = Math.max(0, doorOpen - dt * 2)
        if (doorOpen <= 0) {
          v = Math.min(24, v + dt * 6)
          x += v * dt
          body.rotation.z = Math.min(0.02, v * 0.002)
          if (x > endX) {
            state = 'away'
            g.visible = false
          }
        }
      }
      g.position.x = x
      doorL.rotation.y = doorOpen * 1.3
      doorR.rotation.y = -doorOpen * 1.3
      for (const w of wheels) w.rotation.z -= (v * dt) / 0.55
    },
    exhaust: () => ({ x: x - L / 2 - 0.2, y: 0.5, z: laneZ + 0.8, moving: v > 0.5 || state === 'stopped' }),
  }
}
