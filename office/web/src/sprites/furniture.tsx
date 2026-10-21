import { useMemo } from 'react'
import { Px, R } from './Px'
import { hashStr } from '../layout'

const svgProps = (w: number, h: number) => ({
  width: w, height: h, viewBox: `0 0 ${w} ${h}`, shapeRendering: 'crispEdges' as const,
})

export const SIZES = {
  desk: { w: 30, h: 24 }, deskSm: { w: 24, h: 22 }, chair: { w: 14, h: 10 },
  bookshelf: { w: 26, h: 17 }, plant: { w: 10, h: 16 }, plantSm: { w: 8, h: 10 }, lamp: { w: 8, h: 24 },
  whiteboard: { w: 40, h: 18 }, pinboard: { w: 30, h: 14 }, window: { w: 22, h: 14 }, clock: { w: 8, h: 8 },
  frame: { w: 10, h: 8 }, coffee: { w: 16, h: 20 }, cat: { w: 16, h: 10 }, bean: { w: 18, h: 10 },
  bench: { w: 30, h: 12 }, tree: { w: 28, h: 34 }, bush: { w: 16, h: 10 }, cooler: { w: 8, h: 20 },
  printer: { w: 14, h: 12 }, bin: { w: 6, h: 8 }, globe: { w: 10, h: 14 }, crates: { w: 16, h: 12 },
  coatrack: { w: 8, h: 22 }, flowers: { w: 8, h: 6 }, lampPost: { w: 8, h: 30 },
}

// ------------------------------------------------------------------ desk

export type Extra = 'mug' | 'papers' | 'lens' | 'blueprint' | 'plant' | 'none'

export function Desk({
  w = 30, on, accent, wood = ['#d9a066', '#b97b44', '#8a5530'], extra = 'mug', seed = 0,
}: { w?: number; on: boolean; accent: string; wood?: [string, string, string]; extra?: Extra; seed?: number }) {
  const [light, mid, dark] = wood
  const mw = w >= 30 ? 12 : 10
  const mx = Math.round((w - mw) / 2)
  const h = w >= 30 ? 24 : 22
  const mh = w >= 30 ? 9 : 8
  const sy = mh + 1
  const variant = seed % 3
  return (
    <svg {...svgProps(w, h)}>
      {/* monitor */}
      <R x={mx} y={0} w={mw} h={mh} c="#232832" />
      <R x={mx} y={0} w={mw} h={1} c="#3a4252" />
      <R x={mx + 1} y={1} w={mw - 2} h={mh - 3} c={on ? '#0e1a24' : '#1a212b'} />
      {on ? (
        <g>
          <R x={mx + 2} y={2} w={4} h={1} c={accent} className="scr-a" />
          <R x={mx + 2} y={4} w={mw - 5} h={1} c={accent} className="scr-b" />
          <R x={mx + 2} y={6} w={3} h={1} c="#f4e9b8" className="scr-c" />
          <R x={mx + 6} y={2} w={2} h={1} c="#f4e9b8" className="scr-b" />
          <R x={mx + 1} y={1} w={mw - 2} h={mh - 3} c={accent} o={0.12} className="glow-pulse" />
        </g>
      ) : (
        <R x={mx + 2} y={2} w={2} h={1} c="#313a49" />
      )}
      <R x={mx + Math.floor(mw / 2) - 2} y={mh - 1} w={4} h={1} c="#232832" />
      <R x={mx + Math.floor(mw / 2) - 1} y={mh} w={2} h={1} c="#232832" />
      {/* surface */}
      <R x={0} y={sy} w={w} h={8} c={light} />
      <R x={0} y={sy} w={w} h={1} c="#f0c58c" />
      <R x={0} y={sy + 7} w={w} h={1} c={mid} />
      {on && <R x={mx - 1} y={sy} w={mw + 2} h={3} c={accent} o={0.16} />}
      {/* keyboard */}
      <R x={Math.round(w / 2) - 4} y={sy + 4} w={8} h={2} c="#e7e1d2" />
      <R x={Math.round(w / 2) - 4} y={sy + 5} w={8} h={1} c="#b9b3a3" />
      {/* extras */}
      {extra === 'mug' && <g><R x={2} y={sy + 2} w={3} h={3} c="#f6efe0" /><R x={3} y={sy + 2} w={1} h={1} c="#6b3a1e" /><R x={5} y={sy + 3} w={1} h={1} c="#f6efe0" /></g>}
      {extra === 'papers' && <g><R x={w - 8} y={sy + 2} w={6} h={4} c="#f8f1dc" /><R x={w - 7} y={sy + 1} w={6} h={4} c="#ece2c4" /><R x={w - 6} y={sy + 2} w={3} h={1} c="#9a8f72" /></g>}
      {extra === 'lens' && <g><R x={w - 9} y={sy + 1} w={5} h={5} c="#3b2a1d" /><R x={w - 8} y={sy + 2} w={3} h={3} c="#bfe6f2" /><R x={w - 8} y={sy + 2} w={1} h={1} c="#ffffff" /><R x={w - 4} y={sy + 5} w={3} h={1} c="#3b2a1d" /><R x={2} y={sy + 2} w={5} h={4} c="#f8f1dc" /><R x={3} y={sy + 3} w={3} h={1} c="#9a8f72" /></g>}
      {extra === 'blueprint' && <g><R x={w - 10} y={sy + 2} w={8} h={4} c="#8fc2e8" /><R x={w - 9} y={sy + 3} w={3} h={1} c="#e9f6ff" /><R x={w - 5} y={sy + 4} w={2} h={1} c="#e9f6ff" /><R x={w - 11} y={sy + 2} w={1} h={4} c="#d8e8f2" /><R x={2} y={sy + 2} w={3} h={3} c="#f6efe0" /><R x={3} y={sy + 2} w={1} h={1} c="#6b3a1e" /></g>}
      {extra === 'plant' && <g><R x={2} y={sy + 3} w={3} h={3} c="#a8553a" /><R x={2} y={sy} w={3} h={3} c="#58a05a" /><R x={3} y={sy - 1} w={1} h={1} c="#7cc477" /></g>}
      {variant === 1 && extra !== 'papers' && extra !== 'lens' && extra !== 'blueprint' && <R x={w - 6} y={sy + 3} w={4} h={3} c="#f0e3c0" />}
      {/* front panel */}
      <R x={1} y={sy + 8} w={w - 2} h={5} c={mid} />
      <R x={1} y={sy + 8} w={w - 2} h={1} c={dark} />
      <R x={Math.round(w / 2) - 5} y={sy + 9} w={10} h={3} c={dark} />
      <R x={Math.round(w / 2) - 1} y={sy + 10} w={2} h={1} c="#e6c87a" />
      <R x={1} y={h - 1} w={3} h={1} c={dark} />
      <R x={w - 4} y={h - 1} w={3} h={1} c={dark} />
    </svg>
  )
}

