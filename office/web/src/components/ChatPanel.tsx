import { useEffect, useRef } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { useChat } from '../banter/useChat'
import { useReducedMotion } from '../useOfficeState'

const pad = (n: number) => String(n).padStart(2, '0')
const hm = (ts: number) => { const d = new Date(ts); return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}` }

export function ChatToggle({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  return (
    <button onClick={onToggle} className="pixel-btn flex items-center gap-1 px-2 py-1 text-[12px] font-bold" title="Office chat" aria-expanded={open}>
      💬 <span className="hidden sm:inline">Office chat</span>
    </button>
  )
}

export function ChatPanel({ open }: { open: boolean }) {
  const { log } = useChat()
  const reduced = useReducedMotion()
  const box = useRef<HTMLDivElement>(null)
  const stick = useRef(true)

  useEffect(() => {
    const el = box.current
    if (open && el && stick.current) el.scrollTop = el.scrollHeight
  }, [log, open])

  return (
    <AnimatePresence>
      {open && (
        <motion.aside
          initial={reduced ? false : { x: -340, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={reduced ? { opacity: 0 } : { x: -340, opacity: 0 }}
          transition={reduced ? { duration: 0 } : { type: 'spring', stiffness: 380, damping: 36 }}
          className="pixel-box absolute bottom-3 left-3 top-14 z-[1400] flex w-[320px] max-w-[80vw] flex-col p-3"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="mb-2 flex items-center justify-between text-[12px] font-bold">
            <span>💬 Office chat</span>
            <span className="border border-ink bg-cream-d px-1 text-[10px]">{log.length}</span>
          </div>
          <div
            ref={box}
            onScroll={(e) => { const el = e.currentTarget; stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 24 }}
            className="min-h-0 flex-1 overflow-y-auto"
          >
            {log.length === 0 && <div className="text-[10px] opacity-50">— тишина. пока что —</div>}
            {log.map((l) => (
              <div key={l.id} className="mb-[6px] text-[11px] leading-[1.3]">
                <span className="mr-1 text-[9px] tabular-nums opacity-50">{hm(l.ts)}</span>
                <b style={{ color: l.color }}>{l.speaker}</b>
                {l.to && <span className="opacity-60"> → {l.to}</span>}
                <span>: {l.text}</span>
                {l.ai && <span className="ml-1 text-[9px] opacity-40" title="AI-written">✨</span>}
              </div>
            ))}
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  )
}
