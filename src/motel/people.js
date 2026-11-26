// NPCs: blocky characters on the same bone layout as the player rig, so the
// player's procedural animator walks them. Each look picks skin, hair, a shirt
// (plain or patterned, short or long sleeves), trousers or shorts, trainers, and
// optional hat / glasses / beard / watch / camera / backpack / rolling suitcase /
// apron, so guests hold up close. A Walker moves one along a
// list of waypoints at walking pace and turns smoothly.
import { Bone, BoxGeometry, CanvasTexture, Color, CylinderGeometry, Group, Mesh, MeshStandardMaterial, PlaneGeometry, SRGBColorSpace, TorusGeometry } from 'three'
import { PLAYER_DIMS, RIG_HEIGHT } from '../config.js'
import { makeAnimator } from '../avatar/animator.js'
import { mulberry32 } from '../textures.js'
import { mat, rbox } from './kit.js'

const SKINS = ['#f2c79a', '#e0ac7e', '#c68a5c', '#8d5a3b', '#fbd9b8']
const SHIRTS = ['#f06a34', '#2f6fd0', '#27a596', '#e2382a', '#f2b632', '#7b3fd0', '#ffffff', '#5ac46a', '#ff7fb0']
const PANTS = ['#2a3a5a', '#3b2a1e', '#556070', '#1f1f24', '#6b8f4a', '#c9b38a']
const HAIRS = ['#3b2414', '#1c1c1c', '#c9862f', '#e8c26a', '#8a3a1a', '#d9d4cc']

