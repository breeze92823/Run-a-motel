// Close-up detail for the walk-in interiors (fixed fittings only; buyable furniture,
// wallpapers and floors belong to the decor layer in src/decor/). Guest rooms get
// baseboards, crown moulding, window casing + venetian blinds, an AC grille and
// controls, switches, outlets, a thermostat, coat hooks with a DO NOT DISTURB
// hanger, a fire-exit plaque, reading sconces, a smoke detector, a return vent,
// a brass threshold, and in the bathroom a towel bar + towel, vanity light bar,
// shelf with spare rolls, brush holder, pedal bin, supply valve and an extractor
// grille. The office gets the same trim plus a water cooler, waiting chairs,
// plants, a postcard spinner, fire extinguisher, wall clock, travel poster and
// ceiling fittings.
//
// Wall fittings stand >= 0.07 m proud of the lining (the decor layer lays its
// wallpaper / wainscot overlays 0.02..0.06 m in front of it) and keep clear of
// the spots the decor layer, the dirt decals and the food stations use.
import { CircleGeometry, CylinderGeometry, DoubleSide, Group, Mesh, MeshStandardMaterial, PlaneGeometry, SphereGeometry, TorusGeometry } from 'three'
import { LAYOUT } from '../config.js'
import { RAPIER, addFixed } from '../physics.js'
import { box, C, canvasTex, mat, rbox, textures } from './kit.js'
import { canvas, FONT, paintSign, roundRect } from './paint.js'

const FH = LAYOUT.building.floorH
const FLOOR_Y = 0.2
const CEIL = FH - 0.13 // underside of the ceiling slab

// --- Shared materials / textures (made once, so baking merges every room) ----------------
let K = null
function kit() {
  if (K) return K
  K = {
    base: mat('#6e3a1c', { map: textures().wood, roughness: 0.55 }),
    crown: mat('#fff1dc', { roughness: 0.6 }),
    casing: mat('#fff6e8', { roughness: 0.5 }),
    plate: mat('#f6efe0', { roughness: 0.35 }),
    slot: mat('#3a3330', { roughness: 0.8 }),
    toggle: mat('#fffaf2', { roughness: 0.3 }),
    brass: mat(C.brass, { metalness: 0.85, roughness: 0.3 }),
    chrome: mat('#dfe5e8', { metalness: 0.9, roughness: 0.18 }),
    steel: mat('#b9c0c4', { metalness: 0.7, roughness: 0.35 }),
    dark: mat('#2b2b2e', { roughness: 0.6 }),
    slat: mat('#f3ead8', { roughness: 0.5 }),
    acGrille: mat('#d9cfbd', { roughness: 0.6 }),
    vent: mat('#e9e2d4', { roughness: 0.5 }),
    shade: mat('#fff0cf', { emissive: '#ffd890', emissiveIntensity: 0.55, roughness: 0.8, side: DoubleSide }),
    bulb: mat('#fffaf0', { emissive: '#fff0c8', emissiveIntensity: 0.9 }),
    towel: mat('#fffaf0', { roughness: 1 }),
    towelBand: mat('#27a596', { roughness: 1 }),
    tp: mat('#fdfbf6', { roughness: 1 }),
    glassShelf: new MeshStandardMaterial({ color: '#dff6f6', roughness: 0.05, transparent: true, opacity: 0.45 }),
    red: mat('#d8322a', { roughness: 0.4 }),
    plastic: mat('#f1ebe0', { roughness: 0.45 }),
    potTerracotta: mat('#c4673a', { roughness: 0.85 }),
    soil: mat('#4a3424', { roughness: 1 }),
    leaf: mat('#3f8f46', { roughness: 0.8, side: DoubleSide }),
    leafDark: mat('#2c6e3a', { roughness: 0.8, side: DoubleSide }),
    vinyl: mat('#e8662e', { roughness: 0.45 }),
    tube: mat('#d7dde0', { metalness: 0.9, roughness: 0.2 }),
    bottle: new MeshStandardMaterial({ color: '#8fd3f4', roughness: 0.05, transparent: true, opacity: 0.55 }),
    signs: new Map(),
  }
  return K
}

// A canvas sign material, cached by key so every room shares one texture.
function signMat(key, paint) {
  const k = kit()
  let m = k.signs.get(key)
  if (!m) k.signs.set(key, (m = new MeshStandardMaterial({ map: canvasTex(paint()), roughness: 0.6 })))
  return m
}
function sign(parent, key, paint, w, h, x, y, z, ry = 0) {
  const m = new Mesh(new PlaneGeometry(w, h), signMat(key, paint))
  m.position.set(x, y, z)
  m.rotation.y = ry
  parent.add(m)
  return m
}
function cyl(parent, rt, rb, h, material, x, y, z, seg = 14) {
  const m = new Mesh(new CylinderGeometry(rt, rb, h, seg), material)
  m.position.set(x, y, z)
  m.castShadow = true
  parent.add(m)
  return m
}
function solid(hx, hy, hz, x, y, z) {
  addFixed(RAPIER.ColliderDesc.cuboid(hx, hy, hz), { x, y, z })
}

// --- Walls: a wall is { axis, at, dir } — it runs along `axis` ('x' or 'z'), its room-side
// face sits at the other coordinate `at`, and `dir` (+1/-1) points into the room.
const wallX = (at, dir) => ({ axis: 'x', at, dir })
const wallZ = (at, dir) => ({ axis: 'z', at, dir })
// A strip along a wall from a..b: y0..y0+h tall, d0..d1 out from the face.
function strip(parent, wall, a, b, y0, h, d0, d1, material, tile = 0) {
  const len = b - a
  const mid = (a + b) / 2
  const off = wall.at + wall.dir * (d0 + d1) / 2
  if (wall.axis === 'x') return box(parent, len, h, d1 - d0, material, mid, y0 + h / 2, off, tile)
  return box(parent, d1 - d0, h, len, material, off, y0 + h / 2, mid, tile)
}
// A group on the wall face at coordinate `s` along it, height y; local +z points into the room.
function onWall(parent, wall, s, y) {
  const g = new Group()
  if (wall.axis === 'x') {
    g.position.set(s, y, wall.at)
    g.rotation.y = wall.dir > 0 ? 0 : Math.PI
  } else {
    g.position.set(wall.at, y, s)
    g.rotation.y = wall.dir > 0 ? Math.PI / 2 : -Math.PI / 2
  }
  parent.add(g)
  return g
}

