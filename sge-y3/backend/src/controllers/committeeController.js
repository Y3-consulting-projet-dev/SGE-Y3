const User = require('../models/User');
const CommitteeDecision = require('../models/CommitteeDecision');

const SUPPORT_COMMITTEE_EMAILS = [
  'fleur.nguessan@ycubeac.com',
  'porthela.kakou@ycubeac.com',
  'aziz.ouattara@ycubeac.com',
  'adele.creppy@ycubeac.com',
];

function normalizeName(value = '') {
  return String(value).replace(/\s+/g, ' ').trim().toUpperCase();
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
  const scope = ['leadership', 'support', 'committee'].includes(requestedScope) ? requestedScope : 'collaborators';
  const query = {
    is_active: true,
    $or: [
      { grade: { $in: ['Assistant', 'Senior', 'Assistant manager'] } },
      { department: 'SERVICE SUPPORT' },
      { department: 'CAPITAL HUMAIN' },
    ],
  };

  let users = await User.find(query)
    .sort({ grade: 1, last_name: 1, first_name: 1 })
    .select('_id name first_name last_name grade department');

  if (scope === 'collaborators') {
    users = users.filter((user) => normalizeName(user.department || '') !== 'RH');
  }

  if (scope === 'leadership') {
    users = await User.find({
      is_active: true,
      $or: [{ grade: { $in: ['Manager', 'Senior manager'] } }, { department: 'RH' }],
    })
      .sort({ last_name: 1, first_name: 1 })
      .select('_id name first_name last_name grade department');
  }

  if (scope === 'support') {
    users = await User.find({
      is_active: true,
      email: { $in: SUPPORT_COMMITTEE_EMAILS },
    })
      .sort({ last_name: 1, first_name: 1 })
      .select('_id name first_name last_name grade department');
  }

  if (scope === 'committee') {
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
  getLatestCommitteeDecision,
  listCommitteeParticipants,
  saveCommitteeDecision,
};
