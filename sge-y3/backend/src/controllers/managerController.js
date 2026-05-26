const User = require('../models/User');
const EvaluationInstance = require('../models/EvaluationInstance');
const ManagerMemberReview = require('../models/ManagerMemberReview');
const SeniorAssistantReview = require('../models/SeniorAssistantReview');
const CommitteeDecision = require('../models/CommitteeDecision');
const { buildEvaluationTemplateForUser } = require('../utils/competencyMatrix');
const {
  getAverageFromScores,
  getAverageScore,
  getEvaluationSummary,
  getPageJustifications,
  getOverallAverageScore,
  normalizeSections,
  validateFinalCommentForSubmit,
  validateLowScorePageComments,
  validateSectionCommentsForSubmit,
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

function buildManagerMissionCriteria(sections = []) {
  return sections.flatMap((section) =>
    (section.pages || []).flatMap((page) =>
      (page.themes || []).map((theme) => ({
        criterion_id: `${page.page_id}-${theme.theme_id}`,
        section_title: section.title,
        page_title: page.title,
        source_sheet: page.source_sheet || '',
        source_label: page.source_label || '',
        theme_code: theme.code,
        section_comment: '',
        page_comment: '',
        label: theme.label,
        statement: theme.statement || '',
        score: null,
      }))
    )
  );
}

function normalizeManagerMissionEvaluations(missionEvaluations = []) {
  return missionEvaluations.map((mission) => ({
    mission_id: String(mission.id || mission.mission_id || '').trim(),
    title: String(mission.title || '').trim(),
    period: String(mission.period || '').trim(),
    department: String(mission.department || '').trim(),
    member_user_id: mission.member_user_id || mission.memberUserId || mission.memberId || null,
    member_name: String(mission.member_name || mission.memberName || '').trim(),
    member_grade: String(mission.member_grade || mission.memberGrade || '').trim(),
    member_department: String(mission.member_department || mission.memberDepartment || '').trim(),
    created_by_role: String(mission.created_by_role || mission.createdByRole || 'self').trim() || 'self',
    assigned_by_user_id: mission.assigned_by_user_id || mission.assignedByUserId || null,
    assigned_by_name: String(mission.assigned_by_name || mission.assignedByName || '').trim(),
    assigned_by_grade: String(mission.assigned_by_grade || mission.assignedByGrade || '').trim(),
    assigned_at: mission.assigned_at || mission.assignedAt || null,
    primary_recipient_user_id: mission.primary_recipient_user_id || mission.primaryRecipientUserId || null,
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
          section_comment: String(criterion.sectionComment || criterion.section_comment || '').trim(),
          page_comment: String(criterion.pageComment || criterion.page_comment || '').trim(),
          label: String(criterion.label || '').trim(),
          statement: String(criterion.statement || '').trim(),
          score: criterion.score === null || criterion.score === undefined ? null : Number(criterion.score),
        }))
      : [],
    comment: String(mission.comment || '').trim(),
    status: String(mission.status || 'Brouillon').trim(),
    submitted_at: mission.submitted_at || mission.submittedAt || null,
  }));
}

