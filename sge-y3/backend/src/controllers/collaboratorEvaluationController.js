const EvaluationInstance = require('../models/EvaluationInstance');
const ManagerMemberReview = require('../models/ManagerMemberReview');
const User = require('../models/User');
const { cloneAssistantEvaluationTemplate } = require('../utils/assistantEvaluationTemplate');
const { cloneSeniorEvaluationTemplate } = require('../utils/seniorEvaluationTemplate');
const {
  getAverageScore,
  getEvaluationSummary,
  getOverallAverageScore,
  normalizeSections,
  validateFinalCommentForSubmit,
  validateSectionCommentsForSubmit,
  validateSectionsForSubmit,
} = require('../utils/evaluationHelpers');
const { buildMissionResultsPayload } = require('../utils/evaluationHistory');
const { getCurrentCycleLabel } = require('../utils/activeCycle');
const { notifySubmissionRecipients } = require('../utils/submissionNotifications');
const { SUPPORT_EMAILS } = require('../utils/userMapping');

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

function isAssociateRecipient(recipient = {}) {
  const category = String(recipient.code_categorie || '').trim().toUpperCase();
  const grade = normalizeText(recipient.grade || '').replace(/[ÉÈÊË]/g, 'E');
  return category === '11' || grade === 'ASSOCIE';
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
    $or: [
      { code_categorie: { $in: ['9A', '9B', '10B', '10C'] }, department: { $in: targetDepartments } },
      { code_categorie: '11' },
      { grade: 'Associé' },
      { grade: 'Associe' },
    ],
  })
    .sort({ last_name: 1, first_name: 1 })
    .select('_id name first_name last_name grade department code_categorie email');
}

function getCommentSuperiorCategories(user) {
  const category = String(user?.code_categorie || '').replace(/\s+/g, '').toUpperCase();

  if (category.startsWith('8')) {
    return ['9A', '9B', '10B', '10C'];
  }

  if (category === '9A') {
    return ['9B', '10B', '10C'];
  }

  if (category === '9B') {
    return ['10B', '10C'];
  }

  return [];
}

async function resolveCommentTargetsForUser(user) {
  const targetDepartments = getManagerDepartmentsForDepartment(user.department);
  const superiorCategories = getCommentSuperiorCategories(user);
  const userIdStr = String(user._id);

  const [superiorMembers, supportMembers, rhMembers] = await Promise.all([
    targetDepartments.length && superiorCategories.length
      ? User.find({
          is_active: true,
          code_categorie: { $in: superiorCategories },
          department: { $in: targetDepartments },
        })
          .sort({ last_name: 1, first_name: 1 })
          .select('_id name first_name last_name grade department code_categorie')
      : Promise.resolve([]),
    User.find({
      is_active: true,
      $or: [
        { department: { $in: ['SUPPORT', 'SERVICE SUPPORT'] } },
        { email: { $in: SUPPORT_EMAILS } },
      ],
    })
      .sort({ last_name: 1, first_name: 1 })
      .select('_id name first_name last_name grade department code_categorie'),
    User.find({
      is_active: true,
      department: { $in: ['RH', 'CAPITAL HUMAIN'] },
    })
      .sort({ last_name: 1, first_name: 1 })
      .select('_id name first_name last_name grade department code_categorie'),
  ]);

  const seen = new Set();
  const all = [...superiorMembers, ...supportMembers, ...rhMembers].filter((u) => {
    const id = String(u._id);
    if (id === userIdStr || seen.has(id)) return false;
    seen.add(id);
    return true;
  });

  return all.map((u) => ({
    id: u._id.toString(),
    name: u.name,
    first_name: u.first_name,
    last_name: u.last_name,
    grade: u.grade,
    department: u.department,
    code_categorie: u.code_categorie,
  }));
}

async function resolveManagersForSenior(user) {
  const targetDepartments = getManagerDepartmentsForDepartment(user.department);

  if (!targetDepartments.length) {
    return [];
  }

  return User.find({
    is_active: true,
    $or: [
      { code_categorie: { $in: ['10B', '10C'] }, department: { $in: targetDepartments } },
      { code_categorie: '11' },
      { grade: 'Associé' },
      { grade: 'Associe' },
    ],
  })
    .sort({ last_name: 1, first_name: 1 })
    .select('_id name first_name last_name grade department code_categorie email');
}

async function resolveRecipientsForInstance(instance, user) {
  if (instance?.template_type === 'senior-self-evaluation') {
    return resolveManagersForSenior(user);
  }

  return resolveManagersForAssistant(user);
}

function buildRecipientOptions(recipients = [], user) {
  const targetDepartments = getManagerDepartmentsForDepartment(user?.department);
  const groupedRecipientIds = new Set();

  const departmentGroups = targetDepartments.map((department) => {
    const users = recipients.filter(
      (recipient) => String(recipient.department || '').trim().toUpperCase() === String(department || '').trim().toUpperCase()
    );
    users.forEach((recipient) => groupedRecipientIds.add(String(recipient._id || recipient.id || '')));

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
        email: recipient.email,
      })),
    };
  });

  const ungroupedAssociates = recipients.filter(
    (recipient) => isAssociateRecipient(recipient) && !groupedRecipientIds.has(String(recipient._id || recipient.id || ''))
  );

  if (!ungroupedAssociates.length) {
    return departmentGroups;
  }

  return [
    ...departmentGroups,
    {
      department: 'Associés',
      users: ungroupedAssociates.map((recipient) => ({
        id: recipient._id.toString(),
        name: recipient.name,
        first_name: recipient.first_name,
        last_name: recipient.last_name,
        grade: recipient.grade,
        department: recipient.department,
        code_categorie: recipient.code_categorie,
      })),
    },
  ];
}

