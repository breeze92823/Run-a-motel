// The walk-in office: glass entrance with a yellow rug, mint striped wallpaper
// over teal boards, a checker floor, the L-shaped reception counter (phone,
// bell, guest book, cash register, coffee machine, tips jar, brochures), the
// RECEPTION / COFFEE signs, the ROOM KEYS board with a key per room and the
// ROOM SERVICE bell strip, the OUR GUESTS board (guest types met so far), the
// HELP WANTED board (opens hiring) and a ceiling fan with a water stain above.
import {
  CircleGeometry,
  CylinderGeometry,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  PointLight,
  SphereGeometry,
  TorusGeometry,
} from 'three'
import { LAYOUT } from '../config.js'
import { RAPIER, addFixed } from '../physics.js'
import { box, C, canvasTex, mat, rbox, stuccoMat, textures } from './kit.js'
import { canvas, FONT, paintChecker, paintNeon, paintSign, paintStain, paintWainscot, roundRect, tex } from './paint.js'
import { DOOR_H, holedWall, interiorMats } from './rooms.js'
import { detailOffice } from './detail.js'

const B = LAYOUT.building
const FH = B.floorH
const FRONT = B.front
const BACK = B.front - B.depth
const FLOOR_Y = 0.2

function solid(hx, hy, hz, x, y, z) {
  addFixed(RAPIER.ColliderDesc.cuboid(hx, hy, hz), { x, y, z })
}

function plane(parent, c, w, h, x, y, z, ry = 0, extra = {}) {
  const m = new Mesh(new PlaneGeometry(w, h), new MeshStandardMaterial({ map: c.isTexture ? c : canvasTex(c), roughness: 0.7, transparent: true, ...extra }))
  m.position.set(x, y, z)
  m.rotation.y = ry
  parent.add(m)
  return m
}

function paintStripes(a = '#cdeedd', b = '#b3e2cb', w = 256) {
  const c = canvas(w)
  const ctx = c.getContext('2d')
  ctx.fillStyle = a
  ctx.fillRect(0, 0, w, w)
  for (let x = 0; x < w; x += 32) {
    ctx.fillStyle = b
    ctx.fillRect(x, 0, 12, w)
    ctx.fillStyle = 'rgba(255,255,255,0.35)'
    ctx.fillRect(x + 20, 0, 3, w)
  }
  return c
}

