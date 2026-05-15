const User = require('../models/User');
const CommitteeDecision = require('../models/CommitteeDecision');
const EvaluationInstance = require('../models/EvaluationInstance');
const ManagerMemberReview = require('../models/ManagerMemberReview');
const { getOverallAverageScore, normalizeSections } = require('../utils/evaluationHelpers');
const { CURRENT_CYCLE_LABEL, RH_RELEVANT_STATUSES } = require('./rhController');

const LEADERSHIP_COMMITTEE_NAMES = [
  'ISABELLA BEDA',
  'REVITA OULE',
  'AUGUSTIN KPANTCHE',
  'STEPHANE GNAHOUA',
  'AXELLE AMANI',
  'STEPHANIE TAKI',
];
const SUPPORT_COMMITTEE_EMAILS = [
  'fleur.nguessan@ycubeac.com',
  'porthela.kakou@ycubeac.com',
  'aziz.ouattara@ycubeac.com',
  'adele.creppy@ycubeac.com',
];
const READY_FOR_ASSOCIATE_STATUSES = ['Valide RH', 'Cloture'];
const COMMITTEE_LEVEL_TO_DECISION = {
  CA: { label: 'Promotion', color: 'bg-[#C53B3B]' },
  CB: { label: 'Augmentation', color: 'bg-[#4D3AC5]' },
  CC: { label: 'Maintien', color: 'bg-[#4D3AC5]' },
  CD: { label: 'Formation obligatoire', color: 'bg-[#4D3AC5]' },
};

function normalizeName(value = '') {
  return String(value).replace(/\s+/g, ' ').trim().toUpperCase();
}

function formatDepartmentLabel(department = '') {
  const normalized = normalizeName(department);

  if (normalized === 'AUDIT') return 'Audit';
  if (normalized === 'EXPERTISE COMPTABLE') return 'Comptabilite';
  if (normalized === 'AUDIT & EXPERTISE COMPTABLE') return 'Audit & Expertise comptable';
  if (normalized === 'CONSEIL FINANCIER') return 'Conseil Financier';
  if (normalized === 'CONSEIL OPERATIONNEL') return 'Conseil Operationnel';
  if (normalized === 'CAPITAL HUMAIN') return 'Capital Humain';

  return String(department || '').trim() || 'Non renseigne';
}

function getInitials(name = '') {
  const words = String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (!words.length) return '--';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();

  return `${words[0][0] || ''}${words[1][0] || ''}`.toUpperCase();
}

function buildDecidedNameSet(decision) {
  const decidedNames = new Set();

  Object.values(decision?.decisions || {}).forEach((group) => {
    if (!Array.isArray(group)) return;

    group.forEach((person) => {
      const personName = normalizeName(person?.name || '');
      if (personName) {
        decidedNames.add(personName);
      }
    });
  });

  return decidedNames;
}

function buildDecisionSplit(decision) {
  const totalClassified = Object.keys(COMMITTEE_LEVEL_TO_DECISION).reduce((total, levelKey) => {
    const count = Array.isArray(decision?.decisions?.[levelKey]) ? decision.decisions[levelKey].length : 0;
    return total + count;
  }, 0);

  return Object.entries(COMMITTEE_LEVEL_TO_DECISION).map(([levelKey, meta]) => {
    const count = Array.isArray(decision?.decisions?.[levelKey]) ? decision.decisions[levelKey].length : 0;
    const width = totalClassified ? `${Math.max(Math.round((count / totalClassified) * 100), count ? 12 : 0)}%` : '0%';

    return {
      label: meta.label,
      count,
      width,
      color: meta.color,
    };
  });
}

function getExpectedTemplateType(member) {
  return member?.code_categorie === '8C' ? 'assistant-self-evaluation' : 'senior-self-evaluation';
}

