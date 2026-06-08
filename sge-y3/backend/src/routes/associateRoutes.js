const express = require('express');

const {
  getAssociateSelfEvaluation,
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
  saveAssociateManagerEvaluation,
  saveAssociateSupportEvaluation,
  submitAssociateManagerEvaluationToRh,
} = require('../controllers/associateController');
const { requireAuth } = require('../middleware/authMiddleware');
const { requireAssociate } = require('../middleware/collaboratorMiddleware');

const router = express.Router();

router.get('/overview', requireAuth, requireAssociate, getAssociateOverview);
router.get('/syntheses', requireAuth, requireAssociate, getAssociateSyntheses);
router.get('/self-evaluation', requireAuth, requireAssociate, getAssociateSelfEvaluation);
router.put('/self-evaluation', requireAuth, requireAssociate, saveAssociateSelfEvaluation);
router.post('/self-evaluation/submit', requireAuth, requireAssociate, submitAssociateSelfEvaluation);
router.get('/received-evaluations', requireAuth, requireAssociate, getReceivedAssociateEvaluations);
router.get('/received-evaluations/:evaluationId', requireAuth, requireAssociate, getReceivedAssociateEvaluation);
router.put('/received-evaluations/:evaluationId/comment', requireAuth, requireAssociate, saveReceivedAssociateEvaluationComment);
router.post('/received-evaluations/:evaluationId/submit-rh', requireAuth, requireAssociate, submitReceivedAssociateEvaluationToRh);
router.get('/manager-evaluations', requireAuth, requireAssociate, getAssociateManagerEvaluations);
router.get('/manager-evaluations/:managerId', requireAuth, requireAssociate, getAssociateManagerEvaluation);
router.put('/manager-evaluations/:managerId', requireAuth, requireAssociate, saveAssociateManagerEvaluation);
router.get('/support-evaluations', requireAuth, requireAssociate, getAssociateSupportEvaluations);
router.get('/support-evaluations/:supportId', requireAuth, requireAssociate, getAssociateSupportEvaluation);
router.put('/support-evaluations/:supportId', requireAuth, requireAssociate, saveAssociateSupportEvaluation);
router.post('/manager-evaluations/:managerId/submit-rh', requireAuth, requireAssociate, submitAssociateManagerEvaluationToRh);

module.exports = router;
