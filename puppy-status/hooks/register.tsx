import { atom, read, update } from 'claude-code'
import type {
  EngineInterface,
  Register,
  SessionContextUsage,
  SessionCost,
  SessionRateLimit,
} from 'claude-code'

import type { Belly, Feeding, Limit, Ram, Treat, Usage } from '../types'
import { DOG_SVG, EAT_MS, YARD } from './dog-art'
import type { DogMood } from './dog-art'

// Change a tag when that value's fields change: it declines what an earlier
// version stored, which outlives a reload.
const ram = atom({ plugin: 'puppy-status', key: 'ram' } as const, null, { shape: 'ram-1' })
const ramError = atom({ plugin: 'puppy-status', key: 'ramError' } as const, false)
const usage = atom({ plugin: 'puppy-status', key: 'usage' } as const, null, {
  shape: 'usage-1',
})
// Per session: closing the band here leaves every other session's dog alone.
const isHidden = atom({ plugin: 'puppy-status', key: 'isHidden' } as const, false)
const fullness = atom({ plugin: 'puppy-status', key: 'fullness' } as const, null)
const feeding = atom({ plugin: 'puppy-status', key: 'feeding' } as const, null, {
  shape: 'feeding-1',
})

const RAM_EVERY_MS = 5000
const BELLY_EVERY_MS = 30_000
const DOG_SCALE = 1.1

// The dog's belly lives in $.store, so every session shows the same dog.
const BELLY_KEY = 'belly'
const BELLY_START = 80
const EMPTIES_IN_HOURS = 8 // full to empty with no treat
const TREAT_FILLS = 25
const HUNGRY_BELOW = 20

const TREATS: readonly Treat[] = ['bone', 'cookie', 'meat']
const TREAT_NAMES: Record<Treat, string> = { bone: '뼈다귀', cookie: '쿠키', meat: '육포' }

type Level = 'ok' | 'warn' | 'bad' | 'none'

// The dog's own coat, from its sprite palette: the treat chip wears it.
const DOG_BROWN = { fill: '#bc6b3e', edge: '#99562f', hover: '#ab5e33', text: '#fbece2' }

const LEVEL_HEX: Record<Level, string> = {
  ok: '#4caf7a',
  warn: '#e0a030',
  bad: '#e5534b',
  none: '#9a9a9a',
}

// ---------------------------------------------------------------- reading

async function readRam($: EngineInterface): Promise<Ram | null> {
  const run = (argv: string[]) => $.process.run(argv, { timeoutMs: 5000 })
  const [vm, size, level] = await Promise.all([
    run(['/usr/bin/vm_stat']),
    run(['/usr/sbin/sysctl', '-n', 'hw.memsize']),
    run(['/usr/sbin/sysctl', '-n', 'kern.memorystatus_vm_pressure_level']),
  ])
  if (vm.exitCode !== 0 || size.exitCode !== 0) {
    return null
  }
  const pageSize = Number(/page size of (\d+) bytes/.exec(vm.stdout)?.[1] ?? 4096)
  const pages = (label: string) =>
    Number(new RegExp(`^${label}:\\s+(\\d+)`, 'm').exec(vm.stdout)?.[1] ?? 0)
  // Activity Monitor's "Memory Used": app memory + wired + compressed.
  const app = Math.max(0, pages('Anonymous pages') - pages('Pages purgeable'))
  const usedBytes = (app + pages('Pages wired down') + pages('Pages occupied by compressor')) * pageSize
  const totalBytes = Number(size.stdout.trim())
  if (!(totalBytes > 0)) {
    return null
  }
  const gb = (bytes: number) => Math.round((bytes / 1024 ** 3) * 10) / 10
  const pressureLevel = Number(level.stdout.trim())

  return {
    usedGb: gb(usedBytes),
    totalGb: Math.round(totalBytes / 1024 ** 3),
    percent: Math.min(100, Math.round((usedBytes / totalBytes) * 100)),
    pressure: pressureLevel >= 4 ? 'critical' : pressureLevel >= 2 ? 'warn' : 'normal',
  }
}

