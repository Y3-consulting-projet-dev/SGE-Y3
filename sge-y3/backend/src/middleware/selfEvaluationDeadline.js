const Cycle = require('../models/Cycle');

// Date limite des auto-évaluations du cycle actif, relue en base à chaque requête (pas de redémarrage nécessaire).
async function getSelfEvaluationDeadline() {
  const cycle = await Cycle.findOne({ is_active: true }).select('self_evaluation_deadline').lean();
  return cycle?.self_evaluation_deadline ? new Date(cycle.self_evaluation_deadline) : null;
}

function isSelfEvaluationClosed(deadline, now = new Date()) {
  return Boolean(deadline) && !Number.isNaN(deadline.getTime()) && now >= deadline;
}

function formatFrenchDate(date) {
  const formatted = date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
  return date.getUTCDate() === 1 ? formatted.replace(/^1 /, '1er ') : formatted;
}

// Bloque l'enregistrement et la soumission des auto-évaluations à partir de la date limite.
async function requireSelfEvaluationOpen(_request, response, next) {
  try {
    const deadline = await getSelfEvaluationDeadline();
    if (isSelfEvaluationClosed(deadline)) {
      return response.status(403).json({
        message: `La période d'auto-évaluation est close depuis le ${formatFrenchDate(deadline)}. Les modifications ne sont plus possibles.`,
        self_evaluation_closed: true,
      });
    }
    return next();
  } catch (error) {
    return next(error);
  }
}

module.exports = { getSelfEvaluationDeadline, isSelfEvaluationClosed, requireSelfEvaluationOpen };