function buildMissionRecipients(recipients = []) {
  return recipients.map((recipient) => ({
    user_id: recipient._id,
    name: recipient.name,
    grade: recipient.grade,
    department: recipient.department,
    can_evaluate: recipient.can_evaluate !== false,
    receives_copy: recipient.receives_copy === true,
  }));
}

function resolveMissionRecipientMetadata(recipient = {}, resolvedMissionRecipients = []) {
  const recipientUserId = String(recipient._id || recipient.user_id || recipient.id || '').trim();
  const recipientName = normalizeText(recipient.name || '');
  const recipientDepartment = normalizeText(recipient.department || '');

  return (
    resolvedMissionRecipients.find((candidate) => {
      const candidateUserId = String(candidate._id || candidate.user_id || candidate.id || '').trim();
      if (recipientUserId && candidateUserId && candidateUserId === recipientUserId) {
        return true;
      }

      return (
        recipientName &&
        recipientDepartment &&
        normalizeText(candidate.name || '') === recipientName &&
        normalizeText(candidate.department || '') === recipientDepartment
      );
    }) || recipient
  );
}

function createAssistantMissionRecipients(selectedRecipients = [], resolvedMissionRecipients = []) {
  const normalizedSelectedRecipients = selectedRecipients
    .filter((recipient) => recipient?.can_evaluate !== false && recipient?.canEvaluate !== false)
    .map((recipient) => resolveMissionRecipientMetadata(recipient, resolvedMissionRecipients));
  const evaluators = normalizedSelectedRecipients
    .filter((recipient) => recipient)
    .map((recipient) => ({
      user_id: recipient._id || recipient.user_id || recipient.id,
      name: recipient.name,
      grade: recipient.grade,
      department: recipient.department,
      can_evaluate: true,
      receives_copy: false,
    }));

  const informedManagers = [];

  const seen = new Set();
  const mergedRecipients = [];

  [...evaluators, ...informedManagers].forEach((recipient) => {
    const key = `${String(recipient.user_id || '')}::${recipient.department || ''}`;
    if (!recipient.user_id || seen.has(key)) {
      return;
    }

    seen.add(key);
    mergedRecipients.push(recipient);
  });

  return mergedRecipients;
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

function resolveSubmittedRecipientUsers(recipients = [], resolvedRecipients = []) {
  const submittedRecipientKeys = new Set(
    recipients.map((recipient) => `${normalizeText(recipient.manager || recipient.name || '')}::${normalizeText(recipient.department || '')}`)
  );
  const seen = new Set();

  return resolvedRecipients.filter((recipient) => {
    const key = `${normalizeText(recipient.name || '')}::${normalizeText(recipient.department || '')}`;
    const id = String(recipient._id || recipient.id || '');

    if (!submittedRecipientKeys.has(key) || seen.has(id)) {
      return false;
    }

    seen.add(id);
    return true;
  });
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
    start_date: String(mission.startDate || mission.start_date || '').trim(),
    end_date: String(mission.endDate || mission.end_date || '').trim(),
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
            can_evaluate: recipient.can_evaluate !== false,
            receives_copy: recipient.receives_copy === true,
          }))
      : [],
    criteria: Array.isArray(mission.criteria)
      ? mission.criteria.map((criterion) => ({
          criterion_id: String(criterion.id || criterion.criterion_id || '').trim(),
          section_title: String(criterion.sectionTitle || criterion.section_title || '').trim(),
          section_comment: String(criterion.sectionComment || criterion.section_comment || '').trim(),
          page_title: String(criterion.pageTitle || criterion.page_title || '').trim(),
          page_comment: String(criterion.pageComment || criterion.page_comment || '').trim(),
          source_sheet: String(criterion.sourceSheet || criterion.source_sheet || '').trim(),
          source_label: String(criterion.sourceLabel || criterion.source_label || '').trim(),
          theme_code: String(criterion.themeCode || criterion.theme_code || '').trim(),
          label: String(criterion.label || '').trim(),
          statement: String(criterion.statement || '').trim(),
          score: criterion.score ?? null,
          is_custom: Boolean(criterion.isCustom || criterion.is_custom),
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
    startDate: mission.start_date || '',
    endDate: mission.end_date || '',
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
      canEvaluate: recipient.can_evaluate !== false,
      receivesCopy: recipient.receives_copy === true,
    })),
    criteria: (mission.criteria || []).map((criterion) => ({
      id: criterion.criterion_id,
      sectionTitle: criterion.section_title,
      sectionComment: criterion.section_comment || '',
      pageTitle: criterion.page_title,
      pageComment: criterion.page_comment || '',
      sourceSheet: criterion.source_sheet,
      sourceLabel: criterion.source_label,
      themeCode: criterion.theme_code,
      label: criterion.label,
      statement: criterion.statement,
      score: criterion.score,
      isCustom: Boolean(criterion.is_custom),
    })),
    comment: mission.comment || '',
    status: mission.status || 'Brouillon',
    submitted_at: mission.submitted_at || null,
  }));
}

