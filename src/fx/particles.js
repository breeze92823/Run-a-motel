// GPU point-sprite particles: one pooled system per look (soft, normal-blended
// for dust / smoke / suds / water; additive for sparkles and glints). Each
// particle has its own colour, size curve, gravity and drag; ages on the CPU,
// draws in one call. Presets build the game's effects on top.
import { AdditiveBlending, BufferAttribute, BufferGeometry, CanvasTexture, Color, NormalBlending, Points, ShaderMaterial, Vector3 } from 'three'
import { paintSoftDot, paintSparkle } from '../textures.js'

const vert = /* glsl */ `
  attribute float aSize;
  attribute float aAlpha;
  attribute vec3 aColor;
  attribute float aSpin;
  varying float vAlpha;
  varying vec3 vColor;
  varying float vSpin;
  uniform float uScale;
  void main() {
    vAlpha = aAlpha;
    vColor = aColor;
    vSpin = aSpin;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * uScale / max(0.1, -mv.z);
    gl_Position = projectionMatrix * mv;
  }`
const frag = /* glsl */ `
  uniform sampler2D uMap;
  varying float vAlpha;
  varying vec3 vColor;
  varying float vSpin;
  void main() {
    vec2 p = gl_PointCoord - 0.5;
    float c = cos(vSpin), s = sin(vSpin);
    p = mat2(c, -s, s, c) * p + 0.5;
    vec4 t = texture2D(uMap, p);
    gl_FragColor = vec4(vColor * t.rgb, t.a * vAlpha);
    if (gl_FragColor.a < 0.01) discard;
  }`

class System {
  constructor(scene, max, canvas, additive) {
    this.max = max
    this.pos = new Float32Array(max * 3)
    this.size = new Float32Array(max)
    this.alpha = new Float32Array(max)
    this.color = new Float32Array(max * 3)
    this.spin = new Float32Array(max)
    this.p = Array.from({ length: max }, () => ({ life: 0, age: 0, vx: 0, vy: 0, vz: 0, g: 0, drag: 0, s0: 0, s1: 0, a0: 1, spinV: 0, fadeIn: 0 }))
    this.geo = new BufferGeometry()
    this.geo.setAttribute('position', new BufferAttribute(this.pos, 3))
    this.geo.setAttribute('aSize', new BufferAttribute(this.size, 1))
    this.geo.setAttribute('aAlpha', new BufferAttribute(this.alpha, 1))
    this.geo.setAttribute('aColor', new BufferAttribute(this.color, 3))
    this.geo.setAttribute('aSpin', new BufferAttribute(this.spin, 1))
    const tex = new CanvasTexture(canvas)
    this.mat = new ShaderMaterial({
      uniforms: { uMap: { value: tex }, uScale: { value: 600 } },
      vertexShader: vert,
      fragmentShader: frag,
      transparent: true,
      depthWrite: false,
      blending: additive ? AdditiveBlending : NormalBlending,
    })
    this.points = new Points(this.geo, this.mat)
    this.points.frustumCulled = false
    this.points.renderOrder = 5
    scene.add(this.points)
    this.next = 0
  }
  emit(x, y, z, o) {
    const i = this.next
    this.next = (this.next + 1) % this.max
    const p = this.p[i]
    p.life = o.life
    p.age = 0
    p.vx = o.vx ?? 0
    p.vy = o.vy ?? 0
    p.vz = o.vz ?? 0
    p.g = o.g ?? 0
    p.drag = o.drag ?? 0
    p.s0 = o.size ?? 0.3
    p.s1 = o.endSize ?? p.s0
    p.a0 = o.alpha ?? 1
    p.fadeIn = o.fadeIn ?? 0.1
    p.spinV = o.spin ?? 0
    this.pos[i * 3] = x
    this.pos[i * 3 + 1] = y
    this.pos[i * 3 + 2] = z
    const c = o.color
    this.color[i * 3] = c.r
    this.color[i * 3 + 1] = c.g
    this.color[i * 3 + 2] = c.b
    this.spin[i] = Math.random() * 6.28
  }
  update(dt) {
    for (let i = 0; i < this.max; i++) {
      const p = this.p[i]
      if (p.life <= 0) {
        this.alpha[i] = 0
        continue
      }
      p.age += dt
      if (p.age >= p.life) {
        p.life = 0
        this.alpha[i] = 0
        continue
      }
      const k = Math.exp(-p.drag * dt)
      p.vx *= k
      p.vz *= k
      p.vy = p.vy * k + p.g * dt
      this.pos[i * 3] += p.vx * dt
      this.pos[i * 3 + 1] += p.vy * dt
      this.pos[i * 3 + 2] += p.vz * dt
      const t = p.age / p.life
      this.size[i] = p.s0 + (p.s1 - p.s0) * t
      const fin = Math.min(1, t / Math.max(0.001, p.fadeIn))
      this.alpha[i] = p.a0 * fin * (1 - t * t)
      this.spin[i] += p.spinV * dt
    }
    this.geo.attributes.position.needsUpdate = true
    this.geo.attributes.aSize.needsUpdate = true
    this.geo.attributes.aAlpha.needsUpdate = true
    this.geo.attributes.aColor.needsUpdate = true
    this.geo.attributes.aSpin.needsUpdate = true
  }
}