export function Chair({ color = '#8a3b3b' }: { color?: string }) {
  return (
    <svg {...svgProps(14, 10)}>
      <R x={0} y={0} w={14} h={7} c={color} />
      <R x={0} y={0} w={14} h={1} c="#b95a55" />
      <R x={1} y={7} w={12} h={1} c="#5e2626" />
      <R x={3} y={8} w={2} h={2} c="#2b2b33" />
      <R x={9} y={8} w={2} h={2} c="#2b2b33" />
    </svg>
  )
}

// ------------------------------------------------------------ wall pieces

const BOOK_COLS = ['#b8453a', '#d89a3c', '#4f7fa8', '#5b9a68', '#8a5aa0', '#e8d4a4', '#c46a3a', '#3f6f78']

export function Bookshelf({ seed = 1 }: { seed?: number }) {
  const books = useMemo(() => {
    let h = hashStr(`shelf${seed}`)
    const next = () => { h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0; return h }
    const rows: { x: number; y: number; w: number; hh: number; c: string }[] = []
    for (const [y0, hh] of [[1, 7], [9, 7]] as const) {
      let x = 2
      while (x < 23) {
        const w = 2 + (next() % 2)
        const th = hh - (next() % 3 === 0 ? 1 : 0)
        if (x + w > 24) break
        rows.push({ x, y: y0 + (hh - th), w, hh: th, c: BOOK_COLS[next() % BOOK_COLS.length] })
        x += w
        if (next() % 6 === 0) x += 1
      }
    }
    return rows
  }, [seed])
  return (
    <svg {...svgProps(26, 17)}>
      <R x={0} y={0} w={26} h={17} c="#5a3820" />
      <R x={1} y={1} w={24} h={7} c="#2e1c10" />
      <R x={1} y={9} w={24} h={7} c="#2e1c10" />
      {books.map((b, i) => <g key={i}><R x={b.x} y={b.y} w={b.w} h={b.hh} c={b.c} /><R x={b.x} y={b.y} w={1} h={b.hh} c="#ffffff" o={0.18} /></g>)}
      <R x={0} y={0} w={26} h={1} c="#8a5a35" />
      <R x={0} y={8} w={26} h={1} c="#8a5a35" />
      <R x={0} y={16} w={26} h={1} c="#3b2414" />
    </svg>
  )
}

