const Cycle = require('../models/Cycle');

const DEFAULT_CYCLE = {
  label: 'Cycle 2025-2026',
  start_date: new Date('2025-06-01'),
  end_date: new Date('2026-06-01'),
};

let activeCycleCache = { ...DEFAULT_CYCLE };

async function loadActiveCycle() {
  let cycle = await Cycle.findOne({ is_active: true });

  if (!cycle) {
    cycle = await Cycle.findOneAndUpdate(
      { label: DEFAULT_CYCLE.label },
      { ...DEFAULT_CYCLE, is_active: true },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  }

  activeCycleCache = {
    label: cycle.label,
    start_date: cycle.start_date,
    end_date: cycle.end_date,
  };

  return activeCycleCache;
}

function getCurrentCycleLabel() {
  return activeCycleCache.label;
}

function getActiveCycle() {
  return { ...activeCycleCache };
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
  activateCycle,
  getCycleDateRangeMap,
};
