// Geometry of the office. All coordinates are "art pixels" inside the building
// (origin top-left). Characters are positioned by their FEET.

export type RoomId = 'library' | 'workshop' | 'architect' | 'review' | 'scout' | 'lounge'

export interface Pt { x: number; y: number }
export interface Rect { x: number; y: number; w: number; h: number }

export interface Seat {
  id: string
  x: number
  y: number
  /** waypoints from the entry's inside node to the seat (excluded) */
  via: Pt[]
  entry: number
  /** lounge seats are sat in front-facing */
  kind: 'desk' | 'sofa' | 'chair' | 'bean'
}

export interface Entry {
  inn: Pt
  out: Pt
  /** door opening on the wall (for drawing) */
  door: { x: number; y: number; orient: 'h' | 'v' }
}

export interface RoomDef {
  id: RoomId
  label: string
  icon: string
  rect: Rect
  entries: Entry[]
  seats: Seat[]
}

export const BUILDING = { w: 480, h: 360 }
/** the world is the building plus a strip of garden around it */
export const WORLD = { w: 544, h: 392, ox: 32, oy: 8 }

export const WALL_BAND = 16 // height of the visible back wall inside a room

const desk = (room: string, i: number, x: number, y: number, entry: number, aisle: number): Seat => ({
  id: `${room}:${i}`, x, y, entry, kind: 'desk', via: [{ x: aisle, y }],
})

const topRoom = (
  id: RoomId, label: string, icon: string, rect: Rect, cols: [number, number],
): RoomDef => {
  const cx = rect.x + rect.w / 2
  const doorX = Math.round(cx)
  return {
    id, label, icon, rect,
    entries: [{
      inn: { x: doorX, y: rect.y + rect.h - 10 },
      out: { x: doorX, y: 134 },
      door: { x: doorX, y: rect.y + rect.h, orient: 'h' },
    }],
    seats: [
      desk(id, 0, cols[0], 50, 0, doorX),
      desk(id, 1, cols[1], 50, 0, doorX),
      desk(id, 2, cols[0], 102, 0, doorX),
      desk(id, 3, cols[1], 102, 0, doorX),
    ],
  }
}

const library = topRoom('library', 'Library', '📚', { x: 6, y: 4, w: 148, h: 124 }, [40, 120])
const architect = topRoom('architect', "Architect's Office", '📐', { x: 154, y: 4, w: 166, h: 124 }, [190, 284])
const review = topRoom('review', 'Review Room', '🔍', { x: 320, y: 4, w: 154, h: 124 }, [358, 436])

const scout: RoomDef = {
  id: 'scout', label: 'Scout Corner', icon: '🧭',
  rect: { x: 6, y: 140, w: 120, h: 96 },
  entries: [{ inn: { x: 116, y: 214 }, out: { x: 134, y: 214 }, door: { x: 126, y: 214, orient: 'v' } }],
  seats: [24, 52, 80, 108].map((x, i): Seat => ({
    id: `scout:${i}`, x, y: 186, entry: 0, kind: 'desk', via: [{ x, y: 206 }],
  })),
}

const wsEntries: Entry[] = [86, 166].map((x) => ({
  inn: { x, y: 264 }, out: { x, y: 242 }, door: { x, y: 248, orient: 'h' as const },
}))
const wsCols = [46, 126, 206]
const workshop: RoomDef = {
  id: 'workshop', label: 'Workshop', icon: '🛠️',
  rect: { x: 6, y: 248, w: 240, h: 108 },
  entries: wsEntries,
  seats: [294, 346].flatMap((y, r) =>
    wsCols.map((x, c): Seat => {
      const entry = r === 0 ? (c === 2 ? 1 : 0) : (c === 0 ? 0 : 1)
      return desk('workshop', r * 3 + c, x, y, entry, wsEntries[entry].inn.x)
    }),
  ),
}

const lounge: RoomDef = {
  id: 'lounge', label: 'Lounge', icon: '☕',
  rect: { x: 354, y: 140, w: 120, h: 96 },
  entries: [{ inn: { x: 364, y: 214 }, out: { x: 346, y: 214 }, door: { x: 354, y: 214, orient: 'v' } }],
  seats: [
    { id: 'lounge:0', x: 377, y: 186, entry: 0, kind: 'sofa', via: [{ x: 377, y: 208 }] },
    { id: 'lounge:1', x: 399, y: 186, entry: 0, kind: 'sofa', via: [{ x: 399, y: 208 }] },
    { id: 'lounge:2', x: 421, y: 186, entry: 0, kind: 'sofa', via: [{ x: 421, y: 208 }] },
    { id: 'lounge:3', x: 452, y: 200, entry: 0, kind: 'chair', via: [{ x: 440, y: 214 }] },
    { id: 'lounge:4', x: 384, y: 224, entry: 0, kind: 'bean', via: [] },
    { id: 'lounge:5', x: 410, y: 226, entry: 0, kind: 'bean', via: [] },
  ],
}
/** overflow when every lounge seat is taken */
export const LOUNGE_STAND: Pt[] = [
  { x: 440, y: 176 }, { x: 456, y: 180 }, { x: 430, y: 214 }, { x: 462, y: 222 }, { x: 392, y: 208 },
]

export const ROOMS: Record<RoomId, RoomDef> = { library, workshop, architect, review, scout, lounge }
export const ROOM_LIST: RoomDef[] = [library, workshop, architect, review, scout, lounge]

export const MANAGER = {
  desk: { x: 196, y: 150, w: 88, h: 26 },
  feet: { x: 240, y: 190 },
}

