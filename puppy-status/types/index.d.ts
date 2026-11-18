/** This computer's memory, as Activity Monitor counts "Memory Used". */
export type Ram = {
  usedGb: number
  totalGb: number
  percent: number
  pressure: 'normal' | 'warn' | 'critical'
}

/** One plan usage window (five_hour, seven_day, ...). */
export type Limit = { kind: string; percent: number; resetsAt?: string }

/** The session's context fill, usage windows and cost. */
export type Usage = {
  contextPercent?: number
  contextTokens?: number
  contextWindow: number
  limits: Limit[]
  costUsd?: number
}

/** A treat the dog can be given; one is picked at random each time. */
export type Treat = 'bone' | 'cookie' | 'meat'

/** The dog is eating `treat` until `until` ($.clock.now() milliseconds). */
export type Feeding = { treat: Treat; until: number }

/** How full the dog was at `at`; kept in $.store, shared by every session. */
export type Belly = { value: number; at: number }

declare module 'claude-code' {
  interface PluginState {
    'puppy-status': {
      ram: Shaped<Ram | null>
      ramError: boolean
      usage: Shaped<Usage | null>
      /** The person closed the band in this session (/puppy brings it back). */
      isHidden: boolean
      /** How full the dog is now, 0 to 100, as the band shows it. */
      fullness: number | null
      /** The treat being eaten right now, if any. */
      feeding: Shaped<Feeding | null>
    }
  }
}