function normalizeAnonymousFeedback(feedbackItems = []) {
  return feedbackItems
    .map((item) => ({
      target_user_id: item.target_user_id || item.targetUserId || item.id || null,
      target_name: String(item.target_name || item.targetName || item.name || '').trim(),
      target_grade: String(item.target_grade || item.targetGrade || item.grade || '').trim(),
      target_department: String(item.target_department || item.targetDepartment || item.department || '').trim(),
      comment: String(item.comment || '').trim(),
      submitted_at: item.submitted_at || item.submittedAt || null,
    }))
    .filter((item) => item.target_name && item.comment);
}

function formatAnonymousFeedback(feedbackItems = []) {
  return normalizeAnonymousFeedback(feedbackItems).map((item) => ({
    targetUserId: item.target_user_id ? String(item.target_user_id) : '',
    targetName: item.target_name,
    targetGrade: item.target_grade,
    targetDepartment: item.target_department,
    comment: item.comment,
    submittedAt: item.submitted_at || null,
  }));
}

function normalizeChiefComments(items = []) {
  return items
    .map((item) => ({
      target_user_id: item.target_user_id || item.targetUserId || null,
      target_name: String(item.target_name || item.targetName || '').trim(),
      target_grade: String(item.target_grade || item.targetGrade || '').trim(),
      target_department: String(item.target_department || item.targetDepartment || '').trim(),
      comment: String(item.comment || '').trim(),
      submitted_at: item.submitted_at || item.submittedAt || null,
    }))
    .filter((item) => item.target_name);
}

function formatChiefComments(items = []) {
  return normalizeChiefComments(items).map((item) => ({
    targetUserId: item.target_user_id ? String(item.target_user_id) : '',
    targetName: item.target_name,
    targetGrade: item.target_grade,
    targetDepartment: item.target_department,
    comment: item.comment,
    submittedAt: item.submitted_at || null,
  }));
}

function validateMissionEvaluations(missionEvaluations = []) {
  for (const mission of missionEvaluations) {
    for (const criterion of mission.criteria || []) {
      if (criterion.score !== null && criterion.score !== undefined) {
        if (!Number.isInteger(criterion.score) || criterion.score < 1 || criterion.score > 5) {
          return `La note du critère "${criterion.label}" doit être comprise entre 1 et 5.`;
        }
      }

      if (criterion.is_custom && !criterion.label) {
        return 'Le libellé de la compétence ajoutée est requis.';
      }
    }
  }

  return '';
}

function validateMissionCommentsForSubmit(missionEvaluations = [], minimumLength = 3) {
  const normalizedMinimumLength = Math.max(Number(minimumLength) || 0, 1);

  return missionEvaluations
    .filter((mission) => String(mission.comment || '').trim().length < normalizedMinimumLength)
    .map((mission) => ({
      missionId: mission.mission_id,
      title: mission.title,
    }));
}

function getMissionSections(mission = {}) {
  const sectionMap = new Map();

  (mission.criteria || []).forEach((criterion) => {
    const sectionTitle = String(criterion.section_title || criterion.sectionTitle || '').trim() || 'Section';

    if (!sectionMap.has(sectionTitle)) {
      sectionMap.set(sectionTitle, {
        title: sectionTitle,
        comment: String(criterion.section_comment || criterion.sectionComment || '').trim(),
      });
    }

    const section = sectionMap.get(sectionTitle);
    const sectionComment = String(criterion.section_comment || criterion.sectionComment || '').trim();
    if (!section.comment && sectionComment) {
      section.comment = sectionComment;
    }
  });

  return Array.from(sectionMap.values());
}

function validateMissionSectionCommentsForSubmit(mission, minimumLength = 3) {
  const normalizedMinimumLength = Math.max(Number(minimumLength) || 0, 1);

  return getMissionSections(mission)
    .filter((section) => String(section.comment || '').trim().length < normalizedMinimumLength)
    .map((section) => ({ sectionTitle: section.title }));
}

function validateMissionLowScorePageComments(mission, minimumLength = 3) {
  const normalizedMinimumLength = Math.max(Number(minimumLength) || 0, 1);
  const missingPageComments = [];
  const sectionMap = new Map();

  (mission.criteria || []).forEach((criterion) => {
    const sectionTitle = String(criterion.section_title || criterion.sectionTitle || '').trim() || 'Section';
    const pageTitle = String(criterion.page_title || criterion.pageTitle || '').trim() || 'Titre';
    const key = `${sectionTitle}::${pageTitle}`;

    if (!sectionMap.has(key)) {
      sectionMap.set(key, {
        sectionTitle,
        pageTitle,
        pageComment: String(criterion.page_comment || criterion.pageComment || '').trim(),
        criteria: [],
      });
    }

    const page = sectionMap.get(key);
    const pageComment = String(criterion.page_comment || criterion.pageComment || '').trim();
    if (!page.pageComment && pageComment) {
      page.pageComment = pageComment;
    }
    page.criteria.push(criterion);
  });

  Array.from(sectionMap.values()).forEach((page) => {
    const hasLowScore = page.criteria.some((criterion) => typeof criterion.score === 'number' && criterion.score < 3);

    if (hasLowScore && String(page.pageComment || '').trim().length < normalizedMinimumLength) {
      missingPageComments.push({
        sectionTitle: page.sectionTitle,
        pageTitle: page.pageTitle,
      });
    }
  });

  return missingPageComments;
}

