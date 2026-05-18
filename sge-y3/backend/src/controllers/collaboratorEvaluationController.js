const EvaluationInstance = require('../models/EvaluationInstance');
const User = require('../models/User');
const { cloneAssistantEvaluationTemplate } = require('../utils/assistantEvaluationTemplate');
const { cloneSeniorEvaluationTemplate } = require('../utils/seniorEvaluationTemplate');
const {
  getAverageScore,
  getEvaluationSummary,
  getOverallAverageScore,
  normalizeSections,
  validateSectionsForSubmit,
} = require('../utils/evaluationHelpers');

const CURRENT_CYCLE_LABEL = 'Cycle 2025-2026';

function normalizeText(value = '') {
  return String(value || '').replace(/\s+/g, ' ').trim().toUpperCase();
}

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
    .select('_id name first_name last_name grade department code_categorie');
}

async function resolveMissionRecipientsForAssistant(user) {
  const targetDepartments = getManagerDepartmentsForDepartment(user.department);

  if (!targetDepartments.length) {
    return [];
  }

  return User.find({
    is_active: true,
    code_categorie: { $in: ['9A', '9B', '10B', '10C'] },
    department: { $in: targetDepartments },
  })
    .sort({ last_name: 1, first_name: 1 })
    .select('_id name first_name last_name grade department code_categorie');
}

async function resolveManagersForSenior(user) {
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
    .select('_id name first_name last_name grade department code_categorie');
}

async function resolveRecipientsForInstance(instance, user) {
  if (instance?.template_type === 'senior-self-evaluation') {
    return resolveManagersForSenior(user);
  }

  return resolveManagersForAssistant(user);
}

function buildRecipientOptions(recipients = [], user) {
  const targetDepartments = getManagerDepartmentsForDepartment(user?.department);

  return targetDepartments.map((department) => {
    const users = recipients.filter(
      (recipient) => String(recipient.department || '').trim().toUpperCase() === String(department || '').trim().toUpperCase()
    );

    return {
      department,
      users: users.map((recipient) => ({
        id: recipient._id.toString(),
        name: recipient.name,
        first_name: recipient.first_name,
        last_name: recipient.last_name,
        grade: recipient.grade,
        department: recipient.department,
        code_categorie: recipient.code_categorie,
      })),
    };
  });
}

function buildMissionRecipients(recipients = []) {
  return recipients.map((recipient) => ({
    user_id: recipient._id,
    name: recipient.name,
    grade: recipient.grade,
    department: recipient.department,
  }));
}