async function loadAssociateReviewDataset() {
  const reviews = await ManagerMemberReview.find({
    cycle_label: CURRENT_CYCLE_LABEL,
    status: { $in: RH_RELEVANT_STATUSES },
  }).select('member_id manager_id member_department status submitted_at sections');

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
    }).select('_id name first_name last_name grade department code_categorie'),
  ]);

  const userById = new Map(users.map((user) => [String(user._id), user]));
  const selfEvaluationQueries = populationMembers.map((member) => ({
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
    const member = reviewMember || populationMember;
    const fallbackManager = reviewManager || departmentManagersByDepartment.get(String(member?.department || ''));
    const sections = normalizeSections(review?.sections || []);
    const selfSections = normalizeSections(selfEvaluationByMemberId.get(String(member._id))?.sections || []);

    return {
      id: review?._id?.toString?.() || `pending-${member._id.toString()}`,
      memberId: member?._id?.toString?.() || '',
      name: member?.name || 'Collaborateur',
      role: member?.grade || 'Collaborateur',
      department: member?.department || review?.member_department || '',
      managerName: fallbackManager?.name || 'Non soumis',
      selfScore: getOverallAverageScore(selfSections),
      finalScore: getOverallAverageScore(sections),
      status: review?.status || 'En attente',
      submittedAt: review?.submitted_at || null,
    };
  });
}

async function getCommitteeOverview(request, response) {
  const [associateUsers, reviewRows, latestDecision, managerSelfEvaluations, evaluatedPopulation] = await Promise.all([
    User.find({
      is_active: true,
      $or: [{ code_categorie: '11' }, { grade: 'Associé' }, { grade: 'Associe' }],
    }).select('_id'),
    loadAssociateReviewDataset(),
    CommitteeDecision.findOne({ scope: 'associate-final' }).sort({ submitted_at: -1 }),
    EvaluationInstance.find({
      cycle_label: CURRENT_CYCLE_LABEL,
      template_type: 'manager-self-evaluation',
      status: { $in: RH_RELEVANT_STATUSES },
    }).select('evalue_id status submitted_at sections'),
    User.find({
      is_active: true,
      code_categorie: { $in: ['8C', '9A', '9B', '10B', '10C'] },
      department: { $nin: ['RH', 'CAPITAL HUMAIN'] },
    }).select('_id'),
  ]);

  const associateIds = associateUsers.map((user) => user._id);
  const readySyntheses = reviewRows.filter((row) => READY_FOR_ASSOCIATE_STATUSES.includes(row.status));
  const decidedNames = buildDecidedNameSet(latestDecision);
  const collaboratorPendingDecisions = readySyntheses.filter((row) => !decidedNames.has(normalizeName(row.name)));
  const managerSelfUserIds = managerSelfEvaluations.map((instance) => instance.evalue_id).filter(Boolean);
  const managerUsers = managerSelfUserIds.length
    ? await User.find({ _id: { $in: managerSelfUserIds } }).select('_id name first_name last_name grade department')
    : [];
  const managerById = new Map(managerUsers.map((user) => [String(user._id), user]));

  const managerSelfRows = managerSelfEvaluations.map((instance) => {
    const managerUser = managerById.get(String(instance.evalue_id));
    const score = getOverallAverageScore(normalizeSections(instance.sections || []));
    const name =
      managerUser?.name ||
      [managerUser?.first_name, managerUser?.last_name].filter(Boolean).join(' ').trim() ||
      'Manager';

    return {
      id: instance._id.toString(),
      name,
      initials: getInitials(name),
      role: `${managerUser?.grade || 'Manager'} - Auto-eval`,
      department: managerUser?.department || '',
      score,
      status: instance.status,
      submittedAt: instance.submitted_at || null,
      decided: decidedNames.has(normalizeName(name)),
    };
  });

  const pendingManagerSelfRows = managerSelfRows
    .filter((row) => !row.decided)
    .sort((left, right) => {
      if (left.score !== null && right.score !== null && left.score !== right.score) {
        return right.score - left.score;
      }

      return new Date(right.submittedAt || 0).getTime() - new Date(left.submittedAt || 0).getTime();
    });

  const departmentMap = new Map();

  readySyntheses.forEach((row) => {
    if (typeof row.finalScore !== 'number') return;
    const key = formatDepartmentLabel(row.department);
    const current = departmentMap.get(key) || { label: key, scores: [] };
    current.scores.push(row.finalScore);
    departmentMap.set(key, current);
  });

  const departmentScores = Array.from(departmentMap.values())
    .map((entry) => {
      const average = Number((entry.scores.reduce((total, score) => total + score, 0) / entry.scores.length).toFixed(1));
      return {
        label: entry.label,
        score: String(average),
        width: `${Math.max(Math.min((average / 5) * 100, 100), 0)}%`,
      };
    })
    .sort((left, right) => Number(right.score) - Number(left.score));

  return response.json({
    cycle_label: CURRENT_CYCLE_LABEL,
    header_subtitle: `Cycle ${CURRENT_CYCLE_LABEL.replace('Cycle ', '')} - Synthese globale`,
    summary_cards: [
      {
        title: 'Collaborateurs evalues',
        value: `${readySyntheses.length}/${evaluatedPopulation.length}`,
        subtitle: evaluatedPopulation.length
          ? `${Math.round((readySyntheses.length / evaluatedPopulation.length) * 100)}% du cabinet`
          : '0% du cabinet',
      },
      {
        title: 'Syntheses recues RH',
        value: String(readySyntheses.length),
        subtitle: 'Pretes pour decision',
      },
      {
        title: 'Decisions en attente',
        value: String(collaboratorPendingDecisions.length + pendingManagerSelfRows.length),
        subtitle: 'Action requise',
      },
      {
        title: 'Auto-evals Managers',
        value: String(managerSelfRows.length),
        subtitle: 'A examiner',
      },
    ],
    decision_split: buildDecisionSplit(latestDecision),
    decision_split_total: Object.values(latestDecision?.decisions || {}).reduce(
      (total, group) => total + (Array.isArray(group) ? group.length : 0),
      0
    ),
    urgent_decisions: pendingManagerSelfRows.slice(0, 5).map((row) => ({
      id: row.id,
      initials: row.initials,
      name: row.name,
      role: row.role,
      score: row.score === null ? '-' : `${row.score} / 5`,
    })),
    department_scores: departmentScores,
    latest_decision_at: latestDecision?.submitted_at || null,
    decision_recipient_count: associateIds.length,
  });
}