// Corkboard with a title and a grid of cards; returns { canvas, redraw(cards) }.
function corkboard(title, titleColor = '#e2382a') {
  const c = canvas(640, 440)
  const draw = (cards) => {
    const ctx = c.getContext('2d')
    roundRect(ctx, 0, 0, 640, 440, 22)
    ctx.fillStyle = '#e0531f'
    ctx.fill()
    roundRect(ctx, 22, 22, 596, 396, 10)
    ctx.fillStyle = '#d39a52'
    ctx.fill()
    // Cork speckle.
    for (let i = 0; i < 900; i++) {
      ctx.fillStyle = i % 2 ? 'rgba(120,70,20,0.18)' : 'rgba(255,230,180,0.2)'
      ctx.fillRect(30 + ((i * 97) % 580), 30 + ((i * 53) % 380), 3, 3)
    }
    ctx.save()
    ctx.translate(320, 64)
    ctx.rotate(-0.05)
    roundRect(ctx, -170, -30, 340, 60, 8)
    ctx.fillStyle = '#fbf2e2'
    ctx.fill()
    ctx.fillStyle = titleColor
    ctx.font = `700 40px ${FONT}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(title, 0, 2)
    ctx.restore()
    cards.forEach((card, i) => {
      const col = i % 3
      const row = Math.floor(i / 3)
      const x = 60 + col * 180
      const y = 120 + row * 150
      ctx.save()
      ctx.translate(x + 70, y + 60)
      ctx.rotate(((i * 37) % 7 - 3) * 0.02)
      ctx.fillStyle = '#fbf6ec'
      ctx.fillRect(-70, -62, 140, 124)
      ctx.fillStyle = '#2a9f8f'
      ctx.beginPath()
      ctx.arc(0, -66, 7, 0, Math.PI * 2)
      ctx.fill()
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.font = `700 52px ${FONT}`
      ctx.fillStyle = card.known ? card.color ?? '#333' : '#c9b99f'
      ctx.fillText(card.known ? card.icon : '?', 0, -18)
      ctx.font = `700 20px ${FONT}`
      ctx.fillStyle = '#2c2c2c'
      ctx.fillText(card.known ? card.name : '???', 0, 26)
      if (card.tag) {
        roundRect(ctx, -56, 38, 112, 22, 10)
        ctx.fillStyle = card.tagColor ?? '#5ad27a'
        ctx.fill()
        ctx.font = `700 15px ${FONT}`
        ctx.fillStyle = '#123'
        ctx.fillText(card.tag, 0, 50)
      }
      ctx.restore()
    })
  }
  return { canvas: c, draw }
}

export function buildOffice(statics, live) {
  const M = interiorMats()
  const O = LAYOUT.office
  const ix0 = O.x0 + 0.3
  const ix1 = O.x1 - 0.1
  const iz0 = BACK + 0.3
  const iz1 = FRONT - 0.3
  const ox = (ix0 + ix1) / 2
  const oz = (iz0 + iz1) / 2
  const doorX = LAYOUT.officeDoorX
  const winX0 = doorX + 1.0
  const winX1 = O.x1 - 0.5
  const teal = mat(C.teal, { roughness: 0.5 })

  // Front: stucco with a door and a display window; lower orange band outside.
  holedWall(statics, O.x0, O.x1, 0, FH, [[doorX - 0.62, doorX + 0.62, FLOOR_Y, FLOOR_Y + 2.45], [winX0, winX1, 0.86, 2.74]], FRONT - 0.3, 0.3, stuccoMat(C.wall), 3)
  box(statics, doorX - 0.75 - O.x0, 1.0, 0.06, stuccoMat(C.wallLow), (O.x0 + doorX - 0.75) / 2, 0.5, FRONT + 0.03, 3)
  box(statics, winX1 - winX0 + 0.3, 0.84, 0.06, stuccoMat(C.wallLow), (winX0 + winX1) / 2, 0.42, FRONT + 0.03, 3)
  solid((doorX - 0.62 - O.x0) / 2, FH / 2, 0.16, (O.x0 + doorX - 0.62) / 2, FH / 2, FRONT - 0.15)
  solid((O.x1 - doorX - 0.62) / 2, FH / 2, 0.16, (doorX + 0.62 + O.x1) / 2, FH / 2, FRONT - 0.15)
  solid(0.62, (FH - 2.65) / 2, 0.16, doorX, 2.65 + (FH - 2.65) / 2, FRONT - 0.15)
  // Door frame + window frame (teal).
  // (frame faces sit 1 cm inside the opening so they never share a plane with the hole's faces)
  box(statics, 0.12, 2.55, 0.34, teal, doorX - 0.67, 1.47, FRONT - 0.12)
  box(statics, 0.12, 2.55, 0.34, teal, doorX + 0.67, 1.47, FRONT - 0.12)
  box(statics, 1.48, 0.14, 0.34, teal, doorX, 2.71, FRONT - 0.12)
  for (const x of [winX0, (winX0 + winX1) / 2, winX1]) box(statics, 0.12, 1.98, 0.34, teal, x, 1.8, FRONT - 0.12)
  box(statics, winX1 - winX0 + 0.12, 0.12, 0.34, teal, (winX0 + winX1) / 2, 0.86, FRONT - 0.12)
  box(statics, winX1 - winX0 + 0.12, 0.12, 0.34, teal, (winX0 + winX1) / 2, 2.74, FRONT - 0.12)
  box(statics, winX1 - winX0 + 0.4, 0.08, 0.54, M.cap, (winX0 + winX1) / 2, 0.835, FRONT - 0.2)
  const glass = new MeshStandardMaterial({ color: '#dffaff', roughness: 0.05, transparent: true, opacity: 0.22, depthWrite: false, side: DoubleSide })
  const wg = new Mesh(new PlaneGeometry(winX1 - winX0, 1.86), glass)
  wg.position.set((winX0 + winX1) / 2, 1.8, FRONT - 0.12)
  live.add(wg)
  // Glass door on a hinge (auto-opens).
  const pivot = new Group()
  pivot.position.set(doorX - 0.6, FLOOR_Y, FRONT - 0.12)
  const leaf = new Group()
  leaf.position.x = 0.6
  pivot.add(leaf)
  box(leaf, 1.2, 0.12, 0.06, teal, 0, 0.06, 0)
  box(leaf, 1.2, 0.12, 0.06, teal, 0, 2.38, 0)
  box(leaf, 0.08, 2.44, 0.06, teal, -0.56, 1.22, 0)
  box(leaf, 0.08, 2.44, 0.06, teal, 0.56, 1.22, 0)
  const dg = new Mesh(new PlaneGeometry(1.06, 2.2), glass)
  dg.position.y = 1.22
  leaf.add(dg)
  box(leaf, 0.7, 0.05, 0.12, mat('#d9d9d9', { metalness: 0.9, roughness: 0.2 }), 0, 1.05, 0)
  const sign24 = paintSign({ w: 256, h: 160, bg: '#fff4df', border: null, radius: 6, lines: [{ t: 'OPEN', size: 64, color: '#1fae55' }, { t: '24H', size: 56, color: '#1fae55' }] })
  plane(leaf, sign24, 0.42, 0.26, 0.25, 1.65, 0.035)
  plane(leaf, sign24, 0.42, 0.26, 0.25, 1.65, -0.035, Math.PI)
  live.add(pivot)
  // Neon OPEN sign hanging in the window.
  const openSign = paintNeon('OPEN', { w: 256, h: 110, color: '#ff4fa0', size: 70, bg: '#14202a' })
  const om = new Mesh(new PlaneGeometry(0.95, 0.41), new MeshBasicMaterial({ map: canvasTex(openSign), side: DoubleSide }))
  om.position.set(winX0 + 0.75, 2.15, FRONT - 0.3)
  live.add(om)
  box(statics, 1.03, 0.49, 0.03, mat('#28d9e0', { emissive: '#28d9e0', emissiveIntensity: 0.8 }), winX0 + 0.75, 2.15, FRONT - 0.33)
  // OFFICE sign under the balcony.
  const officeSign = paintSign({ w: 512, h: 170, bg: '#fff1dc', border: '#e8582c', borderW: 16, radius: 16, lines: [{ t: 'OFFICE', size: 104, color: '#f06a34' }] })
  plane(statics, officeSign, 2.0, 0.66, doorX + 0.6, FH - 0.95, FRONT + B.walk - 0.25)
  box(statics, 0.03, 0.42, 0.03, mat('#555'), doorX - 0.2, FH - 0.42, FRONT + B.walk - 0.25)
  box(statics, 0.03, 0.42, 0.03, mat('#555'), doorX + 1.4, FH - 0.42, FRONT + B.walk - 0.25)
  box(statics, 1.4, 0.03, 0.8, mat('#c8352a', { roughness: 1 }), doorX, 0.215, FRONT + 0.6)

  // Back wall with a window looking out back (the junk yard).
  holedWall(statics, O.x0, O.x1, 0, FH, [[ox - 1.3, ox + 1.3, 1.25, 2.55]], BACK, 0.3, stuccoMat(C.wall), 3)
  solid((O.x1 - O.x0) / 2, FH / 2, 0.16, (O.x0 + O.x1) / 2, FH / 2, BACK + 0.15)
  const bg = new Mesh(new PlaneGeometry(2.6, 1.3), glass)
  bg.position.set(ox, 1.9, BACK + 0.15)
  live.add(bg)
  for (const x of [ox - 1.3, ox, ox + 1.3]) box(statics, 0.1, 1.4, 0.36, teal, x, 1.9, BACK + 0.15)
  box(statics, 2.7, 0.1, 0.36, teal, ox, 1.25, BACK + 0.15)
  box(statics, 2.7, 0.1, 0.36, teal, ox, 2.55, BACK + 0.15)

  // Lining: striped wallpaper + teal boards on all four walls.
  const stripe = mat('#ffffff', { map: tex(paintStripes()), roughness: 0.95 })
  const boards = mat('#ffffff', { map: tex(paintWainscot('#25b98a')), roughness: 0.6 })
  const top = FH - 0.1
  const wallH = top - FLOOR_Y
  const lineX = (x0, x1, z, f, holes) => {
    holedWall(statics, x0, x1, FLOOR_Y, top, holes, z, 0.01, stripe, 1.2)
    box(statics, x1 - x0, 1.05, 0.04, boards, (x0 + x1) / 2, FLOOR_Y + 0.525, z + f * 0.02, 1.6, 1.05)
    box(statics, x1 - x0, 0.07, 0.08, M.cap, (x0 + x1) / 2, FLOOR_Y + 1.08, z + f * 0.03)
  }
  lineX(ix0, ix1, iz0, 1, [[ox - 1.3, ox + 1.3, 1.25, 2.55]])
  // Front lining: above the wainscot only, around door + window.
  holedWall(statics, ix0, ix1, FLOOR_Y, top, [[doorX - 0.62, doorX + 0.62, FLOOR_Y, FLOOR_Y + 2.45], [winX0, winX1, 0.86, 2.74]], iz1 - 0.02, 0.01, stripe, 1.2)
  for (const [z0, z1, x, f] of [[iz0, iz1, ix0, 1], [iz0, iz1, ix1, -1]]) {
    box(statics, 0.02, wallH, z1 - z0, stripe, x, FLOOR_Y + wallH / 2, (z0 + z1) / 2, 1.2)
    box(statics, 0.04, 1.05, z1 - z0, boards, x + f * 0.02, FLOOR_Y + 0.525, (z0 + z1) / 2, 1.6, 1.05)
    box(statics, 0.08, 0.07, z1 - z0, M.cap, x + f * 0.03, FLOOR_Y + 1.08, (z0 + z1) / 2)
  }
  // Floor (big checker), ceiling with a water stain.
  const fl = new Mesh(new PlaneGeometry(ix1 - ix0, iz1 - iz0), mat('#ffffff', { map: tex(paintChecker('#e6c79a', '#c99a62', 128, 2), { repeatX: (ix1 - ix0) / 1.3, repeatY: (iz1 - iz0) / 1.3 }), roughness: 0.45 }))
  fl.rotation.x = -Math.PI / 2
  fl.position.set(ox, FLOOR_Y + 0.005, oz)
  fl.receiveShadow = true
  statics.add(fl)
  box(statics, ix1 - ix0, 0.06, iz1 - iz0, mat('#e9dcc6', { map: textures().stucco, roughness: 1 }), ox, top, oz)
  const leak = new Mesh(new PlaneGeometry(2.2, 2.2), new MeshStandardMaterial({ map: tex(paintStain(77), { wrap: false }), transparent: true, depthWrite: false, opacity: 0.6 }))
  leak.rotation.x = Math.PI / 2
  leak.position.set(ox + 1.2, top - 0.035, oz + 1.0)
  statics.add(leak)
  // Yellow rug with a red border at the entrance.
  rbox(statics, 1.8, 0.025, 2.6, 0.01, mat('#d6402b', { roughness: 1 }), doorX + 0.3, FLOOR_Y + 0.013, iz1 - 1.6)
  rbox(statics, 1.5, 0.03, 2.3, 0.01, mat('#f2c03a', { roughness: 1 }), doorX + 0.3, FLOOR_Y + 0.015, iz1 - 1.6)

  // --- Reception counter (L): a long run across the room and a short return.
  const cz = LAYOUT.counterZ
  const cx0 = ix0
  const cx1 = O.x1 - 2.4 // gap on the east side to walk behind
  const wood = mat('#b5652e', { map: textures().wood, roughness: 0.6 })
  const panel = mat('#d58a4a', { map: textures().wood, roughness: 0.6 })
  const topMat = mat('#efe2cc', { roughness: 0.35 })
  const red = mat('#e2482c', { roughness: 0.5 })
  const runW = cx1 - cx0
  rbox(statics, runW, 1.05, 0.7, 0.04, wood, (cx0 + cx1) / 2, FLOOR_Y + 0.52, cz - 0.35)
  box(statics, runW + 0.02, 0.12, 0.72, red, (cx0 + cx1) / 2, FLOOR_Y + 0.95, cz - 0.35)
  rbox(statics, runW + 0.02, 0.07, 0.95, 0.02, topMat, (cx0 + cx1) / 2 + 0.09, FLOOR_Y + 1.08, cz - 0.4) // stops short of the wall cap
  for (let x = cx0 + 0.55; x < cx1 - 0.3; x += 1.05) box(statics, 0.8, 0.62, 0.03, panel, x, FLOOR_Y + 0.45, cz + 0.005)
  // Return toward the back wall.
  const rz0 = cz - 0.7
  const rz1 = cz - 2.6
  rbox(statics, 0.7, 1.05, rz0 - rz1, 0.04, wood, cx1 - 0.35, FLOOR_Y + 0.52, (rz0 + rz1) / 2)
  box(statics, 0.72, 0.12, rz0 - rz1 + 0.02, red, cx1 - 0.35, FLOOR_Y + 0.95, (rz0 + rz1) / 2)
  rbox(statics, 0.95, 0.07, rz0 - rz1 + 0.2, 0.02, topMat, cx1 - 0.4, FLOOR_Y + 1.08, (rz0 + rz1) / 2)
  solid(runW / 2, 0.6, 0.38, (cx0 + cx1) / 2, 0.6, cz - 0.35)
  solid(0.38, 0.6, (rz0 - rz1) / 2, cx1 - 0.35, 0.6, (rz0 + rz1) / 2)
  // Counter props.
  const ctop = FLOOR_Y + 1.12
  const phone = new Group()
  rbox(phone, 0.36, 0.14, 0.28, 0.05, mat('#e0261c', { roughness: 0.3 }), 0, 0.07, 0)
  const handset = rbox(phone, 0.42, 0.08, 0.1, 0.04, mat('#e0261c', { roughness: 0.3 }), 0, 0.18, -0.02)
  void handset
  const dial = new Mesh(new CylinderGeometry(0.09, 0.09, 0.02, 16), mat('#f4f4f4'))
  dial.position.set(0, 0.15, 0.08)
  dial.rotation.x = 0.5
  phone.add(dial)
  // The phone sits on the return (room service calls); it shakes while ringing.
  phone.position.set(LAYOUT.phone.x, ctop, LAYOUT.phone.z)
  phone.rotation.y = Math.PI / 2
  live.add(phone)
  const bell = new Mesh(new SphereGeometry(0.11, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat(C.brass, { metalness: 0.9, roughness: 0.25 }))
  bell.position.set(LAYOUT.deskPoint.x, ctop, cz - 0.25)
  live.add(bell)
  const bellBase = new Mesh(new CylinderGeometry(0.13, 0.13, 0.03, 16), mat('#333'))
  bellBase.position.set(LAYOUT.deskPoint.x, ctop, cz - 0.25)
  statics.add(bellBase)
  // Guest book (open) and a pen.
  rbox(statics, 0.55, 0.04, 0.38, 0.01, mat('#8b1e1e'), LAYOUT.deskPoint.x - 0.85, ctop, cz - 0.4)
  box(statics, 0.25, 0.02, 0.34, mat('#fffaf0'), LAYOUT.deskPoint.x - 0.98, ctop + 0.03, cz - 0.4)
  box(statics, 0.25, 0.02, 0.34, mat('#fffaf0'), LAYOUT.deskPoint.x - 0.72, ctop + 0.03, cz - 0.4)
  // Cash pile next to the register (bills stack up as guests pay; game.js shows them).
  const cashPile = new Group()
  cashPile.position.set(LAYOUT.cashPile.x, ctop, LAYOUT.cashPile.z)
  live.add(cashPile)
  // Cash register with a price flag and THANK YOU plate.
  const reg = new Group()
  rbox(reg, 0.7, 0.32, 0.55, 0.06, mat('#2fb39c', { roughness: 0.35 }), 0, 0.16, 0)
  const keysTop = rbox(reg, 0.62, 0.16, 0.3, 0.04, mat('#2fb39c', { roughness: 0.35 }), 0, 0.36, 0.08)
  keysTop.rotation.x = -0.35
  for (let r = 0; r < 3; r++) for (let k = 0; k < 5; k++) {
    const key = new Mesh(new CylinderGeometry(0.03, 0.03, 0.03, 8), mat('#fbf2df'))
    key.position.set(-0.22 + k * 0.11, 0.42 - r * 0.03, 0.04 + r * 0.07)
    reg.add(key)
  }
  rbox(reg, 0.36, 0.16, 0.08, 0.03, mat('#2fb39c'), 0, 0.58, -0.12)
  const priceC = paintSign({ w: 256, h: 100, bg: '#16261f', border: '#bfe9de', borderW: 6, radius: 6, lines: [{ t: '$1.50', size: 66, color: '#f6fff9' }] })
  plane(reg, priceC, 0.32, 0.12, 0, 0.58, -0.075)
  const thanks = paintSign({ w: 256, h: 80, bg: '#2fb39c', border: '#f2d388', borderW: 6, radius: 30, lines: [{ t: 'THANK YOU', size: 40, color: '#f2d388', font: 'Georgia, serif' }] })
  plane(reg, thanks, 0.46, 0.14, 0, 0.18, 0.28)
  reg.position.set(cx1 - 0.95, ctop, cz - 0.42)
  reg.rotation.y = Math.PI
  statics.add(reg)
  // Tips jar with coins.
  const jar = new Mesh(new CylinderGeometry(0.1, 0.1, 0.24, 14, 1, true), new MeshStandardMaterial({ color: '#e8fbff', transparent: true, opacity: 0.35, roughness: 0.05, side: DoubleSide }))
  const jarX = LAYOUT.foodServe.x + 0.75
  jar.position.set(jarX, ctop + 0.12, cz - 0.4)
  live.add(jar)
  for (let i = 0; i < 6; i++) {
    const coin = new Mesh(new CylinderGeometry(0.03, 0.03, 0.01, 10), mat(i % 2 ? '#f2c232' : '#c9a35a', { metalness: 0.8, roughness: 0.3 }))
    coin.position.set(jarX + Math.sin(i) * 0.04, ctop + 0.02 + i * 0.015, cz - 0.4 + Math.cos(i) * 0.04)
    statics.add(coin)
  }
  const tipsC = paintSign({ w: 128, h: 64, bg: '#f6d33c', border: null, lines: [{ t: 'TIPS', size: 40, color: '#7a3b00' }] })
  plane(statics, tipsC, 0.14, 0.07, jarX, ctop + 0.16, cz - 0.29)
  // FOOD PICKUP plate at the west end of the counter (walk-in orders are served here).
  const pickC = paintSign({ w: 384, h: 96, bg: '#2fb39c', border: '#fff4e0', borderW: 8, radius: 20, lines: [{ t: 'FOOD PICKUP', size: 52, color: '#fff7ec' }] })
  plane(statics, pickC, 0.8, 0.2, LAYOUT.foodServe.x, FLOOR_Y + 0.8, cz + 0.032) // in front of the counter panels (cz + 0.02)
  // Brochure rack.
  const rack = new Group()
  box(rack, 0.5, 0.04, 0.2, mat('#c8c8c8', { metalness: 0.7 }), 0, 0.02, 0)
  ;['#e2382a', '#2f6fd0', '#f2b632'].forEach((c, i) => {
    const b = box(rack, 0.14, 0.22, 0.02, mat(c), -0.17 + i * 0.17, 0.14, 0)
    b.rotation.x = -0.2
  })
  rack.position.set(cx1 - 0.4, ctop, cz - 0.5)
  rack.rotation.y = Math.PI
  statics.add(rack)
  // RECEPTION + COFFEE signs hanging over the counter.
  const recC = paintSign({ w: 1024, h: 200, bg: '#ef5a2e', border: '#fff2e0', borderW: 14, radius: 10, lines: [{ t: 'RECEPTION', size: 150, color: '#fff7ec' }] })
  rbox(statics, 3.7, 0.74, 0.12, 0.03, mat('#ef5a2e'), (cx0 + cx1) / 2, FH - 0.75, cz - 0.4)
  plane(statics, recC, 3.6, 0.7, (cx0 + cx1) / 2, FH - 0.75, cz - 0.33)
  plane(statics, recC, 3.6, 0.7, (cx0 + cx1) / 2, FH - 0.75, cz - 0.47, Math.PI)
  for (const s of [-1, 1]) box(statics, 0.02, 0.36, 0.02, mat('#444'), (cx0 + cx1) / 2 + s * 1.5, FH - 0.25, cz - 0.4)
  const coffeeC = paintSign({ w: 400, h: 90, bg: '#fff4e0', border: '#e2382a', borderW: 6, radius: 40, lines: [{ t: 'CHECK-IN', size: 54, color: '#e2382a' }] })
  plane(statics, coffeeC, 1.0, 0.23, (cx0 + cx1) / 2, FH - 1.27, cz - 0.33)

  // --- ROOM KEYS board (west wall) + ROOM SERVICE bells.
  const kb = new Group()
  rbox(kb, 0.1, 1.5, 2.3, 0.03, mat('#5e1f17', { roughness: 0.6 }), 0, 0, 0)
  const keyTag = (t, bgc, y) => {
    const c = paintSign({ w: 256, h: 64, bg: bgc, border: null, radius: 4, lines: [{ t, size: 38, color: '#fff' }] })
    plane(kb, c, 0.48, 0.12, 0.06, y, -0.75, Math.PI / 2)
  }
  keyTag('REGULAR', '#1d8f5a', 0.35)
  keyTag('COMFORT', '#2f6fd0', -0.05)
  keyTag('5-STAR', '#7b3fd0', -0.45)
  const keysTitle = paintSign({ w: 256, h: 64, bg: '#f2b632', border: null, radius: 4, lines: [{ t: 'ROOM KEYS', size: 40, color: '#5e1f17' }] })
  plane(kb, keysTitle, 0.7, 0.17, 0.06, 0.6, 0.35, Math.PI / 2)
  for (const y of [0.25, -0.15, -0.55]) box(kb, 0.04, 0.03, 1.6, mat('#a8602f'), 0.06, y, 0.3)
  kb.position.set(ix0 + 0.06, 2.0, cz - 2.2)
  statics.add(kb)
  const keys = []
  const keyMat = mat(C.brass, { metalness: 0.85, roughness: 0.3 })
  for (let i = 0; i < LAYOUT.rooms.count; i++) {
    const k = new Group()
    const ring = new Mesh(new TorusGeometry(0.035, 0.008, 6, 12), keyMat)
    k.add(ring)
    box(k, 0.012, 0.11, 0.025, keyMat, 0, -0.08, 0)
    // Its own tag material so the game can make the key glow ("GIVE KEY 102").
    const tagMat = new MeshStandardMaterial({ color: ['#1d8f5a', '#27a596', '#2f6fd0'][i % 3], emissive: '#ffd23f', emissiveIntensity: 0, roughness: 0.5 })
    rbox(k, 0.02, 0.14, 0.12, 0.01, tagMat, 0, -0.08, 0.07)
    const num = paintSign({ w: 128, h: 96, bg: 'rgba(0,0,0,0)', border: null, lines: [{ t: String(LAYOUT.rooms.first + i), size: 64, color: '#ffffff' }] })
    plane(k, num, 0.11, 0.08, 0.016, -0.08, 0.07, Math.PI / 2)
    k.rotation.y = Math.PI / 2
    k.position.set(ix0 + 0.16, 2.0 + 0.25 - Math.floor(i / 3) * 0.42, cz - 2.2 - 0.35 + (i % 3) * 0.42)
    k.userData.home = k.position.clone()
    k.userData.tag = tagMat
    live.add(k)
    keys.push(k)
  }
  const rs = canvas(768, 140)
  {
    const ctx = rs.getContext('2d')
    roundRect(ctx, 0, 0, 768, 140, 12)
    ctx.fillStyle = '#1f5c4a'
    ctx.fill()
    ctx.fillStyle = '#fbf2df'
    ctx.font = `700 30px ${FONT}`
    ctx.textAlign = 'left'
    ctx.fillText('ROOM SERVICE', 18, 32)
    ctx.textAlign = 'center'
    for (let i = 0; i < 6; i++) {
      roundRect(ctx, 20 + i * 122, 48, 110, 84, 8)
      ctx.fillStyle = '#fbf2df'
      ctx.fill()
      ctx.fillStyle = '#6b3a12'
      ctx.beginPath()
      ctx.arc(75 + i * 122, 72, 16, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = '#222'
      ctx.font = `700 28px ${FONT}`
      ctx.fillText(String(LAYOUT.rooms.first + i), 75 + i * 122, 116)
    }
  }
  plane(statics, rs, 2.2, 0.4, ix0 + 0.03, 3.1, cz - 2.2, Math.PI / 2)

  // --- OUR GUESTS board (back wall) and HELP WANTED board (east wall).
  const guests = corkboard('OUR GUESTS ♥')
  guests.draw([])
  const guestsTex = canvasTex(guests.canvas)
  plane(live, guestsTex, 1.3, 0.9, ix0 + 1.0, 2.85, iz0 + 0.04)
  const help = corkboard('HELP WANTED')
  help.draw([])
  const helpTex = canvasTex(help.canvas)
  plane(live, helpTex, 1.7, 1.17, ix1 - 0.04, 1.95, oz + 1.2, -Math.PI / 2)

  // --- Ceiling fan (blades spin) with a bowl light.
  const fan = new Group()
  box(fan, 0.04, 0.4, 0.04, mat(C.brass, { metalness: 0.8 }), 0, -0.2, 0)
  const motor = new Mesh(new CylinderGeometry(0.16, 0.2, 0.18, 16), mat(C.brass, { metalness: 0.8, roughness: 0.3 }))
  motor.position.y = -0.45
  fan.add(motor)
  const blades = new Group()
  blades.position.y = -0.5
  for (let i = 0; i < 4; i++) {
    const b = rbox(blades, 1.1, 0.03, 0.24, 0.02, mat('#5a2a17', { roughness: 0.5 }), 0.7, 0, 0)
    const holder = new Group()
    holder.rotation.y = (i / 4) * Math.PI * 2
    holder.add(b)
    blades.add(holder)
  }
  fan.add(blades)
  const bowlMat = new MeshStandardMaterial({ color: '#fff6dc', emissive: '#ffe7a8', emissiveIntensity: 0.35, transparent: true, opacity: 0.95 })
  const bowl = new Mesh(new SphereGeometry(0.15, 14, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), bowlMat)
  bowl.position.y = -0.58
  fan.add(bowl)
  fan.position.set(ox + 0.4, top, oz + 0.4)
  live.add(fan)
  const lamp = new PointLight('#ffe6b8', 4, 11, 1.5)
  lamp.position.set(ox + 0.4, top - 0.9, oz + 0.2)
  live.add(lamp)

  // Fixed fittings (trim, cooler, chairs, plants, clock, postcards…): src/motel/detail.js.
  detailOffice(statics, live, { ix0, ix1, iz0, iz1, doorX, cz, cx0, cx1 })

  // Colliders: interior side walls are the building end wall (west) and room 101's
  // partition (east); the floor slab is shared with the rooms.
  return {
    door: { pivot, x: doorX, z: FRONT },
    keys,
    bell,
    blades,
    helpBoard: { x: ix1 - 0.6, z: oz + 1.2, draw: (cards) => { help.draw(cards); helpTex.needsUpdate = true } },
    phone,
    cashPile,
    ctop,
    guestsBoard: { x: ix0 + 1.0, z: iz0 + 0.8, draw: (cards) => { guests.draw(cards); guestsTex.needsUpdate = true } },
    clerkSpot: { x: LAYOUT.deskPoint.x, z: LAYOUT.deskPoint.z - 0.2 },
    bounds: { x0: ix0, x1: ix1, z0: iz0, z1: iz1 },
    lamp,
  }
}

export { DOOR_H, CircleGeometry }
