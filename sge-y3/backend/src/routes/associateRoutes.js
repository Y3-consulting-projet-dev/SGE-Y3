const express = require('express');

const {
  getAssociateManagerEvaluation,
  getAssociateManagerEvaluations,
  getAssociateOverview,
  getAssociateSyntheses,
  saveAssociateManagerEvaluation,
} = require('../controllers/associateController');
const { requireAuth } = require('../middleware/authMiddleware');
const { requireAssociate } = require('../middleware/collaboratorMiddleware');

const router = express.Router();

router.get('/overview', requireAuth, requireAssociate, getAssociateOverview);
router.get('/syntheses', requireAuth, requireAssociate, getAssociateSyntheses);
router.get('/manager-evaluations', requireAuth, requireAssociate, getAssociateManagerEvaluations);
router.get('/manager-evaluations/:managerId', requireAuth, requireAssociate, getAssociateManagerEvaluation);
router.put('/manager-evaluations/:managerId', requireAuth, requireAssociate, saveAssociateManagerEvaluation);

module.exports = router;
