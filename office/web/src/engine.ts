import { motionValue, type MotionValue } from 'motion/react'
import type { Session, Task } from './types'
import {
  HAIRS, LOUNGE_STAND, NODES, OUTFITS, QUEUE_SIZE, ROOMS, SKINS, hashStr, nodePts, providerOf, roomFor, route, tagFor,
  type Pt, type RoomId, type Seat,
} from './layout'
import type { Look, Pose } from './sprites/characters'

export type Phase =
  | 'toManager' | 'receiving' | 'toSeat' | 'toQueue' | 'queued' | 'working'
  | 'celebrate' | 'failedSeat' | 'toLounge' | 'lounging' | 'toManagerFail' | 'failedAtManager' | 'leaving'

export type BubbleKind = 'task' | 'receive' | 'done' | 'fail' | 'coffee' | null

export interface Walk { id: number; pts: Pt[]; instant: boolean }

export interface Actor {
  id: string
  task: Task
  room: RoomId
  look: Look
  tag: string
  mv: { x: MotionValue<number>; y: MotionValue<number> }
  pose: Pose
  phase: Phase
  bubble: BubbleKind
  walk: Walk | null
  seat: Seat | null
  at: string | null
  dest: string | null
  exiting: boolean
  fadeIn: boolean
  queuedAt: number
}

const RECENT_SECS = 120
const RECEIVE_MS = 1400
const DONE_MS = 6000
const FAIL_MS = 2800
const FAIL_DESK_MS = 3500
const LOUNGE_MS = 20000
const FADE_MS = 650

const isFinished = (t: Task) => t.status === 'done' || t.status === 'failed'

/** Create a virtual Task from a Session so actors can use it. */
function sessionTask(s: Session): Task {
  return {
    id: `s:${s.id}`, title: s.title, agent: 'session', account: s.account,
    status: s.status === 'working' ? 'running' : 'done',
    created: s.updated - 300, updated: s.updated, finished: null,
    result: null, repo: s.project, t3_task: null,
  }
}

export class OfficeEngine {
  private actors = new Map<string, Actor>()
  private seatOwner = new Map<string, string>()
  private skipped = new Set<string>()
  private pending = new Set<string>()
  private tasks = new Map<string, Task>()
  private listeners = new Set<() => void>()
  private snap: Actor[] = []
  private timers = new Set<number>()
  private walkCounter = 0
  private firstSync = true
  private emitQueued = false
  private sessionIds = new Set<string>()
  reduced = false

  // ------------------------------------------------------------ store api
  subscribe = (fn: () => void) => { this.listeners.add(fn); return () => { this.listeners.delete(fn) } }
  getSnapshot = () => this.snap

  private emit() {
    if (this.emitQueued) return
    this.emitQueued = true
    queueMicrotask(() => {
      this.emitQueued = false
      this.snap = Array.from(this.actors.values())
      this.listeners.forEach((l) => l())
    })
  }

  private get(id: string) { return this.actors.get(id) }
  private patch(id: string, p: Partial<Actor>): Actor | undefined {
    const a = this.actors.get(id)
    if (!a) return undefined
    const n = { ...a, ...p }
    this.actors.set(id, n)
    this.emit()
    return n
  }

  /** run fn later, but only if the actor is still in the same phase */
  private after(id: string, ms: number, phase: Phase, fn: (a: Actor) => void) {
    const t = window.setTimeout(() => {
      this.timers.delete(t)
      const a = this.get(id)
      if (a && a.phase === phase) fn(a)
    }, ms)
    this.timers.add(t)
  }

  dispose() { this.timers.forEach((t) => clearTimeout(t)); this.timers.clear() }

  // ------------------------------------------------------------ sync
  sync(tasks: Task[], now: number) {
    this.tasks = new Map(tasks.map((t) => [t.id, t]))
    let n = 0
    for (const t of tasks) {
      const a = this.get(t.id)
      if (a) {
        if (a.task !== t && JSON.stringify(a.task) !== JSON.stringify(t)) this.onTask(a, t)
        continue
      }
      if (this.skipped.has(t.id) || this.pending.has(t.id)) continue
      const done = isFinished(t)
      const age = now - (t.finished ?? t.updated ?? t.created)
      if (done && age > RECENT_SECS) { this.skipped.add(t.id); continue }
      const delay = this.firstSync ? Math.min(n++, 8) * 800 : 0
      this.spawn(t, delay, this.firstSync && done)
    }
    for (const a of this.actors.values()) {
      if (a.id.startsWith('s:')) continue
      if (!this.tasks.has(a.id) && a.phase !== 'leaving') this.leave(a)
    }
    this.firstSync = false
  }

