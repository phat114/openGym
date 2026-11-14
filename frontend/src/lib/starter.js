// The starter-plan catalog. Training data only: the chooser's plan names and descriptions are
// written as string literals inside t() calls in sheets.jsx, because check-source-strings.mjs
// only finds them there — copy parked in here would silently ship English in every language.
//
// A routine is [key, name, emoji, [exercise, …], opts?]. The key is what a plan's schedule
// points at, so a weekday never depends on the position of a routine in the array. Names stay
// canonical English — they become ordinary user routines, which are not translated.
//
// An exercise is [exerciseId, sets, reps, restSec?, extra?]. `reps` is a count, or a [low, high]
// range for double progression — persisted as repsMin / reps, the shape normalizeRepRange reads.
// `restSec` is the exercise's own rest; absent, the global rest timer applies. `extra` is copied
// onto the exercise as is ({ side: true } for unilateral work, whose reps count both sides).
// `opts` is copied onto the routine ({ prog } sets the rule for every exercise in it).
import { uid } from './format.js'

const PPL = [
  ['push', 'Push Day', 'barbell', [['0025', 4, 8], ['0047', 3, 10], ['0426', 3, 10], ['0334', 3, 12], ['0241', 3, 12], ['0251', 3, 10]]],
  ['pull', 'Pull Day', 'pullup', [['2330', 4, 10], ['0027', 4, 8], ['1323', 3, 10], ['0031', 3, 10], ['0313', 3, 12]]],
  ['legs', 'Leg Day', 'legs', [['0043', 4, 8], ['0085', 3, 10], ['0739', 3, 12], ['0585', 3, 12], ['0586', 3, 12], ['0605', 4, 15]]]
]

const UPPER_LOWER = [
  ['upper-a', 'Upper A', 'barbell', [['0025', 3, 8], ['2330', 3, 10], ['0047', 2, 10], ['1323', 2, 10], ['0334', 2, 12], ['0241', 2, 12], ['0031', 2, 12]]],
  ['lower-a', 'Lower A', 'legs', [['0043', 3, 8], ['0085', 3, 8], ['0739', 2, 10], ['0586', 2, 12], ['0605', 3, 15]]],
  ['upper-b', 'Upper B', 'barbell', [['0047', 3, 8], ['0027', 3, 8], ['0426', 2, 10], ['2330', 2, 10], ['0334', 2, 12], ['0241', 2, 12], ['0313', 2, 12]]],
  ['lower-b', 'Lower B', 'legs', [['0739', 3, 10], ['0085', 2, 10], ['0585', 2, 12], ['0586', 3, 12], ['0605', 3, 15]]]
]

const FULL_BODY = [
  ['fb-a', 'Full Body A', 'figureStrength', [['0043', 3, 8], ['0025', 3, 8], ['2330', 3, 10], ['0586', 3, 12], ['0334', 2, 12], ['0031', 2, 12]]],
  ['fb-b', 'Full Body B', 'figureStrength', [['0085', 3, 8], ['0047', 3, 10], ['1323', 3, 10], ['0585', 3, 12], ['0334', 2, 12], ['0241', 2, 12]]],
  ['fb-c', 'Full Body C', 'figureStrength', [['0739', 3, 10], ['0025', 2, 10], ['0027', 3, 10], ['0426', 2, 10], ['0586', 3, 12], ['0605', 3, 15]]]
]

const FIVE_BY_FIVE = [
  ['5x5-a', '5×5 A', 'barbell', [['0043', 5, 5], ['0025', 5, 5], ['0027', 5, 5]]],
  ['5x5-b', '5×5 B', 'barbell', [['0085', 5, 5], ['0426', 5, 5], ['2330', 5, 5]]],
  ['5x5-c', '5×5 C', 'barbell', [['0739', 5, 5], ['0047', 5, 5], ['1323', 5, 5]]]
]

