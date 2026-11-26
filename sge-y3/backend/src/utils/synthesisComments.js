const SynthesisComment = require('../models/SynthesisComment');

const SYNTHESIS_COMMENT_MAX_LENGTH = 2000;

// Commentaires des associés sur les synthèses du cycle, regroupés par collaborateur.
async function loadSynthesisCommentsByMember(memberIds = [], cycleLabel) {
  const ids = [...new Set(memberIds.map((id) => String(id || '')).filter(Boolean))];
  if (!ids.length) {
    return new Map();
  }

  const comments = await SynthesisComment.find({ cycle_label: cycleLabel, member_id: { $in: ids } })
    .sort({ updated_at: 1 })
    .lean();

  const byMember = new Map();
  comments.forEach((item) => {
    const key = String(item.member_id);
    byMember.set(key, [...(byMember.get(key) || []), item]);
  });
  return byMember;
}

// Forme renvoyée au frontend ; isMine indique le commentaire de l'associé connecté.
function formatSynthesisComments(comments = [], viewerId = '') {
  return comments.map((item) => ({
    id: String(item._id),
    authorId: String(item.author_id),
    authorName: item.author_name || 'Associé',
    comment: item.comment,
    updatedAt: item.updated_at || item.created_at || null,
    isMine: Boolean(viewerId) && String(item.author_id) === String(viewerId),
  }));
}

// Ajoute associateComments à chaque ligne de synthèse (rattachée par memberId).
async function attachSynthesisComments(rows = [], cycleLabel, viewerId = '') {
  const byMember = await loadSynthesisCommentsByMember(
    rows.map((row) => row.memberId),
    cycleLabel
  );

  return rows.map((row) => ({
    ...row,
    associateComments: formatSynthesisComments(byMember.get(String(row.memberId || '')) || [], viewerId),
  }));
}

module.exports = {
  SYNTHESIS_COMMENT_MAX_LENGTH,
  attachSynthesisComments,
  formatSynthesisComments,
  loadSynthesisCommentsByMember,
};
