const express = require('express');

const {
  getMyAssistantEvaluation,
  getMyAssistantEvaluationHistory,
  getMyAssistantResults,
  saveMyAssistantEvaluation,
  submitMyAssistantMissionEvaluation,
  submitMyAssistantEvaluation,
} = require('../controllers/collaboratorEvaluationController');
const { requireAuth } = require('../middleware/authMiddleware');
const { requireAssistant } = require('../middleware/collaboratorMiddleware');

const router = express.Router();

router.get('/evaluation/me', requireAuth, requireAssistant, getMyAssistantEvaluation);
router.get('/evaluation/history', requireAuth, requireAssistant, getMyAssistantEvaluationHistory);
router.get('/results/me', requireAuth, requireAssistant, getMyAssistantResults);
router.put('/evaluation/me', requireAuth, requireAssistant, saveMyAssistantEvaluation);
router.post('/evaluation/me/missions/submit', requireAuth, requireAssistant, submitMyAssistantMissionEvaluation);
router.post('/evaluation/me/submit', requireAuth, requireAssistant, submitMyAssistantEvaluation);

module.exports = router;
