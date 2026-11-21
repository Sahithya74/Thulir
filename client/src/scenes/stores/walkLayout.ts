import type { Department, ProductView } from '@thulir/shared'

/**
 * Floor plan of a walk-in store. Units are "pack units" (a typical pouch is about 0.8 wide); the shopper's eye is at
 * EYE_Y. The back wall is at z = 0 and the entrance at z = depth, so the shopper walks in towards -z.
 *
 * Products flow through shelf faces in department order. A face is one side of a gondola (a free-standing double-sided
 * shelf run) or a stretch of back wall. Small stores get just the wall; bigger ones grow aisles.
 */
export const FACE_LEN = 12
export const PER_LEVEL = 3
export const PER_FACE = PER_LEVEL * 3
/** Most products one shelf face holds (four across, three high). */
const PER_FACE_MAX = 12
/** Top row first, so the first products of a department read first. */
export const LEVEL_Y = [4.15, 2.35, 0.55]
export const EYE_Y = 3.2
export const WALL_H = 9.5
export const AISLE = 5.5
export const GONDOLA_HALF_DEPTH = 1.3
export const CAMERA_RADIUS = 0.85

export interface Slot {
  /** Local x along the face, local y is the shelf surface. */
  x: number
  y: number
  w: number
  product: ProductView
}

export interface Face {
  index: number
  kind: 'wall' | 'gondola'
  /** World position of the face origin (centre of its shelf front line at the back panel). */
  x: number
  z: number
  rotY: number
  /** First department on the face (kept for labels and "walk to department"). */
  dept: Department
  /** Every department on the face, in shelf order. */
  depts: Department[]
  /** Length of the shelf run. */
  length: number
  slots: Slot[]
}

export interface Box {
  minX: number
  maxX: number
  minZ: number
  maxZ: number
}

export interface Gondola {
  x: number
  z: number
  length: number
  /** Indices (into faces) of the two sides: facing +z and facing -z. */
  front: number
  back: number | null
}

/** Free-standing displays on the shop floor (not shelving). */
export interface Fixture {
  kind: 'produce'
  x: number
  z: number
  w: number
  d: number
}

export interface WalkPlan {
  fixtures: Fixture[]
  width: number
  depth: number
  faces: Face[]
  gondolas: Gondola[]
  /** Everything the shopper cannot walk through. */
  blocks: Box[]
  /** Horizontal walking lanes (z), used by the route finder. */
  lanesZ: number[]
  /** Vertical lanes (x) along the side walls and centre. */
  lanesX: number[]
  counters: { x: number; z: number }[]
  door: { x: number; z: number; w: number }
  spawn: { x: number; z: number; yaw: number }
  /** Where each product sits, for "walk to it". */
  where: Map<string, { face: number; slot: number }>
  deptFace: Map<Department, number>
}

const rot = (x: number, z: number, a: number) => ({ x: x * Math.cos(a) + z * Math.sin(a), z: -x * Math.sin(a) + z * Math.cos(a) })

/** World position (x, z) and outward normal of a product's slot. */
export function slotWorld(face: Face, slot: Slot) {
  const p = rot(slot.x, 0, face.rotY)
  const n = rot(0, 1, face.rotY)
  return { x: face.x + p.x, z: face.z + p.z, nx: n.x, nz: n.z, y: slot.y }
}

/**
 * A real shop shows the same lines in several places (end caps, both sides of an aisle). Repeat the range, shifted a
 * little each time so the repeated runs are not identical, until it fills a believable floor.
 */
export function padProducts(products: ProductView[], copies: number): ProductView[] {
  if (copies <= 1 || products.length === 0) return products
  const out: ProductView[] = []
  for (let k = 0; k < copies; k++) {
    const shift = (k * 3) % products.length
    out.push(...products.slice(shift), ...products.slice(0, shift))
  }
  return out
}

