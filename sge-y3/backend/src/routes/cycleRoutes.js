const express = require('express');

const { requireAuth } = require('../middleware/authMiddleware');
const { getSelfEvaluationDeadline, isSelfEvaluationClosed } = require('../middleware/selfEvaluationDeadline');
const { getActiveEvaluationPeriod } = require('../utils/activeCycle');

const router = express.Router();

// Période évaluée du cycle actif (les formulaires de mission limitent leurs dates à cet intervalle)
// et date limite des auto-évaluations.
router.get('/active', requireAuth, async (_request, response, next) => {
  try {
    const deadline = await getSelfEvaluationDeadline();
    response.json({
      period: getActiveEvaluationPeriod(),
      self_evaluation_deadline: deadline,
      self_evaluation_closed: isSelfEvaluationClosed(deadline),
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