function getMissionAverageScore(criteria = []) {
  const scores = criteria.map((criterion) => criterion.score).filter((score) => typeof score === 'number');

  if (!scores.length) {
    return null;
  }

  return Number((scores.reduce((total, score) => total + score, 0) / scores.length).toFixed(1));
}

function getMissionProgress(mission = {}) {
  const criteria = mission.criteria || [];
  const answered = criteria.filter((criterion) => criterion.score !== null && criterion.score !== undefined).length;

  if (!criteria.length) {
    return 0;
  }

  return Math.round((answered / criteria.length) * 100);
}

function getMissionEvaluationSummary(missionEvaluations = []) {
  const completedMissions = missionEvaluations.filter((mission) => getMissionProgress(mission) === 100).length;
  const globalProgress = missionEvaluations.length
    ? Math.round(missionEvaluations.reduce((total, mission) => total + getMissionProgress(mission), 0) / missionEvaluations.length)
    : 0;

  return {
    completedMissions,
    totalMissions: missionEvaluations.length,
    globalProgress,
    finalScore: getAverageFromMissionEvaluations(missionEvaluations),
  };
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

function formatSubmissionTarget(managers = []) {
  if (!managers.length) {
    return 'Manager du département';
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

function buildManagerCommentText(review) {
  const sections = normalizeSections(review?.sections || []);
  const sectionComments = sections
    .map((section) => String(section.comment || '').trim())
    .filter(Boolean);
  const missionComments = (review?.mission_reviews || [])
    .map((mission) => String(mission.comment || '').trim())
    .filter(Boolean);
  const combined = [...sectionComments, ...missionComments];

  if (!combined.length) {
    return '';
  }

  return combined.join(' ');
}

async function fetchManagerCommentsForMember(cycleLabel, memberId) {
  const managerReviews = await ManagerMemberReview.find({
    cycle_label: cycleLabel,
    member_id: memberId,
    status: { $in: ['Valide RH', `Transmis à l'associé`, 'Clôture'] },
  }).select('manager_id submitted_at sections mission_reviews status');

  const managerIds = managerReviews.map((review) => review.manager_id).filter(Boolean);
  const managerUsers = managerIds.length
    ? await User.find({ _id: { $in: managerIds } }).select('_id name grade')
    : [];
  const managerById = new Map(managerUsers.map((manager) => [String(manager._id), manager]));

  return managerReviews
    .map((review) => {
      const comment = buildManagerCommentText(review);
      if (!comment) {
        return null;
      }

      const manager = managerById.get(String(review.manager_id));
      return {
        managerId: String(review.manager_id || ''),
        comment,
        authorName: manager?.name || 'Manager',
        authorGrade: manager?.grade || 'Manager',
        submittedAt: review.submitted_at || null,
      };
    })
    .filter(Boolean)
    .sort((left, right) => {
      const leftDate = left.submittedAt ? new Date(left.submittedAt).getTime() : 0;
      const rightDate = right.submittedAt ? new Date(right.submittedAt).getTime() : 0;
      return rightDate - leftDate;
    });
}

async function buildEvaluationPayload(instance, user) {
  const sections = normalizeSections(instance.sections);
  const missionEvaluations = formatMissionEvaluations(instance.mission_evaluations || []);
  const activeSection = sections.find((section) => section.status !== 'Complete') || sections[0] || null;
  const [managers, commentTargets] = await Promise.all([
    resolveRecipientsForInstance(instance, user),
    resolveCommentTargetsForUser(user),
  ]);
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
    summary:
      instance?.template_type === 'assistant-self-evaluation'
        ? getMissionEvaluationSummary(instance.mission_evaluations || [])
        : {
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
      current_cycle: getCurrentCycleLabel(),
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
      comment_targets: commentTargets,
    },
    mission_evaluations: missionEvaluations,
    chief_comments: formatChiefComments(instance.chief_comments || []),
    development: {
      wishes: instance.development_wishes || '',
      trainingRequests: instance.development_training_requests || [],
      status: instance.development_status || 'Brouillon',
      submittedAt: instance.development_submitted_at || null,
      submittedToUserId: instance.development_submitted_to_user_id ? String(instance.development_submitted_to_user_id) : null,
      submittedToName: instance.development_submitted_to_name || '',
      trainingDecision: instance.development_training_decision || 'En attente',
      trainingManagerComment: instance.development_training_manager_comment || '',
      trainingDecidedAt: instance.development_training_decided_at || null,
    },
  };
}

async function persistEvaluationInstance(instance, updates = {}) {
  if (!instance?._id) {
    return instance;
  }

  await EvaluationInstance.updateOne(
    { _id: instance._id },
    {
      $set: updates,
    }
  );

  Object.assign(instance, updates);
  return instance;
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
    cycle_label: getCurrentCycleLabel(),
    template_type: templateType,
  });

  const templateSections = cloneTemplate(user);

  if (!instance) {
    instance = await EvaluationInstance.create({
      cycle_label: getCurrentCycleLabel(),
      evalue_id: user._id,
      status: 'En cours',
      template_type: templateType,
      sections: toPersistenceSections(templateSections),
      last_saved_at: new Date(),
    });
  } else if (shouldResetToCurrentTemplate(instance, templateSections)) {
    await persistEvaluationInstance(instance, {
      sections: toPersistenceSections(templateSections),
      last_saved_at: new Date(),
    });
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
  const rawChiefComments = Array.isArray(request.body?.chiefComments) ? request.body.chiefComments : null;
  const instance = await getOrCreateEvaluation(request.user);
  const isAssistantEvaluation = instance.template_type === 'assistant-self-evaluation';
  const isSeniorEvaluation = instance.template_type === 'senior-self-evaluation';
  const isMissionOnlySelfEvaluation = isAssistantEvaluation || isSeniorEvaluation;
  const sections = rawSections?.length ? normalizeSections(rawSections) : normalizeSections(instance.sections);

  if (!isMissionOnlySelfEvaluation && !rawSections?.length) {
    return response.status(400).json({
      message: "Les sections de l'auto-évaluation sont requises.",
    });
  }

  if (rawSections?.length) {
    for (const section of sections) {
      for (const criterion of section.criteria) {
        if (criterion.score !== null && criterion.score !== undefined) {
          if (!Number.isInteger(criterion.score) || criterion.score < 1 || criterion.score > 5) {
            return response.status(400).json({
              message: `La note du critere "${criterion.label}" doit être comprise entre 1 et 5.`,
            });
          }
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

  const summary = isMissionOnlySelfEvaluation ? getMissionEvaluationSummary(missionEvaluations || instance.mission_evaluations || []) : getEvaluationSummary(sections);
  const resolvedManagers = await resolveRecipientsForInstance(instance, request.user);
  const resolvedEvaluationRecipients = isAssistantEvaluation
    ? await resolveMissionRecipientsForAssistant(request.user)
    : resolvedManagers;
  const resolvedMissionRecipients =
    isAssistantEvaluation
      ? await resolveMissionRecipientsForAssistant(request.user)
      : resolvedManagers;

  if (missionEvaluations && isMissionOnlySelfEvaluation) {
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
                can_evaluate: true,
                receives_copy: false,
              },
            ]
          : createAssistantMissionRecipients(
              (mission.recipients || []).filter((recipient) =>
                availableRecipients.some(
                  (candidate) =>
                    String(candidate.user_id) === String(recipient.user_id) ||
                    (candidate.name === recipient.name && candidate.department === recipient.department)
                )
              ),
              resolvedMissionRecipients
            ),
      primary_recipient_user_id:
        mission.created_by_role === 'senior'
          ? mission.assigned_by_user_id || null
          : mission.primary_recipient_user_id ||
            createAssistantMissionRecipients(
              mission.recipients || [],
              resolvedMissionRecipients
            ).find((recipient) => recipient.can_evaluate !== false)?.user_id ||
            null,
      primary_recipient_name:
        mission.created_by_role === 'senior'
          ? mission.assigned_by_name || 'Senior'
          : mission.primary_recipient_name ||
            createAssistantMissionRecipients(
              mission.recipients || [],
              resolvedMissionRecipients
            ).find((recipient) => recipient.can_evaluate !== false)?.name ||
            '',
      primary_recipient_grade:
        mission.created_by_role === 'senior'
          ? mission.assigned_by_grade || 'Senior'
          : mission.primary_recipient_grade ||
            createAssistantMissionRecipients(
              mission.recipients || [],
              resolvedMissionRecipients
            ).find((recipient) => recipient.can_evaluate !== false)?.grade ||
            '',
      primary_recipient_department:
        mission.created_by_role === 'senior'
          ? mission.department || request.user.department || ''
          : mission.primary_recipient_department ||
            createAssistantMissionRecipients(
              mission.recipients || [],
              resolvedMissionRecipients
            ).find((recipient) => recipient.can_evaluate !== false)?.department ||
            '',
    }));
  }

  const SUBMITTED_STATUSES = [
    'Soumis aux Managers', 'Soumis au Manager', 'Soumis a RH',
    'Valide RH', 'Transmis a l associe', 'En correction', 'Cloture',
  ];
  const preserveStatus = SUBMITTED_STATUSES.includes(instance.status);
  const newStatus = preserveStatus ? instance.status : (summary.globalProgress === 0 ? 'Brouillon' : 'En cours');

  await persistEvaluationInstance(instance, {
    ...(rawSections?.length || !isMissionOnlySelfEvaluation ? { sections: toPersistenceSections(sections) } : {}),
    ...(missionEvaluations ? { mission_evaluations: missionEvaluations } : {}),
    ...(rawChiefComments ? { chief_comments: normalizeChiefComments(rawChiefComments) } : {}),
    status: newStatus,
    last_saved_at: new Date(),
  });

  return response.json({
    message: 'Auto-évaluation enregistree.',
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
      message: 'Toutes les questions de la mission doivent être renseignées avant soumission.',
    });
  }

  const missingSectionComments = validateMissionSectionCommentsForSubmit(mission, 3);

  if (missingSectionComments.length) {
    return response.status(400).json({
      message: `Un commentaire de section d'au moins 3 caractères est obligatoire pour chaque section avant soumission.`,
      missingSectionComments,
    });
  }

  mission.status = 'Soumise';
  mission.submitted_at = new Date();
  await persistEvaluationInstance(instance, {
    mission_evaluations: missionEvaluations,
    last_saved_at: new Date(),
  });

  notifySubmissionRecipients({
    recipientIds: mission.recipients.map((recipient) => recipient.user_id),
    excludeUserId: request.user._id,
    submitterName: request.user.name,
    label: `la mission "${mission.title}"`,
    cycleLabel: getCurrentCycleLabel(),
  });

  return response.json({
    message: `Mission soumise à ${mission.recipients.map((recipient) => recipient.name).join(', ')}.`,
    ...(await buildEvaluationPayload(instance, request.user)),
  });
}