export function Whiteboard() {
  return (
    <svg {...svgProps(40, 18)}>
      <R x={0} y={0} w={40} h={18} c="#7b5636" />
      <R x={1} y={1} w={38} h={14} c="#f7f4ea" />
      <R x={1} y={1} w={38} h={1} c="#ffffff" />
      {/* diagram: boxes + arrows */}
      <R x={4} y={3} w={8} h={5} c="#d2693c" />
      <R x={5} y={4} w={6} h={3} c="#f7f4ea" />
      <R x={12} y={5} w={5} h={1} c="#2b2b33" />
      <R x={16} y={4} w={1} h={3} c="#2b2b33" />
      <R x={17} y={3} w={8} h={5} c="#4a86d8" />
      <R x={18} y={4} w={6} h={3} c="#f7f4ea" />
      <R x={25} y={5} w={4} h={1} c="#2b2b33" />
      <R x={29} y={3} w={7} h={5} c="#4f9b57" />
      <R x={30} y={4} w={5} h={3} c="#f7f4ea" />
      <R x={7} y={8} w={1} h={3} c="#2b2b33" />
      <R x={7} y={11} w={12} h={1} c="#2b2b33" />
      <R x={19} y={8} w={1} h={4} c="#2b2b33" />
      <R x={4} y={12} w={5} h={2} c="#e8c15a" />
      <R x={22} y={10} w={10} h={1} c="#c75a7a" />
      <R x={22} y={12} w={6} h={1} c="#c75a7a" />
      <R x={4} y={15} w={32} h={1} c="#b9b3a3" />
      <R x={6} y={16} w={3} h={1} c="#c0392b" /><R x={11} y={16} w={3} h={1} c="#2f5fa8" />
      <R x={4} y={17} w={32} h={1} c="#4a3220" />
    </svg>
  )
}

export function Pinboard() {
  return (
    <svg {...svgProps(30, 14)}>
      <R x={0} y={0} w={30} h={14} c="#7b5636" />
      <R x={1} y={1} w={28} h={12} c="#c79a62" />
      <R x={3} y={2} w={7} h={9} c="#f8f1dc" /><R x={4} y={4} w={5} h={1} c="#9a8f72" /><R x={4} y={6} w={4} h={1} c="#9a8f72" /><R x={6} y={1} w={1} h={2} c="#c0392b" />
      <R x={12} y={3} w={7} h={8} c="#f4d9a0" /><R x={13} y={5} w={5} h={1} c="#9a8f72" /><R x={15} y={2} w={1} h={2} c="#2f5fa8" />
      <R x={21} y={2} w={6} h={9} c="#e9f0d8" /><R x={22} y={4} w={4} h={1} c="#9a8f72" /><R x={22} y={7} w={3} h={1} c="#9a8f72" /><R x={23} y={1} w={1} h={2} c="#3f8f4a" />
    </svg>
  )
}

export function Window({ night = false }: { night?: boolean }) {
  return (
    <svg {...svgProps(22, 14)}>
      <R x={0} y={0} w={22} h={14} c="#f1e1bd" />
      <R x={2} y={2} w={18} h={10} c={night ? '#243457' : '#8fd0f0'} />
      <R x={2} y={7} w={18} h={5} c={night ? '#1d2a47' : '#bfe6f6'} />
      <R x={4} y={8} w={5} h={4} c={night ? '#2d3d63' : '#ffffff'} o={night ? 0.5 : 0.9} />
      <R x={13} y={9} w={5} h={3} c={night ? '#2d3d63' : '#ffffff'} o={night ? 0.5 : 0.9} />
      <R x={10} y={2} w={2} h={10} c="#f1e1bd" />
      <R x={2} y={6} w={18} h={1} c="#f1e1bd" />
      <R x={0} y={13} w={22} h={1} c="#c7a672" />
    </svg>
  )
}

