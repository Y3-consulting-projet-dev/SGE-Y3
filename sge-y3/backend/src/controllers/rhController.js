const User = require('../models/User');
const EvaluationInstance = require('../models/EvaluationInstance');
const ManagerMemberReview = require('../models/ManagerMemberReview');
const SeniorAssistantReview = require('../models/SeniorAssistantReview');
const matrixData = require('../data/competencyMatrix.generated.json');
const { buildEvaluationTemplateForUser } = require('../utils/competencyMatrix');
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
  normalizeSections,
  validateFinalCommentForSubmit,
  validateSectionCommentsForSubmit,
  validateSectionsForSubmit,
} = require('../utils/evaluationHelpers');

const CURRENT_CYCLE_LABEL = 'Cycle 2025-2026';
const RH_RELEVANT_STATUSES = ['Soumis a RH', 'Valide RH', 'Cloture'];
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
const FULL_RH_EMAILS = ['isabella.beda@ycubeac.com'];
const RH_DEPARTMENT_REGEX = /^RH$/i;
const CAPITAL_HUMAIN_DEPARTMENT_REGEX = /^CAPITAL HUMAIN$/i;

function normalizeText(value = '') {
  return String(value || '').replace(/\s+/g, ' ').trim().toUpperCase();
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
  if (normalized === 'CAPITAL HUMAIN') return 'Capital humain';

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

function buildRhMissionCriteria(sections = []) {
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

function normalizeRhMissionEvaluations(missionEvaluations = []) {
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

function formatRhMissionEvaluations(missionEvaluations = []) {
  return missionEvaluations.map((mission) => ({
    id: mission.mission_id,
    title: mission.title,
    period: mission.period,
    department: mission.department,
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
      label: criterion.label,
      statement: criterion.statement,
      score: criterion.score,
    })),
    comment: mission.comment || '',
    status: mission.status || 'Brouillon',
    submittedAt: mission.submitted_at || null,
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
      { email: { $in: FULL_RH_EMAILS } },
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
    cycle_label: CURRENT_CYCLE_LABEL,
    template_type: templateType,
  });

  const templateSections = cloneRhSelfTemplate(user);

  if (!instance) {
    instance = await EvaluationInstance.create({
      cycle_label: CURRENT_CYCLE_LABEL,
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
  const missionEvaluations = formatRhMissionEvaluations(normalizeRhMissionEvaluations(instance.mission_evaluations || []));

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
      recipientRoleLabel: workflow.recipientRoleLabel || 'Associe',
      submitButtonLabel: workflow.submitButtonLabel || 'Soumettre aux associes',
      introMessage:
        workflow.introMessage ||
        "La RH s'auto-evalue sur la conduite du cycle, puis transmet son auto-evaluation aux associes.",
      titleLabel: workflow.titleLabel || 'Auto-evaluation RH',
      saveMessage: workflow.saveMessage || 'Auto-evaluation RH enregistree.',
      readyMessage: workflow.readyMessage || 'Auto-evaluation RH prete pour soumission.',
      submittedMessage: workflow.submittedMessage || 'Auto-evaluation RH soumise aux associes.',
      missingAnswersMessage:
        workflow.missingAnswersMessage || 'Toutes les questions RH doivent etre renseignees avant soumission aux associes.',
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
    return 'A completer';
  }

  return 'À valider RH';
}

function getRhDisplayStatus(review, unjustifiedLowScores, finalScore) {
  if (review.status === 'Cloture' || review.status === 'Valide RH') return 'Valide';
  if (review.status === 'Soumis a RH') return 'À valider RH';
  if (review.rh_validation_selected) return 'À valider RH';
  return getPriorityStatus(finalScore, unjustifiedLowScores);
}

function getAssistantRhDisplayStatus(instance) {
  if (instance.status === 'Cloture' || instance.status === 'Valide RH') return 'Valide';
  if (instance.rh_validation_selected) return 'À valider RH';
  if (instance.status === 'Soumis a RH') return 'À valider RH';
  return 'En attente';
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
  missionTitle = '',
  score = null,
  submittedAt = null,
}) {
  return {
    source,
    evaluatorName,
    evaluatorGrade,
    missionTitle,
    score,
    submittedAt,
  };
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
    ? `Evaluateur : ${managerName}. Les scores sont consultables par la RH pour verifier la coherence de l'evaluation.`
    : "Les scores sont consultables par la RH pour verifier la coherence de l'evaluation.";
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
  };
}

async function loadRhReviewDataset(rhUserIds) {
  const recipientIds = Array.isArray(rhUserIds) ? rhUserIds.filter(Boolean) : [rhUserIds].filter(Boolean);
  const reviews = await ManagerMemberReview.find({
    cycle_label: CURRENT_CYCLE_LABEL,
    submitted_to_user_ids: { $in: recipientIds },
  }).select(
    'member_id manager_id member_department status submitted_at sections mission_reviews rh_validation_selected rh_validation_selected_at rh_validated_at'
  );

  const memberIds = reviews.map((review) => review.member_id).filter(Boolean);
  const managerIds = reviews.map((review) => review.manager_id).filter(Boolean);
  const seniorReviews = memberIds.length
    ? await SeniorAssistantReview.find({
        cycle_label: CURRENT_CYCLE_LABEL,
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
      ...buildNonRhDepartmentClause(),
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
      cycle_label: CURRENT_CYCLE_LABEL,
      template_type: getExpectedTemplateType(member),
    }));

  const selfEvaluations = selfEvaluationQueries.length
    ? await EvaluationInstance.find({ $or: selfEvaluationQueries }).select('evalue_id sections mission_evaluations submitted_at')
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
      'Auto-evaluation',
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

    if (selfEvaluation?.submitted_at && typeof selfScore === 'number') {
      globalScoreDetails.push(
        buildScoreDetail({
          source: 'Auto-evaluation',
          evaluatorName: fallbackMember?.name || 'Collaborateur',
          evaluatorGrade: fallbackMember?.grade || 'Collaborateur',
          score: selfScore,
          submittedAt: selfEvaluation.submitted_at || null,
        })
      );
    }

    (selfEvaluation?.mission_evaluations || []).forEach((mission) => {
      const score = getMissionAverage(mission.criteria || []);
      if (mission.status === 'Soumise' && typeof score === 'number') {
        missionScoreDetails.push(
          buildScoreDetail({
            source: 'Auto-evaluation',
            evaluatorName: fallbackMember?.name || 'Collaborateur',
            evaluatorGrade: fallbackMember?.grade || 'Collaborateur',
            missionTitle: mission.title,
            score,
            submittedAt: mission.submitted_at || null,
          })
        );
      }
    });

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

      (seniorReview.mission_reviews || []).forEach((missionReview) => {
        const score = getMissionAverage(missionReview.criteria || []);
        if (missionReview.status === 'Transmise' && typeof score === 'number') {
          missionScoreDetails.push(
            buildScoreDetail({
              source: 'Senior',
              evaluatorName: seniorUser?.name || 'Senior',
              evaluatorGrade: seniorUser?.grade || 'Senior',
              missionTitle: missionReview.title,
              score,
              submittedAt: missionReview.submitted_at || null,
            })
          );
        }
      });
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

    (review?.mission_reviews || []).forEach((missionReview) => {
      const score = getMissionAverage(missionReview.criteria || []);
      if (missionReview.status === 'Soumise a RH' && typeof score === 'number') {
        missionScoreDetails.push(
          buildScoreDetail({
            source: 'Manager',
            evaluatorName: fallbackManager?.name || 'Manager',
            evaluatorGrade: fallbackManager?.grade || 'Manager',
            missionTitle: missionReview.title,
            score,
            submittedAt: missionReview.submitted_at || null,
          })
        );
      }
    });

    const missionScore = getAverageFromDetailRows(missionScoreDetails);
    const missionScoreCount = missionScoreDetails.length;
    const scoreGlobal = getAverageFromDetailRows(globalScoreDetails);
    const scoreGlobalCount = globalScoreDetails.length;
    const finalScore = getAverageFromScores([missionScore, scoreGlobal]);
    const hasSubmittedManagerMission = (review?.mission_reviews || []).some((mission) => mission.status === 'Soumise a RH');
    const effectiveStatus =
      review?.status === 'Soumis a RH' || review?.status === 'Valide RH' || review?.status === 'Cloture'
        ? review.status
        : hasSubmittedManagerMission
          ? 'Soumis a RH'
          : review?.status || 'En attente';
    const unjustifiedLowScores = countUnjustifiedLowScorePages(sections);
    const sectionSummaries = getReviewSectionSummaries(sections);
    const commentSummary = sections.length
      ? getReviewCommentSummary(sections, fallbackManager?.name || '')
      : "Evaluation non encore soumise a la RH pour ce collaborateur.";
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
      managerMissionScore: getMissionScoreTotal(review?.mission_reviews || [], ['Soumise a RH']),
      managerMissionScoreCount: getMissionScoreCount(review?.mission_reviews || [], ['Soumise a RH']),
      managerScore,
      finalScore,
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
    cycle_label: CURRENT_CYCLE_LABEL,
    template_type: 'rh-assistant-self-evaluation',
    submitted_to_user_ids: { $in: recipientIds },
  }).select(
    'evalue_id status submitted_at sections rh_validation_selected rh_validation_selected_at rh_validated_at'
  );

  const userIds = instances.map((instance) => instance.evalue_id).filter(Boolean);
  const [users, reviews] = await Promise.all([
    userIds.length
      ? User.find({ _id: { $in: userIds } }).select('_id name first_name last_name grade department code_categorie')
      : [],
    userIds.length
      ? ManagerMemberReview.find({
          cycle_label: CURRENT_CYCLE_LABEL,
          member_id: { $in: userIds },
          template_type: 'rh-assistant-evaluation',
        }).select('member_id manager_id status submitted_at sections mission_reviews rh_validation_selected rh_validation_selected_at rh_validated_at')
      : [],
  ]);
  const userById = new Map(users.map((user) => [String(user._id), user]));
  const reviewByMemberId = new Map(reviews.map((review) => [String(review.member_id), review]));

  return instances.map((instance) => {
    const assistantUser = userById.get(String(instance.evalue_id));
    const review = reviewByMemberId.get(String(instance.evalue_id));
    const sections = normalizeSections(instance.sections || []);
    const reviewSections = normalizeSections(review?.sections || []);
    const selfScore = getOverallAverageScore(sections);
    const managerScore = getOverallAverageScore(reviewSections);
    const selfEvaluationBreakdown = buildSectionBreakdown(
      sections,
      'Auto-evaluation',
      assistantUser?.name || 'Assistante RH',
      assistantUser?.grade || 'Assistante RH',
      instance?.submitted_at || null
    );
    const managerEvaluationBreakdown = buildSectionBreakdown(
      reviewSections,
      'Manager',
      'RH',
      'RH',
      review?.submitted_at || null
    );
    const missionScoreDetails = [];
    const globalScoreDetails = [];

    if (instance.submitted_at && typeof selfScore === 'number') {
      globalScoreDetails.push(
        buildScoreDetail({
          source: 'Auto-evaluation',
          evaluatorName: assistantUser?.name || 'Assistante RH',
          evaluatorGrade: assistantUser?.grade || 'Assistante RH',
          score: selfScore,
          submittedAt: instance.submitted_at || null,
        })
      );
    }

    (review?.mission_reviews || []).forEach((missionReview) => {
      const score = getMissionAverage(missionReview.criteria || []);
      if (missionReview.status === 'Soumise a RH' && typeof score === 'number') {
        missionScoreDetails.push(
          buildScoreDetail({
            source: 'Manager',
            evaluatorName: 'RH',
            evaluatorGrade: 'RH',
            missionTitle: missionReview.title,
            score,
            submittedAt: missionReview.submitted_at || null,
          })
        );
      }
    });

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

    const missionScore = getAverageFromDetailRows(missionScoreDetails);
    const missionScoreCount = missionScoreDetails.length;
    const scoreGlobal = getAverageFromDetailRows(globalScoreDetails);
    const scoreGlobalCount = globalScoreDetails.length;
    const finalScore = getAverageFromScores([missionScore, scoreGlobal]);
    const managerMissionScore = getMissionScoreTotal(review?.mission_reviews || [], ['Soumise a RH']);
    const managerMissionScoreCount = getMissionScoreCount(review?.mission_reviews || [], ['Soumise a RH']);
    const reviewHasBeenSubmitted = review?.status === 'Soumis a RH' || review?.status === 'Valide RH' || review?.status === 'Cloture';
    const effectiveStatus = reviewHasBeenSubmitted ? review.status : instance.status;
    const rhValidationSelected =
      reviewHasBeenSubmitted && typeof review?.rh_validation_selected === 'boolean'
        ? review.rh_validation_selected
        : instance.rh_validation_selected;

    return {
      id: `assistant-rh:${instance._id.toString()}`,
      rawId: instance._id.toString(),
      sourceType: 'assistant-rh-self-evaluation',
      memberId: assistantUser?._id?.toString?.() || '',
      name: assistantUser?.name || 'Assistante RH',
      role: assistantUser?.grade || 'Assistante RH',
      department: assistantUser?.department || 'CAPITAL HUMAIN',
      managerName: 'Auto-evaluation Assistante RH',
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
      status: effectiveStatus,
      submittedAt: instance.submitted_at || null,
      unjustifiedLowScores: 0,
      displayStatus: getAssistantRhDisplayStatus({ status: effectiveStatus, rh_validation_selected: rhValidationSelected }),
      rhValidationSelected: Boolean(rhValidationSelected),
      sectionSummaries: getReviewSectionSummaries(reviewSections.length ? reviewSections : sections),
      commentSummary: getReviewCommentSummary(reviewSections.length ? reviewSections : sections, 'RH'),
      gap: null,
      evaluationTrail: [selfEvaluationBreakdown, managerEvaluationBreakdown].filter(
        (item) => item.sectionScores.length || item.sectionComments.length || typeof item.overallScore === 'number'
      ),
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
      selfScore: row.selfScore,
      managerScore: row.managerScore,
      finalScore: row.finalScore,
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
    const scores = group.members.map((member) => member.finalScore).filter((score) => typeof score === 'number');
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

  const [managerSelfEvaluations, evaluatedPopulation, reviewRows, assistantRhRows] = await Promise.all([
    EvaluationInstance.find({
      cycle_label: CURRENT_CYCLE_LABEL,
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
  ]);

  const combinedReviewRows = [...reviewRows, ...assistantRhRows];
  const receivedCount =
    combinedReviewRows.filter((item) => RH_RELEVANT_STATUSES.includes(item.status)).length +
    managerSelfEvaluations.filter((item) => RH_RELEVANT_STATUSES.includes(item.status)).length;
  const totalEvaluatedPopulation = evaluatedPopulation.length;
  const pendingRhItems = combinedReviewRows.filter((item) => item.status === 'Soumis a RH');
  const readySynthesesCount = combinedReviewRows.filter((item) => item.status === 'Valide RH' || item.status === 'Cloture').length;
  const priorityRows = combinedReviewRows
    .filter((row) => row.status === 'Soumis a RH')
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
    cycle_label: CURRENT_CYCLE_LABEL,
    stats: [
      {
        title: 'Évaluations reçues',
        value: `${receivedCount}/${totalEvaluatedPopulation}`,
        subtitle: totalEvaluatedPopulation
          ? `${Math.round((receivedCount / totalEvaluatedPopulation) * 100)}% du cycle ${CURRENT_CYCLE_LABEL.replace('Cycle ', '')}`
          : `0% du cycle ${CURRENT_CYCLE_LABEL.replace('Cycle ', '')}`,
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
        title: 'Entretiens planifies',
        value: '0',
        subtitle: 'Donnée non planifiée',
      },
    ],
    priority_rows: priorityRows,
    department_averages: departmentAverages,
  });
}

async function getRhDepartmentEvaluations(request, response) {
  const rows = await loadRhReviewDataset(await resolveRhQueueUserIds());
  const groups = buildDepartmentGroups(rows);

  return response.json({
    cycle_label: CURRENT_CYCLE_LABEL,
    departments: groups,
  });
}

async function getRhDepartmentEvaluationDetail(request, response) {
  const reviewId = String(request.params.reviewId || '').trim();
  const rhUserIds = await resolveRhQueueUserIds();
  const [rows, assistantRhRows] = await Promise.all([
    loadRhReviewDataset(rhUserIds),
    loadAssistantRhSelfDataset(rhUserIds),
  ]);
  const item = [...rows, ...assistantRhRows].find((row) => String(row.id) === reviewId);

  if (!item) {
    return response.status(404).json({
      message: "Detail d'evaluation introuvable pour cette RH.",
    });
  }

  return response.json(item);
}

async function selectRhDepartmentEvaluation(request, response) {
  const rhUserIds = await resolveRhQueueUserIds();
  const review = await ManagerMemberReview.findOne({
    _id: request.params.reviewId,
    cycle_label: CURRENT_CYCLE_LABEL,
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
    message: 'Evaluation ajoutee a la file de validation RH.',
  });
}

async function getRhValidations(request, response) {
  const rhUserIds = await resolveRhQueueUserIds();
  const [rows, assistantRhRows] = await Promise.all([
    loadRhReviewDataset(rhUserIds),
    loadAssistantRhSelfDataset(rhUserIds),
  ]);
  const items = [...rows, ...assistantRhRows].filter((row) => row.status === 'Soumis a RH');

  return response.json({
    cycle_label: CURRENT_CYCLE_LABEL,
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
      message: 'Aucune evaluation selectionnee.',
    });
  }

  const assistantReviewIds = reviewIds
    .filter((id) => id.startsWith('assistant-rh:'))
    .map((id) => id.replace('assistant-rh:', ''));
  const managerReviewIds = reviewIds.filter((id) => !id.startsWith('assistant-rh:'));

  const reviews = await ManagerMemberReview.find({
    _id: { $in: managerReviewIds },
    cycle_label: CURRENT_CYCLE_LABEL,
    submitted_to_user_ids: { $in: rhUserIds },
  });
  const assistantInstances = await EvaluationInstance.find({
    _id: { $in: assistantReviewIds },
    cycle_label: CURRENT_CYCLE_LABEL,
    template_type: 'rh-assistant-self-evaluation',
    submitted_to_user_ids: { $in: rhUserIds },
  });
  const assistantReviewMemberIds = assistantInstances.map((instance) => instance.evalue_id).filter(Boolean);
  const assistantReviews = assistantReviewMemberIds.length
    ? await ManagerMemberReview.find({
        cycle_label: CURRENT_CYCLE_LABEL,
        manager_id: request.user._id,
        member_id: { $in: assistantReviewMemberIds },
        template_type: 'rh-assistant-evaluation',
      })
    : [];

  for (const review of reviews) {
    review.status = 'Valide RH';
    review.rh_validation_selected = false;
    review.rh_validated_at = new Date();
  }

  for (const instance of assistantInstances) {
    instance.status = 'Valide RH';
    instance.rh_validation_selected = false;
    instance.rh_validated_at = new Date();
  }

  for (const review of assistantReviews) {
    review.status = 'Valide RH';
    review.rh_validation_selected = false;
    review.rh_validated_at = new Date();
  }

  await Promise.all([
    ...reviews.map((review) => review.save()),
    ...assistantInstances.map((instance) => instance.save()),
    ...assistantReviews.map((review) => review.save()),
  ]);

  return response.json({
    message: 'Selection RH validee. Les evaluations sont maintenant dans les syntheses a transmettre.',
  });
}

async function getRhSyntheses(request, response) {
  const rhUserIds = await resolveRhQueueUserIds();
  const [rows, assistantRhRows] = await Promise.all([
    loadRhReviewDataset(rhUserIds),
    loadAssistantRhSelfDataset(rhUserIds),
  ]);
  const items = [...rows, ...assistantRhRows].filter((row) => row.status === 'Valide RH' || row.status === 'Cloture');

  return response.json({
    cycle_label: CURRENT_CYCLE_LABEL,
    items,
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
      message: "Cette section existe deja pour ce departement et ce bloc de matrice.",
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
    message: "Section creee. Vous pouvez maintenant y ajouter des questions.",
    ...buildQuestionnaireView(),
  });
}

async function addRhQuestionnaireQuestion(request, response) {
  const sectionId = normalizeQuestionnaireText(request.body?.sectionId);
  const questionText = normalizeQuestionnaireText(request.body?.questionText);

  if (!sectionId || !questionText) {
    return response.status(400).json({
      message: "Selectionnez une section et saisissez la question a ajouter.",
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
    message: "Question ajoutee a la section.",
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
    submitButtonLabel: 'Soumettre a la RH',
    introMessage:
      "L'assistante RH s'auto-evalue sur son accompagnement du cycle, puis transmet son auto-evaluation a la RH.",
    titleLabel: 'Auto-evaluation Assistante RH',
    saveMessage: 'Auto-evaluation Assistante RH enregistree.',
    readyMessage: 'Auto-evaluation Assistante RH prete pour soumission.',
    submittedMessage: 'Auto-evaluation Assistante RH soumise a la RH.',
    missingAnswersMessage: 'Toutes les questions Assistante RH doivent etre renseignees avant soumission a la RH.',
  };
}

async function getAssistantRhMemberForRh(rhUser, memberId) {
  const selfEvaluation = await EvaluationInstance.findOne({
    evalue_id: memberId,
    cycle_label: CURRENT_CYCLE_LABEL,
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
    cycle_label: CURRENT_CYCLE_LABEL,
    manager_id: rhUser._id,
    member_id: member._id,
    template_type: 'rh-assistant-evaluation',
  });

  const templateSections = cloneRhSelfTemplate(member);

  if (!review) {
    review = await ManagerMemberReview.create({
      cycle_label: CURRENT_CYCLE_LABEL,
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

async function addRhSelfMissionEvaluation(request, response) {
  const title = String(request.body?.title || '').trim();
  const period = String(request.body?.period || '').trim();

  if (!title) {
    return response.status(400).json({
      message: 'Le titre de la mission est requis.',
    });
  }

  const instance = await getOrCreateRhSelfEvaluation(request.user);
  const templateSections = cloneRhSelfTemplate(request.user);
  const missionEvaluations = normalizeRhMissionEvaluations(instance.mission_evaluations || []);

  missionEvaluations.push({
    mission_id: `rh-mission-${request.user._id}-${Date.now()}`,
    title,
    period,
    department: request.user.department || 'RH',
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
    criteria: buildRhMissionCriteria(templateSections),
    comment: '',
    status: 'Brouillon',
    submitted_at: null,
  });

  instance.mission_evaluations = missionEvaluations;
  instance.last_saved_at = new Date();
  await instance.save();

  const associateRecipients = await resolveAssociateRecipients();

  return response.json({
    message: 'Mission RH ajoutee.',
    ...buildRhSelfEvaluationPayload(instance, request.user, associateRecipients),
  });
}

async function saveMyRhSelfEvaluation(request, response) {
  const instance = await getOrCreateRhSelfEvaluation(request.user);
  const normalizedIncomingSections = normalizeSections(request.body?.sections || []);
  const missionEvaluations = Array.isArray(request.body?.missionEvaluations)
    ? normalizeRhMissionEvaluations(request.body.missionEvaluations)
    : normalizeRhMissionEvaluations(instance.mission_evaluations || []);

  if (!normalizedIncomingSections.length) {
    return response.status(400).json({ message: "Aucune section RH a sauvegarder." });
  }

  instance.sections = toPersistenceSections(normalizedIncomingSections);
  instance.mission_evaluations = missionEvaluations;
  instance.status = instance.status === 'Soumis aux Associes' ? instance.status : 'En cours';
  instance.last_saved_at = new Date();
  await instance.save();

  const associateRecipients = await resolveAssociateRecipients();

  return response.json({
    message: "Auto-evaluation RH enregistree.",
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
    return response.status(400).json({ message: "Aucune section Assistante RH a sauvegarder." });
  }

  instance.sections = toPersistenceSections(normalizedIncomingSections);
  instance.status = 'En cours';
  instance.last_saved_at = new Date();
  await instance.save();

  const rhRecipients = await resolveFullRhRecipients();

  return response.json({
    message: 'Auto-evaluation Assistante RH enregistree.',
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
    message: "Evaluation RH enregistree.",
    ...buildAssistantRhReviewPayload(review, request.user, context.member, context.selfEvaluation, associateRecipients),
  });
}

async function submitMyRhSelfEvaluation(request, response) {
  const instance = await getOrCreateRhSelfEvaluation(request.user);
  const normalizedSections = normalizeSections(instance.sections || []);
  const missingAnswers = validateSectionsForSubmit(normalizedSections);

  if (missingAnswers.length) {
    return response.status(400).json({
      message: "Toutes les questions RH doivent etre renseignees avant soumission aux associes.",
      missingAnswers,
    });
  }

  const missingSectionComments = validateSectionCommentsForSubmit(normalizedSections, 3);

  if (missingSectionComments.length) {
    return response.status(400).json({
      message: 'Un commentaire de section d au moins 3 caracteres est obligatoire pour chaque section avant soumission.',
      missingSectionComments,
    });
  }

  const associateRecipients = await resolveAssociateRecipients();

  if (!associateRecipients.length) {
    return response.status(400).json({
      message: "Aucun associe actif n'est disponible pour recevoir cette auto-evaluation RH.",
    });
  }

  instance.status = 'Soumis aux Associes';
  instance.submitted_to_role = 'associate';
  instance.submitted_to_user_ids = associateRecipients.map((recipient) => recipient._id);
  instance.submitted_to_names = associateRecipients.map((recipient) => recipient.name);
  instance.submitted_at = new Date();
  instance.last_saved_at = new Date();
  await instance.save();

  return response.json({
    message: "Auto-evaluation RH soumise aux associes.",
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
      message: 'Toutes les questions de la mission RH doivent etre renseignees avant soumission aux associes.',
    });
  }

  const associateRecipients = await resolveAssociateRecipients();

  if (!associateRecipients.length) {
    return response.status(400).json({
      message: "Aucun associe actif n'est disponible pour recevoir cette mission RH.",
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
      message: 'Toutes les questions Assistante RH doivent etre renseignees avant soumission a la RH.',
      missingAnswers,
    });
  }

  const missingAssistantSectionComments = validateSectionCommentsForSubmit(normalizedSections, 3);

  if (missingAssistantSectionComments.length) {
    return response.status(400).json({
      message: 'Un commentaire de section d au moins 3 caracteres est obligatoire pour chaque section avant soumission.',
      missingSectionComments: missingAssistantSectionComments,
    });
  }

  const rhRecipients = await resolveFullRhRecipients();

  if (!rhRecipients.length) {
    return response.status(400).json({
      message: "Aucune RH active n'est disponible pour recevoir cette auto-evaluation Assistante RH.",
    });
  }

  instance.status = 'Soumis a RH';
  instance.submitted_to_role = 'rh';
  instance.submitted_to_user_ids = rhRecipients.map((recipient) => recipient._id);
  instance.submitted_to_names = rhRecipients.map((recipient) => recipient.name);
  instance.rh_validation_selected = true;
  instance.rh_validation_selected_at = new Date();
  instance.submitted_at = new Date();
  instance.last_saved_at = new Date();
  await instance.save();

  return response.json({
    message: 'Auto-evaluation Assistante RH soumise a la RH.',
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
      message: "Toutes les questions de l'evaluation RH doivent etre renseignees avant validation.",
      missingAnswers,
    });
  }

  const missingReviewSectionComments = validateSectionCommentsForSubmit(normalizedSections, 3);

  if (missingReviewSectionComments.length) {
    return response.status(400).json({
      message: 'Un commentaire de section d au moins 3 caracteres est obligatoire pour chaque section avant soumission.',
      missingSectionComments: missingReviewSectionComments,
    });
  }

  review.status = 'Soumis a RH';
  review.submitted_to_user_ids = [request.user._id];
  review.submitted_to_names = [request.user.name];
  review.rh_validation_selected = true;
  review.rh_validation_selected_at = new Date();
  review.submitted_at = new Date();
  review.last_saved_at = new Date();
  await review.save();

  const associateRecipients = await resolveAssociateRecipients();

  return response.json({
    message: "Evaluation RH de l'assistante RH enregistree dans la file de validation.",
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
    cycle_label: CURRENT_CYCLE_LABEL,
    items,
  });
}

function getPopulationGroupKey(role = '') {
  const normalized = normalizeText(role);
  if (normalized === 'MANAGER' || normalized === 'SENIOR MANAGER') return 'Managers';
  if (normalized === 'SENIOR' || normalized === 'ASSISTANT MANAGER') return 'Seniors';
  return 'Assistants';
}

async function getRhPopulation(request, response) {
  const rows = await loadRhReviewDataset(await resolveRhQueueUserIds());
  const groupsMap = new Map([
    ['Managers', { group: 'Managers', members: [] }],
    ['Seniors', { group: 'Seniors', members: [] }],
    ['Assistants', { group: 'Assistants', members: [] }],
  ]);

  rows.forEach((row) => {
    const key = getPopulationGroupKey(row.role);
    groupsMap.get(key).members.push({
      id: row.id,
      name: row.name,
      role: `${row.role} ${formatDepartmentLabel(row.department).toLowerCase()}`.trim(),
      status: row.displayStatus,
      score: row.finalScore,
    });
  });

  const groups = Array.from(groupsMap.values()).map((group) => {
    const completed = group.members.filter((member) => typeof member.score === 'number').length;
    const total = group.members.length;
    return {
      group: group.group,
      total,
      completed,
      missing: Math.max(total - completed, 0),
      members: group.members.sort((left, right) => left.name.localeCompare(right.name, 'fr', { sensitivity: 'base' })),
    };
  });

  return response.json({
    cycle_label: CURRENT_CYCLE_LABEL,
    groups,
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
  const [syntheses, validations, calibration, population] = await Promise.all([
    getRhSyntheses(request, { json: (data) => data }),
    getRhValidations(request, { json: (data) => data }),
    getRhCalibration(request, { json: (data) => data }),
    getRhPopulation(request, { json: (data) => data }),
  ]);

  if (reportId === 'rh-synthese-validee') {
    const lines = syntheses.items.length
      ? syntheses.items.map(
          (item) =>
            `${item.name} | ${item.role} | Score final: ${item.finalScore ?? 'N/A'} | Recommandation: ${item.displayStatus || 'N/A'}`
        )
      : ['Aucune synthese RH validee disponible pour le moment.'];

    return {
      filename: 'synthese-rh-validee-cycle-2026.pdf',
      contentType: 'application/pdf',
      buffer: buildSimplePdfBuffer('Synthese RH validee - Cycle 2026', lines),
    };
  }

  if (reportId === 'rh-validations') {
    const rows = validations.items.map((item) => [
      item.name,
      item.role,
      formatDepartmentLabel(item.department),
      item.managerName,
      item.selfScore ?? '',
      item.managerScore ?? '',
      item.finalScore ?? '',
      item.displayStatus,
    ]);

    return {
      filename: 'file-validations-rh-cycle-2026.csv',
      contentType: 'text/csv; charset=utf-8',
      buffer: buildCsvBuffer(
        ['Collaborateur', 'Role', 'Departement', 'Manager', 'Auto-evaluation', 'Evaluation manager', 'Score final', 'Statut'],
        rows
      ),
    };
  }

  if (reportId === 'rh-calibration') {
    const lines = calibration.items.length
      ? calibration.items.map(
          (item) => `${item.department} | Moyenne: ${item.average ?? 'N/A'} | Evalues: ${item.evaluated} | Risque: ${item.risk}`
        )
      : ['Aucune calibration disponible pour le moment.'];

    return {
      filename: 'calibration-departements-cycle-2026.pdf',
      contentType: 'application/pdf',
      buffer: buildSimplePdfBuffer('Calibration des departements - Cycle 2026', lines),
    };
  }

  if (reportId === 'rh-population') {
    const rows = population.groups.flatMap((group) =>
      (group.members || []).map((member) => [group.group, member.name, member.role, member.status, member.score ?? ''])
    );

    return {
      filename: 'suivi-population-cycle-2026.csv',
      contentType: 'text/csv; charset=utf-8',
      buffer: buildCsvBuffer(['Groupe', 'Nom', 'Role', 'Statut', 'Score'], rows),
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
    cycle_label: CURRENT_CYCLE_LABEL,
    exports: [
      {
        id: 'rh-synthese-validee',
        title: 'Synthese RH validee',
        format: 'PDF',
        owner: 'RH',
        status: syntheses.items.length ? 'Pret' : 'A generer',
        downloadable: true,
      },
      {
        id: 'rh-validations',
        title: 'File de validations RH',
        format: 'XLSX',
        owner: 'RH',
        status: validations.items.length ? 'Pret' : 'A generer',
        downloadable: true,
      },
      {
        id: 'rh-calibration',
        title: 'Calibration des departements',
        format: 'PDF',
        owner: 'RH',
        status: calibration.items.length ? 'Pret' : 'A generer',
        downloadable: true,
      },
      {
        id: 'rh-population',
        title: 'Suivi population cycle 2026',
        format: 'XLSX',
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

module.exports = {
  addRhQuestionnaireQuestion,
  buildNonRhDepartmentClause,
  createRhQuestionnaireSection,
  CURRENT_CYCLE_LABEL,
  downloadRhReport,
  addRhSelfMissionEvaluation,
  formatDepartmentLabel,
  getAssistantRhEvaluation,
  getRhCalibration,
  getRhDepartmentEvaluationDetail,
  getRhDepartmentEvaluations,
  getMyAssistantRhSelfEvaluation,
  getRhQuestionnaire,
  getMyRhSelfEvaluation,
  getRhOverview,
  getRhPopulation,
  getRhReports,
  getRhSyntheses,
  getRhValidations,
  loadAssistantRhSelfDataset,
  loadRhReviewDataset,
  RH_RELEVANT_STATUSES,
  resolveRhQueueUserIds,
  saveAssistantRhEvaluation,
  saveMyAssistantRhSelfEvaluation,
  saveMyRhSelfEvaluation,
  selectRhDepartmentEvaluation,
  submitAssistantRhEvaluation,
  submitMyAssistantRhSelfEvaluation,
  submitMyRhSelfMissionEvaluation,
  submitMyRhSelfEvaluation,
  validateRhSelection,
};
