import { memo, useMemo } from 'react'
import { Px, type Palette } from './Px'
import type { Outfit } from '../layout'

export type Pose =
  | 'stand' | 'walk' | 'walkSide'
  | 'sitType' | 'cheer' | 'sleep'
  | 'sit' | 'sad'

export interface Look {
  hair: string
  skin: string
  outfit: Outfit
  style: number // 0 short, 1 long, 2 spiky
  glasses?: boolean
}

const shade = (hex: string, k: number): string => {
  const n = parseInt(hex.slice(1), 16)
  const f = (v: number) => Math.max(0, Math.min(255, Math.round(v * k)))
  const r = f((n >> 16) & 255), g = f((n >> 8) & 255), b = f(n & 255)
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`
}

const HEAD_FRONT = [
  '...hhhhhh...',
  '..hhhhhhhh..',
  '..hhhhhhhh..',
  '..hhsssshh..',
  '..ssessess..',
  '..ssssssss..',
  '...ssmmss...',
  '....sSSs....',
]
const BODY_FRONT = [
  '.oooaaaaooo.',
  'oooooaaooooo',
  'oOooooooooOo',
  'oOooooooooOo',
  'oOooooooooOo',
  'ssOooooooOss',
]
const LEGS = {
  stand: ['..pppppppp..', '..ppp..ppp..', '..ppp..ppp..', '..ppp..ppp..', '..bbb..bbb..', '..bbb..bbb..'],
  walkA: ['..pppppppp..', '..ppp..ppp..', '..ppp..ppp..', '..ppp..pp...', '..bbb..bb...', '..bbb.......'],
  walkB: ['..pppppppp..', '..ppp..ppp..', '..ppp..ppp..', '...pp..ppp..', '...bb..bbb..', '.......bbb..'],
  sit: ['..pppppppp..', '..pppppppp..', '..bbbbbbbb..'],
}

const HEAD_BACK = [
  '...hhhhhh...',
  '..hhhhhhhh..',
  '..hhhhhhhh..',
  '..hhhhhhhh..',
  '..hhhHHhhh..',
  '..hhhhhhhh..',
  '...hhhhhh...',
  '....ssss....',
]
const BODY_BACK = [
  '.oooooooooo.',
  'oooooooooooo',
  'oOooooooooOo',
  'oOooooooooOo',
]

function front(style: number, glasses: boolean | undefined, mood: 'n' | 'sad', legs: string[]): string[] {
  const head = [...HEAD_FRONT]
  if (style === 1) {
    head[4] = '..hsessesh..'; head[5] = '..hssssssh..'; head[6] = '..hhsmmshh..'; head[7] = '..h.sSSs.h..'
  } else if (style === 2) {
    head[0] = '..h.hhhh.h..'; head[1] = '.hhhhhhhhhh.'
  }
  if (glasses) head[4] = '..sgeggegs..'
  if (mood === 'sad') { head[5] = style === 1 ? '..hscsscsh..' : '..sscsscss..'; head[6] = '...smssms...' }
  return [...head, ...BODY_FRONT, ...legs]
}

function sideArt(frameB: boolean, style: number): string[] {
  const head = [
    '...hhhhhh...',
    '..hhhhhhhh..',
    '..hhhhhhhh..',
    '..hhhsssss..',
    '..hhhsssess.',
    '..hhhssssss.',
    '...hhssssm..',
    '.....sSs....',
  ]
  if (style === 1) { head[5] = '..hhhssssss.'; head[6] = '..hhhssssm..'; head[7] = '..hh.sSs....' }
  const body = [
    '....oooooo..',
    '....oooooo..',
    '....ooOOoo..',
    '....ooOOoo..',
    '....oooooo..',
    '....ooooos..',
  ]
  const legs = frameB
    ? ['....pppppp..', '...pp..ppp..', '...pp..ppp..', '...pp...pp..', '...bb...bbb.', '...bbb......']
    : ['....pppppp..', '...ppp.ppp..', '..ppp...pp..', '..ppp...pp..', '..bbb...bb..', '..bbb..bbb..']
  return [...head, ...body, ...legs]
}

function back(pose: 'sitType' | 'cheer' | 'sleep', frameB: boolean, style: number): string[] {
  const head = [...HEAD_BACK]
  if (style === 1) { head[6] = '..hhhhhhhh..'; head[7] = '..hhhssshh..' }
  if (pose === 'sitType') {
    const b = [...BODY_BACK, frameB ? 'OOooooooooss' : 'ssooooooooOO', '..oooooooo..']
    return [...head, ...b]
  }
  if (pose === 'cheer') {
    const h = [...head]
    h[2] = 's.hhhhhhhh.s'; h[3] = 'o.hhhhhhhh.o'; h[4] = 'o.hhhHHhhh.o'; h[5] = 'o.hhhhhhhh.o'
    h[6] = 'oo.hhhhhh.oo'; h[7] = '.oo.ssss.oo.'
    return [...h, ...BODY_BACK, 'OOooooooooOO', '..oooooooo..']
  }
  // sleep: head dropped onto the desk
  return [
    '............',
    '............',
    '...hhhhhh...',
    '..hhhhhhhh..',
    '..hhhHHhhh..',
    '..hhhhhhhh..',
    '.ooohhhhooo.',
    'oooooooooooo',
    'oOooooooooOo',
    'oOooooooooOo',
    'ssooooooooss',
    '..oooooooo..',
    '............',
    '............',
  ]
}

export function artFor(pose: Pose, frame: number, look: Look): string[] {
  const b = frame % 2 === 1
  switch (pose) {
    case 'walk': return front(look.style, look.glasses, 'n', b ? LEGS.walkB : LEGS.walkA)
    case 'walkSide': return sideArt(b, look.style)
    case 'sit': return front(look.style, look.glasses, 'n', LEGS.sit)
    case 'sad': return front(look.style, look.glasses, 'sad', LEGS.stand)
    case 'sitType': return back('sitType', b, look.style)
    case 'cheer': return back('cheer', b, look.style)
    case 'sleep': return back('sleep', b, look.style)
    default: return front(look.style, look.glasses, 'n', LEGS.stand)
  }
}

export const palFor = (look: Look): Palette => ({
  h: look.hair, H: shade(look.hair, 0.7),
  s: look.skin, S: shade(look.skin, 0.82),
  e: '#2b1a12', g: '#2b1a12', m: shade(look.skin, 0.62), c: '#7fc4ff',
  o: look.outfit.main, O: look.outfit.shade, a: look.outfit.accent,
  p: look.outfit.pants, P: shade(look.outfit.pants, 0.8), b: look.outfit.shoes, w: '#ffffff',
})

export const spriteSize = (pose: Pose): { w: number; h: number } => {
  switch (pose) {
    case 'sitType': case 'cheer': case 'sleep': return { w: 12, h: 14 }
    case 'sit': return { w: 12, h: 17 }
    default: return { w: 12, h: 20 }
  }
}

export const Sprite = memo(function Sprite({ pose, frame, look }: { pose: Pose; frame: number; look: Look }) {
  const art = useMemo(() => artFor(pose, frame, look), [pose, frame, look])
  const pal = useMemo(() => palFor(look), [look])
  return <Px art={art} pal={pal} />
})
