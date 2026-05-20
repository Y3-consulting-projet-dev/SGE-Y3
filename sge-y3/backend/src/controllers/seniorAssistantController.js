const User = require('../models/User');
const SeniorAssistantReview = require('../models/SeniorAssistantReview');
const EvaluationInstance = require('../models/EvaluationInstance');
const { buildEvaluationTemplateForUser } = require('../utils/competencyMatrix');
const {
  getAverageScore,
  getEvaluationSummary,
  getOverallAverageScore,
  getPageJustifications,
  normalizeSections,
  validateLowScorePageComments,
  validateSectionCommentsForSubmit,
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

function getAssistantDepartmentsForSupervisor(department = '') {
  const normalized = String(department || '').replace(/\s+/g, ' ').trim().toUpperCase();

  if (normalized === 'AUDIT') {
    return ['AUDIT', 'AUDIT & EXPERTISE COMPTABLE'];
  }

  if (normalized === 'EXPERTISE COMPTABLE') {
    return ['EXPERTISE COMPTABLE', 'AUDIT & EXPERTISE COMPTABLE'];
  }

  if (normalized === 'AUDIT & EXPERTISE COMPTABLE') {
    return ['AUDIT', 'EXPERTISE COMPTABLE', 'AUDIT & EXPERTISE COMPTABLE'];
  }

  return normalized ? [normalized] : [];
}

async function resolveManagersForDepartment(department) {
  const targetDepartments = getManagerDepartmentsForDepartment(department);

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

async function resolveManagersForSeniorReview(seniorUser, assistant) {
  return resolveManagersForDepartment(resolveEvaluationDepartmentForSeniorReview(seniorUser, assistant));
}

async function resolveHierarchyRecipientsForAssistant(assistant, departmentOverride = '') {
  const targetDepartments = getManagerDepartmentsForDepartment(departmentOverride || assistant?.department);

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

function cloneAssistantTemplateForDepartment(department = '') {
  return buildEvaluationTemplateForUser({
    grade: 'Assistant',
    department,
  }).map((section) => ({
    ...section,
    pages: (section.pages || []).map((page) => ({
      ...page,
      themes: (page.themes || []).map((theme) => ({ ...theme })),
    })),
    criteria: (section.criteria || []).map((criterion) => ({ ...criterion })),
  }));
}

function resolveEvaluationDepartmentForSeniorReview(seniorUser, assistant) {
  const seniorDepartment = normalizeText(seniorUser?.department || '');
  const assistantDepartment = normalizeText(assistant?.department || '');

  if (
    assistantDepartment === 'AUDIT & EXPERTISE COMPTABLE' &&
    (seniorDepartment === 'AUDIT' || seniorDepartment === 'EXPERTISE COMPTABLE')
  ) {
    return seniorDepartment;
  }

  return assistant?.department || seniorUser?.department || '';
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
      theme_code: criterion.theme_code || '',
      score: criterion.score,
      required: criterion.required !== false,
    })),
  }));
}

function buildAssistantMissionCriteria(sections = []) {
  return sections.flatMap((section) =>
    (section.pages || []).flatMap((page) =>
      (page.themes || []).map((theme) => ({
        criterion_id: `${page.page_id}-${theme.theme_id}`,
        section_title: section.title,
        page_title: page.title,
        source_sheet: page.source_sheet || '',
        source_label: page.source_label || '',
        theme_code: theme.code,
        label: theme.label,
        statement: theme.statement || '',
        score: null,
      }))
    )
  );
}

function filterMissionCriteriaForDepartment(criteria = [], department = '') {
  return criteria.filter((criterion) =>
    shouldIncludePageForManager(
      {
        source_sheet: criterion.source_sheet || criterion.sourceSheet || '',
      },
      department
    )
  );
}

function buildMissionRecipientsForAssistant(recipients = []) {
  return recipients.map((recipient) => ({
    user_id: recipient._id,
    name: recipient.name,
    grade: recipient.grade,
    department: recipient.department,
  }));
}

function normalizeMissionReviews(missionReviews = []) {
  return missionReviews.map((mission) => ({
    mission_id: String(mission.id || mission.mission_id || '').trim(),
    title: String(mission.title || '').trim(),
    period: String(mission.period || '').trim(),
    department: String(mission.department || '').trim(),
    origin: String(mission.origin || 'assistant-self').trim() || 'assistant-self',
    assigned_at: mission.assigned_at || mission.assignedAt || null,
    assigned_by_name: String(mission.assigned_by_name || mission.assignedByName || '').trim(),
    assigned_by_grade: String(mission.assigned_by_grade || mission.assignedByGrade || '').trim(),
    recipient_name: String(mission.recipient_name || mission.recipientName || '').trim(),
    recipient_grade: String(mission.recipient_grade || mission.recipientGrade || '').trim(),
    recipient_department: String(mission.recipient_department || mission.recipientDepartment || '').trim(),
    assistant_submitted_at: mission.assistant_submitted_at || mission.assistantSubmittedAt || null,
    status: String(mission.status || 'A demarrer').trim(),
    comment: String(mission.comment || '').trim(),
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
    submitted_at: mission.submitted_at || mission.submittedAt || null,
  }));
}