// PPL + Upper/Lower, five days, hypertrophy with chest and back first. The source sheet works in
// rep ranges and adds load once every set reaches the top of its range — double progression, so
// the routines carry it. Its rest windows ("90–120 s") keep their low end, a multiple of the
// config sheet's 15 s step; RIR targets and coaching notes have no field to live in and stay out.
const DOUBLE = { prog: 'double' }
const PPL_UL = [
  ['ppl-ul-push', 'Push', 'barbell', [
    ['0314', 3, [6, 10], 120], // incline dumbbell press
    ['0577', 3, [8, 12], 90], // machine chest press
    ['0227', 2, [12, 15], 60], // cable fly
    ['0405', 2, [8, 12], 90], // seated shoulder press
    ['0334', 3, [12, 20], 60], // dumbbell lateral raise
    ['0200', 2, [10, 15], 60], // rope triceps pushdown
    ['0194', 2, [10, 15], 60] // overhead cable triceps extension
  ], DOUBLE],
  ['ppl-ul-pull', 'Pull', 'pullup', [
    ['2330', 3, [8, 12], 90], // lat pulldown
    ['0327', 3, [8, 12], 90], // chest-supported row
    ['0214', 2, [20, 24], 60, { side: true }], // single-arm cable row, 10–12 per side
    ['0602', 3, [12, 20], 60], // reverse pec deck
    ['0294', 2, [8, 12], 60], // dumbbell curl
    ['0313', 2, [10, 15], 60] // hammer curl
  ], DOUBLE],
  ['ppl-ul-legs', 'Legs', 'legs', [
    ['0743', 3, [8, 12], 120], // hack squat
    ['0085', 3, [8, 10], 120], // romanian deadlift
    ['0739', 2, [10, 15], 90], // leg press
    ['0599', 2, [10, 15], 60], // seated leg curl
    ['0585', 2, [12, 15], 60], // leg extension
    ['0605', 4, [10, 15], 60], // standing calf raise
    ['0175', 3, [10, 15], 60] // cable crunch
  ], DOUBLE],
  ['ppl-ul-upper', 'Upper', 'barbell', [
    ['0577', 3, [8, 12], 90], // machine chest press
    ['2616', 3, [8, 12], 90], // lat pulldown, a different (v-bar) grip from Pull day
    ['0171', 2, [12, 15], 60], // incline cable fly
    ['0861', 3, [8, 12], 90], // seated cable row
    ['0334', 3, [12, 20], 60], // dumbbell lateral raise
    ['0225', 2, [12, 20], 60], // rear delt cable fly
    ['0447', 3, [10, 15], 60], // ez-bar curl
    ['0241', 3, [10, 15], 60] // cable triceps pushdown
  ], DOUBLE],
  ['ppl-ul-lower', 'Lower', 'legs', [
    ['0743', 3, [8, 12], 120], // hack squat
    ['1459', 2, [10, 12], 90], // dumbbell romanian deadlift
    ['0586', 2, [10, 15], 60], // lying leg curl — Legs day has the seated one
    ['0585', 2, [12, 15], 60], // leg extension
    ['3562', 2, [8, 12], 90], // hip thrust (upper back on the bench)
    ['0594', 3, [10, 15], 60] // seated calf raise — Legs day has the standing one
  ], DOUBLE]
]

// [weekday, routineKey] — weekday is a DAYN index, so 1 is Monday. Fixed weeks only: every
// plan repeats the same seven days, which is all the weekly plan model can represent.
const PLANS = {
  ppl: { routines: PPL, schedule: [[1, 'push'], [3, 'pull'], [5, 'legs']] },
  'upper-lower': { routines: UPPER_LOWER, schedule: [[1, 'upper-a'], [2, 'lower-a'], [4, 'upper-b'], [5, 'lower-b']] },
  'full-body': { routines: FULL_BODY, schedule: [[1, 'fb-a'], [3, 'fb-b'], [5, 'fb-c']] },
  '5x5': { routines: FIVE_BY_FIVE, schedule: [[1, '5x5-a'], [3, '5x5-b'], [5, '5x5-c']] },
  'ppl-upper-lower': { routines: PPL_UL, schedule: [[1, 'ppl-ul-push'], [2, 'ppl-ul-pull'], [3, 'ppl-ul-legs'], [5, 'ppl-ul-upper'], [6, 'ppl-ul-lower']] }
}

const exercise = ([id, sets, reps, restSec, extra]) => {
  const [repsMin, top] = Array.isArray(reps) ? reps : [0, reps]
  return { id, sets, reps: top, ...(repsMin ? { repsMin } : {}), weight: 0, ...(restSec ? { restSec } : {}), ...extra }
}

const build = routines =>
  routines.map(([, name, emoji, list, opts]) => ({ id: uid(), name, emoji, ...opts, ex: list.map(exercise) }))

// Fresh routine objects (new ids) — [push, pull, legs]. The demo build seeds a history on
// top of exactly these three, so this entry point keeps its shape.
export const starterRoutines = () => build(PPL)

// [{ id, days }] for the chooser. The day count is read off the schedule rather than stored
// beside it, so the two can never disagree.
export const starterPlanOptions = () =>
  Object.entries(PLANS).map(([id, { schedule }]) => ({ id, days: schedule.length }))

// The weekdays a plan would claim, or null for an unknown id.
export const starterPlanDays = id => PLANS[id]?.schedule.map(([day]) => day) ?? null

// Fresh routines plus the weekdays to put them on, or null for an unknown id — a caller that
// treats null as "change nothing" can never half-apply a plan.
export const buildStarterPlan = id => {
  const plan = PLANS[id]
  if (!plan) return null
  const routines = build(plan.routines)
  // key → the id just minted for it, so the schedule below names its routine
  const byKey = Object.fromEntries(plan.routines.map(([key], i) => [key, routines[i].id]))
  return { routines, schedule: plan.schedule.map(([day, key]) => ({ day, routineId: byKey[key] })) }
}