async function submitMySeniorEvaluation(request, response) {
  return submitMySelfEvaluation(request, response, getOrCreateSeniorEvaluation, false);
}

async function submitMySelfEvaluation(request, response, getOrCreateEvaluation, allowExplicitRecipients) {
  const instance = await getOrCreateEvaluation(request.user);
  const sections = normalizeSections(instance.sections);
  const missionEvaluations = normalizeMissionEvaluations(instance.mission_evaluations || []);
  const isAssistantEvaluation = instance.template_type === 'assistant-self-evaluation';
  const isSeniorEvaluation = instance.template_type === 'senior-self-evaluation';
  const isMissionOnlySelfEvaluation = isAssistantEvaluation || isSeniorEvaluation;
  const managerRecipients =
    allowExplicitRecipients && Array.isArray(request.body?.managerRecipients)
      ? request.body.managerRecipients
          .filter((recipient) => recipient?.manager && recipient?.department)
          .map((recipient) => ({
            manager: String(recipient.manager).trim(),
            department: String(recipient.department).trim(),
          }))
      : [];
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

  if (isMissionOnlySelfEvaluation) {
    if (!missionEvaluations.length) {
      return response.status(400).json({
        message: 'Ajoutez au moins une mission avant la soumission finale.',
      });
    }

    const pendingMissions = missionEvaluations.filter((mission) => mission.status !== 'Soumise');

    if (pendingMissions.length) {
      return response.status(400).json({
        message: 'Chaque mission doit être soumise avant la soumission finale.',
        pendingMissions: pendingMissions.map((mission) => ({
          missionId: mission.mission_id,
          title: mission.title,
        })),
      });
    }

    const missionsWithMissingSectionComments = missionEvaluations
      .map((mission) => ({
        missionId: mission.mission_id,
        title: mission.title,
        missingSectionComments: validateMissionSectionCommentsForSubmit(mission, 3),
      }))
      .filter((mission) => mission.missingSectionComments.length);

    if (missionsWithMissingSectionComments.length) {
      return response.status(400).json({
        message: `Un commentaire de section d'au moins 3 caractères est obligatoire pour chaque section avant soumission finale.`,
        missionsWithMissingSectionComments,
      });
    }

    const missionRecipients = missionEvaluations.flatMap((mission) =>
      (mission.recipients || [])
        .filter((recipient) => recipient.can_evaluate !== false)
        .map((recipient) => ({
          department: recipient.department || mission.department || '',
          manager: recipient.name,
        }))
    );
    const mergedMissionRecipients = mergeManagerRecipients(managerRecipients.length ? managerRecipients : missionRecipients, []);
    const submittedRecipientUsers = resolveSubmittedRecipientUsers(mergedMissionRecipients, resolvedEvaluationRecipients);

    await persistEvaluationInstance(instance, {
      status: 'Soumis aux Managers',
      submitted_to_role: 'manager',
      submitted_to_managers: mergedMissionRecipients,
      submitted_to_user_ids: submittedRecipientUsers.map((recipient) => recipient._id),
      submitted_to_names: mergedMissionRecipients.map((recipient) => recipient.manager),
      submitted_at: new Date(),
      last_saved_at: new Date(),
    });

    notifySubmissionRecipients({
      recipientIds: submittedRecipientUsers.map((recipient) => recipient._id),
      excludeUserId: request.user._id,
      submitterName: request.user.name,
      label: 'son auto-évaluation',
      cycleLabel: getCurrentCycleLabel(),
    });

    return response.json({
      message: mergedMissionRecipients.length
        ? `Évaluations par mission soumises aux destinataires concernés (${mergedMissionRecipients.map((recipient) => recipient.manager).join(', ')}).`
        : 'Évaluations par mission soumises.',
      ...(await buildEvaluationPayload(instance, request.user)),
    });
  }

  const missingAnswers = validateSectionsForSubmit(sections);

  if (missingAnswers.length) {
    return response.status(400).json({
      message: 'Toutes les questions obligatoires doivent être renseignées avant soumission.',
      missingAnswers,
    });
  }

  const missingSectionComments = validateSectionCommentsForSubmit(sections, 3);

  if (missingSectionComments.length) {
    return response.status(400).json({
      message: `Un commentaire de section d'au moins 3 caractères est obligatoire pour chaque section avant soumission.`,
      missingSectionComments,
    });
  }

  await persistEvaluationInstance(instance, {
    sections: toPersistenceSections(sections),
    status: 'Soumis aux Managers',
    submitted_to_role: 'manager',
    submitted_to_managers: mergedManagerRecipients,
    submitted_to_user_ids: resolvedManagers.map((manager) => manager._id),
    submitted_to_names: mergedManagerRecipients.length
      ? mergedManagerRecipients.map((recipient) => recipient.manager)
      : resolvedManagers.map((manager) => manager.name),
    submitted_at: new Date(),
    last_saved_at: new Date(),
  });

  return response.json({
    message: mergedManagerRecipients.length
      ? `Auto-évaluation soumise aux managers concernés (${mergedManagerRecipients.map((recipient) => recipient.manager).join(', ')}).`
      : `Auto-évaluation soumise à ${formatSubmissionTarget(resolvedManagers)}.`,
    ...(await buildEvaluationPayload(instance, request.user)),
  });
}

