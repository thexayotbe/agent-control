import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { BUILDING, MANAGER, WORLD } from '../layout'
import type { Actor } from '../engine'
import { CharacterLabel, CharacterSprite } from './Character'
import { BuildingBase, Defs, Garden, RoomLabels } from './Room'
import { Decor } from './Decor'
import { ManagerDesk } from './ManagerDesk'
import * as F from '../sprites/furniture'
import { useReducedMotion } from '../useOfficeState'
import { ChatBubble } from './ChatBubble'
import { useChatBubble } from '../banter/useChat'

function useBox<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [box, setBox] = useState({ w: 0, h: 0 })
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setBox({ w: e.contentRect.width, h: e.contentRect.height }))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return [ref, box] as const
}

/** biggest scale that fits and lands on whole device pixels, so art stays crisp */
function stageScale(w: number, h: number): number {
  if (!w || !h) return 1
  const dpr = Math.max(1, window.devicePixelRatio || 1)
  const fit = Math.min(w / WORLD.w, h / WORLD.h)
  return Math.max(0.5, Math.floor(fit * dpr) / dpr)
}

interface Props {
  actors: Actor[]
  now: number
  managerActive: boolean
  onSelect: (taskId: string) => void
}

export function Office({ actors, now, managerActive, onSelect }: Props) {
  const [ref, box] = useBox<HTMLDivElement>()
  const reduced = useReducedMotion()
  const scale = stageScale(box.w, box.h)
  const dpr = Math.max(1, window.devicePixelRatio || 1)
  const left = Math.round(((box.w - WORLD.w * scale) / 2) * dpr) / dpr
  const top = Math.round(((box.h - WORLD.h * scale) / 2) * dpr) / dpr

  const seatOn = useMemo(() => {
    const m: Record<string, boolean> = {}
    for (const a of actors) {
      if (a.seat && !a.walk && a.task.status === 'running' && a.phase === 'working') m[a.seat.id] = true
    }
    return m
  }, [actors])
  const loungeBusy = actors.some((a) => a.phase === 'lounging')

  const sorted = useMemo(() => [...actors].sort((a, b) => a.id.localeCompare(b.id)), [actors])

  return (
    <div
      ref={ref}
      className="relative min-h-0 flex-1 overflow-hidden"
      style={{ background: '#5f8f3f' }}
    >
      <Defs />
      <div style={{ position: 'absolute', left, top, width: WORLD.w * scale, height: WORLD.h * scale }}>
        <div
          style={{ position: 'absolute', left: 0, top: 0, width: WORLD.w, height: WORLD.h, transform: `scale(${scale})`, transformOrigin: '0 0' }}
        >
          <Garden />
          <div style={{ position: 'absolute', inset: 0, zIndex: 0 }}><Outdoors /></div>
          <div style={{ position: 'absolute', left: WORLD.ox, top: WORLD.oy, width: BUILDING.w, height: BUILDING.h, zIndex: 1 }}>
            <BuildingBase />
            <Decor seatOn={seatOn} loungeBusy={loungeBusy} />
            <ManagerDesk active={managerActive} />
            {sorted.map((a) => (
              <CharacterSprite key={a.id} actor={a} reduced={reduced} onSelect={onSelect} />
            ))}
          </div>
        </div>
        {/* unscaled text layer */}
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
          <RoomLabels scale={scale} />
          <ManagerLabel active={managerActive} scale={scale} reduced={reduced} />
          {sorted.map((a) => (
            <CharacterLabel key={a.id} actor={a} scale={scale} now={now} reduced={reduced} />
          ))}
        </div>
      </div>
    </div>
  )
}

