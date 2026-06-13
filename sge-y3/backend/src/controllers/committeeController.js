const User = require('../models/User');
const CommitteeDecision = require('../models/CommitteeDecision');
const EvaluationInstance = require('../models/EvaluationInstance');
const ManagerMemberReview = require('../models/ManagerMemberReview');
const SeniorAssistantReview = require('../models/SeniorAssistantReview');
const { getOverallAverageScore } = require('../utils/evaluationHelpers');


const DEFAULT_CYCLE_LABEL = 'Cycle 2025-2026';

function normalizeName(value = '') {
  return String(value).replace(/\s+/g, ' ').trim().toUpperCase();
}

function scoreToLevel(score) {
  if (score === null || score === undefined) return null;
  const s = Number(score);
  if (isNaN(s)) return null;
  if (s <= 2.0) return 'CA';
  if (s <= 3.0) return 'CB';
  if (s <= 4.0) return 'CC';
  return 'CD';
}

function buildParticipant(user, score = null) {
  const grade = user.grade || 'Collaborateur';
  const name = [user.first_name, user.last_name].filter(Boolean).join(' ').trim() || user.name;
  const numericScore = score !== null && score !== undefined ? Number(score) : null;

  return {
    id: user._id.toString(),
    name,
    role: grade,
    department: user.department || '',
    manager: '',
    score: numericScore !== null ? String(numericScore) : '-',
    level: scoreToLevel(numericScore),
  };
}

async function buildScoreMap(userIds, scope, cycleLabel) {
  const scoreMap = new Map();

  if (scope === 'leadership') {
    const instances = await EvaluationInstance.find({
      evalue_id: { $in: userIds },
      cycle_label: cycleLabel,
    })
      .select('evalue_id sections')
      .lean();

    for (const inst of instances) {
      const avg = getOverallAverageScore(inst.sections || []);
      if (avg !== null) scoreMap.set(inst.evalue_id.toString(), avg);
    }
  } else {
    // collaborators or support: ManagerMemberReview > SeniorAssistantReview > EvaluationInstance
    const [managerReviews, seniorReviews, instances] = await Promise.all([
      ManagerMemberReview.find({ member_id: { $in: userIds }, cycle_label: cycleLabel })
        .select('member_id sections')
        .lean(),
      SeniorAssistantReview.find({ assistant_id: { $in: userIds }, cycle_label: cycleLabel })
        .select('assistant_id sections')
        .lean(),
      EvaluationInstance.find({ evalue_id: { $in: userIds }, cycle_label: cycleLabel })
        .select('evalue_id sections')
        .lean(),
    ]);

    for (const review of managerReviews) {
      const avg = getOverallAverageScore(review.sections || []);
      if (avg !== null) scoreMap.set(review.member_id.toString(), avg);
    }
    for (const review of seniorReviews) {
      const id = review.assistant_id.toString();
      if (!scoreMap.has(id)) {
        const avg = getOverallAverageScore(review.sections || []);
        if (avg !== null) scoreMap.set(id, avg);
      }
    }
    for (const inst of instances) {
      const id = inst.evalue_id.toString();
      if (!scoreMap.has(id)) {
        const avg = getOverallAverageScore(inst.sections || []);
        if (avg !== null) scoreMap.set(id, avg);
      }
    }
  }

  return scoreMap;
}

async function listCommitteeParticipants(request, response) {
  const requestedScope = String(request.query?.scope || 'collaborators');
  const scope = ['leadership', 'support', 'committee'].includes(requestedScope) ? requestedScope : 'collaborators';
  const cycleLabel = String(request.query?.cycle_label || DEFAULT_CYCLE_LABEL);

  let users;

  if (scope === 'collaborators') {
    const query = {
      is_active: true,
      $or: [
        { grade: { $in: ['Assistant', 'Senior', 'Assistant manager'] } },
        { department: 'SERVICE SUPPORT' },
        { department: 'CAPITAL HUMAIN' },
      ],
    };
    users = await User.find(query)
      .sort({ grade: 1, last_name: 1, first_name: 1 })
      .select('_id name first_name last_name grade department');
    users = users.filter((user) => normalizeName(user.department || '') !== 'RH');
  } else if (scope === 'leadership') {
    users = await User.find({
      is_active: true,
      $or: [{ grade: { $in: ['Manager', 'Senior manager'] } }, { department: 'RH' }],
    })
      .sort({ last_name: 1, first_name: 1 })
      .select('_id name first_name last_name grade department');
  } else if (scope === 'support') {
    users = await User.find({
      is_active: true,
      department: 'SUPPORT',
    })
      .sort({ last_name: 1, first_name: 1 })
      .select('_id name first_name last_name grade department');
  } else {
    // committee scope — no score classification needed, just list members
    users = await User.find({ is_active: true })
      .sort({ last_name: 1, first_name: 1 })
      .select('_id name first_name last_name grade department code_categorie');

    users = users.filter((user) => {
      const normalizedDepartment = normalizeName(user.department || '');
      const normalizedGrade = normalizeName(user.grade || '');
      const isLeadershipMember =
        normalizedDepartment === 'RH' || normalizedGrade === 'MANAGER' || normalizedGrade === 'SENIOR MANAGER';
      const isAssociate =
        String(user.code_categorie || '').trim() === '11' ||
        normalizedGrade === 'ASSOCIÉ' ||
        normalizedGrade === 'ASSOCIE';

      return isLeadershipMember || isAssociate;
    });

    return response.json({
      participants: users.map((user) => buildParticipant(user, null)),
    });
  }

  const userIds = users.map((u) => u._id);
  const scoreMap = await buildScoreMap(userIds, scope, cycleLabel);

  return response.json({
    participants: users.map((user) => buildParticipant(user, scoreMap.get(user._id.toString()) ?? null)),
  });
}

async function saveCommitteeDecision(request, response) {
  const scope = String(request.body?.scope || 'associate-final').trim();
  const decisions = request.body?.decisions;

  if (!decisions || typeof decisions !== 'object') {
    return response.status(400).json({
      message: 'La décision du comité est requise.',
    });
  }

  const submittedByName = [request.user?.first_name, request.user?.last_name].filter(Boolean).join(' ').trim() || request.user?.name || '';
  const decision = await CommitteeDecision.create({
    cycle_label: request.body?.cycle_label || DEFAULT_CYCLE_LABEL,
    scope,
    decisions,
    submitted_by: request.user?._id || null,
    submitted_by_name: submittedByName,
    submitted_at: new Date(),
  });

  return response.status(201).json({
    message: 'Décision du comité envoyée à la RH.',
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
  getLatestCommitteeDecision,
  listCommitteeParticipants,
  saveCommitteeDecision,
};
