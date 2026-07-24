const User = require('../models/User');
const EvaluationInstance = require('../models/EvaluationInstance');
const ManagerMemberReview = require('../models/ManagerMemberReview');
const SeniorAssistantReview = require('../models/SeniorAssistantReview');
const AssociateManagerReview = require('../models/AssociateManagerReview');
const Cycle = require('../models/Cycle');
const matrixData = require('../data/competencyMatrix.generated.json');
const { buildEvaluationTemplateForUser } = require('../utils/competencyMatrix');
const {
  ALLOWED_GRADES,
  SUPPORT_EMAILS,
  getCategoryFromGrade,
  getSupportRoleLabel,
  normalizeDepartment: normalizeUserDepartment,
  normalizeEmail,
  normalizeText: normalizeUserText,
} = require('../utils/userMapping');
const {
  getQuestionnaireSourceSheets,
  readQuestionnaireConfig,
  writeQuestionnaireConfig,
} = require('../utils/questionnaireConfig');
const {
  getAverageFromScores,
  getAverageScore,
  getEvaluationSummary,
  getOverallAverageScore,
  getPageJustifications,
  normalizeSections,
  validateFinalCommentForSubmit,
  validateSectionCommentsForSubmit,
  validateSectionsForSubmit,
} = require('../utils/evaluationHelpers');
const {
  buildCyclesForInstances,
  buildPeerReviewComments,
  resolveTemplateTypeForUser,
} = require('../utils/evaluationHistory');
const { activateCycle, getCurrentCycleLabel } = require('../utils/activeCycle');
const { fetchManagerCommentsForMember } = require('./collaboratorEvaluationController');
const { fetchAssociateCommentsForManager } = require('./managerController');
const { notifySubmissionRecipients } = require('../utils/submissionNotifications');

const RH_RELEVANT_STATUSES = ['Soumis à la RH', 'Validé RH', "Transmis à l'associé", 'Clôture'];
const QUESTIONNAIRE_SECTION_OPTIONS = [
  { value: 'SAVOIR FAIRE', label: 'SAVOIR FAIRE' },
  { value: 'SAVOIR ETRE', label: 'SAVOIR ETRE' },
];
const QUESTIONNAIRE_AUDIENCE_OPTIONS = [
  'Tous collaborateurs',
  'Assistants',
  'Seniors',
  'Managers',
  'Managers et Seniors',
  'RH / Capital Humain',
];
const RH_DEPARTMENT_REGEX = /^RH$/i;
const CAPITAL_HUMAIN_DEPARTMENT_REGEX = /^CAPITAL HUMAIN$/i;

function normalizeText(value = '') {
  return String(value || '').replace(/\s+/g, ' ').trim().toUpperCase();
}

function normalizeStatusText(value = '') {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

function isManagerMissionSubmittedStatus(status = '') {
  const normalized = normalizeStatusText(status);
  return (
    normalized.includes('SOUMISE') ||
    normalized.includes('SOUMIS') ||
    normalized.includes('TRANSMIS')
  );
}

function buildRhDepartmentClause() {
  return {
    $or: [{ department: RH_DEPARTMENT_REGEX }, { department: CAPITAL_HUMAIN_DEPARTMENT_REGEX }],
  };
}

function buildNonRhDepartmentClause() {
  return {
    $nor: [{ department: RH_DEPARTMENT_REGEX }, { department: CAPITAL_HUMAIN_DEPARTMENT_REGEX }],
  };
}

function formatDepartmentLabel(department = '') {
  const normalized = normalizeText(department);

  if (normalized === 'AUDIT') return 'Audit';
  if (normalized === 'EXPERTISE COMPTABLE') return 'Expertise comptable';
  if (normalized === 'AUDIT & EXPERTISE COMPTABLE') return 'Audit & Expertise comptable';
  if (normalized === 'CONSEIL FINANCIER') return 'Conseil financier';
  if (normalized === 'CONSEIL OPERATIONNEL') return 'Conseil operationnel';
  if (normalized === 'CAPITAL HUMAIN' || normalized === 'RH') return 'RH';

  return String(department || '').trim() || 'Non renseigne';
}

function normalizeQuestionnaireText(value = '') {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function createQuestionnaireTheme(questionText, index) {
  const label = normalizeQuestionnaireText(questionText);
  const code = String.fromCharCode(65 + index);

  return {
    code,
    label,
    statements: {
      Assistant: label,
      Senior: label,
      Manager: label,
      'Associ?': label,
    },
  };
}

function createQuestionnaireEntryId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function buildQuestionnaireView() {
  const config = readQuestionnaireConfig();
  const customPageBySignature = new Map(
    (config.customPages || []).map((page) => [
      `${page.source_sheet}::${page.section_key}::${normalizeText(page.title)}`,
      page,
    ])
  );
  const pageAdditionBySignature = new Map(
    (config.pageAdditions || []).map((page) => [
      `${page.source_sheet}::${page.section_key}::${normalizeText(page.page_title)}`,
      page,
    ])
  );

  const baseSections = Object.entries(matrixData).flatMap(([sheetName, sections]) =>
    (sections || []).flatMap((section) =>
      (section.pages || []).map((page) => {
        const signature = `${sheetName}::${section.key}::${normalizeText(page.title)}`;
        const addition = pageAdditionBySignature.get(signature);
        const addedThemes = addition?.themes || [];

        return {
          id: `base::${signature}`,
          sourceSheet: sheetName,
          sourceLabel: formatDepartmentLabel(sheetName),
          sectionKey: section.key,
          sectionTitle: section.title || section.key,
          title: page.title,
          audience: 'Selon matrice',
          isCustom: false,
          questionCount: (page.themes?.length || 0) + addedThemes.length,
          questions: [
            ...(page.themes || []).map((theme) => theme.label),
            ...addedThemes.map((theme) => theme.label),
          ],
        };
      })
    )
  );

  const customSections = (config.customPages || []).map((page) => ({
    id: page.id,
    sourceSheet: page.source_sheet,
    sourceLabel: formatDepartmentLabel(page.source_sheet),
    sectionKey: page.section_key,
    sectionTitle: page.section_title || page.section_key,
    title: page.title,
    audience: page.audience || 'Selon matrice',
    isCustom: true,
    questionCount: (page.themes || []).length,
    questions: (page.themes || []).map((theme) => theme.label),
  }));

  return {
    options: {
      sourceSheets: getQuestionnaireSourceSheets(),
      sectionKeys: QUESTIONNAIRE_SECTION_OPTIONS,
      audiences: QUESTIONNAIRE_AUDIENCE_OPTIONS.map((value) => ({ value, label: value })),
    },
    sections: [...baseSections, ...customSections].sort((left, right) => {
      const sourceSort = left.sourceSheet.localeCompare(right.sourceSheet, 'fr', { sensitivity: 'base' });
      if (sourceSort !== 0) return sourceSort;
      const sectionSort = left.sectionTitle.localeCompare(right.sectionTitle, 'fr', { sensitivity: 'base' });
      if (sectionSort !== 0) return sectionSort;
      return left.title.localeCompare(right.title, 'fr', { sensitivity: 'base' });
    }),
  };
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
        statement: theme.statement || '',
        score: theme.score === null || theme.score === undefined ? null : Number(theme.score),
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
      score: criterion.score === null || criterion.score === undefined ? null : Number(criterion.score),
      required: criterion.required !== false,
    })),
  }));
}

function shouldResetToCurrentTemplate(instance, templateSections) {
  const currentSections = normalizeSections(instance.sections || []);

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

  return instance.status === 'En cours' || instance.status === 'Brouillon';
}