  /** Sync sessions as actors. Manager sessions are skipped (the Manager character handles them). */
  syncSessions(sessions: Session[], _now: number) {
    const alive = new Set<string>()
    for (const s of sessions) {
      if (s.manager) continue  // manager session uses the existing Manager character
      const actorId = `s:${s.id}`
      alive.add(actorId)
      const a = this.get(actorId)
      if (a) {
        // status change: working → idle means move to lounge; idle → working means go to chat seat
        const wasWorking = a.task.status === 'running'
        const isWorking = s.status === 'working'
        const vt = sessionTask(s)
        this.patch(actorId, { task: vt })
        if (wasWorking && !isWorking && a.phase === 'working') {
          this.goLounge(a)
        } else if (!wasWorking && isWorking && (a.phase === 'lounging' || a.phase === 'toLounge')) {
          // re-assign to a chat seat
          const cur = this.get(actorId) ?? a
          this.patch(actorId, { room: 'chat' })
          this.assign(this.get(actorId) ?? cur)
        }
        continue
      }
      if (this.skipped.has(actorId) || this.pending.has(actorId)) continue
      this.spawnSession(s, this.firstSync ? 0 : 0)
    }
    // remove sessions that disappeared
    for (const id of this.sessionIds) {
      if (!alive.has(id)) {
        const a = this.get(id)
        if (a && a.phase !== 'leaving') this.leave(a)
      }
    }
    this.sessionIds = alive
  }

  private spawnSession(s: Session, delay: number) {
    const actorId = `s:${s.id}`
    this.pending.add(actorId)
    const go = () => {
      this.pending.delete(actorId)
      if (this.actors.has(actorId)) return
      const h = hashStr(actorId)
      const look: Look = {
        skin: SKINS[h % SKINS.length],
        hair: HAIRS[(h >>> 3) % HAIRS.length],
        style: (h >>> 7) % 3,
        glasses: (h >>> 10) % 5 === 0,
        outfit: OUTFITS.session,
      }
      const isWorking = s.status === 'working'
      const room: RoomId = isWorking ? 'chat' : 'lounge'
      const vt = sessionTask(s)
      // tasks map needs the virtual task for actor lookups
      this.tasks.set(actorId, vt)

      const start = NODES.out
      const actor: Actor = {
        id: actorId, task: vt, room, look, tag: `💬 ${s.project}`,
        mv: { x: motionValue(start.x), y: motionValue(start.y) },
        pose: 'stand', phase: 'toSeat', bubble: null, walk: null, seat: null,
        at: 'out', dest: null, exiting: false, fadeIn: !this.reduced, queuedAt: 0,
      }
      this.actors.set(actorId, actor)
      this.emit()
      if (isWorking) {
        // walk directly to a chat seat (skip the manager receiving animation)
        this.assign(actor)
      } else {
        this.goLounge(actor)
      }
    }
    if (delay > 0) this.timers.add(window.setTimeout(go, delay))
    else go()
  }

  private onTask(a: Actor, t: Task) {
    const n = this.patch(a.id, { task: t })
    if (!n) return
    if (isFinished(t) && (n.phase === 'working' || n.phase === 'queued')) this.finish(n)
  }

  // ------------------------------------------------------------ spawn
  private spawn(t: Task, delay: number, seated: boolean) {
    this.pending.add(t.id)
    const go = () => {
      this.pending.delete(t.id)
      const task = this.tasks.get(t.id)
      if (!task || this.actors.has(t.id)) return
      const h = hashStr(t.id)
      const provider = providerOf(task.agent)
      const look: Look = {
        skin: SKINS[h % SKINS.length],
        hair: HAIRS[(h >>> 3) % HAIRS.length],
        style: (h >>> 7) % 3,
        glasses: (h >>> 10) % 5 === 0,
        outfit: OUTFITS[provider],
      }
      const room = roomFor(task.agent)
      const busyHe = Array.from(this.actors.values()).some((o) => o.dest === 'he' && (o.phase === 'toManager' || o.phase === 'receiving'))
      const spot = busyHe ? 'hw' : 'he'
      const start = seated ? NODES[spot] : NODES.out
      const actor: Actor = {
        id: t.id, task, room, look, tag: tagFor(task.agent, task.account),
        mv: { x: motionValue(start.x), y: motionValue(start.y) },
        pose: 'stand', phase: 'toManager', bubble: null, walk: null, seat: null,
        at: seated ? spot : 'out', dest: null, exiting: false, fadeIn: !seated && !this.reduced, queuedAt: 0,
      }
      this.actors.set(t.id, actor)
      this.emit()
      if (seated) {
        this.patch(t.id, { phase: 'receiving' })
        this.afterReceive(this.get(t.id)!, true)
      } else {
        this.walkNodes(actor, spot, 'toManager')
      }
    }
    if (delay > 0) this.timers.add(window.setTimeout(go, delay))
    else go()
  }

