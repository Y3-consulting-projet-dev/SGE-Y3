const express = require('express');

const {
  getMySeniorEvaluation,
  saveMySeniorEvaluation,
  submitMySeniorMissionEvaluation,
  submitMySeniorEvaluation,
} = require('../controllers/collaboratorEvaluationController');
const {
  getMySeniorOverview,
  listMyAssistants,
  listMyCommonMissions,
  listMyTransmittedSummaries,
  getMyAssistantEvaluation,
  addMissionToAssistant,
  saveMyAssistantEvaluation,
  submitMyAssistantMissionReview,
  submitMyAssistantEvaluation,
} = require('../controllers/seniorAssistantController');
const { requireAuth } = require('../middleware/authMiddleware');
const { requireSenior } = require('../middleware/collaboratorMiddleware');

const router = express.Router();

router.get('/evaluation/me', requireAuth, requireSenior, getMySeniorEvaluation);
router.put('/evaluation/me', requireAuth, requireSenior, saveMySeniorEvaluation);
router.post('/evaluation/me/missions/submit', requireAuth, requireSenior, submitMySeniorMissionEvaluation);
router.post('/evaluation/me/submit', requireAuth, requireSenior, submitMySeniorEvaluation);
router.get('/overview', requireAuth, requireSenior, getMySeniorOverview);
router.get('/assistants', requireAuth, requireSenior, listMyAssistants);
router.get('/missions-commones', requireAuth, requireSenior, listMyCommonMissions);
router.get('/syntheses-transmises', requireAuth, requireSenior, listMyTransmittedSummaries);
router.get('/assistants/:assistantId/evaluation', requireAuth, requireSenior, getMyAssistantEvaluation);
router.post('/assistants/:assistantId/evaluation/missions', requireAuth, requireSenior, addMissionToAssistant);
router.put('/assistants/:assistantId/evaluation', requireAuth, requireSenior, saveMyAssistantEvaluation);
router.post('/assistants/:assistantId/evaluation/missions/submit', requireAuth, requireSenior, submitMyAssistantMissionReview);
router.post('/assistants/:assistantId/evaluation/submit', requireAuth, requireSenior, submitMyAssistantEvaluation);

module.exports = router;