export function planStore(products: ProductView[], opts: { produce?: boolean } = {}): WalkPlan {
  // Whole departments share a shelf face where they fit, so a sign over an aisle is honest about what is under it.
  const byDept = new Map<Department, ProductView[]>()
  for (const p of products) byDept.set(p.department as Department, [...(byDept.get(p.department as Department) ?? []), p])
  const pieces: ProductView[][] = []
  for (const list of byDept.values()) {
    const parts = Math.ceil(list.length / PER_FACE_MAX)
    const size = Math.ceil(list.length / parts)
    for (let i = 0; i < parts; i++) pieces.push(list.slice(i * size, (i + 1) * size))
  }
  const chunks: ProductView[][] = []
  for (const piece of pieces) {
    const last = chunks[chunks.length - 1]
    if (last && last.length + piece.length <= PER_FACE_MAX) last.push(...piece)
    else chunks.push([...piece])
  }
  if (chunks.length === 0) chunks.push([])
  // Anything beyond a handful of products deserves a proper aisle, not just a wall: split until there are three faces.
  while (chunks.length < 3 && products.length >= 8) {
    let at = 0
    chunks.forEach((c, i) => {
      if (c.length > chunks[at].length) at = i
    })
    const big = chunks[at]
    if (big.length < 2) break
    const half = Math.ceil(big.length / 2)
    chunks.splice(at, 1, big.slice(0, half), big.slice(half))
  }
  const faceCount = chunks.length

  const wallFaces = faceCount === 1 ? 1 : faceCount === 2 ? 2 : faceCount % 2 === 1 ? 1 : 2
  const gondolaSides = faceCount - wallFaces
  const gondolaCount = Math.ceil(gondolaSides / 2)
  const cols = gondolaCount >= 3 ? 2 : 1
  const rows = Math.ceil(gondolaCount / cols)
  const width = faceCount === 1 ? 22 : cols === 2 ? 38 : 28

  const faces: Face[] = []
  const gondolas: Gondola[] = []
  const blocks: Box[] = []
  const lanesZ: number[] = []

  const SLOT_MAX = 4.2
  const makeFace = (list: ProductView[], index: number, kind: Face['kind'], x: number, z: number, rotY: number): Face => {
    const perLevel = Math.max(1, Math.ceil(list.length / 3))
    const w = Math.min(FACE_LEN / perLevel, SLOT_MAX)
    const slots = list.map((product, i) => {
      const level = Math.floor(i / perLevel)
      const idx = i % perLevel
      const count = Math.min(perLevel, list.length - level * perLevel)
      return { x: (idx - (count - 1) / 2) * w, y: LEVEL_Y[level] ?? LEVEL_Y[2], w, product }
    })
    const depts = [...new Set(list.map((p) => p.department as Department))]
    return { index, kind, x, z, rotY, dept: depts[0] ?? 'pantry', depts, length: Math.max(6, perLevel * w + 0.6), slots }
  }

  // back wall
  const lens = chunks.slice(0, wallFaces).map((c) => Math.max(6, Math.min(Math.ceil(c.length / 3), 4) * Math.min(FACE_LEN / Math.max(1, Math.ceil(c.length / 3)), SLOT_MAX) + 0.6))
  const total = lens.reduce((a2, b2) => a2 + b2, 0) + (wallFaces - 1) * 1.2
  let cx = -total / 2
  for (let i = 0; i < wallFaces; i++) {
    const x = cx + lens[i] / 2
    cx += lens[i] + 1.2
    faces.push(makeFace(chunks[i], faces.length, 'wall', x, 0.6, 0))
  }
  blocks.push({ minX: -width / 2, maxX: width / 2, minZ: -1, maxZ: 2.4 })

  // gondolas, in rows from the back
  const firstZ = 7.95
  const rowStep = AISLE + GONDOLA_HALF_DEPTH * 2
  const colXs = cols === 1 ? [0] : [-8.6, 8.6]
  let chunk = wallFaces
  let g = 0
  for (let r = 0; r < rows; r++) {
    const gz = firstZ + r * rowStep
    lanesZ.push(gz - GONDOLA_HALF_DEPTH - AISLE / 2)
    for (let c = 0; c < cols && g < gondolaCount; c++, g++) {
      const gx = colXs[c]
      const frontIdx = faces.length
      const front = makeFace(chunks[chunk++], frontIdx, 'gondola', gx, gz + 0.62, 0)
      faces.push(front)
      let backIdx: number | null = null
      let backLen = 0
      if (chunk < chunks.length) {
        backIdx = faces.length
        const back = makeFace(chunks[chunk++], backIdx, 'gondola', gx, gz - 0.62, Math.PI)
        faces.push(back)
        backLen = back.length
      }
      const length = Math.max(front.length, backLen)
      gondolas.push({ x: gx, z: gz, length: length + 0.4, front: frontIdx, back: backIdx })
      blocks.push({ minX: gx - length / 2 - 0.4, maxX: gx + length / 2 + 0.4, minZ: gz - GONDOLA_HALF_DEPTH, maxZ: gz + GONDOLA_HALF_DEPTH })
    }
  }
  const lastGz = rows > 0 ? firstZ + (rows - 1) * rowStep : 1.2
  const frontShelf = lastGz + GONDOLA_HALF_DEPTH
  lanesZ.push(frontShelf + AISLE / 2)

  // checkout zone and entrance
  const roomy = !!opts.produce && products.length >= 10
  const depth = Math.max(frontShelf + AISLE + (roomy ? 12.5 : 7.5), 16.5)
  // open produce tables between the aisles and the tills, where a real shop puts its freshest stock
  const fixtures: Fixture[] = roomy ? [-1, 1].map((s2) => ({ kind: 'produce' as const, x: s2 * width * 0.22, z: frontShelf + AISLE + 2.4, w: 6.2, d: 2.8 })) : []
  for (const f of fixtures) blocks.push({ minX: f.x - f.w / 2 - 0.3, maxX: f.x + f.w / 2 + 0.3, minZ: f.z - f.d / 2 - 0.3, maxZ: f.z + f.d / 2 + 0.3 })
  const counters = [{ x: -width / 2 + 6.5, z: depth - 4.2 }, { x: width / 2 - 6.5, z: depth - 4.2 }]
  for (const c of counters) blocks.push({ minX: c.x - 2.9, maxX: c.x + 2.9, minZ: c.z - 1.1, maxZ: c.z + 1.1 })
  const lanesX = cols === 2 ? [-width / 2 + 2.3, 0, width / 2 - 2.3] : [-width / 2 + 2.3, width / 2 - 2.3]

  const where = new Map<string, { face: number; slot: number }>()
  const deptFace = new Map<Department, number>()
  for (const f of faces) {
    f.slots.forEach((s, i) => {
      if (!where.has(s.product.id)) where.set(s.product.id, { face: f.index, slot: i })
      if (!deptFace.has(s.product.department as Department)) deptFace.set(s.product.department as Department, f.index)
    })
  }

  return {
    fixtures,
    width,
    depth,
    faces,
    gondolas,
    blocks,
    lanesZ,
    lanesX,
    counters,
    door: { x: 0, z: depth, w: 6.4 },
    spawn: { x: 0, z: depth - 3.2, yaw: 0 },
    where,
    deptFace,
  }
}

