const express = require('express');

const { requireAuth } = require('../middleware/authMiddleware');
const { getActiveEvaluationPeriod } = require('../utils/activeCycle');

const router = express.Router();

// Période évaluée du cycle actif : les formulaires de mission limitent leurs dates à cet intervalle.
router.get('/active', requireAuth, (_request, response) => {
  response.json({ period: getActiveEvaluationPeriod() });
});

module.exports = router;
