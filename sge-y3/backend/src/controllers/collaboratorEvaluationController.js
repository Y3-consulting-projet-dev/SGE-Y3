const EvaluationInstance = require('../models/EvaluationInstance');
const User = require('../models/User');
const { cloneAssistantEvaluationTemplate } = require('../utils/assistantEvaluationTemplate');
const {
  getAverageScore,
  getEvaluationSummary,
  getOverallAverageScore,
  normalizeSections,
  validateSectionsForSubmit,
} = require('../utils/evaluationHelpers');

const CURRENT_CYCLE_LABEL = 'Cycle 2026';

function buildEvaluationPayload(instance, user) {
  const sections = normalizeSections(instance.sections);
  const activeSection = sections.find((section) => section.status !== 'Complete') || sections[0] || null;

  return {
    evaluation: {
      id: instance._id.toString(),
      cycle_label: instance.cycle_label,
      status: instance.status,
      submitted_at: instance.submitted_at,
      last_saved_at: instance.last_saved_at,
      sections,
      activeSectionId: activeSection?.id || 1,
    },
    summary: {
      ...getEvaluationSummary(sections),
      averageScore: activeSection ? getAverageScore(activeSection) : null,
    },
    assignee: {
      user_id: user._id.toString(),
      name: user.name,
      first_name: user.first_name,
      last_name: user.last_name,
      grade: user.grade,
      department: user.department,
      current_cycle: CURRENT_CYCLE_LABEL,
      submitted_to: instance.submitted_to_managers?.length ? instance.submitted_to_managers : 'Manager',
    },
  };
}

async function getOrCreateAssistantEvaluation(user) {
  let instance = await EvaluationInstance.findOne({
    evalue_id: user._id,
    cycle_label: CURRENT_CYCLE_LABEL,
    template_type: 'assistant-self-evaluation',
  });

  if (!instance) {
    instance = await EvaluationInstance.create({
      cycle_label: CURRENT_CYCLE_LABEL,
      evalue_id: user._id,
      status: 'En cours',
      template_type: 'assistant-self-evaluation',
      sections: cloneAssistantEvaluationTemplate().map((section) => ({
        section_id: section.id,
        title: section.title,
        subtitle: section.subtitle,
        status: section.status,
        comment: section.comment,
        criteria: section.criteria,
      })),
      last_saved_at: new Date(),
    });
  } else {
    const legacySections = normalizeSections(instance.sections);
    const hasLegacyPrefill = legacySections[0]?.criteria?.some((criterion) => criterion.score !== null && criterion.score !== undefined);
    const otherSectionsAreEmpty = legacySections
      .slice(1)
      .every((section) => section.criteria.every((criterion) => criterion.score === null || criterion.score === undefined));
    const untouchedLegacyInstance = hasLegacyPrefill && otherSectionsAreEmpty && instance.status === 'En cours';

    if (untouchedLegacyInstance) {
      instance.sections = cloneAssistantEvaluationTemplate().map((section) => ({
        section_id: section.id,
        title: section.title,
        subtitle: section.subtitle,
        status: section.status,
        comment: section.comment,
        criteria: section.criteria,
      }));
      instance.last_saved_at = new Date();
      await instance.save();
    }
  }

  return instance;
}

async function getMyAssistantEvaluation(request, response) {
  const instance = await getOrCreateAssistantEvaluation(request.user);
  return response.json(buildEvaluationPayload(instance, request.user));
}

async function saveMyAssistantEvaluation(request, response) {
  const rawSections = Array.isArray(request.body?.sections) ? request.body.sections : null;

  if (!rawSections?.length) {
    return response.status(400).json({
      message: 'Les sections de l\'auto-evaluation sont requises.',
    });
  }

  const sections = normalizeSections(rawSections);

  for (const section of sections) {
    for (const criterion of section.criteria) {
      if (criterion.score !== null && criterion.score !== undefined) {
        if (!Number.isInteger(criterion.score) || criterion.score < 1 || criterion.score > 5) {
          return response.status(400).json({
            message: `La note du critere "${criterion.label}" doit etre comprise entre 1 et 5.`,
          });
        }
      }
    }
  }

  const instance = await getOrCreateAssistantEvaluation(request.user);
  const summary = getEvaluationSummary(sections);

  instance.sections = sections.map((section) => ({
    section_id: section.id,
    title: section.title,
    subtitle: section.subtitle,
    status: section.status,
    comment: section.comment,
    criteria: section.criteria,
  }));
  instance.status = summary.globalProgress === 0 ? 'Brouillon' : 'En cours';
  instance.last_saved_at = new Date();
  await instance.save();

  return response.json({
    message: 'Auto-evaluation enregistree.',
    ...buildEvaluationPayload(instance, request.user),
  });
}

