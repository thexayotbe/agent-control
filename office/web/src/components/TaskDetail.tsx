import { useEffect } from 'react'
import { motion } from 'motion/react'
import type { Task } from '../types'
import { fmtDur } from './Bubble'
import { tagFor } from '../layout'

const EMOJI: Record<string, string> = { queued: '🕓', running: '⏳', done: '✅', failed: '❌' }

function Row({ k, children }: { k: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-2 border-b-2 border-dashed border-cream-d py-[3px] text-[11px]">
      <span className="w-[62px] shrink-0 uppercase opacity-60">{k}</span>
      <span className="min-w-0 flex-1 break-words">{children}</span>
    </div>
  )
}

export function TaskDetail({ task, now, onClose }: { task: Task; now: number; onClose: () => void }) {
  useEffect(() => {
    const f = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', f)
    return () => window.removeEventListener('keydown', f)
  }, [onClose])
  const end = task.finished ?? now
  const started = new Date(task.created * 1000)
  return (
    <div className="absolute inset-0 z-[2000] flex items-center justify-center bg-ink/30" onClick={onClose}>
      <motion.div
        initial={{ scale: 0.85, opacity: 0, y: 10 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
        className="pixel-box w-[min(380px,92vw)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b-2 border-ink bg-terra px-2 py-1 text-cream">
          <span className="text-[11px] font-bold tracking-wider">{EMOJI[task.status]} {task.status.toUpperCase()}</span>
          <button className="pixel-btn px-[6px] text-[11px] leading-[16px] text-ink" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className="p-3">
          <div className="mb-2 text-[14px] font-bold leading-snug">{task.title}</div>
          <Row k="agent">{tagFor(task.agent, task.account)} <span className="opacity-60">({task.agent}{task.account ? ` / ${task.account}` : ''})</span></Row>
          <Row k="repo">{task.repo || '—'}</Row>
          <Row k="started">{started.toLocaleString()}</Row>
          <Row k="duration">{fmtDur(end - task.created)}{task.finished ? '' : ' (so far)'}</Row>
          <Row k="id"><span className="opacity-70">{task.id}{task.t3_task ? ` · t3 ${task.t3_task}` : ''}</span></Row>
          <div className="mt-2 text-[10px] uppercase opacity-60">result</div>
          <div className="mt-1 max-h-[140px] overflow-auto whitespace-pre-wrap break-words border-2 border-ink bg-white/60 p-2 text-[11px]">
            {task.result || (task.status === 'done' || task.status === 'failed' ? '(no result text)' : '… not finished yet')}
          </div>
        </div>
      </motion.div>
    </div>
  )
}
