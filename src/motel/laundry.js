// The laundry annex (walk-in): cream walls over teal boards, a teal/cream checker
// floor, a front-loading washer with a soap box on top (its drum spins and suds
// rise while washing), a detergent shelf, a wall clock, the HOW IT WORKS poster,
// the LINEN shelf whose towel stacks show the clean-set count, a folding table
// with towels, and the dirty-linen basket by the door.
import {
  CircleGeometry,
  CylinderGeometry,
  DoubleSide,
  Group,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
  PointLight,
  TorusGeometry,
} from 'three'
import { LAYOUT } from '../config.js'
import { RAPIER, addFixed } from '../physics.js'
import { box, C, canvasTex, mat, rbox, stuccoMat, textures } from './kit.js'
import { canvas, FONT, paintChecker, paintSign, paintWainscot, roundRect, tex } from './paint.js'
import { holedWall, interiorMats } from './rooms.js'

function solid(hx, hy, hz, x, y, z) {
  addFixed(RAPIER.ColliderDesc.cuboid(hx, hy, hz), { x, y, z })
}
function plane(parent, c, w, h, x, y, z, ry = 0) {
  const m = new Mesh(new PlaneGeometry(w, h), new MeshStandardMaterial({ map: c.isTexture ? c : canvasTex(c), roughness: 0.7, transparent: true }))
  m.position.set(x, y, z)
  m.rotation.y = ry
  parent.add(m)
  return m
}

function paintHowItWorks() {
  const c = canvas(720, 480)
  const ctx = c.getContext('2d')
  roundRect(ctx, 0, 0, 720, 480, 16)
  ctx.fillStyle = '#2fb3a2'
  ctx.fill()
  roundRect(ctx, 14, 14, 692, 452, 10)
  ctx.fillStyle = '#fdf8ee'
  ctx.fill()
  ctx.fillStyle = '#1f9a8a'
  ctx.font = `700 58px ${FONT}`
  ctx.fillText('HOW IT WORKS', 40, 84)
  const steps = [
    ['1', 'Strip used beds → linen goes', 'in the basket by the door'],
    ['2', 'Bring the basket to the', 'washer → WASH'],
    ['3', 'Clean sets go on the LINEN', 'shelf → make beds with them'],
  ]
  steps.forEach(([n, a, b], i) => {
    const y = 160 + i * 110
    ctx.fillStyle = '#e2382a'
    ctx.font = `700 44px ${FONT}`
    ctx.fillText(n, 40, y)
    ctx.fillStyle = '#25313a'
    ctx.font = `700 34px ${FONT}`
    ctx.fillText(a, 90, y)
    ctx.fillText(b, 90, y + 42)
  })
  return c
}

