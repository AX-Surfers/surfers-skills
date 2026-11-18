import type { On } from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'

import { DOG_SVG, EAT_MS } from '../hooks/dog-art'

const VM_STAT = `Mach Virtual Memory Statistics: (page size of 16384 bytes)
Pages free:                                     3758.
Pages active:                                 149854.
Pages wired down:                             256211.
Pages purgeable:                                   2.
Anonymous pages:                              189275.
Pages occupied by compressor:                  46435.
`

const PUPPY = {
  command: 'puppy',
  args: '',
  origin: { kind: 'composer' },
  presentation: { isFullscreen: false, columns: 100 },
} as const

const BAND = {
  plugin: 'puppy-status',
  component: 'AbovePrompt',
  requestId: 'above-prompt',
  props: {
    hasSurvey: false,
    isWorking: false,
    maxRows: 12,
    bodyColumns: 100,
    scroll: { offset: 0, bodyRows: 12 },
    view: {},
  },
} as const

const USAGE = {
  startedAt: 0,
  context: { tokens: 76000, window: 200000, percent: 38 },
  rateLimits: [
    { kind: 'seven_day', percentUsed: 41 },
    { kind: 'five_hour', percentUsed: 23.4, resetsAt: '1970-01-01T02:10:00Z' },
  ],
  cost: { usd: 0.4234 },
}

function engine(
  on: On,
  usage: typeof USAGE | Record<string, unknown> = USAGE,
  store: Record<string, unknown> = {},
  now = 0,
) {
  // Nothing sits beneath the plugin: these hooks stand for the engine.
  const clock = mock.clock(on, { now })
  const toasts: string[] = []
  mock.store(on, store)
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('session.measure', (_, e) => ({ changed: e.changed }))
  on('command.register', (_, e) => ({ value: { command: e.name } }))
  on('ui.toast', (_, e) => (toasts.push(e.text), { value: undefined }))
  on('session.usage', () => ({ value: usage as typeof USAGE }))
  on('process.run', (_, e) => {
    const out = (stdout: string) => ({
      value: { exitCode: 0, stdout, stderr: '', isStdoutTruncated: false, isStderrTruncated: false },
    })
    if (e.argv[0] === '/usr/bin/vm_stat') return out(VM_STAT)
    if (e.argv.includes('hw.memsize')) return out('17179869184\n')
    return out('1\n')
  })

  return { clock, toasts }
}

test('the desktop band shows the dog and the three figures', async ($, on) => {
  engine(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })

  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
  const svgs = await ui.findAll({ type: 'Svg' })
  expect(svgs[0]?.props.source).toBe(DOG_SVG.idle)
  expect(svgs).toHaveLength(5) // the dog, three figures, the belly

  // (189275 - 2 + 256211 + 46435) * 16384 bytes of 16 GiB
  expect((await ui.find({ type: 'Text', text: /GB/ }))?.text).toBe('7.5 / 16 GB · 47% · 여유')
  expect((await ui.find({ type: 'Text', text: /토큰/ }))?.text).toBe('38% · 7.6만 / 20만 토큰')
  expect((await ui.find({ type: 'Text', text: /5시간/ }))?.text).toBe(
    '5시간 23% (2시간 10분 뒤 초기화) · 주간 41%',
  )
  expect((await ui.find({ type: 'Text', text: /쉬는 중/ }))).toBeDefined()
  await ui.unmount()
})

test('the dog runs while Claude works', async ($, on) => {
  engine(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })

  const ui = await $.ui.mount({
    ...BAND,
    surface: 'desktop',
    props: { ...BAND.props, isWorking: true },
  })
  expect((await ui.find({ type: 'Svg' }))?.props.source).toBe(DOG_SVG.work)
  expect(await ui.find({ type: 'Text', text: /일하는 중/ })).toBeDefined()
  await ui.unmount()
})

