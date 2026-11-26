// Curb appeal: how the motel looks from the road. Litter piles up on the parking lot,
// grime on the walkway, and vandals spray graffiti and stick posters on the outside
// walls (motel/building.js wallSpots). Graffiti is scrubbed off with the SPONGE,
// posters are torn down by HAND. appeal() is 0..100: lower appeal means fewer and poorer
// guests and worse reviews, but never none (CURB in config.js).
import { Mesh, MeshStandardMaterial, PlaneGeometry } from 'three'
import { CURB } from '../config.js'
import { paintGraffiti, paintPoster, tex } from '../motel/paint.js'

const rnd = (a, b) => a + Math.random() * (b - a)

export function createCurb({ scene, spots, fx, play, bank, hud }) {
  const marks = [] // { spot, mesh, kind, p }
  let seed = 1
  const free = (kind) => spots.filter((s) => s.kind === kind && !marks.some((m) => m.spot === s))

  function spawn(kind) {
    const list = free(kind)
    if (!list.length) return null
    const spot = list[Math.floor(Math.random() * list.length)]
    const c = kind === 'graffiti' ? paintGraffiti(seed++) : paintPoster(seed++)
    const mat = new MeshStandardMaterial({ map: tex(c, { wrap: false }), transparent: true, depthWrite: false, roughness: 0.9, polygonOffset: true, polygonOffsetFactor: -2 })
    const mesh = new Mesh(new PlaneGeometry(spot.w, spot.h), mat)
    mesh.position.set(spot.x, spot.y, spot.z)
    mesh.rotation.y = spot.ry
    if (kind === 'poster') mesh.rotation.z = rnd(-0.15, 0.15)
    scene.add(mesh)
    const m = { spot, mesh, kind, p: 0 }
    marks.push(m)
    return m
  }
  for (let i = 0; i < CURB.startGraffiti; i++) spawn('graffiti')
  for (let i = 0; i < CURB.startPosters; i++) spawn('poster')
  let gT = rnd(...CURB.graffitiEvery) + (CURB.grace ?? 0)
  let pT = rnd(...CURB.posterEvery) + (CURB.grace ?? 0)

  const count = (kind) => marks.filter((m) => m.kind === kind).length
  function appeal(litter, grime) {
    const c = CURB.cost
    const v = 100 - litter * c.litter - grime * c.grime - count('graffiti') * c.graffiti - count('poster') * c.poster
    return Math.max(0, Math.min(100, Math.round(v)))
  }

  function remove(m) {
    const i = marks.indexOf(m)
    if (i < 0) return
    marks.splice(i, 1)
    const s = m.spot
    fx.sparkle(s.x, s.y, s.z + (s.ry ? -0.3 : 0.3), 18, m.kind === 'graffiti' ? '#bff4ff' : '#fff2a8')
    if (m.kind === 'poster') {
      // The torn poster crumples and drops.
      const mesh = m.mesh
      let t = 0
      const fall = () => {
        t += 1 / 60
        mesh.position.y -= t * 0.25
        mesh.rotation.z += 0.25
        mesh.scale.multiplyScalar(0.92)
        if (t < 0.5) requestAnimationFrame(fall)
        else scene.remove(mesh)
      }
      fall()
      play('rustle', s)
    } else {
      scene.remove(m.mesh)
      play('chime', s)
    }
    if (CURB.cleanBonus) bank.earn(CURB.cleanBonus, m.kind)
    hud.float({ x: s.x, y: s.y + 0.8, z: s.z }, m.kind === 'graffiti' ? '✨ graffiti gone' : '✨ poster down', '#bff4ff')
  }

  function gather(near, addC, speedMul) {
    for (const m of marks) {
      const st = m.spot.stand
      if (!near(st.x, st.z, 1.6)) continue
      const g = m.kind === 'graffiti'
      addC({
        key: m,
        x: st.x,
        z: st.z,
        r: 1.6,
        text: g ? 'SCRUB OFF THE GRAFFITI' : 'TEAR DOWN THE POSTER',
        tool: g ? 'sponge' : 'hands',
        hold: (g ? CURB.graffitiTime : CURB.posterTime) / speedMul,
        startP: m.p,
        progress: (p) => {
          m.p = p
          m.mesh.material.opacity = 1 - p * 0.8
          if (g) {
            if (Math.random() < 0.5) fx.bubbles(m.spot.x + rnd(-0.5, 0.5), m.spot.y + rnd(-0.3, 0.3), m.spot.z + (m.spot.ry ? -0.1 : 0.1), 2)
          } else m.mesh.rotation.z = Math.sin(p * 30) * 0.08 * p
        },
        run: () => remove(m),
        prio: 1,
      })
    }
  }

  function update(dt) {
    gT -= dt
    if (gT <= 0) {
      gT = rnd(...CURB.graffitiEvery)
      if (count('graffiti') < CURB.graffitiMax) spawn('graffiti')
    }
    pT -= dt
    if (pT <= 0) {
      pT = rnd(...CURB.posterEvery)
      if (count('poster') < CURB.posterMax) spawn('poster')
    }
  }

  // The nearest mark to point the player at (objective hint).
  const first = () => marks[0] ?? null

  return { appeal, gather, update, count, first, marks }
}
