import { BUILDING, ROOM_LIST, WALL_BAND, WORLD, type RoomDef } from '../layout'
import { FloorDefs, ROOM_STYLE } from '../sprites/floors'

const WALL = '#4a2f1c'
const WALL_HI = '#6e482b'
const DOOR_W = 22

function RoomShell({ r }: { r: RoomDef }) {
  const st = ROOM_STYLE[r.id]
  const { x, y, w, h } = r.rect
  const bottom = y + h
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} fill={`url(#${st.floor})`} />
      {/* back wall */}
      <rect x={x} y={y} width={w} height={WALL_BAND} fill={`url(#wall-${r.id})`} />
      <rect x={x} y={y} width={w} height={3} fill={WALL} />
      <rect x={x} y={y + 3} width={w} height={1} fill={WALL_HI} opacity={0.55} />
      <rect x={x + 3} y={y + 13} width={w - 6} height={3} fill={st.base} />
      <rect x={x + 3} y={y + 13} width={w - 6} height={1} fill="#fff" opacity={0.15} />
      <rect x={x + 3} y={y + WALL_BAND} width={w - 6} height={3} fill="#000" opacity={0.14} />
      {/* side + front walls */}
      <rect x={x} y={y} width={3} height={h} fill={WALL} />
      <rect x={x + w - 3} y={y} width={3} height={h} fill={WALL} />
      <rect x={x + 3} y={y + WALL_BAND} width={1} height={h - WALL_BAND - 3} fill="#000" opacity={0.1} />
      <rect x={x} y={bottom - 3} width={w} height={3} fill={WALL} />
      <rect x={x + 3} y={bottom - 4} width={w - 6} height={1} fill="#000" opacity={0.12} />
      {/* doorways */}
      {r.entries.map((e, i) => {
        const d = e.door
        if (d.orient === 'v') {
          const wx = d.x === x ? x : x + w - 3
          return (
            <g key={i}>
              <rect x={wx} y={d.y - DOOR_W / 2} width={3} height={DOOR_W} fill="url(#fl-hall)" />
              <rect x={wx - 1} y={d.y - DOOR_W / 2 - 2} width={5} height={2} fill="#2e1c10" />
              <rect x={wx - 1} y={d.y + DOOR_W / 2} width={5} height={2} fill="#2e1c10" />
              <rect x={wx === x ? wx : wx - 1} y={d.y - DOOR_W / 2 + 2} width={3} height={DOOR_W - 4} fill="#7a2f2f" opacity={0.85} />
            </g>
          )
        }
        const onTop = d.y === y
        const wy = onTop ? y : bottom - 3
        const hh = onTop ? WALL_BAND : 3
        return (
          <g key={i}>
            <rect x={d.x - DOOR_W / 2} y={wy} width={DOOR_W} height={hh} fill={onTop ? `url(#${st.floor})` : 'url(#fl-hall)'} />
            {onTop && <rect x={d.x - DOOR_W / 2} y={wy} width={DOOR_W} height={hh} fill="#000" opacity={0.18} />}
            <rect x={d.x - DOOR_W / 2 - 2} y={wy} width={2} height={hh + (onTop ? 0 : 1)} fill="#2e1c10" />
            <rect x={d.x + DOOR_W / 2} y={wy} width={2} height={hh + (onTop ? 0 : 1)} fill="#2e1c10" />
            {onTop && <rect x={d.x - DOOR_W / 2 - 2} y={wy} width={DOOR_W + 4} height={2} fill="#2e1c10" />}
            <rect x={d.x - DOOR_W / 2 + 2} y={onTop ? wy + hh - 2 : wy} width={DOOR_W - 4} height={2} fill="#7a2f2f" opacity={0.85} />
          </g>
        )
      })}
    </g>
  )
}

/** The building shell: hall floor, outer walls, rooms and doorways. All z=0. */
export function BuildingBase() {
  const { w, h } = BUILDING
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} shapeRendering="crispEdges" style={{ position: 'absolute', left: 0, top: 0 }}>
      <rect width={w} height={h} fill={WALL} />
      <rect x={6} y={4} width={w - 12} height={h - 8} fill="url(#fl-hall)" />
      {/* hall rugs */}
      <rect x={172} y={140} width={136} height={70} fill="#7a2f2f" />
      <rect x={174} y={142} width={132} height={66} fill="#a34545" />
      <rect x={178} y={146} width={124} height={58} fill="#8f3a3a" />
      <rect x={178} y={146} width={124} height={1} fill="#e0b86a" opacity={0.8} />
      <rect x={178} y={203} width={124} height={1} fill="#e0b86a" opacity={0.8} />
      <rect x={336} y={296} width={48} height={58} fill="#3f6f78" />
      <rect x={338} y={298} width={44} height={54} fill="#5a949c" />
      <rect x={342} y={302} width={36} height={46} fill="#4a8189" />
      {ROOM_LIST.map((r) => <RoomShell key={r.id} r={r} />)}
      {/* front entrance */}
      <rect x={344} y={h - 4} width={32} height={4} fill="#d9c8a6" />
      <rect x={342} y={h - 6} width={2} height={6} fill="#2e1c10" />
      <rect x={376} y={h - 6} width={2} height={6} fill="#2e1c10" />
      <rect x={342} y={h - 6} width={36} height={2} fill="#2e1c10" />
      <rect x={350} y={h - 10} width={20} height={3} fill="#7a2f2f" />
      {/* wall highlights */}
      <rect x={0} y={0} width={w} height={1} fill={WALL_HI} />
      <rect x={0} y={0} width={1} height={h} fill={WALL_HI} />
    </svg>
  )
}

export function Garden() {
  const { w, h, ox, oy } = WORLD
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} shapeRendering="crispEdges" style={{ position: 'absolute', left: 0, top: 0 }}>
      <rect width={w} height={h} fill="url(#fl-grass)" />
      {/* path to the entrance */}
      <rect x={ox + 346} y={oy + BUILDING.h - 2} width={28} height={h - (oy + BUILDING.h) + 2} fill="url(#fl-path)" />
      <rect x={ox + 344} y={oy + BUILDING.h - 2} width={2} height={h} fill="#8f7a52" opacity={0.6} />
      <rect x={ox + 374} y={oy + BUILDING.h - 2} width={2} height={h} fill="#8f7a52" opacity={0.6} />
      {/* soft shadow around the building */}
      <rect x={ox - 2} y={oy + BUILDING.h} width={BUILDING.w + 4} height={4} fill="#000" opacity={0.18} />
    </svg>
  )
}

export function Defs() { return <FloorDefs /> }

/** Room name signs live in the unscaled overlay. */
export function RoomLabels({ scale }: { scale: number }) {
  const slot: Record<string, number> = {
    library: 80, architect: 237, review: 397, scout: 66, lounge: 404, workshop: 126,
  }
  return (
    <>
      {ROOM_LIST.map((r) => (
        <div
          key={r.id}
          className="absolute whitespace-nowrap border-2 border-ink bg-cream px-[5px] text-[10px] font-bold leading-[13px] tracking-wide text-ink shadow-[2px_2px_0_#2b1a12]"
          style={{
            left: (WORLD.ox + slot[r.id]) * scale,
            top: (WORLD.oy + r.rect.y + 9) * scale,
            transform: 'translate(-50%, -50%)',
            zIndex: 900,
          }}
        >
          {r.icon} {r.label}
        </div>
      ))}
    </>
  )
}
