export type Status = 'queued' | 'running' | 'done' | 'failed'

export interface Task {
  id: string
  title: string
  agent: string
  account?: string | null
  status: Status
  created: number
  updated?: number | null
  finished?: number | null
  result?: string | null
  repo?: string | null
  t3_task?: string | null
}

export interface Meter {
  pct: number | null
  resets: number | null
}

export interface PoolBudget {
  role?: string
  five_hour?: Meter | null
  seven_day?: Meter | null
  blocked?: boolean
  active?: number
}

export interface AgyQuota {
  week: number | null
  five: number | null
}

export interface AgyAccount {
  name: string
  enabled?: boolean
  needs_login?: boolean
  gemini?: AgyQuota | null
  claude?: AgyQuota | null
}

export interface Budget {
  main?: PoolBudget | null
  second?: PoolBudget | null
  agy?: AgyAccount[] | null
}

export interface Session {
  id: string
  account: string
  project: string
  title: string
  status: 'working' | 'idle'
  manager: boolean
  updated: number
}

export interface OfficeState {
  now: number
  manager: { active: boolean; last_seen?: number | null }
  tasks: Task[]
  budget: Budget
  sessions?: Session[]
}
