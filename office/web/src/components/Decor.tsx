import type { ReactNode } from 'react'
import { ROOM_LIST, ROOMS } from '../layout'
import { ROOM_STYLE } from '../sprites/floors'
import * as F from '../sprites/furniture'
import type { Extra } from '../sprites/furniture'

/** place by bottom-centre; z defaults to the bottom edge so things sort by depth */
function Put({ x, y, w, h, z, children, glow }: { x: number; y: number; w: number; h: number; z?: number; children: ReactNode; glow?: ReactNode }) {
  return (
    <>
      <div style={{ position: 'absolute', left: x - w / 2, top: y - h, width: w, height: h, zIndex: z ?? y, pointerEvents: 'none' }}>{children}</div>
      {glow}
    </>
  )
}
/** place by top-left (wall hangings) */
function Wall({ x, y, w, h, z, children }: { x: number; y: number; w: number; h: number; z?: number; children: ReactNode }) {
  return <div style={{ position: 'absolute', left: x, top: y, width: w, height: h, zIndex: z ?? y + h, pointerEvents: 'none' }}>{children}</div>
}
function Light({ x, y, r = 34, a = 0.3, color }: { x: number; y: number; r?: number; a?: number; color?: string }) {
  return <div style={{ position: 'absolute', left: x - r, top: y - r, zIndex: 700, pointerEvents: 'none' }}><F.Glow r={r} a={a} color={color} /></div>
}

const EXTRAS: Record<string, Extra[]> = {
  library: ['mug', 'papers', 'plant', 'mug'],
  workshop: ['mug', 'papers', 'plant', 'mug', 'papers', 'none'],
  architect: ['blueprint', 'plant', 'blueprint', 'mug'],
  review: ['lens', 'papers', 'lens', 'papers'],
  scout: ['mug', 'papers', 'mug', 'plant'],
  chat: ['mug', 'papers', 'mug', 'plant', 'papers', 'none'],
}

