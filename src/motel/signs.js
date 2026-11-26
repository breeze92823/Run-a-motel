// The roadside signs: the tall retro MOTEL sign (sunburst, marquee bulbs that
// chase, a bulb-lined arrow, COLOR TV / AIR COND panel and a neon vacancy box
// with a flickering letter), the brick monument sign with the owner's name and
// star rating, and the LED vacancy board.
import {
  BoxGeometry,
  CanvasTexture,
  CylinderGeometry,
  ExtrudeGeometry,
  Group,
  InstancedMesh,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  PlaneGeometry,
  Shape,
  SphereGeometry,
  SRGBColorSpace,
} from 'three'
import { LAYOUT } from '../config.js'
import { addFixed, RAPIER } from '../physics.js'
import { neon, neonLevel } from '../propkit.js'
import { box, C, mat, rbox } from './kit.js'
import { FONT, paintBrick, paintSign, roundRect, tex } from './paint.js'
import { bush, planter } from './props.js'

function liveTex(c) {
  const t = new CanvasTexture(c)
  t.colorSpace = SRGBColorSpace
  t.anisotropy = 8
  return t
}

function face(parent, c, w, h, x, y, z, ry = 0, material = null) {
  const m = new Mesh(new PlaneGeometry(w, h), material ?? new MeshStandardMaterial({ map: liveTex(c), roughness: 0.55, transparent: true }))
  m.position.set(x, y, z)
  m.rotation.y = ry
  parent.add(m)
  return m
}

// Bulbs along a path, split into two alternating sets that chase.
function bulbRow(points, radius = 0.09) {
  const geo = new SphereGeometry(radius, 8, 6)
  const a = neon('#ffe9a0', 3.2)
  const b = neon('#ffe9a0', 3.2)
  const half = Math.ceil(points.length / 2)
  const ia = new InstancedMesh(geo, a, half)
  const ib = new InstancedMesh(geo, b, half)
  const o = new Object3D()
  let na = 0
  let nb = 0
  points.forEach(([x, y, z], i) => {
    o.position.set(x, y, z)
    o.updateMatrix()
    if (i % 2) ib.setMatrixAt(nb++, o.matrix)
    else ia.setMatrixAt(na++, o.matrix)
  })
  ia.count = na
  ib.count = nb
  const g = new Group()
  g.add(ia, ib)
  return { group: g, a, b }
}

function rectBulbs(w, h, z, step = 0.32) {
  const pts = []
  for (let x = -w / 2; x <= w / 2 + 1e-3; x += step) {
    pts.push([x, h / 2, z])
    pts.push([x, -h / 2, z])
  }
  for (let y = -h / 2 + step; y < h / 2 - 1e-3; y += step) {
    pts.push([-w / 2, y, z])
    pts.push([w / 2, y, z])
  }
  return pts
}

// "VACANCY" neon: `no` lights the NO, `flicker` dims one letter.
function paintVacancy(c, { no, flicker }) {
  const ctx = c.getContext('2d')
  const w = c.width
  const h = c.height
  ctx.fillStyle = '#1b0d14'
  ctx.fillRect(0, 0, w, h)
  ctx.font = `700 120px ${FONT}`
  ctx.textBaseline = 'middle'
  const word = 'NO VACANCY'
  let x = (w - ctx.measureText(word).width) / 2
  for (let i = 0; i < word.length; i++) {
    const ch = word[i]
    const cw = ctx.measureText(ch).width
    const isNo = i < 2
    const lit = (isNo ? no : true) && !(flicker && i === 7)
    ctx.shadowColor = '#ff3d8b'
    ctx.shadowBlur = lit ? 26 : 0
    ctx.fillStyle = lit ? '#ff5aa0' : '#43202c'
    ctx.fillText(ch, x, h / 2 + 6)
    x += cw
  }
  ctx.shadowBlur = 0
}

