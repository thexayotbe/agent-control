import { motion } from 'motion/react'
import type { Task } from '../types'
import type { BubbleKind } from '../engine'

export const trunc = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s)

export function fmtDur(sec: number): string {
  const s = Math.max(0, Math.floor(sec))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const r = s % 60
  if (h > 0) return `${h}h${String(m).padStart(2, '0')}m`
  return `${m}m${String(r).padStart(2, '0')}s`
}

interface Props {
  kind: Exclude<BubbleKind, null>
  task: Task
  now: number
  reduced: boolean
}

export function Bubble({ kind, task, now, reduced }: Props) {
  let body: React.ReactNode
  let bg = '#fff8e4'
  if (task.agent === 'session') {
    const isWorking = task.status === 'running' || kind === 'task'
    const icon = isWorking ? '💬' : '☕'
    body = <span>{icon} {trunc(task.title || (isWorking ? 'working' : 'idle'), 32)}</span>
    return (
      <motion.div
        initial={reduced ? false : { scale: 0.4, opacity: 0, y: 4 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={reduced ? { opacity: 0 } : { scale: 0.4, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 520, damping: 26 }}
        style={{ transformOrigin: '50% 100%', background: bg }}
        className="relative block w-max max-w-[140px] border-2 border-ink px-[5px] py-[3px] text-[10px] text-ink shadow-[2px_2px_0_#2b1a12]"
      >
        {body}
        <span
          aria-hidden
          style={{ background: bg }}
          className="absolute left-1/2 -bottom-[7px] -ml-[3px] block h-[5px] w-[6px] border-x-2 border-b-2 border-ink"
        />
      </motion.div>
    )
  }
  switch (kind) {
    case 'receive':
      body = <span className="text-[13px] leading-none">📋</span>
      break
    case 'coffee':
      body = <span className="text-[13px] leading-none">☕</span>
      break
    case 'done':
      bg = '#e6f6d2'
      body = <span>✅ {trunc(task.result || 'done', 40)}</span>
      break
    case 'fail':
      bg = '#fbdad2'
      body = <span>❌ {trunc(task.result || 'failed', 40)}</span>
      break
    default: {
      const waiting = task.status === 'queued'
      const el = now - (task.created ?? now)
      body = (
        <>
          <div className="font-bold leading-[1.15]">{trunc(task.title, 28)}</div>
          <div className="mt-[2px] text-[9px] leading-none opacity-80">
            {waiting ? '🕓 waiting' : `⏳ ${fmtDur(el)}`}
          </div>
        </>
      )
    }
  }
  return (
    <motion.div
      initial={reduced ? false : { scale: 0.4, opacity: 0, y: 4 }}
      animate={{ scale: 1, opacity: 1, y: 0 }}
      exit={reduced ? { opacity: 0 } : { scale: 0.4, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 520, damping: 26 }}
      style={{ transformOrigin: '50% 100%', background: bg }}
      className="relative block w-max max-w-[136px] border-2 border-ink px-[5px] py-[3px] text-[10px] text-ink shadow-[2px_2px_0_#2b1a12]"
    >
      {body}
      <span
        aria-hidden
        style={{ background: bg }}
        className="absolute left-1/2 -bottom-[7px] -ml-[3px] block h-[5px] w-[6px] border-x-2 border-b-2 border-ink"
      />
    </motion.div>
  )
}