async function getMySeniorEvaluation(request, response) {
  const instance = await getOrCreateSeniorEvaluation(request.user);
  return response.json(await buildEvaluationPayload(instance, request.user));
}

async function buildResultsPayloadForInstance(instance, request, { includeDepartmentComparison = false } = {}) {
  const missionEvaluations = normalizeMissionEvaluations(instance.mission_evaluations || []);
  const scoreFinal = getAverageFromMissionEvaluations(missionEvaluations);
  const managerReviews = await ManagerMemberReview.find({
    cycle_label: instance.cycle_label,
    member_id: request.user._id,
    status: { $in: ['Valide RH', `Transmis à l'associé`, 'Clôture'] },
  }).select('manager_id submitted_at sections mission_reviews status');
  const managerIds = managerReviews.map((review) => review.manager_id).filter(Boolean);
  const managerUsers = managerIds.length
    ? await User.find({ _id: { $in: managerIds } }).select('_id name grade')
    : [];
  const managerById = new Map(managerUsers.map((manager) => [String(manager._id), manager]));
  const managerComments = managerReviews
    .map((review) => {
      const comment = buildManagerCommentText(review);
      if (!comment) {
        return null;
      }

      const manager = managerById.get(String(review.manager_id));
      return {
        managerId: String(review.manager_id || ''),
        comment,
        authorName: manager?.name || 'Manager',
        authorGrade: manager?.grade || 'Manager',
        submittedAt: review.submitted_at || null,
      };
    })
    .filter(Boolean)
    .sort((left, right) => {
      const leftDate = left.submittedAt ? new Date(left.submittedAt).getTime() : 0;
      const rightDate = right.submittedAt ? new Date(right.submittedAt).getTime() : 0;
      return rightDate - leftDate;
    });

  const payload = {
    cycle_label: instance.cycle_label,
    status: instance.status,
    missionScores: missionEvaluations.map((mission) => {
      const score = getMissionAverageScore(mission.criteria || []);

      return {
        missionId: mission.mission_id,
        title: mission.title,
        period: mission.period,
        startDate: mission.start_date || '',
        endDate: mission.end_date || '',
        department: mission.department,
        recipients: (mission.recipients || []).map((recipient) => recipient.name),
        score,
        percent: Math.round(((score || 0) / 5) * 100),
      };
    }),
    kpis: {
      scoreFinal: scoreFinal || 0,
      scoreFinalPercent: Math.round(((scoreFinal || 0) / 5) * 100),
    },
    managerComments,
  };

  if (includeDepartmentComparison) {
    const departmentScope = getManagerDepartmentsForDepartment(request.user.department);
    const assistantUsers = await User.find({
      grade: 'Assistant',
      is_active: true,
      ...(departmentScope.length ? { department: { $in: departmentScope } } : { department: request.user.department }),
    }).select('_id');

    const otherIds = assistantUsers.map((user) => user._id);
    const otherInstances = otherIds.length
      ? await EvaluationInstance.find({
          evalue_id: { $in: otherIds },
          cycle_label: instance.cycle_label,
          template_type: 'assistant-self-evaluation',
        })
      : [];

    const departmentScores = otherInstances
      .map((otherInstance) => getAverageFromMissionEvaluations(normalizeMissionEvaluations(otherInstance.mission_evaluations || [])))
      .filter((score) => typeof score === 'number');
    const evaluatedDepartmentAssistantsCount = departmentScores.length;

    const departmentAverage = departmentScores.length
      ? Number((departmentScores.reduce((total, score) => total + score, 0) / departmentScores.length).toFixed(1))
      : scoreFinal;

    const departmentDelta =
      typeof scoreFinal === 'number' && typeof departmentAverage === 'number'
        ? Number((scoreFinal - departmentAverage).toFixed(1))
        : 0;

    const departmentAverageSubtitle = evaluatedDepartmentAssistantsCount
      ? `${evaluatedDepartmentAssistantsCount} assistant(s) évalué(s) - ${request.user.department || 'Département non renseigné'}`
      : `Aucune moyenne disponible - ${request.user.department || 'Département non renseigné'}`;

    Object.assign(payload.kpis, {
      comparaisonEquipe: departmentDelta,
      comparaisonEquipeLabel: `${(departmentAverage || 0).toFixed(1)}/5`,
      comparaisonEquipeSubtitle: departmentAverageSubtitle,
      moyenneEquipe: departmentAverage || 0,
      moyenneDepartement: departmentAverage || 0,
      moyenneDepartementLabel: `${(departmentAverage || 0).toFixed(1)}/5`,
      moyenneDepartementSubtitle: departmentAverageSubtitle,
      assistantsEvalues: evaluatedDepartmentAssistantsCount,
      assistantsDepartementEvalues: evaluatedDepartmentAssistantsCount,
    });
  }

  return payload;
}