export function buildRoadSign(scene) {
  const g = new Group()
  const { x, z } = LAYOUT.sign
  const teal = mat(C.teal, { roughness: 0.4 })
  // Poles and base.
  for (const px of [-0.8, 0.8]) {
    box(g, 0.55, 13.5, 0.55, teal, px, 6.75, 0)
    box(g, 0.8, 0.6, 0.8, mat(C.tealDark), px, 0.3, 0)
  }
  addFixed(RAPIER.ColliderDesc.cuboid(1.3, 3, 0.5), { x, y: 3, z })
  const base = planter(4.2, 2.2, 9, { brick: true })
  g.add(base)
  for (let i = 0; i < 2; i++) {
    const b = bush(30 + i, 0.8)
    b.position.set(i ? 1.4 : -1.4, 0.3, 0.4)
    g.add(b)
  }

  // Sunburst on top.
  const sun = new Group()
  const yellow = mat('#ffc928', { roughness: 0.4, emissive: '#ffb000', emissiveIntensity: 0.25 })
  sun.add(new Mesh(new SphereGeometry(0.6, 16, 10), yellow))
  for (let i = 0; i < 12; i++) {
    const r = new Mesh(new BoxGeometry(0.1, 1.2 + (i % 2) * 0.6, 0.1), yellow)
    const a = (i / 12) * Math.PI * 2
    r.position.set(Math.sin(a) * 1.1, Math.cos(a) * 1.1, 0)
    r.rotation.z = -a
    sun.add(r)
    const tip = new Mesh(new SphereGeometry(0.12, 8, 6), neon('#fff3b0', 2.5))
    tip.position.set(Math.sin(a) * (1.8 + (i % 2) * 0.3), Math.cos(a) * (1.8 + (i % 2) * 0.3), 0)
    sun.add(tip)
  }
  sun.position.set(0, 15.2, 0)
  g.add(sun)

  // MOTEL box (slightly tilted), letters on both faces.
  const motel = new Group()
  rbox(motel, 7.2, 2.8, 0.7, 0.2, mat(C.orange, { roughness: 0.45 }), 0, 0, 0)
  box(motel, 6.6, 2.2, 0.72, mat('#ff8a4c', { roughness: 0.5 }), 0, 0, 0)
  const motelC = paintSign({ w: 1024, h: 380, bg: 'rgba(0,0,0,0)', border: null, lines: [{ t: 'MOTEL', size: 300, color: '#fff7ec', outline: '#c9431b', outlineW: 22, shadow: '#a8361a' }] })
  const motelMat = new MeshStandardMaterial({ map: liveTex(motelC), transparent: true, roughness: 0.4, emissiveMap: liveTex(motelC), emissive: '#fff2dc', emissiveIntensity: 0.15 })
  face(motel, null, 6.6, 2.45, 0, 0, 0.37, 0, motelMat)
  face(motel, null, 6.6, 2.45, 0, 0, -0.37, Math.PI, motelMat)
  const mb = bulbRow([...rectBulbs(7.0, 2.6, 0.38), ...rectBulbs(7.0, 2.6, -0.38)], 0.085)
  motel.add(mb.group)
  motel.position.set(0, 11.6, 0)
  motel.rotation.z = 0.05
  g.add(motel)

  // Arrow with bulbs.
  const arrow = new Shape()
  arrow.moveTo(-3.6, -0.45)
  arrow.lineTo(1.8, -0.45)
  arrow.lineTo(1.8, -1.2)
  arrow.lineTo(3.9, 0)
  arrow.lineTo(1.8, 1.2)
  arrow.lineTo(1.8, 0.45)
  arrow.lineTo(-3.6, 0.45)
  arrow.closePath()
  const ag = new ExtrudeGeometry(arrow, { depth: 0.5, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.06, bevelSegments: 2 })
  ag.translate(0, 0, -0.25)
  const am = new Mesh(ag, mat('#ffd23f', { roughness: 0.4 }))
  am.castShadow = true
  const arrowG = new Group()
  arrowG.add(am)
  const apts = []
  for (let ax = -3.3; ax < 1.7; ax += 0.38) {
    apts.push([ax, 0, 0.33])
    apts.push([ax, 0, -0.33])
  }
  for (let k = 0; k < 6; k++) {
    const t = k / 5
    apts.push([1.9 + t * 1.7, 1.0 - t * 0.9, 0.33], [1.9 + t * 1.7, -1.0 + t * 0.9, 0.33])
  }
  const ab = bulbRow(apts, 0.1)
  arrowG.add(ab.group)
  arrowG.position.set(1.0, 8.9, 0)
  g.add(arrowG)

  // COLOR TV / AIR COND panel.
  const tvC = paintSign({ w: 768, h: 300, bg: '#fff6e4', border: '#f1e2c6', borderW: 10, radius: 18, lines: [{ t: 'COLOR TV', size: 118, color: '#2a9f8f' }, { t: 'AIR COND', size: 118, color: '#2a9f8f' }] })
  rbox(g, 5.2, 2.1, 0.5, 0.12, mat('#fff6e4'), 0, 6.4, 0)
  face(g, tvC, 5.0, 1.95, 0, 6.4, 0.26)
  face(g, tvC, 5.0, 1.95, 0, 6.4, -0.26, Math.PI)

  // Neon vacancy box.
  const vacC = document.createElement('canvas')
  vacC.width = 1024
  vacC.height = 240
  paintVacancy(vacC, { no: true, flicker: false })
  const vacTex = liveTex(vacC)
  const vacMat = neon('#ffffff', 1.9, { map: vacTex })
  rbox(g, 5.0, 1.45, 0.55, 0.08, mat('#1b0d14', { roughness: 0.5 }), 0, 4.4, 0)
  face(g, null, 4.8, 1.25, 0, 4.4, 0.285, 0, vacMat)
  face(g, null, 4.8, 1.25, 0, 4.4, -0.285, Math.PI, vacMat)

  g.position.set(x, 0, z)
  g.rotation.y = -0.35
  scene.add(g)

  let full = true
  let flick = 0
  let flickOn = false
  let chase = 0
  return {
    setVacancy(hasRoom) {
      if (full === !hasRoom) return
      full = !hasRoom
      paintVacancy(vacC, { no: full, flicker: flickOn })
      vacTex.needsUpdate = true
    },
    update(dt, t) {
      chase += dt
      const on = Math.floor(chase * 3) % 2 === 0
      const lo = 0.25
      for (const set of [mb, ab]) {
        set.a.color.copy(set.a.userData.base).multiplyScalar(on ? neonLevel(set.a.userData.k) : lo)
        set.b.color.copy(set.b.userData.base).multiplyScalar(on ? lo : neonLevel(set.b.userData.k))
      }
      // A tired neon letter that drops out now and then.
      flick -= dt
      if (flick <= 0) {
        flickOn = !flickOn
        flick = flickOn ? 0.06 + Math.random() * 1.2 : 0.8 + Math.random() * 3
        paintVacancy(vacC, { no: full, flicker: flickOn })
        vacTex.needsUpdate = true
      }
      sun.rotation.z = Math.sin(t * 0.4) * 0.05
    },
  }
}

