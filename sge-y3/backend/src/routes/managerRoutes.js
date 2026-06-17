const express = require('express');

const {
  addMissionToManagerMember,
  addMyManagerMissionEvaluation,
  decideTrainingRequests,
  getMyManagerEvaluation,
  getMyManagerEvaluationHistory,
  getTeamMemberHistoryForManager,
  getManagerMemberEvaluation,
  getManagerOverview,
  getManagerTeamReport,
  saveManagerMemberMissionReviews,
  saveMyManagerEvaluation,
  submitManagerMemberMissionReview,
  saveManagerMemberEvaluation,
  submitMyManagerEvaluation,
  submitMyManagerMissionEvaluation,
  submitManagerMemberEvaluation,
} = require('../controllers/managerController');
const { requireAuth } = require('../middleware/authMiddleware');
const { requireManager } = require('../middleware/collaboratorMiddleware');

const router = express.Router();

router.get('/overview', requireAuth, requireManager, getManagerOverview);
router.get('/team-report', requireAuth, requireManager, getManagerTeamReport);
router.get('/self-evaluation', requireAuth, requireManager, getMyManagerEvaluation);
router.get('/self-evaluation/history', requireAuth, requireManager, getMyManagerEvaluationHistory);
router.post('/self-evaluation/missions', requireAuth, requireManager, addMyManagerMissionEvaluation);
router.put('/self-evaluation', requireAuth, requireManager, saveMyManagerEvaluation);
router.post('/self-evaluation/missions/submit', requireAuth, requireManager, submitMyManagerMissionEvaluation);
router.post('/self-evaluation/submit', requireAuth, requireManager, submitMyManagerEvaluation);
router.get('/members/:memberId/evaluation', requireAuth, requireManager, getManagerMemberEvaluation);
router.get('/members/:memberId/history', requireAuth, requireManager, getTeamMemberHistoryForManager);
router.put('/members/:memberId/evaluation', requireAuth, requireManager, saveManagerMemberEvaluation);
router.post('/members/:memberId/evaluation/submit', requireAuth, requireManager, submitManagerMemberEvaluation);
router.post('/members/:memberId/evaluation/missions', requireAuth, requireManager, addMissionToManagerMember);
router.put('/members/:memberId/evaluation/missions', requireAuth, requireManager, saveManagerMemberMissionReviews);
router.post('/members/:memberId/evaluation/missions/:missionId/submit', requireAuth, requireManager, submitManagerMemberMissionReview);
router.put('/members/:memberId/training-decision', requireAuth, requireManager, decideTrainingRequests);

module.exports = router;