// Baseboard: walnut board with a rounded top lip, 0.075..0.085 m proud of the face.
function baseboard(parent, wall, a, b, out = 0.04) {
  const k = kit()
  strip(parent, wall, a, b, FLOOR_Y, 0.14, out, out + 0.035, k.base, 1)
  strip(parent, wall, a, b, FLOOR_Y + 0.13, 0.03, out, out + 0.045, k.base, 1)
}
// Crown moulding: a stepped cream cornice under the ceiling.
function crown(parent, wall, a, b) {
  const k = kit()
  strip(parent, wall, a, b, CEIL - 0.15, 0.15, 0, 0.065, k.crown)
  strip(parent, wall, a, b, CEIL - 0.05, 0.05, 0, 0.1, k.crown)
  strip(parent, wall, a, b, CEIL - 0.175, 0.03, 0, 0.08, k.crown)
}

// --- Small fittings (local space: x along the wall, z out of it) --------------------------
// Toggle light switch (1 or 2 gang). `back` = how far behind the plate the block starts.
function lightSwitch(g, gangs = 1, out = 0.07) {
  const k = kit()
  const w = 0.085 * gangs
  rbox(g, w, 0.13, out, Math.min(0.008, out / 2 - 0.001), k.plate, 0, 0, out / 2)
  for (let i = 0; i < gangs; i++) {
    const x = (i - (gangs - 1) / 2) * 0.085
    box(g, 0.022, 0.04, 0.012, k.slot, x, 0, out + 0.002)
    const t = box(g, 0.014, 0.034, 0.02, k.toggle, x, 0.006, out + 0.012)
    t.rotation.x = -0.35
  }
  for (const y of [-0.05, 0.05]) cyl(g, 0.005, 0.005, 0.008, k.chrome, 0, y, out + 0.002, 6).rotation.x = Math.PI / 2
}
// Duplex outlet.
function outlet(g, out = 0.075) {
  const k = kit()
  rbox(g, 0.075, 0.12, out, 0.008, k.plate, 0, 0, out / 2)
  for (const y of [-0.026, 0.026]) {
    rbox(g, 0.044, 0.036, 0.008, 0.006, k.toggle, 0, y, out + 0.002)
    for (const x of [-0.008, 0.008]) box(g, 0.003, 0.012, 0.008, k.slot, x, y + 0.004, out + 0.008)
    box(g, 0.006, 0.006, 0.008, k.slot, 0, y - 0.01, out + 0.008)
  }
}
// Round dial thermostat with a gold ring.
function thermostat(g, out = 0.08) {
  const k = kit()
  rbox(g, 0.13, 0.16, out - 0.02, 0.01, k.plate, 0, 0, (out - 0.02) / 2)
  const body = cyl(g, 0.055, 0.058, 0.03, k.plastic, 0, 0, out - 0.005, 24)
  body.rotation.x = Math.PI / 2
  const ring = new Mesh(new TorusGeometry(0.052, 0.006, 6, 24), k.brass)
  ring.position.z = out + 0.013
  g.add(ring)
  const face = sign(g, 'thermo', () => {
    const c = canvas(128)
    const ctx = c.getContext('2d')
    ctx.fillStyle = '#f7f1e4'
    ctx.beginPath(); ctx.arc(64, 64, 64, 0, Math.PI * 2); ctx.fill()
    ctx.strokeStyle = '#444'
    ctx.lineWidth = 2
    for (let i = 0; i <= 12; i++) {
      const a = Math.PI * (0.8 + (i / 12) * 1.4)
      ctx.beginPath()
      ctx.moveTo(64 + Math.cos(a) * 50, 64 + Math.sin(a) * 50)
      ctx.lineTo(64 + Math.cos(a) * (i % 3 ? 44 : 38), 64 + Math.sin(a) * (i % 3 ? 44 : 38))
      ctx.stroke()
    }
    ctx.fillStyle = '#d8322a'
    ctx.beginPath(); ctx.moveTo(64, 64); ctx.lineTo(64 + 34, 64 - 26); ctx.lineTo(64 + 30, 64 - 32); ctx.fill()
    ctx.fillStyle = '#333'
    ctx.font = `700 20px ${FONT}`
    ctx.textAlign = 'center'
    ctx.fillText('72°', 64, 96)
    return c
  }, 0.098, 0.098, 0, 0, out + 0.016)
  face.geometry = new CircleGeometry(0.046, 24)
  face.geometry.attributes.uv.array.forEach((v, i, a) => (a[i] = 0.5 + (v - 0.5) * 0.94))
}
// Retro reading sconce: brass back plate, swan-neck arm and a glowing cream shade.
function sconce(g, out = 0.07) {
  const k = kit()
  const plate = cyl(g, 0.06, 0.06, out, k.brass, 0, 0, out / 2, 16)
  plate.rotation.x = Math.PI / 2
  const arm = cyl(g, 0.012, 0.012, 0.2, k.brass, 0, 0.04, out + 0.09, 8)
  arm.rotation.x = Math.PI / 2 - 0.5
  cyl(g, 0.012, 0.012, 0.08, k.brass, 0, 0.11, out + 0.18, 8)
  const shade = new Mesh(new CylinderGeometry(0.07, 0.12, 0.16, 18, 1, true), k.shade)
  shade.position.set(0, 0.12, out + 0.18)
  g.add(shade)
  const b = new Mesh(new SphereGeometry(0.035, 10, 6), k.bulb)
  b.position.set(0, 0.08, out + 0.18)
  g.add(b)
}
// Ceiling smoke detector with a red LED.
function smokeDetector(parent, x, z) {
  const k = kit()
  cyl(parent, 0.09, 0.075, 0.035, k.plastic, x, CEIL - 0.018, z, 20)
  cyl(parent, 0.045, 0.05, 0.012, k.vent, x, CEIL - 0.04, z, 16)
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2
    box(parent, 0.04, 0.004, 0.006, k.dark, x + Math.cos(a) * 0.062, CEIL - 0.038, z + Math.sin(a) * 0.062).rotation.y = -a
  }
  const led = new Mesh(new SphereGeometry(0.007, 6, 4), mat('#ff3b2e', { emissive: '#ff2a1e', emissiveIntensity: 1.4 }))
  led.position.set(x + 0.05, CEIL - 0.035, z)
  parent.add(led)
}
// Sprinkler head.
function sprinkler(parent, x, z) {
  const k = kit()
  cyl(parent, 0.04, 0.04, 0.008, k.chrome, x, CEIL - 0.004, z, 14)
  cyl(parent, 0.01, 0.012, 0.05, k.brass, x, CEIL - 0.03, z, 8)
  cyl(parent, 0.028, 0.028, 0.004, k.brass, x, CEIL - 0.058, z, 10)
  cyl(parent, 0.005, 0.005, 0.02, mat('#e23a2a', { roughness: 0.2, transparent: true, opacity: 0.8 }), x + 0.01, CEIL - 0.045, z, 6).rotation.z = Math.PI / 2
}
// Louvred ceiling / wall vent (w x h), in the parent's local XY plane facing +z.
function louvres(g, w, h, out, n = 6) {
  const k = kit()
  rbox(g, w + 0.06, h + 0.06, out, 0.01, k.vent, 0, 0, out / 2)
  box(g, w, h, 0.01, k.dark, 0, 0, out + 0.001)
  for (let i = 0; i < n; i++) {
    const s = box(g, w - 0.01, 0.012, h / n + 0.01, k.vent, 0, -h / 2 + (i + 0.5) * (h / n), out + 0.006)
    s.rotation.x = -0.7
  }
}
function ceilingVent(parent, x, z, w, d) {
  const g = new Group()
  g.position.set(x, CEIL, z)
  g.rotation.x = Math.PI / 2
  louvres(g, w, d, 0.03, 7)
  parent.add(g)
}