async function refreshRam($: EngineInterface): Promise<void> {
  let next: Ram | null = null
  try {
    next = await readRam($)
  } catch {
    next = null
  }
  if (next === null) {
    if (!(await read($, ramError))) {
      await update($, ramError, () => true)
    }
    return
  }
  const prev = await read($, ram)
  if (JSON.stringify(prev) !== JSON.stringify(next)) {
    const value = next
    await update($, ram, () => value)
  }
  if (await read($, ramError)) {
    await update($, ramError, () => false)
  }
}

function toUsage(
  context: SessionContextUsage,
  rateLimits: readonly SessionRateLimit[],
  cost: SessionCost | undefined,
): Usage {
  const limits: Limit[] = rateLimits.map(one => ({
    kind: one.kind,
    percent: Math.round(one.percentUsed),
    ...(one.resetsAt === undefined ? {} : { resetsAt: one.resetsAt }),
  }))

  return {
    contextWindow: context.window,
    ...(context.percent === undefined ? {} : { contextPercent: context.percent }),
    ...(context.tokens === undefined ? {} : { contextTokens: context.tokens }),
    limits,
    ...(cost === undefined ? {} : { costUsd: Math.round(cost.usd * 100) / 100 }),
  }
}

async function setUsage($: EngineInterface, next: Usage): Promise<void> {
  const prev = await read($, usage)
  if (JSON.stringify(prev) !== JSON.stringify(next)) {
    await update($, usage, () => next)
  }
}

async function refreshUsage($: EngineInterface): Promise<void> {
  try {
    const u = await $.session.usage()
    await setUsage($, toUsage(u.context, u.rateLimits, u.cost))
  } catch {
    // The figures come back with the next measurement.
  }
}

// ---------------------------------------------------------------- belly

function isBelly(value: unknown): value is Belly {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as Belly).value === 'number' &&
    typeof (value as Belly).at === 'number'
  )
}

/** The belly as stored, or a fresh one the first time any session asks. */
async function loadBelly($: EngineInterface, now: number): Promise<Belly> {
  const stored = await $.store.get(BELLY_KEY)
  if (isBelly(stored)) {
    return stored
  }
  const fresh: Belly = { value: BELLY_START, at: now }
  await $.store.set(BELLY_KEY, fresh)
  return fresh
}

function bellyAt(belly: Belly, now: number): number {
  const hours = Math.max(0, now - belly.at) / 3_600_000
  return Math.min(100, Math.max(0, belly.value - (100 / EMPTIES_IN_HOURS) * hours))
}

async function showFullness($: EngineInterface, value: number): Promise<void> {
  const shown = Math.round(value)
  if ((await read($, fullness)) !== shown) {
    await update($, fullness, () => shown)
  }
}

async function refreshBelly($: EngineInterface): Promise<void> {
  try {
    const now = await $.clock.now()
    await showFullness($, bellyAt(await loadBelly($, now), now))
    const eating = await read($, feeding)
    if (eating !== null && eating.until <= now) {
      await update($, feeding, () => null)
    }
  } catch {
    // The next tick tries again.
  }
}

/** Gives one random treat: the dog eats it unless it is already full. */
async function feed($: EngineInterface): Promise<void> {
  const now = await $.clock.now()
  const eating = await read($, feeding)
  if (eating !== null && eating.until > now) {
    return
  }
  const before = bellyAt(await loadBelly($, now), now)
  if (before >= 99.5) {
    $.ui.toast('배불러요! 조금 있다가 주세요 🐶')
    return
  }
  const after = Math.min(100, before + TREAT_FILLS)
  await $.store.set(BELLY_KEY, { value: after, at: now } satisfies Belly)
  await showFullness($, after)
  const treat = TREATS[Math.floor(Math.random() * TREATS.length)] ?? 'bone'
  const meal: Feeding = { treat, until: now + EAT_MS }
  await update($, feeding, () => meal)
  $.clock.after(EAT_MS, () => {
    void update($, feeding, value => (value !== null && value.until <= meal.until ? null : value))
  })
}

// ---------------------------------------------------------------- wording

function trimZero(text: string): string {
  return text.replace(/\.0$/, '')
}

function tokens(n: number): string {
  if (n >= 10000) {
    return `${trimZero((n / 10000).toFixed(1))}만`
  }
  if (n >= 1000) {
    return `${trimZero((n / 1000).toFixed(1))}천`
  }
  return String(n)
}

