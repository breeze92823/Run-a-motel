// Card pictures for the FURNISH panel: each furniture model is rendered once, off screen,
// in a 3/4 view on a transparent background and kept as a data URL. A small renderer of
// its own does the work a few models per idle slice, then is thrown away.
import { ACESFilmicToneMapping, AmbientLight, Box3, DirectionalLight, HemisphereLight, PerspectiveCamera, Scene, Sphere, SRGBColorSpace, Vector3, WebGLRenderer } from 'three'
import { makeItem } from './models.js'

const SIZE = 192
const urls = new Map() // id -> data URL
const waiting = new Map() // id -> Set(callback)
const queue = []
let renderer = null
let scene = null
let camera = null
let running = false

function setup() {
  if (renderer) return true
  try {
    renderer = new WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true })
  } catch {
    return false
  }
  renderer.setSize(SIZE, SIZE, false)
  renderer.setPixelRatio(1)
  renderer.outputColorSpace = SRGBColorSpace
  renderer.toneMapping = ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.15
  renderer.setClearColor(0x000000, 0)
  scene = new Scene()
  scene.add(new HemisphereLight('#fff6e6', '#8a6a4a', 1.6))
  scene.add(new AmbientLight('#ffffff', 0.35))
  const key = new DirectionalLight('#ffffff', 2.2)
  key.position.set(3, 5, 4)
  scene.add(key)
  const rim = new DirectionalLight('#bfe6ff', 0.8)
  rim.position.set(-4, 3, -3)
  scene.add(rim)
  camera = new PerspectiveCamera(28, 1, 0.05, 50)
  return true
}

const box = new Box3()
const sphere = new Sphere()
const dir = new Vector3(0.62, 0.42, 1).normalize()
function render(id) {
  const obj = makeItem(id)
  scene.add(obj)
  obj.updateMatrixWorld(true)
  box.setFromObject(obj)
  box.getBoundingSphere(sphere)
  const flat = box.max.y - box.min.y < 0.1 // rugs: look down on them
  const d = (sphere.radius / Math.sin((camera.fov * Math.PI) / 360)) * 1.02
  const v = flat ? new Vector3(0.2, 1.4, 1).normalize() : dir
  camera.position.copy(sphere.center).addScaledVector(v, d)
  camera.lookAt(sphere.center)
  renderer.render(scene, camera)
  const url = renderer.domElement.toDataURL('image/png')
  scene.remove(obj)
  obj.traverse((m) => m.geometry?.dispose?.())
  return url
}

function pump() {
  if (!queue.length) {
    running = false
    // Free the GL context once every picture is made.
    renderer?.dispose()
    renderer?.forceContextLoss?.()
    renderer = null
    return
  }
  const start = performance.now()
  while (queue.length && performance.now() - start < 12) {
    const id = queue.shift()
    if (urls.has(id)) continue
    let url = ''
    try {
      url = render(id)
    } catch (err) {
      console.warn('[thumbs]', id, err)
    }
    urls.set(id, url)
    for (const cb of waiting.get(id) ?? []) cb(url)
    waiting.delete(id)
  }
  // A plain timer: idle callbacks never come while the game renders every frame.
  setTimeout(pump, 30)
}

// The picture for an item: returns it now if made, else calls back when it is.
export function thumb(id, cb) {
  if (urls.has(id)) return urls.get(id)
  if (cb) {
    if (!waiting.has(id)) waiting.set(id, new Set())
    waiting.get(id).add(cb)
  }
  if (!queue.includes(id)) queue.push(id)
  if (!running && setup()) {
    running = true
    pump()
  }
  return null
}
// Starts making pictures ahead of time (the furnish panel's first open).
export function warmThumbs(ids) {
  for (const id of ids) if (!urls.has(id) && !queue.includes(id)) queue.push(id)
  if (!running && queue.length && setup()) {
    running = true
    pump()
  }
}