function buildParticipant(user, defaultLevel = null) {
  const grade = user.grade || 'Collaborateur';
  const name = [user.first_name, user.last_name].filter(Boolean).join(' ').trim() || user.name;

  return {
    id: user._id.toString(),
    name,
    role: grade,
    department: user.department || '',
    manager: '',
    score: '-',
    level: defaultLevel || (grade === 'Senior' ? 'CC' : 'CB'),
  };
}

async function listCommitteeParticipants(request, response) {
  const requestedScope = String(request.query?.scope || 'collaborators');
  const scope = ['leadership', 'support'].includes(requestedScope) ? requestedScope : 'collaborators';
  const query = {
    is_active: true,
    grade: { $in: ['Assistant', 'Senior', 'Assistant manager'] },
  };

  let users = await User.find(query)
    .sort({ grade: 1, last_name: 1, first_name: 1 })
    .select('_id name first_name last_name grade department');

  if (scope === 'leadership') {
    users = await User.find({ is_active: true })
      .sort({ last_name: 1, first_name: 1 })
      .select('_id name first_name last_name grade department');

    users = users.filter((user) => {
      const fullName = normalizeName([user.first_name, user.last_name].filter(Boolean).join(' ') || user.name);
      return LEADERSHIP_COMMITTEE_NAMES.includes(fullName);
    });
  }

  if (scope === 'support') {
    users = await User.find({
      is_active: true,
      email: { $in: SUPPORT_COMMITTEE_EMAILS },
    })
      .sort({ last_name: 1, first_name: 1 })
      .select('_id name first_name last_name grade department');
  }

  return response.json({
    participants: users.map((user) => buildParticipant(user, scope === 'leadership' ? 'CC' : null)),
  });
}

async function saveCommitteeDecision(request, response) {
  const scope = String(request.body?.scope || 'associate-final').trim();
  const decisions = request.body?.decisions;

  if (!decisions || typeof decisions !== 'object') {
    return response.status(400).json({
      message: 'La decision du comite est requise.',
    });
  }

  const submittedByName = [request.user?.first_name, request.user?.last_name].filter(Boolean).join(' ').trim() || request.user?.name || '';
  const decision = await CommitteeDecision.create({
    cycle_label: request.body?.cycle_label || 'Cycle 2025-2026',
    scope,
    decisions,
    submitted_by: request.user?._id || null,
    submitted_by_name: submittedByName,
    submitted_at: new Date(),
  });

  return response.status(201).json({
    message: 'Decision du comite envoyee a la RH.',
    decision,
  });
}

async function getLatestCommitteeDecision(request, response) {
  const scope = String(request.query?.scope || 'associate-final').trim();
  const decision = await CommitteeDecision.findOne({ scope }).sort({ submitted_at: -1 });

  return response.json({
    decision,
  });
}

module.exports = {
  getCommitteeOverview,
  getLatestCommitteeDecision,
  listCommitteeParticipants,
  saveCommitteeDecision,
};
