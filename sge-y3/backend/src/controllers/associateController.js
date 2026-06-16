const User = require('../models/User');
const EvaluationInstance = require('../models/EvaluationInstance');
const CommitteeDecision = require('../models/CommitteeDecision');
const AssociateManagerReview = require('../models/AssociateManagerReview');
const ManagerMemberReview = require('../models/ManagerMemberReview');
const SeniorAssistantReview = require('../models/SeniorAssistantReview');
const { buildEvaluationTemplateForUser } = require('../utils/competencyMatrix');
const {
  getAverageFromScores,
  getEvaluationSummary,
  getOverallAverageScore,
  getSectionProgress,
  normalizeSections,
  validateSectionCommentsForSubmit,
  validateSectionsForSubmit,
} = require('../utils/evaluationHelpers');
const {
  buildNonRhDepartmentClause,
  formatDepartmentLabel,
  loadAssistantRhSelfDataset,
  loadRhReviewDataset,
  RH_RELEVANT_STATUSES,
  resolveRhQueueUserIds,
} = require('./rhController');
const { getCurrentCycleLabel } = require('../utils/activeCycle');
const {
  buildCyclesForInstances,
  buildPeerReviewComments,
  resolveTemplateTypeForUser,
} = require('../utils/evaluationHistory');
const { fetchManagerCommentsForMember } = require('./collaboratorEvaluationController');
const { fetchAssociateCommentsForManager } = require('./managerController');

