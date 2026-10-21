import { useEffect, useState } from 'react'
import type { AgyAccount, Budget, Meter, OfficeState, PoolBudget } from '../types'
import { ROOM_LIST, roomFor, type RoomId } from '../layout'
import { chat } from '../banter/engine'
import { useChat } from '../banter/useChat'

const pad = (n: number) => String(n).padStart(2, '0')
const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function resetLabel(epoch: number | null | undefined, now: number): string {
  if (epoch == null) return '?'
  const d = new Date(epoch * 1000)
  const hm = `${pad(d.getHours())}:${pad(d.getMinutes())}`
  return epoch - now < 20 * 3600 ? hm : `${WD[d.getDay()]} ${hm}`
}

const tone = (pct: number | null | undefined) =>
  pct == null ? '#9a8f72' : pct >= 85 ? '#d6453a' : pct >= 70 ? '#e5a02c' : '#4fa65a'

function Bar({ label, m, now, blocked }: { label: string; m?: Meter | null; now: number; blocked?: boolean }) {
  const pct = m?.pct ?? null
  const col = blocked ? '#d6453a' : tone(pct)
  return (
    <span className="flex items-center gap-1" title={`${label}: ${pct == null ? 'unknown' : `${pct}% used`} · resets ${resetLabel(m?.resets, now)}`}>
      <span className="text-[10px] opacity-70">{label}</span>
      <span className="relative h-[10px] w-[54px] border-2 border-ink bg-cream-d">
        <span className="absolute inset-y-0 left-0" style={{ width: `${Math.min(100, pct ?? 0)}%`, background: col }} />
      </span>
      <span className="w-[26px] text-[10px] font-bold" style={{ color: pct != null && pct >= 85 ? '#b42318' : undefined }}>
        {pct == null ? '?' : `${Math.round(pct)}%`}
      </span>
      <span className="text-[9px] opacity-60">↻{resetLabel(m?.resets, now)}</span>
    </span>
  )
}

function Pool({ name, tag, p, now }: { name: string; tag?: string; p?: PoolBudget | null; now: number }) {
  return (
    <div className="flex items-center gap-2 border-2 border-ink bg-cream px-2 py-[3px]">
      <b className="text-[11px]">{name}</b>
      {tag && <span className="border border-ink bg-[#e8c15a] px-1 text-[9px] leading-[12px]">{tag}</span>}
      {p?.blocked ? (
        <span className="border-2 border-ink bg-[#d6453a] px-1 text-[10px] font-bold text-white">BLOCKED</span>
      ) : null}
      <Bar label="5h" m={p?.five_hour} now={now} blocked={p?.blocked} />
      <Bar label="wk" m={p?.seven_day} now={now} blocked={p?.blocked} />
    </div>
  )
}

const pc = (v: number | null | undefined) => (v == null ? '?' : `${Math.round(v)}%`)

function Agy({ a }: { a: AgyAccount }) {
  const off = a.enabled === false
  const login = !!a.needs_login
  const g = a.gemini?.week
  const c = a.claude?.week
  return (
    <span
      className="flex items-center gap-1 border-2 border-ink px-[5px] py-[2px] text-[10px]"
      style={{ background: login ? '#c9c4b8' : '#fff8e4', opacity: off ? 0.45 : 1 }}
      title={`${a.name}: Gemini ${pc(a.gemini?.week)} wk / ${pc(a.gemini?.five)} 5h used · Claude ${pc(a.claude?.week)} wk / ${pc(a.claude?.five)} 5h used${off ? ' · disabled' : ''}`}
    >
      <b>{a.name}</b>
      {login ? (
        <span className="opacity-70">login</span>
      ) : (
        <>
          <span style={{ color: tone(g) }}>G{pc(g)}</span>
          <span style={{ color: tone(c) }}>C{pc(c)}</span>
        </>
      )}
    </span>
  )
}

function ChatControls() {
  const { muted, clean } = useChat()
  const btn = 'pixel-btn px-[6px] py-[1px] text-[13px] leading-[18px]'
  return (
    <div className="ml-auto flex items-center gap-1">
      <button
        className={btn}
        onClick={() => chat.setClean(!clean)}
        aria-pressed={clean}
        title={clean ? 'Clean mode: no swearing (click for 🔞)' : 'Rude mode: swearing on (click for 🧼)'}
      >
        {clean ? '🧼' : '🔞'}
      </button>
      <button
        className={btn}
        onClick={() => chat.setMuted(!muted)}
        aria-pressed={muted}
        title={muted ? 'Chat muted (click to unmute)' : 'Mute chat bubbles'}
      >
        {muted ? '🔇' : '🔊'}
      </button>
    </div>
  )
}

export function BottomBar({ state, budget }: { state: OfficeState | null; budget: Budget | undefined }) {
  const [clock, setClock] = useState(() => new Date())
  useEffect(() => {
    const t = setInterval(() => setClock(new Date()), 1000)
    return () => clearInterval(t)
  }, [])
  const now = state?.now ?? Date.now() / 1000
  const counts: Record<RoomId, { run: number; q: number }> = {
    library: { run: 0, q: 0 }, workshop: { run: 0, q: 0 }, architect: { run: 0, q: 0 },
    review: { run: 0, q: 0 }, scout: { run: 0, q: 0 }, lounge: { run: 0, q: 0 },
  }
  for (const t of state?.tasks ?? []) {
    const r = roomFor(t.agent)
    if (t.status === 'running') counts[r].run++
    else if (t.status === 'queued') counts[r].q++
  }
  const short: Record<RoomId, string> = {
    library: 'Library', workshop: 'Workshop', architect: 'Architect', review: 'Review', scout: 'Scout', lounge: 'Lounge',
  }
  return (
    <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1 border-t-4 border-ink bg-wood-m px-3 py-[6px] text-ink">
      <div className="border-2 border-ink bg-ink px-2 py-[2px] text-[13px] font-bold tabular-nums text-[#ffe9a8]">
        {pad(clock.getHours())}:{pad(clock.getMinutes())}:{pad(clock.getSeconds())}
      </div>
      <div className="flex flex-wrap items-center gap-1">
        {ROOM_LIST.filter((r) => r.id !== 'lounge').map((r) => {
          const c = counts[r.id]
          const busy = c.run > 0
          return (
            <span key={r.id} className="flex items-center gap-1 border-2 border-ink bg-cream px-[6px] py-[2px] text-[10px]">
              <span style={{ color: busy ? '#3f9a4c' : c.q ? '#e5a02c' : '#9a8f72' }}>●</span>
              <b>{short[r.id]}</b>
              <span className="opacity-80">
                {busy ? `· ${c.run} working` : c.q ? '· idle' : '· idle'}
                {c.q ? ` +${c.q} queued` : ''}
              </span>
            </span>
          )
        })}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Pool name="MAIN" p={budget?.main} now={now} />
        <Pool name="SECOND" tag="reserve" p={budget?.second} now={now} />
      </div>
      <div className="flex flex-wrap items-center gap-1">
        {(budget?.agy ?? []).map((a) => <Agy key={a.name} a={a} />)}
      </div>
      <ChatControls />
    </div>
  )
}