function mergeManagerRecipients(explicitRecipients = [], resolvedManagers = []) {
  const seen = new Set();
  const merged = [];

  const pushRecipient = (recipient = {}) => {
    const manager = String(recipient.manager || recipient.name || '').trim();
    const department = String(recipient.department || '').trim();

    if (!manager || !department) {
      return;
    }

    const key = `${department}::${manager}`;
    if (seen.has(key)) {
      return;
    }

    seen.add(key);
    merged.push({
      department,
      manager,
    });
  };

  explicitRecipients.forEach(pushRecipient);
  resolvedManagers.forEach((manager) =>
    pushRecipient({
      manager: manager.name,
      department: manager.department,
    })
  );

  return merged;
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

function normalizeMissionEvaluations(missionEvaluations = []) {
  return missionEvaluations.map((mission) => ({
    mission_id: String(mission.id || mission.mission_id || '').trim(),
    title: String(mission.title || '').trim(),
    period: String(mission.period || '').trim(),
    department: String(mission.department || '').trim(),
    created_by_role: String(mission.created_by_role || mission.createdByRole || 'self').trim() || 'self',
    assigned_by_user_id: mission.assigned_by_user_id || mission.assignedByUserId || null,
    assigned_by_name: String(mission.assigned_by_name || mission.assignedByName || '').trim(),
    assigned_by_grade: String(mission.assigned_by_grade || mission.assignedByGrade || '').trim(),
    assigned_at: mission.assigned_at || mission.assignedAt || null,
    primary_recipient_user_id: mission.primary_recipient_user_id || mission.primaryRecipientUserId || mission.primaryRecipientId || null,
    primary_recipient_name: String(mission.primary_recipient_name || mission.primaryRecipientName || '').trim(),
    primary_recipient_grade: String(mission.primary_recipient_grade || mission.primaryRecipientGrade || '').trim(),
    primary_recipient_department: String(
      mission.primary_recipient_department || mission.primaryRecipientDepartment || ''
    ).trim(),
    recipients: Array.isArray(mission.recipients)
      ? mission.recipients
          .filter((recipient) => (recipient?.id || recipient?.user_id) && recipient?.name)
          .map((recipient) => ({
            user_id: recipient.id || recipient.user_id,
            name: String(recipient.name || '').trim(),
            grade: String(recipient.grade || '').trim(),
            department: String(recipient.department || '').trim(),
          }))
      : [],
    criteria: Array.isArray(mission.criteria)
      ? mission.criteria.map((criterion) => ({
          criterion_id: String(criterion.id || criterion.criterion_id || '').trim(),
          section_title: String(criterion.sectionTitle || criterion.section_title || '').trim(),
          page_title: String(criterion.pageTitle || criterion.page_title || '').trim(),
          source_sheet: String(criterion.sourceSheet || criterion.source_sheet || '').trim(),
          source_label: String(criterion.sourceLabel || criterion.source_label || '').trim(),
          theme_code: String(criterion.themeCode || criterion.theme_code || '').trim(),
          label: String(criterion.label || '').trim(),
          statement: String(criterion.statement || '').trim(),
          score: criterion.score ?? null,
        }))
      : [],
    comment: String(mission.comment || '').trim(),
    status: String(mission.status || 'Brouillon').trim(),
    submitted_at: mission.submitted_at || null,
  }));
}

function formatMissionEvaluations(missionEvaluations = []) {
  return missionEvaluations.map((mission) => ({
    id: mission.mission_id,
    title: mission.title,
    period: mission.period,
    department: mission.department,
    createdByRole: mission.created_by_role || 'self',
    assignedByUserId: mission.assigned_by_user_id?.toString?.() || String(mission.assigned_by_user_id || ''),
    assignedByName: mission.assigned_by_name || '',
    assignedByGrade: mission.assigned_by_grade || '',
    assignedAt: mission.assigned_at || null,
    primaryRecipientUserId:
      mission.primary_recipient_user_id?.toString?.() || String(mission.primary_recipient_user_id || ''),
    primaryRecipientName: mission.primary_recipient_name || '',
    primaryRecipientGrade: mission.primary_recipient_grade || '',
    primaryRecipientDepartment: mission.primary_recipient_department || '',
    recipients: (mission.recipients || []).map((recipient) => ({
      id: recipient.user_id?.toString?.() || String(recipient.user_id || ''),
      name: recipient.name,
      grade: recipient.grade,
      department: recipient.department,
    })),
    criteria: (mission.criteria || []).map((criterion) => ({
      id: criterion.criterion_id,
      sectionTitle: criterion.section_title,
      pageTitle: criterion.page_title,
      sourceSheet: criterion.source_sheet,
      sourceLabel: criterion.source_label,
      themeCode: criterion.theme_code,
      label: criterion.label,
      statement: criterion.statement,
      score: criterion.score,
    })),
    comment: mission.comment || '',
    status: mission.status || 'Brouillon',
    submitted_at: mission.submitted_at || null,
  }));
}

function validateMissionEvaluations(missionEvaluations = []) {
  for (const mission of missionEvaluations) {
    for (const criterion of mission.criteria || []) {
      if (criterion.score !== null && criterion.score !== undefined) {
        if (!Number.isInteger(criterion.score) || criterion.score < 1 || criterion.score > 5) {
          return `La note du critere "${criterion.label}" doit etre comprise entre 1 et 5.`;
        }
      }
    }
  }

  return '';
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

function formatManagerRecipients(recipients = []) {
  if (!recipients.length) {
    return '';
  }

  return recipients
    .map((recipient) => recipient.manager)
    .filter(Boolean)
    .join(', ');
}

async function buildEvaluationPayload(instance, user) {
  const sections = normalizeSections(instance.sections);
  const activeSection = sections.find((section) => section.status !== 'Complete') || sections[0] || null;
  const managers = await resolveRecipientsForInstance(instance, user);
  const missionRecipients =
    instance?.template_type === 'assistant-self-evaluation'
      ? await resolveMissionRecipientsForAssistant(user)
      : managers;
  const submittedTo =
    formatManagerRecipients(instance.submitted_to_managers) || formatSubmissionTarget(managers);

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
      submitted_to: submittedTo,
      submitted_to_users: managers.map((manager) => ({
        id: manager._id.toString(),
        name: manager.name,
        first_name: manager.first_name,
        last_name: manager.last_name,
        grade: manager.grade,
        department: manager.department,
        code_categorie: manager.code_categorie,
      })),
      recipient_options: buildRecipientOptions(missionRecipients, user),
      submitted_to_managers: instance.submitted_to_managers || [],
    },
    mission_evaluations: formatMissionEvaluations(instance.mission_evaluations || []),
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
  return getOrCreateSelfEvaluation(user, 'assistant-self-evaluation', cloneAssistantEvaluationTemplate);
}

async function getOrCreateSeniorEvaluation(user) {
  return getOrCreateSelfEvaluation(user, 'senior-self-evaluation', cloneSeniorEvaluationTemplate);
}

async function getOrCreateSelfEvaluation(user, templateType, cloneTemplate) {
  let instance = await EvaluationInstance.findOne({
    evalue_id: user._id,
    cycle_label: CURRENT_CYCLE_LABEL,
    template_type: templateType,
  });

  const templateSections = cloneTemplate(user);

  if (!instance) {
    instance = await EvaluationInstance.create({
      cycle_label: CURRENT_CYCLE_LABEL,
      evalue_id: user._id,
      status: 'En cours',
      template_type: templateType,
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
  return saveMySelfEvaluation(request, response, getOrCreateAssistantEvaluation);
}

async function saveMySeniorEvaluation(request, response) {
  return saveMySelfEvaluation(request, response, getOrCreateSeniorEvaluation);
}

async function saveMySelfEvaluation(request, response, getOrCreateEvaluation) {
  const rawSections = Array.isArray(request.body?.sections) ? request.body.sections : null;
  const rawMissionEvaluations = Array.isArray(request.body?.missionEvaluations) ? request.body.missionEvaluations : null;

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

  let missionEvaluations = rawMissionEvaluations ? normalizeMissionEvaluations(rawMissionEvaluations) : null;
  const missionValidationMessage = missionEvaluations ? validateMissionEvaluations(missionEvaluations) : '';

  if (missionValidationMessage) {
    return response.status(400).json({
      message: missionValidationMessage,
    });
  }

  const instance = await getOrCreateEvaluation(request.user);
  const summary = getEvaluationSummary(sections);
  const resolvedManagers = await resolveRecipientsForInstance(instance, request.user);
  const resolvedMissionRecipients =
    instance.template_type === 'assistant-self-evaluation'
      ? await resolveMissionRecipientsForAssistant(request.user)
      : resolvedManagers;

  if (missionEvaluations && instance.template_type === 'assistant-self-evaluation') {
    const availableRecipients = buildMissionRecipients(resolvedMissionRecipients);
    missionEvaluations = missionEvaluations.map((mission) => ({
      ...mission,
      department: mission.department || request.user.department || '',
      recipients:
        mission.created_by_role === 'senior'
          ? [
              {
                user_id: mission.assigned_by_user_id || null,
                name: mission.assigned_by_name || 'Senior',
                grade: mission.assigned_by_grade || 'Senior',
                department: mission.department || request.user.department || '',
              },
            ]
          : Array.isArray(mission.recipients) && mission.recipients.length
            ? mission.recipients
            : [],
      primary_recipient_user_id:
        mission.created_by_role === 'senior'
          ? mission.assigned_by_user_id || null
          : mission.primary_recipient_user_id || mission.recipients?.[0]?.user_id || null,
      primary_recipient_name:
        mission.created_by_role === 'senior'
          ? mission.assigned_by_name || 'Senior'
          : mission.primary_recipient_name || mission.recipients?.[0]?.name || '',
      primary_recipient_grade:
        mission.created_by_role === 'senior'
          ? mission.assigned_by_grade || 'Senior'
          : mission.primary_recipient_grade || mission.recipients?.[0]?.grade || '',
      primary_recipient_department:
        mission.created_by_role === 'senior'
          ? mission.department || request.user.department || ''
          : mission.primary_recipient_department || mission.recipients?.[0]?.department || '',
      recipients: (mission.recipients || []).filter((recipient) =>
        availableRecipients.some(
          (candidate) =>
            String(candidate.user_id) === String(recipient.user_id) ||
            (candidate.name === recipient.name && candidate.department === recipient.department)
        )
      ),
    }));
  }

  instance.sections = toPersistenceSections(sections);
  if (missionEvaluations) {
    instance.mission_evaluations = missionEvaluations;
  }
  instance.status = summary.globalProgress === 0 ? 'Brouillon' : 'En cours';
  instance.last_saved_at = new Date();
  await instance.save();

  return response.json({
    message: 'Auto-evaluation enregistree.',
    ...(await buildEvaluationPayload(instance, request.user)),
  });
}

async function submitMyAssistantEvaluation(request, response) {
  return submitMySelfEvaluation(request, response, getOrCreateAssistantEvaluation, true);
}

async function submitMyAssistantMissionEvaluation(request, response) {
  return submitMySelfMissionEvaluation(request, response, getOrCreateAssistantEvaluation);
}

async function submitMySeniorMissionEvaluation(request, response) {
  return submitMySelfMissionEvaluation(request, response, getOrCreateSeniorEvaluation);
}

async function submitMySelfMissionEvaluation(request, response, getOrCreateEvaluation) {
  const missionId = String(request.body?.missionId || '').trim();

  if (!missionId) {
    return response.status(400).json({
      message: 'La mission a soumettre est requise.',
    });
  }

  const instance = await getOrCreateEvaluation(request.user);
  const missionEvaluations = normalizeMissionEvaluations(instance.mission_evaluations || []);
  const mission = missionEvaluations.find((item) => item.mission_id === missionId);

  if (!mission) {
    return response.status(404).json({
      message: 'Mission introuvable.',
    });
  }

  const hasIncompleteCriterion = (mission.criteria || []).some(
    (criterion) => criterion.score === null || criterion.score === undefined
  );

  if (hasIncompleteCriterion) {
    return response.status(400).json({
      message: 'Toutes les questions de la mission doivent etre renseignees avant soumission.',
    });
  }

  mission.status = 'Soumise';
  mission.submitted_at = new Date();
  instance.mission_evaluations = missionEvaluations;
  instance.last_saved_at = new Date();
  await instance.save();

  return response.json({
    message: `Mission soumise a ${mission.recipients.map((recipient) => recipient.name).join(', ')}.`,
    ...(await buildEvaluationPayload(instance, request.user)),
  });
}

async function submitMySeniorEvaluation(request, response) {
  return submitMySelfEvaluation(request, response, getOrCreateSeniorEvaluation, false);
}

async function submitMySelfEvaluation(request, response, getOrCreateEvaluation, allowExplicitRecipients) {
  const instance = await getOrCreateEvaluation(request.user);
  const sections = normalizeSections(instance.sections);
  const managerRecipients =
    allowExplicitRecipients && Array.isArray(request.body?.managerRecipients)
      ? request.body.managerRecipients
          .filter((recipient) => recipient?.manager && recipient?.department)
          .map((recipient) => ({
            manager: String(recipient.manager).trim(),
            department: String(recipient.department).trim(),
          }))
      : [];
  const missingAnswers = validateSectionsForSubmit(sections);
  const resolvedManagers = await resolveRecipientsForInstance(instance, request.user);
  const mergedManagerRecipients = mergeManagerRecipients(
    managerRecipients.filter((recipient) =>
      resolvedManagers.some(
        (manager) =>
          normalizeText(manager.name || '') === normalizeText(recipient.manager || '') &&
          normalizeText(manager.department || '') === normalizeText(recipient.department || '')
      )
    ),
    resolvedManagers
  );

  if (missingAnswers.length) {
    return response.status(400).json({
      message: 'Toutes les questions obligatoires doivent etre renseignees avant soumission.',
      missingAnswers,
    });
  }

  instance.sections = toPersistenceSections(sections);
  instance.status = 'Soumis aux Managers';
  instance.submitted_to_role = 'manager';
  instance.submitted_to_managers = mergedManagerRecipients;
  instance.submitted_to_user_ids = resolvedManagers.map((manager) => manager._id);
  instance.submitted_to_names = mergedManagerRecipients.length
    ? mergedManagerRecipients.map((recipient) => recipient.manager)
    : resolvedManagers.map((manager) => manager.name);
  instance.submitted_at = new Date();
  instance.last_saved_at = new Date();
  await instance.save();

  return response.json({
    message: mergedManagerRecipients.length
      ? `Auto-evaluation soumise aux managers concernes (${mergedManagerRecipients.map((recipient) => recipient.manager).join(', ')}).`
      : `Auto-evaluation soumise a ${formatSubmissionTarget(resolvedManagers)}.`,
    ...(await buildEvaluationPayload(instance, request.user)),
  });
}

async function getMySeniorEvaluation(request, response) {
  const instance = await getOrCreateSeniorEvaluation(request.user);
  return response.json(await buildEvaluationPayload(instance, request.user));
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
    teamDelta > 0 ? 'Au-dessus de la moyenne' : teamDelta < 0 ? 'En-dessous de la moyenne' : 'Egal a la moyenne';

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
  getMySeniorEvaluation,
  saveMyAssistantEvaluation,
  saveMySeniorEvaluation,
  submitMyAssistantMissionEvaluation,
  submitMyAssistantEvaluation,
  submitMySeniorMissionEvaluation,
  submitMySeniorEvaluation,
};
