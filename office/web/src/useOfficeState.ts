import { createContext, useContext, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import type { OfficeState } from './types'
import { engine, type Actor } from './engine'

const POLL_MS = 3000

function valid(d: unknown): d is OfficeState {
  const o = d as OfficeState
  return !!o && typeof o === 'object' && Array.isArray(o.tasks) && typeof o.now === 'number'
}

async function load(url: string): Promise<OfficeState> {
  const r = await fetch(url, { cache: 'no-store' })
  if (!r.ok) throw new Error(`${url}: ${r.status}`)
  const d = await r.json()
  if (!valid(d)) throw new Error(`${url}: bad shape`)
  return d
}

/** Server-time "now" in epoch seconds, ticking every second (shared via context). */
export const NowContext = createContext<number>(Date.now() / 1000)
export const useNow = () => useContext(NowContext)

export function useOfficeState() {
  const [state, setState] = useState<OfficeState | null>(null)
  const [demo, setDemo] = useState(false)
  const [now, setNow] = useState(() => Date.now() / 1000)
  const offset = useRef(0)

  useEffect(() => {
    let alive = true
    const poll = async () => {
      let data: OfficeState | null = null
      let isDemo = false
      try {
        data = await load('/api/state')
      } catch {
        try { data = await load('/sample-state.json'); isDemo = true } catch { data = null }
      }
      if (!alive || !data) return
      offset.current = data.now - Date.now() / 1000
      setDemo(isDemo)
      setState(data)
      setNow(Date.now() / 1000 + offset.current)
      engine.sync(data.tasks, data.now)
    }
    void poll()
    const id = window.setInterval(poll, POLL_MS)
    const tick = window.setInterval(() => setNow(Date.now() / 1000 + offset.current), 1000)
    return () => { alive = false; clearInterval(id); clearInterval(tick) }
  }, [])

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const upd = () => { engine.reduced = mq.matches }
    upd()
    mq.addEventListener('change', upd)
    return () => mq.removeEventListener('change', upd)
  }, [])

  const actors = useSyncExternalStore(engine.subscribe, engine.getSnapshot) as Actor[]
  return { state, demo, now, actors }
}

export function useReducedMotion(): boolean {
  const [r, setR] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const f = () => setR(mq.matches)
    mq.addEventListener('change', f)
    return () => mq.removeEventListener('change', f)
  }, [])
  return r
}
