const express = require('express');

const {
  getAssociateSelfEvaluation,
  getMyAssociateEvaluationHistory,
  saveAssociateSelfEvaluation,
  submitAssociateSelfEvaluation,
  getReceivedAssociateEvaluations,
  getReceivedAssociateEvaluation,
  saveReceivedAssociateEvaluationComment,
  submitReceivedAssociateEvaluationToRh,
  getAssociateManagerEvaluation,
  getAssociateManagerEvaluations,
  getAssociateOverview,
  getAssociateSyntheses,
  getAssociateSupportEvaluation,
  getAssociateSupportEvaluations,
  getCabinetMemberHistory,
  listCabinetMembers,
  saveAssociateManagerEvaluation,
  submitAssociateManagerEvaluationToRh,
  saveAssociateSupportEvaluation,
  submitAssociateSupportEvaluation,
} = require('../controllers/associateController');
const { requireAuth } = require('../middleware/authMiddleware');
const { requireAssociate } = require('../middleware/collaboratorMiddleware');

const router = express.Router();

router.get('/overview', requireAuth, requireAssociate, getAssociateOverview);
router.get('/syntheses', requireAuth, requireAssociate, getAssociateSyntheses);
router.get('/self-evaluation', requireAuth, requireAssociate, getAssociateSelfEvaluation);
router.get('/self-evaluation/history', requireAuth, requireAssociate, getMyAssociateEvaluationHistory);
router.put('/self-evaluation', requireAuth, requireAssociate, saveAssociateSelfEvaluation);
router.post('/self-evaluation/submit', requireAuth, requireAssociate, submitAssociateSelfEvaluation);
router.get('/cabinet-members', requireAuth, requireAssociate, listCabinetMembers);
router.get('/cabinet-members/:memberId/history', requireAuth, requireAssociate, getCabinetMemberHistory);
router.get('/received-evaluations', requireAuth, requireAssociate, getReceivedAssociateEvaluations);
router.get('/received-evaluations/:evaluationId', requireAuth, requireAssociate, getReceivedAssociateEvaluation);
router.put('/received-evaluations/:evaluationId/comment', requireAuth, requireAssociate, saveReceivedAssociateEvaluationComment);
router.post('/received-evaluations/:evaluationId/submit-rh', requireAuth, requireAssociate, submitReceivedAssociateEvaluationToRh);
router.get('/manager-evaluations', requireAuth, requireAssociate, getAssociateManagerEvaluations);
router.get('/manager-evaluations/:managerId', requireAuth, requireAssociate, getAssociateManagerEvaluation);
router.put('/manager-evaluations/:managerId', requireAuth, requireAssociate, saveAssociateManagerEvaluation);
router.post('/manager-evaluations/:managerId/submit-rh', requireAuth, requireAssociate, submitAssociateManagerEvaluationToRh);
router.get('/support-evaluations', requireAuth, requireAssociate, getAssociateSupportEvaluations);
router.get('/support-evaluations/:supportId', requireAuth, requireAssociate, getAssociateSupportEvaluation);
router.put('/support-evaluations/:supportId', requireAuth, requireAssociate, saveAssociateSupportEvaluation);
router.post('/support-evaluations/:supportId/submit', requireAuth, requireAssociate, submitAssociateSupportEvaluation);

module.exports = router;
