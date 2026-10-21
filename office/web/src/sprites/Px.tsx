import type { CSSProperties, ReactNode } from 'react'

export type Palette = Record<string, string>

interface PxProps {
  art: string[]
  pal: Palette
  /** integer multiplier on top of the stage scale (normally 1) */
  scale?: number
  className?: string
  style?: CSSProperties
}

/** Pixel art from ASCII rows. '.' is transparent. Horizontal runs are merged. */
export function pixelRects(art: string[], pal: Palette): ReactNode[] {
  const out: ReactNode[] = []
  art.forEach((row, y) => {
    let x = 0
    while (x < row.length) {
      const ch = row[x]
      if (ch === '.' || ch === ' ' || !pal[ch]) { x++; continue }
      let n = 1
      while (x + n < row.length && row[x + n] === ch) n++
      out.push(<rect key={`${x}-${y}`} x={x} y={y} width={n} height={1} fill={pal[ch]} />)
      x += n
    }
  })
  return out
}

export function Px({ art, pal, scale = 1, className, style }: PxProps) {
  const w = Math.max(...art.map((r) => r.length))
  const h = art.length
  return (
    <svg
      width={w * scale}
      height={h * scale}
      viewBox={`0 0 ${w} ${h}`}
      shapeRendering="crispEdges"
      className={className}
      style={style}
    >
      {pixelRects(art, pal)}
    </svg>
  )
}

/** small helper for hand-placed rects */
export function R(props: { x: number; y: number; w: number; h: number; c: string; o?: number; className?: string }) {
  return <rect x={props.x} y={props.y} width={props.w} height={props.h} fill={props.c} opacity={props.o} className={props.className} />
}