/** Pose that frames a product (or a whole face) from across the aisle. */
export function standFor(plan: WalkPlan, id: string) {
  const at = plan.where.get(id)
  if (!at) return null
  const face = plan.faces[at.face]
  const slot = face.slots[at.slot]
  const w = slotWorld(face, slot)
  const dist = face.kind === 'wall' ? 4.6 : 3.7
  const x = clamp(w.x + w.nx * dist, -plan.width / 2 + 1.6, plan.width / 2 - 1.6)
  const z = w.z + w.nz * dist
  const dx = w.x - x
  const dz = w.z - z
  const flat = Math.hypot(dx, dz)
  return { x, z, yaw: Math.atan2(-dx, -dz), pitch: Math.atan2(EYE_Y - (w.y + 0.8), Math.max(flat, 0.5)) * -1 }
}

export function standForFace(plan: WalkPlan, faceIndex: number) {
  const f = plan.faces[faceIndex]
  const dist = f.kind === 'wall' ? 7 : 4.4
  const n = rot(0, 1, f.rotY)
  const x = clamp(f.x + n.x * dist, -plan.width / 2 + 1.6, plan.width / 2 - 1.6)
  const z = f.z + n.z * dist
  return { x, z, yaw: Math.atan2(-(f.x - x), -(f.z - z)), pitch: -0.12 }
}

