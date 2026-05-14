const express = require('express');

const {
  getMyManagerEvaluation,
  getManagerMemberEvaluation,
  getManagerOverview,
  getManagerTeamReport,
  saveMyManagerEvaluation,
  saveManagerMemberEvaluation,
  submitMyManagerEvaluation,
  submitManagerMemberEvaluation,
} = require('../controllers/managerController');
const { requireAuth } = require('../middleware/authMiddleware');
const { requireManager } = require('../middleware/collaboratorMiddleware');

const router = express.Router();

router.get('/overview', requireAuth, requireManager, getManagerOverview);
router.get('/team-report', requireAuth, requireManager, getManagerTeamReport);
router.get('/self-evaluation', requireAuth, requireManager, getMyManagerEvaluation);
router.put('/self-evaluation', requireAuth, requireManager, saveMyManagerEvaluation);
router.post('/self-evaluation/submit', requireAuth, requireManager, submitMyManagerEvaluation);
router.get('/members/:memberId/evaluation', requireAuth, requireManager, getManagerMemberEvaluation);
router.put('/members/:memberId/evaluation', requireAuth, requireManager, saveManagerMemberEvaluation);
router.post('/members/:memberId/evaluation/submit', requireAuth, requireManager, submitManagerMemberEvaluation);

module.exports = router;