async function submitMyAssistantEvaluation(request, response) {
  const instance = await getOrCreateAssistantEvaluation(request.user);
  const sections = normalizeSections(instance.sections);
  const managerRecipients = Array.isArray(request.body?.managerRecipients)
    ? request.body.managerRecipients
        .filter((recipient) => recipient?.manager && recipient?.department)
        .map((recipient) => ({
          manager: String(recipient.manager).trim(),
          department: String(recipient.department).trim(),
        }))
    : [];
  const missingAnswers = validateSectionsForSubmit(sections);

  if (missingAnswers.length) {
    return response.status(400).json({
      message: 'Toutes les questions obligatoires doivent etre renseignees avant soumission.',
      missingAnswers,
    });
  }

  instance.sections = sections.map((section) => ({
    section_id: section.id,
    title: section.title,
    subtitle: section.subtitle,
    status: section.status,
    comment: section.comment,
    criteria: section.criteria,
  }));
  instance.status = 'Soumis aux Managers';
  instance.submitted_to_role = 'manager';
  instance.submitted_to_managers = managerRecipients;
  instance.submitted_at = new Date();
  instance.last_saved_at = new Date();
  await instance.save();

  return response.json({
    message: managerRecipients.length
      ? `Auto-evaluation soumise aux managers concernes (${managerRecipients.map((recipient) => recipient.manager).join(', ')}).`
      : 'Auto-evaluation soumise au manager.',
    ...buildEvaluationPayload(instance, request.user),
  });
}

async function getMyAssistantResults(request, response) {
  const instance = await getOrCreateAssistantEvaluation(request.user);
  const sections = normalizeSections(instance.sections);
  const scoreFinal = getOverallAverageScore(sections);

  const assistantUsers = await User.find({
    grade: 'Assistant',
    is_active: true,
    _id: { $ne: request.user._id },
  }).select('_id');

  const otherIds = assistantUsers.map((user) => user._id);
  const otherInstances = otherIds.length
    ? await EvaluationInstance.find({
        evalue_id: { $in: otherIds },
        cycle_label: CURRENT_CYCLE_LABEL,
        template_type: 'assistant-self-evaluation',
      })
    : [];

  const teamScores = otherInstances
    .map((otherInstance) => getOverallAverageScore(normalizeSections(otherInstance.sections)))
    .filter((score) => typeof score === 'number');
  const comparedAssistantsCount = teamScores.length;

  const teamAverage = teamScores.length
    ? Number((teamScores.reduce((total, score) => total + score, 0) / teamScores.length).toFixed(1))
    : scoreFinal;

  const teamDelta = typeof scoreFinal === 'number' && typeof teamAverage === 'number'
    ? Number((scoreFinal - teamAverage).toFixed(1))
    : 0;

  const comparisonSubtitle =
    teamDelta > 0 ? 'Au-dessus de la moyenne'
      : teamDelta < 0 ? 'En-dessous de la moyenne'
        : 'Égal à la moyenne';

  return response.json({
    cycle_label: CURRENT_CYCLE_LABEL,
    status: instance.status,
    sectionScores: sections.map((section) => ({
      sectionId: section.id,
      title: section.title,
      label: section.subtitle,
      score: getAverageScore(section),
      percent: Math.round(((getAverageScore(section) || 0) / 5) * 100),
    })),
    kpis: {
      scoreFinal: scoreFinal || 0,
      scoreFinalPercent: Math.round(((scoreFinal || 0) / 5) * 100),
      comparaisonEquipe: teamDelta,
      comparaisonEquipeLabel: teamDelta > 0 ? `+${teamDelta}` : `${teamDelta}`,
      comparaisonEquipeSubtitle: comparisonSubtitle,
      moyenneEquipe: teamAverage || 0,
      assistantsEvalues: comparedAssistantsCount,
    },
  });
}

module.exports = {
  getMyAssistantEvaluation,
  getMyAssistantResults,
  saveMyAssistantEvaluation,
  submitMyAssistantEvaluation,
};