export const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v))

/** Push a circle out of every block and back inside the room. */
export function resolve(plan: WalkPlan, x: number, z: number, r = CAMERA_RADIUS) {
  let px = clamp(x, -plan.width / 2 + 1.1, plan.width / 2 - 1.1)
  let pz = clamp(z, 3.7, plan.depth - 1.2)
  for (const b of plan.blocks) {
    const cx = clamp(px, b.minX, b.maxX)
    const cz = clamp(pz, b.minZ, b.maxZ)
    const dx = px - cx
    const dz = pz - cz
    const d2 = dx * dx + dz * dz
    if (d2 >= r * r) continue
    if (d2 > 1e-6) {
      const d = Math.sqrt(d2)
      px = cx + (dx / d) * r
      pz = cz + (dz / d) * r
    } else {
      // centre is inside the block: leave by the nearest side
      const left = px - b.minX
      const right = b.maxX - px
      const up = pz - b.minZ
      const down = b.maxZ - pz
      const m = Math.min(left, right, up, down)
      if (m === left) px = b.minX - r
      else if (m === right) px = b.maxX + r
      else if (m === up) pz = b.minZ - r
      else pz = b.maxZ + r
    }
  }
  return { x: px, z: pz }
}

function segmentClear(plan: WalkPlan, ax: number, az: number, bx: number, bz: number) {
  const steps = Math.max(2, Math.ceil(Math.hypot(bx - ax, bz - az) / 0.6))
  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    const x = ax + (bx - ax) * t
    const z = az + (bz - az) * t
    const p = resolve(plan, x, z, CAMERA_RADIUS * 0.92)
    if (Math.abs(p.x - x) > 0.05 || Math.abs(p.z - z) > 0.05) return false
  }
  return true
}

/** Waypoints from a to b that stay in the aisles: straight if clear, otherwise via a side or centre lane. */
export function route(plan: WalkPlan, a: { x: number; z: number }, b: { x: number; z: number }) {
  const goal = resolve(plan, b.x, b.z)
  if (segmentClear(plan, a.x, a.z, goal.x, goal.z)) return [goal]
  let best: { x: number; z: number }[] | null = null
  let bestLen = Infinity
  for (const lx of plan.lanesX) {
    const pts = [{ x: lx, z: a.z }, { x: lx, z: goal.z }, goal]
    let ok = segmentClear(plan, a.x, a.z, pts[0].x, pts[0].z)
    for (let i = 0; ok && i < pts.length - 1; i++) ok = segmentClear(plan, pts[i].x, pts[i].z, pts[i + 1].x, pts[i + 1].z)
    if (!ok) continue
    const len = Math.abs(a.x - lx) + Math.abs(a.z - goal.z) + Math.abs(goal.x - lx)
    if (len < bestLen) {
      bestLen = len
      best = pts
    }
  }
  // last resort: step into the nearest lane first, then straight (the collision pass will slide round corners)
  return best ?? [goal]
}

export function nearestFace(plan: WalkPlan, x: number, z: number, yaw: number): Face | null {
  // the face the shopper is looking at: the closest one in the forward half-plane
  const fx = -Math.sin(yaw)
  const fz = -Math.cos(yaw)
  let best: Face | null = null
  let bestScore = Infinity
  for (const f of plan.faces) {
    const dx = f.x - x
    const dz = f.z - z
    const d = Math.hypot(dx, dz)
    const facing = (dx * fx + dz * fz) / Math.max(d, 0.001)
    if (d > 22 || facing < 0.2) continue
    const score = d - facing * 6
    if (score < bestScore) {
      bestScore = score
      best = f
    }
  }
  return best
}