export function Clock() {
  return (
    <svg {...svgProps(8, 8)}>
      <R x={1} y={0} w={6} h={8} c="#5a3820" /><R x={0} y={1} w={8} h={6} c="#5a3820" />
      <R x={1} y={1} w={6} h={6} c="#f8f1dc" />
      <R x={4} y={2} w={1} h={3} c="#2b1a12" /><R x={4} y={4} w={2} h={1} c="#2b1a12" />
    </svg>
  )
}

export function Frame({ kind = 0 }: { kind?: number }) {
  const sky = ['#8fd0f0', '#f4c98a', '#c9a0e8'][kind % 3]
  const hill = ['#5b9a68', '#b86a3a', '#4a6a8a'][kind % 3]
  return (
    <svg {...svgProps(10, 8)}>
      <R x={0} y={0} w={10} h={8} c="#5a3820" />
      <R x={1} y={1} w={8} h={6} c={sky} />
      <R x={1} y={4} w={8} h={3} c={hill} />
      <R x={2} y={2} w={2} h={1} c="#fff" />
      <R x={6} y={3} w={2} h={1} c={hill} />
    </svg>
  )
}

// ------------------------------------------------------------ floor stuff

export function Plant({ variant = 0 }: { variant?: number }) {
  const leaf = variant % 2 ? '#4f9a58' : '#3f8a4c'
  const leaf2 = variant % 2 ? '#7cc477' : '#63b36a'
  return (
    <svg {...svgProps(10, 16)}>
      <R x={4} y={0} w={2} h={2} c={leaf2} />
      <R x={2} y={2} w={6} h={2} c={leaf} /><R x={3} y={2} w={2} h={1} c={leaf2} />
      <R x={1} y={4} w={8} h={3} c={leaf} /><R x={2} y={4} w={2} h={1} c={leaf2} />
      <R x={0} y={6} w={3} h={2} c={leaf2} /><R x={7} y={6} w={3} h={2} c={leaf2} />
      <R x={2} y={7} w={6} h={2} c={leaf} />
      <R x={4} y={9} w={2} h={2} c="#3b5a2a" />
      <R x={1} y={11} w={8} h={1} c="#d98a5c" />
      <R x={2} y={12} w={6} h={4} c="#b8653a" />
      <R x={2} y={12} w={1} h={4} c="#d98a5c" />
      <R x={7} y={12} w={1} h={4} c="#8a4a2a" />
    </svg>
  )
}

export function PlantSm() {
  return (
    <svg {...svgProps(8, 10)}>
      <R x={3} y={0} w={2} h={2} c="#7cc477" />
      <R x={1} y={2} w={6} h={3} c="#4f9a58" /><R x={0} y={3} w={2} h={2} c="#7cc477" /><R x={6} y={3} w={2} h={2} c="#7cc477" />
      <R x={3} y={5} w={2} h={1} c="#3b5a2a" />
      <R x={1} y={6} w={6} h={4} c="#b8653a" /><R x={1} y={6} w={6} h={1} c="#d98a5c" />
    </svg>
  )
}

export function Lamp() {
  return (
    <svg {...svgProps(8, 24)}>
      <R x={1} y={0} w={6} h={2} c="#ffe9a8" />
      <R x={0} y={2} w={8} h={5} c="#f4c860" />
      <R x={1} y={2} w={2} h={5} c="#ffe08a" />
      <R x={6} y={3} w={1} h={4} c="#c9972c" />
      <R x={3} y={7} w={2} h={13} c="#5a4a3a" />
      <R x={1} y={20} w={6} h={2} c="#3b2a1d" />
      <R x={0} y={22} w={8} h={2} c="#2b1d13" />
    </svg>
  )
}

export function Glow({ r = 36, color = '255,214,120', a = 0.34 }: { r?: number; color?: string; a?: number }) {
  return (
    <div
      className="lamp-flick"
      style={{
        width: r * 2, height: r * 2, borderRadius: '50%', pointerEvents: 'none',
        background: `radial-gradient(circle, rgba(${color},${a}) 0%, rgba(${color},${a * 0.5}) 40%, rgba(${color},0) 70%)`,
        mixBlendMode: 'screen',
      }}
    />
  )
}