// Faces: brows, eyes with highlights, a nose shadow, mouth, blush; optional lashes,
// freckles. Cached per skin + style + brow colour + extras.
const faceCache = new Map()
function faceTexture(skin, style, brow = '#3b2414', lashes = false, freckles = false) {
  const key = [skin, style, brow, lashes, freckles].join('|')
  if (faceCache.has(key)) return faceCache.get(key)
  const c = document.createElement('canvas')
  c.width = c.height = 256
  const ctx = c.getContext('2d')
  ctx.fillStyle = skin
  ctx.fillRect(0, 0, 256, 256)
  // Soft shading toward the edges so the flat face reads as rounded.
  const g = ctx.createRadialGradient(128, 120, 40, 128, 128, 190)
  g.addColorStop(0, 'rgba(255,255,255,0.06)')
  g.addColorStop(1, 'rgba(60,30,10,0.16)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 256, 256)
  // Brows.
  ctx.strokeStyle = brow
  ctx.lineWidth = 9
  ctx.lineCap = 'round'
  for (const [x, d] of [[88, -1], [168, 1]]) {
    ctx.beginPath()
    ctx.moveTo(x - 18, 84 + (style === 2 ? d * 4 : 0))
    ctx.quadraticCurveTo(x, 74, x + 18, 84 - (style === 2 ? d * 4 : 0))
    ctx.stroke()
  }
  // Eyes: white, iris, pupil, highlight (style 1 = happy closed arcs).
  for (const x of [88, 168]) {
    if (style === 1) {
      ctx.strokeStyle = '#1e1a18'
      ctx.lineWidth = 8
      ctx.beginPath()
      ctx.arc(x, 116, 14, 1.15 * Math.PI, 1.85 * Math.PI)
      ctx.stroke()
      continue
    }
    ctx.fillStyle = '#ffffff'
    ctx.beginPath(); ctx.ellipse(x, 112, 16, 19, 0, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = '#3d2a1c'
    ctx.beginPath(); ctx.ellipse(x + 2, 114, 11, 14, 0, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = '#120d0a'
    ctx.beginPath(); ctx.ellipse(x + 2, 115, 6, 8, 0, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = '#ffffff'
    ctx.beginPath(); ctx.arc(x + 6, 107, 4, 0, Math.PI * 2); ctx.arc(x - 2, 121, 2, 0, Math.PI * 2); ctx.fill()
    if (lashes) {
      ctx.strokeStyle = '#1e1a18'
      ctx.lineWidth = 4
      ctx.beginPath(); ctx.ellipse(x, 112, 17, 20, 0, 1.1 * Math.PI, 1.9 * Math.PI); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(x + 15, 100); ctx.lineTo(x + 22, 94); ctx.stroke()
    }
  }
  // Nose: a soft shadow and a highlight.
  ctx.fillStyle = 'rgba(120,60,30,0.22)'
  ctx.beginPath(); ctx.ellipse(132, 146, 9, 6, 0, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = 'rgba(255,255,255,0.18)'
  ctx.beginPath(); ctx.ellipse(126, 138, 4, 6, 0, 0, Math.PI * 2); ctx.fill()
  // Mouth.
  ctx.lineCap = 'round'
  if (style === 2) {
    ctx.fillStyle = '#6b2a22'
    ctx.beginPath(); ctx.ellipse(128, 176, 14, 16, 0, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = '#e0716a'
    ctx.beginPath(); ctx.ellipse(128, 184, 9, 6, 0, 0, Math.PI * 2); ctx.fill()
  } else {
    ctx.fillStyle = '#6b2a22'
    ctx.beginPath()
    ctx.moveTo(96, 164)
    ctx.quadraticCurveTo(128, 204, 160, 164)
    ctx.quadraticCurveTo(128, 178, 96, 164)
    ctx.fill()
    ctx.fillStyle = '#ffffff'
    ctx.beginPath()
    ctx.moveTo(102, 166)
    ctx.quadraticCurveTo(128, 178, 154, 166)
    ctx.quadraticCurveTo(128, 172, 102, 166)
    ctx.fill()
  }
  // Blush + freckles.
  ctx.fillStyle = 'rgba(255,110,110,0.22)'
  ctx.beginPath(); ctx.arc(60, 156, 17, 0, Math.PI * 2); ctx.arc(196, 156, 17, 0, Math.PI * 2); ctx.fill()
  if (freckles) {
    ctx.fillStyle = 'rgba(140,70,30,0.45)'
    for (const [x, y] of [[56, 140], [66, 148], [50, 152], [190, 140], [200, 148], [206, 136], [62, 136], [196, 154]]) {
      ctx.beginPath(); ctx.arc(x, y, 2.6, 0, Math.PI * 2); ctx.fill()
    }
  }
  const t = new CanvasTexture(c)
  t.colorSpace = SRGBColorSpace
  t.anisotropy = 4
  faceCache.set(key, t)
  return t
}

const shade = (hex, k) => '#' + new Color(hex).multiplyScalar(k).getHexString()

// Shirt fabric: plain / stripe / hawaii / plaid / dots. `front` adds a button placket
// and a breast pocket. Cached per colour + pattern + face.
const shirtCache = new Map()
function shirtTexture(color, pattern, front) {
  const key = color + pattern + front
  if (shirtCache.has(key)) return shirtCache.get(key)
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const ctx = c.getContext('2d')
  ctx.fillStyle = color
  ctx.fillRect(0, 0, 128, 128)
  const dark = shade(color, 0.72)
  const light = '#' + new Color(color).lerp(new Color('#ffffff'), 0.55).getHexString()
  if (pattern === 'stripe') {
    ctx.fillStyle = light
    for (let x = 0; x < 128; x += 22) ctx.fillRect(x, 0, 8, 128)
  } else if (pattern === 'plaid') {
    ctx.globalAlpha = 0.35
    ctx.fillStyle = dark
    for (let x = 0; x < 128; x += 32) { ctx.fillRect(x, 0, 12, 128); ctx.fillRect(0, x, 128, 12) }
    ctx.fillStyle = light
    for (let x = 18; x < 128; x += 32) { ctx.fillRect(x, 0, 3, 128); ctx.fillRect(0, x, 128, 3) }
    ctx.globalAlpha = 1
  } else if (pattern === 'dots') {
    ctx.fillStyle = light
    for (let y = 8; y < 128; y += 20) for (let x = (y / 20) % 2 ? 18 : 8; x < 128; x += 20) {
      ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2); ctx.fill()
    }
  } else if (pattern === 'hawaii') {
    // Hibiscus flowers and leaves.
    const flower = (x, y, r, col) => {
      ctx.fillStyle = col
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2
        ctx.beginPath(); ctx.ellipse(x + Math.cos(a) * r * 0.7, y + Math.sin(a) * r * 0.7, r * 0.6, r * 0.42, a, 0, Math.PI * 2); ctx.fill()
      }
      ctx.fillStyle = '#ffe36a'
      ctx.beginPath(); ctx.arc(x, y, r * 0.25, 0, Math.PI * 2); ctx.fill()
    }
    ctx.fillStyle = '#2f8f4a'
    for (const [x, y, a] of [[30, 70, 0.6], [96, 20, -0.4], [80, 104, 1.2], [8, 14, 2]]) {
      ctx.beginPath(); ctx.ellipse(x, y, 16, 6, a, 0, Math.PI * 2); ctx.fill()
    }
    flower(24, 28, 14, '#ffffff')
    flower(84, 60, 16, light)
    flower(40, 108, 12, '#ffffff')
    flower(116, 116, 12, light)
  }
  if (front) {
    ctx.fillStyle = dark
    ctx.fillRect(61, 0, 6, 128)
    ctx.fillStyle = '#f6f1e6'
    for (let y = 18; y < 128; y += 26) { ctx.beginPath(); ctx.arc(64, y, 3.4, 0, Math.PI * 2); ctx.fill() }
    ctx.strokeStyle = dark
    ctx.lineWidth = 3
    ctx.strokeRect(80, 26, 26, 24)
    ctx.beginPath(); ctx.moveTo(80, 33); ctx.lineTo(106, 33); ctx.stroke()
  }
  const t = new CanvasTexture(c)
  t.colorSpace = SRGBColorSpace
  shirtCache.set(key, t)
  return t
}

// Luggage stickers on the suitcase sides.
let stickerTex = null
function stickers() {
  if (stickerTex) return stickerTex
  const c = document.createElement('canvas')
  c.width = 256
  c.height = 128
  const ctx = c.getContext('2d')
  ctx.clearRect(0, 0, 256, 128)
  const st = (x, y, r, bg, fg, t) => {
    ctx.fillStyle = bg
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill()
    ctx.strokeStyle = fg
    ctx.lineWidth = 3
    ctx.beginPath(); ctx.arc(x, y, r - 5, 0, Math.PI * 2); ctx.stroke()
    ctx.fillStyle = fg
    ctx.font = `800 ${Math.round(r * 0.55)}px sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(t, x, y)
  }
  st(52, 50, 34, '#f2b632', '#7a2b10', 'USA')
  st(140, 76, 28, '#2f6fd0', '#ffffff', '★')
  ctx.save()
  ctx.translate(205, 46)
  ctx.rotate(-0.25)
  ctx.fillStyle = '#e2382a'
  ctx.fillRect(-38, -16, 76, 32)
  ctx.fillStyle = '#fff'
  ctx.font = '800 18px sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('MOTEL', 0, 1)
  ctx.restore()
  stickerTex = new CanvasTexture(c)
  stickerTex.colorSpace = SRGBColorSpace
  return stickerTex
}

function bone(name, parent, x, y, z) {
  const b = new Bone()
  b.name = name
  b.position.set(x, y, z)
  parent.add(b)
  return b
}

const G = {
  torso: new BoxGeometry(1.5, 2.4, 0.8),
  arm: new BoxGeometry(0.7, 2.4, 0.7),
  sleeve: new BoxGeometry(0.78, 1.1, 0.78),
  forearm: new BoxGeometry(0.64, 1.3, 0.64),
  cuff: new BoxGeometry(0.8, 0.14, 0.8),
  leg: new BoxGeometry(0.72, 2.4, 0.74),
  shorts: new BoxGeometry(0.78, 1.15, 0.8),
  shin: new BoxGeometry(0.64, 1.3, 0.64),
  sock: new BoxGeometry(0.67, 0.22, 0.67),
  hem: new BoxGeometry(0.76, 0.14, 0.78),
  shortsHem: new BoxGeometry(0.84, 0.14, 0.86),
  sole: new BoxGeometry(0.86, 0.12, 1.04),
  shoe: new BoxGeometry(0.74, 0.3, 0.94),
  toe: new BoxGeometry(0.8, 0.18, 0.2),
  lace: new BoxGeometry(0.4, 0.03, 0.4),
  hand: new BoxGeometry(0.66, 0.5, 0.66),
  thumb: new BoxGeometry(0.2, 0.3, 0.22),
  belt: new BoxGeometry(1.54, 0.25, 0.84),
  buckle: new BoxGeometry(0.32, 0.22, 0.06),
  collar: new BoxGeometry(1.0, 0.25, 0.86),
  ear: new BoxGeometry(0.14, 0.36, 0.28),
  lens: new BoxGeometry(0.42, 0.28, 0.05),
  bridge: new BoxGeometry(0.2, 0.05, 0.05),
  temple: new BoxGeometry(0.05, 0.05, 0.9),
}
const SHOES = ['#2a1f1a', '#f4f1ea', '#2f6fd0', '#e2382a', '#3b3b40', '#8a5a33']
const PATTERNS = ['plain', 'plain', 'stripe', 'hawaii', 'plaid', 'dots']

// look: { skin, shirt, pants, hair, hairStyle, hat, hatColor, suitcase, apron, dress, face,
//         collar, pattern, sleeves, shorts, shoes, glasses, camera, backpack, beard,
//         watch, lashes, freckles }. Every field past `face` is optional.
export function randomLook(seed) {
  const r = mulberry32(seed * 7919 + 13)
  const pick = (a) => a[Math.floor(r() * a.length)]
  const hairStyle = Math.floor(r() * 3)
  return {
    skin: pick(SKINS),
    shirt: pick(SHIRTS),
    pants: pick(PANTS),
    hair: pick(HAIRS),
    hairStyle,
    hat: r() < 0.35 ? pick(['cap', 'sun', 'cowboy']) : null,
    hatColor: pick(['#f2b632', '#e2382a', '#27a596', '#f4efe2', '#8a5a33']),
    suitcase: r() < 0.7 ? pick(['#c0392b', '#2f6fd0', '#8a5a33', '#27a596', '#f2b632']) : null,
    face: Math.floor(r() * 3),
    pattern: pick(PATTERNS),
    sleeves: r() < 0.6 ? 'short' : 'long',
    shorts: r() < 0.3,
    shoes: pick(SHOES),
    glasses: r() < 0.3 ? pick(['sun', 'round']) : null,
    camera: r() < 0.15,
    backpack: r() < 0.2 ? pick(['#2f6fd0', '#e2382a', '#5ac46a', '#3b3b40']) : null,
    beard: hairStyle === 0 && r() < 0.25 ? pick(['beard', 'moustache']) : null,
    watch: r() < 0.5,
    lashes: hairStyle !== 0 && r() < 0.6,
    freckles: r() < 0.2,
  }
}

export function makePerson(look) {
  const root = new Group()
  const rig = bone('Rig1', root, 0, 0, 0)
  const spine1 = bone('Spine1', rig, 0, 2.4, 0)
  const spine2 = bone('Spine2', spine1, 0, 1.8, 0)
  // Shoulders at the torso's edge (torso half-width 0.75 + half an arm), so arms hang against the body.
  const armR = bone('ArmR1', bone('ArmR_Offset', spine2, -1.12, 0.6, 0.4), 0, 0, 0)
  const armL = bone('ArmL1', bone('ArmL_Offset', spine2, 1.12, 0.6, 0.4), 0, 0, 0)
  const neck = bone('Neck1', bone('Neck_Offset', spine2, 0, 0.6, 0), 0, 0, 0)
  const legR = bone('LegR1', bone('LegR_Offset', rig, -0.6, 2.4, 0), 0, 0, 0)
  const legL = bone('LegL1', bone('LegL_Offset', rig, 0.6, 2.4, 0), 0, 0, 0)
  const pattern = look.pattern ?? 'plain'
  const shirt = pattern === 'plain' ? mat(look.shirt, { roughness: 0.8 }) : mat('#ffffff', { map: shirtTexture(look.shirt, pattern, false), roughness: 0.8 })
  const shirtFront = mat('#ffffff', { map: shirtTexture(look.shirt, pattern, !look.dress && !look.apron), roughness: 0.8 })
  const shirtDark = mat(shade(look.shirt, 0.8), { roughness: 0.8 })
  const pants = mat(look.pants, { roughness: 0.85 })
  const pantsDark = mat(shade(look.pants, 0.75), { roughness: 0.85 })
  const skin = mat(look.skin, { roughness: 0.7 })
  const add = (parent, geo, m, x, y, z, shadow = true) => {
    const mesh = new Mesh(geo, m)
    mesh.position.set(x, y, z)
    mesh.castShadow = shadow
    parent.add(mesh)
    return mesh
  }
  // Torso: patterned sides, a buttoned front with a pocket; belt with a brass buckle.
  const body = look.dress ? mat(look.dress) : shirt
  add(spine1, G.torso, look.dress ? body : [shirt, shirt, shirt, shirt, shirtFront, shirt], 0, 1.2, 0)
  add(spine1, G.belt, mat('#3a2a1e'), 0, 0.1, 0)
  if (!look.dress) add(spine1, G.buckle, mat('#e2b33c', { metalness: 0.8, roughness: 0.3 }), 0, 0.1, 0.44, false)
  add(spine1, G.collar, mat(look.collar ?? '#ffffff'), 0, 2.32, 0.02)
  if (look.apron) {
    add(spine1, new BoxGeometry(1.2, 1.9, 0.06), mat(look.apron), 0, 0.85, 0.42)
    add(spine1, new BoxGeometry(0.6, 0.35, 0.03), mat(shade(look.apron, 0.88)), 0, 0.55, 0.46, false)
  }
  // Arms: short sleeves show the forearm; long sleeves end in a cuff. Hands get a thumb.
  for (const [a, side] of [[armR, -1], [armL, 1]]) {
    if (look.sleeves === 'short') {
      add(a, G.sleeve, shirt, 0, -0.3, -0.4)
      add(a, G.cuff, shirtDark, 0, -0.82, -0.4, false)
      add(a, G.forearm, skin, 0, -1.5, -0.4)
    } else {
      add(a, G.arm, shirt, 0, -0.95, -0.4)
      add(a, G.cuff, shirtDark, 0, -2.06, -0.4, false)
    }
    add(a, G.hand, skin, 0, -2.25, -0.4)
    add(a, G.thumb, skin, side * -0.05, -2.15, -0.02, false)
  }
  if (look.watch) {
    add(armL, new BoxGeometry(0.7, 0.16, 0.7), mat('#2b2b2e'), 0, -1.88, -0.4, false)
    add(armL, new BoxGeometry(0.06, 0.24, 0.3), mat('#e2b33c', { metalness: 0.8, roughness: 0.3 }), 0.36, -1.88, -0.4, false)
  }
  // Legs: trousers with a hem, or shorts with socks; trainers with soles, toe caps, laces.
  const shoeM = mat(look.shoes ?? '#2a1f1a', { roughness: 0.6 })
  const soleM = mat(look.shoes === '#f4f1ea' ? '#d9d2c4' : '#f4f1ea', { roughness: 0.8 })
  for (const l of [legR, legL]) {
    if (look.dress) {
      add(l, G.leg, skin, 0, -1.2, 0)
    } else if (look.shorts) {
      add(l, G.shorts, pants, 0, -0.55, 0)
      add(l, G.shortsHem, pantsDark, 0, -1.1, 0, false)
      add(l, G.shin, skin, 0, -1.75, 0)
      add(l, G.sock, mat('#fbf8f2'), 0, -2.05, 0, false)
    } else {
      add(l, G.leg, pants, 0, -1.2, 0)
      add(l, G.hem, pantsDark, 0, -2.08, 0, false)
    }
    add(l, G.shoe, shoeM, 0, -2.27, 0.1)
    add(l, G.sole, soleM, 0, -2.42, 0.12, false)
    add(l, G.toe, soleM, 0, -2.32, 0.55, false)
    add(l, G.lace, mat('#fbf8f2'), 0, -2.11, 0.18, false)
  }
  if (look.dress) add(spine1, new BoxGeometry(1.7, 1.0, 1.0), mat(look.dress), 0, -0.3, 0)
  // Head: rounded face, ears.
  const browC = look.hair === '#d9d4cc' ? '#9a948c' : shade(look.hair, 0.8)
  const headMats = [skin, skin, skin, skin, new MeshStandardMaterial({ map: faceTexture(look.skin, look.face ?? 0, browC, !!look.lashes, !!look.freckles), roughness: 0.7 }), skin]
  const head = new Mesh(new BoxGeometry(1.45, 1.4, 1.35), headMats)
  head.position.y = 0.72
  head.castShadow = true
  neck.add(head)
  for (const s of [-1, 1]) add(neck, G.ear, skin, s * 0.77, 0.68, -0.05, false)
  const hair = mat(look.hair, { roughness: 0.9 })
  if (look.hairStyle === 0) {
    rbox(neck, 1.55, 0.45, 1.45, 0.15, hair, 0, 1.45, -0.03)
    rbox(neck, 1.55, 0.9, 0.35, 0.12, hair, 0, 1.05, -0.58)
    for (const s of [-1, 1]) rbox(neck, 0.1, 0.45, 0.3, 0.04, hair, s * 0.75, 1.0, 0.25) // sideburns
  } else if (look.hairStyle === 1) {
    rbox(neck, 1.55, 0.5, 1.45, 0.15, hair, 0, 1.45, -0.03)
    rbox(neck, 1.55, 1.3, 0.4, 0.15, hair, 0, 0.9, -0.6)
    for (const s of [-1, 1]) rbox(neck, 0.16, 1.1, 1.0, 0.06, hair, s * 0.78, 0.95, -0.15)
    rbox(neck, 1.3, 0.22, 0.14, 0.06, hair, 0.12, 1.28, 0.66) // fringe
  } else {
    rbox(neck, 1.6, 0.6, 1.5, 0.25, hair, 0, 1.45, -0.05)
    rbox(neck, 0.5, 0.5, 0.5, 0.2, hair, 0, 1.8, -0.6) // bun
    add(neck, new TorusGeometry(0.25, 0.05, 6, 12), mat('#e2382a'), 0, 1.72, -0.48, false).rotation.x = 0.6
  }
  if (look.beard === 'beard') {
    rbox(neck, 1.3, 0.5, 0.12, 0.06, hair, 0, 0.18, 0.67)
    rbox(neck, 0.55, 0.12, 0.1, 0.04, hair, 0, 0.5, 0.7)
  } else if (look.beard === 'moustache') {
    rbox(neck, 0.6, 0.13, 0.1, 0.05, hair, 0, 0.5, 0.7)
  }
  if (look.glasses) {
    const frame = mat(look.glasses === 'sun' ? '#1f1f24' : '#8a5a33', { roughness: 0.4 })
    const lensM = look.glasses === 'sun' ? mat('#14161c', { roughness: 0.05, metalness: 0.6 }) : mat('#dff6ff', { roughness: 0.05, transparent: true, opacity: 0.35 })
    for (const s of [-1, 1]) {
      add(neck, G.lens, frame, s * 0.33, 0.82, 0.7, false)
      add(neck, new BoxGeometry(0.34, 0.2, 0.02), lensM, s * 0.33, 0.82, 0.73, false)
      add(neck, G.temple, frame, s * 0.74, 0.86, 0.28, false)
    }
    add(neck, G.bridge, frame, 0, 0.86, 0.7, false)
  }
  if (look.hat === 'cap') {
    const hm = mat(look.hatColor)
    rbox(neck, 1.6, 0.45, 1.5, 0.15, hm, 0, 1.55, 0)
    rbox(neck, 1.3, 0.08, 0.7, 0.04, hm, 0, 1.38, 0.95)
    add(neck, new CylinderGeometry(0.1, 0.1, 0.08, 10), mat(shade(look.hatColor, 0.7)), 0, 1.8, 0, false)
    add(neck, new BoxGeometry(0.6, 0.3, 0.04), mat('#ffffff'), 0, 1.58, 0.76, false)
  } else if (look.hat === 'sun') {
    const hm = mat(look.hatColor)
    add(neck, new CylinderGeometry(1.3, 1.3, 0.08, 22), hm, 0, 1.45, 0)
    add(neck, new CylinderGeometry(0.72, 0.8, 0.55, 16), hm, 0, 1.72, 0)
    add(neck, new CylinderGeometry(0.81, 0.81, 0.14, 16), mat('#e2382a'), 0, 1.56, 0, false)
  } else if (look.hat === 'cowboy') {
    const hm = mat('#8a5a33')
    const brim = add(neck, new CylinderGeometry(1.4, 1.4, 0.08, 20), hm, 0, 1.45, 0)
    brim.scale.z = 0.8
    add(neck, new CylinderGeometry(0.65, 0.78, 0.7, 14), hm, 0, 1.8, 0)
    add(neck, new CylinderGeometry(0.79, 0.79, 0.12, 14), mat('#3a2a1e'), 0, 1.53, 0, false)
    add(neck, new BoxGeometry(0.2, 0.08, 1.2), mat('#6e4423'), 0, 2.14, 0, false)
  } else if (look.hat === 'maid') {
    rbox(neck, 1.5, 0.3, 0.3, 0.1, mat('#ffffff'), 0, 1.6, 0.35)
  }
  // Camera on a neck strap (tourists).
  if (look.camera ?? look.hat === 'sun') {
    const strapM = mat('#2b2b2e')
    for (const s of [-1, 1]) {
      const st = add(spine1, new BoxGeometry(0.1, 1.0, 0.04), strapM, s * 0.42, 1.95, 0.43, false)
      st.rotation.z = s * 0.35
    }
    add(spine1, new BoxGeometry(0.66, 0.42, 0.3), mat('#2b2b2e', { roughness: 0.4 }), 0, 1.45, 0.55, false)
    add(spine1, new BoxGeometry(0.2, 0.1, 0.24), mat('#c9ced2', { metalness: 0.8, roughness: 0.3 }), -0.2, 1.71, 0.55, false)
    const lens = add(spine1, new CylinderGeometry(0.15, 0.15, 0.22, 14), mat('#1a1a1d', { roughness: 0.3 }), 0.06, 1.42, 0.8, false)
    lens.rotation.x = Math.PI / 2
    const glass = add(spine1, new CylinderGeometry(0.1, 0.1, 0.02, 14), mat('#3b5a7a', { metalness: 0.7, roughness: 0.05 }), 0.06, 1.42, 0.92, false)
    glass.rotation.x = Math.PI / 2
  }
  // Backpack with straps and a zipped front pocket.
  if (look.backpack) {
    const bm = mat(look.backpack, { roughness: 0.75 })
    const bd = mat(shade(look.backpack, 0.75), { roughness: 0.75 })
    rbox(spine1, 1.2, 1.5, 0.55, 0.15, bm, 0, 1.35, -0.7)
    rbox(spine1, 0.9, 0.7, 0.2, 0.08, bd, 0, 0.95, -1.02)
    add(spine1, new BoxGeometry(0.8, 0.04, 0.04), mat('#d9d2c4'), 0, 1.31, -1.12, false)
    for (const s of [-1, 1]) {
      add(spine1, new BoxGeometry(0.18, 1.7, 0.06), bd, s * 0.42, 1.4, 0.43, false)
      add(spine1, new BoxGeometry(0.18, 0.08, 1.2), bd, s * 0.42, 2.25, -0.1, false)
    }
  }
  // Hard-shell rolling suitcase: ribs, corner guards, carry handle, pull-handle housing,
  // wheels, a luggage tag and travel stickers.
  if (look.suitcase) {
    const sc = new Group()
    const shell = mat(look.suitcase, { roughness: 0.4 })
    const rib = mat(shade(look.suitcase, 0.78), { roughness: 0.4 })
    const black = mat('#2a2a2a', { roughness: 0.6 })
    rbox(sc, 0.5, 1.6, 1.9, 0.15, shell, 0, -0.9, 0)
    for (const z of [-0.55, 0, 0.55]) rbox(sc, 0.54, 1.45, 0.08, 0.03, rib, 0, -0.9, z)
    add(sc, new BoxGeometry(0.56, 0.06, 1.86), black, 0, -0.9, 0, false) // zip seam
    for (const [y, z] of [[-0.12, -0.9], [-0.12, 0.9], [-1.68, -0.9], [-1.68, 0.9]]) add(sc, new BoxGeometry(0.56, 0.2, 0.14), black, 0, y, z, false)
    rbox(sc, 0.14, 0.3, 0.7, 0.05, black, 0, 0.05, 0)
    add(sc, new BoxGeometry(0.2, 0.06, 0.2), black, 0, -0.08, -0.32, false)
    add(sc, new BoxGeometry(0.2, 0.06, 0.2), black, 0, -0.08, 0.32, false)
    add(sc, new BoxGeometry(0.4, 0.08, 0.5), black, 0, -0.1, 0.75, false) // pull-handle housing
    for (const z of [-0.78, 0.78]) {
      const w = add(sc, new CylinderGeometry(0.12, 0.12, 0.1, 12), black, 0.12, -1.75, z, false)
      w.rotation.z = Math.PI / 2
      const w2 = add(sc, new CylinderGeometry(0.12, 0.12, 0.1, 12), black, -0.12, -1.75, z, false)
      w2.rotation.z = Math.PI / 2
    }
    const tag = add(sc, new BoxGeometry(0.03, 0.34, 0.24), mat('#f6d33c'), 0.1, -0.22, 0.2, false)
    tag.rotation.x = 0.3
    const stM = new MeshStandardMaterial({ map: stickers(), transparent: true, roughness: 0.6 })
    for (const s of [-1, 1]) {
      const p = new Mesh(new PlaneGeometry(1.4, 0.7), stM)
      p.position.set(s * 0.256, -0.95, 0)
      p.rotation.y = s * Math.PI / 2
      sc.add(p)
    }
    sc.position.set(0, -2.6, -0.4)
    armR.add(sc)
  }
  root.animations = []
  root.nodes = {}
  root.traverse((o) => {
    if (o.name) root.nodes[o.name] = o
  })
  root.scale.setScalar(PLAYER_DIMS.height / RIG_HEIGHT)
  const g = new Group()
  g.add(root)
  return { group: g, avatar: root, animator: makeAnimator(root) }
}

// Moves a person along waypoints. `path` = [[x, z], ...]; `onArrive` fires at the end.
export class Walker {
  constructor(person, x, z, y = 0) {
    this.p = person
    this.x = x
    this.z = z
    this.y = y
    this.yaw = 0
    this.path = []
    this.speed = 2.6
    this.onArrive = null
    this.moving = 0
    person.group.position.set(x, y, z)
  }
  // `pace` (set per person, default 1) makes some people stroll and others hurry.
  go(path, onArrive = null, speed = 2.6 * (this.pace ?? 1)) {
    this.path = path.map(([x, z]) => [x, z])
    this.onArrive = onArrive
    this.speed = speed
  }
  face(yaw) {
    this.targetYaw = yaw
  }
  get busy() {
    return this.path.length > 0
  }
  update(dt, floorAt) {
    let speed = 0
    if (this.path.length) {
      const [tx, tz] = this.path[0]
      const dx = tx - this.x
      const dz = tz - this.z
      const d = Math.hypot(dx, dz)
      const step = this.speed * dt
      if (d <= step) {
        this.x = tx
        this.z = tz
        this.path.shift()
        if (!this.path.length) {
          const fn = this.onArrive
          this.onArrive = null
          fn?.()
        }
      } else {
        this.x += (dx / d) * step
        this.z += (dz / d) * step
        this.targetYaw = Math.atan2(dx, dz)
        speed = this.speed
      }
    }
    if (this.targetYaw !== undefined) {
      const diff = Math.atan2(Math.sin(this.targetYaw - this.yaw), Math.cos(this.targetYaw - this.yaw))
      this.yaw += diff * Math.min(1, dt * 10)
    }
    const fy = floorAt ? floorAt(this.x, this.z) : this.y
    this.y += (fy - this.y) * Math.min(1, dt * 12)
    this.p.group.position.set(this.x, this.y, this.z)
    this.p.group.rotation.y = this.yaw
    this.moving = speed
    this.p.animator?.update(dt, { grounded: true, speed, verticalVelocity: 0, turn: 0 })
  }
}
