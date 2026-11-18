const express = require('express');

const {
  getMyAssistantEvaluation,
  getMyAssistantEvaluationHistory,
  getMyAssistantResults,
  saveMyAssistantEvaluation,
  submitMyAssistantMissionEvaluation,
  submitMyAssistantEvaluation,
  saveMyDevelopment,
  submitMyDevelopment,
} = require('../controllers/collaboratorEvaluationController');
const { requireAuth } = require('../middleware/authMiddleware');
const { requireAssistant } = require('../middleware/collaboratorMiddleware');
const { requireSelfEvaluationOpen } = require('../middleware/selfEvaluationDeadline');

const router = express.Router();

router.get('/evaluation/me', requireAuth, requireAssistant, getMyAssistantEvaluation);
router.get('/evaluation/history', requireAuth, requireAssistant, getMyAssistantEvaluationHistory);
router.get('/results/me', requireAuth, requireAssistant, getMyAssistantResults);
router.put('/evaluation/me', requireAuth, requireAssistant, requireSelfEvaluationOpen, saveMyAssistantEvaluation);
router.post('/evaluation/me/missions/submit', requireAuth, requireAssistant, requireSelfEvaluationOpen, submitMyAssistantMissionEvaluation);
router.post('/evaluation/me/submit', requireAuth, requireAssistant, requireSelfEvaluationOpen, submitMyAssistantEvaluation);
router.put('/development/me', requireAuth, requireAssistant, requireSelfEvaluationOpen, saveMyDevelopment);
router.post('/development/me/submit', requireAuth, requireAssistant, requireSelfEvaluationOpen, submitMyDevelopment);

module.exports = router;