function paintDND() {
  const c = canvas(128, 320)
  const ctx = c.getContext('2d')
  roundRect(ctx, 0, 0, 128, 320, 14)
  ctx.fillStyle = '#e2382a'
  ctx.fill()
  ctx.fillStyle = '#fff4e0'
  ctx.beginPath(); ctx.arc(64, 44, 26, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = '#e2382a'
  ctx.beginPath(); ctx.arc(64, 44, 17, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = '#fff4e0'
  ctx.textAlign = 'center'
  ctx.font = `800 30px ${FONT}`
  ;['DO', 'NOT', 'DISTURB'].forEach((t, i) => ctx.fillText(t, 64, 130 + i * 40, 116))
  ctx.font = `600 16px ${FONT}`
  ctx.fillText('zzz…', 64, 270)
  return c
}
function paintFireMap() {
  const c = canvas(256, 320)
  const ctx = c.getContext('2d')
  ctx.fillStyle = '#fbf7ee'
  ctx.fillRect(0, 0, 256, 320)
  ctx.fillStyle = '#d8322a'
  ctx.fillRect(0, 0, 256, 54)
  ctx.fillStyle = '#fff'
  ctx.textAlign = 'center'
  ctx.font = `800 24px ${FONT}`
  ctx.fillText('IN CASE OF FIRE', 128, 36)
  // Floor plan: the row of rooms, the walkway and the exit arrows.
  ctx.strokeStyle = '#3a3a3a'
  ctx.lineWidth = 3
  ctx.strokeRect(20, 80, 216, 90)
  for (let i = 1; i < 6; i++) {
    ctx.beginPath(); ctx.moveTo(20 + i * 36, 80); ctx.lineTo(20 + i * 36, 170); ctx.stroke()
  }
  ctx.fillStyle = '#f2c232'
  ctx.fillRect(56, 82, 32, 86)
  ctx.fillStyle = '#3a3a3a'
  ctx.font = `700 13px ${FONT}`
  ctx.fillText('YOU ARE HERE', 72, 196)
  ctx.strokeStyle = '#1fae55'
  ctx.fillStyle = '#1fae55'
  ctx.lineWidth = 5
  ctx.beginPath(); ctx.moveTo(72, 175); ctx.lineTo(72, 215); ctx.lineTo(205, 215); ctx.stroke()
  ctx.beginPath(); ctx.moveTo(220, 215); ctx.lineTo(202, 204); ctx.lineTo(202, 226); ctx.fill()
  ctx.font = `800 20px ${FONT}`
  ctx.fillText('EXIT', 128, 250)
  ctx.fillStyle = '#555'
  ctx.font = `600 13px ${FONT}`
  ctx.fillText('CHECK-OUT 11 AM', 128, 282)
  ctx.fillText('FRONT DESK: DIAL 0', 128, 302)
  return c
}

// --- Guest room ----------------------------------------------------------------------------
// r: { ix0, ix1, iz0, iz1, doorX, doorW, winX, bx0, bz1, doorC, dw, fixture: {x, y, z} }
export function detailRoom(statics, live, r) {
  const k = kit()
  const { ix0, ix1, iz0, iz1, doorX, winX, bx0, bz1, doorC, dw } = r
  const dHalf = r.doorW / 2
  const W = wallZ(ix0 + 0.015, 1)
  const E = wallZ(ix1 - 0.015, -1)
  const Bk = wallX(iz0 + 0.015, 1)
  const F = wallX(iz1 - 0.02, -1)
  const bathSide = wallZ(bx0 - 0.085, -1) // the bathroom's outer (room-side) side wall
  const bathFront = wallX(bz1 + 0.085, 1) // the bathroom's outer front wall
  const doorL = doorX - dHalf - 0.1
  const doorR = doorX + dHalf + 0.1
  const bdL = doorC - dw / 2 - 0.09
  const bdR = doorC + dw / 2 + 0.09

  // Baseboards + crown moulding round the bedroom.
  baseboard(statics, W, iz0, iz1)
  baseboard(statics, E, bz1 + 0.085, iz1)
  baseboard(statics, Bk, ix0, bx0 - 0.085)
  baseboard(statics, F, ix0, doorL)
  baseboard(statics, F, doorR, ix1)
  baseboard(statics, bathSide, iz0, bz1 + 0.085)
  baseboard(statics, bathFront, bx0 - 0.085, bdL)
  baseboard(statics, bathFront, bdR, ix1)
  crown(statics, W, iz0, iz1)
  crown(statics, E, bz1 + 0.085, iz1)
  crown(statics, Bk, ix0, bx0 - 0.085)
  crown(statics, F, ix0, ix1)
  crown(statics, bathSide, iz0, bz1 + 0.085)
  crown(statics, bathFront, bx0 - 0.085, ix1)

  // Bathroom doorway casing (room side).
  const casing = (wall, a, b, top) => {
    // 1 cm into the opening, so the casing never shares a face with the wainscot / cap ends.
    strip(statics, wall, a - 0.09, a + 0.01, FLOOR_Y, top - FLOOR_Y + 0.09, 0, 0.075, k.casing)
    strip(statics, wall, b - 0.01, b + 0.09, FLOOR_Y, top - FLOOR_Y + 0.09, 0, 0.075, k.casing)
    strip(statics, wall, a - 0.12, b + 0.12, top, 0.12, 0, 0.085, k.casing)
    strip(statics, wall, a - 0.14, b + 0.14, top + 0.11, 0.03, 0, 0.1, k.casing)
  }
  casing(bathFront, doorC - dw / 2, doorC + dw / 2, 2.35)
  // Entrance door: casing over the existing jambs + a brass threshold.
  strip(statics, F, doorL - 0.06, doorL, FLOOR_Y, 2.42, 0, 0.085, k.casing)
  strip(statics, F, doorR, doorR + 0.06, FLOOR_Y, 2.42, 0, 0.085, k.casing)
  strip(statics, F, doorL - 0.1, doorR + 0.1, FLOOR_Y + 2.38, 0.1, 0, 0.09, k.casing)
  box(statics, r.doorW, 0.014, 0.34, k.brass, doorX, FLOOR_Y + 0.012, iz1 + 0.08)

  // Window: casing, apron under the sill, half-drawn venetian blinds in the reveal, a latch.
  const wx0 = winX - 1.05
  const wx1 = winX + 1.05
  strip(statics, F, wx0 - 0.1, wx0, 1.07, 1.48, 0, 0.075, k.casing)
  strip(statics, F, wx1, wx1 + 0.1, 1.07, 1.48, 0, 0.075, k.casing)
  strip(statics, F, wx0 - 0.14, wx1 + 0.14, 2.45, 0.12, 0, 0.085, k.casing)
  strip(statics, F, wx0 - 0.16, wx1 + 0.16, 2.56, 0.03, 0, 0.09, k.casing) // drapes hang at 0.1
  strip(statics, F, wx0 - 0.05, wx1 + 0.05, 0.96, 0.12, 0, 0.075, k.casing)
  const blindZ = iz1 + 0.07 // inside the window reveal, room side of the glass
  box(statics, 2.06, 0.06, 0.07, k.slat, winX, 2.41, blindZ)
  for (let i = 0; i < 9; i++) {
    const s = box(statics, 2.0, 0.008, 0.05, k.slat, winX, 2.35 - i * 0.042, blindZ)
    s.rotation.x = 0.5
  }
  box(statics, 2.02, 0.03, 0.055, k.slat, winX, 1.97, blindZ)
  for (const x of [winX - 0.7, winX + 0.7]) box(statics, 0.004, 0.42, 0.004, k.slat, x, 2.18, blindZ - 0.02)
  box(statics, 0.004, 0.7, 0.004, k.slat, winX + 0.95, 1.8, blindZ - 0.035)
  cyl(statics, 0.012, 0.012, 0.05, k.slat, winX + 0.95, 1.43, blindZ - 0.035, 8)

  // AC unit inside face: louvred grille, control panel with knobs, top vents.
  const ac = onWall(statics, F, winX, 0.62)
  ac.position.z = iz1 - 0.36
  rbox(ac, 0.68, 0.36, 0.012, 0.004, k.dark, -0.15, 0, 0.004)
  for (let i = 0; i < 8; i++) box(ac, 0.66, 0.02, 0.035, k.acGrille, -0.15, -0.16 + i * 0.045, 0.02).rotation.x = -0.6
  rbox(ac, 0.28, 0.36, 0.02, 0.01, mat('#cfc4b0', { roughness: 0.5 }), 0.37, 0, 0.01)
  for (const [y, c] of [[0.08, '#2f6fd0'], [-0.06, '#e2382a']]) {
    const kn = cyl(ac, 0.04, 0.045, 0.035, k.plastic, 0.37, y, 0.035, 16)
    kn.rotation.x = Math.PI / 2
    box(ac, 0.008, 0.05, 0.01, mat(c), 0.37, y + 0.005, 0.055)
  }
  box(ac, 0.2, 0.025, 0.012, mat('#3a3a3a'), 0.37, 0.15, 0.022)
  for (let i = 0; i < 10; i++) box(statics, 0.06, 0.008, 0.2, k.dark, winX - 0.45 + i * 0.1, 0.865, iz1 - 0.2)

  // Front wall by the door: light switch, fire-exit plaque, coat hooks with a DND hanger.
  lightSwitch(onWall(statics, F, doorR + 0.22, 1.4), 2)
  const fm = onWall(statics, F, doorR + 0.62, 1.82)
  rbox(fm, 0.34, 0.42, 0.07, 0.01, mat('#c99a3e', { metalness: 0.6, roughness: 0.4 }), 0, 0, 0.035)
  sign(fm, 'firemap', paintFireMap, 0.3, 0.375, 0, 0, 0.075)
  const hk = onWall(statics, F, (ix0 + doorL) / 2, 1.78)
  rbox(hk, 0.6, 0.09, 0.07, 0.015, k.base, 0, 0, 0.035)
  for (const x of [-0.18, 0, 0.18]) {
    cyl(hk, 0.012, 0.012, 0.06, k.brass, x, 0, 0.1, 8).rotation.x = Math.PI / 2
    cyl(hk, 0.012, 0.012, 0.06, k.brass, x, 0.025, 0.13, 8)
    const knob = new Mesh(new SphereGeometry(0.018, 8, 6), k.brass)
    knob.position.set(x, 0.06, 0.13)
    hk.add(knob)
  }
  const dnd = sign(hk, 'dnd', paintDND, 0.13, 0.32, 0.18, -0.15, 0.125)
  dnd.rotation.x = -0.05
  dnd.material.side = DoubleSide

  // West wall: thermostat near the door, outlet below the nightstand spot, two reading
  // sconces either side of the bed (the art spot above the bed stays clear).
  thermostat(onWall(statics, W, iz0 + 8.6, 1.5))
  outlet(onWall(statics, W, iz0 + 7.4, 0.5)) // above the baseboard
  const bedZ = r.bedZ
  sconce(onWall(statics, W, bedZ - 1.0, 2.05))
  sconce(onWall(statics, W, bedZ + 0.9, 2.05))
  // East + back walls: outlets, a high return vent.
  outlet(onWall(statics, E, iz0 + 4.2, 0.5))
  outlet(onWall(statics, Bk, ix0 + 3.0, 0.5))
  louvres(onWall(statics, Bk, ix0 + 2.9, 3.12), 0.6, 0.26, 0.075)

  // Ceiling: smoke detector, sprinkler, brass ring + finial on the light.
  smokeDetector(statics, (ix0 + ix1) / 2 + 1.2, iz1 - 2.4)
  sprinkler(statics, ix0 + 1.6, iz1 - 2.0)
  const f = r.fixture
  const ring = new Mesh(new TorusGeometry(0.33, 0.02, 8, 28), k.brass)
  ring.rotation.x = Math.PI / 2
  ring.position.set(f.x, CEIL - 0.01, f.z)
  statics.add(ring)
  const fin = new Mesh(new SphereGeometry(0.035, 10, 6), k.brass)
  fin.position.set(f.x, CEIL - 0.34, f.z)
  statics.add(fin)

  // --- Bathroom (east wall tile face at ix1 - 0.03, back wall tile face at iz0 + 0.03).
  const BE = wallZ(ix1 - 0.03, -1)
  const BB = wallX(iz0 + 0.03, 1)
  // Towel bar with a folded towel, between the toilet and the sink.
  const tb = onWall(statics, BE, iz0 + 0.72, 1.56)
  for (const x of [-0.3, 0.3]) {
    const p = cyl(tb, 0.025, 0.025, 0.012, k.chrome, x, 0, 0.006, 12)
    p.rotation.x = Math.PI / 2
    cyl(tb, 0.01, 0.01, 0.07, k.chrome, x, 0, 0.045, 8).rotation.x = Math.PI / 2
  }
  cyl(tb, 0.012, 0.012, 0.64, k.chrome, 0, 0, 0.08, 10).rotation.z = Math.PI / 2
  rbox(tb, 0.42, 0.5, 0.03, 0.01, k.towel, 0, -0.24, 0.1)
  rbox(tb, 0.42, 0.5, 0.03, 0.01, k.towel, 0, -0.21, 0.065)
  box(tb, 0.43, 0.045, 0.042, k.towelBand, 0, -0.38, 0.1)
  rbox(tb, 0.44, 0.05, 0.07, 0.02, k.towel, 0, 0.0, 0.08)
  // Vanity light bar over the mirror (the mirror is at iz0 + 1.85).
  const lb = onWall(statics, BE, iz0 + 1.85, 2.32)
  rbox(lb, 0.66, 0.08, 0.05, 0.02, k.chrome, 0, 0, 0.025)
  for (const x of [-0.22, 0, 0.22]) {
    cyl(lb, 0.025, 0.025, 0.03, k.chrome, x, -0.04, 0.05, 10)
    const b = new Mesh(new SphereGeometry(0.05, 12, 8), k.bulb)
    b.position.set(x, -0.08, 0.06)
    lb.add(b)
  }
  // Glass shelf above the toilet: spare rolls, soap and shampoo bottles.
  const sh = onWall(statics, BB, doorC, 1.72)
  box(sh, 0.6, 0.012, 0.16, k.glassShelf, 0, 0, 0.09)
  for (const x of [-0.26, 0.26]) box(sh, 0.02, 0.06, 0.16, k.chrome, x, -0.03, 0.08)
  for (const x of [-0.2, -0.08]) cyl(sh, 0.055, 0.055, 0.1, k.tp, x, 0.056, 0.09, 14)
  cyl(sh, 0.025, 0.028, 0.14, mat('#f2b632', { roughness: 0.3 }), 0.06, 0.076, 0.09, 10)
  cyl(sh, 0.012, 0.012, 0.03, k.dark, 0.06, 0.16, 0.09, 8)
  cyl(sh, 0.03, 0.03, 0.11, mat('#ff7fb0', { roughness: 0.3 }), 0.14, 0.062, 0.08, 10)
  rbox(sh, 0.08, 0.025, 0.05, 0.01, mat('#bfe9de', { roughness: 0.4 }), 0.21, 0.018, 0.1)
  // Toilet: supply valve + braided line, brush holder, pedal bin.
  cyl(statics, 0.02, 0.02, 0.06, k.chrome, doorC - 0.16, FLOOR_Y + 0.17, iz0 + 0.06, 8).rotation.x = Math.PI / 2
  cyl(statics, 0.03, 0.03, 0.02, k.chrome, doorC - 0.16, FLOOR_Y + 0.17, iz0 + 0.1, 10).rotation.x = Math.PI / 2
  cyl(statics, 0.008, 0.008, 0.42, k.steel, doorC - 0.16, FLOOR_Y + 0.38, iz0 + 0.12, 6)
  cyl(statics, 0.06, 0.055, 0.16, k.plastic, doorC + 0.48, FLOOR_Y + 0.08, iz0 + 0.22, 14)
  cyl(statics, 0.01, 0.01, 0.34, k.chrome, doorC + 0.48, FLOOR_Y + 0.3, iz0 + 0.22, 6)
  const bk = new Mesh(new SphereGeometry(0.02, 8, 6), k.chrome)
  bk.position.set(doorC + 0.48, FLOOR_Y + 0.48, iz0 + 0.22)
  statics.add(bk)
  cyl(statics, 0.11, 0.1, 0.3, k.chrome, ix1 - 0.2, FLOOR_Y + 0.15, iz0 + 0.24, 18)
  const lid = cyl(statics, 0.115, 0.115, 0.02, k.chrome, ix1 - 0.2, FLOOR_Y + 0.31, iz0 + 0.24, 18)
  void lid
  box(statics, 0.06, 0.015, 0.06, k.dark, ix1 - 0.2, FLOOR_Y + 0.012, iz0 + 0.37)
  const tp = onWall(statics, BB, doorC + 0.5, 0.78)
  for (const x of [-0.075, 0.075]) box(tp, 0.012, 0.05, 0.13, k.chrome, x, 0, 0.065)
  box(tp, 0.17, 0.06, 0.012, k.chrome, 0, 0, 0.006)
  // Extractor grille + a small ceiling light in the bathroom.
  ceilingVent(statics, doorC + 0.2, iz0 + 1.45, 0.3, 0.3)
  cyl(statics, 0.16, 0.12, 0.06, mat('#fffaf0', { emissive: '#fff0c8', emissiveIntensity: 0.5 }), bx0 + 0.9, CEIL - 0.03, iz0 + 1.3, 18)
  // Bathroom baseboard: a dark-green tile cove along the walls the tub doesn't use.
  const cove = mat('#178a56', { roughness: 0.35 })
  strip(statics, BB, bx0 + 0.9, ix1, FLOOR_Y, 0.1, 0, 0.02, cove)
  strip(statics, BE, iz0, bz1 - 0.08, FLOOR_Y, 0.1, 0, 0.02, cove)
}

// --- Office ---------------------------------------------------------------------------------
// o: { ix0, ix1, iz0, iz1, doorX, winX0, winX1, cz, cx0, cx1 }
export function detailOffice(statics, live, o) {
  const k = kit()
  const { ix0, ix1, iz0, iz1, doorX, cz, cx0, cx1 } = o
  const W = wallZ(ix0 + 0.01, 1)
  const E = wallZ(ix1 - 0.01, -1)
  const Bk = wallX(iz0 + 0.01, 1)
  const F = wallX(iz1 - 0.02, -1)
  const doorL = doorX - 0.74
  const doorR = doorX + 0.74
  // Trim.
  baseboard(statics, W, iz0, iz1, 0.03)
  baseboard(statics, E, iz0, iz1, 0.03)
  baseboard(statics, Bk, ix0, ix1, 0.03)
  baseboard(statics, F, ix0, doorL, 0)
  baseboard(statics, F, doorR, ix1, 0)
  crown(statics, W, iz0, iz1)
  crown(statics, E, iz0, iz1)
  crown(statics, Bk, ix0, ix1)
  crown(statics, F, ix0, ix1)
  // Counter: a dark kick plate along the customer face and a brass foot rail.
  box(statics, cx1 - cx0, 0.1, 0.04, k.dark, (cx0 + cx1) / 2, FLOOR_Y + 0.05, cz + 0.016) // 1.6 cm proud of the panels
  cyl(statics, 0.022, 0.022, cx1 - cx0 - 0.6, k.brass, (cx0 + cx1) / 2 + 0.1, FLOOR_Y + 0.22, cz + 0.16, 10).rotation.z = Math.PI / 2
  for (let x = cx0 + 0.6; x <= cx1 - 0.3; x += 1.4) {
    cyl(statics, 0.012, 0.012, 0.18, k.brass, x, FLOOR_Y + 0.22, cz + 0.08, 8).rotation.x = Math.PI / 2
  }

  // Front wall: switch by the door, "COME AGAIN" plaque over it.
  lightSwitch(onWall(statics, F, doorL - 0.25, 1.3), 2, 0.012)
  const ty = onWall(statics, F, doorX, 3.05)
  rbox(ty, 1.3, 0.3, 0.04, 0.02, k.base, 0, 0, 0.02)
  sign(ty, 'comeagain', () => paintSign({ w: 512, h: 112, bg: '#fff4e0', border: '#e2b33c', borderW: 8, radius: 14, lines: [{ t: 'THANK YOU · COME AGAIN', size: 44, color: '#c8352a' }] }), 1.22, 0.24, 0, 0, 0.045)

  // West wall (customer side): water cooler, fire extinguisher, travel poster, outlet.
  const wc = new Group()
  rbox(wc, 0.36, 0.95, 0.36, 0.03, k.plastic, 0, 0.475, 0)
  box(wc, 0.3, 0.02, 0.02, k.dark, 0, 0.82, 0.18)
  rbox(wc, 0.2, 0.12, 0.08, 0.02, mat('#d9d2c4'), 0, 0.72, 0.2)
  for (const [x, c] of [[-0.05, '#2f6fd0'], [0.05, '#e2382a']]) {
    rbox(wc, 0.04, 0.06, 0.05, 0.01, mat(c, { roughness: 0.3 }), x, 0.7, 0.25)
  }
  box(wc, 0.2, 0.02, 0.1, k.steel, 0, 0.58, 0.21)
  const bottle = cyl(wc, 0.15, 0.15, 0.4, k.bottle, 0, 1.16, 0, 20)
  void bottle
  cyl(wc, 0.07, 0.15, 0.08, k.bottle, 0, 0.93, 0, 20)
  cyl(wc, 0.05, 0.05, 0.04, mat('#2f6fd0'), 0, 1.38, 0, 14)
  cyl(wc, 0.04, 0.04, 0.32, mat('#f4f4f4', { roughness: 0.4 }), 0.24, 0.8, -0.1, 12)
  cyl(wc, 0.045, 0.045, 0.03, k.dark, 0.24, 0.64, -0.1, 12)
  wc.position.set(ix0 + 0.25, FLOOR_Y, -9.25)
  wc.rotation.y = Math.PI / 2
  statics.add(wc)
  solid(0.2, 0.7, 0.2, ix0 + 0.25, FLOOR_Y + 0.7, -9.25)
  // Fire extinguisher on a bracket, with a FIRE sign over it.
  const ex = onWall(statics, W, -7.75, FLOOR_Y + 0.55)
  box(ex, 0.12, 0.08, 0.06, k.dark, 0, 0.22, 0.03)
  cyl(ex, 0.075, 0.075, 0.5, k.red, 0, 0.15, 0.12, 18)
  const dome = new Mesh(new SphereGeometry(0.075, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), k.red)
  dome.position.set(0, 0.4, 0.12)
  ex.add(dome)
  box(ex, 0.03, 0.09, 0.03, k.dark, 0, 0.47, 0.12)
  box(ex, 0.14, 0.02, 0.03, k.dark, 0.02, 0.51, 0.12).rotation.z = -0.2
  cyl(ex, 0.025, 0.025, 0.012, mat('#f4f4f4'), 0.04, 0.46, 0.17, 10).rotation.x = Math.PI / 2
  const hose = cyl(ex, 0.014, 0.014, 0.4, k.dark, 0.08, 0.25, 0.14, 6)
  hose.rotation.z = 0.15
  box(ex, 0.09, 0.12, 0.01, mat('#f4efe2'), 0, 0.15, 0.2)
  sign(onWall(statics, W, -7.75, 1.45), 'firesign', () => paintSign({ w: 256, h: 96, bg: '#d8322a', border: '#fff', borderW: 8, radius: 8, lines: [{ t: 'FIRE ▼', size: 54, color: '#fff' }] }), 0.32, 0.12, 0, 0, 0.012)
  const pst = onWall(statics, W, -8.55, 2.1)
  rbox(pst, 0.72, 0.96, 0.03, 0.01, k.base, 0, 0, 0.015)
  sign(pst, 'poster', paintTravelPoster, 0.64, 0.88, 0, 0, 0.035)
  outlet(onWall(statics, W, -10.25, FLOOR_Y + 0.38), 0.045)

  // East wall: wall clock over the HELP WANTED board, two waiting chairs and a plant.
  const clk = onWall(statics, E, -9.8, 3.0)
  const rim = cyl(clk, 0.24, 0.24, 0.06, mat(C.teal, { roughness: 0.4 }), 0, 0, 0.03, 32)
  rim.rotation.x = Math.PI / 2
  const face = new Mesh(new PlaneGeometry(0.42, 0.42), new MeshStandardMaterial({ map: canvasTex(paintClockFace()), transparent: true, roughness: 0.5 }))
  face.position.z = 0.065
  clk.add(face)
  const hands = new Group()
  hands.position.z = 0.07
  clk.add(hands)
  const hourH = new Group()
  const minH = new Group()
  hands.add(hourH, minH)
  box(hourH, 0.018, 0.11, 0.006, k.dark, 0, 0.045, 0)
  const minMesh = box(minH, 0.012, 0.17, 0.006, k.dark, 0, 0.075, 0.004)
  // Hands follow real time, updated only when the clock is actually drawn.
  minMesh.onBeforeRender = () => {
    const d = new Date()
    const m = d.getMinutes() + d.getSeconds() / 60
    minH.rotation.z = -(m / 60) * Math.PI * 2
    hourH.rotation.z = -(((d.getHours() % 12) + m / 60) / 12) * Math.PI * 2
  }
  const cap = cyl(hands, 0.015, 0.015, 0.01, k.brass, 0, 0, 0.008, 10)
  cap.rotation.x = Math.PI / 2
  // The clock group is baked with the statics, so hands are re-parented to `live` to move.
  clk.updateMatrixWorld(true)
  hands.removeFromParent()
  hands.applyMatrix4(clk.matrixWorld)
  live.add(hands)
  for (const z of [-8.3, -7.45]) waitingChair(statics, ix1 - 0.4, z, -Math.PI / 2)
  solid(0.32, 0.45, 0.75, ix1 - 0.4, FLOOR_Y + 0.45, -7.875)
  pottedPlant(statics, ix1 - 0.35, iz1 - 0.38, 1.25)
  solid(0.25, 0.6, 0.25, ix1 - 0.35, FLOOR_Y + 0.6, iz1 - 0.38)
  pottedPlant(statics, ix0 + 0.35, iz1 - 0.42, 1.0, 2)
  solid(0.25, 0.6, 0.25, ix0 + 0.35, FLOOR_Y + 0.6, iz1 - 0.42)
  outlet(onWall(statics, E, -6.95, FLOOR_Y + 0.38), 0.045)

  // Postcard spinner by the display window.
  const sp = new Group()
  cyl(sp, 0.22, 0.25, 0.04, k.steel, 0, 0.02, 0, 18)
  cyl(sp, 0.018, 0.018, 1.6, k.steel, 0, 0.82, 0, 8)
  const tiers = new Group()
  const cardCols = ['#f06a34', '#2f6fd0', '#f2b632', '#27a596', '#e2382a', '#7b3fd0', '#5ac46a', '#ff7fb0']
  for (let t = 0; t < 4; t++) {
    for (let s = 0; s < 4; s++) {
      const a = (s / 4) * Math.PI * 2 + t * 0.4
      const holder = new Group()
      holder.rotation.y = a
      holder.position.y = 0.55 + t * 0.3
      box(holder, 0.18, 0.012, 0.03, k.steel, 0, -0.1, 0.12)
      for (let c = 0; c < 2; c++) {
        const card = box(holder, 0.07, 0.11, 0.004, mat(cardCols[(t * 4 + s + c) % 8], { roughness: 0.6 }), -0.045 + c * 0.09, -0.04, 0.13 + c * 0.003)
        card.rotation.x = -0.12
      }
      tiers.add(holder)
    }
  }
  sp.add(tiers)
  const sign2 = sign(sp, 'postcards', () => paintSign({ w: 256, h: 64, bg: '#f2b632', border: '#c8352a', borderW: 6, radius: 10, lines: [{ t: 'POSTCARDS 25¢', size: 34, color: '#7a2b10' }] }), 0.34, 0.085, 0, 1.68, 0.02)
  sign2.material.side = DoubleSide
  sp.position.set(-13.75, FLOOR_Y, iz1 - 0.75)
  statics.add(sp)
  addFixed(RAPIER.ColliderDesc.cylinder(0.85, 0.24), { x: -13.75, y: FLOOR_Y + 0.85, z: iz1 - 0.75 })

  // Ceiling fittings.
  smokeDetector(statics, -13.6, -8.2)
  sprinkler(statics, -18.4, -12.8)
  sprinkler(statics, -13.4, -7.4) // clear of the ceiling water stain
  ceilingVent(statics, -18.2, -8.4, 0.5, 0.5)
  ceilingVent(statics, -16.6, -14.2, 0.5, 0.5)

}

function waitingChair(parent, x, z, ry) {
  const k = kit()
  const g = new Group()
  rbox(g, 0.62, 0.1, 0.56, 0.04, k.vinyl, 0, 0.46, 0.02)
  const back = rbox(g, 0.62, 0.48, 0.08, 0.04, k.vinyl, 0, 0.8, -0.27)
  back.rotation.x = -0.12
  for (let i = 0; i < 3; i++) box(g, 0.005, 0.38, 0.082, mat('#c4511f', { roughness: 0.5 }), -0.18 + i * 0.18, 0.8, -0.266).rotation.x = -0.12
  // Chrome tube frame: sled legs + arm rests.
  for (const sx of [-0.33, 0.33]) {
    cyl(g, 0.016, 0.016, 0.62, k.tube, sx, 0.02, 0, 8).rotation.x = Math.PI / 2
    cyl(g, 0.016, 0.016, 0.44, k.tube, sx, 0.22, 0.29, 8)
    cyl(g, 0.016, 0.016, 0.8, k.tube, sx, 0.42, -0.28, 8).rotation.x = -0.1
    cyl(g, 0.016, 0.016, 0.56, k.tube, sx, 0.64, 0.02, 8).rotation.x = Math.PI / 2
    rbox(g, 0.07, 0.04, 0.4, 0.015, mat('#3a2a1e', { roughness: 0.5 }), sx, 0.67, 0.04)
  }
  g.position.set(x, FLOOR_Y, z)
  g.rotation.y = ry
  parent.add(g)
}

function pottedPlant(parent, x, z, h = 1.2, kind = 1) {
  const k = kit()
  const g = new Group()
  cyl(g, 0.22, 0.16, 0.4, k.potTerracotta, 0, 0.2, 0, 16)
  cyl(g, 0.235, 0.235, 0.05, k.potTerracotta, 0, 0.4, 0, 16)
  cyl(g, 0.2, 0.2, 0.02, k.soil, 0, 0.39, 0, 14)
  const n = kind === 2 ? 9 : 14
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + i * 0.7
    if (kind === 2) {
      // Snake plant: tall upright blades.
      const bl = new Mesh(new PlaneGeometry(0.09, h * (0.6 + (i % 3) * 0.15)), i % 2 ? k.leaf : k.leafDark)
      bl.position.set(Math.cos(a) * 0.08, 0.4 + (h * (0.6 + (i % 3) * 0.15)) / 2, Math.sin(a) * 0.08)
      bl.rotation.set(Math.sin(a) * 0.12, a, Math.cos(a) * 0.12)
      g.add(bl)
    } else {
      // Leafy palm: arching fronds.
      const fr = new Mesh(new PlaneGeometry(0.16, 0.7), i % 2 ? k.leaf : k.leafDark)
      const tilt = 0.5 + (i % 3) * 0.25
      fr.position.set(Math.cos(a) * 0.22, 0.4 + h * 0.45 - tilt * 0.15, Math.sin(a) * 0.22)
      fr.rotation.set(0, -a + Math.PI / 2, 0)
      fr.rotateX(tilt)
      g.add(fr)
      cyl(g, 0.01, 0.012, h * 0.5, mat('#6b5a2a'), Math.cos(a) * 0.05, 0.4 + h * 0.22, Math.sin(a) * 0.05, 5)
    }
  }
  g.position.set(x, FLOOR_Y, z)
  parent.add(g)
}

function paintClockFace() {
  const c = canvas(256)
  const ctx = c.getContext('2d')
  ctx.fillStyle = '#fbf5e8'
  ctx.beginPath(); ctx.arc(128, 128, 118, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = '#2b2b2e'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = `700 30px ${FONT}`
  for (let i = 1; i <= 12; i++) {
    const a = (i / 12) * Math.PI * 2 - Math.PI / 2
    ctx.fillText(String(i), 128 + Math.cos(a) * 92, 128 + Math.sin(a) * 92)
  }
  for (let i = 0; i < 60; i++) {
    const a = (i / 60) * Math.PI * 2
    ctx.fillRect(128 + Math.cos(a) * 110 - 1.5, 128 + Math.sin(a) * 110 - 1.5, 3, 3)
  }
  ctx.fillStyle = '#c8352a'
  ctx.font = `700 14px ${FONT}`
  ctx.fillText('MOTEL TIME', 128, 168)
  return c
}

function paintTravelPoster() {
  const c = canvas(320, 440)
  const ctx = c.getContext('2d')
  const sky = ctx.createLinearGradient(0, 0, 0, 300)
  sky.addColorStop(0, '#ff9a4a')
  sky.addColorStop(0.6, '#ffd27a')
  ctx.fillStyle = sky
  ctx.fillRect(0, 0, 320, 440)
  ctx.fillStyle = '#fff2c4'
  ctx.beginPath(); ctx.arc(220, 150, 46, 0, Math.PI * 2); ctx.fill()
  // Mesas.
  ctx.fillStyle = '#c4532a'
  ctx.beginPath()
  ctx.moveTo(0, 300); ctx.lineTo(30, 200); ctx.lineTo(110, 200); ctx.lineTo(140, 300)
  ctx.moveTo(150, 300); ctx.lineTo(180, 230); ctx.lineTo(260, 230); ctx.lineTo(300, 300)
  ctx.fill()
  ctx.fillStyle = '#e8a04a'
  ctx.fillRect(0, 300, 320, 140)
  ctx.fillStyle = '#2f6f4a'
  ctx.fillRect(60, 250, 10, 60)
  ctx.fillRect(48, 270, 34, 8)
  ctx.fillRect(48, 255, 8, 20)
  ctx.fillRect(74, 262, 8, 14)
  ctx.fillStyle = '#5a2414'
  ctx.textAlign = 'center'
  ctx.font = `800 40px ${FONT}`
  ctx.fillText('VISIT THE', 160, 360)
  ctx.font = `800 46px ${FONT}`
  ctx.fillText('MESAS', 160, 408)
  ctx.font = `700 22px ${FONT}`
  ctx.fillStyle = '#7a2b10'
  ctx.fillText('SUNSET VALLEY', 160, 44)
  return c
}
