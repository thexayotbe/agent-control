import { memo, useEffect, useState } from 'react'
import { AnimatePresence, animate, motion, useTransform } from 'motion/react'
import { engine, type Actor } from '../engine'
import { Sprite, spriteSize, type Pose } from '../sprites/characters'
import { Chair } from '../sprites/furniture'
import { WORLD } from '../layout'
import { Bubble } from './Bubble'
import { ChatBubble } from './ChatBubble'
import { useChatBubble } from '../banter/useChat'

const SPEED = 62 // art px per second

const SEATED: Pose[] = ['sitType', 'cheer', 'sleep']

interface WalkView { side: boolean; flip: boolean }

function useWalker(actor: Actor, reduced: boolean) {
  const { mv, walk } = actor
  const [view, setView] = useState<WalkView | null>(null)
  const walkId = walk?.id

  useEffect(() => {
    if (!walk) { setView(null); return }
    const last = walk.pts[walk.pts.length - 1]
    if (walk.instant || reduced) {
      mv.x.set(last.x)
      mv.y.set(last.y)
      setView(null)
      const t = window.setTimeout(() => engine.arrived(actor.id, walk.id), 0)
      return () => clearTimeout(t)
    }
    let cancelled = false
    const running: { stop: () => void }[] = []
    void (async () => {
      for (const p of walk.pts) {
        if (cancelled) return
        const dx = p.x - mv.x.get()
        const dy = p.y - mv.y.get()
        const d = Math.hypot(dx, dy)
        if (d < 0.01) continue
        setView({ side: Math.abs(dx) >= Math.abs(dy), flip: dx < 0 })
        const ax = animate(mv.x, p.x, { duration: d / SPEED, ease: 'linear' })
        const ay = animate(mv.y, p.y, { duration: d / SPEED, ease: 'linear' })
        running.push(ax, ay)
        await Promise.all([ax, ay])
      }
      if (!cancelled) { setView(null); engine.arrived(actor.id, walk.id) }
    })()
    return () => { cancelled = true; running.forEach((r) => r.stop()) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [walkId, reduced])

  return view
}

export const CharacterSprite = memo(function CharacterSprite(
  { actor, reduced, onSelect }: { actor: Actor; reduced: boolean; onSelect: (id: string) => void },
) {
  const { mv } = actor
  const view = useWalker(actor, reduced)
  const walking = !!actor.walk && !reduced
  const typing = !actor.walk && actor.pose === 'sitType' && actor.task.status === 'running' && !reduced
  const [frame, setFrame] = useState(0)
  useEffect(() => {
    if (!walking && !typing) { setFrame(0); return }
    const t = window.setInterval(() => setFrame((f) => f + 1), walking ? 170 : 360)
    return () => clearInterval(t)
  }, [walking, typing])

  const z = useTransform(mv.y, (v) => Math.round(v))
  const chairZ = useTransform(mv.y, (v) => Math.round(v) - 1)

  const pose: Pose = actor.walk
    ? (view?.side ? 'walkSide' : 'walk')
    : actor.pose
  const { w, h } = spriteSize(pose)
  const seatedDesk = !actor.walk && SEATED.includes(pose) && actor.seat?.kind === 'desk'
  const lift = SEATED.includes(pose) ? 2 : 0
  const bob = walking && frame % 2 === 1 ? -1 : 0
  const flip = pose === 'walkSide' && view?.flip

  return (
    <>
      {seatedDesk && (
        <motion.div style={{ x: mv.x, y: mv.y, zIndex: chairZ, position: 'absolute', left: 0, top: 0, pointerEvents: 'none' }}>
          <div style={{ position: 'absolute', left: -7, top: -10 }}><Chair color={actor.look.outfit.shade} /></div>
        </motion.div>
      )}
      <motion.div style={{ x: mv.x, y: mv.y, zIndex: z, position: 'absolute', left: 0, top: 0 }}>
        <motion.div
          initial={{ opacity: actor.fadeIn ? 0 : 1 }}
          animate={{ opacity: actor.exiting ? 0 : 1 }}
          transition={{ duration: reduced ? 0 : 0.55 }}
          onClick={(e) => { e.stopPropagation(); onSelect(actor.id) }}
          style={{
            position: 'absolute', left: -w / 2, top: -h - lift + bob, width: w, height: h,
            cursor: 'pointer', transform: flip ? 'scaleX(-1)' : undefined,
          }}
          className={actor.phase === 'queued' || actor.phase === 'lounging' ? 'breathe' : undefined}
        >
          <Sprite pose={pose} frame={frame} look={actor.look} />
        </motion.div>
        {!seatedDesk && (
          <div style={{ position: 'absolute', left: -5, top: -1, width: 10, height: 2, background: 'rgba(0,0,0,0.2)', pointerEvents: 'none' }} />
        )}
      </motion.div>
    </>
  )
})

/** Text lives in an unscaled overlay so it stays crisp at any stage scale. */
export const CharacterLabel = memo(function CharacterLabel(
  { actor, scale, now, reduced }: { actor: Actor; scale: number; now: number; reduced: boolean },
) {
  const { mv } = actor
  const talk = useChatBubble(actor.id)
  const x = useTransform(mv.x, (v) => (v + WORLD.ox) * scale)
  const y = useTransform(mv.y, (v) => (v + WORLD.oy) * scale)
  const z = useTransform(mv.y, (v) => 1000 + Math.round(v))
  const seatedDesk = !actor.walk && SEATED.includes(actor.pose) && actor.seat?.kind === 'desk'
  const headUp = seatedDesk ? 31 : actor.pose === 'sit' && !actor.walk ? 19 : 22
  const tagDown = seatedDesk ? 3 : 1

  return (
    <motion.div style={{ x, y, zIndex: z, position: 'absolute', left: 0, top: 0, pointerEvents: 'none' }}>
      <div style={{ position: 'absolute', left: 0, top: -headUp * scale - 10, transform: 'translate(-50%, -100%)' }}>
        <AnimatePresence>
          {talk ? (
            <ChatBubble key={talk.id} text={talk.text} reduced={reduced} />
          ) : actor.bubble && (
            <Bubble key={actor.bubble} kind={actor.bubble} task={actor.task} now={now} reduced={reduced} />
          )}
        </AnimatePresence>
      </div>
      <div
        style={{ position: 'absolute', left: 0, top: tagDown * scale, transform: 'translate(-50%, 0)', opacity: actor.exiting ? 0 : 1 }}
        className="whitespace-nowrap bg-ink/80 px-[3px] text-[8.5px] leading-[11px] text-cream"
      >
        {actor.tag}
      </div>
    </motion.div>
  )
})