export function CoffeeMachine({ running }: { running: boolean }) {
  return (
    <svg {...svgProps(16, 20)}>
      <R x={1} y={0} w={14} h={14} c="#3a3f4a" />
      <R x={1} y={0} w={14} h={2} c="#58606e" />
      <R x={3} y={3} w={7} h={5} c="#1a1f28" />
      <R x={4} y={4} w={5} h={3} c={running ? '#7fe0a0' : '#2a3a34'} />
      <R x={11} y={4} w={3} h={1} c="#e0594a" /><R x={11} y={6} w={3} h={1} c="#e8c15a" />
      <R x={4} y={9} w={8} h={2} c="#1a1f28" />
      <R x={6} y={11} w={4} h={1} c="#2a2f38" />
      <R x={0} y={14} w={16} h={6} c="#2e323b" />
      <R x={5} y={14} w={6} h={5} c="#1a1f28" />
      <R x={6} y={16} w={4} h={3} c="#f6efe0" />
      <R x={7} y={16} w={2} h={1} c="#6b3a1e" />
      <g className="steam"><R x={7} y={13} w={1} h={2} c="#ffffff" o={0.7} /></g>
      <g className="steam" style={{ animationDelay: '0.9s' }}><R x={9} y={13} w={1} h={2} c="#ffffff" o={0.7} /></g>
    </svg>
  )
}

export function SofaBack({ w = 70 }: { w?: number }) {
  return (
    <svg {...svgProps(w, 20)}>
      <R x={1} y={0} w={w - 2} h={15} c="#3f7f73" />
      <R x={1} y={0} w={w - 2} h={2} c="#6bb09f" />
      <R x={0} y={6} w={7} h={14} c="#336b60" /><R x={w - 7} y={6} w={7} h={14} c="#336b60" />
      <R x={0} y={6} w={7} h={2} c="#4f9285" /><R x={w - 7} y={6} w={7} h={2} c="#4f9285" />
      {w > 40 && <><R x={Math.round(w * 0.34)} y={3} w={1} h={12} c="#336b60" /><R x={Math.round(w * 0.66)} y={3} w={1} h={12} c="#336b60" /></>}
      <R x={7} y={15} w={w - 14} h={5} c="#2d5c52" />
    </svg>
  )
}
export function SofaFront({ w = 70 }: { w?: number }) {
  return (
    <svg {...svgProps(w, 10)}>
      <R x={6} y={0} w={w - 12} h={6} c="#4f9285" />
      <R x={6} y={0} w={w - 12} h={1} c="#79bcab" />
      {w > 40 && <><R x={Math.round(w * 0.34)} y={1} w={1} h={5} c="#336b60" /><R x={Math.round(w * 0.66)} y={1} w={1} h={5} c="#336b60" /></>}
      <R x={0} y={0} w={7} h={9} c="#3f7f73" /><R x={w - 7} y={0} w={7} h={9} c="#3f7f73" />
      <R x={0} y={0} w={7} h={2} c="#6bb09f" /><R x={w - 7} y={0} w={7} h={2} c="#6bb09f" />
      <R x={0} y={6} w={w} h={3} c="#2d5c52" />
      <R x={2} y={9} w={3} h={1} c="#2b1d13" /><R x={w - 5} y={9} w={3} h={1} c="#2b1d13" />
    </svg>
  )
}

export function BeanBag({ color = '#e0a23c' }: { color?: string }) {
  return (
    <svg {...svgProps(18, 10)}>
      <R x={3} y={0} w={12} h={2} c={color} /><R x={1} y={2} w={16} h={5} c={color} /><R x={0} y={4} w={18} h={4} c={color} /><R x={2} y={8} w={14} h={2} c="#a8741f" />
      <R x={4} y={1} w={6} h={1} c="#ffffff" o={0.3} />
      <R x={1} y={7} w={16} h={1} c="#a8741f" />
    </svg>
  )
}

export function Cat() {
  const art = [
    '.oo..oo.........',
    '.oOooOo.........',
    'ooooooooooooo...',
    'oeoooeooOoOooo..',
    'oonnooooooOoooo.',
    '.wooooooOooOooo.',
    '..wwooooooooooo.',
    '...wwoooooooooo.',
    '....wwwwoooooo..',
  ]
  const pal = { o: '#e39a4a', O: '#b8651f', w: '#fff1d6', e: '#3a2218', n: '#f08a8a' }
  return (
    <div style={{ position: 'relative', width: 16, height: 10 }}>
      <Px art={art} pal={pal} />
      <svg {...svgProps(16, 10)} className="cat-tail" style={{ position: 'absolute', left: 0, top: 0 }}>
        <R x={13} y={7} w={3} h={1} c="#e39a4a" /><R x={14} y={8} w={2} h={1} c="#b8651f" /><R x={15} y={6} w={1} h={1} c="#b8651f" />
      </svg>
    </div>
  )
}