function formatMissionReviews(missionReviews = []) {
  return missionReviews.map((mission) => ({
    id: mission.mission_id,
    title: mission.title,
    period: mission.period,
    department: mission.department,
    origin: mission.origin || 'assistant-self',
    assignedAt: mission.assigned_at || null,
    assignedByName: mission.assigned_by_name || '',
    assignedByGrade: mission.assigned_by_grade || '',
    recipientName: mission.recipient_name,
    recipientGrade: mission.recipient_grade,
    recipientDepartment: mission.recipient_department,
    assistantSubmittedAt: mission.assistant_submitted_at,
    status: mission.status,
    comment: mission.comment || '',
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
    submittedAt: mission.submitted_at,
  }));
}

function createMissionReviewFromAssistantMission(mission, seniorUser) {
  const evaluationDepartment = resolveEvaluationDepartmentForSeniorReview(seniorUser, { department: mission.department });
  const recipient = (mission.recipients || []).find(
    (item) => isMissionRecipientForUser(item, seniorUser)
  );

  return {
    mission_id: mission.mission_id,
    title: mission.title,
    period: mission.period,
    department: mission.department,
    origin: mission.created_by_role === 'senior' ? 'senior-assigned' : 'assistant-self',
    assigned_at: mission.assigned_at || null,
    assigned_by_name: mission.assigned_by_name || '',
    assigned_by_grade: mission.assigned_by_grade || '',
    recipient_name: recipient?.name || seniorUser.name,
    recipient_grade: recipient?.grade || seniorUser.grade,
    recipient_department: recipient?.department || seniorUser.department,
    assistant_submitted_at: mission.submitted_at || null,
    status: 'A demarrer',
    comment: '',
    criteria: filterMissionCriteriaForDepartment(mission.criteria || [], evaluationDepartment).map((criterion) => ({
      criterion_id: criterion.criterion_id,
      section_title: criterion.section_title,
      page_title: criterion.page_title,
      source_sheet: criterion.source_sheet,
      source_label: criterion.source_label,
      theme_code: criterion.theme_code,
      label: criterion.label,
      statement: criterion.statement,
      score: null,
    })),
    submitted_at: null,
  };
}

function isMissionRecipientForUser(recipient, user) {
  if (!recipient || !user) {
    return false;
  }

  const recipientUserId = recipient.user_id?.toString?.() || String(recipient.user_id || recipient.id || '');
  if (recipientUserId && recipientUserId === String(user._id)) {
    return true;
  }

  const sameName = normalizeText(recipient.name || '') === normalizeText(user.name || '');
  const sameDepartment = normalizeText(recipient.department || '') === normalizeText(user.department || '');
  return sameName && sameDepartment;
}

function isAssistantMissionVisibleToSupervisor(mission, user) {
  if (!mission || !user) {
    return false;
  }

  if (mission.created_by_role === 'senior') {
    const assignedByUserId = mission.assigned_by_user_id?.toString?.() || String(mission.assigned_by_user_id || '');
    if (assignedByUserId) {
      return assignedByUserId === String(user._id);
    }

    return normalizeText(mission.assigned_by_name || '') === normalizeText(user.name || '');
  }

  const primaryRecipientUserId =
    mission.primary_recipient_user_id?.toString?.() || String(mission.primary_recipient_user_id || '');

  if (primaryRecipientUserId) {
    return primaryRecipientUserId === String(user._id);
  }

  const primaryRecipientName = normalizeText(mission.primary_recipient_name || '');
  const primaryRecipientDepartment = normalizeText(
    mission.primary_recipient_department || mission.department || user.department || ''
  );

  if (primaryRecipientName) {
    return (
      primaryRecipientName === normalizeText(user.name || '') &&
      primaryRecipientDepartment === normalizeText(user.department || '')
    );
  }

  if ((mission.recipients || []).length === 1) {
    return isMissionRecipientForUser(mission.recipients[0], user);
  }

  return Boolean((mission.recipients || []).length) && isMissionRecipientForUser(mission.recipients[0], user);
}

async function getAssistantSubmittedMissionsForSenior(assistantId, seniorUser) {
  const instance = await EvaluationInstance.findOne({
    evalue_id: assistantId,
    cycle_label: CURRENT_CYCLE_LABEL,
    template_type: 'assistant-self-evaluation',
  }).select('mission_evaluations');

  if (!instance) {
    return [];
  }

  return (instance.mission_evaluations || []).filter(
    (mission) =>
      mission.status === 'Soumise' &&
      isAssistantMissionVisibleToSupervisor(mission, seniorUser)
  );
}