export function Decor({ seatOn, loungeBusy }: { seatOn: Record<string, boolean>; loungeBusy: boolean }) {
  const seatDesks = ROOM_LIST.filter((r) => r.id !== 'lounge').flatMap((r) => {
    const st = ROOM_STYLE[r.id]
    return r.seats.map((s, i) => {
      const small = r.id === 'scout'
      const sz = small ? F.SIZES.deskSm : F.SIZES.desk
      return (
        <div key={s.id}>
          <Put x={s.x} y={s.y - 5} w={sz.w} h={sz.h} z={s.y - 5}>
            <F.Desk w={sz.w} on={!!seatOn[s.id]} accent={st.accent} wood={st.wood} extra={EXTRAS[r.id][i % EXTRAS[r.id].length]} seed={i + r.rect.x} />
          </Put>
          {!seatOn[s.id] && (
            <Put x={s.x} y={s.y} w={14} h={10} z={s.y - 1}><F.Chair color={r.id === 'workshop' ? '#4f7f8a' : '#8a3b3b'} /></Put>
          )}
        </div>
      )
    })
  })

  const lib = ROOMS.library.rect
  const arch = ROOMS.architect.rect
  const rev = ROOMS.review.rect
  const scout = ROOMS.scout.rect
  const lounge = ROOMS.lounge.rect
  const ws = ROOMS.workshop.rect
  const band = (r: { y: number }) => r.y + 2

  return (
    <>
      {seatDesks}

      {/* ---------------- Library */}
      {[10, 36, 98, 124].map((x, i) => (
        <Wall key={x} x={x} y={band(lib) } w={26} h={17} z={lib.y + 19}><F.Bookshelf seed={i + 3} /></Wall>
      ))}
      <Wall x={66} y={22} w={26} h={90} z={1}><F.Rug w={26} h={90} a="#6a2828" b="#8f3a3a" c="#e0b86a" /></Wall>
      <Put x={18} y={122} w={10} h={16}><F.Plant variant={0} /></Put>
      <Put x={142} y={122} w={10} h={16}><F.Plant variant={1} /></Put>
      <Put x={14} y={96} w={8} h={24} glow={<Light x={14} y={80} />}><F.Lamp /></Put>
      <Put x={146} y={98} w={10} h={14}><F.Globe /></Put>

      {/* ---------------- Architect */}
      <Wall x={arch.x + 8} y={band(arch) } w={40} h={18} z={arch.y + 22}><F.Whiteboard /></Wall>
      <Wall x={arch.x + 118} y={band(arch) + 1} w={22} h={14} z={arch.y + 20}><F.Window /></Wall>
      <Wall x={arch.x + 146} y={band(arch) + 3} w={8} h={8} z={arch.y + 20}><F.Clock /></Wall>
      <Wall x={arch.x + 66} y={22} w={30} h={90} z={1}><F.Rug w={30} h={90} a="#2f3f5a" b="#4a5f80" c="#e8c15a" /></Wall>
      <Put x={arch.x + 12} y={122} w={10} h={16}><F.Plant variant={1} /></Put>
      <Put x={arch.x + 154} y={122} w={10} h={16}><F.Plant variant={0} /></Put>
      <Put x={arch.x + 148} y={96} w={8} h={24} glow={<Light x={arch.x + 148} y={80} />}><F.Lamp /></Put>
      <Put x={arch.x + 14} y={98} w={10} h={14}><F.Globe /></Put>

      {/* ---------------- Review */}
      <Wall x={rev.x + 6} y={band(rev) + 1} w={30} h={14} z={rev.y + 20}><F.Pinboard /></Wall>
      <Wall x={rev.x + 112} y={band(rev) + 1} w={22} h={14} z={rev.y + 20}><F.Window /></Wall>
      <Wall x={rev.x + 140} y={band(rev) + 3} w={8} h={8} z={rev.y + 20}><F.Clock /></Wall>
      <Wall x={rev.x + 66} y={22} w={26} h={90} z={1}><F.Rug w={26} h={90} a="#4a3068" b="#6a4a8a" c="#e8dcf8" /></Wall>
      <Put x={rev.x + 12} y={122} w={10} h={16}><F.Plant variant={0} /></Put>
      <Put x={rev.x + 142} y={122} w={10} h={16}><F.Plant variant={1} /></Put>
      <Put x={rev.x + 140} y={98} w={16} h={12}><F.Crates /></Put>

      {/* ---------------- Workshop */}
      <Wall x={ws.x + 18} y={ws.y + 1} w={22} h={14} z={ws.y + 20}><F.Window /></Wall>
      <Wall x={ws.x + 188} y={ws.y + 1} w={22} h={14} z={ws.y + 20}><F.Window /></Wall>
      <Wall x={ws.x + 216} y={ws.y + 3} w={8} h={8} z={ws.y + 20}><F.Clock /></Wall>
      <Put x={18} y={310} w={10} h={16}><F.Plant variant={1} /></Put>
      <Put x={18} y={352} w={10} h={16}><F.Plant variant={0} /></Put>
      <Put x={237} y={300} w={8} h={20}><F.Cooler /></Put>
      <Put x={236} y={352} w={14} h={12}><F.Printer /></Put>
      <Put x={238} y={330} w={6} h={8}><F.Bin /></Put>
      <Wall x={ws.x + 76} y={ws.y + 20} w={20} h={84} z={1}><F.Rug w={20} h={84} a="#2f5a62" b="#4a8189" c="#d8e8d0" /></Wall>
      <Wall x={ws.x + 156} y={ws.y + 20} w={20} h={84} z={1}><F.Rug w={20} h={84} a="#2f5a62" b="#4a8189" c="#d8e8d0" /></Wall>

      {/* ---------------- Scout corner */}
      <Wall x={scout.x + 8} y={scout.y + 1} w={22} h={14} z={scout.y + 20}><F.Window /></Wall>
      <Wall x={scout.x + 96} y={scout.y + 3} w={8} h={8} z={scout.y + 20}><F.Clock /></Wall>
      <Wall x={scout.x + 106} y={scout.y + 4} w={10} h={8} z={scout.y + 20}><F.Frame kind={1} /></Wall>
      <Put x={scout.x + 14} y={232} w={10} h={16}><F.Plant variant={0} /></Put>
      <Put x={scout.x + 34} y={230} w={16} h={12}><F.Crates /></Put>
      <Put x={scout.x + 104} y={231} w={8} h={10}><F.PlantSm /></Put>
      <Put x={scout.x + 6} y={202} w={6} h={8}><F.Bin /></Put>

      {/* ---------------- Lounge */}
      <Wall x={lounge.x + 6} y={lounge.y + 1} w={22} h={14} z={lounge.y + 20}><F.Window /></Wall>
      <Wall x={lounge.x + 76} y={lounge.y + 4} w={10} h={8} z={lounge.y + 20}><F.Frame kind={0} /></Wall>
      <Wall x={lounge.x + 90} y={lounge.y + 4} w={10} h={8} z={lounge.y + 20}><F.Frame kind={2} /></Wall>
      <Put x={lounge.x + 108} y={lounge.y + 22} w={16} h={20}><F.CoffeeMachine running={loungeBusy} /></Put>
      <Wall x={364} y={188} w={92} h={44} z={1}><F.Rug w={92} h={44} a={ROOM_STYLE.lounge.rug[0]} b={ROOM_STYLE.lounge.rug[1]} c={ROOM_STYLE.lounge.rug[2]} /></Wall>
      <Put x={399} y={180} w={70} h={20} z={186 - 7}><F.SofaBack w={70} /></Put>
      <Put x={399} y={191} w={70} h={10} z={187}><F.SofaFront w={70} /></Put>
      <Put x={452} y={194} w={24} h={20} z={200 - 7}><F.SofaBack w={24} /></Put>
      <Put x={452} y={205} w={24} h={10} z={201}><F.SofaFront w={24} /></Put>
      <Put x={384} y={224} w={18} h={10} z={223}><F.BeanBag color="#e0a23c" /></Put>
      <Put x={410} y={226} w={18} h={10} z={225}><F.BeanBag color="#6bb09f" /></Put>
      <Put x={447} y={232} w={24} h={8} z={228}><F.CatBed w={24} /></Put>
      <Put x={447} y={230} w={16} h={10} z={229}>
        <F.Cat />
      </Put>
      <Put x={364} y={150} w={8} h={24} glow={<Light x={364} y={134} color="255,200,120" />}><F.Lamp /></Put>
      <Put x={465} y={232} w={8} h={10}><F.PlantSm /></Put>

      {/* ---------------- Lobby + hall */}
      <Put x={290} y={300} w={30} h={12} z={298}><F.Bench /></Put>
      <Put x={262} y={256} w={10} h={16}><F.Plant variant={0} /></Put>
      <Put x={462} y={266} w={10} h={16}><F.Plant variant={1} /></Put>
      <Put x={462} y={350} w={10} h={16}><F.Plant variant={0} /></Put>
      <Put x={270} y={350} w={10} h={16}><F.Plant variant={1} /></Put>
      <Put x={420} y={350} w={8} h={22}><F.CoatRack /></Put>
      <Put x={152} y={170} w={10} h={16}><F.Plant variant={1} /></Put>
      <Put x={132} y={168} w={8} h={24} glow={<Light x={132} y={152} />}><F.Lamp /></Put>
      <Put x={324} y={170} w={10} h={16}><F.Plant variant={0} /></Put>
      <Put x={336} y={170} w={8} h={24} glow={<Light x={336} y={154} />}><F.Lamp /></Put>
    </>
  )
}
