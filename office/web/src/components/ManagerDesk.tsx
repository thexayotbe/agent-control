import { useEffect, useState } from 'react'
import { MANAGER, OUTFITS } from '../layout'
import { R } from '../sprites/Px'
import { Chair, Glow } from '../sprites/furniture'
import { Sprite, type Look } from '../sprites/characters'
import { useReducedMotion } from '../useOfficeState'

const LOOK: Look = { skin: '#e8b48a', hair: '#2a1b14', style: 0, glasses: true, outfit: OUTFITS.manager }

function BigDesk({ active }: { active: boolean }) {
  const mon = [14, 38, 62]
  return (
    <svg width={88} height={30} viewBox="0 0 88 30" shapeRendering="crispEdges">
      {mon.map((x, i) => (
        <g key={x}>
          <R x={x} y={0} w={14} h={11} c="#232832" />
          <R x={x} y={0} w={14} h={1} c="#3a4252" />
          <R x={x + 1} y={1} w={12} h={8} c={active ? '#0e1f2c' : '#161c25'} />
          {active ? (
            <g>
              <R x={x + 2} y={2} w={5} h={1} c="#7fd0ff" className="scr-a" />
              <R x={x + 2} y={4} w={9} h={1} c="#7fe39a" className="scr-b" />
              <R x={x + 2} y={6} w={4} h={1} c="#f4e9b8" className="scr-c" />
              <R x={x + 8} y={2} w={3} h={1} c="#ffcf70" className="scr-b" />
              <R x={x + 1} y={1} w={12} h={8} c="#7fd0ff" o={0.14} className="glow-pulse" />
            </g>
          ) : (
            <R x={x + 2} y={2} w={2} h={1} c="#2a3342" />
          )}
          <R x={x + 5} y={9} w={4} h={2} c="#232832" />
          {i === 1 && !active && <R x={x + 9} y={7} w={2} h={1} c="#2a3342" />}
        </g>
      ))}
      <R x={0} y={12} w={88} h={9} c="#c98b52" />
      <R x={0} y={12} w={88} h={1} c="#f0c58c" />
      <R x={0} y={20} w={88} h={1} c="#8a5530" />
      {active && <R x={10} y={12} w={66} h={3} c="#7fd0ff" o={0.15} />}
      <R x={34} y={16} w={20} h={3} c="#e7e1d2" /><R x={34} y={18} w={20} h={1} c="#b9b3a3" />
      <R x={4} y={14} w={4} h={4} c="#f6efe0" /><R x={5} y={14} w={2} h={1} c="#6b3a1e" />
      <R x={72} y={14} w={9} h={5} c="#f8f1dc" /><R x={73} y={13} w={8} h={5} c="#ece2c4" />
      <R x={1} y={21} w={86} h={7} c="#a8683a" />
      <R x={1} y={21} w={86} h={1} c="#6e4223" />
      <R x={36} y={23} w={16} h={4} c="#6e4223" />
      <R x={43} y={24} w={2} h={1} c="#e6c87a" />
      <R x={2} y={28} w={4} h={2} c="#6e4223" /><R x={82} y={28} w={4} h={2} c="#6e4223" />
      {/* brass nameplate */}
      <R x={12} y={23} w={16} h={4} c="#e8c15a" /><R x={13} y={24} w={14} h={1} c="#fff3b0" /><R x={14} y={26} w={12} h={1} c="#a8841f" />
    </svg>
  )
}

export function ManagerDesk({ active }: { active: boolean }) {
  const reduced = useReducedMotion()
  const [frame, setFrame] = useState(0)
  useEffect(() => {
    if (!active || reduced) { setFrame(0); return }
    const t = setInterval(() => setFrame((f) => f + 1), 300)
    return () => clearInterval(t)
  }, [active, reduced])

  const { desk, feet } = MANAGER
  return (
    <>
      <div style={{ position: 'absolute', left: desk.x, top: desk.y, width: 88, height: 30, zIndex: desk.y + desk.h }}>
        <BigDesk active={active} />
      </div>
      {active && (
        <div style={{ position: 'absolute', left: desk.x - 12, top: desk.y - 22, zIndex: 700, pointerEvents: 'none' }}>
          <Glow r={56} color="120,210,255" a={0.22} />
        </div>
      )}
      <div style={{ position: 'absolute', left: feet.x - 7, top: feet.y - 10, zIndex: feet.y - 1 }}><Chair color="#2f3b52" /></div>
      <div style={{ position: 'absolute', left: feet.x - 6, top: feet.y - 16, zIndex: feet.y }}>
        <Sprite pose={active ? 'sitType' : 'sleep'} frame={frame} look={LOOK} />
      </div>
    </>
  )
}