async function syncMissionReviews(review, assistant, seniorUser) {
  const submittedMissions = await getAssistantSubmittedMissionsForSenior(assistant._id, seniorUser);
  const currentMissionReviews = normalizeMissionReviews(review.mission_reviews || []);
  const submittedMissionIds = new Set(submittedMissions.map((mission) => mission.mission_id));
  const pendingSeniorAssignedReviews = currentMissionReviews.filter(
    (mission) => mission.origin === 'senior-assigned' && !submittedMissionIds.has(mission.mission_id)
  );
  const nextMissionReviews = submittedMissions.map((mission) => {
    const existingMissionReview = currentMissionReviews.find((item) => item.mission_id === mission.mission_id);

    if (!existingMissionReview) {
      return createMissionReviewFromAssistantMission(mission, seniorUser);
    }

    const seed = createMissionReviewFromAssistantMission(mission, seniorUser);

    return {
      ...seed,
      status: existingMissionReview.status || seed.status,
      comment: existingMissionReview.comment || '',
      submitted_at: existingMissionReview.submitted_at || null,
      criteria: seed.criteria.map((criterion) => {
        const existingCriterion = (existingMissionReview.criteria || []).find((item) => item.criterion_id === criterion.criterion_id);
        return existingCriterion ? { ...criterion, score: existingCriterion.score ?? null } : criterion;
      }),
    };
  });

  review.mission_reviews = [...pendingSeniorAssignedReviews, ...nextMissionReviews];
}

function shouldResetToCurrentTemplate(review, templateSections) {
  const currentSections = normalizeSections(review.sections);

  if (!currentSections.length || currentSections.length !== templateSections.length) {
    return true;
  }

  const hasNoPages = currentSections.some((section) => !section.pages?.length);
  const hasDifferentPageCount = currentSections.some(
    (section, index) => (section.pages?.length || 0) !== (templateSections[index]?.pages?.length || 0)
  );

  if (!hasNoPages && !hasDifferentPageCount) {
    return false;
  }

  return review.status === 'En cours' || review.status === 'Brouillon';
}

async function getAssistantForSenior(seniorUser, assistantId) {
  const assistantDepartments = getAssistantDepartmentsForSupervisor(seniorUser.department);
  const assistant = await User.findOne({
    _id: assistantId,
    is_active: true,
    code_categorie: '8C',
    department: { $in: assistantDepartments },
  }).select('_id name first_name last_name grade department code_categorie');

  return assistant;
}

async function getOrCreateSeniorAssistantReview(seniorUser, assistant) {
  let review = await SeniorAssistantReview.findOne({
    cycle_label: CURRENT_CYCLE_LABEL,
    senior_id: seniorUser._id,
    assistant_id: assistant._id,
  });

  const evaluationDepartment = resolveEvaluationDepartmentForSeniorReview(seniorUser, assistant);
  const templateSections = cloneAssistantTemplateForDepartment(evaluationDepartment);

  if (!review) {
    review = await SeniorAssistantReview.create({
      cycle_label: CURRENT_CYCLE_LABEL,
      senior_id: seniorUser._id,
      assistant_id: assistant._id,
      assistant_department: evaluationDepartment,
      status: 'En cours',
      sections: toPersistenceSections(templateSections),
      last_saved_at: new Date(),
    });
  } else if (shouldResetToCurrentTemplate(review, templateSections)) {
    review.sections = toPersistenceSections(templateSections);
    review.assistant_department = evaluationDepartment;
    review.last_saved_at = new Date();
  }

  await syncMissionReviews(review, assistant, seniorUser);
  await review.save();

  return review;
}