function formatManagerMissionEvaluations(missionEvaluations = []) {
  return missionEvaluations.map((mission) => ({
    id: mission.mission_id,
    title: mission.title,
    period: mission.period,
    department: mission.department,
    memberId: mission.member_user_id?.toString?.() || String(mission.member_user_id || ''),
    memberName: mission.member_name || '',
    memberGrade: mission.member_grade || '',
    memberDepartment: mission.member_department || '',
    createdByRole: mission.created_by_role || 'self',
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
      sectionComment: criterion.section_comment || '',
      pageComment: criterion.page_comment || '',
      label: criterion.label,
      statement: criterion.statement,
      score: criterion.score,
    })),
    comment: mission.comment || '',
    status: mission.status || 'Brouillon',
    submittedAt: mission.submitted_at || null,
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

async function resolveAssociateRecipients() {
  return User.find({
    is_active: true,
    $or: [{ code_categorie: '11' }, { grade: 'Associé' }, { grade: 'Associe' }],
  })
    .sort({ last_name: 1, first_name: 1 })
    .select('_id name first_name last_name grade department code_categorie');
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
    sectionComments: sections
      .filter((section) => String(section.comment || '').trim())
      .map((section) => ({
        sectionId: section.id,
        title: section.title,
        comment: String(section.comment || '').trim(),
      })),
    titleJustifications: getPageJustifications(sections),
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

async function resolveManagerTeamMembers(managerUser) {
  const managedDepartments = getManagedDepartmentsForManager(managerUser.department);

  if (!managedDepartments.length) {
    return [];
  }

  return User.find({
    is_active: true,
    _id: { $ne: managerUser._id },
    code_categorie: { $in: ['8C', '9A', '9B'] },
    department: { $in: managedDepartments },
  })
    .sort({ last_name: 1, first_name: 1 })
    .select('_id name first_name last_name grade department code_categorie');
}

function buildManagerSelfEvaluationPayload(instance, user, rhRecipients = [], teamMembers = []) {
  const sections = normalizeSections(instance.sections || []);
  const activeSection = sections.find((section) => section.status !== 'Complete') || sections[0] || null;
  const missionEvaluations = formatManagerMissionEvaluations(normalizeManagerMissionEvaluations(instance.mission_evaluations || []));

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
    mission_evaluations: missionEvaluations,
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
    team_members: teamMembers.map((member) => ({
      id: member._id.toString(),
      name: member.name,
      first_name: member.first_name,
      last_name: member.last_name,
      grade: member.grade,
      department: member.department,
      code_categorie: member.code_categorie,
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

function getMissionReviewSections(missionReview) {
  const sectionMap = new Map();

  (missionReview?.criteria || []).forEach((criterion) => {
    const sectionTitle = String(criterion.section_title || criterion.sectionTitle || '').trim();
    const pageTitle = String(criterion.page_title || criterion.pageTitle || '').trim();
    const sectionKey = sectionTitle || 'Section';
    const pageKey = `${sectionKey}::${pageTitle || 'Titre'}`;

    if (!sectionMap.has(sectionKey)) {
      sectionMap.set(sectionKey, {
        title: sectionTitle,
        comment: String(criterion.section_comment || criterion.sectionComment || '').trim(),
        pages: new Map(),
      });
    }

    const section = sectionMap.get(sectionKey);
    const sectionComment = String(criterion.section_comment || criterion.sectionComment || '').trim();
    if (!section.comment && sectionComment) section.comment = sectionComment;

    if (!section.pages.has(pageKey)) {
      section.pages.set(pageKey, {
        title: pageTitle,
        comment: String(criterion.page_comment || criterion.pageComment || '').trim(),
        criteria: [],
      });
    }

    const page = section.pages.get(pageKey);
    const pageComment = String(criterion.page_comment || criterion.pageComment || '').trim();
    if (!page.comment && pageComment) page.comment = pageComment;
    page.criteria.push(criterion);
  });

  return Array.from(sectionMap.values()).map((section) => ({
    ...section,
    pages: Array.from(section.pages.values()),
  }));
}

function getMissionSectionComments(missionReview) {
  return getMissionReviewSections(missionReview)
    .filter((section) => String(section.comment || '').trim())
    .map((section) => ({ sectionId: section.title, title: section.title, comment: String(section.comment || '').trim() }));
}

function getMissionTitleJustifications(missionReview) {
  return getMissionReviewSections(missionReview).flatMap((section) =>
    section.pages
      .filter((page) => String(page.comment || '').trim())
      .map((page) => ({
        sectionId: section.title,
        sectionTitle: section.title,
        pageId: `${section.title}-${page.title}`,
        pageTitle: page.title,
        comment: String(page.comment || '').trim(),
      }))
  );
}

function validateMissionSectionCommentsForSubmit(missionReview, minimumLength = 3) {
  const normalizedMinimumLength = Math.max(Number(minimumLength) || 0, 1);
  return getMissionReviewSections(missionReview)
    .filter((section) => String(section.comment || '').trim().length < normalizedMinimumLength)
    .map((section) => ({ sectionTitle: section.title }));
}

function validateMissionLowScorePageComments(missionReview, minimumLength = 3) {
  const normalizedMinimumLength = Math.max(Number(minimumLength) || 0, 1);
  const missingPageComments = [];

  getMissionReviewSections(missionReview).forEach((section) => {
    section.pages.forEach((page) => {
      const hasLowScore = page.criteria.some((criterion) => typeof criterion.score === 'number' && criterion.score < 3);
      if (hasLowScore && String(page.comment || '').trim().length < normalizedMinimumLength) {
        missingPageComments.push({ sectionTitle: section.title, pageTitle: page.title });
      }
    });
  });

  return missingPageComments;
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
    assigned_by_user_id: mission.assigned_by_user_id || mission.assignedByUserId || null,
    assigned_by_name: String(mission.assigned_by_name || mission.assignedByName || '').trim(),
    assigned_by_grade: String(mission.assigned_by_grade || mission.assignedByGrade || '').trim(),
    assigned_at: mission.assigned_at || mission.assignedAt || null,
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
          section_comment: String(criterion.sectionComment || criterion.section_comment || '').trim(),
          page_comment: String(criterion.pageComment || criterion.page_comment || '').trim(),
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
    assignedByUserId: mission.assigned_by_user_id?.toString?.() || String(mission.assigned_by_user_id || ''),
    assignedByName: mission.assigned_by_name || '',
    assignedByGrade: mission.assigned_by_grade || '',
    assignedAt: mission.assigned_at || null,
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
    origin:
      mission.created_by_role === 'manager'
        ? 'manager-assigned'
        : mission.created_by_role === 'senior'
          ? 'senior-assigned'
          : 'assistant-self',
    assigned_by_user_id: mission.assigned_by_user_id || null,
    assigned_by_name: mission.assigned_by_name || '',
    assigned_by_grade: mission.assigned_by_grade || '',
    assigned_at: mission.assigned_at || null,
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
      section_comment: criterion.section_comment || '',
      page_comment: criterion.page_comment || '',
      label: criterion.label,
      statement: criterion.statement,
      score: null,
    })),
    submitted_at: null,
  };
}

function createManagerAssignedMissionReview({ missionId, title, period, member, managerUser }) {
  const evaluationDepartment = resolveEvaluationDepartmentForManagerReview(managerUser, member);
  const missionCriteria = buildManagerMissionCriteria(cloneTemplateForMember(member, evaluationDepartment));

  return {
    mission_id: missionId,
    title,
    period,
    department: evaluationDepartment,
    origin: 'manager-assigned',
    assigned_by_user_id: managerUser._id,
    assigned_by_name: managerUser.name,
    assigned_by_grade: managerUser.grade,
    assigned_at: new Date(),
    recipient_name: managerUser.name,
    recipient_grade: managerUser.grade,
    recipient_department: managerUser.department,
    assistant_submitted_at: null,
    status: 'A demarrer',
    comment: '',
    criteria: missionCriteria,
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

  const pendingManagerAssignedReviews = currentMissionReviews.filter(
    (mission) => mission.origin === 'manager-assigned' && !submittedMissionIds.has(mission.mission_id)
  );

  review.mission_reviews = [...pendingManagerAssignedReviews, ...persistedSubmittedReviews, ...nextMissionReviews];
  return review;
}

async function buildManagerMissionAndGlobalInputs(managerUser, member, selfEvaluationInstance, review = null) {
  const payload = {
    globalScores: [],
    missions: [],
  };
  const seniorReviews =
    member.code_categorie === '8C'
      ? await SeniorAssistantReview.find({
          cycle_label: CURRENT_CYCLE_LABEL,
          assistant_id: member._id,
          submitted_to_user_ids: managerUser._id,
        }).select('senior_id sections mission_reviews submitted_at status')
      : [];

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
    const normalizedSeniorSections = normalizeSections(review.sections || []);

    payload.globalScores.push({
      source: 'senior-review',
      evaluatorName: seniorUser?.name || 'Senior',
      evaluatorGrade: seniorUser?.grade || 'Senior',
      finalScore: getOverallAverageScore(normalizedSeniorSections),
      submittedAt: review.submitted_at || null,
      sectionComments: normalizedSeniorSections
        .filter((section) => String(section.comment || '').trim())
        .map((section) => ({
          sectionId: section.id,
          title: section.title,
          comment: String(section.comment || '').trim(),
        })),
      titleJustifications: getPageJustifications(normalizedSeniorSections),
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
        sectionComments: getMissionSectionComments(missionReview),
        titleJustifications: getMissionTitleJustifications(missionReview),
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
      sectionComments: getMissionSectionComments(mission),
      titleJustifications: getMissionTitleJustifications(mission),
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

function formatMember(member, evaluationInstance, managerReview) {
  return {
    id: member._id.toString(),
    name: member.name,
    first_name: member.first_name,
    last_name: member.last_name,
    grade: member.grade,
    department: member.department,
    code_categorie: member.code_categorie,
    evaluationStatus: managerReview?.status || 'En attente',
    evaluationSubmittedAt: managerReview?.submitted_at || null,
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

function buildScoreDetail({
  category = '',
  source = '',
  evaluatorName = '',
  evaluatorGrade = '',
  missionTitle = '',
  score = null,
  submittedAt = null,
}) {
  return {
    category,
    source,
    evaluatorName,
    evaluatorGrade,
    missionTitle,
    score,
    submittedAt,
  };
}

function getAverageFromDetails(details = []) {
  return getAverageFromScores(details.map((detail) => detail.score));
}

function getLatestCommitteeDecisionMap(decisionDocument) {
  const decisions = decisionDocument?.decisions;

  if (!decisions || typeof decisions !== 'object') {
    return new Map();
  }

  const decisionMap = new Map();

  Object.values(decisions).forEach((group) => {
    if (!Array.isArray(group)) {
      return;
    }

    group.forEach((person) => {
      if (!person || typeof person !== 'object') {
        return;
      }

      const id = String(person.id || '').trim();
      const decision = String(person.finalDecision || person.final_decision || '').trim();

      if (id && decision) {
        decisionMap.set(id, decision);
      }
    });
  });

  return decisionMap;
}

function isCombinedAuditExpertiseDepartment(department = '') {
  return normalizeText(department) === 'AUDIT & EXPERTISE COMPTABLE';
}

function isSameOrCombinedDepartment(referenceDepartment = '', candidateDepartment = '') {
  const normalizedReference = normalizeText(referenceDepartment);
  const normalizedCandidate = normalizeText(candidateDepartment);

  if (!normalizedReference || !normalizedCandidate) {
    return false;
  }

  if (normalizedReference === 'AUDIT & EXPERTISE COMPTABLE' || normalizedCandidate === 'AUDIT & EXPERTISE COMPTABLE') {
    return true;
  }

  return normalizedReference === normalizedCandidate;
}

function shouldRestrictCrossDepartmentAssistant(managerUser, member) {
  return isCombinedAuditExpertiseDepartment(member?.department) && !isCombinedAuditExpertiseDepartment(managerUser?.department);
}

function isSeniorReviewVisibleForManagerDepartment(seniorReview, seniorUser, managerUser, member) {
  if (!shouldRestrictCrossDepartmentAssistant(managerUser, member)) {
    return true;
  }

  return isSameOrCombinedDepartment(managerUser?.department, seniorUser?.department);
}

function isMissionVisibleForManagerDepartment(mission, managerUser, member, reviewerById) {
  if (!shouldRestrictCrossDepartmentAssistant(managerUser, member)) {
    return true;
  }

  if (mission?.created_by_role === 'manager') {
    return true;
  }

  if (mission?.created_by_role === 'senior') {
    const seniorUser = reviewerById.get(String(mission.assigned_by_user_id || ''));
  return isSameOrCombinedDepartment(managerUser?.department, seniorUser?.department || '');
  }

  const recipients = Array.isArray(mission?.recipients) ? mission.recipients : [];
  return recipients.some((recipient) => {
    const recipientGrade = normalizeText(recipient.grade || '');
    const isSeniorRecipient = recipientGrade === 'SENIOR' || recipientGrade === 'SENIOR MANAGER' || recipientGrade === 'ASSISTANT MANAGER';
    return isSeniorRecipient && isSameOrCombinedDepartment(managerUser?.department, recipient.department || '');
  });
}

function isManagerReviewVisibleForManagerDepartment(reviewManagerUser, managerUser, member) {
  if (!shouldRestrictCrossDepartmentAssistant(managerUser, member)) {
    return true;
  }

  return isSameOrCombinedDepartment(managerUser?.department, reviewManagerUser?.department);
}

function getAutomaticRecommendation(finalScore) {
  if (typeof finalScore !== 'number') {
    return 'Maintien';
  }

  return finalScore >= 4 ? 'Augmentation' : 'Maintien';
}

function countUnjustifiedLowScorePages(sections = []) {
  return (sections || []).reduce((total, section) => {
    const hasSectionComment = Boolean(String(section.comment || '').trim());
    return (
      total +
      (section.pages || []).reduce((pageTotal, page) => {
        const hasLowScore = (page.themes || []).some((theme) => typeof theme.score === 'number' && theme.score < 3);
        return pageTotal + (hasLowScore && !hasSectionComment ? 1 : 0);
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
  const [evaluationInstances, managerReviews] = memberIds.length
    ? await Promise.all([
        EvaluationInstance.find({
          evalue_id: { $in: memberIds },
          cycle_label: CURRENT_CYCLE_LABEL,
          template_type: { $in: ['assistant-self-evaluation', 'senior-self-evaluation'] },
        }).select('evalue_id template_type status submitted_at submitted_to_user_ids sections'),
        ManagerMemberReview.find({
          cycle_label: CURRENT_CYCLE_LABEL,
          manager_id: request.user._id,
          member_id: { $in: memberIds },
        }).select('member_id status submitted_at sections'),
      ])
    : [[], []];

  const relevantInstancesByMemberId = new Map();
  const managerReviewsByMemberId = new Map(
    managerReviews.map((review) => [String(review.member_id), review])
  );

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
    const review = managerReviewsByMemberId.get(String(member._id));

    if (review?.status === 'Soumis a RH') {
      return null;
    }

    return {
      id: member._id.toString(),
      name: member.name,
      grade: member.grade,
      department: member.department,
      submittedAt: instance?.submitted_at || null,
      status: instance?.status || 'Soumis aux Managers',
      templateType: instance?.template_type || getExpectedTemplateType(member),
    };
  }).filter(Boolean);

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
    members: members.map((member) =>
      formatMember(
        member,
        relevantInstancesByMemberId.get(String(member._id)),
        managerReviewsByMemberId.get(String(member._id))
      )
    ),
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
  const [managerReviews, allManagerReviews, seniorReviews, selfEvaluationInstances, latestCommitteeDecision, reviewerUsers] =
    memberIds.length
      ? await Promise.all([
          ManagerMemberReview.find({
            cycle_label: CURRENT_CYCLE_LABEL,
            manager_id: request.user._id,
            member_id: { $in: memberIds },
          }).select('member_id status submitted_at sections'),
          ManagerMemberReview.find({
            cycle_label: CURRENT_CYCLE_LABEL,
            member_id: { $in: memberIds },
          }).select('member_id manager_id status submitted_at sections mission_reviews'),
          SeniorAssistantReview.find({
            cycle_label: CURRENT_CYCLE_LABEL,
            assistant_id: { $in: memberIds },
          }).select('assistant_id senior_id status submitted_at sections mission_reviews'),
          EvaluationInstance.find({
            cycle_label: CURRENT_CYCLE_LABEL,
            evalue_id: { $in: memberIds },
            template_type: { $in: ['assistant-self-evaluation', 'senior-self-evaluation'] },
          }).select('evalue_id template_type status submitted_at sections mission_evaluations'),
          CommitteeDecision.findOne({ scope: 'associate-final', cycle_label: CURRENT_CYCLE_LABEL }).sort({ submitted_at: -1 }),
          User.find({ is_active: true }).select('_id name grade department'),
        ])
      : [[], [], [], [], null, []];

  const reviewByMemberId = new Map(managerReviews.map((review) => [String(review.member_id), review]));
  const selfEvaluationByMemberId = new Map(
    selfEvaluationInstances.map((instance) => [String(instance.evalue_id), instance])
  );
  const allManagerReviewsByMemberId = new Map();
  const seniorReviewsByAssistantId = new Map();
  const reviewerById = new Map(reviewerUsers.map((user) => [String(user._id), user]));
  const finalDecisionByMemberId = getLatestCommitteeDecisionMap(latestCommitteeDecision);

  allManagerReviews.forEach((review) => {
    const key = String(review.member_id);
    const current = allManagerReviewsByMemberId.get(key) || [];
    current.push(review);
    allManagerReviewsByMemberId.set(key, current);
  });

  seniorReviews.forEach((review) => {
    const key = String(review.assistant_id);
    const current = seniorReviewsByAssistantId.get(key) || [];
    current.push(review);
    seniorReviewsByAssistantId.set(key, current);
  });

  const rows = members.map((member) => {
    const review = reviewByMemberId.get(String(member._id));
    const sections = normalizeSections(review?.sections || []);
    const summary = getEvaluationSummary(sections);
    const selfEvaluationInstance = selfEvaluationByMemberId.get(String(member._id)) || null;
    const memberSeniorReviews = seniorReviewsByAssistantId.get(String(member._id)) || [];
    const memberManagerReviews = allManagerReviewsByMemberId.get(String(member._id)) || [];

    const missionScoreDetails = [];
    for (const mission of selfEvaluationInstance?.mission_evaluations || []) {
      const score = getMissionAverage(mission.criteria || []);
      if (
        mission.status === 'Soumise' &&
        typeof score === 'number' &&
        isMissionVisibleForManagerDepartment(mission, request.user, member, reviewerById)
      ) {
        missionScoreDetails.push(
          buildScoreDetail({
            category: 'mission',
            source: 'Auto-evaluation',
            evaluatorName: member.name,
            evaluatorGrade: member.grade,
            missionTitle: mission.title,
            score,
            submittedAt: mission.submitted_at || null,
          })
        );
      }
    }

    memberSeniorReviews.forEach((seniorReview) => {
      const seniorUser = reviewerById.get(String(seniorReview.senior_id));
      if (!isSeniorReviewVisibleForManagerDepartment(seniorReview, seniorUser, request.user, member)) {
        return;
      }
      for (const missionReview of seniorReview.mission_reviews || []) {
        const score = getMissionAverage(missionReview.criteria || []);
        if (missionReview.status === 'Transmise' && typeof score === 'number') {
          missionScoreDetails.push(
            buildScoreDetail({
              category: 'mission',
              source: 'Senior',
              evaluatorName: seniorUser?.name || 'Senior',
              evaluatorGrade: seniorUser?.grade || 'Senior',
              missionTitle: missionReview.title,
              score,
              submittedAt: missionReview.submitted_at || null,
            })
          );
        }
      }
    });

    memberManagerReviews.forEach((managerReview) => {
      const managerUser = reviewerById.get(String(managerReview.manager_id));
      if (!isManagerReviewVisibleForManagerDepartment(managerUser, request.user, member)) {
        return;
      }
      for (const missionReview of managerReview.mission_reviews || []) {
        const score = getMissionAverage(missionReview.criteria || []);
        if (missionReview.status === 'Soumise a RH' && typeof score === 'number') {
          missionScoreDetails.push(
            buildScoreDetail({
              category: 'mission',
              source: 'Manager',
              evaluatorName: managerUser?.name || 'Manager',
              evaluatorGrade: managerUser?.grade || 'Manager',
              missionTitle: missionReview.title,
              score,
              submittedAt: missionReview.submitted_at || null,
            })
          );
        }
      }
    });

    const globalScoreDetails = [];
    const selfGlobalScore = getOverallAverageScore(normalizeSections(selfEvaluationInstance?.sections || []));
    if (selfEvaluationInstance?.submitted_at && typeof selfGlobalScore === 'number') {
      globalScoreDetails.push(
        buildScoreDetail({
          category: 'global',
          source: 'Auto-evaluation',
          evaluatorName: member.name,
          evaluatorGrade: member.grade,
          score: selfGlobalScore,
          submittedAt: selfEvaluationInstance.submitted_at || null,
        })
      );
    }

    memberSeniorReviews.forEach((seniorReview) => {
      const seniorScore = getOverallAverageScore(normalizeSections(seniorReview.sections || []));
      const seniorUser = reviewerById.get(String(seniorReview.senior_id));
      if (
        seniorReview.submitted_at &&
        typeof seniorScore === 'number' &&
        isSeniorReviewVisibleForManagerDepartment(seniorReview, seniorUser, request.user, member)
      ) {
        globalScoreDetails.push(
          buildScoreDetail({
            category: 'global',
            source: 'Senior',
            evaluatorName: seniorUser?.name || 'Senior',
            evaluatorGrade: seniorUser?.grade || 'Senior',
            score: seniorScore,
            submittedAt: seniorReview.submitted_at || null,
          })
        );
      }
    });

    memberManagerReviews.forEach((managerReview) => {
      const managerScore = getOverallAverageScore(normalizeSections(managerReview.sections || []));
      const managerUser = reviewerById.get(String(managerReview.manager_id));
      if (
        managerReview.submitted_at &&
        typeof managerScore === 'number' &&
        isManagerReviewVisibleForManagerDepartment(managerUser, request.user, member)
      ) {
        globalScoreDetails.push(
          buildScoreDetail({
            category: 'global',
            source: 'Manager',
            evaluatorName: managerUser?.name || 'Manager',
            evaluatorGrade: managerUser?.grade || 'Manager',
            score: managerScore,
            submittedAt: managerReview.submitted_at || null,
          })
        );
      }
    });

    const missionScore = getAverageFromDetails(missionScoreDetails);
    const globalScore = getAverageFromDetails(globalScoreDetails);

    return {
      id: member._id.toString(),
      name: member.name,
      initials: getInitialsFromMember(member),
      grade: member.grade,
      department: member.department,
      status: review?.status || 'En attente',
      submittedAt: review?.submitted_at || null,
      missionScore,
      globalScore,
      missionScoreDetails,
      globalScoreDetails,
      progress: summary.globalProgress || 0,
      finalDecision: finalDecisionByMemberId.get(member._id.toString()) || 'En attente',
      unjustifiedLowScores: countUnjustifiedLowScorePages(sections),
    };
  });

  const rowsWithMissionScore = rows.filter((row) => typeof row.missionScore === 'number');
  const rowsWithGlobalScore = rows.filter((row) => typeof row.globalScore === 'number');
  const completedRows = rows.filter((row) => row.progress === 100);
  const unjustifiedGapCount = rows.reduce((total, row) => total + row.unjustifiedLowScores, 0);
  const missionTeamAverage = rowsWithMissionScore.length
    ? Number(
        (
          rowsWithMissionScore.reduce((total, row) => total + row.missionScore, 0) / rowsWithMissionScore.length
        ).toFixed(1)
      )
    : null;
  const globalTeamAverage = rowsWithGlobalScore.length
    ? Number(
        (
          rowsWithGlobalScore.reduce((total, row) => total + row.globalScore, 0) / rowsWithGlobalScore.length
        ).toFixed(1)
      )
    : null;
  const completionRate = rows.length ? Math.round((completedRows.length / rows.length) * 100) : 0;

  return response.json({
    cycle_label: CURRENT_CYCLE_LABEL,
    kpis: {
      missionTeamAverage,
      globalTeamAverage,
      completionRate,
      completedEvaluationsCount: completedRows.length,
      totalMembers: rows.length,
      unjustifiedGapCount,
    },
    rows,
  });
}

async function getMyManagerEvaluation(request, response) {
  const [instance, rhRecipients, teamMembers] = await Promise.all([
    getOrCreateManagerSelfEvaluation(request.user),
    resolveRhRecipients(),
    resolveManagerTeamMembers(request.user),
  ]);

  return response.json(buildManagerSelfEvaluationPayload(instance, request.user, rhRecipients, teamMembers));
}

async function addMyManagerMissionEvaluation(request, response) {
  const title = String(request.body?.title || '').trim();
  const period = String(request.body?.period || '').trim();

  if (!title) {
    return response.status(400).json({
      message: 'Le titre de la mission est requis.',
    });
  }

  const [instance, rhRecipients, teamMembers] = await Promise.all([
    getOrCreateManagerSelfEvaluation(request.user),
    resolveRhRecipients(),
    resolveManagerTeamMembers(request.user),
  ]);
  const templateSections = cloneManagerSelfTemplate(request.user);
  const missionEvaluations = normalizeManagerMissionEvaluations(instance.mission_evaluations || []);

  missionEvaluations.push({
    mission_id: `manager-mission-${request.user._id}-${Date.now()}`,
    title,
    period,
    department: request.user.department || '',
    member_user_id: null,
    member_name: '',
    member_grade: '',
    member_department: '',
    created_by_role: 'self',
    assigned_by_user_id: null,
    assigned_by_name: '',
    assigned_by_grade: '',
    assigned_at: null,
    primary_recipient_user_id: null,
    primary_recipient_name: '',
    primary_recipient_grade: '',
    primary_recipient_department: '',
    recipients: [],
    criteria: buildManagerMissionCriteria(templateSections),
    comment: '',
    status: 'Brouillon',
    submitted_at: null,
  });

  instance.mission_evaluations = missionEvaluations;
  instance.last_saved_at = new Date();
  await instance.save();

  return response.json({
    message: 'Mission manager ajoutee.',
    ...buildManagerSelfEvaluationPayload(instance, request.user, rhRecipients, teamMembers),
  });
}

async function addMissionToManagerMember(request, response) {
  const title = String(request.body?.title || '').trim();
  const period = String(request.body?.period || '').trim() || 'Periode non renseignee';

  if (!title) {
    return response.status(400).json({
      message: 'Le titre de la mission est requis.',
    });
  }

  const member = await getMemberForManager(request.user, request.params.memberId);

  if (!member) {
    return response.status(404).json({
      message: "Membre d'equipe introuvable pour ce manager.",
    });
  }

  const evaluationDepartment = resolveEvaluationDepartmentForManagerReview(request.user, member);
  const [review, selfEvaluationInstance, rhRecipients] = await Promise.all([
    getOrCreateManagerMemberReview(request.user, member),
    getSelfEvaluationInstanceForMember(member),
    resolveRhRecipients(),
  ]);

  const missionId = `manager-${request.user._id}-${member._id}-${Date.now()}`;
  const assignedAt = new Date();
  const missionCriteria = buildManagerMissionCriteria(cloneTemplateForMember(member, evaluationDepartment));

  selfEvaluationInstance.mission_evaluations = [
    ...(selfEvaluationInstance.mission_evaluations || []),
    {
      mission_id: missionId,
      title,
      period,
      department: evaluationDepartment,
      created_by_role: 'manager',
      assigned_by_user_id: request.user._id,
      assigned_by_name: request.user.name,
      assigned_by_grade: request.user.grade,
      assigned_at: assignedAt,
      primary_recipient_user_id: request.user._id,
      primary_recipient_name: request.user.name,
      primary_recipient_grade: request.user.grade,
      primary_recipient_department: request.user.department,
      recipients: [
        {
          user_id: request.user._id,
          name: request.user.name,
          grade: request.user.grade,
          department: request.user.department,
        },
      ],
      criteria: missionCriteria,
      comment: '',
      status: 'Brouillon',
      submitted_at: null,
    },
  ];
  selfEvaluationInstance.last_saved_at = assignedAt;
  await selfEvaluationInstance.save();

  review.mission_reviews = [
    ...normalizeMissionReviews(review.mission_reviews || []),
    {
      ...createManagerAssignedMissionReview({ missionId, title, period, member, managerUser: request.user }),
      assigned_at: assignedAt,
    },
  ];
  review.last_saved_at = assignedAt;
  await review.save();

  const missionAndScoreData = await buildManagerMissionAndGlobalInputs(request.user, member, selfEvaluationInstance, review);

  return response.json({
    message: `Mission ajoutee pour ${member.name}. Le membre la verra dans son auto-evaluation par mission.`,
    ...buildManagerReviewPayload(
      review,
      request.user,
      member,
      buildSelfEvaluationPayload(selfEvaluationInstance),
      rhRecipients,
      missionAndScoreData
    ),
  });
}

async function saveMyManagerEvaluation(request, response) {
  const rawSections = Array.isArray(request.body?.sections) ? request.body.sections : null;
  const missionEvaluations = Array.isArray(request.body?.missionEvaluations)
    ? normalizeManagerMissionEvaluations(request.body.missionEvaluations)
    : null;
  const isMissionOnlyEvaluation = Array.isArray(missionEvaluations) && missionEvaluations.length > 0;

  if (!rawSections?.length && !isMissionOnlyEvaluation) {
    return response.status(400).json({
      message: "Les sections ou les evaluations par mission de l'auto-evaluation manager sont requises.",
    });
  }

  const sections = rawSections?.length ? normalizeSections(rawSections) : [];

  if (rawSections?.length) {
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
  }

  if (missionEvaluations) {
    for (const mission of missionEvaluations) {
      for (const criterion of mission.criteria || []) {
        if (criterion.score !== null && criterion.score !== undefined) {
          if (!Number.isInteger(criterion.score) || criterion.score < 1 || criterion.score > 5) {
            return response.status(400).json({
              message: `La note du critere "${criterion.label}" doit etre comprise entre 1 et 5.`,
            });
          }
        }
      }
    }
  }

  const [instance, rhRecipients, teamMembers] = await Promise.all([
    getOrCreateManagerSelfEvaluation(request.user),
    resolveRhRecipients(),
    resolveManagerTeamMembers(request.user),
  ]);
  const summary = getEvaluationSummary(sections);

  if (rawSections?.length) {
    instance.sections = toPersistenceSections(sections);
  }
  if (missionEvaluations) {
    instance.mission_evaluations = missionEvaluations;
  }
  instance.status =
    isMissionOnlyEvaluation
      ? missionEvaluations.every((mission) => (mission.criteria || []).every((criterion) => criterion.score !== null && criterion.score !== undefined))
        ? 'En cours'
        : 'Brouillon'
      : summary.globalProgress === 0
      ? 'Brouillon'
      : 'En cours';
  instance.last_saved_at = new Date();
  await instance.save();

  return response.json({
    message: 'Auto-evaluation manager enregistree.',
    ...buildManagerSelfEvaluationPayload(instance, request.user, rhRecipients, teamMembers),
  });
}

async function submitMyManagerEvaluation(request, response) {
  const [instance, rhRecipients, teamMembers] = await Promise.all([
    getOrCreateManagerSelfEvaluation(request.user),
    resolveRhRecipients(),
    resolveManagerTeamMembers(request.user),
  ]);
  const sections = normalizeSections(instance.sections || []);
  const missionEvaluations = normalizeManagerMissionEvaluations(instance.mission_evaluations || []);
  const hasMissionEvaluations = missionEvaluations.length > 0;

  if (hasMissionEvaluations) {
    const pendingMissions = missionEvaluations.filter((mission) => mission.status !== 'Soumise');

    if (pendingMissions.length) {
      return response.status(400).json({
        message: 'Chaque mission doit etre soumise a la RH et aux associes avant la soumission finale.',
        pendingMissions: pendingMissions.map((mission) => ({
          missionId: mission.mission_id,
          title: mission.title,
        })),
      });
    }

    instance.status = 'Soumis a RH';
    instance.submitted_to_role = 'rh';
    instance.submitted_to_user_ids = rhRecipients.map((recipient) => recipient._id);
    instance.submitted_to_names = rhRecipients.map((recipient) => recipient.name);
    instance.submitted_at = new Date();
    instance.last_saved_at = new Date();
    await instance.save();

    return response.json({
      message: 'Evaluations par mission manager transmises a la RH / Capital Humain et aux associes.',
      ...buildManagerSelfEvaluationPayload(instance, request.user, rhRecipients, teamMembers),
    });
  }

  const missingAnswers = validateSectionsForSubmit(sections);

  if (missingAnswers.length) {
    return response.status(400).json({
      message: 'Toutes les questions obligatoires doivent etre renseignees avant soumission.',
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
    ...buildManagerSelfEvaluationPayload(instance, request.user, rhRecipients, teamMembers),
  });
}

async function submitMyManagerMissionEvaluation(request, response) {
  const missionId = String(request.body?.missionId || request.params.missionId || '').trim();

  if (!missionId) {
    return response.status(400).json({
      message: 'La mission manager a soumettre est requise.',
    });
  }

  const [instance, rhRecipients, associateRecipients, teamMembers] = await Promise.all([
    getOrCreateManagerSelfEvaluation(request.user),
    resolveRhRecipients(),
    resolveAssociateRecipients(),
    resolveManagerTeamMembers(request.user),
  ]);
  const missionEvaluations = normalizeManagerMissionEvaluations(instance.mission_evaluations || []);
  const mission = missionEvaluations.find((item) => item.mission_id === missionId);

  if (!mission) {
    return response.status(404).json({
      message: 'Mission manager introuvable.',
    });
  }

  const hasIncompleteCriterion = (mission.criteria || []).some(
    (criterion) => criterion.score === null || criterion.score === undefined
  );

  if (hasIncompleteCriterion) {
    return response.status(400).json({
      message: 'Toutes les questions de la mission manager doivent etre renseignees avant soumission.',
    });
  }

  const allRecipients = [...rhRecipients, ...associateRecipients];

  if (!allRecipients.length) {
    return response.status(400).json({
      message: "Aucun destinataire actif n'est disponible pour recevoir cette mission manager.",
    });
  }

  mission.primary_recipient_user_id = rhRecipients[0]?._id || associateRecipients[0]?._id || null;
  mission.primary_recipient_name = rhRecipients[0]?.name || associateRecipients[0]?.name || '';
  mission.primary_recipient_grade = rhRecipients[0]?.grade || associateRecipients[0]?.grade || '';
  mission.primary_recipient_department = rhRecipients[0]?.department || associateRecipients[0]?.department || '';
  mission.recipients = allRecipients.map((recipient) => ({
    user_id: recipient._id,
    name: recipient.name,
    grade: recipient.grade,
    department: recipient.department,
  }));
  mission.status = 'Soumise';
  mission.submitted_at = new Date();

  instance.mission_evaluations = missionEvaluations;
  instance.last_saved_at = new Date();
  await instance.save();

  return response.json({
    message: `Mission manager soumise a la RH et aux associes (${allRecipients.map((recipient) => recipient.name).join(', ')}).`,
    ...buildManagerSelfEvaluationPayload(instance, request.user, rhRecipients, teamMembers),
  });
}

module.exports = {
  addMissionToManagerMember,
  addMyManagerMissionEvaluation,
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

    const missingSectionComments = validateMissionSectionCommentsForSubmit(missionReview, 3);

    if (missingSectionComments.length) {
      return response.status(400).json({
        message: 'Un commentaire de section d au moins 3 caracteres est obligatoire pour chaque section avant soumission.',
        missingSectionComments,
      });
    }

    const missingPageComments = validateMissionLowScorePageComments(missionReview, 3);

    if (missingPageComments.length) {
      return response.status(400).json({
        message: 'Une justification par titre d au moins 3 caracteres est obligatoire pour toute note inferieure a 3.',
        missingPageComments,
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
  submitMyManagerMissionEvaluation,
  submitMyManagerEvaluation,
};
