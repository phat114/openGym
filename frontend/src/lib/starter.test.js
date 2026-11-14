import { describe, expect, it } from 'vitest'
import { EXIDX } from './exercises.js'
import { buildStarterPlan, starterPlanDays, starterPlanOptions, starterRoutines } from './starter.js'

// The approved prescription, written out again rather than imported: a test that reads the
// same table as the code would pass no matter what that table said. [weekday, name, sets].
const APPROVED = {
  ppl: [
    [1, 'Push Day', [['0025', 4, 8], ['0047', 3, 10], ['0426', 3, 10], ['0334', 3, 12], ['0241', 3, 12], ['0251', 3, 10]]],
    [3, 'Pull Day', [['2330', 4, 10], ['0027', 4, 8], ['1323', 3, 10], ['0031', 3, 10], ['0313', 3, 12]]],
    [5, 'Leg Day', [['0043', 4, 8], ['0085', 3, 10], ['0739', 3, 12], ['0585', 3, 12], ['0586', 3, 12], ['0605', 4, 15]]],
  ],
  'upper-lower': [
    [1, 'Upper A', [['0025', 3, 8], ['2330', 3, 10], ['0047', 2, 10], ['1323', 2, 10], ['0334', 2, 12], ['0241', 2, 12], ['0031', 2, 12]]],
    [2, 'Lower A', [['0043', 3, 8], ['0085', 3, 8], ['0739', 2, 10], ['0586', 2, 12], ['0605', 3, 15]]],
    [4, 'Upper B', [['0047', 3, 8], ['0027', 3, 8], ['0426', 2, 10], ['2330', 2, 10], ['0334', 2, 12], ['0241', 2, 12], ['0313', 2, 12]]],
    [5, 'Lower B', [['0739', 3, 10], ['0085', 2, 10], ['0585', 2, 12], ['0586', 3, 12], ['0605', 3, 15]]],
  ],
  'full-body': [
    [1, 'Full Body A', [['0043', 3, 8], ['0025', 3, 8], ['2330', 3, 10], ['0586', 3, 12], ['0334', 2, 12], ['0031', 2, 12]]],
    [3, 'Full Body B', [['0085', 3, 8], ['0047', 3, 10], ['1323', 3, 10], ['0585', 3, 12], ['0334', 2, 12], ['0241', 2, 12]]],
    [5, 'Full Body C', [['0739', 3, 10], ['0025', 2, 10], ['0027', 3, 10], ['0426', 2, 10], ['0586', 3, 12], ['0605', 3, 15]]],
  ],
  '5x5': [
    [1, '5×5 A', [['0043', 5, 5], ['0025', 5, 5], ['0027', 5, 5]]],
    [3, '5×5 B', [['0085', 5, 5], ['0426', 5, 5], ['2330', 5, 5]]],
    [5, '5×5 C', [['0739', 5, 5], ['0047', 5, 5], ['1323', 5, 5]]],
  ],
  // reps here is the top of each range; the full range is checked further down
  'ppl-upper-lower': [
    [1, 'Push', [['0314', 3, 10], ['0577', 3, 12], ['0227', 2, 15], ['0405', 2, 12], ['0334', 3, 20], ['0200', 2, 15], ['0194', 2, 15]]],
    [2, 'Pull', [['2330', 3, 12], ['0327', 3, 12], ['0214', 2, 24], ['0602', 3, 20], ['0294', 2, 12], ['0313', 2, 15]]],
    [3, 'Legs', [['0743', 3, 12], ['0085', 3, 10], ['0739', 2, 15], ['0599', 2, 15], ['0585', 2, 15], ['0605', 4, 15], ['0175', 3, 15]]],
    [5, 'Upper', [['0577', 3, 12], ['2616', 3, 12], ['0171', 2, 15], ['0861', 3, 12], ['0334', 3, 20], ['0225', 2, 20], ['0447', 3, 15], ['0241', 3, 15]]],
    [6, 'Lower', [['0743', 3, 12], ['1459', 2, 12], ['0586', 2, 15], ['0585', 2, 15], ['3562', 2, 12], ['0594', 3, 15]]],
  ],
}

// The PPL + Upper/Lower sheet as written: [exerciseId, sets, low, high, rest seconds]. Ranges
// are the sheet's own; the single-arm row's "10–12 per side" is 20–24 counted across both
// sides, which is what a per-side exercise logs. Rest is the low end of the sheet's window.
const PPL_UL_RANGES = [
  [['0314', 3, 6, 10, 120], ['0577', 3, 8, 12, 90], ['0227', 2, 12, 15, 60], ['0405', 2, 8, 12, 90], ['0334', 3, 12, 20, 60], ['0200', 2, 10, 15, 60], ['0194', 2, 10, 15, 60]],
  [['2330', 3, 8, 12, 90], ['0327', 3, 8, 12, 90], ['0214', 2, 20, 24, 60], ['0602', 3, 12, 20, 60], ['0294', 2, 8, 12, 60], ['0313', 2, 10, 15, 60]],
  [['0743', 3, 8, 12, 120], ['0085', 3, 8, 10, 120], ['0739', 2, 10, 15, 90], ['0599', 2, 10, 15, 60], ['0585', 2, 12, 15, 60], ['0605', 4, 10, 15, 60], ['0175', 3, 10, 15, 60]],
  [['0577', 3, 8, 12, 90], ['2616', 3, 8, 12, 90], ['0171', 2, 12, 15, 60], ['0861', 3, 8, 12, 90], ['0334', 3, 12, 20, 60], ['0225', 2, 12, 20, 60], ['0447', 3, 10, 15, 60], ['0241', 3, 10, 15, 60]],
  [['0743', 3, 8, 12, 120], ['1459', 2, 10, 12, 90], ['0586', 2, 10, 15, 60], ['0585', 2, 12, 15, 60], ['3562', 2, 8, 12, 90], ['0594', 3, 10, 15, 60]],
]