// Monument sign: brick planter base, white panel with the owner's motel name and stars.
function paintMonument(c, name, rating) {
  const ctx = c.getContext('2d')
  const w = c.width
  const h = c.height
  ctx.clearRect(0, 0, w, h)
  roundRect(ctx, 6, 6, w - 12, h - 12, 26)
  ctx.fillStyle = '#fbf8f1'
  ctx.fill()
  ctx.fillStyle = '#2a9f8f'
  ctx.fillRect(40, h - 70, w - 80, 22)
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  let size = 84
  ctx.font = `700 ${size}px ${FONT}`
  const title = name === 'Your' ? 'Your Motel' : `${name}'s Motel`
  while (ctx.measureText(title).width > w - 90 && size > 30) {
    size -= 4
    ctx.font = `700 ${size}px ${FONT}`
  }
  ctx.fillStyle = '#1f8d7f'
  ctx.fillText(title, w / 2, h * 0.36)
  const stars = 5
  const r = 26
  for (let i = 0; i < stars; i++) {
    const cx = w / 2 + (i - 2) * 66
    const cy = h * 0.62
    const fill = Math.max(0, Math.min(1, rating - i))
    ctx.beginPath()
    for (let k = 0; k < 10; k++) {
      const a = (k / 10) * Math.PI * 2 - Math.PI / 2
      const rr = k % 2 ? r * 0.45 : r
      ctx.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr)
    }
    ctx.closePath()
    ctx.fillStyle = '#e8e2d2'
    ctx.fill()
    ctx.save()
    ctx.clip()
    ctx.fillStyle = '#f5c51c'
    ctx.fillRect(cx - r, cy - r, r * 2 * fill, r * 2)
    ctx.restore()
  }
}