export function buildLaundry(statics, live) {
  const M = interiorMats()
  const L = LAYOUT.laundry
  const lx = (L.x0 + L.x1) / 2
  const lw = L.x1 - L.x0
  const ld = L.front - L.back
  const lz = (L.front + L.back) / 2
  const wall = stuccoMat(C.wall)
  const teal = mat(C.teal, { roughness: 0.5 })
  const orange = mat(C.orange)
  const FLOOR_Y = 0.12
  const doorX0 = L.x0 + 1.4
  const doorX1 = L.x0 + 3.0
  const winX0 = L.x0 + 3.9
  const winX1 = L.x1 - 0.8
  const H = L.height

  // Shell: front with doorway + window, back and west walls (east is the motel's end wall).
  holedWall(statics, L.x0, L.x1, 0, H, [[doorX0, doorX1, FLOOR_Y, 2.55], [winX0, winX1, 1.0, 2.5]], L.front - 0.3, 0.3, wall, 3)
  box(statics, doorX0 - L.x0, 0.9, 0.05, stuccoMat(C.wallLow), (L.x0 + doorX0) / 2, 0.45, L.front + 0.02, 3)
  box(statics, L.x1 - doorX1, 0.9, 0.05, stuccoMat(C.wallLow), (doorX1 + L.x1) / 2, 0.45, L.front + 0.02, 3)
  box(statics, lw, H, 0.3, wall, lx, H / 2, L.back + 0.15, 3)
  box(statics, 0.3, H, ld, wall, L.x0 + 0.15, H / 2, lz, 3)
  box(statics, lw + 0.6, 0.35, ld + 0.9, orange, lx, H + 0.17, lz + 0.25)
  box(statics, lw + 0.7, 0.12, 0.2, mat('#fff3e2'), lx, H + 0.4, L.front + 0.66)
  solid(0.15, H / 2, ld / 2, L.x0 + 0.15, H / 2, lz)
  solid(lw / 2, H / 2, 0.15, lx, H / 2, L.back + 0.15)
  solid((doorX0 - L.x0) / 2, H / 2, 0.15, (L.x0 + doorX0) / 2, H / 2, L.front - 0.15)
  solid((L.x1 - doorX1) / 2, H / 2, 0.15, (doorX1 + L.x1) / 2, H / 2, L.front - 0.15)
  solid((doorX1 - doorX0) / 2, (H - 2.55) / 2, 0.15, (doorX0 + doorX1) / 2, 2.55 + (H - 2.55) / 2, L.front - 0.15)
  solid(lw / 2, 0.3, ld / 2, lx, H + 0.15, lz)
  // Doorway + window frames.
  box(statics, 0.12, 2.6, 0.36, teal, doorX0 + 0.06, 1.3, L.front - 0.15)
  box(statics, 0.12, 2.6, 0.36, teal, doorX1 - 0.06, 1.3, L.front - 0.15)
  box(statics, doorX1 - doorX0, 0.14, 0.36, teal, (doorX0 + doorX1) / 2, 2.6, L.front - 0.15)
  for (const x of [winX0, winX1]) box(statics, 0.1, 1.6, 0.36, teal, x, 1.75, L.front - 0.15)
  box(statics, winX1 - winX0, 0.1, 0.36, teal, (winX0 + winX1) / 2, 1.0, L.front - 0.15)
  box(statics, winX1 - winX0, 0.1, 0.36, teal, (winX0 + winX1) / 2, 2.5, L.front - 0.15)
  box(statics, winX1 - winX0 + 0.3, 0.08, 0.45, M.cap, (winX0 + winX1) / 2, 0.95, L.front - 0.1)
  const glass = new Mesh(new PlaneGeometry(winX1 - winX0, 1.5), new MeshStandardMaterial({ color: '#dffaff', transparent: true, opacity: 0.22, roughness: 0.05, depthWrite: false, side: DoubleSide }))
  glass.position.set((winX0 + winX1) / 2, 1.75, L.front - 0.15)
  live.add(glass)
  // Signs: big LAUNDRY over the door, a small one on the corner, WASH·DRY·FOLD in the window.
  const sign = paintSign({ w: 640, h: 170, bg: '#2fb3a2', border: '#ffffff', borderW: 14, radius: 14, lines: [{ t: 'LAUNDRY', size: 110, color: '#ffffff', shadow: '#1a6f65' }] })
  plane(statics, sign, 3.2, 0.85, (doorX0 + doorX1) / 2 + 0.8, 3.3, L.front + 0.03)
  const small = paintSign({ w: 300, h: 110, bg: '#fff6e5', border: '#2fb3a2', borderW: 8, radius: 10, lines: [{ t: 'LAUNDRY', size: 56, color: '#1d7d72' }] })
  plane(statics, small, 0.9, 0.33, L.x1 - 0.5, 2.9, L.front + 0.35, 0)
  const wdf = paintSign({ w: 400, h: 70, bg: '#fff6e5', border: null, lines: [{ t: 'WASH ♥ DRY ♥ FOLD', size: 40, color: '#e2382a' }] })
  plane(statics, wdf, 1.2, 0.21, (winX0 + winX1) / 2, 2.3, L.front - 0.33)

  // Interior lining: warm cream above teal boards.
  const cream = mat('#f6e4bf', { map: textures().stucco, roughness: 0.95 })
  const boards = mat('#ffffff', { map: tex(paintWainscot('#2fb79a')), roughness: 0.6 })
  const ix0 = L.x0 + 0.3
  const ix1 = L.x1 - 0.15
  const iz0 = L.back + 0.3
  const iz1 = L.front - 0.3
  const top = H - 0.05
  box(statics, ix1 - ix0, top - FLOOR_Y, 0.02, cream, (ix0 + ix1) / 2, (top + FLOOR_Y) / 2, iz0 + 0.01, 2)
  box(statics, 0.02, top - FLOOR_Y, iz1 - iz0, cream, ix0 + 0.01, (top + FLOOR_Y) / 2, (iz0 + iz1) / 2, 2)
  box(statics, 0.02, top - FLOOR_Y, iz1 - iz0, cream, ix1 - 0.01, (top + FLOOR_Y) / 2, (iz0 + iz1) / 2, 2)
  holedWall(statics, ix0, ix1, FLOOR_Y, top, [[doorX0, doorX1, 0, 2.55], [winX0, winX1, 1.0, 2.5]], iz1 - 0.02, 0.01, cream, 2)
  box(statics, ix1 - ix0, 1.2, 0.04, boards, (ix0 + ix1) / 2, FLOOR_Y + 0.6, iz0 + 0.03, 1.6, 1.2)
  box(statics, 0.04, 1.2, iz1 - iz0, boards, ix0 + 0.03, FLOOR_Y + 0.6, (iz0 + iz1) / 2, 1.6, 1.2)
  box(statics, 0.04, 1.2, iz1 - iz0, boards, ix1 - 0.03, FLOOR_Y + 0.6, (iz0 + iz1) / 2, 1.6, 1.2)
  box(statics, ix1 - ix0, 0.07, 0.08, M.cap, (ix0 + ix1) / 2, FLOOR_Y + 1.22, iz0 + 0.05)
  box(statics, 0.08, 0.07, iz1 - iz0, M.cap, ix0 + 0.05, FLOOR_Y + 1.22, (iz0 + iz1) / 2)
  box(statics, 0.08, 0.07, iz1 - iz0, M.cap, ix1 - 0.05, FLOOR_Y + 1.22, (iz0 + iz1) / 2)
  const floorTex = tex(paintChecker('#2fb79a', '#f6edd6', 128, 2), { repeatX: (ix1 - ix0) / 1.4, repeatY: (iz1 - iz0) / 1.4 })
  const fl = new Mesh(new PlaneGeometry(ix1 - ix0, iz1 - iz0), mat('#ffffff', { map: floorTex, roughness: 0.4 }))
  fl.rotation.x = -Math.PI / 2
  fl.position.set((ix0 + ix1) / 2, FLOOR_Y, (iz0 + iz1) / 2)
  fl.receiveShadow = true
  statics.add(fl)
  addFixed(RAPIER.ColliderDesc.cuboid((ix1 - ix0) / 2, 0.06, (iz1 - iz0) / 2), { x: (ix0 + ix1) / 2, y: 0.06, z: (iz0 + iz1) / 2 })
  box(statics, ix1 - ix0, 0.05, iz1 - iz0, mat('#fbf6ec'), (ix0 + ix1) / 2, top, (iz0 + iz1) / 2)
  const lightPanel = new MeshStandardMaterial({ color: '#ffffff', emissive: '#f6fbff', emissiveIntensity: 1.2 })
  const lp = new Mesh(new PlaneGeometry(1.6, 0.6), lightPanel)
  lp.rotation.x = Math.PI / 2
  lp.position.set((ix0 + ix1) / 2, top - 0.03, (iz0 + iz1) / 2)
  live.add(lp)
  const lamp = new PointLight('#fff3dc', 5, 9, 1.6)
  lamp.position.set((ix0 + ix1) / 2, top - 0.8, (iz0 + iz1) / 2)
  live.add(lamp)

  // The washer (back wall, centre) with a soap box on top.
  const wx = LAYOUT.laundryPoint.x
  const wz = iz0 + 0.5
  const body = mat('#f8f6ef', { roughness: 0.35 })
  const chrome = mat('#cfd6da', { metalness: 0.9, roughness: 0.2 })
  rbox(statics, 1.0, 1.1, 0.85, 0.08, body, wx, FLOOR_Y + 0.55, wz)
  box(statics, 0.96, 0.2, 0.06, mat('#d8efe6'), wx, FLOOR_Y + 0.98, wz + 0.42)
  box(statics, 0.32, 0.08, 0.02, mat('#2e3b3a'), wx - 0.2, FLOOR_Y + 0.98, wz + 0.46)
  for (let k = 0; k < 2; k++) {
    const knob = new Mesh(new CylinderGeometry(0.035, 0.035, 0.04, 10), chrome)
    knob.rotation.x = Math.PI / 2
    knob.position.set(wx + 0.12 + k * 0.16, FLOOR_Y + 0.98, wz + 0.46)
    statics.add(knob)
  }
  const ring = new Mesh(new TorusGeometry(0.3, 0.05, 10, 28), mat('#e7e3da', { roughness: 0.3 }))
  ring.position.set(wx, FLOOR_Y + 0.5, wz + 0.43)
  statics.add(ring)
  const drum = new Group()
  drum.position.set(wx, FLOOR_Y + 0.5, wz + 0.25)
  const drumBack = new Mesh(new CircleGeometry(0.28, 24), mat('#3c4b4e', { roughness: 0.4 }))
  drumBack.position.z = -0.1
  drum.add(drumBack)
  const clothes = ['#e2382a', '#2f6fd0', '#f2b632', '#ffffff', '#27a596'].map((c) => mat(c, { roughness: 0.9 }))
  for (let k = 0; k < 7; k++) {
    const cl = new Mesh(new CircleGeometry(0.05, 8), clothes[k % clothes.length])
    const a = (k / 7) * Math.PI * 2
    cl.position.set(Math.cos(a) * 0.16, Math.sin(a) * 0.16, -0.08)
    drum.add(cl)
  }
  live.add(drum)
  const glassDoor = new Mesh(new CircleGeometry(0.28, 24), new MeshStandardMaterial({ color: '#cfeff5', transparent: true, opacity: 0.3, roughness: 0.05 }))
  glassDoor.position.set(wx, FLOOR_Y + 0.5, wz + 0.44)
  live.add(glassDoor)
  const sudsMat = new MeshStandardMaterial({ color: '#f2fbff', transparent: true, opacity: 0, roughness: 0.3 })
  const suds = new Mesh(new CircleGeometry(0.27, 24, Math.PI, Math.PI), sudsMat)
  suds.position.set(wx, FLOOR_Y + 0.5, wz + 0.435)
  live.add(suds)
  const ledMat = new MeshStandardMaterial({ color: '#333', emissive: '#28ff7a', emissiveIntensity: 0 })
  const led = new Mesh(new PlaneGeometry(0.05, 0.04), ledMat)
  led.position.set(wx - 0.38, FLOOR_Y + 0.98, wz + 0.456)
  live.add(led)
  const soap = new Group()
  rbox(soap, 0.24, 0.3, 0.14, 0.02, mat('#f0742b'), 0, 0.15, 0)
  const soapC = paintSign({ w: 128, h: 64, bg: '#fff6e5', border: null, lines: [{ t: 'SOAP', size: 40, color: '#e2382a' }] })
  plane(soap, soapC, 0.18, 0.09, 0, 0.18, 0.076)
  soap.position.set(wx + 0.15, FLOOR_Y + 1.1, wz + 0.05)
  statics.add(soap)
  solid(0.5, 0.6, 0.45, wx, 0.6, wz)

  // Detergent shelf + wall clock above the washer.
  const shelfWood = mat('#c98a45', { map: textures().wood })
  box(statics, 1.6, 0.06, 0.3, shelfWood, wx - 0.2, 2.25, iz0 + 0.17)
  for (const x of [-0.7, 0.4]) box(statics, 0.04, 0.24, 0.24, teal, wx - 0.2 + x, 2.1, iz0 + 0.14)
  ;[['#2fb39c', 'SOAP'], ['#f0742b', 'SOFT'], ['#f6d33c', 'FRESH']].forEach(([col, t], i) => {
    const b = new Group()
    rbox(b, 0.18, 0.34, 0.14, 0.03, mat(col, { roughness: 0.35 }), 0, 0.17, 0)
    const cap = new Mesh(new CylinderGeometry(0.035, 0.035, 0.06, 10), mat('#ffffff'))
    cap.position.y = 0.37
    b.add(cap)
    const lc = paintSign({ w: 128, h: 64, bg: '#fffaf0', border: null, lines: [{ t, size: 34, color: '#333' }] })
    plane(b, lc, 0.14, 0.07, 0, 0.2, 0.076)
    b.position.set(wx - 0.75 + i * 0.25, 2.28, iz0 + 0.17)
    statics.add(b)
  })
  for (let j = 0; j < 3; j++) rbox(statics, 0.42, 0.07, 0.24, 0.03, mat('#fbf4e6'), wx + 0.25, 2.32 + j * 0.075, iz0 + 0.17)
  const clockFace = new Mesh(new CylinderGeometry(0.26, 0.26, 0.04, 24), mat('#ffffff'))
  clockFace.rotation.x = Math.PI / 2
  clockFace.position.set(wx + 0.9, 2.95, iz0 + 0.06)
  statics.add(clockFace)
  const rim = new Mesh(new TorusGeometry(0.26, 0.03, 8, 24), mat('#f06a34'))
  rim.position.set(wx + 0.9, 2.95, iz0 + 0.08)
  statics.add(rim)
  const handH = box(live, 0.02, 0.12, 0.01, mat('#222'), 0, 0.06, 0)
  const handM = box(live, 0.015, 0.19, 0.01, mat('#222'), 0, 0.095, 0)
  const hands = [new Group(), new Group()]
  hands[0].add(handH)
  hands[1].add(handM)
  for (const h of hands) {
    h.position.set(wx + 0.9, 2.95, iz0 + 0.09)
    live.add(h)
  }

  // HOW IT WORKS poster on the west wall.
  plane(statics, paintHowItWorks(), 1.6, 1.07, ix0 + 0.03, 2.15, lz - 0.3, Math.PI / 2)

  // LINEN shelf (east wall): wooden open shelving; towel stacks show the clean sets.
  const shelf = new Group()
  const sx = ix1 - 0.3
  const sz = lz - 0.6
  const wood = mat('#9c5a26', { map: textures().wood, roughness: 0.7 })
  for (const dz of [-0.75, 0.75]) box(shelf, 0.5, 2.2, 0.06, wood, 0, 1.1, dz)
  for (const y of [0.25, 0.85, 1.45, 2.05]) box(shelf, 0.5, 0.05, 1.5, mat('#d99a55', { map: textures().wood }), 0, y, 0)
  box(shelf, 0.03, 2.2, 1.5, wood, 0.24, 1.1, 0)
  shelf.position.set(sx, FLOOR_Y, sz)
  statics.add(shelf)
  solid(0.3, 1.2, 0.8, sx, 1.2, sz)
  const linenC = canvas(320, 90)
  const linenTex = canvasTex(linenC)
  const drawLinen = (n) => {
    const ctx = linenC.getContext('2d')
    ctx.clearRect(0, 0, 320, 90)
    roundRect(ctx, 0, 0, 320, 90, 10)
    ctx.fillStyle = '#fbf2df'
    ctx.fill()
    ctx.fillStyle = '#1d6f63'
    ctx.font = `700 54px ${FONT}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(`LINEN · ${n}`, 160, 48)
    linenTex.needsUpdate = true
  }
  drawLinen(0)
  plane(live, linenTex, 0.8, 0.23, sx - 0.06, FLOOR_Y + 2.35, sz - 0.2, -Math.PI / 2)
  const stackCols = ['#f0742b', '#fbf4e6', '#2fb39c', '#ffffff']
  const stacks = []
  for (let k = 0; k < 12; k++) {
    const st = new Group()
    rbox(st, 0.36, 0.13, 0.42, 0.05, mat(stackCols[k % 4], { roughness: 1 }), 0, 0.07, 0)
    rbox(st, 0.36, 0.13, 0.42, 0.05, mat(stackCols[(k + 1) % 4], { roughness: 1 }), 0, 0.2, 0.01)
    const row = Math.floor(k / 3)
    st.position.set(sx - 0.02, FLOOR_Y + [1.45, 0.85, 0.25, 2.05][row % 4] + 0.03, sz - 0.48 + (k % 3) * 0.48)
    st.visible = false
    live.add(st)
    stacks.push(st)
  }

  // Folding table with towels (west side, by the door).
  const tbl = new Group()
  rbox(tbl, 1.0, 0.06, 1.8, 0.02, mat('#fbf8f1', { roughness: 0.5 }), 0, 0.9, 0)
  box(tbl, 1.02, 0.05, 1.82, teal, 0, 0.86, 0)
  for (const [x, z] of [[-0.42, -0.8], [0.42, -0.8], [-0.42, 0.8], [0.42, 0.8]]) {
    const leg = new Mesh(new CylinderGeometry(0.03, 0.03, 0.86, 8), mat('#f0f0f0', { metalness: 0.5 }))
    leg.position.set(x, 0.43, z)
    tbl.add(leg)
  }
  box(tbl, 0.9, 0.03, 0.03, teal, 0, 0.25, -0.8)
  box(tbl, 0.9, 0.03, 0.03, teal, 0, 0.25, 0.8)
  for (let i = 0; i < 2; i++) {
    for (let j = 0; j < 3; j++) {
      rbox(tbl, 0.5, 0.08, 0.6, 0.03, mat(j % 2 ? '#f6e9c8' : '#fbf4e6', { roughness: 1 }), 0, 0.97 + j * 0.085, -0.4 + i * 0.8)
      box(tbl, 0.51, 0.02, 0.06, mat('#2fb39c'), 0, 0.97 + j * 0.085, -0.4 + i * 0.8 + 0.22)
    }
  }
  tbl.position.set(ix0 + 0.65, FLOOR_Y, lz + 0.9)
  statics.add(tbl)
  solid(0.5, 0.5, 0.9, ix0 + 0.65, 0.5, lz + 0.9)

  // Dirty-linen basket inside the door (grows fuller as beds get stripped).
  const basket = new Group()
  const wicker = mat('#d2a668', { roughness: 0.95, side: DoubleSide })
  basket.add(new Mesh(new CylinderGeometry(0.42, 0.34, 0.55, 16, 1, true), wicker))
  basket.children[0].position.y = 0.28
  const bottom = new Mesh(new CircleGeometry(0.34, 16), wicker)
  bottom.rotation.x = -Math.PI / 2
  bottom.position.y = 0.02
  basket.add(bottom)
  for (const s of [-1, 1]) {
    const handle = new Mesh(new TorusGeometry(0.09, 0.02, 6, 10, Math.PI), mat('#b8884e'))
    handle.position.set(s * 0.42, 0.5, 0)
    handle.rotation.y = Math.PI / 2
    basket.add(handle)
  }
  const pile = new Group()
  ;['#ffffff', '#e8e0cf', '#bfe8e2', '#f6d9c0'].forEach((c, i) => {
    const p = rbox(pile, 0.4, 0.18, 0.34, 0.08, mat(c, { roughness: 1 }), Math.sin(i * 2) * 0.1, 0.0 + i * 0.07, Math.cos(i * 2) * 0.08)
    p.rotation.set(i * 0.4, i, i * 0.3)
  })
  basket.add(pile)
  live.add(basket)
  const basketHome = { x: doorX1 + 0.55, y: FLOOR_Y, z: iz1 - 0.6 }
  basket.position.set(basketHome.x, basketHome.y, basketHome.z)

  return {
    washer: { x: wx, z: wz + 0.95, drum, suds: sudsMat, led: ledMat },
    shelf: { x: sx - 0.7, z: sz, stacks, draw: drawLinen },
    basket: { group: basket, pile, home: basketHome },
    clock: hands,
    bounds: { x0: ix0, x1: ix1, z0: iz0, z1: iz1 },
    door: { x: (doorX0 + doorX1) / 2, z: L.front },
    lamp,
  }
}