async function getMyAssistantResults(request, response) {
  const instance = await getOrCreateAssistantEvaluation(request.user);
  return response.json(await buildResultsPayloadForInstance(instance, request, { includeDepartmentComparison: true }));
}

async function getMyAssistantEvaluationHistory(request, response) {
  const instances = await EvaluationInstance.find({
    evalue_id: request.user._id,
    template_type: 'assistant-self-evaluation',
    cycle_label: { $ne: getCurrentCycleLabel() },
  }).sort({ cycle_label: -1 });

  const cycles = await Promise.all(
    instances.map(async (instance) => {
      const comments = await fetchManagerCommentsForMember(instance.cycle_label, request.user._id);
      return buildMissionResultsPayload(instance, comments);
    })
  );

  return response.json({ cycles });
}

async function getMySeniorEvaluationHistory(request, response) {
  const instances = await EvaluationInstance.find({
    evalue_id: request.user._id,
    template_type: 'senior-self-evaluation',
    cycle_label: { $ne: getCurrentCycleLabel() },
  }).sort({ cycle_label: -1 });

  const cycles = await Promise.all(
    instances.map(async (instance) => {
      const comments = await fetchManagerCommentsForMember(instance.cycle_label, request.user._id);
      return buildMissionResultsPayload(instance, comments);
    })
  );

  return response.json({ cycles });
}

