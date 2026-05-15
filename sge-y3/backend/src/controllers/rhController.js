const User = require('../models/User');
const EvaluationInstance = require('../models/EvaluationInstance');
const ManagerMemberReview = require('../models/ManagerMemberReview');
const matrixData = require('../data/competencyMatrix.generated.json');
const { buildEvaluationTemplateForUser } = require('../utils/competencyMatrix');
const {
  getQuestionnaireSourceSheets,
  readQuestionnaireConfig,
  writeQuestionnaireConfig,
} = require('../utils/questionnaireConfig');
const {
  getAverageScore,
  getEvaluationSummary,
  getOverallAverageScore,
  normalizeSections,
  validateSectionsForSubmit,
} = require('../utils/evaluationHelpers');

const CURRENT_CYCLE_LABEL = 'Cycle 2026';
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

function normalizeText(value = '') {
  return String(value || '').replace(/\s+/g, ' ').trim().toUpperCase();
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

async function getOrCreateRhSelfEvaluation(user) {
  let instance = await EvaluationInstance.findOne({
    evalue_id: user._id,
    cycle_label: CURRENT_CYCLE_LABEL,
    template_type: 'rh-self-evaluation',
  });

  const templateSections = cloneRhSelfTemplate(user);

  if (!instance) {
    instance = await EvaluationInstance.create({
      cycle_label: CURRENT_CYCLE_LABEL,
      evalue_id: user._id,
      status: 'En cours',
      template_type: 'rh-self-evaluation',
      submitted_to_role: 'associate',
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

function buildRhSelfEvaluationPayload(instance, user, associateRecipients = []) {
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
    submitted_to: associateRecipients.map((recipient) => ({
      id: recipient._id.toString(),
      name: recipient.name,
      department: recipient.department,
      grade: recipient.grade,
    })),
  };
}

function getExpectedTemplateType(member) {
  return member?.code_categorie === '8C' ? 'assistant-self-evaluation' : 'senior-self-evaluation';
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

function getPriorityStatus(finalScore, unjustifiedLowScores) {
  if (unjustifiedLowScores > 0) {
    return 'Ecart a arbitrer';
  }

  if (typeof finalScore === 'number' && finalScore < 3) {
    return 'A completer';
  }

  return 'A valider RH';
}

function getRhDisplayStatus(review, unjustifiedLowScores, finalScore) {
  if (review.status === 'Cloture' || review.status === 'Valide RH') return 'Valide';
  if (review.rh_validation_selected) return 'A valider RH';
  return getPriorityStatus(finalScore, unjustifiedLowScores);
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
    .flatMap((section) => (section.pages || []).map((page) => String(page.comment || '').trim()))
    .filter(Boolean)
    .slice(0, 2);

  if (comments.length) {
    return comments.join(' ');
  }

  return managerName
    ? `Evaluateur : ${managerName}. Les scores sont consultables par la RH pour verifier la coherence de l'evaluation.`
    : "Les scores sont consultables par la RH pour verifier la coherence de l'evaluation.";
}

async function loadRhReviewDataset(rhUserId) {
  const reviews = await ManagerMemberReview.find({
    cycle_label: CURRENT_CYCLE_LABEL,
    submitted_to_user_ids: rhUserId,
  }).select(
    'member_id manager_id member_department status submitted_at sections rh_validation_selected rh_validation_selected_at rh_validated_at'
  );

  const memberIds = reviews.map((review) => review.member_id).filter(Boolean);
  const managerIds = reviews.map((review) => review.manager_id).filter(Boolean);
  const [users, populationMembers, departmentManagers] = await Promise.all([
    User.find({
      _id: { $in: [...memberIds, ...managerIds] },
    }).select('_id name first_name last_name grade department code_categorie'),
    User.find({
      is_active: true,
      code_categorie: { $in: ['8C', '9A', '9B', '10B', '10C'] },
      department: { $nin: ['RH', 'CAPITAL HUMAIN'] },
    }).select('_id name first_name last_name grade department code_categorie'),
    User.find({
      is_active: true,
      code_categorie: { $in: ['9B', '10B', '10C'] },
      department: { $nin: ['RH', 'CAPITAL HUMAIN'] },
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
    ? await EvaluationInstance.find({ $or: selfEvaluationQueries }).select('evalue_id sections')
    : [];
  const selfEvaluationByMemberId = new Map(selfEvaluations.map((instance) => [String(instance.evalue_id), instance]));
  const reviewByMemberId = new Map(reviews.map((review) => [String(review.member_id), review]));
  const departmentManagersByDepartment = new Map();

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
    const selfSections = normalizeSections(selfEvaluation?.sections || []);
    const selfScore = getOverallAverageScore(selfSections);
    const managerScore = getOverallAverageScore(sections);
    const finalScore = managerScore;
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
      managerScore,
      finalScore,
      status: review?.status || 'En attente',
      submittedAt: review?.submitted_at || null,
      unjustifiedLowScores,
      displayStatus: review ? getRhDisplayStatus(review, unjustifiedLowScores, finalScore) : 'En attente',
      rhValidationSelected: Boolean(review?.rh_validation_selected),
      sectionSummaries,
      commentSummary,
      gap,
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
      selfScore: row.selfScore,
      managerScore: row.managerScore,
      finalScore: row.finalScore,
      status: row.displayStatus,
      rhValidationSelected: row.rhValidationSelected,
      commentSummary: row.commentSummary,
      sectionSummaries: row.sectionSummaries,
      gap: row.gap,
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
  const rhUserId = request.user._id;

  const [managerSelfEvaluations, evaluatedPopulation, reviewRows] = await Promise.all([
    EvaluationInstance.find({
      cycle_label: CURRENT_CYCLE_LABEL,
      template_type: 'manager-self-evaluation',
      submitted_to_user_ids: rhUserId,
    }).select('evalue_id status submitted_at sections'),
    User.find({
      is_active: true,
      code_categorie: { $in: ['8C', '9A', '9B', '10B', '10C'] },
      department: { $nin: ['RH', 'CAPITAL HUMAIN'] },
    }).select('_id'),
    loadRhReviewDataset(rhUserId),
  ]);

  const receivedCount =
    reviewRows.filter((item) => RH_RELEVANT_STATUSES.includes(item.status)).length +
    managerSelfEvaluations.filter((item) => RH_RELEVANT_STATUSES.includes(item.status)).length;
  const totalEvaluatedPopulation = evaluatedPopulation.length;
  const pendingRhItems = reviewRows.filter((item) => item.status === 'Soumis a RH');
  const readySynthesesCount = reviewRows.filter((item) => item.status === 'Valide RH' || item.status === 'Cloture').length;
  const priorityRows = reviewRows
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

  reviewRows.forEach((row) => {
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
        title: 'Evaluations recues',
        value: `${receivedCount}/${totalEvaluatedPopulation}`,
        subtitle: totalEvaluatedPopulation
          ? `${Math.round((receivedCount / totalEvaluatedPopulation) * 100)}% du cycle ${CURRENT_CYCLE_LABEL.replace('Cycle ', '')}`
          : `0% du cycle ${CURRENT_CYCLE_LABEL.replace('Cycle ', '')}`,
      },
      {
        title: 'A valider RH',
        value: String(pendingRhItems.length),
        subtitle: pendingRhItems.length ? `Dont ${priorityRows.length} prioritaire(s)` : 'Aucune en attente',
      },
      {
        title: 'Syntheses pretes',
        value: String(readySynthesesCount),
        subtitle: 'Transmission Associe',
      },
      {
        title: 'Entretiens planifies',
        value: '0',
        subtitle: 'Donnee non planifiee',
      },
    ],
    priority_rows: priorityRows,
    department_averages: departmentAverages,
  });
}

async function getRhDepartmentEvaluations(request, response) {
  const rows = await loadRhReviewDataset(request.user._id);
  const groups = buildDepartmentGroups(rows);

  return response.json({
    cycle_label: CURRENT_CYCLE_LABEL,
    departments: groups,
  });
}

async function selectRhDepartmentEvaluation(request, response) {
  const review = await ManagerMemberReview.findOne({
    _id: request.params.reviewId,
    cycle_label: CURRENT_CYCLE_LABEL,
    submitted_to_user_ids: request.user._id,
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
  const rows = await loadRhReviewDataset(request.user._id);
  const items = rows.filter((row) => row.status === 'Soumis a RH' && row.rhValidationSelected);

  return response.json({
    cycle_label: CURRENT_CYCLE_LABEL,
    items,
  });
}

async function validateRhSelection(request, response) {
  const reviewIds = Array.isArray(request.body?.reviewIds)
    ? request.body.reviewIds.map((id) => String(id || '').trim()).filter(Boolean)
    : [];

  if (!reviewIds.length) {
    return response.status(400).json({
      message: 'Aucune evaluation selectionnee.',
    });
  }

  const reviews = await ManagerMemberReview.find({
    _id: { $in: reviewIds },
    cycle_label: CURRENT_CYCLE_LABEL,
    submitted_to_user_ids: request.user._id,
  });

  for (const review of reviews) {
    review.status = 'Valide RH';
    review.rh_validation_selected = false;
    review.rh_validated_at = new Date();
  }

  await Promise.all(reviews.map((review) => review.save()));

  return response.json({
    message: 'Selection RH validee. Les evaluations sont maintenant dans les syntheses a transmettre.',
  });
}

async function getRhSyntheses(request, response) {
  const rows = await loadRhReviewDataset(request.user._id);
  const items = rows.filter((row) => row.status === 'Valide RH' || row.status === 'Cloture');

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

async function saveMyRhSelfEvaluation(request, response) {
  const instance = await getOrCreateRhSelfEvaluation(request.user);
  const normalizedIncomingSections = normalizeSections(request.body?.sections || []);

  if (!normalizedIncomingSections.length) {
    return response.status(400).json({ message: "Aucune section RH a sauvegarder." });
  }

  instance.sections = toPersistenceSections(normalizedIncomingSections);
  instance.status = 'En cours';
  instance.last_saved_at = new Date();
  await instance.save();

  const associateRecipients = await resolveAssociateRecipients();

  return response.json({
    message: "Auto-evaluation RH enregistree.",
    ...buildRhSelfEvaluationPayload(instance, request.user, associateRecipients),
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

async function getRhCalibration(request, response) {
  const rows = await loadRhReviewDataset(request.user._id);
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
  const rows = await loadRhReviewDataset(request.user._id);
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
        title: 'Synthese RH validee',
        format: 'PDF',
        owner: 'RH',
        status: syntheses.items.length ? 'Pret' : 'A generer',
      },
      {
        title: 'File de validations RH',
        format: 'XLSX',
        owner: 'RH',
        status: validations.items.length ? 'Pret' : 'A generer',
      },
      {
        title: 'Calibration des departements',
        format: 'PDF',
        owner: 'RH',
        status: calibration.items.length ? 'Pret' : 'A generer',
      },
      {
        title: 'Suivi population cycle 2026',
        format: 'XLSX',
        owner: 'RH',
        status: population.groups.length ? 'Pret' : 'A generer',
      },
    ],
  });
}

module.exports = {
  addRhQuestionnaireQuestion,
  createRhQuestionnaireSection,
  getRhCalibration,
  getRhDepartmentEvaluations,
  getRhQuestionnaire,
  getMyRhSelfEvaluation,
  getRhOverview,
  getRhPopulation,
  getRhReports,
  getRhSyntheses,
  getRhValidations,
  saveMyRhSelfEvaluation,
  selectRhDepartmentEvaluation,
  submitMyRhSelfEvaluation,
  validateRhSelection,
};
