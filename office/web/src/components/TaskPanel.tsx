import type { ReactNode } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import type { Task } from '../types'
import { fmtDur, trunc } from './Bubble'
import { tagFor } from '../layout'

const EMOJI: Record<string, string> = { queued: '🕓', running: '⏳', done: '✅', failed: '❌' }

function Item({ t, now, onPick }: { t: Task; now: number; onPick: (id: string) => void }) {
  const end = t.finished ?? now
  return (
    <button
      onClick={() => onPick(t.id)}
      className="block w-full border-2 border-ink bg-[#fff8e4] px-2 py-[4px] text-left text-[11px] shadow-[2px_2px_0_#2b1a12] hover:bg-white"
    >
      <div className="flex items-start gap-1">
        <span>{EMOJI[t.status]}</span>
        <span className="min-w-0 flex-1 break-words font-bold leading-tight">{trunc(t.title, 60)}</span>
      </div>
      <div className="mt-[2px] flex justify-between gap-2 text-[10px] opacity-70">
        <span className="truncate">{tagFor(t.agent, t.account)}</span>
        <span className="shrink-0 tabular-nums">{t.status === 'queued' ? 'waiting' : fmtDur(end - t.created)}</span>
      </div>
      {t.result && <div className="mt-[2px] truncate text-[10px] opacity-80">→ {t.result}</div>}
    </button>
  )
}

function Section({ title, items, now, onPick }: { title: string; items: Task[]; now: number; onPick: (id: string) => void }) {
  return (
    <div className="mb-3">
      <div className="mb-1 flex items-center justify-between text-[10px] font-bold uppercase tracking-wider">
        <span>{title}</span>
        <span className="border border-ink bg-cream-d px-1">{items.length}</span>
      </div>
      <div className="flex flex-col gap-[6px]">
        {items.length === 0 && <div className="text-[10px] opacity-50">— none —</div>}
        {items.map((t) => <Item key={t.id} t={t} now={now} onPick={onPick} />)}
      </div>
    </div>
  )
}

export function TaskPanel({
  open, onToggle, tasks, now, onPick, lead,
}: { open: boolean; onToggle: () => void; tasks: Task[]; now: number; onPick: (id: string) => void; lead?: ReactNode }) {
  const running = tasks.filter((t) => t.status === 'running')
  const queued = tasks.filter((t) => t.status === 'queued')
  const done = tasks.filter((t) => t.status === 'done').sort((a, b) => (b.finished ?? 0) - (a.finished ?? 0)).slice(0, 15)
  const failed = tasks.filter((t) => t.status === 'failed').sort((a, b) => (b.finished ?? 0) - (a.finished ?? 0)).slice(0, 15)
  return (
    <>
      <div className="absolute right-3 top-3 z-[1500] flex items-center gap-2">
      {lead}
      <button
        onClick={onToggle}
        className="pixel-btn flex items-center gap-1 px-2 py-1 text-[12px] font-bold"
        title="Task board"
        aria-expanded={open}
      >
        📋 <span className="hidden sm:inline">Task board</span>
        {running.length > 0 && (
          <span className="ml-1 min-w-[18px] border-2 border-ink bg-terra px-[3px] text-center text-[10px] leading-[14px] text-cream">{running.length}</span>
        )}
      </button>
      </div>
      <AnimatePresence>
        {open && (
          <motion.aside
            initial={{ x: 340, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 340, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 380, damping: 36 }}
            className="pixel-box absolute bottom-3 right-3 top-14 z-[1400] w-[300px] max-w-[80vw] overflow-y-auto p-3"
          >
            <div className="mb-2 text-[12px] font-bold">📋 Task board</div>
            <Section title="⏳ Running" items={running} now={now} onPick={onPick} />
            <Section title="🕓 Queued" items={queued} now={now} onPick={onPick} />
            <Section title="✅ Done (last 15)" items={done} now={now} onPick={onPick} />
            <Section title="❌ Failed" items={failed} now={now} onPick={onPick} />
          </motion.aside>
        )}
      </AnimatePresence>
    </>
  )
}