function untilText(resetsAt: string | undefined, now: number): string | undefined {
  if (resetsAt === undefined) {
    return undefined
  }
  const at = Date.parse(resetsAt)
  if (Number.isNaN(at)) {
    return undefined
  }
  const minutes = Math.max(0, Math.round((at - now) / 60000))
  const days = Math.floor(minutes / 1440)
  const hours = Math.floor((minutes % 1440) / 60)
  const mins = minutes % 60
  if (days > 0) {
    return hours > 0 ? `${days}일 ${hours}시간` : `${days}일`
  }
  if (hours > 0) {
    return mins > 0 ? `${hours}시간 ${mins}분` : `${hours}시간`
  }
  return `${mins}분`
}

const LIMIT_NAMES: Record<string, string> = {
  five_hour: '5시간',
  seven_day: '주간',
  seven_day_opus: '주간(Opus)',
  seven_day_sonnet: '주간(Sonnet)',
  spend_limit: '지출 한도',
}

function levelOf(percent: number, warnAt: number, badAt: number): Level {
  return percent >= badAt ? 'bad' : percent >= warnAt ? 'warn' : 'ok'
}

type Row = { label: string; percent: number; level: Level; value: string }

function ramRow(r: Ram | null, isError: boolean): Row {
  if (r === null) {
    return {
      label: 'RAM',
      percent: 0,
      level: 'none',
      value: isError ? '이 컴퓨터에서는 읽을 수 없어요' : '확인하는 중…',
    }
  }
  const word = r.pressure === 'critical' ? '부족' : r.pressure === 'warn' ? '빠듯' : '여유'
  const level: Level = r.pressure === 'critical' ? 'bad' : r.pressure === 'warn' ? 'warn' : 'ok'

  return {
    label: 'RAM',
    percent: r.percent,
    level,
    value: `${r.usedGb.toFixed(1)} / ${r.totalGb} GB · ${r.percent}% · ${word}`,
  }
}

function contextRow(u: Usage | null): Row {
  if (u === null || u.contextPercent === undefined) {
    const max = u === null ? '' : ` · 최대 ${tokens(u.contextWindow)} 토큰`
    return { label: '컨텍스트', percent: 0, level: 'none', value: `첫 답변 뒤에 보여요${max}` }
  }
  const used = u.contextTokens === undefined ? '' : ` · ${tokens(u.contextTokens)}`

  return {
    label: '컨텍스트',
    percent: u.contextPercent,
    level: levelOf(u.contextPercent, 60, 80),
    value: `${u.contextPercent}%${used} / ${tokens(u.contextWindow)} 토큰`,
  }
}

function usageRow(u: Usage | null, now: number): Row {
  if (u !== null && u.limits.length > 0) {
    const shown = [...u.limits].sort((a, b) => order(a.kind) - order(b.kind)).slice(0, 2)
    const top = Math.max(...u.limits.map(one => one.percent))
    const parts = shown.map(one => {
      const name = LIMIT_NAMES[one.kind] ?? one.kind
      const until = one.kind === 'five_hour' ? untilText(one.resetsAt, now) : undefined
      return until === undefined
        ? `${name} ${one.percent}%`
        : `${name} ${one.percent}% (${until} 뒤 초기화)`
    })

    return { label: '사용량', percent: top, level: levelOf(top, 70, 90), value: parts.join(' · ') }
  }
  if (u !== null && u.costUsd !== undefined) {
    return {
      label: '사용량',
      percent: 0,
      level: 'none',
      value: `이번 대화 비용 $${u.costUsd.toFixed(2)}`,
    }
  }
  return { label: '사용량', percent: 0, level: 'none', value: '첫 답변 뒤에 보여요' }
}

function order(kind: string): number {
  const at = Object.keys(LIMIT_NAMES).indexOf(kind)
  return at === -1 ? 99 : at
}

type Mood = { mood: DogMood; line: string; color: string }