// ---------------------------------------------------------------- agents

export const AGENT_ROOM: Record<string, RoomId> = {
  'agy-flash': 'library', 'agy-pro': 'review',
  sonnet: 'workshop', 'agy-sonnet': 'workshop',
  opus: 'architect', 'agy-opus': 'architect',
  haiku: 'scout',
}
export const roomFor = (agent: string): RoomId => AGENT_ROOM[agent] ?? 'scout'

export type Provider = 'claude' | 'agy' | 'other' | 'manager'
export const providerOf = (agent: string): Provider => {
  if (agent.startsWith('agy')) return 'agy'
  if (agent === 'sonnet' || agent === 'opus' || agent === 'haiku') return 'claude'
  return 'other'
}

export interface Outfit { main: string; shade: string; accent: string; pants: string; shoes: string }
export const OUTFITS: Record<Provider, Outfit> = {
  claude:   { main: '#d2693c', shade: '#a64a27', accent: '#f4c9a0', pants: '#5a3b2e', shoes: '#2e1d16' },
  agy:      { main: '#4a86d8', shade: '#2f5fa8', accent: '#bcd7f7', pants: '#33415c', shoes: '#1d2536' },
  other:    { main: '#8a8f98', shade: '#646a73', accent: '#d5d9df', pants: '#444a52', shoes: '#22252a' },
  manager:  { main: '#2f3b52', shade: '#1e2738', accent: '#e8c15a', pants: '#252d3d', shoes: '#12161f' },
}

export const SKINS = ['#f6d3b3', '#e8b48a', '#c98f65', '#a56b44', '#6f4529']
export const HAIRS = ['#2a1b14', '#5a3720', '#8e4a22', '#d8a944', '#a8a8b8', '#c75a7a', '#3b5a8a']

export const hashStr = (s: string): number => {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) }
  return h >>> 0
}

export const tagFor = (agent: string, account?: string | null): string => {
  if (agent.startsWith('agy-')) {
    const model = agent.slice(4)
    return account && account.startsWith('agy') ? `${account} · ${model}` : `agy · ${model}`
  }
  return agent
}

// ---------------------------------------------------------------- walk graph

export const NODES: Record<string, Pt> = {
  out: { x: 360, y: 382 },
  ent: { x: 360, y: 348 },
  lobby: { x: 360, y: 262 },
  mid: { x: 300, y: 242 },
  he: { x: 302, y: 200 },
  hw: { x: 178, y: 200 },
  c2: { x: 178, y: 134 },
  c4: { x: 302, y: 134 },
}
const EDGES: [string, string][] = [
  ['out', 'ent'], ['ent', 'lobby'], ['lobby', 'mid'], ['mid', 'he'],
  ['mid', 'workshop:out1'], ['workshop:out1', 'workshop:out0'], ['workshop:out1', 'hw'],
  ['hw', 'scout:out0'], ['hw', 'c2'], ['he', 'c4'], ['he', 'lounge:out0'],
  ['library:out0', 'c2'], ['c2', 'architect:out0'], ['architect:out0', 'c4'], ['c4', 'review:out0'],
]
for (const r of ROOM_LIST) r.entries.forEach((e, i) => { NODES[`${r.id}:out${i}`] = e.out })

/** queue spots by each room's door (up to 5 waiting) */
export const QUEUE_DIR: Record<RoomId, Pt> = {
  library: { x: -18, y: 0 }, architect: { x: -18, y: 0 }, review: { x: 18, y: 0 },
  workshop: { x: -20, y: 0 }, scout: { x: 14, y: 0 }, lounge: { x: -14, y: 0 },
}
export const QUEUE_SIZE = 5
for (const r of ROOM_LIST) {
  const base = r.entries[0].out
  const d = QUEUE_DIR[r.id]
  for (let i = 0; i < QUEUE_SIZE; i++) {
    const q = `q:${r.id}:${i}`
    // scout queue hangs below its door, in the hall; others along the corridor
    NODES[q] = r.id === 'scout'
      ? { x: base.x + 8 + (i % 2) * 8, y: Math.min(232, base.y + 8 + i * 5) }
      : { x: base.x + d.x * (i + 1), y: base.y + (i % 2 ? 3 : -2) }
    EDGES.push([i === 0 ? `${r.id}:out0` : `q:${r.id}:${i - 1}`, q])
  }
}

const ADJ: Record<string, string[]> = {}
for (const [a, b] of EDGES) { (ADJ[a] ??= []).push(b); (ADJ[b] ??= []).push(a) }
const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y)

/** shortest node-name path (inclusive) */
export function route(from: string, to: string): string[] {
  if (from === to) return [from]
  const d: Record<string, number> = { [from]: 0 }
  const prev: Record<string, string> = {}
  const todo = new Set<string>([from])
  while (todo.size) {
    let cur = ''
    let best = Infinity
    for (const n of todo) if (d[n] < best) { best = d[n]; cur = n }
    todo.delete(cur)
    if (cur === to) break
    for (const nb of ADJ[cur] ?? []) {
      const nd = d[cur] + dist(NODES[cur], NODES[nb])
      if (nd < (d[nb] ?? Infinity)) { d[nb] = nd; prev[nb] = cur; todo.add(nb) }
    }
  }
  const out: string[] = [to]
  while (out[0] !== from) {
    const p = prev[out[0]]
    if (!p) return [from, to]
    out.unshift(p)
  }
  return out
}

export const nodePts = (names: string[]): Pt[] => names.map((n) => NODES[n])
