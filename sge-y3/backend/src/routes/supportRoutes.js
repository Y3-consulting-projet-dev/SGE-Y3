const express = require('express');

const {
  getSupportSelfEvaluation,
  getMySupportEvaluationHistory,
  saveSupportSelfEvaluation,
  submitSupportSelfEvaluation,
  saveSupportChiefComments,
  getReceivedSupportChiefComments,
} = require('../controllers/supportController');
const { requireAuth } = require('../middleware/authMiddleware');
function requireSupport(request, response, next) {
  const dept = String(request.user?.department || '').toUpperCase();
  if (dept === 'SUPPORT' || dept === 'SERVICE SUPPORT') {
    return next();
  }

  return response.status(403).json({
    message: 'Cette fonctionnalité est réservée au service support.',
  });
}

const router = express.Router();

router.get('/self-evaluation', requireAuth, requireSupport, getSupportSelfEvaluation);
router.get('/self-evaluation/history', requireAuth, requireSupport, getMySupportEvaluationHistory);
router.put('/self-evaluation', requireAuth, requireSupport, saveSupportSelfEvaluation);
router.post('/self-evaluation/submit', requireAuth, requireSupport, submitSupportSelfEvaluation);
router.put('/chief-comments', requireAuth, requireSupport, saveSupportChiefComments);
router.get('/chief-comments/received', requireAuth, requireSupport, getReceivedSupportChiefComments);

module.exports = router;
