import type { Budget, OfficeState, Task } from '../types'
import { engine, type Actor } from '../engine'
import { CLEAN, LINES, isPureLang, personaOf, type ChatEvent, type Persona } from './lines'

export interface ChatLine {
  id: string
  ts: number // epoch ms
  speaker: string // display name (agent)
  color: string
  to?: string
  text: string
  ai: boolean
}

export interface ChatBubbleData { id: string; text: string; color: string }

export interface ChatSnapshot { log: ChatLine[]; muted: boolean; clean: boolean }

interface BanterLine { id: string; speaker: string; to?: string; text: string }

interface Speaker { key: string; agent: string; persona: Persona; task?: Task; actor?: Actor }

export const PERSONA_COLOR: Record<Persona, string> = {
  opus: '#c4623a', sonnet: '#2f7d4f', haiku: '#b98a12', flash: '#2f7fc4', pro: '#8a3fa0', aopus: '#1f8f9a', manager: '#2f3b52',
}

const LOG_MAX = 200
const BUBBLE_MS = 5000
const BUBBLE_CHARS = 60
const LONG_RUN_SECS = 600
const HOT_PCT = 70
const SEEN_MAX = 300
const MIN_GAP_MS = 15_000 // at most one message per 15s, whoever speaks
const QUEUE_MAX = 4
const LS = { clean: 'office.chat.clean', muted: 'office.chat.muted', seen: 'office.chat.seen' }

const rand = (a: number, b: number) => a + Math.random() * (b - a)
const choice = <T,>(xs: T[]): T => xs[Math.floor(Math.random() * xs.length)]
const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s)

function lsGet(k: string): string | null {
  try { return localStorage.getItem(k) } catch { return null }
}
function lsSet(k: string, v: string) {
  try { localStorage.setItem(k, v) } catch { /* private mode */ }
}

function maxPct(b: Budget | undefined): number | null {
  const m = b?.main
  const v = [m?.five_hour?.pct, m?.seven_day?.pct].filter((x): x is number => typeof x === 'number')
  return v.length ? Math.max(...v) : null
}

export class ChatEngine {
  private snap: ChatSnapshot
  private bubbles = new Map<string, ChatBubbleData>()
  private listeners = new Set<() => void>()
  private timers = new Set<number>()
  private expiry = new Map<string, number>()
  private tickTimer = 0
  private pollTimer = 0
  private started = false
  private counter = 0
  private queue: Array<() => boolean> = []
  private queueTimer = 0
  private lastSpoke = 0

  private prev = new Map<string, Task['status']>()
  private seenFirst = false
  private lastPct: number | null = null
  private lastBlocked = false
  private budget: Budget | undefined
  private tasks: Task[] = []
  private now = Date.now() / 1000
  private complained = new Map<string, number>()
  private recent: string[] = []
  private ai: BanterLine[] = []
  private seen = new Set<string>()

  constructor() {
    try { (JSON.parse(lsGet(LS.seen) ?? '[]') as string[]).forEach((id) => this.seen.add(id)) } catch { /* ignore */ }
    this.snap = { log: [], muted: lsGet(LS.muted) === '1', clean: lsGet(LS.clean) === '1' }
  }

  // ------------------------------------------------------------ store api
  subscribe = (fn: () => void) => { this.listeners.add(fn); return () => { this.listeners.delete(fn) } }
  getSnapshot = () => this.snap
  bubbleOf = (key: string): ChatBubbleData | null => this.bubbles.get(key) ?? null
  private emit() { this.listeners.forEach((l) => l()) }
  private set(p: Partial<ChatSnapshot>) { this.snap = { ...this.snap, ...p }; this.emit() }

  setMuted(v: boolean) {
    lsSet(LS.muted, v ? '1' : '0')
    if (v) this.clearBubbles()
    this.set({ muted: v })
  }
  setClean(v: boolean) {
    lsSet(LS.clean, v ? '1' : '0')
    if (v) this.clearBubbles()
    this.set({ clean: v })
  }

  // ------------------------------------------------------------ lifecycle
  start() {
    if (this.started) return
    this.started = true
    void this.fetchAi()
    this.pollTimer = window.setInterval(() => void this.fetchAi(), 60_000)
    this.scheduleTick()
  }

