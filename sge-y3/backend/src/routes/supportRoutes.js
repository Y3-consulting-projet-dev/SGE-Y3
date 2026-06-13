const express = require('express');

const {
  getSupportSelfEvaluation,
  saveSupportSelfEvaluation,
  submitSupportSelfEvaluation,
  saveSupportChiefComments,
  getReceivedSupportChiefComments,
} = require('../controllers/supportController');
const { requireAuth } = require('../middleware/authMiddleware');
function requireSupport(request, response, next) {
  if (String(request.user?.department || '').toUpperCase() === 'SUPPORT') {
    return next();
  }

  return response.status(403).json({
    message: 'Cette fonctionnalité est réservée au service support.',
  });
}

const router = express.Router();

router.get('/self-evaluation', requireAuth, requireSupport, getSupportSelfEvaluation);
router.put('/self-evaluation', requireAuth, requireSupport, saveSupportSelfEvaluation);
router.post('/self-evaluation/submit', requireAuth, requireSupport, submitSupportSelfEvaluation);
router.put('/chief-comments', requireAuth, requireSupport, saveSupportChiefComments);
router.get('/chief-comments/received', requireAuth, requireSupport, getReceivedSupportChiefComments);

module.exports = router;
