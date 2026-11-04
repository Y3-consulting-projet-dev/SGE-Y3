// Période évaluée : un exercice va toujours du 1er octobre N au 30 septembre N+1.
// Aucune autre période de cycle n'est acceptée, et les dates de missions doivent s'y trouver.

const MONTHS_FR = [
  'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
];

function pad(value) {
  return String(value).padStart(2, '0');
}

// Bornes de l'exercice qui commence le 1er octobre de startYear (dates au format AAAA-MM-JJ).
function getFiscalPeriod(startYear) {
  const year = Number(startYear);
  return {
    start_date: `${year}-10-01`,
    end_date: `${year + 1}-09-30`,
    label: `Cycle ${year}-${year + 1}`,
  };
}

function isValidIsoDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ''));
  if (!match) return false;
  const [, year, month, day] = match.map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

// Date (objet Date ou chaîne) → AAAA-MM-JJ en UTC, ou '' si invalide.
function toIsoDate(value) {
  if (!value) return '';
  if (typeof value === 'string' && isValidIsoDate(value.slice(0, 10))) return value.slice(0, 10);
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

function formatFrenchDate(isoDate) {
  const [year, month, day] = String(isoDate).split('-').map(Number);
  if (!year || !month || !day) return String(isoDate || '');
  return `${day === 1 ? '1er' : day} ${MONTHS_FR[month - 1]} ${year}`;
}

function describePeriod(period) {
  return `du ${formatFrenchDate(period.start_date)} au ${formatFrenchDate(period.end_date)}`;
}

// Vérifie qu'une période de cycle respecte la règle 1er octobre N → 30 septembre N+1.
// Retourne { period } si elle est conforme, sinon { message }.
function validateCyclePeriod(startValue, endValue) {
  const startDate = String(startValue || '').trim().slice(0, 10);
  const endDate = String(endValue || '').trim().slice(0, 10);

  if (!isValidIsoDate(startDate) || !isValidIsoDate(endDate)) {
    return { message: 'Veuillez renseigner une date de début et une date de fin valides.' };
  }

  const expected = getFiscalPeriod(Number(startDate.slice(0, 4)));

  if (startDate !== expected.start_date || endDate !== expected.end_date) {
    return {
      message:
        'La période évaluée doit aller du 1er octobre au 30 septembre de l\'année suivante ' +
        `(par exemple ${describePeriod(getFiscalPeriod(2025))}).`,
    };
  }

  return { period: expected };
}

function isCyclePeriodConform(cycle) {
  const startDate = toIsoDate(cycle?.start_date);
  const endDate = toIsoDate(cycle?.end_date);
  return Boolean(startDate) && !validateCyclePeriod(startDate, endDate).message;
}

// Dates présentes dans le texte de période d'une mission (« Du 01-10-2025 au 15-11-2025 »,
// « À partir du … », « Jusqu'au … », formats JJ-MM-AAAA, JJ/MM/AAAA ou AAAA-MM-JJ), en AAAA-MM-JJ.
// Retourne null si une date écrite est impossible (ex. 31-02-2026).
function extractPeriodDates(periodText) {
  const dates = [];
  const pattern = /(\d{4})-(\d{2})-(\d{2})|(\d{2})[-/.](\d{2})[-/.](\d{4})/g;
  let match;

  while ((match = pattern.exec(String(periodText || ''))) !== null) {
    const isoDate = match[1] ? `${match[1]}-${match[2]}-${match[3]}` : `${match[6]}-${match[5]}-${match[4]}`;
    if (!isValidIsoDate(isoDate)) return null;
    dates.push(isoDate);
  }

  return dates;
}

// Message d'erreur si la mission n'a pas de date de début et de fin, ou si une date sort de la période évaluée, sinon ''.
function validateMissionPeriod(periodText, cyclePeriod, missionTitle = '') {
  const dates = extractPeriodDates(periodText);
  const missionLabel = missionTitle ? ` « ${missionTitle} »` : '';

  if (dates === null) {
    return `Les dates de la mission${missionLabel} sont invalides.`;
  }

  if (dates.length !== 2) {
    return `Renseignez la date de début et la date de fin de la mission${missionLabel}.`;
  }

  if (dates[1] < dates[0]) {
    return `La date de fin de la mission${missionLabel} doit être postérieure ou égale à la date de début.`;
  }

  const startDate = toIsoDate(cyclePeriod?.start_date);
  const endDate = toIsoDate(cyclePeriod?.end_date);

  if (!startDate || !endDate) return '';

  if (dates.some((date) => date < startDate || date > endDate)) {
    return `Les dates de la mission${missionLabel} doivent être comprises dans la période évaluée, ${describePeriod({
      start_date: startDate,
      end_date: endDate,
    })}.`;
  }

  return '';
}

// Contrôle les missions nouvelles ou dont la période a changé : les missions déjà enregistrées
// avec d'anciennes dates ne bloquent pas l'enregistrement du reste de l'évaluation.
function findMissionPeriodError(missions = [], previousMissions = [], cyclePeriod) {
  const previousPeriods = new Map(
    (previousMissions || []).map((mission) => [
      String(mission.mission_id || mission.id || '').trim(),
      String(mission.period || '').trim(),
    ])
  );

  for (const mission of missions || []) {
    const missionId = String(mission.mission_id || mission.id || '').trim();
    const period = String(mission.period || '').trim();

    if (missionId && previousPeriods.has(missionId) && previousPeriods.get(missionId) === period) {
      continue;
    }

    const message = validateMissionPeriod(period, cyclePeriod, String(mission.title || '').trim());
    if (message) return message;
  }

  return '';
}

module.exports = {
  describePeriod,
  extractPeriodDates,
  findMissionPeriodError,
  getFiscalPeriod,
  isCyclePeriodConform,
  toIsoDate,
  validateCyclePeriod,
  validateMissionPeriod,
};