test('a nearly full context makes the dog doze and says what to do', async ($, on) => {
  engine(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.session.measure({
    context: { tokens: 180000, window: 200000, percent: 90 },
    rateLimits: [],
    changed: ['context'],
  })

  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
  expect((await ui.find({ type: 'Svg' }))?.props.source).toBe(DOG_SVG.tired)
  expect(await ui.find({ type: 'Text', text: /compact/ })).toBeDefined()
  await ui.unmount()
})

test('the terminal gets a text version, and a survey keeps the band free', async ($, on) => {
  engine(on, { startedAt: 0, context: { window: 200000 }, rateLimits: [] })
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>engine</Text>
  })
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })

  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: /첫 답변 뒤에 보여요 · 최대 20만 토큰/ })).toBeDefined()
  expect(await ui.find({ type: 'Svg' })).toBeUndefined()
  await ui.unmount()

  const quiet = await $.ui.mount({
    ...BAND,
    surface: 'desktop',
    props: { ...BAND.props, hasSurvey: true },
  })
  expect((await quiet.find({ type: 'Text' }))?.text).toBe('engine')
  await quiet.unmount()
})

test('the close button hides the band in this session, and /puppy brings it back', async ($, on) => {
  engine(on)
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>engine</Text>
  })
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })

  for (const surface of ['desktop', 'terminal'] as const) {
    const ui = await $.ui.mount({ ...BAND, surface })
    expect((await ui.find({ key: 'hide' }))?.props.role).toBe('dismiss')
    await ui.press({ key: 'hide' })
    expect((await ui.find({ type: 'Text' }))?.text).toBe('engine')
    await ui.unmount()

    const back = await $.command.run(PUPPY)
    expect(back.text).toBe('강아지 띠를 다시 보여 드려요.')
    const shown = await $.ui.mount({ ...BAND, surface })
    expect(await shown.find({ key: 'hide' })).toBeDefined()
    await shown.unmount()
  }

  const gone = await $.command.run(PUPPY)
  expect(gone.text).toContain('숨겼어요')
})

test('every mood answers a click on the dog with a wag and hearts, inside the drawing', () => {
  for (const svg of [DOG_SVG.idle, DOG_SVG.work, DOG_SVG.tired, DOG_SVG.hungry]) {
    expect(svg).toContain('id="hit"')
    expect(svg).toContain('begin="hit.click')
    expect(svg).toContain('<use href="#heart"/>')
  }
  for (const svg of Object.values(DOG_SVG)) {
    expect(svg.length).toBeLessThan(131072)
  }
})

test('a treat fills the belly, plays the eating scene, then the dog goes back', async ($, on) => {
  const { clock } = engine(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })

  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
  expect((await ui.find({ type: 'Text', text: /배부름/ }))?.text).toBe('🍖 배부름 80%')
  // A plain Button (no fill of its own) on a chip in the dog's coat colour.
  expect((await ui.find({ key: 'treat' }))?.props.backgroundColor).toBe('#bc6b3e')
  expect((await ui.find({ key: 'feed' }))?.props.plain).toBe(true)
  await ui.press({ key: 'feed' })

  const scene = String((await ui.find({ type: 'Svg' }))?.props.source)
  expect([DOG_SVG.eat_bone, DOG_SVG.eat_cookie, DOG_SVG.eat_meat]).toContain(scene)
  expect(await ui.find({ type: 'Text', text: /냠냠/ })).toBeDefined()
  expect((await ui.find({ type: 'Text', text: /배부름/ }))?.text).toBe('🍖 배부름 100%')

  await clock.advance(EAT_MS)
  expect((await ui.find({ type: 'Svg' }))?.props.source).toBe(DOG_SVG.idle)
  await ui.unmount()
})

test('a full dog turns the treat down', async ($, on) => {
  const { toasts } = engine(on, USAGE, { belly: { value: 100, at: 0 } })
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })

  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
  await ui.press({ key: 'feed' })
  expect(toasts).toEqual(['배불러요! 조금 있다가 주세요 🐶'])
  expect((await ui.find({ type: 'Svg' }))?.props.source).toBe(DOG_SVG.idle)
  await ui.unmount()
})

test('the belly empties over hours, shared through the store, and a hungry dog lies down', async ($, on) => {
  // 30% two hours ago, at 12.5% an hour: 5% now.
  engine(on, USAGE, { belly: { value: 30, at: 0 } }, 2 * 3_600_000)
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })

  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: '5%' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /배고파요/ })).toBeDefined()
  expect(await ui.find({ key: 'feed' })).toBeDefined()
  await ui.unmount()

  const desk = await $.ui.mount({ ...BAND, surface: 'desktop' })
  expect((await desk.find({ type: 'Svg' }))?.props.source).toBe(DOG_SVG.hungry)
  await desk.unmount()
})