  stop() {
    this.started = false
    clearInterval(this.pollTimer)
    clearTimeout(this.tickTimer)
    clearTimeout(this.queueTimer)
    this.queueTimer = 0
    this.queue = []
    this.timers.forEach((t) => clearTimeout(t))
    this.timers.clear()
    this.clearBubbles()
  }

  private later(ms: number, fn: () => void) {
    const t = window.setTimeout(() => { this.timers.delete(t); fn() }, ms)
    this.timers.add(t)
  }

  private async fetchAi() {
    try {
      const r = await fetch('/api/banter', { cache: 'no-store' })
      if (!r.ok) return
      const d = await r.json() as { lines?: BanterLine[] }
      if (Array.isArray(d.lines)) this.ai = d.lines.filter((l) => l && l.id && l.speaker && l.text && isPureLang(l.text))
    } catch { /* server without banter: templates only */ }
  }

  // ------------------------------------------------------------ real events
  update(state: OfficeState) {
    this.tasks = state.tasks
    this.now = state.now
    this.budget = state.budget
    const first = !this.seenFirst
    this.seenFirst = true
    const alive = new Set<string>()
    for (const t of state.tasks) {
      alive.add(t.id)
      const before = this.prev.get(t.id)
      this.prev.set(t.id, t.status)
      if (first || before === t.status) continue
      if (before === undefined && (t.status === 'running' || t.status === 'queued')) this.onAssigned(t)
      else if (before === 'queued' && t.status === 'running') this.onStarted(t)
      else if (t.status === 'done') this.onFinished(t, 'task_done')
      else if (t.status === 'failed') this.onFinished(t, 'task_failed')
    }
    for (const id of this.prev.keys()) if (!alive.has(id)) { this.prev.delete(id); this.complained.delete(id) }

    const pct = maxPct(state.budget)
    const blocked = !!state.budget?.main?.blocked
    if (!first) {
      if (blocked && !this.lastBlocked) this.onBudget('budget_blocked', pct)
      else if (pct != null && pct >= HOT_PCT && (this.lastPct == null || this.lastPct < HOT_PCT)) this.onBudget('budget_high', pct)
    }
    this.lastPct = pct
    this.lastBlocked = blocked
  }

  private onAssigned(t: Task) {
    this.later(300, () => {
      const mgr = this.manager()
      const to = this.speakerOfTask(t)
      this.speakEvent('manager_assigns', mgr, to, { task: t, other: to })
      if (t.status === 'running') this.later(rand(1800, 2600), () => this.speakEvent('task_start', this.speakerOfTask(t), mgr, { task: t, other: mgr }))
    })
  }

  private onStarted(t: Task) {
    this.later(rand(1000, 2000), () => this.speakEvent('task_start', this.speakerOfTask(t), this.manager(), { task: t }))
  }

  private onFinished(t: Task, ev: 'task_done' | 'task_failed') {
    this.later(rand(1200, 2200), () => {
      const sp = this.speakerOfTask(t)
      const mgr = this.manager()
      this.speakEvent(ev, sp, mgr, { task: t })
      if (ev === 'task_failed' || Math.random() < 0.4) {
        this.later(rand(1800, 3000), () => this.speakEvent(ev === 'task_failed' ? 'task_failed' : 'reply', mgr, sp, { task: t, other: sp }))
      }
    })
  }

  private onBudget(ev: 'budget_high' | 'budget_blocked', pct: number | null) {
    this.later(rand(1000, 2000), () => {
      const mgr = this.manager()
      this.speakEvent(ev, mgr, null, { pct })
      const others = this.onScreen().filter((s) => s.key !== 'manager')
      if (others.length) this.later(rand(1800, 3000), () => this.speakEvent(ev, choice(others), mgr, { pct, other: mgr }))
    })
  }

  // ------------------------------------------------------------ who is on screen
  private manager(): Speaker { return { key: 'manager', agent: 'manager', persona: 'manager' } }

  private speakerOfActor(a: Actor): Speaker {
    return { key: a.id, agent: a.task.agent, persona: personaOf(a.task.agent), task: a.task, actor: a }
  }

  private onScreen(): Speaker[] {
    const out: Speaker[] = [this.manager()]
    for (const a of engine.getSnapshot()) if (!a.exiting) out.push(this.speakerOfActor(a))
    return out
  }