function cloneRhSelfTemplate(user) {
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

async function resolveAssociateRecipients() {
  return User.find({
    is_active: true,
    $or: [{ code_categorie: '11' }, { grade: 'Associé' }, { grade: 'Associe' }],
  })
    .sort({ last_name: 1, first_name: 1 })
    .select('_id name first_name last_name grade department code_categorie');
}

async function resolveFullRhRecipients() {
  return User.find({
    is_active: true,
    $or: [
      buildRhDepartmentClause(),
      { first_name: /ISABELLA/i, last_name: /BEDA/i },
    ],
  })
    .sort({ last_name: 1, first_name: 1 })
    .select('_id name first_name last_name grade department code_categorie');
}

async function resolveRhQueueUserIds() {
  const recipients = await resolveFullRhRecipients();
  return recipients.map((recipient) => recipient._id);
}

async function getOrCreateRhSelfEvaluation(user, options = {}) {
  const templateType = options.templateType || 'rh-self-evaluation';
  const submittedToRole = options.submittedToRole || 'associate';
  let instance = await EvaluationInstance.findOne({
    evalue_id: user._id,
    cycle_label: getCurrentCycleLabel(),
    template_type: templateType,
  });

  const templateSections = cloneRhSelfTemplate(user);

  if (!instance) {
    instance = await EvaluationInstance.create({
      cycle_label: getCurrentCycleLabel(),
      evalue_id: user._id,
      status: 'En cours',
      template_type: templateType,
      submitted_to_role: submittedToRole,
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

function buildRhSelfEvaluationPayload(instance, user, recipients = [], workflow = {}) {
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
    rh: {
      id: user._id.toString(),
      name: user.name,
      first_name: user.first_name,
      last_name: user.last_name,
      grade: user.grade,
      department: user.department,
    },
    submitted_to: recipients.map((recipient) => ({
      id: recipient._id.toString(),
      name: recipient.name,
      department: recipient.department,
      grade: recipient.grade,
    })),
    workflow: {
      recipientRoleLabel: workflow.recipientRoleLabel || 'Associé',
      submitButtonLabel: workflow.submitButtonLabel || 'Soumettre aux associés',
      introMessage:
        workflow.introMessage ||
        "La RH s'auto-évalue sur la conduite du cycle, puis transmet son auto-évaluation aux associés.",
      titleLabel: workflow.titleLabel || 'Auto-évaluation RH',
      saveMessage: workflow.saveMessage || 'Auto-évaluation RH enregistrée.',
      readyMessage: workflow.readyMessage || 'Auto-évaluation RH prête pour soumission.',
      submittedMessage: workflow.submittedMessage || 'Auto-évaluation RH soumise aux associés.',
      missingAnswersMessage:
        workflow.missingAnswersMessage || 'Toutes les questions RH doivent être renseignées avant soumission aux associés.',
    },
  };
}

function getExpectedTemplateType(member) {
  return member?.code_categorie === '8C' ? 'assistant-self-evaluation' : 'senior-self-evaluation';
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

function getPriorityStatus(finalScore, unjustifiedLowScores) {
  if (unjustifiedLowScores > 0) {
    return 'Ecart a arbitrer';
  }

  if (typeof finalScore === 'number' && finalScore < 3) {
    return 'À compléter';
  }

  return 'À valider RH';
}

function getRhDisplayStatus(review, unjustifiedLowScores, finalScore) {
  if (review.status === 'Clôture' || review.status === 'Validé RH' || review.status === "Transmis à l'associé") return 'Validé';
  if (review.status === 'Soumis à la RH') return 'À valider RH';
  if (review.rh_validation_selected) return 'À valider RH';
  return getPriorityStatus(finalScore, unjustifiedLowScores);
}

function getAssistantRhDisplayStatus(instance) {
  if (instance.status === 'Clôture' || instance.status === 'Validé RH' || instance.status === "Transmis à l'associé") return 'Valide';
  if (instance.rh_validation_selected) return 'À valider RH';
  if (instance.status === 'Soumis à la RH') return 'À valider RH';
  return 'En attente';
}

function isRhValidationQueueItem(row = {}) {
  const status = normalizeStatusText(row.status || '');
  const displayStatus = normalizeStatusText(row.displayStatus || '');

  if (status.includes('VALIDE') || status.includes('CLôTURE') || status.includes('TRANSMIS')) {
    return false;
  }

  return (
    row.rhValidationSelected ||
    status.includes('SOUMIS') ||
    displayStatus.includes('VALIDER RH') ||
    displayStatus.includes('ARBITRER') ||
    displayStatus.includes('COMPLETER')
  );
}

function getRhRowMemberKey(row = {}) {
  return String(row.memberId || row.rawId || row.id || '').trim();
}

function getRhRowPriority(row = {}) {
  const sourceType = String(row.sourceType || '');
  const status = normalizeStatusText(row.status || '');
  const displayStatus = normalizeStatusText(row.displayStatus || '');
  let priority = 0;

  if (sourceType.includes('self-evaluation')) priority += 100;
  if (row.rhValidationSelected) priority += 20;
  if (status.includes('SOUMIS') || displayStatus.includes('VALIDER RH')) priority += 10;
  if (typeof row.rhValidationFinalScore === 'number') priority += 5;
  if ((row.missionScoreDetails || []).length) priority += 2;

  return priority;
}

function dedupeRhRowsByMember(rows = []) {
  const byMember = new Map();

  rows.forEach((row) => {
    const key = getRhRowMemberKey(row);
    if (!key) {
      return;
    }

    const current = byMember.get(key);
    if (!current || getRhRowPriority(row) > getRhRowPriority(current)) {
      byMember.set(key, row);
    }
  });

  return Array.from(byMember.values());
}

function getMissionAverage(criteria = []) {
  const scores = (criteria || []).map((criterion) => criterion.score).filter((score) => typeof score === 'number');

  if (!scores.length) {
    return null;
  }

  return Number((scores.reduce((total, score) => total + score, 0) / scores.length).toFixed(1));
}

function getMissionScoreTotal(missions = [], allowedStatuses = []) {
  return Number(
    (missions || [])
      .filter((mission) => !allowedStatuses.length || allowedStatuses.includes(mission.status))
      .reduce((total, mission) => total + (getMissionAverage(mission.criteria || []) || 0), 0)
      .toFixed(1)
  );
}

function getMissionScoreCount(missions = [], allowedStatuses = []) {
  return (missions || []).filter((mission) => {
    if (allowedStatuses.length && !allowedStatuses.includes(mission.status)) {
      return false;
    }

    return typeof getMissionAverage(mission.criteria || []) === 'number';
  }).length;
}

function buildScoreDetail({
  source = '',
  evaluatorName = '',
  evaluatorGrade = '',
  missionId = '',
  missionTitle = '',
  score = null,
  submittedAt = null,
  sectionComments = [],
  titleJustifications = [],
}) {
  return {
    source,
    evaluatorName,
    evaluatorGrade,
    missionId,
    missionTitle,
    score,
    submittedAt,
    sectionComments,
    titleJustifications,
  };
}

function normalizeGradeForWeight(value = '') {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[Ã‰ÃˆÃŠÃ‹]/g, 'E')
    .trim()
    .toUpperCase();
}

function getMissionRecipientRole(recipient = {}) {
  const category = String(recipient.code_categorie || '').trim().toUpperCase();
  const grade = normalizeGradeForWeight(recipient.grade || '');

  if (category === '11' || grade.includes('ASSOCIE')) return 'associate';
  if (category === '10B' || category === '10C' || grade.includes('MANAGER')) return 'manager';
  if (category === '9A' || category === '9B' || grade.includes('SENIOR')) return 'senior';
  return '';
}

function getEvaluatingMissionRecipients(mission = {}) {
  return (mission.recipients || []).filter((recipient) => recipient.can_evaluate !== false && recipient.canEvaluate !== false);
}

function isAssociateDepartmentMission(mission = {}) {
  return normalizeText(mission.department || mission.primaryRecipientDepartment || '').includes('ASSOCIE');
}

function getAssistantMissionWeights(mission = {}) {
  const roles = new Set(getEvaluatingMissionRecipients(mission).map(getMissionRecipientRole).filter(Boolean));
  if (isAssociateDepartmentMission(mission) && roles.has('associate') && !roles.has('senior')) {
    roles.delete('manager');
  }

  const hasSenior = roles.has('senior');
  const hasManager = roles.has('manager');
  const hasAssociate = roles.has('associate');

  if (hasSenior && hasManager && hasAssociate) {
    return { self: 0.15, senior: 0.2, manager: 0.3, associate: 0.35 };
  }

  if (hasSenior && hasManager) {
    return { self: 0.2, senior: 0.3, manager: 0.5 };
  }

  if (hasManager && hasAssociate) {
    return { self: 0.2, manager: 0.3, associate: 0.5 };
  }

  if (hasAssociate) {
    return { self: 0.4, associate: 0.6 };
  }

  if (hasManager) {
    return { self: 0.4, manager: 0.6 };
  }

  return { self: 0.4, manager: 0.6 };
}

function getSeniorMissionWeights(mission = {}) {
  const roles = new Set(getEvaluatingMissionRecipients(mission).map(getMissionRecipientRole).filter(Boolean));
  const hasManager = roles.has('manager');
  const hasAssociate = roles.has('associate');

  if (hasManager && hasAssociate) {
    return { self: 0.3, manager: 0.35, associate: 0.35 };
  }

  if (hasAssociate) {
    return { self: 0.4, associate: 0.6 };
  }

  return { self: 0.4, manager: 0.6 };
}

function isSameMissionId(left, right) {
  return String(left || '').trim() === String(right || '').trim();
}

function getMissionReviewScoreById(missionReviews = [], missionId, allowedStatuses = []) {
  const scores = (missionReviews || [])
    .filter((missionReview) => isSameMissionId(missionReview.mission_id || missionReview.id, missionId))
    .filter((missionReview) => !allowedStatuses.length || allowedStatuses.includes(missionReview.status))
    .map((missionReview) => getMissionAverage(missionReview.criteria || []))
    .filter((score) => typeof score === 'number');

  return getAverageFromScores(scores);
}

function getAssociateMissionSections(instance = {}, mission = {}) {
  const peerSections = normalizeSections(instance.peer_review_sections || []);
  const missionId = String(mission.mission_id || mission.id || '').trim();
  const missionSections = peerSections.filter((section) => String(section.subtitle || '').trim() === missionId);

  if (missionSections.length) {
    return missionSections;
  }

  const submittedAssociateMissions = (instance.mission_evaluations || []).filter(
    (item) => item.status === 'Soumise' && getEvaluatingMissionRecipients(item).some((recipient) => getMissionRecipientRole(recipient) === 'associate')
  );

  if (submittedAssociateMissions.length === 1 && isSameMissionId(submittedAssociateMissions[0].mission_id, missionId)) {
    return peerSections;
  }

  return [];
}

function getSectionCommentsFromSections(sections = []) {
  return normalizeSections(sections)
    .filter((section) => String(section.comment || '').trim())
    .map((section) => ({
      sectionId: section.id || section.title,
      title: section.title || 'Section',
      comment: String(section.comment || '').trim(),
    }));
}

function getAssociateMissionScore(instance = {}, mission = {}) {
  const missionSections = getAssociateMissionSections(instance, mission);

  if (missionSections.length) {
    return getOverallAverageScore(missionSections);
  }

  return null;
}

function buildAssistantWeightedMissionScoreDetails({
  selfEvaluation = {},
  memberSeniorReviews = [],
  managerReview = null,
  fallbackMember = null,
  fallbackManager = null,
  userById = new Map(),
}) {
  const missionScoreDetails = [];
  const weightedScores = [];

  (selfEvaluation?.mission_evaluations || []).forEach((mission) => {
    if (mission.status !== 'Soumise') {
      return;
    }

    const missionId = mission.mission_id || mission.id;
    const selfScore = getMissionAverage(mission.criteria || []);
    const seniorScores = memberSeniorReviews
      .map((seniorReview) => {
        const seniorUser = userById.get(String(seniorReview.senior_id));
        const selectedSeniorIds = new Set(
          getEvaluatingMissionRecipients(mission)
            .filter((recipient) => getMissionRecipientRole(recipient) === 'senior')
            .map((recipient) => String(recipient.user_id || recipient.id || '').trim())
            .filter(Boolean)
        );

        if (selectedSeniorIds.size && !selectedSeniorIds.has(String(seniorReview.senior_id || '').trim())) {
          return null;
        }

        const missionReview = (seniorReview.mission_reviews || []).find(
          (item) => isSameMissionId(item.mission_id || item.id, missionId) && item.status === 'Transmise'
        );
        const score = missionReview ? getMissionAverage(missionReview.criteria || []) : null;
        return typeof score === 'number'
          ? {
              score,
              evaluatorName: seniorUser?.name || 'Senior',
              evaluatorGrade: seniorUser?.grade || 'Senior',
              submittedAt:
                missionReview?.submitted_at || seniorReview.submitted_at || null,
              sectionComments: getMissionSectionComments(missionReview),
              titleJustifications: getMissionTitleJustifications(missionReview),
            }
          : null;
      })
      .filter(Boolean);
    const seniorScore = getAverageFromScores(seniorScores.map((item) => item.score));
    const weights = getAssistantMissionWeights(mission);
    const managerMissionReview = (managerReview?.mission_reviews || []).find(
      (item) =>
        isSameMissionId(item.mission_id || item.id, missionId) &&
        ([
          "Transmis à l'associé",
          'Transmis à l associé',
          "Transmis à l'associé",
          'Soumise à la RH',
          'Soumise à la RH',
          'Soumise à la RH',
          'Soumise à la RH',
        ].includes(item.status) || isManagerMissionSubmittedStatus(item.status))
    );
    const managerScore = weights.manager ? (managerMissionReview ? getMissionAverage(managerMissionReview.criteria || []) : getMissionReviewScoreById(managerReview?.mission_reviews || [], missionId, [
      "Transmis à l'associé",
      'Transmis à l associé',
      "Transmis à l'associé",
      'Soumise à la RH',
      'Soumise à la RH',
      'Soumise à la RH',
      'Soumise à la RH',
    ])) : null;
    const associateScore = getAssociateMissionScore(selfEvaluation, mission);
    const associateSections = getAssociateMissionSections(selfEvaluation, mission);
    const roleScores = {
      self: selfScore,
      senior: seniorScore,
      manager: managerScore,
      associate: associateScore,
    };
    const expectedRoles = Object.keys(weights);
    const hasAllExpectedScores = expectedRoles.every((role) => typeof roleScores[role] === 'number');

    if (!hasAllExpectedScores) {
      return;
    }

    const weightedScore = Number(
      expectedRoles.reduce((total, role) => total + roleScores[role] * weights[role], 0).toFixed(1)
    );
    weightedScores.push(weightedScore);

    const addWeightedDetail = (roleKey, roleLabel, evaluatorName, evaluatorGrade, submittedAt = null, detailSource = null) => {
      missionScoreDetails.push(
        buildScoreDetail({
          source: `${roleLabel} (${Math.round(weights[roleKey] * 100)}%)`,
          evaluatorName,
          evaluatorGrade,
          missionId,
          missionTitle: mission.title,
          score: roleScores[roleKey],
          submittedAt,
          sectionComments: detailSource ? getMissionSectionComments(detailSource) : [],
          titleJustifications: detailSource ? getMissionTitleJustifications(detailSource) : [],
        })
      );
    };

    addWeightedDetail('self', 'Auto-évaluation', fallbackMember?.name || 'Collaborateur', fallbackMember?.grade || 'Collaborateur', mission.submitted_at || null, mission);
    if (weights.senior) {
      seniorScores.forEach((seniorItem) =>
        missionScoreDetails.push(
          buildScoreDetail({
            source: `Senior (${Math.round(weights.senior * 100)}%)`,
            evaluatorName: seniorItem.evaluatorName,
            evaluatorGrade: seniorItem.evaluatorGrade,
            missionId,
            missionTitle: mission.title,
            score: seniorItem.score,
            submittedAt: seniorItem.submittedAt,
            sectionComments: seniorItem.sectionComments || [],
            titleJustifications: seniorItem.titleJustifications || [],
          })
        )
      );
    }
    if (weights.manager) {
      addWeightedDetail('manager', 'Manager', fallbackManager?.name || 'Manager', fallbackManager?.grade || 'Manager', managerMissionReview?.submitted_at || managerReview?.submitted_at || null, managerMissionReview);
    }
    if (weights.associate) {
      missionScoreDetails.push(
        buildScoreDetail({
          source: `Associé (${Math.round(weights.associate * 100)}%)`,
          evaluatorName: selfEvaluation.peer_review_comment_by_name || 'Associé',
          evaluatorGrade: 'Associé',
          missionId,
          missionTitle: mission.title,
          score: roleScores.associate,
          submittedAt: selfEvaluation.peer_review_comment_saved_at || null,
          sectionComments: getSectionCommentsFromSections(associateSections),
          titleJustifications: getPageJustifications(associateSections),
        })
      );
    }
    missionScoreDetails.push(
      buildScoreDetail({
        source: 'Score final pondéré',
        evaluatorName: 'Mission',
        evaluatorGrade: 'Syntèse',
        missionId,
        missionTitle: mission.title,
        score: weightedScore,
        submittedAt: null,
      })
    );
  });

  return {
    missionScoreDetails,
    missionScore: getAverageFromScores(weightedScores),
    missionScoreTotal: getSumFromScores(weightedScores),
    missionScoreCount: weightedScores.length,
  };
}

function buildSeniorWeightedMissionScoreDetails({
  selfEvaluation = {},
  managerReview = null,
  fallbackMember = null,
  fallbackManager = null,
}) {
  const missionScoreDetails = [];
  const weightedScores = [];

  (selfEvaluation?.mission_evaluations || []).forEach((mission) => {
    if (mission.status !== 'Soumise') {
      return;
    }

    const missionId = mission.mission_id || mission.id;
    const weights = getSeniorMissionWeights(mission);
    const selfScore = getMissionAverage(mission.criteria || []);
    const managerMissionReview = (managerReview?.mission_reviews || []).find(
      (item) =>
        isSameMissionId(item.mission_id || item.id, missionId) &&
        isManagerMissionSubmittedStatus(item.status)
    );
    const managerScore = weights.manager
      ? managerMissionReview
        ? getMissionAverage(managerMissionReview.criteria || [])
        : getMissionReviewScoreById(managerReview?.mission_reviews || [], missionId)
      : null;
    const associateSections = getAssociateMissionSections(selfEvaluation, mission);
    const associateScore = getAssociateMissionScore(selfEvaluation, mission);
    const roleScores = {
      self: selfScore,
      manager: managerScore,
      associate: associateScore,
    };
    const expectedRoles = Object.keys(weights);
    const hasAllExpectedScores = expectedRoles.every((role) => typeof roleScores[role] === 'number');

    if (!hasAllExpectedScores) {
      return;
    }

    const weightedScore = Number(
      expectedRoles.reduce((total, role) => total + roleScores[role] * weights[role], 0).toFixed(1)
    );
    weightedScores.push(weightedScore);

    const addWeightedDetail = (roleKey, roleLabel, evaluatorName, evaluatorGrade, submittedAt = null, detailSource = null) => {
      missionScoreDetails.push(
        buildScoreDetail({
          source: `${roleLabel} (${Math.round(weights[roleKey] * 100)}%)`,
          evaluatorName,
          evaluatorGrade,
          missionId,
          missionTitle: mission.title,
          score: roleScores[roleKey],
          submittedAt,
          sectionComments: detailSource ? getMissionSectionComments(detailSource) : [],
          titleJustifications: detailSource ? getMissionTitleJustifications(detailSource) : [],
        })
      );
    };

    addWeightedDetail('self', 'Auto-évaluation', fallbackMember?.name || 'Senior', fallbackMember?.grade || 'Senior', mission.submitted_at || null, mission);

    if (weights.manager) {
      addWeightedDetail('manager', 'Manager', fallbackManager?.name || 'Manager', fallbackManager?.grade || 'Manager', managerMissionReview?.submitted_at || managerReview?.submitted_at || null, managerMissionReview);
    }

    if (weights.associate) {
      missionScoreDetails.push(
        buildScoreDetail({
          source: `Associé (${Math.round(weights.associate * 100)}%)`,
          evaluatorName: selfEvaluation.peer_review_comment_by_name || 'Associé',
          evaluatorGrade: 'Associe',
          missionId,
          missionTitle: mission.title,
          score: roleScores.associate,
          submittedAt: selfEvaluation.peer_review_comment_saved_at || null,
          sectionComments: getSectionCommentsFromSections(associateSections),
          titleJustifications: getPageJustifications(associateSections),
        })
      );
    }

    missionScoreDetails.push(
      buildScoreDetail({
        source: 'Score final pondéré',
        evaluatorName: 'Mission',
        evaluatorGrade: 'Synthèse',
        missionId,
        missionTitle: mission.title,
        score: weightedScore,
        submittedAt: null,
      })
    );
  });

  return {
    missionScoreDetails,
    missionScore: getAverageFromScores(weightedScores),
    missionScoreTotal: getSumFromScores(weightedScores),
    missionScoreCount: weightedScores.length,
  };
}

function getAssociateManagerMissionReview(associateReview = {}, missionId = '') {
  return (associateReview?.mission_reviews || []).find((missionReview) =>
    isSameMissionId(missionReview.mission_id || missionReview.id, missionId)
  );
}

function getAssociateManagerMissionComments(missionReview = {}) {
  const commentsBySection = new Map();

  (missionReview?.criteria || []).forEach((criterion) => {
    const sectionTitle = String(criterion.section_title || criterion.sectionTitle || '').trim() || 'Mission';
    const comment = String(criterion.section_comment || criterion.sectionComment || criterion.page_comment || criterion.pageComment || '').trim();
    if (comment && !commentsBySection.has(sectionTitle)) {
      commentsBySection.set(sectionTitle, comment);
    }
  });

  return Array.from(commentsBySection.entries()).map(([title, comment]) => ({
    sectionId: title,
    title,
    comment,
  }));
}

function buildManagerWeightedMissionScoreDetails({
  selfEvaluation = {},
  associateReviews = [],
  associateUserById = new Map(),
  fallbackManager = null,
}) {
  const missionScoreDetails = [];
  const weightedScores = [];

  (selfEvaluation?.mission_evaluations || []).forEach((mission) => {
    if (mission.status !== 'Soumise') {
      return;
    }

    const missionId = mission.mission_id || mission.id;
    const selfScore = getMissionAverage(mission.criteria || []);
    const associateScores = associateReviews
      .map((associateReview) => {
        const missionReview = getAssociateManagerMissionReview(associateReview, missionId);
        const score = missionReview ? getMissionAverage(missionReview.criteria || []) : null;
        const associateUser = associateUserById.get(String(associateReview.associate_id || ''));

        return typeof score === 'number'
          ? {
              score,
              evaluatorName: associateUser?.name || 'Associe',
              evaluatorGrade: associateUser?.grade || 'Associe',
              submittedAt: missionReview?.last_saved_at || associateReview.last_saved_at || null,
              sectionComments: getAssociateManagerMissionComments(missionReview),
            }
          : null;
      })
      .filter(Boolean);
    const associateScore = getAverageFromScores(associateScores.map((item) => item.score));

    if (typeof selfScore !== 'number' || typeof associateScore !== 'number') {
      return;
    }

    const weightedScore = Number((selfScore * 0.4 + associateScore * 0.6).toFixed(1));
    weightedScores.push(weightedScore);

    missionScoreDetails.push(
      buildScoreDetail({
        source: 'Auto-évaluation (40%)',
        evaluatorName: fallbackManager?.name || 'Manager',
        evaluatorGrade: fallbackManager?.grade || 'Manager',
        missionId,
        missionTitle: mission.title,
        score: selfScore,
        submittedAt: mission.submitted_at || selfEvaluation.submitted_at || null,
        sectionComments: getMissionSectionComments(mission),
        titleJustifications: getMissionTitleJustifications(mission),
      })
    );

    associateScores.forEach((associateItem) => {
      missionScoreDetails.push(
        buildScoreDetail({
          source: 'Associe (60%)',
          evaluatorName: associateItem.evaluatorName,
          evaluatorGrade: associateItem.evaluatorGrade,
          missionId,
          missionTitle: mission.title,
          score: associateItem.score,
          submittedAt: associateItem.submittedAt,
          sectionComments: associateItem.sectionComments || [],
        })
      );
    });

    missionScoreDetails.push(
      buildScoreDetail({
        source: 'Score final pondéré',
        evaluatorName: 'Mission',
        evaluatorGrade: 'Synthèse',
        missionId,
        missionTitle: mission.title,
        score: weightedScore,
        submittedAt: null,
      })
    );
  });

  return {
    missionScoreDetails,
    missionScore: getAverageFromScores(weightedScores),
    missionScoreTotal: getSumFromScores(weightedScores),
    missionScoreCount: weightedScores.length,
  };
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
      });
    }

    const page = section.pages.get(pageKey);
    const pageComment = String(criterion.page_comment || criterion.pageComment || '').trim();
    if (!page.comment && pageComment) page.comment = pageComment;
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

function getAverageFromDetailRows(details = []) {
  return getAverageFromScores(details.map((detail) => detail.score));
}

function getSumFromScores(scores = []) {
  const numericScores = scores.filter((score) => typeof score === 'number');

  if (!numericScores.length) {
    return null;
  }

  return Number(numericScores.reduce((total, score) => total + score, 0).toFixed(1));
}

function getReviewSectionSummaries(sections = []) {
  return sections
    .slice(0, 3)
    .map((section) => ({
      label: section.title,
      score: getAverageScore(section),
    }))
    .filter((item) => typeof item.score === 'number');
}

function getReviewCommentSummary(sections = [], managerName = '') {
  const comments = sections
    .map((section) => String(section.comment || '').trim())
    .filter(Boolean)
    .slice(0, 2);

  if (comments.length) {
    return comments.join(' ');
  }

  return managerName
    ? `Evaluateur : ${managerName}. Les scores sont consultables par la RH pour vérifier la cohérence de l'évaluation.`
    : "Les scores sont consultables par la RH pour vérifier la cohérence de l'évaluation.";
}

function buildSectionBreakdown(sections = [], source = '', evaluatorName = '', evaluatorGrade = '', submittedAt = null) {
  const normalizedSections = normalizeSections(sections);

  return {
    source,
    evaluatorName,
    evaluatorGrade,
    submittedAt,
    overallScore: getOverallAverageScore(normalizedSections),
    sectionScores: normalizedSections
      .map((section) => ({
        sectionId: section.id,
        title: section.title,
        score: getAverageScore(section),
      }))
      .filter((item) => typeof item.score === 'number'),
    sectionComments: normalizedSections
      .filter((section) => String(section.comment || '').trim())
      .map((section) => ({
        sectionId: section.id,
        title: section.title,
        comment: String(section.comment || '').trim(),
      })),
    titleJustifications: getPageJustifications(normalizedSections),
  };
}

async function loadRhReviewDataset(rhUserIds) {
  const recipientIds = Array.isArray(rhUserIds) ? rhUserIds.filter(Boolean) : [rhUserIds].filter(Boolean);
  const reviews = await ManagerMemberReview.find({
    cycle_label: getCurrentCycleLabel(),
    submitted_to_user_ids: { $in: recipientIds },
  }).select(
    'member_id manager_id member_department status submitted_at sections mission_reviews rh_validation_selected rh_validation_selected_at rh_validated_at'
  );

  const memberIds = reviews.map((review) => review.member_id).filter(Boolean);
  const managerIds = reviews.map((review) => review.manager_id).filter(Boolean);
  const seniorReviews = memberIds.length
    ? await SeniorAssistantReview.find({
        cycle_label: getCurrentCycleLabel(),
        assistant_id: { $in: memberIds },
      }).select('assistant_id senior_id submitted_at sections mission_reviews')
    : [];
  const seniorIds = seniorReviews.map((review) => review.senior_id).filter(Boolean);

  const [users, populationMembers, departmentManagers] = await Promise.all([
    User.find({
      _id: { $in: [...memberIds, ...managerIds, ...seniorIds] },
    }).select('_id name first_name last_name grade department code_categorie'),
    User.find({
      is_active: true,
      code_categorie: { $in: ['8C', '9A', '9B', '10B', '10C'] },
    }).select('_id name first_name last_name grade department code_categorie'),
    User.find({
      is_active: true,
      code_categorie: { $in: ['9B', '10B', '10C'] },
      ...buildNonRhDepartmentClause(),
    }).select('_id name department grade'),
  ]);

  const userById = new Map(users.map((user) => [String(user._id), user]));
  const selfEvaluationQueries = users
    .filter((user) => memberIds.some((memberId) => String(memberId) === String(user._id)))
    .map((member) => ({
      evalue_id: member._id,
      cycle_label: getCurrentCycleLabel(),
      template_type: getExpectedTemplateType(member),
    }));

  const selfEvaluations = selfEvaluationQueries.length
    ? await EvaluationInstance.find({ $or: selfEvaluationQueries }).select(
        'evalue_id template_type sections mission_evaluations submitted_at peer_review_sections peer_review_comment_by_name peer_review_comment_saved_at'
      )
    : [];
  const selfEvaluationByMemberId = new Map(selfEvaluations.map((instance) => [String(instance.evalue_id), instance]));
  const reviewByMemberId = new Map(reviews.map((review) => [String(review.member_id), review]));
  const seniorReviewsByAssistantId = new Map();
  const departmentManagersByDepartment = new Map();

  seniorReviews.forEach((review) => {
    const key = String(review.assistant_id);
    const current = seniorReviewsByAssistantId.get(key) || [];
    current.push(review);
    seniorReviewsByAssistantId.set(key, current);
  });

  departmentManagers.forEach((manager) => {
    const key = String(manager.department || '');
    if (!departmentManagersByDepartment.has(key)) {
      departmentManagersByDepartment.set(key, manager);
    }
  });

  return populationMembers.map((populationMember) => {
    const review = reviewByMemberId.get(String(populationMember._id));
    const reviewMember = review ? userById.get(String(review.member_id)) : null;
    const reviewManager = review ? userById.get(String(review.manager_id)) : null;
    const fallbackMember = reviewMember || populationMember;
    const fallbackManager = reviewManager || departmentManagersByDepartment.get(String(fallbackMember?.department || ''));
    const sections = normalizeSections(review?.sections || []);
    const selfEvaluation = selfEvaluationByMemberId.get(String(fallbackMember._id));
    const memberSeniorReviews = seniorReviewsByAssistantId.get(String(fallbackMember._id)) || [];
    const selfSections = normalizeSections(selfEvaluation?.sections || []);
    const selfScore = getOverallAverageScore(selfSections);
    const managerScore = getOverallAverageScore(sections);
    const selfEvaluationBreakdown = buildSectionBreakdown(
      selfSections,
      'Auto-évaluation',
      fallbackMember?.name || 'Collaborateur',
      fallbackMember?.grade || 'Collaborateur',
      selfEvaluation?.submitted_at || null
    );
    const seniorEvaluationBreakdowns = memberSeniorReviews.map((seniorReview) => {
      const seniorUser = userById.get(String(seniorReview.senior_id));

      return buildSectionBreakdown(
        seniorReview.sections || [],
        'Senior',
        seniorUser?.name || 'Senior',
        seniorUser?.grade || 'Senior',
        seniorReview?.submitted_at || null
      );
    });
    const managerEvaluationBreakdown = buildSectionBreakdown(
      sections,
      'Manager',
      fallbackManager?.name || 'Manager',
      fallbackManager?.grade || 'Manager',
      review?.submitted_at || null
    );
    const missionScoreDetails = [];
    const globalScoreDetails = [];
    const weightedMissionSummary =
      selfEvaluation?.template_type === 'assistant-self-evaluation'
        ? buildAssistantWeightedMissionScoreDetails({
            selfEvaluation,
            memberSeniorReviews,
            managerReview: review,
            fallbackMember,
            fallbackManager,
            userById,
          })
        : selfEvaluation?.template_type === 'senior-self-evaluation'
          ? buildSeniorWeightedMissionScoreDetails({
              selfEvaluation,
              managerReview: review,
              fallbackMember,
              fallbackManager,
            })
          : null;

    if (selfEvaluation?.submitted_at && typeof selfScore === 'number') {
      globalScoreDetails.push(
        buildScoreDetail({
          source: 'Auto-évaluation',
          evaluatorName: fallbackMember?.name || 'Collaborateur',
          evaluatorGrade: fallbackMember?.grade || 'Collaborateur',
          score: selfScore,
          submittedAt: selfEvaluation.submitted_at || null,
        })
      );
    }

    if (weightedMissionSummary) {
      missionScoreDetails.push(...weightedMissionSummary.missionScoreDetails);
    } else {
      (selfEvaluation?.mission_evaluations || []).forEach((mission) => {
        const score = getMissionAverage(mission.criteria || []);
        if (mission.status === 'Soumise' && typeof score === 'number') {
          missionScoreDetails.push(
            buildScoreDetail({
              source: 'Auto-évaluation',
              evaluatorName: fallbackMember?.name || 'Collaborateur',
              evaluatorGrade: fallbackMember?.grade || 'Collaborateur',
              missionId: mission.mission_id || mission.id,
              missionTitle: mission.title,
              score,
              submittedAt: mission.submitted_at || null,
            })
          );
        }
      });
    }

    memberSeniorReviews.forEach((seniorReview) => {
      const seniorUser = userById.get(String(seniorReview.senior_id));
      const seniorScore = getOverallAverageScore(normalizeSections(seniorReview.sections || []));

      if (seniorReview.submitted_at && typeof seniorScore === 'number') {
        globalScoreDetails.push(
          buildScoreDetail({
            source: 'Senior',
            evaluatorName: seniorUser?.name || 'Senior',
            evaluatorGrade: seniorUser?.grade || 'Senior',
            score: seniorScore,
            submittedAt: seniorReview.submitted_at || null,
          })
        );
      }

      if (selfEvaluation?.template_type !== 'assistant-self-evaluation') {
        (seniorReview.mission_reviews || []).forEach((missionReview) => {
          const score = getMissionAverage(missionReview.criteria || []);
          if (missionReview.status === 'Transmise' && typeof score === 'number') {
            missionScoreDetails.push(
              buildScoreDetail({
                source: 'Senior',
                evaluatorName: seniorUser?.name || 'Senior',
                evaluatorGrade: seniorUser?.grade || 'Senior',
                missionId: missionReview.mission_id || missionReview.id,
                missionTitle: missionReview.title,
                score,
                submittedAt: missionReview.submitted_at || null,
                sectionComments: getMissionSectionComments(missionReview),
                titleJustifications: getMissionTitleJustifications(missionReview),
              })
            );
          }
        });
      }
    });

    if (review?.submitted_at && typeof managerScore === 'number') {
      globalScoreDetails.push(
        buildScoreDetail({
          source: 'Manager',
          evaluatorName: fallbackManager?.name || 'Manager',
          evaluatorGrade: fallbackManager?.grade || 'Manager',
          score: managerScore,
          submittedAt: review.submitted_at || null,
        })
      );
    }

    if (selfEvaluation?.template_type !== 'assistant-self-evaluation') {
      (review?.mission_reviews || []).forEach((missionReview) => {
        const score = getMissionAverage(missionReview.criteria || []);
        if (missionReview.status === 'Soumise à la RH' && typeof score === 'number') {
          missionScoreDetails.push(
            buildScoreDetail({
              source: 'Manager',
              evaluatorName: fallbackManager?.name || 'Manager',
              evaluatorGrade: fallbackManager?.grade || 'Manager',
              missionId: missionReview.mission_id || missionReview.id,
              missionTitle: missionReview.title,
              score,
              submittedAt: missionReview.submitted_at || null,
              sectionComments: getMissionSectionComments(missionReview),
              titleJustifications: getMissionTitleJustifications(missionReview),
            })
          );
        }
      });
    }

    const missionScore = weightedMissionSummary
      ? weightedMissionSummary.missionScore
      : getAverageFromDetailRows(missionScoreDetails);
    const missionScoreCount = weightedMissionSummary
      ? weightedMissionSummary.missionScoreCount
      : missionScoreDetails.length;
    const scoreGlobal = getAverageFromDetailRows(globalScoreDetails);
    const scoreGlobalCount = globalScoreDetails.length;
    const finalScore =
      ['assistant-self-evaluation', 'senior-self-evaluation'].includes(selfEvaluation?.template_type) && typeof missionScore === 'number'
        ? missionScore
        : getAverageFromScores([missionScore, scoreGlobal]);
    const rhValidationFinalScore =
      ['assistant-self-evaluation', 'senior-self-evaluation'].includes(selfEvaluation?.template_type) && weightedMissionSummary
        ? weightedMissionSummary.missionScore
        : finalScore;
    const hasSubmittedManagerMission = (review?.mission_reviews || []).some((mission) => mission.status === 'Soumise à la RH');
    const effectiveStatus =
      review?.status === 'Soumis à la RH' || review?.status === 'Validé RH' || review?.status === "Transmis à l'associé" || review?.status === 'Clôture'
        ? review.status
        : hasSubmittedManagerMission
          ? 'Soumis à la RH'
          : review?.status || 'En attente';
    const unjustifiedLowScores = countUnjustifiedLowScorePages(sections);
    const sectionSummaries = getReviewSectionSummaries(sections);
    const commentSummary = sections.length
      ? getReviewCommentSummary(sections, fallbackManager?.name || '')
      : "Evaluation non encore soumise à la RH pour ce collaborateur.";
    const gap = typeof selfScore === 'number' && typeof managerScore === 'number' ? Number(Math.abs(selfScore - managerScore).toFixed(1)) : null;

    return {
      id: review?._id?.toString?.() || `pending-${fallbackMember._id.toString()}`,
      memberId: fallbackMember?._id?.toString?.() || '',
      name: fallbackMember?.name || 'Collaborateur',
      role: fallbackMember?.grade || 'Collaborateur',
      department: fallbackMember?.department || review?.member_department || '',
      managerName: fallbackManager?.name || 'Non soumis',
      selfScore,
      scoreGlobal,
      scoreGlobalCount,
      missionScore,
      missionScoreCount,
      missionScoreDetails,
      globalScoreDetails,
      managerMissionScore: getMissionScoreTotal(review?.mission_reviews || [], ['Soumise à la RH']),
      managerMissionScoreCount: getMissionScoreCount(review?.mission_reviews || [], ['Soumise à la RH']),
      managerScore,
      finalScore,
      rhValidationFinalScore,
      status: effectiveStatus,
      submittedAt: review?.submitted_at || null,
      unjustifiedLowScores,
      displayStatus: review ? getRhDisplayStatus({ ...review, status: effectiveStatus }, unjustifiedLowScores, finalScore) : 'En attente',
      rhValidationSelected: Boolean(review?.rh_validation_selected || hasSubmittedManagerMission),
      sectionSummaries,
      commentSummary,
      gap,
      evaluationTrail: [selfEvaluationBreakdown, ...seniorEvaluationBreakdowns, managerEvaluationBreakdown].filter(
        (item) => item.sectionScores.length || item.sectionComments.length || typeof item.overallScore === 'number'
      ),
    };
  });
}

async function loadAssistantRhSelfDataset(rhUserIds) {
  const recipientIds = Array.isArray(rhUserIds) ? rhUserIds.filter(Boolean) : [rhUserIds].filter(Boolean);
  const instances = await EvaluationInstance.find({
    cycle_label: getCurrentCycleLabel(),
    template_type: { $in: ['rh-assistant-self-evaluation', 'assistant-self-evaluation', 'senior-self-evaluation'] },
    submitted_to_user_ids: { $in: recipientIds },
  }).select(
    'evalue_id template_type status submitted_at sections mission_evaluations peer_review_sections peer_review_comment peer_review_comment_by_name peer_review_comment_saved_at rh_validation_selected rh_validation_selected_at rh_validated_at'
  );

  const userIds = instances.map((instance) => instance.evalue_id).filter(Boolean);
  const [users, reviews] = await Promise.all([
    userIds.length
      ? User.find({ _id: { $in: userIds } }).select('_id name first_name last_name grade department code_categorie')
      : [],
    userIds.length
      ? ManagerMemberReview.find({
          cycle_label: getCurrentCycleLabel(),
          member_id: { $in: userIds },
          template_type: 'rh-assistant-evaluation',
        }).select('member_id manager_id status submitted_at sections mission_reviews rh_validation_selected rh_validation_selected_at rh_validated_at')
      : [],
  ]);
  const userById = new Map(users.map((user) => [String(user._id), user]));
  const [seniorReviews, missionManagerReviews] = await Promise.all([
    userIds.length
      ? SeniorAssistantReview.find({
          cycle_label: getCurrentCycleLabel(),
          assistant_id: { $in: userIds },
        }).select('assistant_id senior_id submitted_at sections mission_reviews')
      : [],
    userIds.length
      ? ManagerMemberReview.find({
          cycle_label: getCurrentCycleLabel(),
          member_id: { $in: userIds },
          template_type: { $ne: 'rh-assistant-evaluation' },
        }).select('member_id manager_id status submitted_at sections mission_reviews')
      : [],
  ]);
  const reviewerIds = [
    ...seniorReviews.map((review) => review.senior_id).filter(Boolean),
    ...missionManagerReviews.map((review) => review.manager_id).filter(Boolean),
  ];
  const missingReviewerIds = reviewerIds.filter((reviewerId) => reviewerId && !userById.has(String(reviewerId)));
  const reviewerUsers = missingReviewerIds.length
    ? await User.find({ _id: { $in: missingReviewerIds } }).select('_id name first_name last_name grade department code_categorie')
    : [];
  reviewerUsers.forEach((user) => userById.set(String(user._id), user));
  const reviewByMemberId = new Map(reviews.map((review) => [String(review.member_id), review]));
  const seniorReviewsByAssistantId = new Map();
  const managerReviewByMemberId = new Map();

  seniorReviews.forEach((review) => {
    const key = String(review.assistant_id);
    const current = seniorReviewsByAssistantId.get(key) || [];
    current.push(review);
    seniorReviewsByAssistantId.set(key, current);
  });

  missionManagerReviews.forEach((review) => {
    const key = String(review.member_id);
    if (!managerReviewByMemberId.has(key)) {
      managerReviewByMemberId.set(key, review);
    }
  });

  return instances.map((instance) => {
    const assistantUser = userById.get(String(instance.evalue_id));
    const review = reviewByMemberId.get(String(instance.evalue_id));
    const missionManagerReview = managerReviewByMemberId.get(String(instance.evalue_id));
    const missionManagerUser = missionManagerReview?.manager_id ? userById.get(String(missionManagerReview.manager_id)) : null;
    const memberSeniorReviews = seniorReviewsByAssistantId.get(String(instance.evalue_id)) || [];
    const sections = normalizeSections(instance.sections || []);
    const reviewSections = normalizeSections(review?.sections || instance.peer_review_sections || []);
    const reviewerName = review?.manager_id ? 'RH' : instance.peer_review_comment_by_name || 'Associé';
    const reviewerGrade = review?.manager_id ? 'RH' : 'Associé';
    const selfScore = getOverallAverageScore(sections);
    const managerScore = getOverallAverageScore(reviewSections);
    const selfEvaluationBreakdown = buildSectionBreakdown(
      sections,
      'Auto-évaluation',
      assistantUser?.name || 'Assistante RH',
      assistantUser?.grade || 'Assistante RH',
      instance?.submitted_at || null
    );
    const managerEvaluationBreakdown = buildSectionBreakdown(
      reviewSections,
      reviewerGrade,
      reviewerName,
      reviewerGrade,
      review?.submitted_at || instance.peer_review_comment_saved_at || null
    );
    const missionScoreDetails = [];
    const globalScoreDetails = [];
    const weightedMissionSummary =
      instance.template_type === 'assistant-self-evaluation'
        ? buildAssistantWeightedMissionScoreDetails({
            selfEvaluation: instance,
            memberSeniorReviews,
            managerReview: missionManagerReview,
            fallbackMember: assistantUser,
            fallbackManager: missionManagerUser,
            userById,
          })
        : instance.template_type === 'senior-self-evaluation'
          ? buildSeniorWeightedMissionScoreDetails({
              selfEvaluation: instance,
              managerReview: missionManagerReview,
              fallbackMember: assistantUser,
              fallbackManager: missionManagerUser,
            })
          : null;

    if (instance.submitted_at && typeof selfScore === 'number') {
      globalScoreDetails.push(
        buildScoreDetail({
          source: 'Auto-évaluation',
          evaluatorName: assistantUser?.name || 'Assistante RH',
          evaluatorGrade: assistantUser?.grade || 'Assistante RH',
          score: selfScore,
          submittedAt: instance.submitted_at || null,
        })
      );
    }

    if (weightedMissionSummary) {
      missionScoreDetails.push(...weightedMissionSummary.missionScoreDetails);
    } else {
      (review?.mission_reviews || []).forEach((missionReview) => {
        const score = getMissionAverage(missionReview.criteria || []);
        if (missionReview.status === 'Soumise à la RH' && typeof score === 'number') {
          missionScoreDetails.push(
            buildScoreDetail({
              source: 'Manager',
              evaluatorName: 'RH',
              evaluatorGrade: 'RH',
              missionId: missionReview.mission_id || missionReview.id,
              missionTitle: missionReview.title,
              score,
              submittedAt: missionReview.submitted_at || null,
              sectionComments: getMissionSectionComments(missionReview),
              titleJustifications: getMissionTitleJustifications(missionReview),
            })
          );
        }
      });
    }

    if (review?.submitted_at && typeof managerScore === 'number') {
      globalScoreDetails.push(
        buildScoreDetail({
          source: 'Manager',
          evaluatorName: 'RH',
          evaluatorGrade: 'RH',
          score: managerScore,
          submittedAt: review.submitted_at || null,
        })
      );
    }

    const missionScore = weightedMissionSummary
      ? weightedMissionSummary.missionScore
      : getAverageFromDetailRows(missionScoreDetails);
    const missionScoreCount = weightedMissionSummary
      ? weightedMissionSummary.missionScoreCount
      : missionScoreDetails.length;
    const scoreGlobal = getAverageFromDetailRows(globalScoreDetails);
    const scoreGlobalCount = globalScoreDetails.length;
    const finalScore =
      ['assistant-self-evaluation', 'senior-self-evaluation'].includes(instance.template_type) && typeof missionScore === 'number'
        ? missionScore
        : getAverageFromScores([missionScore, scoreGlobal]);
    const rhValidationFinalScore =
      ['assistant-self-evaluation', 'senior-self-evaluation'].includes(instance.template_type) && weightedMissionSummary
        ? weightedMissionSummary.missionScore
        : finalScore;
    const managerMissionScore = getMissionScoreTotal(review?.mission_reviews || [], ['Soumise à la RH']);
    const managerMissionScoreCount = getMissionScoreCount(review?.mission_reviews || [], ['Soumise à la RH']);
    const reviewHasBeenSubmitted =
      review?.status === 'Soumis à la RH' ||
      review?.status === 'Validé RH' ||
      review?.status === "Transmis à l'associé" ||
      review?.status === 'Clôture';
    const effectiveStatus = reviewHasBeenSubmitted ? review.status : instance.status;
    const rhValidationSelected =
      reviewHasBeenSubmitted && typeof review?.rh_validation_selected === 'boolean'
        ? review.rh_validation_selected
        : instance.rh_validation_selected;

    return {
      id: `assistant-rh:${instance._id.toString()}`,
      rawId: instance._id.toString(),
      sourceType:
        instance.template_type === 'rh-assistant-self-evaluation'
          ? 'assistant-rh-self-evaluation'
          : 'associate-direct-self-evaluation',
      memberId: assistantUser?._id?.toString?.() || '',
      name: assistantUser?.name || 'Assistante RH',
      role: assistantUser?.grade || 'Assistante RH',
      department: assistantUser?.department || 'CAPITAL HUMAIN',
      managerName:
        instance.template_type === 'rh-assistant-self-evaluation'
          ? 'Auto-évaluation Assistante RH'
          : `Évaluation directe ${reviewerGrade}`,
      selfScore,
      scoreGlobal,
      scoreGlobalCount,
      missionScore,
      missionScoreCount,
      missionScoreDetails,
      globalScoreDetails,
      managerMissionScore,
      managerMissionScoreCount,
      managerScore,
      finalScore,
      rhValidationFinalScore,
      status: effectiveStatus,
      submittedAt: instance.submitted_at || null,
      unjustifiedLowScores: 0,
      displayStatus: getAssistantRhDisplayStatus({ status: effectiveStatus, rh_validation_selected: rhValidationSelected }),
      rhValidationSelected: Boolean(rhValidationSelected),
      sectionSummaries: getReviewSectionSummaries(reviewSections.length ? reviewSections : sections),
      commentSummary: getReviewCommentSummary(reviewSections.length ? reviewSections : sections, reviewerGrade),
      gap: null,
      evaluationTrail: [selfEvaluationBreakdown, managerEvaluationBreakdown].filter(
        (item) => item.sectionScores.length || item.sectionComments.length || typeof item.overallScore === 'number'
      ),
    };
  });
}

async function loadManagerRhSelfDataset(rhUserIds) {
  const recipientIds = Array.isArray(rhUserIds) ? rhUserIds.filter(Boolean) : [rhUserIds].filter(Boolean);
  const instances = await EvaluationInstance.find({
    cycle_label: getCurrentCycleLabel(),
    template_type: 'manager-self-evaluation',
    submitted_to_user_ids: { $in: recipientIds },
  }).select(
    'evalue_id template_type status submitted_at sections mission_evaluations rh_validation_selected rh_validation_selected_at rh_validated_at'
  );
  const managerIds = instances.map((instance) => instance.evalue_id).filter(Boolean);
  const [managers, associateReviews] = await Promise.all([
    managerIds.length
      ? User.find({ _id: { $in: managerIds } }).select('_id name first_name last_name grade department code_categorie')
      : [],
    managerIds.length
      ? AssociateManagerReview.find({
          cycle_label: getCurrentCycleLabel(),
          manager_id: { $in: managerIds },
        }).select('associate_id manager_id sections mission_reviews associate_note last_saved_at')
      : [],
  ]);
  const associateIds = associateReviews.map((review) => review.associate_id).filter(Boolean);
  const associates = associateIds.length
    ? await User.find({ _id: { $in: associateIds } }).select('_id name first_name last_name grade department code_categorie')
    : [];
  const managerById = new Map(managers.map((manager) => [String(manager._id), manager]));
  const associateUserById = new Map(associates.map((associate) => [String(associate._id), associate]));
  const associateReviewsByManagerId = new Map();

  associateReviews.forEach((review) => {
    const key = String(review.manager_id);
    const current = associateReviewsByManagerId.get(key) || [];
    current.push(review);
    associateReviewsByManagerId.set(key, current);
  });

  return instances.map((instance) => {
    const manager = managerById.get(String(instance.evalue_id));
    const managerAssociateReviews = associateReviewsByManagerId.get(String(instance.evalue_id)) || [];
    const selfSections = normalizeSections(instance.sections || []);
    const selfScore = getOverallAverageScore(selfSections);
    const associateGlobalScores = managerAssociateReviews
      .map((review) => getOverallAverageScore(normalizeSections(review.sections || [])))
      .filter((score) => typeof score === 'number');
    const associateScore = getAverageFromScores(associateGlobalScores);
    const weightedMissionSummary = buildManagerWeightedMissionScoreDetails({
      selfEvaluation: instance,
      associateReviews: managerAssociateReviews,
      associateUserById,
      fallbackManager: manager,
    });
    const missionScore = weightedMissionSummary.missionScore;
    const finalScore =
      typeof missionScore === 'number'
        ? missionScore
        : typeof selfScore === 'number' && typeof associateScore === 'number'
          ? Number((selfScore * 0.4 + associateScore * 0.6).toFixed(1))
          : null;
    const effectiveStatus = instance.status || 'En attente';

    return {
      id: `manager-self:${instance._id.toString()}`,
      rawId: instance._id.toString(),
      sourceType: 'manager-self-evaluation',
      memberId: manager?._id?.toString?.() || '',
      name: manager?.name || 'Manager',
      role: manager?.grade || 'Manager',
      department: manager?.department || '',
      managerName: 'Evaluation directe Associe',
      selfScore,
      scoreGlobal: null,
      scoreGlobalCount: 0,
      missionScore,
      missionScoreCount: weightedMissionSummary.missionScoreCount,
      missionScoreDetails: weightedMissionSummary.missionScoreDetails,
      globalScoreDetails: [],
      managerMissionScore: null,
      managerMissionScoreCount: 0,
      managerScore: associateScore,
      finalScore,
      rhValidationFinalScore: finalScore,
      status: effectiveStatus,
      submittedAt: instance.submitted_at || null,
      unjustifiedLowScores: 0,
      displayStatus: getAssistantRhDisplayStatus({ status: effectiveStatus, rh_validation_selected: instance.rh_validation_selected }),
      rhValidationSelected: Boolean(instance.rh_validation_selected || normalizeStatusText(effectiveStatus).includes('SOUMIS')),
      sectionSummaries: getReviewSectionSummaries(selfSections),
      commentSummary: "Evaluation manager pondérée : auto-évaluation 40% et associé 60%.",
      gap: null,
      evaluationTrail: [
        buildSectionBreakdown(selfSections, 'Auto-évaluation', manager?.name || 'Manager', manager?.grade || 'Manager', instance.submitted_at || null),
      ],
    };
  });
}

function buildDepartmentGroups(rows = []) {
  const groups = new Map();

  rows.forEach((row) => {
    const key = formatDepartmentLabel(row.department);
    const current = groups.get(key) || {
      department: key,
      manager: row.managerName,
      members: [],
    };

    if (!current.manager && row.managerName) {
      current.manager = row.managerName;
    }

    current.members.push({
      id: row.id,
      name: row.name,
      role: row.role,
      evaluator: row.managerName,
      missionScore: row.missionScore,
      scoreGlobal: row.scoreGlobal,
      missionScoreDetails: row.missionScoreDetails || [],
      globalScoreDetails: row.globalScoreDetails || [],
      missionScoreCount: row.missionScoreCount,
      selfScore: row.selfScore,
      managerScore: row.managerScore,
      finalScore: row.finalScore,
      rhValidationFinalScore: row.rhValidationFinalScore,
      status: row.displayStatus,
      rhValidationSelected: row.rhValidationSelected,
      commentSummary: row.commentSummary,
      sectionSummaries: row.sectionSummaries,
      gap: row.gap,
      evaluationTrail: row.evaluationTrail || [],
    });

    groups.set(key, current);
  });

  const ordered = Array.from(groups.values()).map((group) => {
    const scores = group.members
      .map((member) => member.rhValidationFinalScore ?? member.finalScore)
      .filter((score) => typeof score === 'number');
    const average = scores.length ? Number((scores.reduce((total, score) => total + score, 0) / scores.length).toFixed(1)) : null;
    return {
      ...group,
      average,
    };
  });

  const preferredOrder = [
    'Audit',
    'Expertise comptable',
    'Audit & Expertise comptable',
    'Conseil financier',
    'Conseil operationnel',
  ];

  return ordered.sort((left, right) => {
    const leftIndex = preferredOrder.indexOf(left.department);
    const rightIndex = preferredOrder.indexOf(right.department);
    if (leftIndex >= 0 && rightIndex >= 0) return leftIndex - rightIndex;
    if (leftIndex >= 0) return -1;
    if (rightIndex >= 0) return 1;
    return left.department.localeCompare(right.department, 'fr', { sensitivity: 'base' });
  });
}

async function getRhOverview(request, response) {
  const rhUserIds = await resolveRhQueueUserIds();

  const [managerSelfEvaluations, evaluatedPopulation, reviewRows, assistantRhRows, managerRhRows] = await Promise.all([
    EvaluationInstance.find({
      cycle_label: getCurrentCycleLabel(),
      template_type: 'manager-self-evaluation',
      submitted_to_user_ids: { $in: rhUserIds },
    }).select('evalue_id status submitted_at sections'),
    User.find({
      is_active: true,
      code_categorie: { $in: ['8C', '9A', '9B', '10B', '10C'] },
      ...buildNonRhDepartmentClause(),
    }).select('_id'),
    loadRhReviewDataset(rhUserIds),
    loadAssistantRhSelfDataset(rhUserIds),
    loadManagerRhSelfDataset(rhUserIds),
  ]);

  const combinedReviewRows = dedupeRhRowsByMember([...reviewRows, ...assistantRhRows, ...managerRhRows]);
  const receivedCount =
    combinedReviewRows.filter((item) => RH_RELEVANT_STATUSES.includes(item.status)).length +
    managerSelfEvaluations.filter((item) => RH_RELEVANT_STATUSES.includes(item.status)).length;
  const totalEvaluatedPopulation = evaluatedPopulation.length;
  const pendingRhItems = combinedReviewRows.filter((item) => item.status === 'Soumis à la RH');
  const readySynthesesCount = combinedReviewRows.filter(
    (item) => item.status === 'Validé RH' || item.status === "Transmis à l'associé" || item.status === 'Clôture'
  ).length;
  const priorityRows = combinedReviewRows
    .filter((row) => row.status === 'Soumis à la RH')
    .sort((left, right) => {
      if (right.unjustifiedLowScores !== left.unjustifiedLowScores) {
        return right.unjustifiedLowScores - left.unjustifiedLowScores;
      }

      return (left.finalScore ?? 99) - (right.finalScore ?? 99);
    })
    .slice(0, 5)
    .map((row) => ({
      id: row.id,
      name: row.name,
      role: `${row.role} - ${formatDepartmentLabel(row.department)}`,
      manager: row.managerName,
      status: row.displayStatus,
      score: typeof row.finalScore === 'number' ? row.finalScore : null,
    }));

  const departmentMap = new Map();

  combinedReviewRows.forEach((row) => {
    if (typeof row.finalScore !== 'number') return;
    const key = formatDepartmentLabel(row.department);
    const current = departmentMap.get(key) || { department: key, scores: [] };
    current.scores.push(row.finalScore);
    departmentMap.set(key, current);
  });

  const departmentAverages = Array.from(departmentMap.values())
    .map((item) => {
      const average = Number((item.scores.reduce((total, score) => total + score, 0) / item.scores.length).toFixed(1));
      return {
        department: item.department,
        average,
        width: `${Math.max(Math.min((average / 5) * 100, 100), 0)}%`,
      };
    })
    .sort((left, right) => right.average - left.average);

  return response.json({
    cycle_label: getCurrentCycleLabel(),
    stats: [
      {
        title: 'Évaluations reçues',
        value: `${receivedCount}/${totalEvaluatedPopulation}`,
        subtitle: totalEvaluatedPopulation
          ? `${Math.round((receivedCount / totalEvaluatedPopulation) * 100)}% du cycle ${getCurrentCycleLabel().replace('Cycle ', '')}`
          : `0% du cycle ${getCurrentCycleLabel().replace('Cycle ', '')}`,
      },
      {
        title: 'À valider RH',
        value: String(pendingRhItems.length),
        subtitle: pendingRhItems.length ? `Dont ${priorityRows.length} prioritaire(s)` : 'Aucune en attente',
      },
      {
        title: 'Synthèses prêtes',
        value: String(readySynthesesCount),
        subtitle: 'Transmission Associé',
      },
      {
        title: 'Entretiens planifiés',
        value: '0',
        subtitle: 'Donnée non planifiée',
      },
    ],
    priority_rows: priorityRows,
    department_averages: departmentAverages,
  });
}

async function getRhDepartmentEvaluations(request, response) {
  const rhUserIds = await resolveRhQueueUserIds();
  const [rows, assistantRhRows, managerRhRows] = await Promise.all([
    loadRhReviewDataset(rhUserIds),
    loadAssistantRhSelfDataset(rhUserIds),
    loadManagerRhSelfDataset(rhUserIds),
  ]);
  const groups = buildDepartmentGroups(dedupeRhRowsByMember([...rows, ...assistantRhRows, ...managerRhRows]));

  return response.json({
    cycle_label: getCurrentCycleLabel(),
    departments: groups,
  });
}

async function getRhDepartmentEvaluationDetail(request, response) {
  const reviewId = String(request.params.reviewId || '').trim();
  const rhUserIds = await resolveRhQueueUserIds();
  const [rows, assistantRhRows, managerRhRows] = await Promise.all([
    loadRhReviewDataset(rhUserIds),
    loadAssistantRhSelfDataset(rhUserIds),
    loadManagerRhSelfDataset(rhUserIds),
  ]);
  const item = [...rows, ...assistantRhRows, ...managerRhRows].find((row) => String(row.id) === reviewId);

  if (!item) {
    return response.status(404).json({
      message: "Détail d'évaluation introuvable pour cette RH.",
    });
  }

  return response.json(item);
}

async function selectRhDepartmentEvaluation(request, response) {
  const rhUserIds = await resolveRhQueueUserIds();
  const review = await ManagerMemberReview.findOne({
    _id: request.params.reviewId,
    cycle_label: getCurrentCycleLabel(),
    submitted_to_user_ids: { $in: rhUserIds },
  });

  if (!review) {
    return response.status(404).json({
      message: "Evaluation introuvable pour cette RH.",
    });
  }

  review.rh_validation_selected = true;
  review.rh_validation_selected_at = new Date();
  await review.save();

  return response.json({
    message: 'Evaluation ajoutée à la file de validation RH.',
  });
}

async function getRhValidations(request, response) {
  const rhUserIds = await resolveRhQueueUserIds();
  const [rows, assistantRhRows, managerRhRows] = await Promise.all([
    loadRhReviewDataset(rhUserIds),
    loadAssistantRhSelfDataset(rhUserIds),
    loadManagerRhSelfDataset(rhUserIds),
  ]);
  const items = dedupeRhRowsByMember([...rows, ...assistantRhRows, ...managerRhRows].filter(isRhValidationQueueItem));

  return response.json({
    cycle_label: getCurrentCycleLabel(),
    items,
  });
}

async function validateRhSelection(request, response) {
  const rhUserIds = await resolveRhQueueUserIds();
  const reviewIds = Array.isArray(request.body?.reviewIds)
    ? request.body.reviewIds.map((id) => String(id || '').trim()).filter(Boolean)
    : [];

  if (!reviewIds.length) {
    return response.status(400).json({
      message: 'Aucune évaluation selectionnée.',
    });
  }

  const assistantReviewIds = reviewIds
    .filter((id) => id.startsWith('assistant-rh:'))
    .map((id) => id.replace('assistant-rh:', ''));
  const managerSelfIds = reviewIds
    .filter((id) => id.startsWith('manager-self:'))
    .map((id) => id.replace('manager-self:', ''));
  const managerReviewIds = reviewIds.filter((id) => !id.startsWith('assistant-rh:') && !id.startsWith('manager-self:'));

  const reviews = await ManagerMemberReview.find({
    _id: { $in: managerReviewIds },
    cycle_label: getCurrentCycleLabel(),
    submitted_to_user_ids: { $in: rhUserIds },
  });
  const assistantInstances = await EvaluationInstance.find({
    _id: { $in: assistantReviewIds },
    cycle_label: getCurrentCycleLabel(),
    template_type: { $in: ['rh-assistant-self-evaluation', 'assistant-self-evaluation', 'senior-self-evaluation'] },
    submitted_to_user_ids: { $in: rhUserIds },
  });
  const managerInstances = await EvaluationInstance.find({
    _id: { $in: managerSelfIds },
    cycle_label: getCurrentCycleLabel(),
    template_type: 'manager-self-evaluation',
    submitted_to_user_ids: { $in: rhUserIds },
  });
  const assistantReviewMemberIds = assistantInstances.map((instance) => instance.evalue_id).filter(Boolean);
  const assistantReviews = assistantReviewMemberIds.length
    ? await ManagerMemberReview.find({
        cycle_label: getCurrentCycleLabel(),
        member_id: { $in: assistantReviewMemberIds },
        submitted_to_user_ids: { $in: rhUserIds },
      })
    : [];

  for (const review of reviews) {
    review.status = 'Validé RH';
    review.rh_validation_selected = false;
    review.rh_validated_at = new Date();
  }

  for (const instance of assistantInstances) {
    instance.status = 'Validé RH';
    instance.rh_validation_selected = false;
    instance.rh_validated_at = new Date();
  }

  for (const instance of managerInstances) {
    instance.status = 'Validé RH';
    instance.rh_validation_selected = false;
    instance.rh_validated_at = new Date();
  }

  for (const review of assistantReviews) {
    review.status = 'Validé RH';
    review.rh_validation_selected = false;
    review.rh_validated_at = new Date();
  }

  await Promise.all([
    ...reviews.map((review) => review.save()),
    ...assistantInstances.map((instance) => instance.save()),
    ...managerInstances.map((instance) => instance.save()),
    ...assistantReviews.map((review) => review.save()),
  ]);

  return response.json({
    message: 'Selection RH validée. Les évaluations sont maintenant dans les synthèses à transmettre.',
  });
}

async function getRhSyntheses(request, response) {
  const rhUserIds = await resolveRhQueueUserIds();
  const [rows, assistantRhRows, managerRhRows] = await Promise.all([
    loadRhReviewDataset(rhUserIds),
    loadAssistantRhSelfDataset(rhUserIds),
    loadManagerRhSelfDataset(rhUserIds),
  ]);
  const items = dedupeRhRowsByMember([...rows, ...assistantRhRows, ...managerRhRows]).filter((row) => row.status === 'Validé RH' || row.status === 'Clôture');

  return response.json({
    cycle_label: getCurrentCycleLabel(),
    items,
  });
}

async function submitRhSyntheses(request, response) {
  const rhUserIds = await resolveRhQueueUserIds();
  const [rows, assistantRhRows, managerRhRows] = await Promise.all([
    loadRhReviewDataset(rhUserIds),
    loadAssistantRhSelfDataset(rhUserIds),
    loadManagerRhSelfDataset(rhUserIds),
  ]);

  const readyRows = dedupeRhRowsByMember([...rows, ...assistantRhRows, ...managerRhRows]).filter((row) => row.status === 'Validé RH' || row.status === 'Clôture');

  if (!readyRows.length) {
    return response.json({
      message: "Aucune synthèse RH n'est disponible pour transmission à l'associé.",
      cycle_label: getCurrentCycleLabel(),
      items: [],
    });
  }

  const managerReviewIds = readyRows
    .filter((row) => !String(row.id || '').startsWith('assistant-rh:') && !String(row.id || '').startsWith('manager-self:'))
    .map((row) => row.id)
    .filter(Boolean);
  const assistantInstanceIds = readyRows
    .filter((row) => String(row.id || '').startsWith('assistant-rh:'))
    .map((row) => String(row.id || '').replace('assistant-rh:', ''))
    .filter(Boolean);
  const managerInstanceIds = readyRows
    .filter((row) => String(row.id || '').startsWith('manager-self:'))
    .map((row) => String(row.id || '').replace('manager-self:', ''))
    .filter(Boolean);

  await Promise.all([
    managerReviewIds.length
      ? ManagerMemberReview.updateMany(
          { _id: { $in: managerReviewIds } },
          { $set: { status: "Transmis à l'associé", submitted_at: new Date() } }
        )
      : Promise.resolve(),
    assistantInstanceIds.length
      ? EvaluationInstance.updateMany(
          { _id: { $in: assistantInstanceIds } },
          { $set: { status: "Transmis à l'associé", submitted_at: new Date() } }
        )
      : Promise.resolve(),
    managerInstanceIds.length
      ? EvaluationInstance.updateMany(
          { _id: { $in: managerInstanceIds } },
          { $set: { status: "Transmis à l'associé", submitted_at: new Date() } }
        )
      : Promise.resolve(),
  ]);

  const associateRecipients = await resolveAssociateRecipients();
  notifySubmissionRecipients({
    recipientIds: associateRecipients.map((recipient) => recipient._id),
    excludeUserId: request.user._id,
    submitterName: request.user.name,
    label: 'de nouvelles synthèses RH',
    cycleLabel: getCurrentCycleLabel(),
  });

  return response.json({
    message: "Les syntheses ont bien ete transmises à l'associé",
    cycle_label: getCurrentCycleLabel(),
    items: [],
  });
}

async function getRhQuestionnaire(request, response) {
  return response.json(buildQuestionnaireView());
}

async function createRhQuestionnaireSection(request, response) {
  const title = normalizeQuestionnaireText(request.body?.title);
  const sourceSheet = normalizeQuestionnaireText(request.body?.sourceSheet);
  const sectionKey = normalizeQuestionnaireText(request.body?.sectionKey);
  const audience = normalizeQuestionnaireText(request.body?.audience) || 'Selon matrice';

  if (!title || !sourceSheet || !sectionKey) {
    return response.status(400).json({
      message: "Le departement, le bloc de matrice et le titre de section sont obligatoires.",
    });
  }

  const config = readQuestionnaireConfig();
  const alreadyExistsInBase = (matrixData[sourceSheet] || []).some(
    (section) =>
      normalizeText(section.key) === normalizeText(sectionKey) &&
      (section.pages || []).some((page) => normalizeText(page.title) === normalizeText(title))
  );
  const alreadyExistsInCustom = (config.customPages || []).some(
    (page) =>
      normalizeText(page.source_sheet) === normalizeText(sourceSheet) &&
      normalizeText(page.section_key) === normalizeText(sectionKey) &&
      normalizeText(page.title) === normalizeText(title)
  );

  if (alreadyExistsInBase || alreadyExistsInCustom) {
    return response.status(400).json({
      message: "Cette section existe déjà pour ce département et ce bloc de matrice.",
    });
  }

  config.customPages.push({
    id: createQuestionnaireEntryId('custom-page'),
    source_sheet: sourceSheet,
    section_key: sectionKey,
    section_title: sectionKey,
    title,
    audience,
    themes: [],
  });

  writeQuestionnaireConfig(config);

  return response.json({
    message: "Section créée. Vous pouvez maintenant y ajouter des questions.",
    ...buildQuestionnaireView(),
  });
}

async function addRhQuestionnaireQuestion(request, response) {
  const sectionId = normalizeQuestionnaireText(request.body?.sectionId);
  const questionText = normalizeQuestionnaireText(request.body?.questionText);

  if (!sectionId || !questionText) {
    return response.status(400).json({
      message: "Sélectionnez une section et saisissez la question à ajouter.",
    });
  }

  const config = readQuestionnaireConfig();

  if (sectionId.startsWith('base::')) {
    const [, signature] = sectionId.split('base::');
    const [sourceSheet, sectionKey, pageTitleUpper] = String(signature || '').split('::');
    const baseSection = (matrixData[sourceSheet] || []).find(
      (section) => normalizeText(section.key) === normalizeText(sectionKey)
    );
    const basePage = (baseSection?.pages || []).find((page) => normalizeText(page.title) === pageTitleUpper);

    if (!baseSection || !basePage) {
      return response.status(404).json({ message: "Section cible introuvable dans la matrice." });
    }

    let targetAddition = (config.pageAdditions || []).find(
      (page) =>
        normalizeText(page.source_sheet) === normalizeText(sourceSheet) &&
        normalizeText(page.section_key) === normalizeText(sectionKey) &&
        normalizeText(page.page_title) === pageTitleUpper
    );

    if (!targetAddition) {
      targetAddition = {
        id: createQuestionnaireEntryId('addition'),
        source_sheet: sourceSheet,
        section_key: sectionKey,
        page_title: basePage.title,
        themes: [],
      };
      config.pageAdditions.push(targetAddition);
    }

    targetAddition.themes.push(createQuestionnaireTheme(questionText, targetAddition.themes.length));
  } else {
    const targetPage = (config.customPages || []).find((page) => page.id === sectionId);

    if (!targetPage) {
      return response.status(404).json({ message: "Section personnalisée introuvable." });
    }

    targetPage.themes.push(createQuestionnaireTheme(questionText, targetPage.themes.length));
  }

  writeQuestionnaireConfig(config);

  return response.json({
    message: "Question ajoutée à la section.",
    ...buildQuestionnaireView(),
  });
}

async function getMyRhSelfEvaluation(request, response) {
  const [instance, associateRecipients] = await Promise.all([
    getOrCreateRhSelfEvaluation(request.user),
    resolveAssociateRecipients(),
  ]);

  return response.json(buildRhSelfEvaluationPayload(instance, request.user, associateRecipients));
}

function getAssistantRhWorkflowConfig() {
  return {
    recipientRoleLabel: 'Responsable RH',
    submitButtonLabel: 'Soumettre à la RH',
    introMessage:
      "L'assistante RH s'auto-évalue sur son accompagnement du cycle, puis transmet son auto-évaluation à la RH.",
    titleLabel: 'Auto-évaluation Assistante RH',
    saveMessage: 'Auto-évaluation Assistante RH enregistrée.',
    readyMessage: 'Auto-évaluation Assistante RH prête pour soumission.',
    submittedMessage: 'Auto-évaluation Assistante RH soumise à la RH.',
    missingAnswersMessage: 'Toutes les questions Assistante RH doivent être renseignées avant soumission à la RH.',
  };
}

async function getAssistantRhMemberForRh(rhUser, memberId) {
  const selfEvaluation = await EvaluationInstance.findOne({
    evalue_id: memberId,
    cycle_label: getCurrentCycleLabel(),
    template_type: 'rh-assistant-self-evaluation',
    submitted_to_user_ids: rhUser._id,
  }).select('evalue_id status submitted_at sections');

  if (!selfEvaluation) {
    return null;
  }

  const member = await User.findOne({
    _id: memberId,
    is_active: true,
    $or: [{ department: CAPITAL_HUMAIN_DEPARTMENT_REGEX }, { department: RH_DEPARTMENT_REGEX }],
  }).select('_id name first_name last_name grade department code_categorie');

  if (!member) {
    return null;
  }

  return { member, selfEvaluation };
}

async function getOrCreateAssistantRhReview(rhUser, member) {
  let review = await ManagerMemberReview.findOne({
    cycle_label: getCurrentCycleLabel(),
    manager_id: rhUser._id,
    member_id: member._id,
    template_type: 'rh-assistant-evaluation',
  });

  const templateSections = cloneRhSelfTemplate(member);

  if (!review) {
    review = await ManagerMemberReview.create({
      cycle_label: getCurrentCycleLabel(),
      manager_id: rhUser._id,
      member_id: member._id,
      member_department: member.department || 'CAPITAL HUMAIN',
      status: 'En cours',
      template_type: 'rh-assistant-evaluation',
      submitted_to_user_ids: [rhUser._id],
      submitted_to_names: [rhUser.name],
      sections: toPersistenceSections(templateSections),
      last_saved_at: new Date(),
    });
  } else if (shouldResetToCurrentTemplate(review, templateSections)) {
    review.sections = toPersistenceSections(templateSections);
    review.last_saved_at = new Date();
    await review.save();
  }

  return review;
}

function buildAssistantRhReviewPayload(review, rhUser, member, selfEvaluation, associateRecipients = []) {
  const sections = normalizeSections(review.sections || []);
  const activeSection = sections.find((section) => section.status !== 'Complete') || sections[0] || null;
  const selfSections = normalizeSections(selfEvaluation?.sections || []);

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
    reviewer: {
      id: rhUser._id.toString(),
      name: rhUser.name,
      grade: rhUser.grade,
      department: rhUser.department,
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
    self_evaluation: {
      status: selfEvaluation?.status || 'En attente',
      submitted_at: selfEvaluation?.submitted_at || null,
      overallAverage: getOverallAverageScore(selfSections),
      sectionScores: selfSections
        .map((section) => ({
          sectionId: section.id,
          title: section.title,
          score: getAverageScore(section),
          percent: Math.round(((getAverageScore(section) || 0) / 5) * 100),
        }))
        .filter((item) => typeof item.score === 'number'),
      sectionComments: selfSections
        .filter((section) => String(section.comment || '').trim())
        .map((section) => ({
          sectionId: section.id,
          title: section.title,
          comment: String(section.comment || '').trim(),
        })),
    },
    submitted_to: associateRecipients.map((recipient) => ({
      id: recipient._id.toString(),
      name: recipient.name,
      department: recipient.department,
      grade: recipient.grade,
    })),
  };
}

async function getMyAssistantRhSelfEvaluation(request, response) {
  const [instance, rhRecipients] = await Promise.all([
    getOrCreateRhSelfEvaluation(request.user, {
      templateType: 'rh-assistant-self-evaluation',
      submittedToRole: 'rh',
    }),
    resolveFullRhRecipients(),
  ]);

  return response.json(buildRhSelfEvaluationPayload(instance, request.user, rhRecipients, getAssistantRhWorkflowConfig()));
}

async function getAssistantRhEvaluation(request, response) {
  const context = await getAssistantRhMemberForRh(request.user, request.params.memberId);

  if (!context) {
    return response.status(404).json({
      message: "Assistante RH introuvable pour cette RH.",
    });
  }

  const [review, associateRecipients] = await Promise.all([
    getOrCreateAssistantRhReview(request.user, context.member),
    resolveAssociateRecipients(),
  ]);

  return response.json(buildAssistantRhReviewPayload(review, request.user, context.member, context.selfEvaluation, associateRecipients));
}

async function saveMyRhSelfEvaluation(request, response) {
  const instance = await getOrCreateRhSelfEvaluation(request.user);
  const normalizedIncomingSections = normalizeSections(request.body?.sections || []);

  if (!normalizedIncomingSections.length) {
    return response.status(400).json({ message: "Aucune section RH à sauvegarder." });
  }

  instance.sections = toPersistenceSections(normalizedIncomingSections);
  instance.status = instance.status === 'Soumis aux Associés' ? instance.status : 'En cours';
  instance.last_saved_at = new Date();
  await instance.save();

  const associateRecipients = await resolveAssociateRecipients();

  return response.json({
    message: "Auto-évaluation RH enregistrée.",
    ...buildRhSelfEvaluationPayload(instance, request.user, associateRecipients),
  });
}

async function saveMyAssistantRhSelfEvaluation(request, response) {
  const instance = await getOrCreateRhSelfEvaluation(request.user, {
    templateType: 'rh-assistant-self-evaluation',
    submittedToRole: 'rh',
  });
  const normalizedIncomingSections = normalizeSections(request.body?.sections || []);

  if (!normalizedIncomingSections.length) {
    return response.status(400).json({ message: "Aucune section Assistante RH à sauvegarder." });
  }

  instance.sections = toPersistenceSections(normalizedIncomingSections);
  instance.status = 'En cours';
  instance.last_saved_at = new Date();
  await instance.save();

  const rhRecipients = await resolveFullRhRecipients();

  return response.json({
    message: 'Auto-évaluation Assistante RH enregistrée.',
    ...buildRhSelfEvaluationPayload(instance, request.user, rhRecipients, getAssistantRhWorkflowConfig()),
  });
}

async function saveAssistantRhEvaluation(request, response) {
  const context = await getAssistantRhMemberForRh(request.user, request.params.memberId);

  if (!context) {
    return response.status(404).json({
      message: "Assistante RH introuvable pour cette RH.",
    });
  }

  const review = await getOrCreateAssistantRhReview(request.user, context.member);
  const normalizedIncomingSections = normalizeSections(request.body?.sections || []);

  if (!normalizedIncomingSections.length) {
    return response.status(400).json({ message: "Les sections de l'evaluation RH sont requises." });
  }

  review.sections = toPersistenceSections(normalizedIncomingSections);
  review.status = 'En cours';
  review.last_saved_at = new Date();
  await review.save();

  const associateRecipients = await resolveAssociateRecipients();

  return response.json({
    message: "Evaluation RH enregistrée.",
    ...buildAssistantRhReviewPayload(review, request.user, context.member, context.selfEvaluation, associateRecipients),
  });
}

async function submitMyRhSelfEvaluation(request, response) {
  const instance = await getOrCreateRhSelfEvaluation(request.user);
  const normalizedSections = normalizeSections(instance.sections || []);
  const missingAnswers = validateSectionsForSubmit(normalizedSections);

  if (missingAnswers.length) {
    return response.status(400).json({
      message: "Toutes les questions RH doivent etre renseignées avant soumission aux associés.",
      missingAnswers,
    });
  }

  const missingSectionComments = validateSectionCommentsForSubmit(normalizedSections, 3);

  if (missingSectionComments.length) {
    return response.status(400).json({
      message: "Un commentaire de section d'au moins 3 caractères est obligatoire pour chaque section avant soumission.",
      missingSectionComments,
    });
  }

  const associateRecipients = await resolveAssociateRecipients();

  if (!associateRecipients.length) {
    return response.status(400).json({
      message: "Aucun associé actif n'est disponible pour recevoir cette auto-évaluation RH.",
    });
  }

  instance.status = 'Soumis aux Associés';
  instance.submitted_to_role = 'associate';
  instance.submitted_to_user_ids = associateRecipients.map((recipient) => recipient._id);
  instance.submitted_to_names = associateRecipients.map((recipient) => recipient.name);
  instance.submitted_at = new Date();
  instance.last_saved_at = new Date();
  await instance.save();

  notifySubmissionRecipients({
    recipientIds: instance.submitted_to_user_ids,
    excludeUserId: request.user._id,
    submitterName: request.user.name,
    label: 'son auto-évaluation RH',
    cycleLabel: getCurrentCycleLabel(),
  });

  return response.json({
    message: "Auto-évaluation RH soumise aux associés.",
    ...buildRhSelfEvaluationPayload(instance, request.user, associateRecipients),
  });
}

async function submitMyRhSelfMissionEvaluation(request, response) {
  const missionId = String(request.body?.missionId || '').trim();

  if (!missionId) {
    return response.status(400).json({
      message: 'La mission RH a soumettre est requise.',
    });
  }

  const instance = await getOrCreateRhSelfEvaluation(request.user);
  const missionEvaluations = normalizeRhMissionEvaluations(instance.mission_evaluations || []);
  const mission = missionEvaluations.find((item) => item.mission_id === missionId);

  if (!mission) {
    return response.status(404).json({
      message: 'Mission RH introuvable.',
    });
  }

  const hasIncompleteCriterion = (mission.criteria || []).some(
    (criterion) => criterion.score === null || criterion.score === undefined
  );

  if (hasIncompleteCriterion) {
    return response.status(400).json({
      message: 'Toutes les questions de la mission RH doivent être renseignées avant soumission aux associés.',
    });
  }

  const associateRecipients = await resolveAssociateRecipients();

  if (!associateRecipients.length) {
    return response.status(400).json({
      message: "Aucun associé actif n'est disponible pour recevoir cette mission RH.",
    });
  }

  mission.primary_recipient_user_id = associateRecipients[0]?._id || null;
  mission.primary_recipient_name = associateRecipients[0]?.name || '';
  mission.primary_recipient_grade = associateRecipients[0]?.grade || '';
  mission.primary_recipient_department = associateRecipients[0]?.department || '';
  mission.recipients = associateRecipients.map((recipient) => ({
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

  notifySubmissionRecipients({
    recipientIds: associateRecipients.map((recipient) => recipient._id),
    excludeUserId: request.user._id,
    submitterName: request.user.name,
    label: `la mission RH "${mission.title}"`,
    cycleLabel: getCurrentCycleLabel(),
  });

  return response.json({
    message: `Mission RH soumise a ${associateRecipients.map((recipient) => recipient.name).join(', ')}.`,
    ...buildRhSelfEvaluationPayload(instance, request.user, associateRecipients),
  });
}

async function submitMyAssistantRhSelfEvaluation(request, response) {
  const instance = await getOrCreateRhSelfEvaluation(request.user, {
    templateType: 'rh-assistant-self-evaluation',
    submittedToRole: 'rh',
  });
  const normalizedSections = normalizeSections(instance.sections || []);
  const missingAnswers = validateSectionsForSubmit(normalizedSections);

  if (missingAnswers.length) {
    return response.status(400).json({
      message: 'Toutes les questions Assistante RH doivent être renseignées avant soumission à la RH.',
      missingAnswers,
    });
  }

  const missingSectionComments = validateSectionCommentsForSubmit(normalizedSections, 3);

  if (missingSectionComments.length) {
    return response.status(400).json({
      message: "Un commentaire de section d'au moins 3 caractères est obligatoire pour chaque section avant soumission.",
      missingSectionComments,
    });
  }

  const rhRecipients = await resolveFullRhRecipients();

  if (!rhRecipients.length) {
    return response.status(400).json({
      message: "Aucune RH active n'est disponible pour recevoir cette auto-évaluation Assistante RH.",
    });
  }

  instance.status = 'Soumis à la RH';
  instance.submitted_to_role = 'rh';
  instance.submitted_to_user_ids = rhRecipients.map((recipient) => recipient._id);
  instance.submitted_to_names = rhRecipients.map((recipient) => recipient.name);
  instance.rh_validation_selected = true;
  instance.rh_validation_selected_at = new Date();
  instance.submitted_at = new Date();
  instance.last_saved_at = new Date();
  await instance.save();

  notifySubmissionRecipients({
    recipientIds: instance.submitted_to_user_ids,
    excludeUserId: request.user._id,
    submitterName: request.user.name,
    label: 'son auto-évaluation Assistante RH',
    cycleLabel: getCurrentCycleLabel(),
  });

  return response.json({
    message: 'Auto-évaluation Assistante RH soumise à la RH.',
    ...buildRhSelfEvaluationPayload(instance, request.user, rhRecipients, getAssistantRhWorkflowConfig()),
  });
}

async function submitAssistantRhEvaluation(request, response) {
  const context = await getAssistantRhMemberForRh(request.user, request.params.memberId);

  if (!context) {
    return response.status(404).json({
      message: "Assistante RH introuvable pour cette RH.",
    });
  }

  const review = await getOrCreateAssistantRhReview(request.user, context.member);
  const normalizedSections = normalizeSections(review.sections || []);
  const missingAnswers = validateSectionsForSubmit(normalizedSections);

  if (missingAnswers.length) {
    return response.status(400).json({
      message: "Toutes les questions de l'evaluation RH doivent être renseignées avant validation.",
      missingAnswers,
    });
  }

  const missingReviewSectionComments = validateSectionCommentsForSubmit(normalizedSections, 3);

  if (missingReviewSectionComments.length) {
    return response.status(400).json({
      message: "Un commentaire de section d'au moins 3 caractères est obligatoire pour chaque section avant soumission.",
      missingSectionComments: missingReviewSectionComments,
    });
  }

  review.status = 'Soumis à la RH';
  review.submitted_to_user_ids = [request.user._id];
  review.submitted_to_names = [request.user.name];
  review.rh_validation_selected = true;
  review.rh_validation_selected_at = new Date();
  review.submitted_at = new Date();
  review.last_saved_at = new Date();
  await review.save();

  const associateRecipients = await resolveAssociateRecipients();

  return response.json({
    message: "Evaluation RH de l'assistante RH enregistrée dans la file de validation.",
    ...buildAssistantRhReviewPayload(review, request.user, context.member, context.selfEvaluation, associateRecipients),
  });
}

async function getRhCalibration(request, response) {
  const rows = await loadRhReviewDataset(await resolveRhQueueUserIds());
  const departmentGroups = buildDepartmentGroups(rows);

  const items = departmentGroups.map((group) => {
    const completedCount = group.members.filter((member) => typeof member.finalScore === 'number').length;
    const totalCount = group.members.length;
    const average = typeof group.average === 'number' ? group.average : null;

    let risk = 'Sous-documentation';
    if (typeof average === 'number' && average >= 4) risk = 'Tendance haute';
    else if (typeof average === 'number' && average >= 3.5) risk = 'Stable';
    else if (typeof average === 'number' && average >= 3) risk = 'A harmoniser';

    return {
      department: group.department,
      average,
      evaluated: `${completedCount}/${totalCount}`,
      risk,
      width: typeof average === 'number' ? `${Math.max(Math.min((average / 5) * 100, 100), 0)}%` : '0%',
    };
  });

  return response.json({
    cycle_label: getCurrentCycleLabel(),
    items,
  });
}

function isRhDepartment(department = '') {
  const normalized = normalizeText(department);
  return normalized === 'RH' || normalized === 'CAPITAL HUMAIN';
}

function getPopulationGroupKey(role = '', department = '') {
  if (isRhDepartment(department)) return 'RH / Capital Humain';

  const normalized = normalizeText(role);
  if (normalized === 'ASSOCIE' || normalized === 'ASSOCIEE' || normalized.includes('ASSOCI')) return 'Associes';
  if (normalized === 'MANAGER' || normalized === 'SENIOR MANAGER') return 'Managers';
  if (normalized === 'SENIOR' || normalized === 'ASSISTANT MANAGER') return 'Seniors';
  return 'Assistants';
}

async function getRhPopulation(request, response) {
  const rows = await loadRhReviewDataset(await resolveRhQueueUserIds());
  const groupsMap = new Map([
    ['RH / Capital Humain', { group: 'RH / Capital Humain', members: [] }],
    ['Associes', { group: 'Associes', members: [] }],
    ['Managers', { group: 'Managers', members: [] }],
    ['Seniors', { group: 'Seniors', members: [] }],
    ['Assistants', { group: 'Assistants', members: [] }],
  ]);

  rows.forEach((row) => {
    const key = getPopulationGroupKey(row.role, row.department);
    groupsMap.get(key).members.push({
      id: row.id,
      memberId: row.memberId,
      name: row.name,
      grade: row.role,
      department: row.department,
      role: `${row.role} ${formatDepartmentLabel(row.department).toLowerCase()}`.trim(),
      status: row.displayStatus,
      score: row.finalScore,
    });
  });

  const groups = Array.from(groupsMap.values()).map((group) => {
    const tracksEvaluations = group.group !== 'Associes';
    const completed = group.members.filter((member) => typeof member.score === 'number').length;
    const total = group.members.length;
    return {
      group: group.group,
      total,
      completed: tracksEvaluations ? completed : null,
      missing: tracksEvaluations ? Math.max(total - completed, 0) : null,
      tracksEvaluations,
      members: group.members.sort((left, right) => left.name.localeCompare(right.name, 'fr', { sensitivity: 'base' })),
    };
  });

  return response.json({
    cycle_label: getCurrentCycleLabel(),
    groups,
  });
}

function resolveAllowedGrade(rawGrade = '') {
  const grade = normalizeUserText(rawGrade);

  if (ALLOWED_GRADES.includes(grade)) {
    return grade;
  }

  const normalizedGrade = normalizeText(grade);
  if (normalizedGrade === 'ASSOCIE' || normalizedGrade.includes('ASSOCI')) {
    return ALLOWED_GRADES.find((allowedGrade) => normalizeText(allowedGrade).includes('ASSOCI')) || null;
  }

  return null;
}

async function updateRhUserCareer(request, response) {
  if (!isRhDepartment(request.user?.department)) {
    return response.status(403).json({
      message: "Seule la RH / l'assistante RH peut modifier le grade et le département.",
    });
  }

  const targetUser = await User.findById(request.params.memberId);

  if (!targetUser || !targetUser.is_active) {
    return response.status(404).json({
      message: 'Utilisateur introuvable.',
    });
  }

  const grade = resolveAllowedGrade(request.body?.grade);
  const department = normalizeUserDepartment(request.body?.department);

  if (!grade || !department) {
    return response.status(400).json({
      message: 'Grade et département sont requis.',
    });
  }

  targetUser.grade = grade;
  targetUser.code_categorie = getCategoryFromGrade(grade);
  targetUser.department = department;

  await targetUser.save();

  return response.json({
    message: 'Grade et département mis à jour.',
    user: targetUser.toSafeObject(),
  });
}

function escapeCsvValue(value) {
  const normalized = value === null || value === undefined ? '' : String(value);
  if (/[",\n;]/.test(normalized)) {
    return `"${normalized.replace(/"/g, '""')}"`;
  }
  return normalized;
}

function buildCsvBuffer(headers = [], rows = []) {
  const lines = [
    headers.map(escapeCsvValue).join(';'),
    ...rows.map((row) => row.map(escapeCsvValue).join(';')),
  ];
  return Buffer.from(lines.join('\n'), 'utf8');
}

function escapePdfText(value = '') {
  return String(value).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

function buildSimplePdfBuffer(title, lines = []) {
  const pageHeight = 842;
  const startY = 790;
  const lineHeight = 16;
  const contentLines = [
    'BT',
    '/F1 18 Tf',
    `50 ${startY} Td`,
    `(${escapePdfText(title)}) Tj`,
    '/F1 10 Tf',
  ];

  lines.forEach((line, index) => {
    const offset = index === 0 ? 28 : lineHeight;
    contentLines.push(`0 -${offset} Td`);
    contentLines.push(`(${escapePdfText(line)}) Tj`);
  });

  contentLines.push('ET');
  const content = contentLines.join('\n');
  const objects = [
    '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n',
    '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n',
    `3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 ${pageHeight}] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>\nendobj\n`,
    '4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n',
    `5 0 obj\n<< /Length ${Buffer.byteLength(content, 'utf8')} >>\nstream\n${content}\nendstream\nendobj\n`,
  ];

  let body = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((object) => {
    offsets.push(Buffer.byteLength(body, 'utf8'));
    body += object;
  });

  const xrefOffset = Buffer.byteLength(body, 'utf8');
  body += `xref\n0 ${objects.length + 1}\n`;
  body += '0000000000 65535 f \n';
  offsets.slice(1).forEach((offset) => {
    body += `${String(offset).padStart(10, '0')} 00000 n \n`;
  });
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  return Buffer.from(body, 'utf8');
}

async function buildRhReportExport(reportId, request) {
  const fmt = String(request.query?.format || '').toLowerCase();
  const [syntheses, validations, calibration, population] = await Promise.all([
    getRhSyntheses(request, { json: (data) => data }),
    getRhValidations(request, { json: (data) => data }),
    getRhCalibration(request, { json: (data) => data }),
    getRhPopulation(request, { json: (data) => data }),
  ]);

  if (reportId === 'rh-synthese-validee') {
    const pdfLines = syntheses.items.length
      ? syntheses.items.map(
          (item) =>
            `${item.name} | ${item.role} | Score final: ${item.finalScore ?? 'N/A'} | Recommandation: ${item.displayStatus || 'N/A'}`
        )
      : ['Aucune synthèse RH validée disponible pour le moment.'];

    if (fmt === 'csv') {
      const rows = syntheses.items.map((item) => [
        item.name,
        item.role,
        formatDepartmentLabel(item.department),
        item.finalScore ?? '',
        item.displayStatus || '',
      ]);
      return {
        filename: 'synthese-rh-validee-cycle-2026.csv',
        contentType: 'text/csv; charset=utf-8',
        buffer: buildCsvBuffer(['Collaborateur', 'Role', 'Departement', 'Score final', 'Recommandation'], rows),
      };
    }

    return {
      filename: 'synthese-rh-validee-cycle-2026.pdf',
      contentType: 'application/pdf',
      buffer: buildSimplePdfBuffer('Synthese RH validée - Cycle 2026', pdfLines),
    };
  }

  if (reportId === 'rh-validations') {
    const csvRows = validations.items.map((item) => [
      item.name,
      item.role,
      formatDepartmentLabel(item.department),
      item.managerName,
      item.selfScore ?? '',
      item.managerScore ?? '',
      item.finalScore ?? '',
      item.displayStatus,
    ]);
    const csvHeaders = ['Collaborateur', 'Role', 'Departement', 'Manager', 'Auto-evaluation', 'Evaluation manager', 'Score final', 'Statut'];

    if (fmt === 'pdf') {
      const pdfLines = validations.items.length
        ? validations.items.map(
            (item) =>
              `${item.name} | ${item.role} | Score: ${item.finalScore ?? 'N/A'} | ${item.displayStatus}`
          )
        : ['Aucune validation RH disponible pour le moment.'];
      return {
        filename: 'file-validations-rh-cycle-2026.pdf',
        contentType: 'application/pdf',
        buffer: buildSimplePdfBuffer('File de validations RH - Cycle 2026', pdfLines),
      };
    }

    return {
      filename: 'file-validations-rh-cycle-2026.csv',
      contentType: 'text/csv; charset=utf-8',
      buffer: buildCsvBuffer(csvHeaders, csvRows),
    };
  }

  if (reportId === 'rh-calibration') {
    const pdfLines = calibration.items.length
      ? calibration.items.map(
          (item) => `${item.department} | Moyenne: ${item.average ?? 'N/A'} | Evalues: ${item.evaluated} | Risque: ${item.risk}`
        )
      : ['Aucune calibration disponible pour le moment.'];

    if (fmt === 'csv') {
      const rows = calibration.items.map((item) => [
        item.department,
        item.average ?? '',
        item.evaluated ?? '',
        item.risk ?? '',
      ]);
      return {
        filename: 'calibration-departements-cycle-2026.csv',
        contentType: 'text/csv; charset=utf-8',
        buffer: buildCsvBuffer(['Departement', 'Moyenne', 'Evalues', 'Risque'], rows),
      };
    }

    return {
      filename: 'calibration-departements-cycle-2026.pdf',
      contentType: 'application/pdf',
      buffer: buildSimplePdfBuffer('Calibration des departements - Cycle 2026', pdfLines),
    };
  }

  if (reportId === 'rh-population') {
    const csvRows = population.groups.flatMap((group) =>
      (group.members || []).map((member) => [group.group, member.name, member.role, member.status, member.score ?? ''])
    );

    if (fmt === 'pdf') {
      const pdfLines = population.groups.flatMap((group) =>
        (group.members || []).map((member) => `[${group.group}] ${member.name} | ${member.role} | ${member.status} | Score: ${member.score ?? 'N/A'}`)
      );
      return {
        filename: 'suivi-population-cycle-2026.pdf',
        contentType: 'application/pdf',
        buffer: buildSimplePdfBuffer('Cycle de population suivi 2026', pdfLines.length ? pdfLines : ['Aucune donnee disponible.']),
      };
    }

    return {
      filename: 'suivi-population-cycle-2026.csv',
      contentType: 'text/csv; charset=utf-8',
      buffer: buildCsvBuffer(['Groupe', 'Nom', 'Role', 'Statut', 'Score'], csvRows),
    };
  }

  return null;
}

async function getRhReports(request, response) {
  const [syntheses, validations, calibration, population] = await Promise.all([
    getRhSyntheses(request, { json: (data) => data }),
    getRhValidations(request, { json: (data) => data }),
    getRhCalibration(request, { json: (data) => data }),
    getRhPopulation(request, { json: (data) => data }),
  ]);

  return response.json({
    cycle_label: getCurrentCycleLabel(),
    exports: [
      {
        id: 'rh-synthese-validee',
        title: 'Synthèse RH validée',
        format: 'PDF',
        availableFormats: ['PDF', 'CSV'],
        owner: 'RH',
        status: syntheses.items.length ? 'Pret' : 'A generer',
        downloadable: true,
      },
      {
        id: 'rh-validations',
        title: 'File de validations RH',
        format: 'CSV',
        availableFormats: ['CSV', 'PDF'],
        owner: 'RH',
        status: validations.items.length ? 'Pret' : 'A generer',
        downloadable: true,
      },
      {
        id: 'rh-calibration',
        title: 'Calibration des departements',
        format: 'PDF',
        availableFormats: ['PDF', 'CSV'],
        owner: 'RH',
        status: calibration.items.length ? 'Pret' : 'A generer',
        downloadable: true,
      },
      {
        id: 'rh-population',
        title: 'Cycle de population suivi 2026',
        format: 'CSV',
        availableFormats: ['CSV', 'PDF'],
        owner: 'RH',
        status: population.groups.length ? 'Pret' : 'A generer',
        downloadable: true,
      },
    ],
  });
}

async function downloadRhReport(request, response) {
  const reportId = String(request.params.reportId || '').trim();
  const file = await buildRhReportExport(reportId, request);

  if (!file) {
    return response.status(404).json({
      message: 'Rapport RH introuvable.',
    });
  }

  response.setHeader('Content-Type', file.contentType);
  response.setHeader('Content-Disposition', `attachment; filename="${file.filename}"`);
  return response.send(file.buffer);
}

async function getMyRhEvaluationHistory(request, response) {
  const resolved = resolveTemplateTypeForUser(request.user, { supportEmails: SUPPORT_EMAILS });

  if (!resolved) {
    return response.json({ cycles: [] });
  }

  const instances = await EvaluationInstance.find({
    evalue_id: request.user._id,
    template_type: resolved.templateType,
    cycle_label: { $ne: getCurrentCycleLabel() },
  }).sort({ cycle_label: -1 });

  const cycles = await buildCyclesForInstances(instances, resolved.kind, () => Promise.resolve([]));

  return response.json({ cycles });
}

async function listAllMembersForRh(request, response) {
  const members = await User.find({
    is_active: true,
    _id: { $ne: request.user._id },
  })
    .sort({ last_name: 1, first_name: 1 })
    .select('_id name first_name last_name grade department code_categorie email');

  return response.json({
    cycle_label: getCurrentCycleLabel(),
    members: members.map((member) => ({
      id: member._id.toString(),
      name: member.name,
      grade: SUPPORT_EMAILS.includes(normalizeEmail(member.email || '')) ? getSupportRoleLabel(member) : member.grade,
      department: member.department,
      code_categorie: member.code_categorie,
    })),
  });
}

async function getRhTeamMemberHistory(request, response) {
  const member = await User.findOne({ _id: request.params.memberId, is_active: true })
    .select('_id name grade email code_categorie department');

  if (!member) {
    return response.status(404).json({ message: 'Membre introuvable.' });
  }

  const resolved = resolveTemplateTypeForUser(member, { supportEmails: SUPPORT_EMAILS });

  if (!resolved) {
    return response.status(404).json({ message: 'Historique indisponible pour ce membre.' });
  }

  const { templateType, kind } = resolved;

  const instances = await EvaluationInstance.find({
    evalue_id: member._id,
    template_type: templateType,
    cycle_label: { $ne: getCurrentCycleLabel() },
  }).sort({ cycle_label: -1 });

  const getComments = templateType === 'manager-self-evaluation'
    ? (cycleLabel) => fetchAssociateCommentsForManager(cycleLabel, member._id)
    : templateType === 'support-self-evaluation' || templateType === 'associate-self-evaluation'
      ? (_cycleLabel, instance) => Promise.resolve(buildPeerReviewComments(instance))
      : templateType === 'rh-self-evaluation' || templateType === 'rh-assistant-self-evaluation'
        ? () => Promise.resolve([])
        : (cycleLabel) => fetchManagerCommentsForMember(cycleLabel, member._id);

  const cycles = await buildCyclesForInstances(instances, kind, getComments);

  return response.json({
    cycles,
    member: {
      id: member._id.toString(),
      name: member.name,
      grade: SUPPORT_EMAILS.includes(normalizeEmail(member.email || '')) ? getSupportRoleLabel(member) : member.grade,
    },
  });
}

function serializeCycle(cycle) {
  return {
    id: cycle._id.toString(),
    label: cycle.label,
    start_date: cycle.start_date,
    end_date: cycle.end_date,
    is_active: cycle.is_active,
  };
}

async function getRhCycles(_request, response) {
  const cycles = await Cycle.find().sort({ start_date: -1 });

  return response.json({ cycles: cycles.map(serializeCycle) });
}

async function createRhCycle(request, response) {
  const startDate = new Date(request.body?.start_date);
  const endDate = new Date(request.body?.end_date);

  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    return response.status(400).json({ message: 'Veuillez renseigner une date de début et une date de fin valides.' });
  }

  if (startDate >= endDate) {
    return response.status(400).json({ message: 'La date de début doit être antérieure à la date de fin.' });
  }

  const label = `Cycle ${startDate.getFullYear()}-${endDate.getFullYear()}`;

  try {
    await Cycle.updateMany({ is_active: true }, { is_active: false });
    const cycle = await Cycle.create({
      label,
      start_date: startDate,
      end_date: endDate,
      is_active: true,
    });

    activateCycle(cycle);

    return response.status(201).json({ cycle: serializeCycle(cycle) });
  } catch (error) {
    if (error?.code === 11000) {
      return response.status(409).json({ message: 'Un cycle avec ce libellé existe déjà.' });
    }

    throw error;
  }
}

async function getMyAssistantRhEvaluationResult(request, response) {
  try {
  const review = await ManagerMemberReview.findOne({
    member_id: request.user._id,
    cycle_label: getCurrentCycleLabel(),
    template_type: 'rh-assistant-evaluation',
  }).populate('manager_id', 'name grade department');

  if (!review) {
    const anyReview = await ManagerMemberReview.findOne({ member_id: request.user._id }).select('template_type cycle_label status');
    console.log('[getMyAssistantRhEvaluationResult] member_id:', request.user._id, '| no rh-assistant-evaluation review found | other reviews:', anyReview ? JSON.stringify({ template_type: anyReview.template_type, cycle_label: anyReview.cycle_label, status: anyReview.status }) : 'none');
    return response.json({ result: null });
  }

  const sections = normalizeSections(review.sections || []);

  const sectionScores = sections.map((section) => ({
    sectionId: section.id,
    title: section.title,
    average: getAverageScore(section),
    comment: String(section.comment || '').trim(),
    pages: (section.pages || []).map((page) => ({
      title: page.title,
      average: (() => {
        const scores = (page.themes || []).map((t) => t.score).filter((s) => typeof s === 'number');
        return scores.length ? Number((scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(2)) : null;
      })(),
    })),
  }));

  const reviewer = review.manager_id
    ? { name: review.manager_id.name, grade: review.manager_id.grade, department: review.manager_id.department }
    : null;

  return response.json({
    result: {
      status: review.status,
      submitted_at: review.submitted_at,
      last_saved_at: review.last_saved_at,
      overallAverage: getOverallAverageScore(sections),
      sectionScores,
      reviewer,
    },
  });
  } catch (err) {
    console.error('[getMyAssistantRhEvaluationResult] error:', err);
    return response.status(500).json({ message: err.message || 'Erreur interne.', result: null });
  }
}

async function getRhReceivedChiefComments(request, response) {
  const userId = String(request.user._id);
  const instances = await EvaluationInstance.find({
    cycle_label: getCurrentCycleLabel(),
    'chief_comments.target_user_id': request.user._id,
  }).select('chief_comments');

  const received = [];
  for (const instance of instances) {
    for (const comment of instance.chief_comments || []) {
      if (
        String(comment.target_user_id) === userId &&
        comment.submitted_at &&
        String(comment.comment || '').trim()
      ) {
        received.push({
          comment: String(comment.comment).trim(),
          submittedAt: comment.submitted_at,
        });
      }
    }
  }

  received.sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));
  return response.json({ received });
}

module.exports = {
  addRhQuestionnaireQuestion,
  buildNonRhDepartmentClause,
  createRhCycle,
  createRhQuestionnaireSection,
  downloadRhReport,
  formatDepartmentLabel,
  getAssistantRhEvaluation,
  getRhCalibration,
  getRhCycles,
  getRhDepartmentEvaluationDetail,
  getRhDepartmentEvaluations,
  getMyAssistantRhSelfEvaluation,
  getMyRhEvaluationHistory,
  getRhQuestionnaire,
  getMyRhSelfEvaluation,
  getMyAssistantRhEvaluationResult,
  getRhOverview,
  getRhReceivedChiefComments,
  getRhPopulation,
  getRhReports,
  getRhSyntheses,
  getRhTeamMemberHistory,
  getRhValidations,
  listAllMembersForRh,
  loadAssistantRhSelfDataset,
  loadRhReviewDataset,
  RH_RELEVANT_STATUSES,
  resolveRhQueueUserIds,
  saveAssistantRhEvaluation,
  saveMyAssistantRhSelfEvaluation,
  saveMyRhSelfEvaluation,
  selectRhDepartmentEvaluation,
  SUPPORT_EMAILS,
  submitAssistantRhEvaluation,
  submitMyAssistantRhSelfEvaluation,
  submitMyRhSelfMissionEvaluation,
  submitMyRhSelfEvaluation,
  submitRhSyntheses,
  updateRhUserCareer,
  validateRhSelection,
};