function getInitials(name = '') {
  return String(name || '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('');
}

function roundScore(score) {
  return typeof score === 'number' ? Number(score.toFixed(1)) : null;
}

function normalizeText(value = '') {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toUpperCase();
}

function isRhDepartment(user) {
  return normalizeText(user?.department) === 'RH';
}

function isCapitalHumainDepartment(user) {
  return normalizeText(user?.department) === 'CAPITAL HUMAIN';
}

function isAssociateManagerEvaluationTarget(user) {
  if (!user || isCapitalHumainDepartment(user)) {
    return false;
  }

  return ['10B', '10C'].includes(String(user.code_categorie || '').trim()) || isRhDepartment(user);
}

function getAssociateManagerSelfTemplateType(user) {
  return isRhDepartment(user) ? 'rh-self-evaluation' : 'manager-self-evaluation';
}

function isMissionAssignedToAssociate(mission, associateId) {
  const targetId = String(associateId || '').trim();

  if (!targetId || mission?.status !== 'Soumise') {
    return false;
  }

  return (mission.recipients || []).some((recipient) => {
    const recipientId = String(recipient?.user_id || recipient?.id || '').trim();
    return recipientId === targetId && recipient?.can_evaluate !== false;
  });
}

function getAssociateManagerAvailableMissions(selfEvaluation, associateId) {
  return (selfEvaluation?.mission_evaluations || []).filter((mission) =>
    isMissionAssignedToAssociate(mission, associateId)
  );
}

function toPersistenceSections(sections = []) {
  return sections.map((section, index) => {
    const rawSectionId = Number(section.section_id ?? section.id);
    const sectionId = Number.isFinite(rawSectionId) ? rawSectionId : index + 1;

    return {
    section_id: sectionId,
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
  };
  });
}

function cloneSectionsForManager(manager) {
  return buildEvaluationTemplateForUser({
    grade: manager?.grade || 'Manager',
    department: manager?.department || '',
  }).map((section) => ({
    ...section,
    pages: (section.pages || []).map((page) => ({
      ...page,
      themes: (page.themes || []).map((theme) => ({ ...theme })),
    })),
    criteria: (section.criteria || []).map((criterion) => ({ ...criterion })),
  }));
}

async function resolveOtherAssociates(currentUserId) {
  return User.find({
    is_active: true,
    _id: { $ne: currentUserId },
    $or: [{ code_categorie: '11' }, { grade: 'Associé' }, { grade: 'Associe' }],
  })
    .sort({ last_name: 1, first_name: 1 })
    .select('_id name first_name last_name grade department code_categorie');
}

function cloneSectionsForAssociate(user) {
  return buildEvaluationTemplateForUser({
    grade: user?.grade || 'Associe',
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

function getAssociatePeerReviewSections(instance, submitter, associateUserId = null) {
  const canUseSavedPeerReview =
    !associateUserId ||
    (instance.peer_review_comment_by_user_id &&
      String(instance.peer_review_comment_by_user_id) === String(associateUserId));
  const savedSections = canUseSavedPeerReview ? normalizeSections(instance.peer_review_sections || []) : [];

  if (savedSections.length) {
    return savedSections;
  }

  const visibleMissions = associateUserId
    ? getSubmittedMissionsForUser(instance.mission_evaluations || [], associateUserId)
    : instance.mission_evaluations || [];
  const missionSections = buildSectionsFromMissionEvaluations(visibleMissions);
  if (missionSections.length) {
    return missionSections;
  }

  return buildEvaluationTemplateForUser({
    grade: submitter?.grade || 'Assistant',
    department: submitter?.department || '',
  }).map((section) => ({
    ...section,
    pages: (section.pages || []).map((page) => ({
      ...page,
      themes: (page.themes || []).map((theme) => ({ ...theme })),
    })),
    criteria: (section.criteria || []).map((criterion) => ({ ...criterion })),
  }));
}

function getMissionReviewKey(mission = {}, index = 0) {
  return String(mission.mission_id || mission.id || `mission-${index + 1}`).trim();
}

function buildSectionsFromMissionEvaluations(missions = []) {
  const sectionMap = new Map();

  normalizeMissionReviews(missions).forEach((mission, missionIndex) => {
    const missionKey = getMissionReviewKey(mission, missionIndex);

    (mission.criteria || []).forEach((criterion) => {
      const sectionTitle = criterion.section_title || 'Mission';
      const pageTitle = criterion.page_title || criterion.label || mission.title || 'Titre';
      const sectionKey = `${missionKey}-${sectionTitle}`;

      if (!sectionMap.has(sectionKey)) {
        sectionMap.set(sectionKey, {
          id: sectionMap.size + 1,
          title: sectionTitle,
          subtitle: missionKey,
          status: 'En cours',
          comment: '',
          pages: new Map(),
          criteria: [],
        });
      }

      const section = sectionMap.get(sectionKey);
      if (!section.pages.has(pageTitle)) {
        section.pages.set(pageTitle, {
          page_id: `${missionKey}-${section.id}-${section.pages.size + 1}`,
          title: pageTitle,
          source_sheet: criterion.source_sheet || '',
          source_label: criterion.source_label || '',
          comment: '',
          themes: [],
        });
      }

      const page = section.pages.get(pageTitle);
      page.themes.push({
        theme_id: `${missionKey}-${criterion.criterion_id || `${page.page_id}-${page.themes.length + 1}`}`,
        code: criterion.theme_code || `${page.themes.length + 1}`,
        label: criterion.label,
        statement: criterion.statement,
        score: null,
        required: true,
      });
    });
  });

  return Array.from(sectionMap.values()).map((section) => ({
    ...section,
    pages: Array.from(section.pages.values()),
  }));
}

function isAssociateSubmitter(user = {}) {
  const category = String(user.code_categorie || '').trim();
  const grade = normalizeText(user.grade || '');
  return category === '11' || grade === 'ASSOCIE';
}

function isDirectCollaboratorSubmitter(user = {}) {
  const category = String(user.code_categorie || '').trim();
  return ['8C', '9A', '9B'].includes(category);
}

function getReceivedEvaluationScore(instance) {
  const sections = normalizeSections(instance.sections || []);
  const sectionScore = getOverallAverageScore(sections);

  if (typeof sectionScore === 'number') {
    return sectionScore;
  }

  const missionScores = normalizeMissionReviews(instance.mission_evaluations || [])
    .map((mission) => getMissionAverage(mission.criteria || []))
    .filter((score) => typeof score === 'number');

  return getAverageFromScores(missionScores);
}

async function getOrCreateAssociateSelfEvaluation(user) {
  let instance = await EvaluationInstance.findOne({
    cycle_label: getCurrentCycleLabel(),
    evalue_id: user._id,
    template_type: 'associate-self-evaluation',
  });

  const templateSections = cloneSectionsForAssociate(user);

  if (!instance) {
    instance = await EvaluationInstance.create({
      cycle_label: getCurrentCycleLabel(),
      evalue_id: user._id,
      status: 'En cours',
      template_type: 'associate-self-evaluation',
      submitted_to_role: 'associate',
      sections: toPersistenceSections(templateSections),
      last_saved_at: new Date(),
    });
  } else {
    const currentSections = normalizeSections(instance.sections || []);
    if (!currentSections.length) {
      instance.sections = toPersistenceSections(templateSections);
      instance.last_saved_at = new Date();
      await instance.save();
    }
  }

  return instance;
}

function buildAssociateSelfEvaluationPayload(instance, user, recipients = []) {
  const sections = normalizeSections(instance.sections || []);
  const peerReviewSections = normalizeSections(instance.peer_review_sections || []);
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
      recipient: recipients[0]
        ? {
            id: recipients[0]._id.toString(),
            name: recipients[0].name,
            grade: recipients[0].grade,
            department: recipients[0].department,
          }
        : null,
      peerComment: instance.peer_review_comment || peerReviewSections.length
        ? {
            comment: instance.peer_review_comment,
            authorName: instance.peer_review_comment_by_name || '',
            savedAt: instance.peer_review_comment_saved_at || null,
            sections: peerReviewSections,
            summary: {
              ...getEvaluationSummary(peerReviewSections),
              overallAverage: getOverallAverageScore(peerReviewSections),
            },
          }
        : null,
    },
    summary: {
      ...getEvaluationSummary(sections),
      overallAverage: getOverallAverageScore(sections),
    },
    associate: {
      id: user._id.toString(),
      name: user.name,
      first_name: user.first_name,
      last_name: user.last_name,
      grade: user.grade,
      department: user.department,
    },
  };
}

function buildAssociateIncomingListItem(instance, submitter, associateUserId = null) {
  const canUseSavedPeerReview =
    !associateUserId ||
    (instance.peer_review_comment_by_user_id &&
      String(instance.peer_review_comment_by_user_id) === String(associateUserId));
  const peerReviewSections = canUseSavedPeerReview ? normalizeSections(instance.peer_review_sections || []) : [];
  const overallAverage = getReceivedEvaluationScore(instance);
  const receivedMissionsCount = associateUserId
    ? getSubmittedMissionsForUser(instance.mission_evaluations || [], associateUserId).length
    : normalizeMissionReviews(instance.mission_evaluations || []).length;
  return {
    id: instance._id.toString(),
    templateType: instance.template_type,
    submitterId: submitter?._id?.toString?.() || '',
    name: submitter?.name || 'Associe',
    grade: submitter?.grade || 'Associe',
    department: submitter?.department || '',
    submittedAt: instance.submitted_at || null,
    status: instance.status || 'En attente',
    overallAverage,
    receivedMissionsCount,
    commentSaved: Boolean(String(instance.peer_review_comment || '').trim() || peerReviewSections.length),
    peerReviewAverage: getOverallAverageScore(peerReviewSections),
  };
}

function buildAssociateIncomingEvaluationPayload(instance, submitter, associateUserId = null, missionResults = []) {
  const sections = normalizeSections(instance.sections || []);
  const peerReviewSections = getAssociatePeerReviewSections(instance, submitter, associateUserId);
  const canUseSavedPeerReview =
    !associateUserId ||
    (instance.peer_review_comment_by_user_id &&
      String(instance.peer_review_comment_by_user_id) === String(associateUserId));
  const visibleMissions = associateUserId
    ? getSubmittedMissionsForUser(instance.mission_evaluations || [], associateUserId)
    : normalizeMissionReviews(instance.mission_evaluations || []);
  const activeSection = sections[0] || null;

  return {
    evaluation: {
      id: instance._id.toString(),
      cycle_label: instance.cycle_label,
      status: instance.status,
      submitted_at: instance.submitted_at,
      sections,
      missions: formatMissionReviews(visibleMissions),
      missionResults,
      activeSectionId: activeSection?.id || 1,
      templateType: instance.template_type,
    },
    summary: {
      ...getEvaluationSummary(sections),
      overallAverage: getReceivedEvaluationScore(instance),
    },
    submitter: {
      id: submitter?._id?.toString?.() || '',
      name: submitter?.name || 'Associe',
      first_name: submitter?.first_name || '',
      last_name: submitter?.last_name || '',
      grade: submitter?.grade || 'Associe',
      department: submitter?.department || '',
    },
    peerReview: {
      comment: canUseSavedPeerReview ? instance.peer_review_comment || '' : '',
      authorName: canUseSavedPeerReview ? instance.peer_review_comment_by_name || '' : '',
      savedAt: canUseSavedPeerReview ? instance.peer_review_comment_saved_at || null : null,
      sections: peerReviewSections,
      activeSectionId: peerReviewSections[0]?.id || 1,
      summary: {
        ...getEvaluationSummary(peerReviewSections),
        overallAverage: getOverallAverageScore(peerReviewSections),
      },
    },
  };
}

function getMissionAverage(criteria = []) {
  return getAverageFromScores((criteria || []).map((criterion) => criterion.score));
}

function getMissionSectionComments(missionReview) {
  const sectionMap = new Map();

  (missionReview?.criteria || []).forEach((criterion) => {
    const sectionTitle = String(criterion.section_title || criterion.sectionTitle || '').trim() || 'Section';
    const sectionComment = String(criterion.section_comment || criterion.sectionComment || '').trim();

    if (!sectionMap.has(sectionTitle)) {
      sectionMap.set(sectionTitle, sectionComment);
      return;
    }

    if (!sectionMap.get(sectionTitle) && sectionComment) {
      sectionMap.set(sectionTitle, sectionComment);
    }
  });

  return Array.from(sectionMap.entries()).map(([title, comment]) => ({
    title,
    comment: comment || 'Rien à signaler.',
  }));
}

function getSectionCommentsFromSections(sections = []) {
  return normalizeSections(sections).map((section) => ({
    title: section.title || 'Section',
    comment: String(section.comment || '').trim() || 'Rien à signaler.',
  }));
}

function findMissionReviewById(missionReviews = [], missionId, statuses = []) {
  return (missionReviews || []).find((missionReview) => {
    const reviewMissionId = String(missionReview.mission_id || missionReview.id || '').trim();
    if (reviewMissionId !== String(missionId || '').trim()) {
      return false;
    }

    return !statuses.length || statuses.includes(missionReview.status);
  });
}

function getSectionsForMissionResult(sections = [], missionId) {
  const normalizedSections = normalizeSections(sections || []);
  const keyedSections = normalizedSections.filter((section) => String(section.subtitle || '').trim() === String(missionId || '').trim());

  return keyedSections;
}

function buildMissionResultItem({ evaluatorName = '', evaluatorGrade = '', score = null, submittedAt = null, sectionComments = [] }) {
  return {
    evaluatorName,
    evaluatorGrade,
    score,
    submittedAt,
    sectionComments,
  };
}

async function buildAssociateMissionResults(instance, submitter, associateUserId = null) {
  const visibleMissions = associateUserId
    ? getSubmittedMissionsForUser(instance.mission_evaluations || [], associateUserId)
    : normalizeMissionReviews(instance.mission_evaluations || []);

  if (!submitter?._id || !visibleMissions.length) {
    return [];
  }

  const [seniorReviews, managerReviews] = await Promise.all([
    SeniorAssistantReview.find({
      cycle_label: getCurrentCycleLabel(),
      assistant_id: submitter._id,
    }).select('senior_id mission_reviews submitted_at'),
    ManagerMemberReview.find({
      cycle_label: getCurrentCycleLabel(),
      member_id: submitter._id,
    }).select('manager_id mission_reviews submitted_at'),
  ]);

  const reviewerIds = [
    ...seniorReviews.map((review) => review.senior_id).filter(Boolean),
    ...managerReviews.map((review) => review.manager_id).filter(Boolean),
  ];
  const reviewers = reviewerIds.length
    ? await User.find({ _id: { $in: reviewerIds } }).select('_id name grade department')
    : [];
  const reviewerById = new Map(reviewers.map((user) => [String(user._id), user]));

  return visibleMissions.map((mission, missionIndex) => {
    const missionId = String(mission.mission_id || mission.id || '').trim();
    const results = [
      buildMissionResultItem({
        evaluatorName: submitter.name || 'Assistant',
        evaluatorGrade: submitter.grade || 'Assistant',
        score: getMissionAverage(mission.criteria || []),
        submittedAt: mission.submitted_at || instance.submitted_at || null,
        sectionComments: getMissionSectionComments(mission),
      }),
    ];

    seniorReviews.forEach((review) => {
      const missionReview = findMissionReviewById(review.mission_reviews || [], missionId, ['Transmise']);
      if (!missionReview) return;

      const senior = reviewerById.get(String(review.senior_id));
      results.push(
        buildMissionResultItem({
          evaluatorName: senior?.name || 'Senior',
          evaluatorGrade: senior?.grade || 'Senior',
          score: getMissionAverage(missionReview.criteria || []),
          submittedAt: missionReview.submitted_at || review.submitted_at || null,
          sectionComments: getMissionSectionComments(missionReview),
        })
      );
    });

    managerReviews.forEach((review) => {
      const missionReview = findMissionReviewById(review.mission_reviews || [], missionId, [
        'Soumise a RH',
        'Soumise à la RH',
        'Soumise Ã  la RH',
      ]);
      if (!missionReview) return;

      const manager = reviewerById.get(String(review.manager_id));
      results.push(
        buildMissionResultItem({
          evaluatorName: manager?.name || 'Manager',
          evaluatorGrade: manager?.grade || 'Manager',
          score: getMissionAverage(missionReview.criteria || []),
          submittedAt: missionReview.submitted_at || review.submitted_at || null,
          sectionComments: getMissionSectionComments(missionReview),
        })
      );
    });

    const canUseSavedPeerReview =
      !associateUserId ||
      (instance.peer_review_comment_by_user_id &&
        String(instance.peer_review_comment_by_user_id) === String(associateUserId));
    const associateSections = canUseSavedPeerReview
      ? getSectionsForMissionResult(instance.peer_review_sections || [], missionId)
      : [];
    const associateScore = getOverallAverageScore(associateSections);
    if (typeof associateScore === 'number') {
      results.push(
        buildMissionResultItem({
          evaluatorName: instance.peer_review_comment_by_name || 'Associé',
          evaluatorGrade: 'Associé',
          score: associateScore,
          submittedAt: instance.peer_review_comment_saved_at || null,
          sectionComments: getSectionCommentsFromSections(associateSections),
        })
      );
    }

    return {
      missionId,
      missionKey: missionId || `mission-${missionIndex + 1}`,
      results,
    };
  });
}

function getMissionProgress(criteria = []) {
  if (!criteria.length) {
    return 0;
  }

  const answered = criteria.filter((criterion) => typeof criterion.score === 'number').length;
  return Math.round((answered / criteria.length) * 100);
}

function isMissionRecipientForUser(mission = {}, userId) {
  return (mission.recipients || []).some((recipient) => {
    const recipientId = recipient.user_id?.toString?.() || String(recipient.user_id || recipient.id || '');
    return recipientId && recipientId === String(userId) && recipient.can_evaluate !== false;
  });
}

function isSubmittedMissionForUser(mission = {}, userId) {
  return (
    isMissionRecipientForUser(mission, userId) &&
    mission.status === 'Soumise'
  );
}

function getSubmittedMissionsForUser(missions = [], userId) {
  return normalizeMissionReviews(missions).filter((mission) => isSubmittedMissionForUser(mission, userId));
}

function isEvaluationSubmittedToUser(instance = {}, userId) {
  return (instance.submitted_to_user_ids || []).some((recipientId) => String(recipientId) === String(userId));
}

function canAssociateAccessDirectEvaluation(instance = {}, userId) {
  return (
    isEvaluationSubmittedToUser(instance, userId) ||
    getSubmittedMissionsForUser(instance.mission_evaluations || [], userId).length > 0
  );
}

function normalizeMissionReviews(missionReviews = []) {
  return missionReviews.map((mission) => ({
    mission_id: String(mission.mission_id || mission.id || '').trim(),
    title: String(mission.title || '').trim(),
    period: String(mission.period || '').trim(),
    department: String(mission.department || '').trim(),
    status: String(mission.status || '').trim(),
    recipients: Array.isArray(mission.recipients)
      ? mission.recipients.map((recipient) => ({
          user_id: recipient.user_id || recipient.id || null,
          name: String(recipient.name || '').trim(),
          grade: String(recipient.grade || '').trim(),
          department: String(recipient.department || '').trim(),
          can_evaluate: recipient.can_evaluate,
        }))
      : [],
    comment: String(mission.comment || '').trim(),
    criteria: Array.isArray(mission.criteria)
      ? mission.criteria.map((criterion) => ({
          criterion_id: String(criterion.criterion_id || criterion.id || '').trim(),
          section_title: String(criterion.section_title || criterion.sectionTitle || '').trim(),
          section_comment: String(criterion.section_comment || criterion.sectionComment || '').trim(),
          page_title: String(criterion.page_title || criterion.pageTitle || '').trim(),
          page_comment: String(criterion.page_comment || criterion.pageComment || '').trim(),
          source_sheet: String(criterion.source_sheet || criterion.sourceSheet || '').trim(),
          source_label: String(criterion.source_label || criterion.sourceLabel || '').trim(),
          theme_code: String(criterion.theme_code || criterion.themeCode || '').trim(),
          label: String(criterion.label || '').trim(),
          statement: String(criterion.statement || '').trim(),
          score: criterion.score === null || criterion.score === undefined ? null : Number(criterion.score),
        }))
      : [],
    last_saved_at: mission.last_saved_at || mission.lastSavedAt || null,
    submitted_at: mission.submitted_at || mission.submittedAt || null,
  }));
}

function formatMissionReviews(missionReviews = []) {
  return missionReviews.map((mission) => ({
    id: mission.mission_id,
    title: mission.title,
    period: mission.period,
    department: mission.department,
    status: mission.status,
    recipients: mission.recipients || [],
    comment: mission.comment || '',
    criteria: (mission.criteria || []).map((criterion) => ({
      id: criterion.criterion_id,
      sectionTitle: criterion.section_title,
      sectionComment: criterion.section_comment,
      pageTitle: criterion.page_title,
      pageComment: criterion.page_comment,
      sourceSheet: criterion.source_sheet,
      sourceLabel: criterion.source_label,
      themeCode: criterion.theme_code,
      label: criterion.label,
      statement: criterion.statement,
      score: criterion.score,
    })),
    average: getMissionAverage(mission.criteria || []),
    lastSavedAt: mission.last_saved_at || null,
    submittedAt: mission.submitted_at || null,
  }));
}

function toAssociateMissionCriteria(criteria = []) {
  return (criteria || []).map((criterion) => ({
    criterion_id: String(criterion.criterion_id || criterion.id || '').trim(),
    section_title: String(criterion.section_title || criterion.sectionTitle || '').trim(),
    section_comment: String(criterion.section_comment || criterion.sectionComment || '').trim(),
    page_title: String(criterion.page_title || criterion.pageTitle || '').trim(),
    page_comment: String(criterion.page_comment || criterion.pageComment || '').trim(),
    source_sheet: String(criterion.source_sheet || criterion.sourceSheet || '').trim(),
    source_label: String(criterion.source_label || criterion.sourceLabel || '').trim(),
    theme_code: String(criterion.theme_code || criterion.themeCode || '').trim(),
    label: String(criterion.label || '').trim(),
    statement: String(criterion.statement || '').trim(),
    score: null,
  }));
}

async function getOrCreateAssociateManagerReview(associateUser, managerUser, managerSelfEvaluation) {
  let review = await AssociateManagerReview.findOne({
    cycle_label: getCurrentCycleLabel(),
    associate_id: associateUser._id,
    manager_id: managerUser._id,
  });

  const templateSections = cloneSectionsForManager(managerUser);
  const availableMissions = getAssociateManagerAvailableMissions(managerSelfEvaluation, associateUser._id)
    .map((mission) => ({
      mission_id: mission.mission_id,
      title: mission.title,
      period: mission.period,
      department: mission.department,
      comment: '',
      criteria: toAssociateMissionCriteria(mission.criteria || []),
      last_saved_at: null,
    }));

  if (!review) {
    review = await AssociateManagerReview.create({
      cycle_label: getCurrentCycleLabel(),
      associate_id: associateUser._id,
      manager_id: managerUser._id,
      manager_department: managerUser.department || '',
      sections: toPersistenceSections(templateSections),
      mission_reviews: availableMissions,
      last_saved_at: new Date(),
    });
    return review;
  }

  const existingMissionById = new Map(normalizeMissionReviews(review.mission_reviews || []).map((mission) => [mission.mission_id, mission]));
  review.mission_reviews = availableMissions.map((mission) => existingMissionById.get(mission.mission_id) || mission);
  review.manager_department = managerUser.department || '';
  await review.save();
  return review;
}

function buildAssociateManagerListItem(manager, selfEvaluation, associateReview) {
  const selfSections = normalizeSections(selfEvaluation?.sections || []);
  const reviewSections = normalizeSections(associateReview?.sections || []);
  const missionReviews = formatMissionReviews(
    normalizeMissionReviews(
      associateReview?.mission_reviews?.length
        ? associateReview.mission_reviews
        : getAssociateManagerAvailableMissions(selfEvaluation, associateReview?.associate_id)
    )
  );
  const missionAverage = getAverageFromScores(missionReviews.map((mission) => mission.average));
  const globalAverage = getOverallAverageScore(reviewSections);

  return {
    id: manager._id.toString(),
    name: manager.name,
    grade: manager.grade,
    department: manager.department || '',
    submittedAt: selfEvaluation?.submitted_at || null,
    selfScore: getOverallAverageScore(selfSections),
    selfEvaluationAvailable: Boolean(selfEvaluation),
    associateGlobalScore: globalAverage,
    associateMissionScore: missionAverage,
    missionsCount: missionReviews.length,
    evaluationProgress: getEvaluationSummary(reviewSections).globalProgress,
    annotationSaved: Boolean(String(associateReview?.associate_note || '').trim()),
  };
}

function buildAssociateManagerPayload(manager, selfEvaluation, associateReview) {
  const selfSections = normalizeSections(selfEvaluation?.sections || []);
  const reviewSections = normalizeSections(associateReview.sections || []);
  const reviewMissionReviews = formatMissionReviews(normalizeMissionReviews(associateReview.mission_reviews || []));

  return {
    cycle_label: getCurrentCycleLabel(),
    manager: {
      id: manager._id.toString(),
      name: manager.name,
      grade: manager.grade,
      department: manager.department || '',
    },
    self_evaluation: {
      status: selfEvaluation?.status || 'En attente',
      submitted_at: selfEvaluation?.submitted_at || null,
      sections: selfSections,
      summary: {
        ...getEvaluationSummary(selfSections),
        overallAverage: getOverallAverageScore(selfSections),
      },
      missions: getAssociateManagerAvailableMissions(selfEvaluation, associateReview.associate_id)
        .map((mission) => ({
          id: mission.mission_id,
          title: mission.title,
          period: mission.period,
          department: mission.department,
          comment: mission.comment || '',
          average: getMissionAverage(mission.criteria || []),
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
        })),
    },
    associate_review: {
      last_saved_at: associateReview.last_saved_at || null,
      note: associateReview.associate_note || '',
      sections: reviewSections,
      summary: {
        ...getEvaluationSummary(reviewSections),
        overallAverage: getOverallAverageScore(reviewSections),
      },
      missions: reviewMissionReviews,
    },
  };
}

const ASSOCIATE_DASHBOARD_DEPARTMENTS = [
  'Audit',
  'Expertise comptable',
  'Audit & Expertise comptable',
  'Conseil financier',
  'Conseil operationnel',
  'Service support',
];

const SUPPORT_ROLE_BY_EMAIL = {
  'fleur.nguessan@ycubeac.com': 'Office Manager',
  'aziz.ouattara@ycubeac.com': 'PMO',
  'porthela.kakou@ycubeac.com': 'Responsable IT',
  'adele.creppy@ycubeac.com': 'Comptable interne senior',
};

const SUPPORT_EMAILS = Object.keys(SUPPORT_ROLE_BY_EMAIL);

function normalizeEmail(value = '') {
  return String(value || '').replace(/\s+/g, ' ').trim().toLowerCase();
}

function isSupportEvaluationTarget(user) {
  return SUPPORT_EMAILS.includes(normalizeEmail(user?.email || ''));
}

function getSupportRoleLabel(user) {
  return SUPPORT_ROLE_BY_EMAIL[normalizeEmail(user?.email || '')] || user?.grade || 'Service support';
}

function cloneSectionsForSupport(user) {
  return buildEvaluationTemplateForUser({
    email: user?.email || '',
    grade: user?.grade || '',
    department: user?.department || 'Service support',
    code_categorie: user?.code_categorie || '',
  }).map((section) => ({
    ...section,
    pages: (section.pages || []).map((page) => ({
      ...page,
      themes: (page.themes || []).map((theme) => ({ ...theme })),
    })),
    criteria: (section.criteria || []).map((criterion) => ({ ...criterion })),
  }));
}

function getSupportPageMatchKey(page = {}) {
  return `${String(page.source_sheet || '').trim()}::${String(page.title || '').trim()}`;
}

function getSupportThemeMatchKey(page = {}, theme = {}) {
  return `${getSupportPageMatchKey(page)}::${String(theme.code || '').trim()}::${String(theme.label || '').trim()}`;
}

function mergeSupportReviewSectionsWithTemplate(savedSections = [], templateSections = []) {
  const normalizedSavedSections = normalizeSections(savedSections || []);
  const savedSectionByTitle = new Map(normalizedSavedSections.map((section) => [section.title, section]));
  const savedPageByKey = new Map();
  const savedThemeByKey = new Map();

  normalizedSavedSections.forEach((section) => {
    (section.pages || []).forEach((page) => {
      savedPageByKey.set(getSupportPageMatchKey(page), page);
      (page.themes || []).forEach((theme) => {
        savedThemeByKey.set(getSupportThemeMatchKey(page, theme), theme);
      });
    });
  });

  return templateSections.map((templateSection) => {
    const savedSection = savedSectionByTitle.get(templateSection.title);

    return {
      ...templateSection,
      comment: savedSection?.comment || templateSection.comment || '',
      pages: (templateSection.pages || []).map((templatePage) => {
        const savedPage = savedPageByKey.get(getSupportPageMatchKey(templatePage));

        return {
          ...templatePage,
          comment: savedPage?.comment || templatePage.comment || '',
          themes: (templatePage.themes || []).map((templateTheme) => {
            const savedTheme = savedThemeByKey.get(getSupportThemeMatchKey(templatePage, templateTheme));

            return {
              ...templateTheme,
              score: typeof savedTheme?.score === 'number' ? savedTheme.score : templateTheme.score,
            };
          }),
        };
      }),
    };
  });
}

async function syncSupportSelfEvaluationWithTemplate(selfEvaluation, supportUser) {
  if (!selfEvaluation) {
    return null;
  }

  const syncedSections = mergeSupportReviewSectionsWithTemplate(
    selfEvaluation.sections || [],
    cloneSectionsForSupport(supportUser)
  );

  selfEvaluation.sections = toPersistenceSections(normalizeSections(syncedSections));
  selfEvaluation.last_saved_at = new Date();
  await selfEvaluation.save();
  return selfEvaluation;
}

function getAssociateSupportReviewSections(instance, supportUser) {
  const savedSections = normalizeSections(instance?.peer_review_sections || []);
  const templateSections = cloneSectionsForSupport(supportUser);

  if (savedSections.length) {
    return mergeSupportReviewSectionsWithTemplate(savedSections, templateSections);
  }

  return templateSections;
}

function buildAssociateSupportListItem(supportUser, selfEvaluation) {
  const selfSections = normalizeSections(selfEvaluation?.sections || []);
  const reviewSections = normalizeSections(selfEvaluation?.peer_review_sections || []);

  return {
    id: supportUser._id.toString(),
    evaluationId: selfEvaluation?._id?.toString?.() || '',
    name: supportUser.name,
    email: supportUser.email || '',
    role: getSupportRoleLabel(supportUser),
    department: supportUser.department || 'Service support',
    status: selfEvaluation?.status || 'En attente',
    submittedAt: selfEvaluation?.submitted_at || null,
    selfEvaluationAvailable: Boolean(selfEvaluation?.submitted_at),
    selfScore: getOverallAverageScore(selfSections),
    associateScore: getOverallAverageScore(reviewSections),
    evaluationProgress: getEvaluationSummary(reviewSections).globalProgress,
    annotationSaved: Boolean(String(selfEvaluation?.peer_review_comment || '').trim() || reviewSections.length),
  };
}

function buildAssociateSupportPayload(supportUser, selfEvaluation) {
  const selfSections = normalizeSections(selfEvaluation?.sections || []);
  const reviewSections = getAssociateSupportReviewSections(selfEvaluation, supportUser);

  return {
    cycle_label: getCurrentCycleLabel(),
    support: {
      id: supportUser._id.toString(),
      name: supportUser.name,
      email: supportUser.email || '',
      role: getSupportRoleLabel(supportUser),
      grade: supportUser.grade || '',
      department: supportUser.department || 'Service support',
    },
    self_evaluation: {
      id: selfEvaluation?._id?.toString?.() || '',
      status: selfEvaluation?.status || 'En attente',
      submitted_at: selfEvaluation?.submitted_at || null,
      sections: selfSections,
      summary: {
        ...getEvaluationSummary(selfSections),
        overallAverage: getOverallAverageScore(selfSections),
      },
    },
    associate_review: {
      last_saved_at: selfEvaluation?.peer_review_comment_saved_at || null,
      note: selfEvaluation?.peer_review_comment || '',
      sections: reviewSections,
      summary: {
        ...getEvaluationSummary(reviewSections),
        overallAverage: getOverallAverageScore(reviewSections),
      },
    },
  };
}

function buildDecisionMap(decisionDocument) {
  const map = new Map();
  const decisions = decisionDocument?.decisions;

  if (!decisions || typeof decisions !== 'object') {
    return map;
  }

  Object.values(decisions).forEach((group) => {
    if (!Array.isArray(group)) {
      return;
    }

    group.forEach((item) => {
      const id = String(item?.id || '').trim();
      const finalDecision = String(item?.finalDecision || item?.final_decision || '').trim();

      if (id && finalDecision) {
        map.set(id, finalDecision);
      }
    });
  });

  return map;
}

function buildDecisionSplit(decisionDocument, allowedIds = null) {
  const counts = new Map();
  const decisions = decisionDocument?.decisions;
  const allowedIdSet = allowedIds instanceof Set ? allowedIds : null;

  if (decisions && typeof decisions === 'object') {
    Object.values(decisions).forEach((group) => {
      if (!Array.isArray(group)) {
        return;
      }

      group.forEach((item) => {
        const id = String(item?.id || '').trim();
        const label = String(item?.finalDecision || item?.final_decision || '').trim();

        if (label && (!allowedIdSet || allowedIdSet.has(id))) {
          counts.set(label, (counts.get(label) || 0) + 1);
        }
      });
    });
  }

  const preferredOrder = ['Augmentation', 'Promotion', 'Maintien', 'Formation obligatoire'];
  const maxCount = Math.max(...Array.from(counts.values()), 0);

  return preferredOrder
    .filter((label) => counts.has(label))
    .map((label) => {
      const count = counts.get(label) || 0;
      const ratio = maxCount ? Math.round((count / maxCount) * 100) : 0;
      return {
        label,
        count,
        width: `${Math.max(ratio, count ? 16 : 0)}%`,
        color: label === 'Augmentation' ? 'bg-[#C53B3B]' : 'bg-[#4D3AC5]',
      };
    });
}

function buildManagerAutoEvaluationRows(instances = [], userById = new Map()) {
  return instances
    .map((instance) => {
      const manager = userById.get(String(instance.evalue_id || ''));
      if (!manager) {
        return null;
      }

      const score = roundScore(getOverallAverageScore(normalizeSections(instance.sections || [])));

      return {
        id: String(instance._id || ''),
        managerId: String(instance.evalue_id || ''),
        initials: getInitials(manager?.name || ''),
        name: manager?.name || 'Manager',
        role: `${manager?.grade || 'Manager'} - Auto-éval`,
        score,
        submittedAt: instance.submitted_at || null,
      };
    })
    .filter((item) => item && item.score !== null)
    .sort((left, right) => {
      const leftDate = left.submittedAt ? new Date(left.submittedAt).getTime() : 0;
      const rightDate = right.submittedAt ? new Date(right.submittedAt).getTime() : 0;

      if (rightDate !== leftDate) {
        return rightDate - leftDate;
      }

      return right.score - left.score;
    });
}

async function getAssociateOverview(_request, response) {
  const rhUserIds = await resolveRhQueueUserIds();
  const [reviewRows, assistantRhRows, evaluatedPopulation, latestDecision, managerSelfEvaluations, managerUsers] =
    await Promise.all([
      loadRhReviewDataset(rhUserIds),
      loadAssistantRhSelfDataset(rhUserIds),
      User.find({
        is_active: true,
        code_categorie: { $in: ['8C', '9A', '9B', '10B', '10C'] },
        ...buildNonRhDepartmentClause(),
      }).select('_id'),
      CommitteeDecision.findOne({ scope: 'associate-final', cycle_label: getCurrentCycleLabel() }).sort({ submitted_at: -1 }),
      EvaluationInstance.find({
        cycle_label: getCurrentCycleLabel(),
        template_type: { $in: ['manager-self-evaluation', 'rh-self-evaluation'] },
        status: { $in: ['Soumis à RH', 'Validé RH', 'Clôture'] },
        submitted_at: { $ne: null },
      }).select('evalue_id submitted_at sections'),
      User.find({
        is_active: true,
        $or: [
          { code_categorie: { $in: ['10B', '10C'] } },
          { department: /^RH$/i },
        ],
        $nor: [{ department: /^CAPITAL HUMAIN$/i }],
      }).select('_id name first_name last_name grade department code_categorie'),
    ]);

  const combinedRows = [...reviewRows, ...assistantRhRows];
  const receivedCount = combinedRows.filter((item) => RH_RELEVANT_STATUSES.includes(item.status)).length;
  const totalPopulation = evaluatedPopulation.length;
  const readySyntheses = combinedRows.filter(
    (row) => row.status === 'Validé RH' || row.status === `Transmis à l'associe` || row.status === 'Clôture'
  );
  const readySyntheseIds = new Set(readySyntheses.map((row) => String(row.memberId || '')).filter(Boolean));
  const latestDecisionMap = buildDecisionMap(latestDecision);
  const pendingDecisionRows = readySyntheses.filter((row) => !latestDecisionMap.has(String(row.memberId || '')));
  const managerUserById = new Map(managerUsers.map((user) => [String(user._id), user]));
  const managerAutoEvalRows = buildManagerAutoEvaluationRows(managerSelfEvaluations, managerUserById);

  const urgentRowsSource = pendingDecisionRows.length
    ? pendingDecisionRows
        .slice()
        .sort((left, right) => {
          const leftScore = typeof left.finalScore === 'number' ? left.finalScore : -1;
          const rightScore = typeof right.finalScore === 'number' ? right.finalScore : -1;
          if (rightScore !== leftScore) return rightScore - leftScore;

          const leftDate = left.submittedAt ? new Date(left.submittedAt).getTime() : 0;
          const rightDate = right.submittedAt ? new Date(right.submittedAt).getTime() : 0;
          return rightDate - leftDate;
        })
        .slice(0, 5)
        .map((row) => ({
          id: row.id,
          initials: getInitials(row.name),
          name: row.name,
          role: `${row.role} - ${formatDepartmentLabel(row.department)}`,
          score: roundScore(row.finalScore),
        }))
    : managerAutoEvalRows.slice(0, 5).map((row) => ({
        id: row.id,
        initials: row.initials,
        name: row.name,
        role: row.role,
        score: row.score,
      }));

  const departmentMap = new Map();

  readySyntheses.forEach((row) => {
    if (typeof row.finalScore !== 'number') {
      return;
    }

    const department = formatDepartmentLabel(row.department);
    const current = departmentMap.get(department) || [];
    current.push(row.finalScore);
    departmentMap.set(department, current);
  });

  const departmentScores = Array.from(departmentMap.entries())
    .map(([label, scores]) => {
      const average = roundScore(scores.reduce((total, score) => total + score, 0) / scores.length);
      return {
        label,
        score: average,
        width: `${Math.max(Math.min(((average || 0) / 5) * 100, 100), 0)}%`,
      };
    });

  const departmentScoreByLabel = new Map(departmentScores.map((item) => [item.label, item]));
  const orderedDepartmentScores = ASSOCIATE_DASHBOARD_DEPARTMENTS.map((label) => {
    return (
      departmentScoreByLabel.get(label) || {
        label,
        score: 0,
        width: '0%',
      }
    );
  });

  const decisionSplit = buildDecisionSplit(latestDecision, readySyntheseIds);
  const totalDecisionsTaken = decisionSplit.reduce((total, item) => total + item.count, 0);

  return response.json({
    cycle_label: getCurrentCycleLabel(),
    stats: [
      {
        title: 'Collaborateurs évalués',
        value: `${receivedCount}/${totalPopulation}`,
        subtitle: totalPopulation ? `${Math.round((receivedCount / totalPopulation) * 100)}% du cabinet` : '0% du cabinet',
      },
      {
        title: 'Synthèses reçues RH',
        value: String(readySyntheses.length),
        subtitle: readySyntheses.length ? 'Prêtes pour décision' : 'Aucune synthèse reçue',
      },
      {
        title: 'Décisions en attente',
        value: String(pendingDecisionRows.length),
        subtitle: pendingDecisionRows.length ? 'Action requise' : 'Aucune en attente',
      },
      {
        title: 'Auto-évaluation Managers',
        value: String(managerAutoEvalRows.length),
        subtitle: managerAutoEvalRows.length ? 'ì examiner' : 'Aucune disponible',
      },
    ],
    decision_split: decisionSplit,
    decisions_summary: {
      decidedCount: totalDecisionsTaken,
      synthesesCount: readySyntheses.length,
    },
    urgent_decisions: urgentRowsSource,
    department_scores: orderedDepartmentScores,
  });
}

const CABINET_CODE_CATEGORIES = ['8C', '9A', '9B', '10B', '10C'];

async function getCabinetMemberForAssociate(memberId) {
  const member = await User.findOne({
    _id: memberId,
    is_active: true,
  }).select('_id name first_name last_name grade department code_categorie email');

  if (!member) {
    return null;
  }

  const isSupport = isSupportEvaluationTarget(member);
  const isCabinetRole = CABINET_CODE_CATEGORIES.includes(String(member.code_categorie || '').trim());

  return isSupport || isCabinetRole ? member : null;
}

async function listCabinetMembers(request, response) {
  const members = await User.find({
    is_active: true,
    $or: [
      { code_categorie: { $in: CABINET_CODE_CATEGORIES } },
      { email: { $in: SUPPORT_EMAILS } },
    ],
  })
    .sort({ last_name: 1, first_name: 1 })
    .select('_id name first_name last_name grade department code_categorie email');

  return response.json({
    cycle_label: getCurrentCycleLabel(),
    members: members.map((member) => ({
      id: member._id.toString(),
      name: member.name,
      grade: isSupportEvaluationTarget(member) ? getSupportRoleLabel(member) : member.grade,
      department: member.department,
      code_categorie: member.code_categorie,
    })),
  });
}

async function getCabinetMemberHistory(request, response) {
  const member = await getCabinetMemberForAssociate(request.params.memberId);

  if (!member) {
    return response.status(404).json({
      message: 'Membre introuvable pour le cabinet.',
    });
  }

  const resolved = resolveTemplateTypeForUser(member, { supportEmails: SUPPORT_EMAILS });

  if (!resolved) {
    return response.status(404).json({
      message: 'Historique indisponible pour ce membre.',
    });
  }

  const { templateType, kind } = resolved;

  const instances = await EvaluationInstance.find({
    evalue_id: member._id,
    template_type: templateType,
    cycle_label: { $ne: getCurrentCycleLabel() },
  }).sort({ cycle_label: -1 });

  const getComments = templateType === 'manager-self-evaluation'
    ? (cycleLabel) => fetchAssociateCommentsForManager(cycleLabel, member._id)
    : templateType === 'support-self-evaluation'
      ? (_cycleLabel, instance) => buildPeerReviewComments(instance)
      : (cycleLabel) => fetchManagerCommentsForMember(cycleLabel, member._id);

  const cycles = await buildCyclesForInstances(instances, kind, getComments);

  return response.json({
    cycles,
    member: {
      id: member._id.toString(),
      name: member.name,
      grade: isSupportEvaluationTarget(member) ? getSupportRoleLabel(member) : member.grade,
    },
  });
}

async function getMyAssociateEvaluationHistory(request, response) {
  const instances = await EvaluationInstance.find({
    evalue_id: request.user._id,
    template_type: 'associate-self-evaluation',
    cycle_label: { $ne: getCurrentCycleLabel() },
  }).sort({ cycle_label: -1 });

  const cycles = await buildCyclesForInstances(instances, 'sections', (_cycleLabel, instance) =>
    buildPeerReviewComments(instance)
  );

  return response.json({ cycles });
}

module.exports = {
  getCabinetMemberHistory,
  getMyAssociateEvaluationHistory,
  listCabinetMembers,
  async getAssociateSelfEvaluation(request, response) {
    const [instance, recipients] = await Promise.all([
      getOrCreateAssociateSelfEvaluation(request.user),
      resolveOtherAssociates(request.user._id),
    ]);

    return response.json(buildAssociateSelfEvaluationPayload(instance, request.user, recipients));
  },
  async saveAssociateSelfEvaluation(request, response) {
    const [instance, recipients] = await Promise.all([
      getOrCreateAssociateSelfEvaluation(request.user),
      resolveOtherAssociates(request.user._id),
    ]);


    const rawSections = Array.isArray(request.body?.sections) ? request.body.sections : [];
    if (rawSections.length) {
      instance.sections = toPersistenceSections(normalizeSections(rawSections));
    }

    instance.status = instance.status === 'Soumis aux Associés' ? instance.status : 'En cours';
    instance.last_saved_at = new Date();
    await instance.save();

    return response.json({
      message: "Auto-évaluation associé enregistrée.",
      ...buildAssociateSelfEvaluationPayload(instance, request.user, recipients),
    });
  },
  async submitAssociateSelfEvaluation(request, response) {
    const [instance, recipients] = await Promise.all([
      getOrCreateAssociateSelfEvaluation(request.user),
      resolveOtherAssociates(request.user._id),
    ]);

    if (!recipients.length) {
      return response.status(400).json({
        message: "Aucun autre associé destinataire n'est disponible pour le moment.",
      });
    }

    const sections = normalizeSections(instance.sections || []);
    const missingAnswers = validateSectionsForSubmit(sections);
    if (missingAnswers.length) {
      return response.status(400).json({
        message: "Toutes les questions doivent être renseignées avant la soumission.",
        missingAnswers,
      });
    }

    const missingComments = validateSectionCommentsForSubmit(sections, 3);
    if (missingComments.length) {
      return response.status(400).json({
        message: "Un commentaire d'au moins 3 caractères est obligatoire pour chaque section.",
        missingComments,
      });
    }

    const recipient = recipients[0];
    instance.submitted_to_role = 'associate';
    instance.submitted_to_user_ids = [recipient._id];
    instance.submitted_to_names = [recipient.name];
    instance.status = 'Soumis aux Associes';
    instance.submitted_at = new Date();
    instance.last_saved_at = new Date();
    await instance.save();

    return response.json({
      message: `Auto-évaluation associé soumise à ${recipient.name}.`,
      ...buildAssociateSelfEvaluationPayload(instance, request.user, recipients),
    });
  },
  async getReceivedAssociateEvaluations(request, response) {
    const scope = String(request.query?.scope || 'all').trim();
    const directAccessClause = {
      $or: [
        { submitted_to_user_ids: request.user._id },
        { 'mission_evaluations.recipients.user_id': request.user._id },
      ],
    };
    const instances = await EvaluationInstance.find({
      cycle_label: getCurrentCycleLabel(),
      template_type: { $in: ['associate-self-evaluation', 'assistant-self-evaluation', 'senior-self-evaluation'] },
      evalue_id: { $ne: request.user._id },
      ...(scope === 'direct-collaborators' ? directAccessClause : { submitted_to_user_ids: request.user._id }),
    }).select(
      '_id evalue_id template_type status submitted_at sections mission_evaluations submitted_to_user_ids peer_review_comment peer_review_sections peer_review_comment_by_user_id peer_review_comment_by_name peer_review_comment_saved_at'
    );

    const submitterIds = instances.map((instance) => instance.evalue_id).filter(Boolean);
    const submitters = submitterIds.length
      ? await User.find({ _id: { $in: submitterIds } }).select('_id name first_name last_name grade department code_categorie')
      : [];
    const submitterById = new Map(submitters.map((user) => [String(user._id), user]));

    return response.json({
      cycle_label: getCurrentCycleLabel(),
      items: instances
        .filter((instance) => {
          const submitter = submitterById.get(String(instance.evalue_id));

          if (scope === 'associate-only') {
            return instance.template_type === 'associate-self-evaluation' && isAssociateSubmitter(submitter);
          }

          if (scope === 'direct-collaborators') {
            return (
              ['assistant-self-evaluation', 'senior-self-evaluation'].includes(instance.template_type) &&
              isDirectCollaboratorSubmitter(submitter) &&
              canAssociateAccessDirectEvaluation(instance, request.user._id)
            );
          }

          return true;
        })
        .map((instance) => buildAssociateIncomingListItem(instance, submitterById.get(String(instance.evalue_id)), request.user._id))
        .sort((left, right) => {
          const leftDate = left.submittedAt ? new Date(left.submittedAt).getTime() : 0;
          const rightDate = right.submittedAt ? new Date(right.submittedAt).getTime() : 0;
          return rightDate - leftDate;
        }),
    });
  },
  async getReceivedAssociateEvaluation(request, response) {
    const instance = await EvaluationInstance.findOne({
      _id: request.params.evaluationId,
      cycle_label: getCurrentCycleLabel(),
      template_type: { $in: ['associate-self-evaluation', 'assistant-self-evaluation', 'senior-self-evaluation'] },
      evalue_id: { $ne: request.user._id },
      $or: [
        { submitted_to_user_ids: request.user._id },
        { 'mission_evaluations.recipients.user_id': request.user._id },
      ],
    }).select(
      '_id evalue_id template_type status submitted_at sections mission_evaluations submitted_to_user_ids peer_review_comment peer_review_sections peer_review_comment_by_user_id peer_review_comment_by_name peer_review_comment_saved_at'
    );

    if (!instance) {
      return response.status(404).json({ message: "Évaluation introuvable pour cet associé." });
    }

    const submitter = await User.findById(instance.evalue_id).select('_id name first_name last_name grade department code_categorie');
    if (!isAssociateSubmitter(submitter) && !canAssociateAccessDirectEvaluation(instance, request.user._id)) {
      return response.status(404).json({ message: "Évaluation introuvable pour cet associé." });
    }

    const missionResults = await buildAssociateMissionResults(instance, submitter, request.user._id);
    return response.json(buildAssociateIncomingEvaluationPayload(instance, submitter, request.user._id, missionResults));
  },
  async saveReceivedAssociateEvaluationComment(request, response) {
    const instance = await EvaluationInstance.findOne({
      _id: request.params.evaluationId,
      cycle_label: getCurrentCycleLabel(),
      template_type: { $in: ['associate-self-evaluation', 'assistant-self-evaluation', 'senior-self-evaluation'] },
      evalue_id: { $ne: request.user._id },
      $or: [
        { submitted_to_user_ids: request.user._id },
        { 'mission_evaluations.recipients.user_id': request.user._id },
      ],
    }).select(
      '_id evalue_id template_type status submitted_at sections mission_evaluations submitted_to_user_ids peer_review_comment peer_review_sections peer_review_comment_by_user_id peer_review_comment_by_name peer_review_comment_saved_at'
    );

    if (!instance) {
      return response.status(404).json({ message: "Évaluation introuvable pour cet associé." });
    }

    const submitter = await User.findById(instance.evalue_id).select('_id name first_name last_name grade department code_categorie');
    if (!isAssociateSubmitter(submitter) && !canAssociateAccessDirectEvaluation(instance, request.user._id)) {
      return response.status(404).json({ message: "Évaluation introuvable pour cet associé." });
    }

    const rawSections = Array.isArray(request.body?.sections) ? request.body.sections : [];
    const peerReviewSections = normalizeSections(rawSections);
    if (!peerReviewSections.length) {
      return response.status(400).json({
        message: "La matrice d'évaluation de l'associé est requise.",
      });
    }

    instance.peer_review_sections = toPersistenceSections(peerReviewSections);
    instance.peer_review_comment = String(request.body?.comment || '').trim();
    instance.peer_review_comment_by_user_id = request.user._id;
    instance.peer_review_comment_by_name =
      [request.user?.first_name, request.user?.last_name].filter(Boolean).join(' ').trim() || request.user?.name || '';
    instance.peer_review_comment_saved_at = new Date();
    await instance.save();

    const missionResults = await buildAssociateMissionResults(instance, submitter, request.user._id);

    return response.json({
      message: "Évaluation de l'associé enregistrée.",
      ...buildAssociateIncomingEvaluationPayload(instance, submitter, request.user._id, missionResults),
    });
  },
  async submitReceivedAssociateEvaluationToRh(request, response) {
    const instance = await EvaluationInstance.findOne({
      _id: request.params.evaluationId,
      cycle_label: getCurrentCycleLabel(),
      template_type: { $in: ['assistant-self-evaluation', 'senior-self-evaluation'] },
      evalue_id: { $ne: request.user._id },
      $or: [
        { submitted_to_user_ids: request.user._id },
        { 'mission_evaluations.recipients.user_id': request.user._id },
      ],
    }).select(
      '_id evalue_id template_type status submitted_at sections mission_evaluations submitted_to_user_ids submitted_to_names peer_review_comment peer_review_sections peer_review_comment_by_user_id peer_review_comment_by_name peer_review_comment_saved_at'
    );

    if (!instance) {
      return response.status(404).json({ message: "Évaluation collaborateur introuvable pour cet associé." });
    }

    if (!canAssociateAccessDirectEvaluation(instance, request.user._id)) {
      return response.status(404).json({ message: "Évaluation collaborateur introuvable pour cet associé." });
    }

    const peerReviewSections = getAssociatePeerReviewSections(instance, null, request.user._id);
    if (!peerReviewSections.length) {
      return response.status(400).json({
        message: "L'évaluation de l'associé doit être enregistrée avant la transmission à la RH.",
      });
    }

    const reviewSectionsToValidate = peerReviewSections.filter(
      (section) => getSectionProgress(section) > 0 || String(section.comment || '').trim()
    );

    const missingAnswers = validateSectionsForSubmit(reviewSectionsToValidate);
    if (missingAnswers.length) {
      return response.status(400).json({
        message: "Toutes les questions doivent être renseignées avant la transmission à la RH.",
        missingAnswers,
      });
    }

    const missingComments = validateSectionCommentsForSubmit(reviewSectionsToValidate, 3);
    if (missingComments.length) {
      return response.status(400).json({
        message: "Un commentaire d'au moins 3 caractères est obligatoire pour chaque section avant la transmission à la RH.",
        missingComments,
      });
    }

    const rhUserIds = await resolveRhQueueUserIds();
    const rhUsers = rhUserIds.length
      ? await User.find({ _id: { $in: rhUserIds } }).select('_id name')
      : [];

    if (!rhUsers.length) {
      return response.status(400).json({
        message: "Aucun destinataire RH n'est disponible pour cette transmission.",
      });
    }

    const submittedToIds = new Map();
    [request.user._id, ...rhUsers.map((user) => user._id)].forEach((id) => submittedToIds.set(String(id), id));

    instance.status = 'Soumis a RH';
    instance.submitted_to_role = 'rh';
    instance.submitted_to_user_ids = Array.from(submittedToIds.values());
    instance.submitted_to_names = [request.user.name, ...rhUsers.map((user) => user.name)].filter(Boolean);
    instance.submitted_at = new Date();
    instance.last_saved_at = new Date();
    await instance.save();

    const submitter = await User.findById(instance.evalue_id).select('_id name first_name last_name grade department');
    const missionResults = await buildAssociateMissionResults(instance, submitter, request.user._id);

    return response.json({
      message: `Évaluation transmise à la RH (${rhUsers.map((user) => user.name).join(', ')}).`,
      ...buildAssociateIncomingEvaluationPayload(instance, submitter, request.user._id, missionResults),
    });
  },
  async getAssociateManagerEvaluations(request, response) {
    const managers = await User.find({
      is_active: true,
      $or: [
        { code_categorie: { $in: ['10B', '10C'] } },
        { department: /^RH$/i },
      ],
      $nor: [{ department: /^CAPITAL HUMAIN$/i }],
    }).select('_id name grade department code_categorie');
    const managersById = new Map(managers.map((manager) => [String(manager._id), manager]));
    const managerIds = managers.map((manager) => manager._id);
    const managerSelfEvaluations = await EvaluationInstance.find({
      cycle_label: getCurrentCycleLabel(),
      evalue_id: { $in: managerIds },
      template_type: { $in: ['manager-self-evaluation', 'rh-self-evaluation'] },
    }).select('_id evalue_id template_type status submitted_at sections mission_evaluations');

    const selfEvaluationByManagerId = new Map(
      managerSelfEvaluations
        .filter((instance) => instance.template_type === getAssociateManagerSelfTemplateType(managersById.get(String(instance.evalue_id))))
        .map((instance) => [String(instance.evalue_id), instance])
    );
    const associateReviews = managerIds.length
      ? await AssociateManagerReview.find({
          cycle_label: getCurrentCycleLabel(),
          associate_id: request.user._id,
          manager_id: { $in: managerIds },
        }).select('associate_id manager_id sections mission_reviews associate_note last_saved_at')
      : [];

    const reviewByManagerId = new Map(associateReviews.map((review) => [String(review.manager_id), review]));

    const items = managers
      .map((manager) => {
        const managerId = String(manager._id);
        const associateReview = reviewByManagerId.get(managerId) || { associate_id: request.user._id, mission_reviews: [] };
        return buildAssociateManagerListItem(manager, selfEvaluationByManagerId.get(managerId), associateReview);
      })
      .filter(Boolean)
      .sort((left, right) => String(left.name || '').localeCompare(String(right.name || ''), 'fr', { sensitivity: 'base' }));

    return response.json({
      cycle_label: getCurrentCycleLabel(),
      items,
    });
  },
  async getAssociateManagerEvaluation(request, response) {
    const manager = await User.findById(request.params.managerId).select('_id name grade department code_categorie');

    if (!manager || !isAssociateManagerEvaluationTarget(manager)) {
      return response.status(404).json({ message: 'Manager introuvable.' });
    }

    const selfEvaluation = await EvaluationInstance.findOne({
      cycle_label: getCurrentCycleLabel(),
      evalue_id: manager._id,
      template_type: getAssociateManagerSelfTemplateType(manager),
    }).select('status submitted_at sections mission_evaluations');

    const associateReview = await getOrCreateAssociateManagerReview(request.user, manager, selfEvaluation);

    return response.json(buildAssociateManagerPayload(manager, selfEvaluation, associateReview));
  },
  async saveAssociateManagerEvaluation(request, response) {
    const manager = await User.findById(request.params.managerId).select('_id name grade department code_categorie');

    if (!manager || !isAssociateManagerEvaluationTarget(manager)) {
      return response.status(404).json({ message: 'Manager introuvable.' });
    }

    const selfEvaluation = await EvaluationInstance.findOne({
      cycle_label: getCurrentCycleLabel(),
      evalue_id: manager._id,
      template_type: getAssociateManagerSelfTemplateType(manager),
    }).select('status submitted_at sections mission_evaluations');

    const associateReview = await getOrCreateAssociateManagerReview(request.user, manager, selfEvaluation);
    const rawSections = Array.isArray(request.body?.sections) ? request.body.sections : [];
    const rawMissionReviews = Array.isArray(request.body?.missions) ? request.body.missions : [];

    if (rawSections.length) {
      associateReview.sections = toPersistenceSections(normalizeSections(rawSections));
    }

    if (rawMissionReviews.length) {
      const incomingMissionMap = new Map(normalizeMissionReviews(rawMissionReviews).map((mission) => [mission.mission_id, mission]));
      const availableMissionIds = new Set(
        getAssociateManagerAvailableMissions(selfEvaluation, request.user._id).map((mission) => String(mission.mission_id))
      );
      associateReview.mission_reviews = normalizeMissionReviews(associateReview.mission_reviews || []).map((mission) =>
        availableMissionIds.has(mission.mission_id) && incomingMissionMap.has(mission.mission_id)
          ? incomingMissionMap.get(mission.mission_id)
          : mission
      );
    }


    associateReview.associate_note = String(request.body?.note || '').trim();
    associateReview.last_saved_at = new Date();
    await associateReview.save();

    return response.json({
      message: "Évaluation de l'associé enregistrée.",
      ...buildAssociateManagerPayload(manager, selfEvaluation, associateReview),
    });
  },
  async submitAssociateManagerEvaluationToRh(request, response) {
    const manager = await User.findById(request.params.managerId).select('_id name grade department code_categorie');

    if (!manager || !isAssociateManagerEvaluationTarget(manager)) {
      return response.status(404).json({ message: 'Manager introuvable.' });
    }

    const selfEvaluation = await EvaluationInstance.findOne({
      cycle_label: getCurrentCycleLabel(),
      evalue_id: manager._id,
      template_type: getAssociateManagerSelfTemplateType(manager),
    }).select('status submitted_at sections mission_evaluations');

    const associateReview = await getOrCreateAssociateManagerReview(request.user, manager, selfEvaluation);
    const rawMissionReviews = Array.isArray(request.body?.missions) ? request.body.missions : [];

    if (rawMissionReviews.length) {
      const incomingMissionMap = new Map(normalizeMissionReviews(rawMissionReviews).map((mission) => [mission.mission_id, mission]));
      const availableMissionIds = new Set(
        getAssociateManagerAvailableMissions(selfEvaluation, request.user._id).map((mission) => String(mission.mission_id))
      );
      associateReview.mission_reviews = normalizeMissionReviews(associateReview.mission_reviews || []).map((mission) =>
        availableMissionIds.has(mission.mission_id) && incomingMissionMap.has(mission.mission_id)
          ? incomingMissionMap.get(mission.mission_id)
          : mission
      );
    }

    const missions = normalizeMissionReviews(associateReview.mission_reviews || []);
    const hasIncompleteMission = missions.some((mission) =>
      (mission.criteria || []).some((criterion) => typeof criterion.score !== 'number')
    );

    if (!missions.length) {
      return response.status(400).json({ message: "Aucune mission manager n'est disponible pour transmission à la RH." });
    }

    if (hasIncompleteMission) {
      return response.status(400).json({ message: 'Toutes les notes de la mission manager doivent être renseignées avant transmission à la RH.' });
    }

    const hasMissingSectionComment = missions.some((mission) => {
      const commentsBySection = new Map();

      (mission.criteria || []).forEach((criterion) => {
        const sectionTitle = String(criterion.section_title || 'Mission').trim() || 'Mission';
        if (!commentsBySection.has(sectionTitle)) {
          commentsBySection.set(sectionTitle, '');
        }

        const comment = String(criterion.section_comment || '').trim();
        if (comment) {
          commentsBySection.set(sectionTitle, comment);
        }
      });

      return Array.from(commentsBySection.values()).some((comment) => comment.length < 3);
    });

    if (hasMissingSectionComment) {
      return response.status(400).json({ message: 'Un commentaire est obligatoire pour chaque section avant transmission à la RH.' });
    }

    associateReview.associate_note = String(request.body?.note || associateReview.associate_note || '').trim();
    associateReview.status = 'Soumis à RH';
    associateReview.submitted_at = new Date();
    associateReview.last_saved_at = new Date();
    await associateReview.save();

    return response.json({
      message: "Évaluation du manager transmise à la RH.",
      ...buildAssociateManagerPayload(manager, selfEvaluation, associateReview),
    });
  },
  async getAssociateSupportEvaluations(request, response) {
    const supportUsers = await User.find({
      is_active: true,
      email: { $in: SUPPORT_EMAILS },
    }).select('_id name first_name last_name email grade department code_categorie');
    const supportIds = supportUsers.map((user) => user._id);
    const selfEvaluations = supportIds.length
      ? await EvaluationInstance.find({
          cycle_label: getCurrentCycleLabel(),
          evalue_id: { $in: supportIds },
          template_type: 'support-self-evaluation',
        }).select('_id evalue_id status submitted_at sections peer_review_sections peer_review_comment peer_review_comment_saved_at')
      : [];
    const selfEvaluationByUserId = new Map(selfEvaluations.map((instance) => [String(instance.evalue_id), instance]));

    return response.json({
      cycle_label: getCurrentCycleLabel(),
      items: supportUsers
        .map((supportUser) => buildAssociateSupportListItem(supportUser, selfEvaluationByUserId.get(String(supportUser._id))))
        .sort((left, right) => String(left.name || '').localeCompare(String(right.name || ''), 'fr', { sensitivity: 'base' })),
    });
  },
  async getAssociateSupportEvaluation(request, response) {
    const supportUser = await User.findById(request.params.supportId).select(
      '_id name first_name last_name email grade department code_categorie'
    );

    if (!supportUser || !isSupportEvaluationTarget(supportUser)) {
      return response.status(404).json({ message: 'Membre du service support introuvable.' });
    }

    let selfEvaluation = await EvaluationInstance.findOne({
      cycle_label: getCurrentCycleLabel(),
      evalue_id: supportUser._id,
      template_type: 'support-self-evaluation',
    }).select('_id evalue_id status submitted_at sections peer_review_sections peer_review_comment peer_review_comment_saved_at');

    const syncedSelfEvaluation = await syncSupportSelfEvaluationWithTemplate(selfEvaluation, supportUser);

    return response.json(buildAssociateSupportPayload(supportUser, syncedSelfEvaluation));
  },
  async saveAssociateSupportEvaluation(request, response) {
    const supportUser = await User.findById(request.params.supportId).select(
      '_id name first_name last_name email grade department code_categorie'
    );

    if (!supportUser || !isSupportEvaluationTarget(supportUser)) {
      return response.status(404).json({ message: 'Membre du service support introuvable.' });
    }

    const selfEvaluation = await EvaluationInstance.findOne({
      cycle_label: getCurrentCycleLabel(),
      evalue_id: supportUser._id,
      template_type: 'support-self-evaluation',
    }).select('_id evalue_id status submitted_at sections peer_review_sections peer_review_comment peer_review_comment_saved_at');

    if (!selfEvaluation) {
      return response.status(404).json({ message: "Auto-évaluation support introuvable." });
    }

    selfEvaluation = await syncSupportSelfEvaluationWithTemplate(selfEvaluation, supportUser);

    const rawSections = Array.isArray(request.body?.sections) ? request.body.sections : [];
    if (rawSections.length) {
      selfEvaluation.peer_review_sections = toPersistenceSections(normalizeSections(rawSections));
    }

    selfEvaluation.peer_review_comment = String(request.body?.note || '').trim();
    selfEvaluation.peer_review_comment_by_user_id = request.user._id;
    selfEvaluation.peer_review_comment_by_name =
      [request.user?.first_name, request.user?.last_name].filter(Boolean).join(' ').trim() || request.user?.name || '';
    selfEvaluation.peer_review_comment_saved_at = new Date();
    await selfEvaluation.save();

    return response.json({
      message: "Évaluation support enregistrée.",
      ...buildAssociateSupportPayload(supportUser, selfEvaluation),
    });
  },
  async getAssociateSyntheses(_request, response) {
    const rhUserIds = await resolveRhQueueUserIds();
    const [rows, assistantRhRows] = await Promise.all([
      loadRhReviewDataset(rhUserIds),
      loadAssistantRhSelfDataset(rhUserIds),
    ]);

    const items = [...rows, ...assistantRhRows]
      .filter((row) => row.status === 'Validé RH' || row.status === `Transmis à l'associe` || row.status === 'Clôture')
      .map((row) => ({
        ...row,
        initials: getInitials(row.name),
        grade: row.role,
      }))
      .sort((left, right) => {
        const leftDate = left.submittedAt ? new Date(left.submittedAt).getTime() : 0;
        const rightDate = right.submittedAt ? new Date(right.submittedAt).getTime() : 0;

        if (rightDate !== leftDate) {
          return rightDate - leftDate;
        }

        return String(left.name || '').localeCompare(String(right.name || ''), 'fr', { sensitivity: 'base' });
      });

    return response.json({
      cycle_label: getCurrentCycleLabel(),
      items,
    });
  },
  getAssociateOverview,
};