  /** the character working on task t, or the manager if they already left */
  private speakerOfTask(t: Task): Speaker {
    const a = engine.getSnapshot().find((x) => x.id === t.id && !x.exiting)
    return a ? this.speakerOfActor(a) : { ...this.manager(), task: t }
  }

  /** map an AI speaker id ("agy-sonnet") onto someone currently on screen */
  private resolve(agent: string): Speaker | null {
    const all = this.onScreen()
    return all.find((s) => s.agent === agent) ?? all.find((s) => s.persona === personaOf(agent)) ?? null
  }

  // ------------------------------------------------------------ templates
  private pick(ev: ChatEvent, p: Persona): string | null {
    const set = this.snap.clean ? CLEAN : LINES
    const pool = [...(set[ev][p] ?? []), ...(set[ev].any ?? [])]
    if (!pool.length) return null
    const fresh = pool.filter((l) => !this.recent.includes(l))
    const line = choice(fresh.length ? fresh : pool)
    this.recent.push(line)
    if (this.recent.length > 40) this.recent.shift()
    return line
  }

  private fill(tpl: string, sp: Speaker, ctx: { task?: Task; other?: Speaker | null; pct?: number | null }): string {
    const running = this.tasks.filter((t) => t.status === 'running')
    const task = ctx.task ?? sp.task ?? running[0]
    const mins = task ? Math.max(1, Math.round((((task.finished ?? this.now) - task.created)) / 60)) : 10
    const pct = ctx.pct ?? maxPct(this.budget)
    const vals: Record<string, string> = {
      title: task ? clip(task.title, 26) : 'эта задача',
      repo: task?.repo || 'repo',
      agent: ctx.other?.agent ?? task?.agent ?? 'agent',
      other: ctx.other?.agent ?? choice(this.onScreen()).agent,
      mins: String(mins),
      pct: pct == null ? '??' : String(Math.round(pct)),
    }
    return tpl.replace(/\{(\w+)\}/g, (m, k: string) => vals[k] ?? m)
  }

  private hasPool(ev: ChatEvent, p: Persona): boolean {
    const set = this.snap.clean ? CLEAN : LINES
    return (set[ev][p]?.length ?? 0) + (set[ev].any?.length ?? 0) > 0
  }

  /** queue a templated line; the text is picked when it is actually said */
  private speakEvent(ev: ChatEvent, sp: Speaker, to: Speaker | null, ctx: { task?: Task; other?: Speaker | null; pct?: number | null } = {}): boolean {
    if (this.snap.muted || !this.hasPool(ev, sp.persona)) return false
    this.enqueue(() => {
      const tpl = this.pick(ev, sp.persona)
      if (!tpl) return false
      this.say(sp, this.fill(tpl, sp, { ...ctx, other: ctx.other ?? to }), to, false)
      return true
    })
    return true
  }

  // ------------------------------------------------------------ pacing
  /** every message goes through here: one at a time, MIN_GAP_MS apart, and a stale backlog is dropped */
  private enqueue(fn: () => boolean) {
    this.queue.push(fn)
    while (this.queue.length > QUEUE_MAX) this.queue.shift()
    this.pump()
  }

  private pump() {
    if (this.queueTimer || !this.queue.length || !this.started) return
    const wait = Math.max(0, this.lastSpoke + MIN_GAP_MS - Date.now())
    this.queueTimer = window.setTimeout(() => {
      this.queueTimer = 0
      while (this.queue.length) {
        const fn = this.queue.shift()!
        if (!this.snap.muted && fn()) break
      }
      this.pump()
    }, wait)
  }

  // ------------------------------------------------------------ output
  private say(sp: Speaker, text: string, to: Speaker | string | null, ai: boolean) {
    if (this.snap.muted) return
    this.lastSpoke = Date.now()
    const id = `c${++this.counter}-${Date.now().toString(36)}`
    const color = PERSONA_COLOR[sp.persona]
    this.bubbles.set(sp.key, { id, text: clip(text, BUBBLE_CHARS), color })
    clearTimeout(this.expiry.get(sp.key))
    this.expiry.set(sp.key, window.setTimeout(() => {
      this.expiry.delete(sp.key)
      if (this.bubbles.delete(sp.key)) this.emit()
    }, BUBBLE_MS + Math.min(2000, text.length * 20)))
    const line: ChatLine = { id, ts: Date.now(), speaker: sp.agent, color, to: typeof to === 'string' ? to : to?.agent, text, ai }
    this.set({ log: [...this.snap.log, line].slice(-LOG_MAX) })
  }