export function CatBed({ w = 24 }: { w?: number }) {
  return (
    <svg {...svgProps(w, 8)}>
      <R x={1} y={0} w={w - 2} h={2} c="#a8553a" />
      <R x={0} y={2} w={w} h={5} c="#c4623a" />
      <R x={2} y={2} w={w - 4} h={3} c="#e8b48a" />
      <R x={1} y={7} w={w - 2} h={1} c="#7a3a22" />
    </svg>
  )
}

export function Rug({ w, h, a, b, c }: { w: number; h: number; a: string; b: string; c: string }) {
  const dots = []
  for (let y = 8; y < h - 6; y += 8) {
    for (let x = 6; x < w - 5; x += 8) dots.push(<R key={`${x}-${y}`} x={x} y={y} w={2} h={2} c={c} o={0.55} />)
  }
  return (
    <svg {...svgProps(w, h)}>
      <R x={0} y={1} w={w} h={h - 2} c={a} />
      <R x={1} y={0} w={w - 2} h={h} c={a} />
      <R x={2} y={2} w={w - 4} h={h - 4} c={b} />
      <R x={3} y={3} w={w - 6} h={1} c={c} o={0.7} />
      <R x={3} y={h - 4} w={w - 6} h={1} c={c} o={0.7} />
      <R x={3} y={3} w={1} h={h - 6} c={c} o={0.7} />
      <R x={w - 4} y={3} w={1} h={h - 6} c={c} o={0.7} />
      {dots}
    </svg>
  )
}

export function Bench() {
  return (
    <svg {...svgProps(30, 12)}>
      <R x={0} y={0} w={30} h={3} c="#8a5530" /><R x={0} y={0} w={30} h={1} c="#b97b44" />
      <R x={1} y={4} w={28} h={3} c="#a8683a" /><R x={1} y={4} w={28} h={1} c="#d9a066" />
      <R x={2} y={7} w={2} h={5} c="#3b2414" /><R x={26} y={7} w={2} h={5} c="#3b2414" />
    </svg>
  )
}

export function Cooler() {
  return (
    <svg {...svgProps(8, 20)}>
      <R x={1} y={0} w={6} h={7} c="#a8dcf0" /><R x={2} y={1} w={2} h={4} c="#ffffff" o={0.5} />
      <R x={0} y={7} w={8} h={13} c="#e8e4da" /><R x={0} y={7} w={8} h={1} c="#ffffff" />
      <R x={2} y={10} w={2} h={1} c="#4a86d8" /><R x={4} y={10} w={2} h={1} c="#d2693c" />
      <R x={2} y={12} w={4} h={2} c="#b9b3a3" />
    </svg>
  )
}

export function Printer() {
  return (
    <svg {...svgProps(14, 12)}>
      <R x={3} y={0} w={8} h={3} c="#f8f1dc" />
      <R x={0} y={3} w={14} h={7} c="#9aa3b2" /><R x={0} y={3} w={14} h={1} c="#c5ccd8" />
      <R x={2} y={5} w={6} h={1} c="#3a4252" /><R x={10} y={5} w={2} h={2} c="#7fe0a0" />
      <R x={1} y={10} w={12} h={2} c="#5a6272" />
    </svg>
  )
}

export function Bin() {
  return (
    <svg {...svgProps(6, 8)}>
      <R x={0} y={0} w={6} h={1} c="#8a8f98" /><R x={1} y={1} w={4} h={7} c="#646a73" /><R x={2} y={0} w={2} h={1} c="#f8f1dc" />
    </svg>
  )
}