const col = new Color()
const rnd = (a, b) => a + Math.random() * (b - a)

export function createParticles(scene, quality = 1) {
  const soft = new System(scene, Math.round(900 * quality) + 200, paintSoftDot(64), false)
  const glow = new System(scene, Math.round(500 * quality) + 100, paintSparkle(64), true)
  const q = Math.max(0.35, quality)
  const n = (k) => Math.max(1, Math.round(k * q))
  const fx = {
    setScale(heightPx) {
      soft.mat.uniforms.uScale.value = heightPx
      glow.mat.uniforms.uScale.value = heightPx
    },
    update(dt) {
      soft.update(dt)
      glow.update(dt)
    },
    // Twinkling stars bursting out (task done, room clean).
    sparkle(x, y, z, count = 18, color = '#fff2a8') {
      for (let i = 0; i < n(count); i++) {
        const a = Math.random() * Math.PI * 2
        const s = rnd(1, 3.2)
        glow.emit(x, y, z, { life: rnd(0.5, 1.1), vx: Math.cos(a) * s, vy: rnd(1, 4), vz: Math.sin(a) * s, g: -4, drag: 2.5, size: rnd(0.25, 0.5), endSize: 0.05, color: col.set(color), spin: rnd(-4, 4) })
      }
    },
    // Soapy bubbles while scrubbing.
    bubbles(x, y, z, count = 4) {
      for (let i = 0; i < n(count); i++) {
        soft.emit(x + rnd(-0.4, 0.4), y + rnd(0, 0.1), z + rnd(-0.4, 0.4), { life: rnd(0.6, 1.3), vx: rnd(-0.4, 0.4), vy: rnd(0.4, 1.3), vz: rnd(-0.4, 0.4), g: -0.3, drag: 1.5, size: rnd(0.1, 0.22), endSize: 0.3, color: col.setHSL(0.55, 0.6, rnd(0.85, 0.97)), alpha: 0.8 })
      }
      if (Math.random() < 0.4) glow.emit(x, y + 0.1, z, { life: 0.4, vy: 0.8, size: 0.18, endSize: 0.02, color: col.set('#ffffff') })
    },
    // Dust puff (footsteps on sand, junk dropped, boards pried off).
    dust(x, y, z, count = 8, color = '#e8c690', spread = 0.6) {
      for (let i = 0; i < n(count); i++) {
        const a = Math.random() * Math.PI * 2
        soft.emit(x + Math.cos(a) * spread * 0.3, y + 0.05, z + Math.sin(a) * spread * 0.3, { life: rnd(0.5, 1.2), vx: Math.cos(a) * rnd(0.5, 2) * spread, vy: rnd(0.3, 1.2), vz: Math.sin(a) * rnd(0.5, 2) * spread, g: -0.6, drag: 3, size: rnd(0.3, 0.6), endSize: rnd(0.9, 1.5), color: col.set(color), alpha: 0.55, fadeIn: 0.05 })
      }
    },
    // Exhaust smoke.
    smoke(x, y, z) {
      soft.emit(x, y, z, { life: rnd(1, 1.8), vx: rnd(-0.8, -0.2), vy: rnd(0.3, 0.8), vz: rnd(-0.2, 0.2), g: 0.2, drag: 1, size: 0.3, endSize: 1.4, color: col.set('#9a9a9a'), alpha: 0.35 })
    },
    // Fountain spray from a spout.
    water(x, y, z, count = 3) {
      for (let i = 0; i < n(count); i++) {
        const a = Math.random() * Math.PI * 2
        const s = rnd(0.6, 1.4)
        soft.emit(x, y, z, { life: rnd(0.9, 1.3), vx: Math.cos(a) * s, vy: rnd(2.2, 3.2), vz: Math.sin(a) * s, g: -9, drag: 0.2, size: rnd(0.12, 0.2), endSize: 0.08, color: col.setHSL(0.53, 0.7, rnd(0.75, 0.92)), alpha: 0.85, fadeIn: 0.02 })
      }
      if (Math.random() < 0.3) glow.emit(x, y, z, { life: 0.7, vx: rnd(-1, 1), vy: rnd(2, 3), vz: rnd(-1, 1), g: -9, size: 0.15, endSize: 0.05, color: col.set('#e8fbff') })
    },
    // Splash ring where water lands.
    splash(x, y, z) {
      for (let i = 0; i < n(3); i++) {
        const a = Math.random() * Math.PI * 2
        soft.emit(x + Math.cos(a) * 0.2, y, z + Math.sin(a) * 0.2, { life: 0.45, vx: Math.cos(a) * 0.8, vy: rnd(0.6, 1.2), vz: Math.sin(a) * 0.8, g: -6, size: 0.1, endSize: 0.04, color: col.set('#dff7ff'), alpha: 0.7 })
      }
    },
    // Gold coins glinting upward (payments).
    coins(x, y, z, count = 10) {
      for (let i = 0; i < n(count); i++) {
        const a = Math.random() * Math.PI * 2
        glow.emit(x, y, z, { life: rnd(0.6, 1), vx: Math.cos(a) * rnd(0.5, 1.6), vy: rnd(2.5, 4.5), vz: Math.sin(a) * rnd(0.5, 1.6), g: -9, drag: 0.5, size: rnd(0.25, 0.4), endSize: 0.12, color: col.set('#ffd34a'), spin: rnd(-8, 8) })
      }
    },
    // Furniture appearing: a puff ring plus confetti.
    poof(x, y, z) {
      for (let i = 0; i < n(22); i++) {
        const a = (i / 22) * Math.PI * 2
        soft.emit(x, y + 0.3, z, { life: rnd(0.6, 0.9), vx: Math.cos(a) * 3, vy: rnd(0, 1), vz: Math.sin(a) * 3, drag: 5, size: 0.5, endSize: 1.2, color: col.set('#ffffff'), alpha: 0.75 })
      }
      for (let i = 0; i < n(20); i++) {
        glow.emit(x, y + 0.5, z, { life: rnd(0.8, 1.4), vx: rnd(-2, 2), vy: rnd(2, 5), vz: rnd(-2, 2), g: -7, drag: 1, size: rnd(0.15, 0.3), color: col.setHSL(Math.random(), 0.9, 0.6), spin: rnd(-10, 10) })
      }
    },
    // Ambient: drifting sand motes around a point.
    motes(x, z) {
      soft.emit(x + rnd(-25, 25), rnd(0.3, 4), z + rnd(-25, 25), { life: rnd(3, 6), vx: rnd(1, 2.5), vy: rnd(-0.1, 0.2), vz: rnd(-0.3, 0.3), size: rnd(0.05, 0.1), color: col.set('#fff1cf'), alpha: 0.5, fadeIn: 0.3 })
    },
    // Fireflies at night.
    firefly(x, z) {
      glow.emit(x + rnd(-20, 20), rnd(0.5, 3), z + rnd(-20, 20), { life: rnd(2, 4), vx: rnd(-0.3, 0.3), vy: rnd(-0.1, 0.2), vz: rnd(-0.3, 0.3), size: 0.18, endSize: 0.1, color: col.set('#d8ff7a'), alpha: 0.9, fadeIn: 0.4 })
    },
    // Trash sucked toward the bag: a short streak of glints.
    suck(from, to) {
      for (let i = 0; i < n(6); i++) {
        const t = Math.random()
        glow.emit(from.x + (to.x - from.x) * t, from.y + 0.3 + (to.y - from.y) * t, from.z + (to.z - from.z) * t, { life: 0.3, size: 0.18, endSize: 0.02, color: col.set('#bff4ff') })
      }
    },
  }
  return fx
}

export { Vector3 }