  // ------------------------------------------------------------ walking
  private startWalk(a: Actor, pts: Pt[], phase: Phase, dest: string | null, extra: Partial<Actor> = {}) {
    if (pts.length === 0) {
      this.patch(a.id, { phase, dest, walk: null, at: dest ?? a.at, ...extra })
      const n = this.get(a.id)
      if (n) this.step(n)
      return
    }
    this.patch(a.id, { phase, dest, walk: { id: ++this.walkCounter, pts, instant: this.reduced }, ...extra })
  }

  private walkNodes(a: Actor, to: string, phase: Phase) {
    const names = route(a.at ?? 'he', to).slice(1)
    this.startWalk(a, nodePts(names), phase, to)
  }

  /** called by the Character component when it has finished the current walk */
  arrived(id: string, walkId: number) {
    const a = this.get(id)
    if (!a || !a.walk || a.walk.id !== walkId) return
    const n = this.patch(id, { walk: null, at: a.dest ?? a.at })
    if (n) this.step(n)
  }

  private step(a: Actor) {
    switch (a.phase) {
      case 'toManager':
        this.patch(a.id, { phase: 'receiving', pose: 'stand', bubble: 'receive' })
        this.after(a.id, RECEIVE_MS, 'receiving', (x) => this.afterReceive(x, false))
        break
      case 'toSeat': {
        const n = this.patch(a.id, { phase: 'working', pose: 'sitType', bubble: 'task' })!
        if (isFinished(n.task)) this.finish(n)
        break
      }
      case 'toQueue': {
        const n = this.patch(a.id, { phase: 'queued', pose: 'stand', bubble: 'task' })!
        if (isFinished(n.task)) this.finish(n)
        else this.pump(n.room)
        break
      }
      case 'toLounge': {
        const seat = a.seat
        const sitting = !!seat && seat.id.startsWith('lounge:')
        this.patch(a.id, { phase: 'lounging', pose: sitting ? 'sit' : 'stand', bubble: 'coffee' })
        if (!a.id.startsWith('s:')) {
          this.after(a.id, LOUNGE_MS, 'lounging', (x) => this.leave(x))
        }
        break
      }
      case 'toManagerFail':
        this.patch(a.id, { phase: 'failedAtManager', pose: 'sad', bubble: 'fail' })
        this.after(a.id, FAIL_DESK_MS, 'failedAtManager', (x) => this.leave(x))
        break
      case 'leaving':
        this.patch(a.id, { exiting: true, bubble: null })
        this.timers.add(window.setTimeout(() => {
          if (a.id.startsWith('s:')) {
            this.tasks.delete(a.id)
          } else if (this.tasks.has(a.id)) {
            this.skipped.add(a.id)
          }
          this.actors.delete(a.id)
          this.emit()
        }, this.reduced ? 0 : FADE_MS))
        break
      default:
        break
    }
  }

  // ------------------------------------------------------------ seats
  private freeSeat(room: RoomId): Seat | null {
    return ROOMS[room].seats.find((s) => !this.seatOwner.has(s.id)) ?? null
  }

  private afterReceive(a: Actor, instant: boolean) {
    if (isFinished(a.task)) { this.finish(a, instant); return }
    this.assign(a, instant)
  }

  private assign(a: Actor, instant = false) {
    const room = ROOMS[a.room]
    const seat = this.freeSeat(a.room)
    const prefix = this.leaveSeat(a)
    const from = this.get(a.id) ?? a
    if (seat) {
      this.seatOwner.set(seat.id, a.id)
      const entry = room.entries[seat.entry]
      const toDoor = this.routeFrom(from, `${a.room}:out${seat.entry}`)
      const pts = [...prefix, ...toDoor, entry.inn, ...seat.via, { x: seat.x, y: seat.y }]
      this.startWalk(from, pts, 'toSeat', null, { seat, queuedAt: 0 })
      if (instant) this.forceInstant(a.id)
      return
    }
    let qi = 0
    for (const o of this.actors.values()) {
      if (o.id !== a.id && o.room === a.room && (o.phase === 'toQueue' || o.phase === 'queued')) qi++
    }
    const q = `q:${a.room}:${Math.min(qi, QUEUE_SIZE - 1)}`
    const toQ = this.routeFrom(from, q)
    const pts = [...prefix, ...toQ]
    this.startWalk(from, pts, 'toQueue', q, { queuedAt: from.queuedAt || Date.now() + qi })
  }

