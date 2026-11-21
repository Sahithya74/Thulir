import type { Department, ProductView } from '@thulir/shared'

/**
 * Floor plan of a walk-in store. Units are "pack units" (a typical pouch is about 0.8 wide); the shopper's eye is at
 * EYE_Y. The back wall is at z = 0 and the entrance at z = depth, so the shopper walks in towards -z.
 *
 * Products flow through shelf faces in department order. A face is one side of a gondola (a free-standing double-sided
 * shelf run) or a stretch of back wall. Small stores get just the wall; bigger ones grow aisles.
 */
export const FACE_LEN = 11
export const PER_LEVEL = 3
export const PER_FACE = PER_LEVEL * 3
/** Most products one shelf face holds (four across, three high). */
const PER_FACE_MAX = 20
/** Top row first, so the first products of a department read first. */
export const LEVEL_Y = [5.95, 4.15, 2.35, 0.55]
export const EYE_Y = 3.2
export const WALL_H = 12
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

/** A stack of goods standing against a wall between two shelf bays (sacks, cartons or crates). */
export interface Stack {
  kind: 'sacks' | 'cartons' | 'crates'
  x: number
  z: number
  rotY: number
  w: number
}

export interface WalkPlan {
  stacks: Stack[]
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

const SLOT_MAX = 4.2

export function planStore(products: ProductView[], opts: { produce?: boolean } = {}): WalkPlan {
  // Whole departments share a shelf bay where they fit, so a sign over a bay is honest about what is under it.
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
  // A shop is more than a wall: split until there are enough bays to line both sides.
  while (chunks.length < 4 && products.length >= 12) {
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

  const width = 34
  const backCount = faceCount <= 3 ? 1 : faceCount <= 6 ? 2 : 3
  const sideCount = faceCount - backCount
  const leftN = Math.ceil(sideCount / 2)
  const rightN = sideCount - leftN

  const faces: Face[] = []
  const blocks: Box[] = []
  const stacks: Stack[] = []

  const makeFace = (list: ProductView[], index: number, x: number, z: number, rotY: number): Face => {
    const levels = LEVEL_Y.length
    const perLevel = Math.max(1, Math.ceil(list.length / levels))
    const w = Math.min(FACE_LEN / perLevel, SLOT_MAX)
    const slots = list.map((product, i) => {
      const level = Math.floor(i / perLevel)
      const idx = i % perLevel
      const count = Math.min(perLevel, list.length - level * perLevel)
      return { x: (idx - (count - 1) / 2) * w, y: LEVEL_Y[level] ?? LEVEL_Y[levels - 1], w, product }
    })
    const depts = [...new Set(list.map((p) => p.department as Department))]
    return { index, kind: 'wall', x, z, rotY, dept: depts[0] ?? 'pantry', depts, length: Math.max(6, perLevel * w + 0.6), slots }
  }

  // back wall, centred
  const lens = chunks.slice(0, backCount).map((c) => Math.max(6, Math.ceil(c.length / LEVEL_Y.length) * Math.min(FACE_LEN / Math.max(1, Math.ceil(c.length / LEVEL_Y.length)), SLOT_MAX) + 0.6))
  const total = lens.reduce((a2, b2) => a2 + b2, 0) + (backCount - 1) * 1.2
  let cx = -total / 2
  for (let i = 0; i < backCount; i++) {
    const x = cx + lens[i] / 2
    cx += lens[i] + 1.2
    faces.push(makeFace(chunks[i], faces.length, x, 0.6, 0))
  }
  blocks.push({ minX: -width / 2, maxX: width / 2, minZ: -1, maxZ: 2.4 })

  // both side walls, bay after bay; a stack of goods stands in the gap after every second bay
  const sideX = width / 2 - 0.6
  const STACKS: Stack['kind'][] = opts.produce ? ['crates', 'sacks', 'cartons'] : ['sacks', 'cartons', 'crates']
  let chunk = backCount
  let stackNo = 0
  const lay = (n: number, side: -1 | 1) => {
    let z = 4.4
    for (let k = 0; k < n; k++) {
      const probe = chunks[chunk]
      const len = Math.max(6, Math.ceil(probe.length / LEVEL_Y.length) * Math.min(FACE_LEN / Math.max(1, Math.ceil(probe.length / LEVEL_Y.length)), SLOT_MAX) + 0.6)
      const f = makeFace(chunks[chunk++], faces.length, side * sideX, z + len / 2, side < 0 ? Math.PI / 2 : -Math.PI / 2)
      faces.push(f)
      blocks.push({ minX: side * sideX - 1.5, maxX: side * sideX + 1.5, minZ: z - 0.1, maxZ: z + len + 0.1 })
      z += len + 0.2
      if (k % 2 === 1 || k === n - 1) {
        stacks.push({ kind: STACKS[stackNo++ % STACKS.length], x: side * (width / 2 - 1.1), z: z + 1.5, rotY: f.rotY, w: 3 })
        blocks.push({ minX: side * (width / 2 - 1.1) - 1.4, maxX: side * (width / 2 - 1.1) + 1.4, minZ: z + 0.1, maxZ: z + 2.9 })
        z += 3.2
      }
    }
    return z
  }
  const leftEnd = lay(leftN, -1)
  const rightEnd = lay(rightN, 1)

  // checkout zone and entrance
  const depth = Math.max(Math.max(leftEnd, rightEnd) + 11, 34)
  const counters = [{ x: -width / 2 + 7.5, z: depth - 4.6 }, { x: width / 2 - 7.5, z: depth - 4.6 }]
  for (const c of counters) blocks.push({ minX: c.x - 2.9, maxX: c.x + 2.9, minZ: c.z - 1.1, maxZ: c.z + 1.1 })
  const lanesX = [-width / 2 + 3.5, 0, width / 2 - 3.5]

  const where = new Map<string, { face: number; slot: number }>()
  const deptFace = new Map<Department, number>()
  for (const f of faces) {
    f.slots.forEach((s, i) => {
      if (!where.has(s.product.id)) where.set(s.product.id, { face: f.index, slot: i })
      if (!deptFace.has(s.product.department as Department)) deptFace.set(s.product.department as Department, f.index)
    })
  }

  return {
    stacks,
    width,
    depth,
    faces,
    gondolas: [],
    blocks,
    lanesZ: [depth - 9],
    lanesX,
    counters,
    door: { x: 0, z: depth, w: 7.2 },
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
  const dist = 5.2
  const x = clamp(w.x + w.nx * dist, -plan.width / 2 + 1.6, plan.width / 2 - 1.6)
  const z = w.z + w.nz * dist
  const dx = w.x - x
  const dz = w.z - z
  const flat = Math.hypot(dx, dz)
  return { x, z, yaw: Math.atan2(-dx, -dz), pitch: Math.atan2(EYE_Y - (w.y + 0.8), Math.max(flat, 0.5)) * -1 }
}

export function standForFace(plan: WalkPlan, faceIndex: number) {
  const f = plan.faces[faceIndex]
  const dist = 7.5
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