  private clearBubbles() {
    this.expiry.forEach((t) => clearTimeout(t))
    this.expiry.clear()
    if (this.bubbles.size) { this.bubbles.clear(); this.emit() }
  }

  // ------------------------------------------------------------ idle chatter
  private scheduleTick() {
    this.tickTimer = window.setTimeout(() => {
      if (!this.started) return
      try { this.tick() } finally { this.scheduleTick() }
    }, rand(15000, 30000))
  }

  private tick() {
    if (this.snap.muted || this.queue.length) return
    if (!this.snap.clean && this.playAi()) return
    const people = this.onScreen()
    const others = people.filter((s) => s.key !== 'manager')
    const lounging = others.filter((s) => s.actor?.phase === 'lounging')
    const running = this.tasks.filter((t) => t.status === 'running')
    const busy = this.tasks.some((t) => t.status === 'running' || t.status === 'queued')
    const pct = maxPct(this.budget)

    const options: Array<() => boolean> = []
    // somebody has been stuck on a task too long (and we haven't moaned about it in the last 5 min)
    const slow = running.find((t) => this.now - t.created > LONG_RUN_SECS && this.now - (this.complained.get(t.id) ?? 0) > 300)
    if (slow) {
      options.push(() => {
        this.complained.set(slow.id, this.now)
        const sp = Math.random() < 0.5 ? this.speakerOfTask(slow) : this.manager()
        return this.converse('long_running', sp, { task: slow })
      })
    }
    if (lounging.length) for (let i = 0; i < 3; i++) options.push(() => this.converse('lounge_smalltalk', choice(lounging), {}))
    if (!busy) for (let i = 0; i < 3; i++) options.push(() => this.converse('idle', choice(people), {}))
    if (pct != null && pct >= HOT_PCT) options.push(() => this.converse('budget_high', Math.random() < 0.6 ? this.manager() : choice(people), { pct }))
    const working = others.filter((s) => s.actor?.phase === 'working')
    if (working.length) options.push(() => this.converse('lounge_smalltalk', choice(working), {}))
    options.push(() => this.converse(busy ? 'lounge_smalltalk' : 'idle', choice(people), {}))

    for (let i = options.length; i > 0; i--) {
      const j = Math.floor(Math.random() * i)
      if (options[j]()) return
      options.splice(j, 1)
    }
  }

  /** a line from `sp`, and often a comeback from somebody else a moment later */
  private converse(ev: ChatEvent, sp: Speaker, ctx: { task?: Task; pct?: number | null }): boolean {
    const others = this.onScreen().filter((s) => s.key !== sp.key)
    const target = others.length && Math.random() < 0.6 ? choice(others) : null
    if (!this.speakEvent(ev, sp, target, ctx)) return false
    if (target) this.speakEvent('reply', target, sp, { other: sp })
    return true
  }

  // ------------------------------------------------------------ AI lines
  private markSeen(id: string) {
    this.seen.add(id)
    lsSet(LS.seen, JSON.stringify([...this.seen].slice(-SEEN_MAX)))
  }

  /** play the next unseen AI line whose speaker is on screen, plus a short chain of replies */
  private playAi(): boolean {
    const idx = this.ai.findIndex((l) => !this.seen.has(l.id) && this.resolve(l.speaker))
    if (idx < 0) return false
    this.playAiAt(idx, 0)
    return true
  }

  private playAiAt(idx: number, depth: number) {
    this.enqueue(() => {
      const line = this.ai[idx]
      if (!line || this.snap.muted || this.snap.clean) return false
      const sp = this.resolve(line.speaker)
      this.markSeen(line.id)
      if (!sp) return false
      const to = line.to ? this.resolve(line.to) : null
      this.say(sp, line.text, to && to.key !== sp.key ? to : to ? null : line.to || null, true)
      const next = this.ai[idx + 1]
      if (depth < 3 && next && !this.seen.has(next.id) && this.resolve(next.speaker)) this.playAiAt(idx + 1, depth + 1)
      return true
    })
  }
}

export const chat = new ChatEngine()