const shape = r => r.ex.map(e => [e.id, e.sets, e.reps])

describe('starter plan catalog', () => {
  it('offers exactly the five plans, with the day count read off the schedule', () => {
    expect(starterPlanOptions()).toEqual([
      { id: 'ppl', days: 3 }, { id: 'upper-lower', days: 4 },
      { id: 'full-body', days: 3 }, { id: '5x5', days: 3 },
      { id: 'ppl-upper-lower', days: 5 },
    ])
    for (const { id, days } of starterPlanOptions()) expect(starterPlanDays(id)).toHaveLength(days)
  })

  it('changes nothing for an unknown plan id', () => {
    expect(buildStarterPlan('nope')).toBeNull()
    expect(buildStarterPlan(undefined)).toBeNull()
    // A click handler wired straight to a loader would hand the event in as the plan.
    expect(buildStarterPlan({ type: 'click' })).toBeNull()
    expect(starterPlanDays('nope')).toBeNull()
  })
})

describe.each(Object.keys(APPROVED))('%s', planId => {
  const approved = APPROVED[planId]

  it('builds the approved exercises, sets and reps in order', () => {
    const { routines } = buildStarterPlan(planId)
    expect(routines.map(r => r.name)).toEqual(approved.map(([, name]) => name))
    routines.forEach((r, i) => expect(shape(r)).toEqual(approved[i][2]))
  })

  it('puts each routine on its approved weekday, by identity not position', () => {
    const { routines, schedule } = buildStarterPlan(planId)
    const nameOf = Object.fromEntries(routines.map(r => [r.id, r.name]))
    expect(schedule.map(({ day, routineId }) => [day, nameOf[routineId]]))
      .toEqual(approved.map(([day, name]) => [day, name]))
  })

  it('references only real exercises and starts every one at weight 0', () => {
    for (const r of buildStarterPlan(planId).routines) {
      for (const e of r.ex) {
        expect(EXIDX[e.id], e.id).toBeTruthy()
        expect(e.sets).toBeGreaterThan(0)
        expect(e.reps).toBeGreaterThan(0)
        expect(e.weight).toBe(0)
      }
    }
  })

  it('mints fresh ids and independent objects on every build', () => {
    const first = buildStarterPlan(planId)
    const second = buildStarterPlan(planId)
    const ids = first.routines.map(r => r.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(second.routines.some(r => ids.includes(r.id))).toBe(false)
    expect(first.routines[0].ex[0]).not.toBe(second.routines[0].ex[0])
    // and the static definition survives a caller mutating what it got back
    first.routines[0].ex[0].sets = 99
    expect(buildStarterPlan(planId).routines[0].ex[0].sets).toBe(approved[0][2][0][1])
  })
})

describe('ppl-upper-lower: rep ranges, rest and double progression', () => {
  it('builds every exercise with the sheet’s range and rest, per side only for the single-arm row', () => {
    const { routines } = buildStarterPlan('ppl-upper-lower')
    routines.forEach((r, i) => {
      expect(r.ex, r.name).toEqual(PPL_UL_RANGES[i].map(([id, sets, repsMin, reps, restSec]) => ({
        id, sets, reps, repsMin, weight: 0, restSec, ...(id === '0214' ? { side: true } : {}),
      })))
    })
  })

  it('runs every routine on double progression, so load goes up only at the top of the range', () => {
    const { routines } = buildStarterPlan('ppl-upper-lower')
    expect(routines.map(r => r.prog)).toEqual(['double', 'double', 'double', 'double', 'double'])
  })

  it('leaves Wednesday free between the two halves and Sunday off', () => {
    expect(starterPlanDays('ppl-upper-lower')).toEqual([1, 2, 3, 5, 6])
  })

  it('leaves the older plans as plain sets × reps, with no rule, range or rest of their own', () => {
    for (const id of ['ppl', 'upper-lower', 'full-body', '5x5']) {
      for (const r of buildStarterPlan(id).routines) {
        expect(r, `${id} ${r.name}`).not.toHaveProperty('prog')
        for (const e of r.ex) expect(Object.keys(e).sort(), `${id} ${r.name} ${e.id}`).toEqual(['id', 'reps', 'sets', 'weight'])
      }
    }
  })
})

describe('starterRoutines (the demo build entry point)', () => {
  it('still returns push, pull and legs unchanged', () => {
    const routines = starterRoutines()
    expect(routines.map(r => r.name)).toEqual(['Push Day', 'Pull Day', 'Leg Day'])
    routines.forEach((r, i) => expect(shape(r)).toEqual(APPROVED.ppl[i][2]))
    expect(routines.map(r => r.emoji)).toEqual(['barbell', 'pullup', 'legs'])
  })

  it('mints fresh ids on every invocation', () => {
    const first = starterRoutines().map(r => r.id)
    const second = starterRoutines().map(r => r.id)
    expect(new Set([...first, ...second]).size).toBe(6)
  })
})
