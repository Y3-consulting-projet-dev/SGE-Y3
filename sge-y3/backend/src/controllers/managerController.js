const User = require('../models/User');
const EvaluationInstance = require('../models/EvaluationInstance');
const ManagerMemberReview = require('../models/ManagerMemberReview');
const SeniorAssistantReview = require('../models/SeniorAssistantReview');
const { buildEvaluationTemplateForUser } = require('../utils/competencyMatrix');
const {
  getAverageScore,
  getEvaluationSummary,
  getOverallAverageScore,
  normalizeSections,
  validateSectionsForSubmit,
} = require('../utils/evaluationHelpers');
const FULL_RH_EMAILS = ['isabella.beda@ycubeac.com'];
const RH_DEPARTMENT_REGEX = /^RH$/i;
const CAPITAL_HUMAIN_DEPARTMENT_REGEX = /^CAPITAL HUMAIN$/i;

const CURRENT_CYCLE_LABEL = 'Cycle 2025-2026';

function normalizeText(value = '') {
  return String(value || '').replace(/\s+/g, ' ').trim().toUpperCase();
}

function getManagedDepartmentsForManager(department = '') {
  const normalized = normalizeText(department);

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

function getExpectedTemplateType(member) {
  return member?.code_categorie === '8C' ? 'assistant-self-evaluation' : 'senior-self-evaluation';
}

function resolveEvaluationDepartmentForManagerReview(managerUser, member) {
  const managerDepartment = normalizeText(managerUser?.department || '');
  const memberDepartment = normalizeText(member?.department || '');

  if (
    memberDepartment === 'AUDIT & EXPERTISE COMPTABLE' &&
    (managerDepartment === 'AUDIT' || managerDepartment === 'EXPERTISE COMPTABLE')
  ) {
    return managerUser.department || '';
  }

  return member?.department || managerUser?.department || '';
}

function cloneTemplateForMember(member, evaluationDepartment = '') {
  return buildEvaluationTemplateForUser({
    grade: member?.grade || '',
    department: evaluationDepartment,
  }).map((section) => ({
    ...section,
    pages: (section.pages || []).map((page) => ({
      ...page,
      themes: (page.themes || []).map((theme) => ({ ...theme })),
    })),
    criteria: (section.criteria || []).map((criterion) => ({ ...criterion })),
  }));
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

function cloneManagerSelfTemplate(user) {
  return buildEvaluationTemplateForUser({
    grade: user?.grade || '',
    department: user?.department || '',
  }).map((section) => ({
    ...section,
    pages: (section.pages || []).map((page) => ({
      ...page,
      themes: (page.themes || []).map((theme) => ({ ...theme })),
    })),
    criteria: (section.criteria || []).map((criterion) => ({ ...criterion })),
  }));
}

async function resolveRhRecipients() {
  return User.find({
    is_active: true,
    $or: [
      { department: RH_DEPARTMENT_REGEX },
      { department: CAPITAL_HUMAIN_DEPARTMENT_REGEX },
      { email: { $in: FULL_RH_EMAILS } },
      { first_name: /ISABELLA/i, last_name: /BEDA/i },
    ],
  })
    .sort({ last_name: 1, first_name: 1 })
    .select('_id name first_name last_name grade department');
}

async function getMemberForManager(managerUser, memberId) {
  const managedDepartments = getManagedDepartmentsForManager(managerUser.department);

  return User.findOne({
    _id: memberId,
    is_active: true,
    code_categorie: { $in: ['8C', '9A', '9B'] },
    department: { $in: managedDepartments },
  }).select('_id name first_name last_name grade department code_categorie');
}

async function getSelfEvaluationInstanceForMember(member) {
  return EvaluationInstance.findOne({
    evalue_id: member._id,
    cycle_label: CURRENT_CYCLE_LABEL,
    template_type: getExpectedTemplateType(member),
  }).select('status submitted_at sections submitted_to_user_ids mission_evaluations');
}

function buildSelfEvaluationPayload(instance) {
  const sections = normalizeSections(instance?.sections || []);

  return {
    status: instance?.status || 'En attente',
    submitted_at: instance?.submitted_at || null,
    overallAverage: getOverallAverageScore(sections),
    sectionScores: sections.map((section) => ({
      sectionId: section.id,
      title: section.title,
      score: getAverageScore(section),
      percent: Math.round(((getAverageScore(section) || 0) / 5) * 100),
    })),
  };
}

async function getOrCreateManagerSelfEvaluation(user) {
  let instance = await EvaluationInstance.findOne({
    evalue_id: user._id,
    cycle_label: CURRENT_CYCLE_LABEL,
    template_type: 'manager-self-evaluation',
  });

  const templateSections = cloneManagerSelfTemplate(user);

  if (!instance) {
    instance = await EvaluationInstance.create({
      cycle_label: CURRENT_CYCLE_LABEL,
      evalue_id: user._id,
      status: 'En cours',
      template_type: 'manager-self-evaluation',
      submitted_to_role: 'rh',
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

function buildManagerSelfEvaluationPayload(instance, user, rhRecipients = []) {
  const sections = normalizeSections(instance.sections || []);
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
      overallAverage: getOverallAverageScore(sections),
    },
    manager: {
      id: user._id.toString(),
      name: user.name,
      first_name: user.first_name,
      last_name: user.last_name,
      grade: user.grade,
      department: user.department,
    },
    submitted_to: rhRecipients.map((recipient) => ({
      id: recipient._id.toString(),
      name: recipient.name,
      department: recipient.department,
      grade: recipient.grade,
    })),
  };
}

function getMissionAverage(criteria = []) {
  const scores = (criteria || []).map((criterion) => criterion.score).filter((score) => typeof score === 'number');

  if (!scores.length) {
    return null;
  }

  return Number((scores.reduce((total, score) => total + score, 0) / scores.length).toFixed(1));
}

function isRecipientUser(recipient, user) {
  if (!recipient || !user) {
    return false;
  }

  const recipientUserId = recipient.user_id?.toString?.() || String(recipient.user_id || recipient.id || '');
  if (recipientUserId && recipientUserId === String(user._id)) {
    return true;
  }

  return normalizeText(recipient.name || '') === normalizeText(user.name || '');
}

function normalizeMissionReviews(missionReviews = []) {
  return missionReviews.map((mission) => ({
    mission_id: String(mission.id || mission.mission_id || '').trim(),
    title: String(mission.title || '').trim(),
    period: String(mission.period || '').trim(),
    department: String(mission.department || '').trim(),
    origin: String(mission.origin || 'assistant-self').trim() || 'assistant-self',
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
    recipientName: mission.recipient_name || '',
    recipientGrade: mission.recipient_grade || '',
    recipientDepartment: mission.recipient_department || '',
    assistantSubmittedAt: mission.assistant_submitted_at || null,
    status: mission.status || 'A demarrer',
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
    submittedAt: mission.submitted_at || null,
  }));
}

function createMissionReviewFromAssistantMission(mission, managerUser) {
  const evaluationDepartment = resolveEvaluationDepartmentForManagerReview(managerUser, { department: mission.department });
  const visibleCriteria = (mission.criteria || []).filter((criterion) => {
    const sourceSheet = String(criterion.source_sheet || criterion.sourceSheet || '').trim().toUpperCase();
    const targetDepartment = String(evaluationDepartment || '').trim().toUpperCase();

    if (!sourceSheet || sourceSheet === 'TRONC COMMUN') {
      return true;
    }

    if (targetDepartment === 'AUDIT') {
      return sourceSheet === 'AUDIT';
    }

    if (targetDepartment === 'EXPERTISE COMPTABLE') {
      return sourceSheet === 'EXPERTISE COMPTABLE';
    }

    return true;
  });
  const recipient = (mission.recipients || []).find((item) => isRecipientUser(item, managerUser));

  return {
    mission_id: mission.mission_id,
    title: mission.title,
    period: mission.period,
    department: mission.department,
    origin: mission.created_by_role === 'senior' ? 'senior-assigned' : 'assistant-self',
    recipient_name: recipient?.name || managerUser.name,
    recipient_grade: recipient?.grade || managerUser.grade,
    recipient_department: recipient?.department || managerUser.department,
    assistant_submitted_at: mission.submitted_at || null,
    status: 'A demarrer',
    comment: '',
    criteria: visibleCriteria.map((criterion) => ({
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

async function syncManagerMissionReviews(review, managerUser, selfEvaluationInstance) {
  const currentMissionReviews = normalizeMissionReviews(review.mission_reviews || []);
  const submittedMissions = (selfEvaluationInstance?.mission_evaluations || []).filter(
    (mission) =>
      mission.status === 'Soumise' &&
      (mission.recipients || []).some((recipient) => isRecipientUser(recipient, managerUser))
  );
  const submittedMissionIds = new Set(submittedMissions.map((mission) => String(mission.mission_id)));

  const nextMissionReviews = submittedMissions.map((mission) => {
    const existing = currentMissionReviews.find((item) => item.mission_id === String(mission.mission_id));
    const seed = createMissionReviewFromAssistantMission(mission, managerUser);

    if (!existing) {
      return seed;
    }

    return {
      ...seed,
      status: existing.status || seed.status,
      comment: existing.comment || '',
      submitted_at: existing.submitted_at || null,
      criteria: seed.criteria.map((criterion) => {
        const currentCriterion = (existing.criteria || []).find((item) => item.criterion_id === criterion.criterion_id);
        return currentCriterion ? { ...criterion, score: currentCriterion.score ?? null } : criterion;
      }),
    };
  });

  const persistedSubmittedReviews = currentMissionReviews.filter(
    (mission) => mission.status === 'Soumise a RH' && !submittedMissionIds.has(mission.mission_id)
  );

  review.mission_reviews = [...persistedSubmittedReviews, ...nextMissionReviews];
  return review;
}

async function buildManagerMissionAndGlobalInputs(managerUser, member, selfEvaluationInstance, review = null) {
  const payload = {
    globalScores: [],
    missions: [],
  };

  if (
    selfEvaluationInstance &&
    (selfEvaluationInstance.submitted_to_user_ids || []).some((userId) => String(userId) === String(managerUser._id))
  ) {
    payload.globalScores.push({
      source: 'self-evaluation',
      evaluatorName: member.name,
      evaluatorGrade: member.grade,
      finalScore: getOverallAverageScore(normalizeSections(selfEvaluationInstance.sections || [])),
      submittedAt: selfEvaluationInstance.submitted_at || null,
    });
  }

  if (member.code_categorie !== '8C') {
    return payload;
  }

  const seniorReviews = await SeniorAssistantReview.find({
    cycle_label: CURRENT_CYCLE_LABEL,
    assistant_id: member._id,
    submitted_to_user_ids: managerUser._id,
  }).select('senior_id sections mission_reviews submitted_at status');

  const seniorIds = seniorReviews.map((review) => review.senior_id).filter(Boolean);
  const seniorUsers = seniorIds.length
    ? await User.find({ _id: { $in: seniorIds } }).select('_id name grade')
    : [];
  const seniorUserById = new Map(seniorUsers.map((user) => [String(user._id), user]));
  const missionsMap = new Map();
  const managerMissionReviewById = new Map(
    normalizeMissionReviews(review?.mission_reviews || []).map((missionReview) => [missionReview.mission_id, missionReview])
  );

  for (const review of seniorReviews) {
    const seniorUser = seniorUserById.get(String(review.senior_id));
    payload.globalScores.push({
      source: 'senior-review',
      evaluatorName: seniorUser?.name || 'Senior',
      evaluatorGrade: seniorUser?.grade || 'Senior',
      finalScore: getOverallAverageScore(normalizeSections(review.sections || [])),
      submittedAt: review.submitted_at || null,
    });

    for (const missionReview of review.mission_reviews || []) {
      if (missionReview.status !== 'Transmise') {
        continue;
      }

      const existingMission = missionsMap.get(missionReview.mission_id) || {
        id: missionReview.mission_id,
        title: missionReview.title,
        period: missionReview.period,
        department: missionReview.department,
        submissions: [],
      };

      existingMission.submissions.push({
        source: 'senior-review',
        evaluatorName: seniorUser?.name || 'Senior',
        evaluatorGrade: seniorUser?.grade || 'Senior',
        finalScore: getMissionAverage(missionReview.criteria || []),
        submittedAt: missionReview.submitted_at || null,
        comment: missionReview.comment || '',
      });

      missionsMap.set(missionReview.mission_id, existingMission);
    }
  }

  for (const mission of selfEvaluationInstance?.mission_evaluations || []) {
    const missionAlreadyKnownByManager = missionsMap.has(mission.mission_id);
    const isSubmittedToManager = (mission.recipients || []).some((recipient) => isRecipientUser(recipient, managerUser));

    if (mission.status !== 'Soumise' || (!isSubmittedToManager && !missionAlreadyKnownByManager)) {
      continue;
    }

    const existingMission = missionsMap.get(mission.mission_id) || {
      id: mission.mission_id,
      title: mission.title,
      period: mission.period,
      department: mission.department,
      submissions: [],
      managerReview: null,
    };

    existingMission.submissions.push({
      source: 'self-evaluation',
      evaluatorName: member.name,
      evaluatorGrade: member.grade,
      finalScore: getMissionAverage(mission.criteria || []),
      submittedAt: mission.submitted_at || null,
      comment: mission.comment || '',
    });

    missionsMap.set(mission.mission_id, existingMission);
  }

  for (const mission of missionsMap.values()) {
    if (!mission.managerReview) {
      const managerReview = managerMissionReviewById.get(String(mission.id));
      mission.managerReview = managerReview ? formatMissionReviews([managerReview])[0] : null;
    }
  }

  payload.missions = Array.from(missionsMap.values()).sort((left, right) =>
    String(left.title || '').localeCompare(String(right.title || ''), 'fr', { sensitivity: 'base' })
  );

  return payload;
}

async function getOrCreateManagerMemberReview(managerUser, member) {
  let review = await ManagerMemberReview.findOne({
    cycle_label: CURRENT_CYCLE_LABEL,
    manager_id: managerUser._id,
    member_id: member._id,
  });

  const evaluationDepartment = resolveEvaluationDepartmentForManagerReview(managerUser, member);
  const templateSections = cloneTemplateForMember(member, evaluationDepartment);

  if (!review) {
    review = await ManagerMemberReview.create({
      cycle_label: CURRENT_CYCLE_LABEL,
      manager_id: managerUser._id,
      member_id: member._id,
      member_department: evaluationDepartment,
      status: 'En cours',
      sections: toPersistenceSections(templateSections),
      last_saved_at: new Date(),
    });
  } else if (shouldResetToCurrentTemplate(review, templateSections)) {
    review.sections = toPersistenceSections(templateSections);
    review.member_department = evaluationDepartment;
    review.last_saved_at = new Date();
    await review.save();
  }

  return review;
}

function buildManagerReviewPayload(review, managerUser, member, selfEvaluation, rhRecipients = [], missionAndScoreData = {}) {
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
      overallAverage: getOverallAverageScore(sections),
    },
    manager: {
      id: managerUser._id.toString(),
      name: managerUser.name,
      grade: managerUser.grade,
      department: managerUser.department,
    },
    member: {
      id: member._id.toString(),
      name: member.name,
      first_name: member.first_name,
      last_name: member.last_name,
      grade: member.grade,
      department: member.department,
      code_categorie: member.code_categorie,
    },
    review_context: {
      evaluationDepartment: review.member_department || member.department,
    },
    self_evaluation: selfEvaluation,
    received_global_scores: missionAndScoreData.globalScores || [],
    submitted_missions: missionAndScoreData.missions || [],
    mission_reviews: formatMissionReviews(review.mission_reviews || []),
    submitted_to: rhRecipients.map((recipient) => ({
      id: recipient._id.toString(),
      name: recipient.name,
      department: recipient.department,
      grade: recipient.grade,
    })),
  };
}

function formatMember(member, evaluationInstance) {
  return {
    id: member._id.toString(),
    name: member.name,
    first_name: member.first_name,
    last_name: member.last_name,
    grade: member.grade,
    department: member.department,
    code_categorie: member.code_categorie,
    evaluationStatus: evaluationInstance?.status || 'En attente',
    evaluationSubmittedAt: evaluationInstance?.submitted_at || null,
    selfEvaluationScore: getOverallAverageScore(normalizeSections(evaluationInstance?.sections || [])),
  };
}

function getInitialsFromMember(member = {}) {
  const source = `${member.first_name || ''} ${member.last_name || ''}`.trim() || member.name || '';

  return source
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('');
}

function getAutomaticRecommendation(finalScore) {
  if (typeof finalScore !== 'number') {
    return 'Maintien';
  }

  return finalScore >= 4 ? 'Augmentation' : 'Maintien';
}

function countUnjustifiedLowScorePages(sections = []) {
  return (sections || []).reduce((total, section) => {
    return (
      total +
      (section.pages || []).reduce((pageTotal, page) => {
        const hasLowScore = (page.themes || []).some((theme) => typeof theme.score === 'number' && theme.score < 3);
        const hasComment = Boolean(String(page.comment || '').trim());
        return pageTotal + (hasLowScore && !hasComment ? 1 : 0);
      }, 0)
    );
  }, 0);
}

function validateMissionReviewCriteria(criteria = []) {
  for (const criterion of criteria) {
    if (criterion.score !== null && criterion.score !== undefined) {
      if (!Number.isInteger(criterion.score) || criterion.score < 1 || criterion.score > 5) {
        return `La note du critere "${criterion.label}" doit etre comprise entre 1 et 5.`;
      }
    }
  }

  return '';
}

async function getManagerOverview(request, response) {
  const managedDepartments = getManagedDepartmentsForManager(request.user.department);

  const members = managedDepartments.length
    ? await User.find({
        is_active: true,
        _id: { $ne: request.user._id },
        code_categorie: { $in: ['8C', '9A', '9B'] },
        department: { $in: managedDepartments },
      })
        .sort({ last_name: 1, first_name: 1 })
        .select('_id name first_name last_name grade department code_categorie')
    : [];

  const memberIds = members.map((member) => member._id);
  const evaluationInstances = memberIds.length
    ? await EvaluationInstance.find({
        evalue_id: { $in: memberIds },
        cycle_label: CURRENT_CYCLE_LABEL,
        template_type: { $in: ['assistant-self-evaluation', 'senior-self-evaluation'] },
      }).select('evalue_id template_type status submitted_at submitted_to_user_ids')
    : [];

  const relevantInstancesByMemberId = new Map();

  for (const member of members) {
    const expectedTemplateType = getExpectedTemplateType(member);
    const matchingInstance = evaluationInstances.find(
      (instance) =>
        String(instance.evalue_id) === String(member._id) && instance.template_type === expectedTemplateType
    );

    if (matchingInstance) {
      relevantInstancesByMemberId.set(String(member._id), matchingInstance);
    }
  }

  const receivedEvaluations = members.filter((member) => {
    const instance = relevantInstancesByMemberId.get(String(member._id));

    return (
      instance &&
      (instance.submitted_to_user_ids || []).some((userId) => String(userId) === String(request.user._id)) &&
      (instance.status === 'Soumis aux Managers' || instance.status === 'Soumis au Manager')
    );
  });

  const pendingEvaluations = receivedEvaluations.map((member) => {
    const instance = relevantInstancesByMemberId.get(String(member._id));

    return {
      id: member._id.toString(),
      name: member.name,
      grade: member.grade,
      department: member.department,
      submittedAt: instance?.submitted_at || null,
      status: instance?.status || 'Soumis aux Managers',
      templateType: instance?.template_type || getExpectedTemplateType(member),
    };
  });

  const assistantsCount = members.filter((member) => member.code_categorie === '8C').length;
  const seniorsCount = members.filter((member) => member.code_categorie === '9A').length;
  const assistantManagersCount = members.filter((member) => member.code_categorie === '9B').length;
  const totalMembers = members.length;
  const receivedCount = receivedEvaluations.length;

  let selfEvaluationInstance = await EvaluationInstance.findOne({
    evalue_id: request.user._id,
    cycle_label: CURRENT_CYCLE_LABEL,
    template_type: 'manager-self-evaluation',
  }).select('status submitted_at');

  if (!selfEvaluationInstance) {
    selfEvaluationInstance = await EvaluationInstance.findOne({
      evalue_id: request.user._id,
      cycle_label: CURRENT_CYCLE_LABEL,
      template_type: 'senior-self-evaluation',
    }).select('status submitted_at');
  }

  return response.json({
    cycle_label: CURRENT_CYCLE_LABEL,
    summary: {
      totalMembers,
      assistantsCount,
      seniorsCount,
      assistantManagersCount,
      receivedSelfEvaluationsCount: receivedCount,
      pendingSelfEvaluationsCount: Math.max(totalMembers - receivedCount, 0),
      pendingEvaluationsCount: pendingEvaluations.length,
      selfEvaluationStatus: selfEvaluationInstance?.status || 'En attente',
      selfEvaluationSubmittedAt: selfEvaluationInstance?.submitted_at || null,
    },
    members: members.map((member) => formatMember(member, relevantInstancesByMemberId.get(String(member._id)))),
    pendingEvaluations,
  });
}

async function getManagerTeamReport(request, response) {
  const managedDepartments = getManagedDepartmentsForManager(request.user.department);

  const members = managedDepartments.length
    ? await User.find({
        is_active: true,
        _id: { $ne: request.user._id },
        code_categorie: { $in: ['8C', '9A', '9B'] },
        department: { $in: managedDepartments },
      })
        .sort({ last_name: 1, first_name: 1 })
        .select('_id name first_name last_name grade department code_categorie')
    : [];

  const memberIds = members.map((member) => member._id);
  const reviews = memberIds.length
    ? await ManagerMemberReview.find({
        cycle_label: CURRENT_CYCLE_LABEL,
        manager_id: request.user._id,
        member_id: { $in: memberIds },
      }).select('member_id status submitted_at sections')
    : [];

  const reviewByMemberId = new Map(reviews.map((review) => [String(review.member_id), review]));
  const sectionTitleSet = new Set();

  for (const review of reviews) {
    const sections = normalizeSections(review.sections || []);
    sections.forEach((section) => {
      if (section.title) {
        sectionTitleSet.add(section.title);
      }
    });
  }

  const sectionTitles = Array.from(sectionTitleSet);
  const rows = members.map((member) => {
    const review = reviewByMemberId.get(String(member._id));
    const sections = normalizeSections(review?.sections || []);
    const finalScore = getOverallAverageScore(sections);
    const summary = getEvaluationSummary(sections);
    const sectionScoreMap = new Map(
      sections.map((section) => [section.title, getAverageScore(section)])
    );

    return {
      id: member._id.toString(),
      name: member.name,
      initials: getInitialsFromMember(member),
      grade: member.grade,
      department: member.department,
      status: review?.status || 'En attente',
      submittedAt: review?.submitted_at || null,
      finalScore,
      progress: summary.globalProgress || 0,
      sectionScores: sectionTitles.map((title) => ({
        title,
        score: sectionScoreMap.has(title) ? sectionScoreMap.get(title) : null,
      })),
      automaticRecommendation: getAutomaticRecommendation(finalScore),
      unjustifiedLowScores: countUnjustifiedLowScorePages(sections),
    };
  });

  const rowsWithScore = rows.filter((row) => typeof row.finalScore === 'number');
  const completedRows = rows.filter((row) => row.progress === 100);
  const unjustifiedGapCount = rows.reduce((total, row) => total + row.unjustifiedLowScores, 0);
  const teamAverage = rowsWithScore.length
    ? Number(
        (
          rowsWithScore.reduce((total, row) => total + row.finalScore, 0) / rowsWithScore.length
        ).toFixed(1)
      )
    : null;
  const augmentationCount = rows.filter((row) => row.automaticRecommendation === 'Augmentation').length;
  const completionRate = rows.length ? Math.round((completedRows.length / rows.length) * 100) : 0;

  return response.json({
    cycle_label: CURRENT_CYCLE_LABEL,
    kpis: {
      teamAverage,
      completionRate,
      completedEvaluationsCount: completedRows.length,
      totalMembers: rows.length,
      unjustifiedGapCount,
      augmentationCount,
    },
    section_titles: sectionTitles,
    rows,
  });
}

async function getMyManagerEvaluation(request, response) {
  const [instance, rhRecipients] = await Promise.all([
    getOrCreateManagerSelfEvaluation(request.user),
    resolveRhRecipients(),
  ]);

  return response.json(buildManagerSelfEvaluationPayload(instance, request.user, rhRecipients));
}

async function saveMyManagerEvaluation(request, response) {
  const rawSections = Array.isArray(request.body?.sections) ? request.body.sections : null;

  if (!rawSections?.length) {
    return response.status(400).json({
      message: "Les sections de l'auto-evaluation manager sont requises.",
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

  const [instance, rhRecipients] = await Promise.all([
    getOrCreateManagerSelfEvaluation(request.user),
    resolveRhRecipients(),
  ]);
  const summary = getEvaluationSummary(sections);

  instance.sections = toPersistenceSections(sections);
  instance.status = summary.globalProgress === 0 ? 'Brouillon' : 'En cours';
  instance.last_saved_at = new Date();
  await instance.save();

  return response.json({
    message: 'Auto-evaluation manager enregistree.',
    ...buildManagerSelfEvaluationPayload(instance, request.user, rhRecipients),
  });
}

async function submitMyManagerEvaluation(request, response) {
  const [instance, rhRecipients] = await Promise.all([
    getOrCreateManagerSelfEvaluation(request.user),
    resolveRhRecipients(),
  ]);
  const sections = normalizeSections(instance.sections || []);
  const missingAnswers = validateSectionsForSubmit(sections);

  if (missingAnswers.length) {
    return response.status(400).json({
      message: 'Toutes les questions obligatoires doivent etre renseignees avant soumission.',
      missingAnswers,
    });
  }

  instance.sections = toPersistenceSections(sections);
  instance.status = 'Soumis a RH';
  instance.submitted_to_role = 'rh';
  instance.submitted_to_user_ids = rhRecipients.map((recipient) => recipient._id);
  instance.submitted_to_names = rhRecipients.map((recipient) => recipient.name);
  instance.submitted_at = new Date();
  instance.last_saved_at = new Date();
  await instance.save();

  return response.json({
    message: 'Auto-evaluation manager soumise a la RH / Capital Humain.',
    ...buildManagerSelfEvaluationPayload(instance, request.user, rhRecipients),
  });
}

module.exports = {
  getMyManagerEvaluation,
  getManagerTeamReport,
  async getManagerMemberEvaluation(request, response) {
    const member = await getMemberForManager(request.user, request.params.memberId);

    if (!member) {
      return response.status(404).json({
        message: "Membre d'equipe introuvable pour ce manager.",
      });
    }

    const [review, selfEvaluationInstance, rhRecipients] = await Promise.all([
      getOrCreateManagerMemberReview(request.user, member),
      getSelfEvaluationInstanceForMember(member),
      resolveRhRecipients(),
    ]);
    await syncManagerMissionReviews(review, request.user, selfEvaluationInstance);
    if (review.isModified('mission_reviews')) {
      await review.save();
    }
    const missionAndScoreData = await buildManagerMissionAndGlobalInputs(request.user, member, selfEvaluationInstance, review);

    return response.json(
      buildManagerReviewPayload(
        review,
        request.user,
        member,
        buildSelfEvaluationPayload(selfEvaluationInstance),
        rhRecipients,
        missionAndScoreData
      )
    );
  },
  async saveManagerMemberEvaluation(request, response) {
    const rawSections = Array.isArray(request.body?.sections) ? request.body.sections : null;

    if (!rawSections?.length) {
      return response.status(400).json({
        message: "Les sections de l'evaluation manager sont requises.",
      });
    }

    const member = await getMemberForManager(request.user, request.params.memberId);

    if (!member) {
      return response.status(404).json({
        message: "Membre d'equipe introuvable pour ce manager.",
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

    const [review, selfEvaluationInstance, rhRecipients] = await Promise.all([
      getOrCreateManagerMemberReview(request.user, member),
      getSelfEvaluationInstanceForMember(member),
      resolveRhRecipients(),
    ]);
    await syncManagerMissionReviews(review, request.user, selfEvaluationInstance);
    const missionAndScoreData = await buildManagerMissionAndGlobalInputs(request.user, member, selfEvaluationInstance, review);
    const summary = getEvaluationSummary(sections);

    review.sections = toPersistenceSections(sections);
    review.status = summary.globalProgress === 0 ? 'Brouillon' : 'En cours';
    review.last_saved_at = new Date();
    await review.save();

    return response.json({
      message: 'Evaluation manager enregistree.',
      ...buildManagerReviewPayload(
        review,
        request.user,
        member,
        buildSelfEvaluationPayload(selfEvaluationInstance),
        rhRecipients,
        missionAndScoreData
      ),
    });
  },
  async submitManagerMemberEvaluation(request, response) {
    const member = await getMemberForManager(request.user, request.params.memberId);

    if (!member) {
      return response.status(404).json({
        message: "Membre d'equipe introuvable pour ce manager.",
      });
    }

    const [review, selfEvaluationInstance, rhRecipients] = await Promise.all([
      getOrCreateManagerMemberReview(request.user, member),
      getSelfEvaluationInstanceForMember(member),
      resolveRhRecipients(),
    ]);
    const sections = normalizeSections(review.sections);
    await syncManagerMissionReviews(review, request.user, selfEvaluationInstance);
    const missionAndScoreData = await buildManagerMissionAndGlobalInputs(request.user, member, selfEvaluationInstance, review);
    const missingAnswers = validateSectionsForSubmit(sections);

    if (missingAnswers.length) {
      return response.status(400).json({
        message: "Toutes les questions obligatoires doivent etre renseignees avant soumission a la RH.",
        missingAnswers,
      });
    }

    review.sections = toPersistenceSections(sections);
    review.status = 'Soumis a RH';
    review.submitted_to_user_ids = rhRecipients.map((recipient) => recipient._id);
    review.submitted_to_names = rhRecipients.map((recipient) => recipient.name);
    review.rh_validation_selected = true;
    review.rh_validation_selected_at = new Date();
    review.submitted_at = new Date();
    review.last_saved_at = new Date();
    await review.save();

    return response.json({
      message: rhRecipients.length
        ? `Evaluation soumise a ${rhRecipients.map((recipient) => recipient.name).join(', ')}.`
        : 'Evaluation soumise a la RH / Capital Humain.',
      ...buildManagerReviewPayload(
        review,
        request.user,
        member,
        buildSelfEvaluationPayload(selfEvaluationInstance),
        rhRecipients,
        missionAndScoreData
      ),
    });
  },
  async saveManagerMemberMissionReviews(request, response) {
    const rawMissionReviews = Array.isArray(request.body?.missionReviews) ? request.body.missionReviews : null;

    if (!rawMissionReviews) {
      return response.status(400).json({
        message: "Les evaluations par mission sont requises.",
      });
    }

    const member = await getMemberForManager(request.user, request.params.memberId);

    if (!member) {
      return response.status(404).json({
        message: "Membre d'equipe introuvable pour ce manager.",
      });
    }

    const [review, selfEvaluationInstance, rhRecipients] = await Promise.all([
      getOrCreateManagerMemberReview(request.user, member),
      getSelfEvaluationInstanceForMember(member),
      resolveRhRecipients(),
    ]);

    await syncManagerMissionReviews(review, request.user, selfEvaluationInstance);
    const nextMissionReviews = normalizeMissionReviews(rawMissionReviews);
    const validationMessage = nextMissionReviews
      .map((missionReview) => validateMissionReviewCriteria(missionReview.criteria || []))
      .find(Boolean);

    if (validationMessage) {
      return response.status(400).json({ message: validationMessage });
    }

    review.mission_reviews = nextMissionReviews;
    review.last_saved_at = new Date();
    await review.save();

    const missionAndScoreData = await buildManagerMissionAndGlobalInputs(request.user, member, selfEvaluationInstance, review);

    return response.json({
      message: 'Evaluation manager par mission enregistree.',
      ...buildManagerReviewPayload(
        review,
        request.user,
        member,
        buildSelfEvaluationPayload(selfEvaluationInstance),
        rhRecipients,
        missionAndScoreData
      ),
    });
  },
  async submitManagerMemberMissionReview(request, response) {
    const missionId = String(request.body?.missionId || request.params.missionId || '').trim();

    if (!missionId) {
      return response.status(400).json({
        message: 'La mission a soumettre est requise.',
      });
    }

    const member = await getMemberForManager(request.user, request.params.memberId);

    if (!member) {
      return response.status(404).json({
        message: "Membre d'equipe introuvable pour ce manager.",
      });
    }

    const [review, selfEvaluationInstance, rhRecipients] = await Promise.all([
      getOrCreateManagerMemberReview(request.user, member),
      getSelfEvaluationInstanceForMember(member),
      resolveRhRecipients(),
    ]);

    await syncManagerMissionReviews(review, request.user, selfEvaluationInstance);
    const missionReview = (review.mission_reviews || []).find((mission) => mission.mission_id === missionId);

    if (!missionReview) {
      return response.status(404).json({
        message: 'Mission introuvable dans cette evaluation manager.',
      });
    }

    const hasIncompleteCriterion = (missionReview.criteria || []).some(
      (criterion) => criterion.score === null || criterion.score === undefined
    );

    if (hasIncompleteCriterion) {
      return response.status(400).json({
        message: 'Toutes les questions de la mission doivent etre renseignees avant soumission a la RH.',
      });
    }

    missionReview.status = 'Soumise a RH';
    missionReview.submitted_at = new Date();
    review.status = 'Soumis a RH';
    review.submitted_to_user_ids = rhRecipients.map((recipient) => recipient._id);
    review.submitted_to_names = rhRecipients.map((recipient) => recipient.name);
    review.rh_validation_selected = true;
    review.rh_validation_selected_at = new Date();
    review.last_saved_at = new Date();
    await review.save();

    const missionAndScoreData = await buildManagerMissionAndGlobalInputs(request.user, member, selfEvaluationInstance, review);

    return response.json({
      message: rhRecipients.length
        ? `Mission soumise a ${rhRecipients.map((recipient) => recipient.name).join(', ')}.`
        : 'Mission soumise a la RH / Capital Humain.',
      ...buildManagerReviewPayload(
        review,
        request.user,
        member,
        buildSelfEvaluationPayload(selfEvaluationInstance),
        rhRecipients,
        missionAndScoreData
      ),
    });
  },
  getManagerOverview,
  saveMyManagerEvaluation,
  submitMyManagerEvaluation,
};