export function Globe() {
  return (
    <svg {...svgProps(10, 14)}>
      <R x={2} y={0} w={6} h={1} c="#c9972c" /><R x={1} y={1} w={8} h={6} c="#4a86d8" /><R x={0} y={2} w={10} h={4} c="#4a86d8" />
      <R x={2} y={2} w={3} h={2} c="#5b9a68" /><R x={6} y={4} w={2} h={2} c="#5b9a68" />
      <R x={4} y={7} w={2} h={4} c="#c9972c" /><R x={2} y={11} w={6} h={1} c="#8a5530" /><R x={1} y={12} w={8} h={2} c="#5a3820" />
    </svg>
  )
}

export function Crates() {
  return (
    <svg {...svgProps(16, 12)}>
      <R x={0} y={4} w={10} h={8} c="#b97b44" /><R x={0} y={4} w={10} h={1} c="#d9a066" /><R x={4} y={4} w={1} h={8} c="#8a5530" /><R x={0} y={8} w={10} h={1} c="#8a5530" />
      <R x={8} y={0} w={8} h={7} c="#c98b52" /><R x={8} y={0} w={8} h={1} c="#e0a96b" /><R x={11} y={0} w={1} h={7} c="#8a5530" />
      <R x={9} y={7} w={7} h={5} c="#a8683a" />
    </svg>
  )
}

export function CoatRack() {
  return (
    <svg {...svgProps(8, 22)}>
      <R x={3} y={0} w={2} h={19} c="#5a3820" />
      <R x={0} y={2} w={3} h={1} c="#5a3820" /><R x={5} y={2} w={3} h={1} c="#5a3820" />
      <R x={0} y={3} w={3} h={8} c="#c4623a" /><R x={5} y={3} w={3} h={6} c="#4a86d8" />
      <R x={1} y={19} w={6} h={3} c="#3b2414" />
    </svg>
  )
}

// ------------------------------------------------------------ outdoors

export function Tree({ variant = 0 }: { variant?: number }) {
  const a = variant ? '#4f9a58' : '#3f8a4c'
  const b = variant ? '#7cc477' : '#63b36a'
  return (
    <svg {...svgProps(28, 34)}>
      <R x={10} y={0} w={8} h={3} c={a} />
      <R x={5} y={3} w={18} h={4} c={a} /><R x={2} y={7} w={24} h={6} c={a} /><R x={0} y={13} w={28} h={7} c={a} /><R x={3} y={20} w={22} h={4} c={a} />
      <R x={9} y={2} w={5} h={2} c={b} /><R x={5} y={7} w={7} h={2} c={b} /><R x={3} y={13} w={6} h={2} c={b} /><R x={14} y={14} w={5} h={2} c={b} /><R x={6} y={20} w={5} h={2} c="#2f6a3a" />
      <R x={12} y={24} w={4} h={8} c="#6a4326" /><R x={12} y={24} w={1} h={8} c="#8a5a35" />
      <R x={9} y={32} w={10} h={2} c="#000000" o={0.2} />
    </svg>
  )
}

export function Bush() {
  return (
    <svg {...svgProps(16, 10)}>
      <R x={3} y={0} w={10} h={2} c="#3f8a4c" /><R x={1} y={2} w={14} h={5} c="#3f8a4c" /><R x={0} y={4} w={16} h={4} c="#4f9a58" />
      <R x={3} y={2} w={3} h={1} c="#7cc477" /><R x={9} y={4} w={3} h={1} c="#7cc477" />
      <R x={2} y={8} w={12} h={2} c="#000000" o={0.2} />
    </svg>
  )
}

export function Flowers({ c = '#f4a0b8' }: { c?: string }) {
  return (
    <svg {...svgProps(8, 6)}>
      <R x={1} y={1} w={1} h={1} c={c} /><R x={1} y={2} w={1} h={3} c="#3f8a4c" />
      <R x={4} y={0} w={1} h={1} c="#f4e27a" /><R x={4} y={1} w={1} h={4} c="#3f8a4c" />
      <R x={6} y={2} w={1} h={1} c="#ffffff" /><R x={6} y={3} w={1} h={2} c="#3f8a4c" />
    </svg>
  )
}

export function LampPost() {
  return (
    <svg {...svgProps(8, 30)}>
      <R x={1} y={0} w={6} h={5} c="#ffe9a8" /><R x={0} y={0} w={8} h={1} c="#3a3f4a" /><R x={0} y={5} w={8} h={1} c="#3a3f4a" />
      <R x={3} y={6} w={2} h={21} c="#3a3f4a" /><R x={1} y={27} w={6} h={3} c="#2a2f38" />
    </svg>
  )
}