async function getOrCreateAssistantEvaluationInstance(assistant) {
  let instance = await EvaluationInstance.findOne({
    evalue_id: assistant._id,
    cycle_label: CURRENT_CYCLE_LABEL,
    template_type: 'assistant-self-evaluation',
  });

  const templateSections = cloneAssistantTemplateForDepartment(assistant.department);

  if (!instance) {
    instance = await EvaluationInstance.create({
      cycle_label: CURRENT_CYCLE_LABEL,
      evalue_id: assistant._id,
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

function createSeniorAssignedMissionReview({ missionId, title, period, assistant, seniorUser }) {
  const evaluationDepartment = resolveEvaluationDepartmentForSeniorReview(seniorUser, assistant);
  return {
    mission_id: missionId,
    title,
    period,
    department: evaluationDepartment,
    origin: 'senior-assigned',
    assigned_at: new Date(),
    assigned_by_name: seniorUser.name,
    assigned_by_grade: seniorUser.grade,
    recipient_name: seniorUser.name,
    recipient_grade: seniorUser.grade,
    recipient_department: seniorUser.department,
    assistant_submitted_at: null,
    status: 'A demarrer',
    comment: '',
    criteria: buildAssistantMissionCriteria(cloneAssistantTemplateForDepartment(evaluationDepartment)).map((criterion) => ({
      ...criterion,
      score: null,
    })),
    submitted_at: null,
  };
}

function buildReviewPayload(review, seniorUser, assistant, managers = []) {
  const sections = normalizeSections(review.sections);
  const activeSection = sections.find((section) => section.status !== 'Complete') || sections[0] || null;

  return {
    review: {
      id: review._id.toString(),
      cycle_label: review.cycle_label,
      status: review.status,
      submitted_at: review.submitted_at,
      last_saved_at: review.last_saved_at,
      sections,
      activeSectionId: activeSection?.id || 1,
    },
    summary: {
      ...getEvaluationSummary(sections),
      averageScore: activeSection ? getAverageScore(activeSection) : null,
    },
    senior: {
      id: seniorUser._id.toString(),
      name: seniorUser.name,
      grade: seniorUser.grade,
      department: seniorUser.department,
    },
    assistant: {
      id: assistant._id.toString(),
      name: assistant.name,
      first_name: assistant.first_name,
      last_name: assistant.last_name,
      grade: assistant.grade,
      code_categorie: assistant.code_categorie,
      department: assistant.department,
    },
    review_context: {
      evaluationDepartment: review.assistant_department || assistant.department,
    },
    self_evaluation: null,
    mission_reviews: formatMissionReviews(review.mission_reviews || []),
    submitted_to: managers.map((manager) => ({
      id: manager._id.toString(),
      name: manager.name,
      department: manager.department,
      grade: manager.grade,
    })),
  };
}

function buildAssistantSelfEvaluationPayload(instance) {
  const selfSections = normalizeSections(instance?.sections || []);

  return {
    status: instance?.status || 'En attente',
    submitted_at: instance?.submitted_at || null,
    overallAverage: getOverallAverageScore(selfSections),
    sectionScores: selfSections.map((section) => ({
      sectionId: section.id,
      title: section.title,
      score: getAverageScore(section),
      percent: Math.round(((getAverageScore(section) || 0) / 5) * 100),
    })),
    sectionComments: selfSections
      .filter((section) => String(section.comment || '').trim())
      .map((section) => ({
        sectionId: section.id,
        title: section.title,
        comment: String(section.comment || '').trim(),
      })),
    titleJustifications: getPageJustifications(selfSections),
  };
}

async function listMyAssistants(request, response) {
  const assistantDepartments = getAssistantDepartmentsForSupervisor(request.user.department);
  const assistants = await User.find({
    is_active: true,
    code_categorie: '8C',
    department: { $in: assistantDepartments },
  })
    .sort({ last_name: 1, first_name: 1 })
    .select('_id name first_name last_name grade department code_categorie');

  const reviews = assistants.length
    ? await SeniorAssistantReview.find({
        cycle_label: CURRENT_CYCLE_LABEL,
        senior_id: request.user._id,
        assistant_id: { $in: assistants.map((assistant) => assistant._id) },
      }).select('assistant_id status last_saved_at submitted_at')
    : [];

  const reviewByAssistantId = new Map(reviews.map((review) => [String(review.assistant_id), review]));

  return response.json({
    cycle_label: CURRENT_CYCLE_LABEL,
    assistants: assistants.map((assistant) => {
      const review = reviewByAssistantId.get(String(assistant._id));

      return {
        id: assistant._id.toString(),
        name: assistant.name,
        first_name: assistant.first_name,
        last_name: assistant.last_name,
        grade: assistant.grade,
        code_categorie: assistant.code_categorie,
        department: assistant.department,
        review_status: review?.status || 'A demarrer',
        last_saved_at: review?.last_saved_at || null,
        submitted_at: review?.submitted_at || null,
      };
    }),
  });
}

async function listMyCommonMissions(request, response) {
  const { missions } = await buildSeniorOverviewMetrics(request.user);

  return response.json({
    cycle_label: CURRENT_CYCLE_LABEL,
    missions,
  });
}

function isMissionReviewCompleted(missionReview) {
  const criteria = missionReview?.criteria || [];
  return criteria.length > 0 && criteria.every((criterion) => criterion.score !== null && criterion.score !== undefined);
}

function getMissionReviewAverage(criteria = []) {
  const scores = (criteria || []).map((criterion) => criterion.score).filter((score) => typeof score === 'number');

  if (!scores.length) {
    return null;
  }

  return Number((scores.reduce((total, score) => total + score, 0) / scores.length).toFixed(1));
}

async function listMyTransmittedSummaries(request, response) {
  const assistantDepartments = getAssistantDepartmentsForSupervisor(request.user.department);
  const assistants = await User.find({
    is_active: true,
    code_categorie: '8C',
    department: { $in: assistantDepartments },
  })
    .sort({ last_name: 1, first_name: 1 })
    .select('_id name grade department');

  const reviews = assistants.length
    ? await SeniorAssistantReview.find({
        cycle_label: CURRENT_CYCLE_LABEL,
        senior_id: request.user._id,
        assistant_id: { $in: assistants.map((assistant) => assistant._id) },
      }).select('assistant_id status submitted_at sections mission_reviews submitted_to_names')
    : [];

  const assistantById = new Map(assistants.map((assistant) => [String(assistant._id), assistant]));

  const rows = reviews
    .map((review) => {
      const assistant = assistantById.get(String(review.assistant_id));
      const transmittedMissions = (review.mission_reviews || []).filter((mission) => mission.status === 'Transmise');
      const hasGlobalSubmission = review.status === 'Transmis au Manager' && normalizeSections(review.sections || []).length > 0;

      if (!assistant || (!transmittedMissions.length && !hasGlobalSubmission)) {
        return null;
      }

      const normalizedSections = normalizeSections(review.sections || []);

      return {
        assistant: {
          id: assistant._id.toString(),
          name: assistant.name,
          grade: assistant.grade,
          department: assistant.department,
        },
        globalEvaluation: {
          status: review.status || 'Brouillon',
          submittedAt: review.submitted_at || null,
          averageScore: getOverallAverageScore(normalizedSections),
          sectionComments: normalizedSections
            .filter((section) => String(section.comment || '').trim())
            .map((section) => ({
              sectionId: section.id,
              sectionTitle: section.title,
              comment: String(section.comment || '').trim(),
            })),
        },
        missions: transmittedMissions.map((mission) => ({
          id: mission.mission_id,
          title: mission.title,
          period: mission.period,
          department: mission.department,
          status: mission.status,
          submittedAt: mission.submitted_at || null,
          managerNames: review.submitted_to_names || [],
          averageScore: getMissionReviewAverage(mission.criteria || []),
          answeredCriteriaCount: (mission.criteria || []).filter(
            (criterion) => criterion.score !== null && criterion.score !== undefined
          ).length,
          criteriaCount: (mission.criteria || []).length,
        })),
      };
    })
    .filter(Boolean)
    .sort((left, right) => left.assistant.name.localeCompare(right.assistant.name, 'fr', { sensitivity: 'base' }));

  return response.json({
    cycle_label: CURRENT_CYCLE_LABEL,
    totalAssistants: rows.length,
    totalMissions: rows.reduce((total, row) => total + row.missions.length, 0),
    rows,
  });
}

function shouldIncludePageForManager(page = {}, managerDepartment = '') {
  const normalizedManagerDepartment = normalizeText(managerDepartment);
  const normalizedSourceSheet = normalizeText(page.source_sheet || '');

  if (!normalizedManagerDepartment || !normalizedSourceSheet || normalizedSourceSheet === 'TRONC COMMUN') {
    return true;
  }

  if (normalizedManagerDepartment === 'AUDIT') {
    return normalizedSourceSheet === 'AUDIT';
  }

  if (normalizedManagerDepartment === 'EXPERTISE COMPTABLE') {
    return normalizedSourceSheet === 'EXPERTISE COMPTABLE';
  }

  if (normalizedManagerDepartment === 'AUDIT & EXPERTISE COMPTABLE') {
    return normalizedSourceSheet === 'AUDIT' || normalizedSourceSheet === 'EXPERTISE COMPTABLE';
  }

  return true;
}

function filterSectionsForManagerDepartment(sections = [], managerDepartment = '') {
  return sections
    .map((section) => {
      const pages = (section.pages || []).filter((page) => shouldIncludePageForManager(page, managerDepartment));
      const pageIds = new Set(pages.map((page) => page.page_id));
      const criteria = (section.criteria || []).filter((criterion) => !criterion.page_id || pageIds.has(criterion.page_id));

      return {
        ...section,
        pages,
        criteria,
      };
    })
    .filter((section) => (section.pages || []).length > 0);
}

function resolveSelectedManager(managers = [], payload = {}) {
  const selectedManagerId = String(payload?.id || '').trim();
  const selectedManagerDepartment = String(payload?.department || '').trim();

  return (
    managers.find((manager) => selectedManagerId && String(manager._id) === selectedManagerId) ||
    managers.find(
      (manager) =>
        selectedManagerDepartment &&
        normalizeText(manager.department || '') === normalizeText(selectedManagerDepartment)
    ) ||
    null
  );
}

async function buildSeniorOverviewMetrics(user) {
  const assistantDepartments = getAssistantDepartmentsForSupervisor(user.department);
  const assistants = await User.find({
    is_active: true,
    code_categorie: '8C',
    department: { $in: assistantDepartments },
  }).select('_id name grade department');

  const assistantIds = assistants.map((assistant) => assistant._id);
  const instances = assistantIds.length
    ? await EvaluationInstance.find({
        evalue_id: { $in: assistantIds },
        cycle_label: CURRENT_CYCLE_LABEL,
        template_type: 'assistant-self-evaluation',
      }).select('evalue_id mission_evaluations')
    : [];

  const assistantById = new Map(assistants.map((assistant) => [String(assistant._id), assistant]));
  const missions = instances.flatMap((instance) =>
    (instance.mission_evaluations || [])
      .filter(
        (mission) =>
          mission.status === 'Soumise' &&
          isAssistantMissionVisibleToSupervisor(mission, user)
      )
      .map((mission) => ({
        assistantId: instance.evalue_id.toString(),
        assistantName: assistantById.get(String(instance.evalue_id))?.name || 'Assistant',
        assistantGrade: assistantById.get(String(instance.evalue_id))?.grade || 'Assistant',
        title: mission.title,
        missionId: mission.mission_id,
        period: mission.period,
        department: mission.department,
        status: mission.status,
        submittedAt: mission.submitted_at || null,
      }))
  );

  const reviews = assistants.length
    ? await SeniorAssistantReview.find({
        cycle_label: CURRENT_CYCLE_LABEL,
        senior_id: user._id,
        assistant_id: { $in: assistants.map((assistant) => assistant._id) },
      }).select('assistant_id status mission_reviews')
    : [];

  const reviewByAssistantId = new Map(reviews.map((review) => [String(review.assistant_id), review]));
  const assistantMissionMap = new Map();

  for (const mission of missions) {
    const review = reviewByAssistantId.get(mission.assistantId);
    const missionReview = (review?.mission_reviews || []).find((item) => item.mission_id === mission.missionId);
    const missionCompleted = isMissionReviewCompleted(missionReview);
    const missionTransmitted = missionReview?.status === 'Transmise';
    const currentAssistantMetrics = assistantMissionMap.get(mission.assistantId) || {
      assistantId: mission.assistantId,
      name: mission.assistantName,
      grade: mission.assistantGrade,
      department: assistantById.get(mission.assistantId)?.department || '',
      sharedMissionsCount: 0,
      pendingMissionsCount: 0,
      transmittedMissionsCount: 0,
    };

    currentAssistantMetrics.sharedMissionsCount += 1;
    if (!missionCompleted) {
      currentAssistantMetrics.pendingMissionsCount += 1;
    }
    if (missionTransmitted) {
      currentAssistantMetrics.transmittedMissionsCount += 1;
    }

    assistantMissionMap.set(mission.assistantId, currentAssistantMetrics);
  }

  const assistantRows = Array.from(assistantMissionMap.values())
    .sort((left, right) => left.name.localeCompare(right.name, 'fr', { sensitivity: 'base' }))
    .map((assistant) => ({
      ...assistant,
      evaluationStatus:
        assistant.pendingMissionsCount > 0
          ? 'Avis Senior incomplets'
          : assistant.transmittedMissionsCount > 0
            ? 'Transmis au Manager'
            : 'Evaluations completes',
    }));

  return {
    cycle_label: CURRENT_CYCLE_LABEL,
    missions,
    summary: {
      assistantsEncadresCount: assistantRows.length,
      missionsAEvaluerCount: missions.filter((mission) => {
        const review = reviewByAssistantId.get(mission.assistantId);
        const missionReview = (review?.mission_reviews || []).find((item) => item.mission_id === mission.missionId);
        return !isMissionReviewCompleted(missionReview);
      }).length,
      missionsCommunesCount: missions.length,
      synthesesTransmisesCount: missions.filter((mission) => {
        const review = reviewByAssistantId.get(mission.assistantId);
        const missionReview = (review?.mission_reviews || []).find((item) => item.mission_id === mission.missionId);
        return missionReview?.status === 'Transmise';
      }).length,
    },
    assistants: assistantRows,
  };
}

async function getMySeniorOverview(request, response) {
  return response.json(await buildSeniorOverviewMetrics(request.user));
}

async function getMyAssistantEvaluation(request, response) {
  const assistant = await getAssistantForSenior(request.user, request.params.assistantId);

  if (!assistant) {
    return response.status(404).json({
      message: "Assistant introuvable pour ce Senior.",
    });
  }

  const [review, managers, selfEvaluationInstance] = await Promise.all([
    getOrCreateSeniorAssistantReview(request.user, assistant),
    resolveManagersForSeniorReview(request.user, assistant),
    getOrCreateAssistantEvaluationInstance(assistant),
  ]);
  const payload = buildReviewPayload(review, request.user, assistant, managers);
  payload.self_evaluation = buildAssistantSelfEvaluationPayload(selfEvaluationInstance);

  return response.json(payload);
}

async function saveMyAssistantEvaluation(request, response) {
  const rawSections = Array.isArray(request.body?.sections) ? request.body.sections : null;
  const rawMissionReviews = Array.isArray(request.body?.missionReviews) ? request.body.missionReviews : null;

  if (!rawSections?.length) {
    return response.status(400).json({
      message: "Les sections de l'evaluation sont requises.",
    });
  }

  const assistant = await getAssistantForSenior(request.user, request.params.assistantId);

  if (!assistant) {
    return response.status(404).json({
      message: "Assistant introuvable pour ce Senior.",
    });
  }

  const sections = normalizeSections(rawSections);
  const missingPageComments = validateLowScorePageComments(sections, 3);

  if (missingPageComments.length) {
    return response.status(400).json({
      message: 'Une justification par titre d au moins 3 caracteres est obligatoire pour toute note inferieure a 3.',
      missingPageComments,
    });
  }

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

  const review = await getOrCreateSeniorAssistantReview(request.user, assistant);
  const summary = getEvaluationSummary(sections);
  const [managers, selfEvaluationInstance] = await Promise.all([
    resolveManagersForSeniorReview(request.user, assistant),
    getOrCreateAssistantEvaluationInstance(assistant),
  ]);

  review.sections = toPersistenceSections(sections);
  if (rawMissionReviews) {
    review.mission_reviews = normalizeMissionReviews(rawMissionReviews);
  }
  review.status = summary.globalProgress === 0 ? 'Brouillon' : 'En cours';
  review.last_saved_at = new Date();
  await review.save();

  return response.json({
    message: 'Evaluation enregistree.',
    ...{
      ...buildReviewPayload(review, request.user, assistant, managers),
      self_evaluation: buildAssistantSelfEvaluationPayload(selfEvaluationInstance),
    },
  });
}

async function addMissionToAssistant(request, response) {
  const title = String(request.body?.title || '').trim();
  const period = String(request.body?.period || '').trim() || 'Periode non renseignee';

  if (!title) {
    return response.status(400).json({
      message: 'Le nom de la mission est requis.',
    });
  }

  const assistant = await getAssistantForSenior(request.user, request.params.assistantId);

  if (!assistant) {
    return response.status(404).json({
      message: "Assistant introuvable pour ce Senior.",
    });
  }

  const evaluationDepartment = resolveEvaluationDepartmentForSeniorReview(request.user, assistant);
  const [review, evaluationInstance, managers] = await Promise.all([
    getOrCreateSeniorAssistantReview(request.user, assistant),
    getOrCreateAssistantEvaluationInstance(assistant),
    resolveManagersForSeniorReview(request.user, assistant),
  ]);

  const missionId = `senior-${request.user._id}-${assistant._id}-${Date.now()}`;
  const assistantTemplateSections = cloneAssistantTemplateForDepartment(evaluationDepartment);
  const missionCriteria = buildAssistantMissionCriteria(assistantTemplateSections);
  const assignedAt = new Date();

  evaluationInstance.mission_evaluations = [
    ...(evaluationInstance.mission_evaluations || []),
    {
      mission_id: missionId,
      title,
      period,
      department: evaluationDepartment,
      created_by_role: 'senior',
      assigned_by_user_id: request.user._id,
      assigned_by_name: request.user.name,
      assigned_by_grade: request.user.grade,
      assigned_at: assignedAt,
      primary_recipient_user_id: request.user._id,
      primary_recipient_name: request.user.name,
      primary_recipient_grade: request.user.grade,
      primary_recipient_department: request.user.department,
      recipients: buildMissionRecipientsForAssistant([request.user]),
      criteria: missionCriteria,
      comment: '',
      status: 'Brouillon',
      submitted_at: null,
    },
  ];
  evaluationInstance.last_saved_at = assignedAt;
  await evaluationInstance.save();

  review.mission_reviews = [
    ...normalizeMissionReviews(review.mission_reviews || []),
    {
      ...createSeniorAssignedMissionReview({ missionId, title, period, assistant, seniorUser: request.user }),
      assigned_at: assignedAt,
    },
  ];
  review.last_saved_at = assignedAt;
  await review.save();

  return response.json({
    message: `Mission ajoutee pour ${assistant.name}. L'assistant la verra dans son espace d'auto-evaluation.`,
    ...{
      ...buildReviewPayload(review, request.user, assistant, managers),
      self_evaluation: buildAssistantSelfEvaluationPayload(evaluationInstance),
    },
  });
}

async function submitMyAssistantMissionReview(request, response) {
  const missionId = String(request.body?.missionId || '').trim();

  if (!missionId) {
    return response.status(400).json({
      message: 'La mission a transmettre est requise.',
    });
  }

  const assistant = await getAssistantForSenior(request.user, request.params.assistantId);

  if (!assistant) {
    return response.status(404).json({
      message: "Assistant introuvable pour ce Senior.",
    });
  }

  const [review, managers, selfEvaluationInstance] = await Promise.all([
    getOrCreateSeniorAssistantReview(request.user, assistant),
    resolveManagersForSeniorReview(request.user, assistant),
    getOrCreateAssistantEvaluationInstance(assistant),
  ]);
  const selectedManager = resolveSelectedManager(managers, request.body?.selectedManagerRecipient);
  const missionReview = (review.mission_reviews || []).find((mission) => mission.mission_id === missionId);

  if (!missionReview) {
    return response.status(404).json({
      message: 'Mission introuvable dans cette evaluation.',
    });
  }

  const hasIncompleteCriterion = (missionReview.criteria || []).some(
    (criterion) => criterion.score === null || criterion.score === undefined
  );

  if (hasIncompleteCriterion) {
    return response.status(400).json({
      message: 'Toutes les questions de la mission doivent etre renseignees avant transmission.',
    });
  }

  missionReview.status = 'Transmise';
  if (selectedManager) {
    missionReview.recipient_name = selectedManager.name;
    missionReview.recipient_grade = selectedManager.grade;
    missionReview.recipient_department = selectedManager.department;
  }
  missionReview.submitted_at = new Date();
  review.submitted_to_user_ids = selectedManager ? [selectedManager._id] : managers.map((manager) => manager._id);
  review.submitted_to_names = selectedManager ? [selectedManager.name] : managers.map((manager) => manager.name);
  review.last_saved_at = new Date();
  await review.save();

  return response.json({
    message: selectedManager
      ? `Mission transmise a ${selectedManager.name}.`
      : managers.length
      ? `Mission transmise a ${managers.map((manager) => manager.name).join(', ')}.`
      : 'Mission transmise au(x) manager(s).',
    ...{
      ...buildReviewPayload(review, request.user, assistant, managers),
      self_evaluation: buildAssistantSelfEvaluationPayload(selfEvaluationInstance),
    },
  });
}

async function submitMyAssistantEvaluation(request, response) {
  const assistant = await getAssistantForSenior(request.user, request.params.assistantId);

  if (!assistant) {
    return response.status(404).json({
      message: "Assistant introuvable pour ce Senior.",
    });
  }

  const [review, managers, selfEvaluationInstance] = await Promise.all([
    getOrCreateSeniorAssistantReview(request.user, assistant),
    resolveManagersForSeniorReview(request.user, assistant),
    getOrCreateAssistantEvaluationInstance(assistant),
  ]);
  const sections = normalizeSections(review.sections);
  const selectedManager = resolveSelectedManager(managers, request.body?.selectedManagerRecipient);
  const validationSections = selectedManager
    ? filterSectionsForManagerDepartment(sections, selectedManager.department)
    : sections;
  const missingAnswers = validateSectionsForSubmit(validationSections);

  if (missingAnswers.length) {
    return response.status(400).json({
      message: 'Toutes les questions obligatoires doivent etre renseignees avant transmission.',
      missingAnswers,
    });
  }

  const missingSectionComments = validateSectionCommentsForSubmit(sections, 3);

  if (missingSectionComments.length) {
    return response.status(400).json({
      message: 'Un commentaire de section d au moins 3 caracteres est obligatoire pour chaque section avant soumission.',
      missingSectionComments,
    });
  }

  const missingPageComments = validateLowScorePageComments(sections, 3);

  if (missingPageComments.length) {
    return response.status(400).json({
      message: 'Une justification par titre d au moins 3 caracteres est obligatoire pour toute note inferieure a 3.',
      missingPageComments,
    });
  }

  review.sections = toPersistenceSections(sections);
  review.status = 'Transmis au Manager';
  review.submitted_to_user_ids = selectedManager ? [selectedManager._id] : managers.map((manager) => manager._id);
  review.submitted_to_names = selectedManager ? [selectedManager.name] : managers.map((manager) => manager.name);
  review.submitted_at = new Date();
  review.last_saved_at = new Date();
  await review.save();

  return response.json({
    message: selectedManager
      ? `Evaluation transmise a ${selectedManager.name}.`
      : managers.length
      ? `Evaluation transmise a ${managers.map((manager) => manager.name).join(', ')}.`
      : 'Evaluation transmise au(x) manager(s).',
    ...{
      ...buildReviewPayload(review, request.user, assistant, managers),
      self_evaluation: buildAssistantSelfEvaluationPayload(selfEvaluationInstance),
    },
  });
}

module.exports = {
  addMissionToAssistant,
  getMySeniorOverview,
  listMyAssistants,
  listMyCommonMissions,
  listMyTransmittedSummaries,
  getMyAssistantEvaluation,
  saveMyAssistantEvaluation,
  submitMyAssistantMissionReview,
  submitMyAssistantEvaluation,
};
