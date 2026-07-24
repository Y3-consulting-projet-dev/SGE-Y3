const express = require('express');

const {
  createCollaborator,
  listCollaborators,
  setCollaboratorActiveStatus,
  updateCollaborator,
} = require('../controllers/rhCollaboratorController');
const {
  addRhQuestionnaireQuestion,
  createRhCycle,
  createRhQuestionnaireSection,
  downloadRhReport,
  getRhCalibration,
  getRhCycles,
  getRhDepartmentEvaluationDetail,
  getRhDepartmentEvaluations,
  getAssistantRhEvaluation,
  getMyAssistantRhSelfEvaluation,
  getMyRhEvaluationHistory,
  getRhQuestionnaire,
  getMyRhSelfEvaluation,
  getMyAssistantRhEvaluationResult,
  getRhOverview,
  getRhReceivedChiefComments,
  getRhCollaboratorAnonymousComments,
  getRhAnonymousCommentRecipients,
  getRhPopulation,
  getRhReports,
  getRhSyntheses,
  getRhTeamMemberHistory,
  getRhValidations,
  listAllMembersForRh,
  saveMyAssistantRhSelfEvaluation,
  saveAssistantRhEvaluation,
  saveMyRhSelfEvaluation,
  selectRhDepartmentEvaluation,
  submitMyAssistantRhSelfEvaluation,
  submitAssistantRhEvaluation,
  submitRhSyntheses,
  submitMyRhSelfEvaluation,
  updateRhUserCareer,
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
router.put('/self-evaluation', requireAuth, requireRh, saveMyRhSelfEvaluation);
router.post('/self-evaluation/submit', requireAuth, requireRh, submitMyRhSelfEvaluation);
router.get('/evaluation/history', requireAuth, requireRh, getMyRhEvaluationHistory);
router.get('/team/members', requireAuth, requireRh, listAllMembersForRh);
router.get('/team/:memberId/history', requireAuth, requireRh, getRhTeamMemberHistory);
router.get('/questionnaire', requireAuth, requireRh, getRhQuestionnaire);
router.post('/questionnaire/sections', requireAuth, requireRh, createRhQuestionnaireSection);
router.post('/questionnaire/questions', requireAuth, requireRh, addRhQuestionnaireQuestion);
router.get('/calibration', requireAuth, requireRh, getRhCalibration);
router.get('/department-evaluations', requireAuth, requireRh, getRhDepartmentEvaluations);
router.get('/department-evaluations/:reviewId', requireAuth, requireRh, getRhDepartmentEvaluationDetail);
router.get('/population', requireAuth, requireRh, getRhPopulation);
router.put('/population/:memberId/career', requireAuth, requireRh, updateRhUserCareer);
router.get('/collaborators', requireAuth, requireRh, listCollaborators);
router.post('/collaborators', requireAuth, requireRh, createCollaborator);
router.put('/collaborators/:userId', requireAuth, requireRh, updateCollaborator);
router.patch('/collaborators/:userId/status', requireAuth, requireRh, setCollaboratorActiveStatus);
router.get('/reports', requireAuth, requireRh, getRhReports);
router.get('/reports/:reportId/download', requireAuth, requireRh, downloadRhReport);
router.post('/department-evaluations/:reviewId/select', requireAuth, requireRh, selectRhDepartmentEvaluation);
router.get('/validations', requireAuth, requireRh, getRhValidations);
router.post('/validations/confirm', requireAuth, requireRh, validateRhSelection);
router.get('/syntheses', requireAuth, requireRh, getRhSyntheses);
router.post('/syntheses/submit', requireAuth, requireRh, submitRhSyntheses);
router.get('/cycles', requireAuth, requireRh, getRhCycles);
router.post('/cycles', requireAuth, requireRh, createRhCycle);
router.get('/my-evaluation-result', requireAuth, requireRh, getMyAssistantRhEvaluationResult);
router.get('/received-comments', requireAuth, requireRh, getRhReceivedChiefComments);
router.get('/collaborators/:userId/anonymous-comments', requireAuth, requireRh, getRhCollaboratorAnonymousComments);
router.get('/anonymous-comments/recipients', requireAuth, requireRh, getRhAnonymousCommentRecipients);

module.exports = router;