export function buildMonument(scene, name = 'Your') {
  const g = new Group()
  const { x, z } = LAYOUT.monument
  const brick = paintBrick(256, 8, 4, 41)
  const brickMat = mat('#ffffff', { map: tex(brick.color, { repeatX: 3, repeatY: 1 }), normalMap: tex(brick.normal, { repeatX: 3, repeatY: 1, srgb: false }), roughness: 0.9 })
  box(g, 7.2, 1.3, 2.0, brickMat, 0, 0.65, 0)
  box(g, 7.4, 0.14, 2.2, mat('#f1e8d8'), 0, 1.36, 0)
  const pl = planter(7.0, 1.6, 4, { brick: false })
  pl.position.set(0, 0, 1.9)
  g.add(pl)
  box(g, 6.0, 2.6, 0.5, mat('#f4efe4', { roughness: 0.5 }), 0, 2.75, 0)
  box(g, 6.2, 0.18, 0.6, mat(C.teal), 0, 4.1, 0)
  const c = document.createElement('canvas')
  c.width = 1024
  c.height = 420
  paintMonument(c, name, 4)
  const t = liveTex(c)
  const m = new MeshStandardMaterial({ map: t, roughness: 0.5, transparent: true })
  face(g, null, 5.8, 2.38, 0, 2.75, 0.26, 0, m)
  face(g, null, 5.8, 2.38, 0, 2.75, -0.26, Math.PI, m)
  for (let i = 0; i < 3; i++) {
    const b = bush(50 + i, 0.75)
    b.position.set(-3 + i * 3, 0.3, 2.0)
    g.add(b)
  }
  g.position.set(x, 0, z)
  g.rotation.y = 0.15
  scene.add(g)
  addFixed(RAPIER.ColliderDesc.cuboid(3.7, 1.5, 1.2), { x, y: 1.5, z })
  let lastName = name
  let lastRating = 4
  return {
    set(nameNext, rating) {
      if (nameNext === lastName && Math.abs(rating - lastRating) < 0.05) return
      lastName = nameNext
      lastRating = rating
      paintMonument(c, nameNext, rating)
      t.needsUpdate = true
    },
  }
}

// LED board on teal posts: "NO" (red, lit when full) over "VACANCY".
export function buildVacancyBoard(scene) {
  const g = new Group()
  const { x, z } = LAYOUT.vacancyBoard
  const teal = mat(C.teal)
  for (const px of [-1.9, 1.9]) box(g, 0.3, 3.2, 0.3, teal, px, 1.6, 0)
  rbox(g, 5.6, 2.8, 0.7, 0.1, mat('#3b2a24', { roughness: 0.5 }), 0, 4.3, 0)
  box(g, 0.4, 2.86, 0.75, mat('#2a1d18'), 2.8, 4.3, 0)
  const c = document.createElement('canvas')
  c.width = 1024
  c.height = 512
  const t = liveTex(c)
  const draw = (no) => {
    const ctx = c.getContext('2d')
    ctx.fillStyle = '#1c0f0c'
    ctx.fillRect(0, 0, 1024, 512)
    // LED dot grid.
    ctx.fillStyle = 'rgba(255,255,255,0.035)'
    for (let yy = 6; yy < 512; yy += 12) for (let xx = 6; xx < 1024; xx += 12) ctx.fillRect(xx, yy, 5, 5)
    ctx.textBaseline = 'middle'
    ctx.textAlign = 'left'
    ctx.font = `700 130px ${FONT}`
    ctx.shadowColor = '#ff2a1a'
    ctx.shadowBlur = no ? 30 : 0
    ctx.fillStyle = no ? '#ff3b2a' : '#3a1712'
    ctx.fillText('NO', 60, 120)
    ctx.font = `700 230px ${FONT}`
    ctx.shadowColor = '#ff8a1a'
    ctx.shadowBlur = 30
    ctx.fillStyle = '#ff8a2a'
    ctx.textAlign = 'center'
    ctx.fillText('VACANCY', 512, 330)
    ctx.shadowBlur = 0
  }
  draw(true)
  const m = neon('#ffffff', 1.8, { map: t })
  face(g, null, 5.3, 2.5, 0, 4.3, 0.36, 0, m)
  g.position.set(x, 0, z)
  g.rotation.y = 0.2
  scene.add(g)
  addFixed(RAPIER.ColliderDesc.cuboid(2.2, 1.6, 0.3), { x, y: 1.6, z })
  let full = true
  return {
    setVacancy(hasRoom) {
      if (full === !hasRoom) return
      full = !hasRoom
      draw(full)
      t.needsUpdate = true
    },
  }
}

export { CylinderGeometry }
