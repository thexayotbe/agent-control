import type { RoomId } from '../layout'

export interface RoomStyle {
  floor: string
  wall: string
  wallStripe: string
  base: string
  rug: [string, string, string]
  wood: [string, string, string]
  accent: string
}

export const ROOM_STYLE: Record<RoomId, RoomStyle> = {
  library:   { floor: 'fl-woodDark',  wall: '#6d4d37', wallStripe: '#5f4330', base: '#3b2418', rug: ['#7a2f2f', '#a34545', '#e0b86a'], wood: ['#c98b52', '#9a6234', '#6e4223'], accent: '#7fd0ff' },
  workshop:  { floor: 'fl-woodLight', wall: '#ecd7aa', wallStripe: '#e0c78f', base: '#8a5a33', rug: ['#3f6f78', '#5a949c', '#d8e8d0'], wood: ['#dba96e', '#b97b44', '#8a5530'], accent: '#7fe39a' },
  architect: { floor: 'fl-carpet',    wall: '#7088a6', wallStripe: '#657d9b', base: '#35465e', rug: ['#2f3f5a', '#4a5f80', '#e8c15a'], wood: ['#c4955f', '#946238', '#6a4426'], accent: '#ffcf70' },
  review:    { floor: 'fl-tile',      wall: '#a0b48c', wallStripe: '#93a880', base: '#4f6040', rug: ['#6a4a8a', '#8d6ab0', '#e8dcf8'], wood: ['#d9a066', '#b97b44', '#8a5530'], accent: '#ff9ac0' },
  scout:     { floor: 'fl-woodPale',  wall: '#dcb892', wallStripe: '#d1ab84', base: '#8a5a33', rug: ['#4f9b57', '#74bb7a', '#e0f2d0'], wood: ['#e0b886', '#c0894f', '#8f5d33'], accent: '#e8f4ff' },
  lounge:    { floor: 'fl-woodWarm',  wall: '#b8695a', wallStripe: '#ab5d4f', base: '#5e2f26', rug: ['#c4623a', '#e8a070', '#f6e7c1'], wood: ['#d9a066', '#b97b44', '#8a5530'], accent: '#ffe08a' },
  chat:      { floor: 'fl-woodWarm',  wall: '#c2724f', wallStripe: '#b36340', base: '#6e3822', rug: ['#d2693c', '#e68a5c', '#fce2c8'], wood: ['#dba96e', '#b97b44', '#8a5530'], accent: '#f4c9a0' },
}

/** One shared <defs>; patterns are in art-pixel units so they stay crisp under the stage scale. */
export function FloorDefs() {
  const plank = (id: string, w: number, h: number, a: string, b: string, line: string, grain: string) => (
    <pattern id={id} width={w} height={h * 2} patternUnits="userSpaceOnUse">
      <rect width={w} height={h} fill={a} />
      <rect y={h} width={w} height={h} fill={b} />
      <rect y={h - 1} width={w} height={1} fill={line} />
      <rect y={h * 2 - 1} width={w} height={1} fill={line} />
      <rect x={Math.round(w * 0.3)} y={0} width={1} height={h - 1} fill={line} />
      <rect x={Math.round(w * 0.75)} y={h} width={1} height={h - 1} fill={line} />
      <rect x={4} y={2} width={5} height={1} fill={grain} />
      <rect x={Math.round(w * 0.5)} y={h + 2} width={6} height={1} fill={grain} />
    </pattern>
  )
  return (
    <svg width={0} height={0} style={{ position: 'absolute' }} aria-hidden>
      <defs>
        {plank('fl-woodDark', 32, 6, '#7d4c2e', '#734327', '#5e3520', '#8d5a38')}
        {plank('fl-woodLight', 32, 6, '#d29a60', '#c98e55', '#b07a45', '#dfa96f')}
        {plank('fl-woodPale', 32, 6, '#dcba88', '#d3b07c', '#bd9a68', '#e7c898')}
        {plank('fl-woodWarm', 32, 6, '#bf7d45', '#b57239', '#9a5f2d', '#cc8c52')}
        <pattern id="fl-carpet" width={8} height={8} patternUnits="userSpaceOnUse">
          <rect width={8} height={8} fill="#44587a" />
          <rect x={0} y={0} width={4} height={4} fill="#4b6085" />
          <rect x={4} y={4} width={4} height={4} fill="#4b6085" />
          <rect x={2} y={2} width={1} height={1} fill="#5d7499" />
          <rect x={6} y={6} width={1} height={1} fill="#5d7499" />
        </pattern>
        <pattern id="fl-tile" width={16} height={16} patternUnits="userSpaceOnUse">
          <rect width={16} height={16} fill="#eadfbf" />
          <rect width={8} height={8} fill="#cfdcae" />
          <rect x={8} y={8} width={8} height={8} fill="#cfdcae" />
          <rect x={7} y={0} width={1} height={16} fill="#000" opacity={0.06} />
          <rect x={0} y={7} width={16} height={1} fill="#000" opacity={0.06} />
        </pattern>
        <pattern id="fl-hall" width={16} height={16} patternUnits="userSpaceOnUse">
          <rect width={16} height={16} fill="#d9c8a6" />
          <rect width={8} height={8} fill="#cfbd99" />
          <rect x={8} y={8} width={8} height={8} fill="#cfbd99" />
          <rect x={0} y={7} width={16} height={1} fill="#b9a780" opacity={0.7} />
          <rect x={7} y={0} width={1} height={16} fill="#b9a780" opacity={0.7} />
          <rect x={3} y={3} width={1} height={1} fill="#e6d8b9" />
          <rect x={11} y={11} width={1} height={1} fill="#e6d8b9" />
        </pattern>
        <pattern id="fl-grass" width={24} height={24} patternUnits="userSpaceOnUse">
          <rect width={24} height={24} fill="#5f8f3f" />
          <rect x={3} y={4} width={1} height={2} fill="#79ad52" /><rect x={4} y={5} width={1} height={1} fill="#79ad52" />
          <rect x={15} y={9} width={1} height={2} fill="#4f7d34" /><rect x={16} y={10} width={1} height={1} fill="#4f7d34" />
          <rect x={9} y={18} width={1} height={2} fill="#79ad52" /><rect x={10} y={19} width={1} height={1} fill="#79ad52" />
          <rect x={20} y={20} width={1} height={1} fill="#f4e27a" />
          <rect x={6} y={13} width={1} height={1} fill="#ffffff" />
        </pattern>
        <pattern id="fl-path" width={12} height={12} patternUnits="userSpaceOnUse">
          <rect width={12} height={12} fill="#cdb68a" />
          <rect x={0} y={5} width={12} height={1} fill="#b59d70" />
          <rect x={5} y={0} width={1} height={5} fill="#b59d70" />
          <rect x={10} y={6} width={1} height={6} fill="#b59d70" />
        </pattern>
        {(['library', 'workshop', 'architect', 'review', 'scout', 'lounge'] as RoomId[]).map((r) => (
          <pattern key={r} id={`wall-${r}`} width={8} height={16} patternUnits="userSpaceOnUse">
            <rect width={8} height={16} fill={ROOM_STYLE[r].wall} />
            <rect x={0} width={4} height={16} fill={ROOM_STYLE[r].wallStripe} />
          </pattern>
        ))}
      </defs>
    </svg>
  )
}
