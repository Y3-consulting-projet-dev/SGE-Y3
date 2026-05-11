const User = require('../models/User');

function buildParticipant(user) {
  const grade = user.grade || 'Collaborateur';
  const name = [user.first_name, user.last_name].filter(Boolean).join(' ').trim() || user.name;

  return {
    id: user._id.toString(),
    name,
    role: grade,
    department: user.department || '',
    manager: '',
    score: '-',
    level: grade === 'Senior' ? 'CC' : 'CB',
  };
}

async function listCommitteeParticipants(_request, response) {
  const users = await User.find({
    is_active: true,
    grade: { $in: ['Assistant', 'Senior'] },
  })
    .sort({ grade: 1, last_name: 1, first_name: 1 })
    .select('_id name first_name last_name grade department');

  return response.json({
    participants: users.map(buildParticipant),
  });
}

module.exports = {
  listCommitteeParticipants,
};
