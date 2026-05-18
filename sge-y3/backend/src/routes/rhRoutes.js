const express = require('express');

const {
  addRhQuestionnaireQuestion,
  addRhSelfMissionEvaluation,
  createRhQuestionnaireSection,
  downloadRhReport,
  getRhCalibration,
  getRhDepartmentEvaluations,
  getAssistantRhEvaluation,
  getMyAssistantRhSelfEvaluation,
  getRhQuestionnaire,
  getMyRhSelfEvaluation,
  getRhOverview,
  getRhPopulation,
  getRhReports,
  getRhSyntheses,
  getRhValidations,
  saveMyAssistantRhSelfEvaluation,
  saveAssistantRhEvaluation,
  saveMyRhSelfEvaluation,
  selectRhDepartmentEvaluation,
  submitMyAssistantRhSelfEvaluation,
  submitAssistantRhEvaluation,
  submitMyRhSelfMissionEvaluation,
  submitMyRhSelfEvaluation,
  validateRhSelection,
} = require('../controllers/rhController');
const { requireAuth } = require('../middleware/authMiddleware');
const { requireRh } = require('../middleware/collaboratorMiddleware');

const router = express.Router();

router.get('/overview', requireAuth, requireRh, getRhOverview);
router.get('/assistant-self-evaluation', requireAuth, requireRh, getMyAssistantRhSelfEvaluation);
router.put('/assistant-self-evaluation', requireAuth, requireRh, saveMyAssistantRhSelfEvaluation);
router.post('/assistant-self-evaluation/submit', requireAuth, requireRh, submitMyAssistantRhSelfEvaluation);
router.get('/assistant-evaluations/:memberId', requireAuth, requireRh, getAssistantRhEvaluation);
router.put('/assistant-evaluations/:memberId', requireAuth, requireRh, saveAssistantRhEvaluation);
router.post('/assistant-evaluations/:memberId/submit', requireAuth, requireRh, submitAssistantRhEvaluation);
router.get('/self-evaluation', requireAuth, requireRh, getMyRhSelfEvaluation);
router.post('/self-evaluation/missions', requireAuth, requireRh, addRhSelfMissionEvaluation);
router.post('/self-evaluation/missions/submit', requireAuth, requireRh, submitMyRhSelfMissionEvaluation);
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
