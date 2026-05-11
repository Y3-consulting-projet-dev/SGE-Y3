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

function getManagerDepartmentsForDepartment(department = '') {
  const normalized = String(department || '').replace(/\s+/g, ' ').trim().toUpperCase();

  if (normalized === 'AUDIT & EXPERTISE COMPTABLE') {
    return ['AUDIT', 'EXPERTISE COMPTABLE', 'AUDIT & EXPERTISE COMPTABLE'];
  }

  return normalized ? [normalized] : [];
}

async function resolveManagersForAssistant(user) {
  const targetDepartments = getManagerDepartmentsForDepartment(user.department);

  if (!targetDepartments.length) {
    return [];
  }

  return User.find({
    is_active: true,
    code_categorie: { $in: ['10B', '10C'] },
    department: { $in: targetDepartments },
  })
    .sort({ last_name: 1, first_name: 1 })
    .select('_id name first_name last_name grade department');
}

function toPersistenceSections(sections = []) {
  return sections.map((section) => ({
    section_id: section.id,
    title: section.title,
    subtitle: section.subtitle,
    status: section.status,
    comment: section.comment || '',
    pages: (section.pages || []).map((page) => ({
      page_id: page.page_id,
      title: page.title,
      source_sheet: page.source_sheet || '',
      source_label: page.source_label || '',
      comment: page.comment || '',
      themes: (page.themes || []).map((theme) => ({
        theme_id: theme.theme_id,
        code: theme.code,
        label: theme.label,
        statement: theme.statement,
        score: theme.score,
        required: theme.required !== false,
      })),
    })),
    criteria: (section.criteria || []).map((criterion) => ({
      criterion_id: criterion.criterion_id || '',
      label: criterion.label,
      statement: criterion.statement || '',
      page_id: criterion.page_id || '',
      page_title: criterion.page_title || '',
      source_sheet: criterion.source_sheet || '',
      source_label: criterion.source_label || '',
      theme_code: criterion.theme_code || '',
      score: criterion.score,
      required: criterion.required !== false,
    })),
  }));
}

function formatSubmissionTarget(managers = []) {
  if (!managers.length) {
    return 'Manager du departement';
  }

  return managers
    .map((manager) => manager.name || [manager.first_name, manager.last_name].filter(Boolean).join(' ').trim())
    .filter(Boolean)
    .join(', ');
}

async function buildEvaluationPayload(instance, user) {
  const sections = normalizeSections(instance.sections);
  const activeSection = sections.find((section) => section.status !== 'Complete') || sections[0] || null;
  const managers = await resolveManagersForAssistant(user);

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
      submitted_to: formatSubmissionTarget(managers),
      submitted_to_users: managers.map((manager) => ({
        id: manager._id.toString(),
        name: manager.name,
        first_name: manager.first_name,
        last_name: manager.last_name,
        grade: manager.grade,
        department: manager.department,
      })),
    },
  };
}

function shouldResetToCurrentTemplate(instance, templateSections) {
  const currentSections = normalizeSections(instance.sections);

  if (!currentSections.length || currentSections.length !== templateSections.length) {
    return true;
  }

  const hasNoPages = currentSections.some((section) => !section.pages?.length);
  const hasDifferentPageCount = currentSections.some(
    (section, index) => (section.pages?.length || 0) !== (templateSections[index]?.pages?.length || 0)
  );
  const hasMissingSourceMetadata = currentSections.some((section, index) =>
    (section.pages || []).some((page, pageIndex) => {
      const templatePage = templateSections[index]?.pages?.[pageIndex];
      const templateHasSource = Boolean(templatePage?.source_sheet || templatePage?.source_label);
      const currentHasSource = Boolean(page.source_sheet || page.source_label);

      return templateHasSource && !currentHasSource;
    })
  );

  if (!hasNoPages && !hasDifferentPageCount && !hasMissingSourceMetadata) {
    return false;
  }

  return instance.status === 'En cours' || instance.status === 'Brouillon';
}

async function getOrCreateAssistantEvaluation(user) {
  let instance = await EvaluationInstance.findOne({
    evalue_id: user._id,
    cycle_label: CURRENT_CYCLE_LABEL,
    template_type: 'assistant-self-evaluation',
  });

  const templateSections = cloneAssistantEvaluationTemplate(user);

  if (!instance) {
    instance = await EvaluationInstance.create({
      cycle_label: CURRENT_CYCLE_LABEL,
      evalue_id: user._id,
      status: 'En cours',
      template_type: 'assistant-self-evaluation',
      sections: toPersistenceSections(templateSections),
      last_saved_at: new Date(),
    });
  } else if (shouldResetToCurrentTemplate(instance, templateSections)) {
    instance.sections = toPersistenceSections(templateSections);
    instance.last_saved_at = new Date();
    await instance.save();
  }

  return instance;
}

async function getMyAssistantEvaluation(request, response) {
  const instance = await getOrCreateAssistantEvaluation(request.user);
  return response.json(await buildEvaluationPayload(instance, request.user));
}

async function saveMyAssistantEvaluation(request, response) {
  const rawSections = Array.isArray(request.body?.sections) ? request.body.sections : null;

  if (!rawSections?.length) {
    return response.status(400).json({
      message: "Les sections de l'auto-evaluation sont requises.",
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

  instance.sections = toPersistenceSections(sections);
  instance.status = summary.globalProgress === 0 ? 'Brouillon' : 'En cours';
  instance.last_saved_at = new Date();
  await instance.save();

  return response.json({
    message: 'Auto-evaluation enregistree.',
    ...(await buildEvaluationPayload(instance, request.user)),
  });
}

async function submitMyAssistantEvaluation(request, response) {
  const instance = await getOrCreateAssistantEvaluation(request.user);
  const sections = normalizeSections(instance.sections);
  const missingAnswers = validateSectionsForSubmit(sections);
  const managers = await resolveManagersForAssistant(request.user);

  if (missingAnswers.length) {
    return response.status(400).json({
      message: 'Toutes les questions obligatoires doivent etre renseignees avant soumission.',
      missingAnswers,
    });
  }

  instance.sections = toPersistenceSections(sections);
  instance.status = 'Soumis au Manager';
  instance.submitted_to_role = 'manager';
  instance.submitted_to_user_ids = managers.map((manager) => manager._id);
  instance.submitted_to_names = managers.map((manager) => manager.name);
  instance.submitted_at = new Date();
  instance.last_saved_at = new Date();
  await instance.save();

  return response.json({
    message: `Auto-evaluation soumise a ${formatSubmissionTarget(managers)}.`,
    ...(await buildEvaluationPayload(instance, request.user)),
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

  const teamDelta =
    typeof scoreFinal === 'number' && typeof teamAverage === 'number'
      ? Number((scoreFinal - teamAverage).toFixed(1))
      : 0;

  const comparisonSubtitle =
    teamDelta > 0 ? 'Au-dessus de la moyenne' : teamDelta < 0 ? 'En-dessous de la moyenne' : 'Égal à la moyenne';

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
