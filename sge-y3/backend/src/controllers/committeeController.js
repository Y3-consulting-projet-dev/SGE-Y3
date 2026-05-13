const User = require('../models/User');
const CommitteeDecision = require('../models/CommitteeDecision');

const LEADERSHIP_COMMITTEE_NAMES = [
  'ISABELLA SINCLAIR BEDA',
  'REVITA OULE',
  'AUGUSTIN KPANTCHE',
  'STEPHANE GNAHOUA',
  'AXELLE AMANI',
  'STEPHANIE TAKI',
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
  const scope = request.query?.scope === 'leadership' ? 'leadership' : 'collaborators';
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
    cycle_label: request.body?.cycle_label || 'Cycle 2026',
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