function moodOf(
  isWorking: boolean,
  r: Ram | null,
  u: Usage | null,
  full: number | null,
  eating: Feeding | null,
): Mood {
  if (eating !== null) {
    return {
      mood: `eat_${eating.treat}`,
      line: `냠냠! ${TREAT_NAMES[eating.treat]} 맛있어요 🐾`,
      color: 'claude',
    }
  }
  if (isWorking) {
    return { mood: 'work', line: '열심히 일하는 중이에요 🐾', color: 'claude' }
  }
  if ((u?.contextPercent ?? 0) >= 85) {
    return {
      mood: 'tired',
      line: '컨텍스트가 거의 찼어요 · /compact 로 정리할 수 있어요',
      color: 'warning',
    }
  }
  if (u !== null && u.limits.some(one => one.percent >= 90)) {
    return { mood: 'tired', line: '사용량이 거의 다 찼어요 · 쉬엄쉬엄 가요', color: 'warning' }
  }
  if (r?.pressure === 'critical') {
    return {
      mood: 'tired',
      line: '컴퓨터 메모리가 부족해요 · 안 쓰는 앱을 닫아 주세요',
      color: 'warning',
    }
  }
  if (full !== null && full < HUNGRY_BELOW) {
    return { mood: 'hungry', line: '배고파요… 간식 주세요 🦴', color: 'warning' }
  }
  return { mood: 'idle', line: '쉬는 중이에요 · 언제든 불러 주세요', color: 'subtle' }
}

function fullnessLevel(full: number | null): Level {
  if (full === null) {
    return 'none'
  }
  return full < HUNGRY_BELOW ? 'bad' : full < 50 ? 'warn' : 'ok'
}

// ---------------------------------------------------------------- drawing

function barSvg(percent: number, level: Level): string {
  const width = 72
  const fill = level === 'none' ? 0 : Math.max(3, Math.round((Math.min(100, percent) / 100) * width))

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} 8" width="${width}" height="8">` +
    `<rect width="${width}" height="8" rx="4" fill="#9a9a9a" opacity=".28"/>` +
    (fill > 0 ? `<rect width="${fill}" height="8" rx="4" fill="${LEVEL_HEX[level]}"/>` : '') +
    `</svg>`
  )
}

function textBar(percent: number, level: Level): string {
  const cells = 10
  const filled = level === 'none' ? 0 : Math.round((Math.min(100, percent) / 100) * cells)
  return '█'.repeat(filled) + '░'.repeat(cells - filled)
}

const TERMINAL_DOG: Record<DogMood, string> = {
  idle: '🐶',
  work: '🐕💨',
  tired: '🐶💤',
  hungry: '🐶💧',
  eat_bone: '🐶🦴',
  eat_cookie: '🐶🍪',
  eat_meat: '🐶🍖',
}

// ---------------------------------------------------------------- hooks