  private forceInstant(id: string) {
    const a = this.get(id)
    if (a?.walk) this.patch(id, { walk: { ...a.walk, instant: true } })
  }

  /** a seat just opened (or someone just joined the queue): seat the first waiter */
  private pump(room: RoomId) {
    if (!this.freeSeat(room)) return
    const waiting = Array.from(this.actors.values())
      .filter((o) => o.room === room && o.phase === 'queued')
      .sort((x, y) => x.queuedAt - y.queuedAt)
    if (waiting[0]) this.assign(waiting[0])
  }

  /** Walk points to leave the current seat; frees it. Returns [] if not seated. */
  private leaveSeat(a: Actor): Pt[] {
    const seat = a.seat
    if (!seat) return []
    const isLounge = seat.id.startsWith('lounge:') || seat.id === 'stand'
    const roomId: RoomId = isLounge ? 'lounge' : a.room
    const entry = ROOMS[roomId].entries[seat.entry] ?? ROOMS[roomId].entries[0]
    if (this.seatOwner.get(seat.id) === a.id) this.seatOwner.delete(seat.id)
    const pts = [...[...seat.via].reverse(), entry.inn, entry.out]
    this.patch(a.id, { seat: null, at: `${roomId}:out${seat.entry}` })
    if (!isLounge) this.timers.add(window.setTimeout(() => this.pump(roomId), 50))
    return pts
  }

  private routeFrom(a: Actor, to: string): Pt[] {
    const n = this.get(a.id) ?? a
    return nodePts(route(n.at ?? 'he', to).slice(1))
  }

  // ------------------------------------------------------------ finishing
  private finish(a: Actor, instant = false) {
    if (a.task.status === 'done') {
      this.patch(a.id, { phase: 'celebrate', pose: a.seat ? 'cheer' : 'stand', bubble: 'done', walk: null })
      this.after(a.id, instant ? 2500 : DONE_MS, 'celebrate', (x) => this.goLounge(x))
    } else {
      if (a.seat) {
        this.patch(a.id, { phase: 'failedSeat', pose: 'sleep', bubble: 'fail', walk: null })
        this.after(a.id, FAIL_MS, 'failedSeat', (x) => this.goFailManager(x))
      } else {
        this.goFailManager(a)
      }
    }
  }

  private goLounge(a: Actor) {
    const lounge = ROOMS.lounge
    const prefix = this.leaveSeat(a)
    const seat = lounge.seats.find((s) => !this.seatOwner.has(s.id))
    const cur = this.get(a.id)!
    const toDoor = this.routeFrom(cur, 'lounge:out0')
    const entry = lounge.entries[0]
    let pts: Pt[]
    let target: Seat
    if (seat) {
      this.seatOwner.set(seat.id, a.id)
      target = seat
      pts = [...prefix, ...toDoor, entry.inn, ...seat.via, { x: seat.x, y: seat.y }]
    } else {
      const spot = LOUNGE_STAND[hashStr(a.id) % LOUNGE_STAND.length]
      target = { id: 'stand', x: spot.x, y: spot.y, via: [], entry: 0, kind: 'chair' }
      pts = [...prefix, ...toDoor, entry.inn, spot]
    }
    this.startWalk(cur, pts, 'toLounge', null, { seat: target, bubble: null, pose: 'stand' })
  }

  private goFailManager(a: Actor) {
    const prefix = this.leaveSeat(a)
    const cur = this.get(a.id)!
    const pts = [...prefix, ...this.routeFrom(cur, 'he')]
    this.startWalk(cur, pts, 'toManagerFail', 'he', { bubble: 'fail', pose: 'stand' })
  }

  private leave(a: Actor) {
    const prefix = this.leaveSeat(a)
    const cur = this.get(a.id)!
    const pts = [...prefix, ...this.routeFrom(cur, 'out')]
    this.startWalk(cur, pts, 'leaving', 'out', { bubble: null, pose: 'stand' })
  }
}

export const engine = new OfficeEngine()