async function saveMyDevelopment(request, response) {
  const wishes = String(request.body?.wishes || '').trim();
  const rawRequests = request.body?.trainingRequests;
  const trainingRequests = Array.isArray(rawRequests)
    ? rawRequests.map((item) => String(item || '').trim()).filter(Boolean)
    : [];
  const managerId = String(request.body?.managerId || '').trim();

  const instance = await getOrCreateAssistantEvaluation(request.user);

  let updates;
  if (instance.development_status === 'Soumis au Manager') {
    // After submission: only training list and manager can be updated
    updates = { development_training_requests: trainingRequests };
    if (managerId) {
      const manager = await User.findOne({ _id: managerId, is_active: true, code_categorie: { $in: ['10B', '10C'] } })
        .select('_id name');
      if (manager) {
        updates.development_submitted_to_user_id = manager._id;
        updates.development_submitted_to_name = manager.name;
      }
    }
  } else {
    updates = { development_wishes: wishes, development_training_requests: trainingRequests };
  }

  await persistEvaluationInstance(instance, updates);

  return response.json({
    message: 'Plan de développement enregistré.',
    development: {
      wishes: instance.development_wishes,
      trainingRequests: instance.development_training_requests,
      status: instance.development_status,
      submittedAt: instance.development_submitted_at,
      submittedToUserId: instance.development_submitted_to_user_id ? String(instance.development_submitted_to_user_id) : null,
      submittedToName: instance.development_submitted_to_name || '',
    },
  });
}

async function submitMyDevelopment(request, response) {
  const managerId = String(request.body?.managerId || '').trim();

  if (!managerId) {
    return response.status(400).json({ message: 'Veuillez sélectionner un Manager avant d\'envoyer.' });
  }

  const manager = await User.findOne({ _id: managerId, is_active: true, code_categorie: { $in: ['10B', '10C'] } })
    .select('_id name grade department');

  if (!manager) {
    return response.status(400).json({ message: 'Manager introuvable ou non autorisé.' });
  }

  const instance = await getOrCreateAssistantEvaluation(request.user);

  if (instance.development_status === 'Soumis au Manager') {
    return response.status(400).json({ message: 'Le plan de développement a déjà été envoyé au Manager.' });
  }

  const hasContent =
    String(instance.development_wishes || '').trim().length > 0 ||
    (instance.development_training_requests || []).length > 0;

  if (!hasContent) {
    return response.status(400).json({
      message: "Veuillez renseigner vos souhaits d'évolution ou ajouter au moins une formation avant d'envoyer.",
    });
  }

  const now = new Date();
  await persistEvaluationInstance(instance, {
    development_status: 'Soumis au Manager',
    development_submitted_at: now,
    development_submitted_to_user_id: manager._id,
    development_submitted_to_name: manager.name,
  });

  notifySubmissionRecipients({
    recipientIds: [manager._id],
    excludeUserId: request.user._id,
    submitterName: request.user.name,
    label: 'son plan de développement',
    cycleLabel: getCurrentCycleLabel(),
  });

  return response.json({
    message: `Plan de développement envoyé à ${manager.name}.`,
    development: {
      wishes: instance.development_wishes,
      trainingRequests: instance.development_training_requests,
      status: 'Soumis au Manager',
      submittedAt: now,
      submittedToUserId: String(manager._id),
      submittedToName: manager.name,
    },
  });
}

module.exports = {
  buildManagerCommentText,
  fetchManagerCommentsForMember,
  getMyAssistantEvaluation,
  getMyAssistantEvaluationHistory,
  getMyAssistantResults,
  getMySeniorEvaluation,
  getMySeniorEvaluationHistory,
  saveMyAssistantEvaluation,
  saveMySeniorEvaluation,
  submitMyAssistantMissionEvaluation,
  submitMyAssistantEvaluation,
  submitMySeniorMissionEvaluation,
  submitMySeniorEvaluation,
  saveMyDevelopment,
  submitMyDevelopment,
};
