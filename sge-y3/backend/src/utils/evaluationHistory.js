const { getAverageScore, getOverallAverageScore, normalizeSections } = require('./evaluationHelpers');
const { isFullRh, ASSISTANT_RH_EMAIL, normalizeEmail, normalizeDepartment } = require('./userMapping');
const { getCycleDateRangeMap } = require('./activeCycle');

function getMissionAverageScore(criteria = []) {
  const scores = criteria.map((criterion) => criterion.score).filter((score) => typeof score === 'number');

  if (!scores.length) {
    return null;
  }

  return Number((scores.reduce((total, score) => total + score, 0) / scores.length).toFixed(1));
}

function getAverageFromMissionEvaluations(missionEvaluations = []) {
  const missionScores = missionEvaluations
    .map((mission) => getMissionAverageScore(mission.criteria || []))
    .filter((score) => typeof score === 'number');

  if (!missionScores.length) {
    return null;
  }

  return Number((missionScores.reduce((total, score) => total + score, 0) / missionScores.length).toFixed(1));
}

function normalizeMissionScoresOnly(missionEvaluations = []) {
  return missionEvaluations.map((mission) => ({
    mission_id: String(mission.mission_id || mission.id || '').trim(),
    title: String(mission.title || '').trim(),
    period: String(mission.period || '').trim(),
    start_date: String(mission.start_date || mission.startDate || '').trim(),
    end_date: String(mission.end_date || mission.endDate || '').trim(),
    department: String(mission.department || '').trim(),
    recipients: Array.isArray(mission.recipients)
      ? mission.recipients.map((recipient) => String(recipient.name || '').trim()).filter(Boolean)
      : [],
    criteria: Array.isArray(mission.criteria) ? mission.criteria : [],
  }));
}

function buildMissionResultsPayload(instance, comments = []) {
  const missionEvaluations = normalizeMissionScoresOnly(instance.mission_evaluations || []);
  const scoreFinal = getAverageFromMissionEvaluations(missionEvaluations);

  return {
    cycle_label: instance.cycle_label,
    status: instance.status,
    kind: 'missions',
    missionScores: missionEvaluations.map((mission) => {
      const score = getMissionAverageScore(mission.criteria || []);

      return {
        missionId: mission.mission_id,
        title: mission.title,
        period: mission.period,
        startDate: mission.start_date || '',
        endDate: mission.end_date || '',
        department: mission.department,
        recipients: mission.recipients,
        score,
        percent: Math.round(((score || 0) / 5) * 100),
      };
    }),
    kpis: {
      scoreFinal: scoreFinal || 0,
      scoreFinalPercent: Math.round(((scoreFinal || 0) / 5) * 100),
    },
    comments,
  };
}

function buildSectionResultsPayload(instance, comments = []) {
  const sections = normalizeSections(instance.sections || []);
  const overallAverage = getOverallAverageScore(sections);

  return {
    cycle_label: instance.cycle_label,
    status: instance.status,
    kind: 'sections',
    sectionScores: sections.map((section) => {
      const score = getAverageScore(section);

      return {
        sectionId: section.id,
        title: section.title,
        score,
        percent: Math.round(((score || 0) / 5) * 100),
      };
    }),
    kpis: {
      scoreFinal: overallAverage || 0,
      scoreFinalPercent: Math.round(((overallAverage || 0) / 5) * 100),
    },
    comments,
  };
}

function buildPeerReviewComments(instance) {
  const comment = String(instance?.peer_review_comment || '').trim();

  if (!comment) {
    return [];
  }

  return [
    {
      comment,
      authorName: instance?.peer_review_comment_by_name || 'Associé',
      submittedAt: instance?.peer_review_comment_saved_at || null,
    },
  ];
}

function resolveTemplateTypeForUser(user, { supportEmails = [] } = {}) {
  if (!user) {
    return null;
  }

  const email = normalizeEmail(user.email || '');
  const codeCategorie = String(user.code_categorie || '').trim();
  const grade = String(user.grade || '').trim();
  const department = normalizeDepartment(user.department || '');

  if (supportEmails.map((supportEmail) => normalizeEmail(supportEmail)).includes(email)) {
    return { templateType: 'support-self-evaluation', kind: 'sections' };
  }

  if (isFullRh(user)) {
    return { templateType: 'rh-self-evaluation', kind: 'sections' };
  }

  if (email === ASSISTANT_RH_EMAIL || ((department === 'RH' || department === 'CAPITAL HUMAIN') && grade === 'Assistant')) {
    return { templateType: 'rh-assistant-self-evaluation', kind: 'sections' };
  }

  if (codeCategorie === '11') {
    return { templateType: 'associate-self-evaluation', kind: 'sections' };
  }

  if (['10B', '10C', '9B'].includes(codeCategorie)) {
    return { templateType: 'manager-self-evaluation', kind: 'sections' };
  }

  if (codeCategorie === '9A') {
    return { templateType: 'senior-self-evaluation', kind: 'missions' };
  }

  if (codeCategorie === '8C') {
    return { templateType: 'assistant-self-evaluation', kind: 'missions' };
  }

  return null;
}

async function buildCyclesForInstances(instances, kind, getCommentsForCycle) {
  const cycleDateRanges = await getCycleDateRangeMap();

  return Promise.all(
    instances.map(async (instance) => {
      const comments = await getCommentsForCycle(instance.cycle_label, instance);

      const payload = kind === 'missions'
        ? buildMissionResultsPayload(instance, comments)
        : buildSectionResultsPayload(instance, comments);

      const dateRange = cycleDateRanges.get(instance.cycle_label);

      return {
        ...payload,
        start_date: dateRange?.start_date || null,
        end_date: dateRange?.end_date || null,
      };
    })
  );
}

module.exports = {
  getMissionAverageScore,
  getAverageFromMissionEvaluations,
  normalizeMissionScoresOnly,
  buildMissionResultsPayload,
  buildSectionResultsPayload,
  buildPeerReviewComments,
  resolveTemplateTypeForUser,
  buildCyclesForInstances,
};
