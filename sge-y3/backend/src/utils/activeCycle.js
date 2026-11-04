const Cycle = require('../models/Cycle');
const { getFiscalPeriod, isCyclePeriodConform, toIsoDate } = require('./evaluationPeriod');

const DEFAULT_PERIOD = getFiscalPeriod(2025);
const DEFAULT_CYCLE = {
  label: DEFAULT_PERIOD.label,
  start_date: new Date(DEFAULT_PERIOD.start_date),
  end_date: new Date(DEFAULT_PERIOD.end_date),
};

let activeCycleCache = { ...DEFAULT_CYCLE };

// Ramène le cycle actif sur la période 1er octobre N → 30 septembre N+1 de son libellé (« Cycle N-N+1 »).
// Le libellé ne change pas : les évaluations qui y sont rattachées restent dans le même cycle.
async function alignCyclePeriod(cycle) {
  if (isCyclePeriodConform(cycle)) {
    return cycle;
  }

  const labelMatch = /(\d{4})\s*-\s*(\d{4})/.exec(cycle.label || '');
  const startYear = labelMatch && Number(labelMatch[2]) === Number(labelMatch[1]) + 1
    ? Number(labelMatch[1])
    : new Date(cycle.start_date).getUTCFullYear();
  const period = getFiscalPeriod(startYear);
  const previous = `${toIsoDate(cycle.start_date)} → ${toIsoDate(cycle.end_date)}`;

  cycle.start_date = new Date(period.start_date);
  cycle.end_date = new Date(period.end_date);
  await cycle.save();

  console.log(`[cycle] ${cycle.label} : période corrigée (${previous}) → (${period.start_date} → ${period.end_date}).`);
  return cycle;
}

// Corrige aussi les cycles de l'historique nommés « Cycle N-N+1 », pour que leurs dates affichées soient justes.
async function alignAllCyclePeriods() {
  const cycles = await Cycle.find();

  for (const cycle of cycles) {
    const labelMatch = /(\d{4})\s*-\s*(\d{4})/.exec(cycle.label || '');
    if (labelMatch && Number(labelMatch[2]) === Number(labelMatch[1]) + 1) {
      await alignCyclePeriod(cycle);
    }
  }
}

async function loadActiveCycle() {
  await alignAllCyclePeriods();
  let cycle = await Cycle.findOne({ is_active: true });

  if (!cycle) {
    cycle = await Cycle.findOneAndUpdate(
      { label: DEFAULT_CYCLE.label },
      { $set: { is_active: true }, $setOnInsert: { start_date: DEFAULT_CYCLE.start_date, end_date: DEFAULT_CYCLE.end_date } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  }

  cycle = await alignCyclePeriod(cycle);
  activateCycle(cycle);

  return getActiveCycle();
}

function getCurrentCycleLabel() {
  return activeCycleCache.label;
}

function getActiveCycle() {
  return { ...activeCycleCache };
}

// Période évaluée du cycle actif, dates au format AAAA-MM-JJ.
function getActiveEvaluationPeriod() {
  return {
    label: activeCycleCache.label,
    start_date: toIsoDate(activeCycleCache.start_date),
    end_date: toIsoDate(activeCycleCache.end_date),
  };
}

function activateCycle(cycle) {
  activeCycleCache = {
    label: cycle.label,
    start_date: cycle.start_date,
    end_date: cycle.end_date,
  };
}

async function getCycleDateRangeMap() {
  const cycles = await Cycle.find().select('label start_date end_date');

  return new Map(
    cycles.map((cycle) => [cycle.label, { start_date: cycle.start_date, end_date: cycle.end_date }])
  );
}

module.exports = {
  loadActiveCycle,
  getCurrentCycleLabel,
  getActiveCycle,
  getActiveEvaluationPeriod,
  activateCycle,
  getCycleDateRangeMap,
};