function ManagerLabel({ active, scale, reduced }: { active: boolean; scale: number; reduced: boolean }) {
  const x = (WORLD.ox + MANAGER.feet.x) * scale
  const y = (WORLD.oy + MANAGER.feet.y) * scale
  const talk = useChatBubble('manager')
  return (
    <div style={{ position: 'absolute', left: x, top: y, zIndex: 1000 + MANAGER.feet.y, pointerEvents: 'none' }}>
      <div
        style={{ position: 'absolute', left: 0, top: 3 * scale, transform: 'translate(-50%, 0)' }}
        className="whitespace-nowrap bg-ink/85 px-[4px] text-[9px] font-bold leading-[11px] tracking-wider text-[#e8c15a]"
      >
        MANAGER
      </div>
      <div style={{ position: 'absolute', left: 0, top: -34 * scale, transform: 'translate(-50%, -100%)' }}>
        <AnimatePresence>
          {talk && <ChatBubble key={talk.id} text={talk.text} reduced={reduced} />}
        </AnimatePresence>
      </div>
      {!active && (
        <div style={{ position: 'absolute', left: 10 * scale, top: -24 * scale, pointerEvents: 'none' }} className="text-[11px] font-bold text-ink">
          {[0, 1, 2].map((i) => (
            <motion.span
              key={i}
              className="absolute whitespace-nowrap rounded-none border-2 border-ink bg-cream px-[3px] leading-none shadow-[1px_1px_0_#2b1a12]"
              style={{ left: i * 7, top: -i * 9, fontSize: 8 + i * 2 }}
              initial={{ opacity: reduced ? 1 : 0 }}
              animate={reduced ? { opacity: 1 } : { opacity: [0, 1, 1, 0], y: [2, 0, -3, -6] }}
              transition={reduced ? undefined : { duration: 2.8, repeat: Infinity, delay: i * 0.5, ease: 'linear' }}
            >
              {i === 2 ? 'Z' : 'z'}
            </motion.span>
          ))}
        </div>
      )}
    </div>
  )
}

/** trees, bushes and flowers around the building */
function Outdoors() {
  const { ox, oy } = WORLD
  const T = (x: number, y: number, v = 0) => (
    <div key={`t${x}${y}`} style={{ position: 'absolute', left: x, top: y, zIndex: y + 34 }}><F.Tree variant={v} /></div>
  )
  const B = (x: number, y: number) => (
    <div key={`b${x}${y}`} style={{ position: 'absolute', left: x, top: y, zIndex: y + 10 }}><F.Bush /></div>
  )
  const Fl = (x: number, y: number, c: string) => (
    <div key={`f${x}${y}`} style={{ position: 'absolute', left: x, top: y, zIndex: y }}><F.Flowers c={c} /></div>
  )
  const bottom = oy + BUILDING.h
  return (
    <>
      {T(1, 8)}{T(2, 80, 1)}{T(0, 160)}{T(3, 240, 1)}{T(1, 318)}
      {T(ox + BUILDING.w + 4, 14, 1)}{T(ox + BUILDING.w + 6, 96)}{T(ox + BUILDING.w + 3, 178, 1)}{T(ox + BUILDING.w + 5, 260)}{T(ox + BUILDING.w + 2, 330, 1)}
      {B(ox + 20, bottom + 2)}{B(ox + 60, bottom + 6)}{B(ox + 180, bottom + 3)}{B(ox + 270, bottom + 6)}{B(ox + 440, bottom + 4)}
      {Fl(ox + 100, bottom + 8, '#f4a0b8')}{Fl(ox + 120, bottom + 14, '#ffffff')}{Fl(ox + 220, bottom + 10, '#f4e27a')}{Fl(ox + 300, bottom + 14, '#f4a0b8')}{Fl(ox + 410, bottom + 10, '#c9a0e8')}
      {Fl(ox + 14, bottom + 14, '#f4e27a')}{Fl(ox + 150, bottom + 16, '#c9a0e8')}
      <div style={{ position: 'absolute', left: ox + 330, top: bottom - 8, zIndex: bottom + 22 }}><F.LampPost /></div>
      <div style={{ position: 'absolute', left: ox + 390, top: bottom - 8, zIndex: bottom + 22 }}><F.LampPost /></div>
    </>
  )
}