async function hide($: EngineInterface): Promise<void> {
  await update($, isHidden, () => true)
  $.ui.toast(`강아지 띠를 이 세션에서 숨겼어요 · /puppy 를 입력하면 다시 보여요`)
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const started = await next(e)
    await $.command.register({
      name: 'puppy',
      description: '강아지 상태 띠를 이 세션에서 숨기거나 다시 보여 줍니다',
    })
    await Promise.all([refreshRam($), refreshUsage($), refreshBelly($)])
    $.clock.every(RAM_EVERY_MS, () => {
      void refreshRam($)
    })
    // The belly empties slowly; another session's treat shows up here too.
    $.clock.every(BELLY_EVERY_MS, () => {
      void refreshBelly($)
    })

    return started
  })

  on('command.run', { command: 'puppy' }, async $ => {
    const wasHidden = await read($, isHidden)
    await update($, isHidden, () => !wasHidden)

    return {
      text: wasHidden
        ? '강아지 띠를 다시 보여 드려요.'
        : `강아지 띠를 이 세션에서 숨겼어요. 다시 보려면 /puppy 를 입력하세요.`,
    }
  })

  on('session.measure', async ($, e, next) => {
    await setUsage($, toUsage(e.context, e.rateLimits, e.cost))

    return next(e)
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey || (await read($, isHidden))) {
      return next(e)
    }
    const [r, isRamError, u, now, full, eatingNow] = await Promise.all([
      read($, ram),
      read($, ramError),
      read($, usage),
      $.clock.now(),
      read($, fullness),
      read($, feeding),
    ])
    const eating = eatingNow !== null && eatingNow.until > now ? eatingNow : null
    const rows = [ramRow(r, isRamError), contextRow(u), usageRow(u, now)]
    const mood = moodOf(e.props.isWorking, r, u, full, eating)
    const fullLevel = fullnessLevel(full)
    const fullText = full === null ? '…' : `${full}%`

    if (e.surface === 'terminal') {
      const { Box, Text, Button } = $.ui.resolve(e)

      return (
        <Box flexDirection="column">
          <Box flexDirection="row" justifyContent="space-between">
            <Text color={mood.color}>
              {TERMINAL_DOG[mood.mood]} {mood.line}
            </Text>
            <Box flexDirection="row" columnGap={1}>
              <Text>
                🍖 <Text color={LEVEL_HEX[fullLevel]}>{fullText}</Text>
              </Text>
              <Button key="feed" label="간식 주기" onPress={() => feed($)} />
              <Button key="hide" label="숨기기" role="dismiss" onPress={() => hide($)} />
            </Box>
          </Box>
          {rows.map(row => (
            <Text>
              <Text color={LEVEL_HEX[row.level]}>{textBar(row.percent, row.level)}</Text>{' '}
              <Text bold>{row.label}</Text> <Text dimColor>{row.value}</Text>
            </Text>
          ))}
        </Box>
      )
    }

    if (e.surface === 'desktop') {
      const { Box, Text, Svg, Button } = $.ui.resolve(e)

      // [ dog + figures (wrap on a narrow window) ][ belly + treat ][ close ]
      // The belly sits in the room left at the right, so the band is no taller.
      return (
        <Box flexDirection="row" alignItems="flex-start" columnGap={2}>
          <Box
            flexDirection="row"
            alignItems="center"
            columnGap={2}
            rowGap={1}
            flexWrap="wrap"
            flexGrow={1}
            flexShrink={1}
          >
            <Svg
              source={DOG_SVG[mood.mood]}
              alt="픽셀 강아지"
              width={Math.round(YARD.width * DOG_SCALE)}
              height={Math.round(YARD.height * DOG_SCALE)}
              isInteractive
            />
            <Box flexDirection="column" rowGap={0} flexShrink={1}>
              <Text size="footnote" weight="semibold" color={mood.color}>
                {mood.line}
              </Text>
              {rows.map(row => (
                <Box flexDirection="row" alignItems="center" columnGap={1}>
                  <Svg
                    source={barSvg(row.percent, row.level)}
                    alt={`${row.label} ${row.percent}%`}
                    width={72}
                    height={8}
                  />
                  <Text size="caption" weight="semibold">
                    {row.label}
                  </Text>
                  <Text size="caption" tabular dimColor>
                    {row.value}
                  </Text>
                </Box>
              ))}
            </Box>
          </Box>
          {/* The desktop lays a band's Button over the line above it (it keeps
              buttons to a text line's height), so the bar shares the label's
              line, and the treat is a plain Button inside a brown chip: a plain
              Button has no fill of its own, the Box behind it is the colour. */}
          <Box flexDirection="column" alignItems="center" alignSelf="center" rowGap="sm">
            <Box flexDirection="row" alignItems="center" columnGap={1}>
              <Text size="caption" weight="semibold">
                🍖 배부름 <Text color={LEVEL_HEX[fullLevel]}>{fullText}</Text>
              </Text>
              <Svg
                source={barSvg(full ?? 0, fullLevel)}
                alt={`배부름 ${fullText}`}
                width={56}
                height={8}
              />
            </Box>
            <Box
              key="treat"
              backgroundColor={DOG_BROWN.fill}
              borderStyle="round"
              borderColor={DOG_BROWN.edge}
              paddingX="md"
              paddingY="xs"
              hover={{ backgroundColor: DOG_BROWN.hover }}
            >
              <Button
                key="feed"
                plain
                label="간식 주기 🦴"
                hover={{ color: DOG_BROWN.text }}
                onPress={() => feed($)}
              />
            </Box>
          </Box>
          <Button key="hide" label="강아지 띠 닫기" role="dismiss" onPress={() => hide($)} />
        </Box>
      )
    }

    return next(e)
  })
}
