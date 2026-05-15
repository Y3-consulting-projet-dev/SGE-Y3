const express = require('express');

const {
  addRhQuestionnaireQuestion,
  createRhQuestionnaireSection,
  downloadRhReport,
  getRhCalibration,
  getRhDepartmentEvaluations,
  getRhQuestionnaire,
  getMyRhSelfEvaluation,
  getRhOverview,
  getRhPopulation,
  getRhReports,
  getRhSyntheses,
  getRhValidations,
  saveMyRhSelfEvaluation,
  selectRhDepartmentEvaluation,
  submitMyRhSelfEvaluation,
  validateRhSelection,
} = require('../controllers/rhController');
const { requireAuth } = require('../middleware/authMiddleware');
const { requireRh } = require('../middleware/collaboratorMiddleware');

const router = express.Router();

router.get('/overview', requireAuth, requireRh, getRhOverview);
router.get('/self-evaluation', requireAuth, requireRh, getMyRhSelfEvaluation);
router.put('/self-evaluation', requireAuth, requireRh, saveMyRhSelfEvaluation);
router.post('/self-evaluation/submit', requireAuth, requireRh, submitMyRhSelfEvaluation);
router.get('/questionnaire', requireAuth, requireRh, getRhQuestionnaire);
router.post('/questionnaire/sections', requireAuth, requireRh, createRhQuestionnaireSection);
router.post('/questionnaire/questions', requireAuth, requireRh, addRhQuestionnaireQuestion);
router.get('/calibration', requireAuth, requireRh, getRhCalibration);
router.get('/department-evaluations', requireAuth, requireRh, getRhDepartmentEvaluations);
router.get('/population', requireAuth, requireRh, getRhPopulation);
router.get('/reports', requireAuth, requireRh, getRhReports);
router.get('/reports/:reportId/download', requireAuth, requireRh, downloadRhReport);
router.post('/department-evaluations/:reviewId/select', requireAuth, requireRh, selectRhDepartmentEvaluation);
router.get('/validations', requireAuth, requireRh, getRhValidations);
router.post('/validations/confirm', requireAuth, requireRh, validateRhSelection);
router.get('/syntheses', requireAuth, requireRh, getRhSyntheses);

module.exports = router;
