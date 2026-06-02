const express = require('express');

const {
  getSupportSelfEvaluation,
  saveSupportSelfEvaluation,
  submitSupportSelfEvaluation,
} = require('../controllers/supportController');
const { requireAuth } = require('../middleware/authMiddleware');
const { normalizeEmail } = require('../utils/userMapping');

const SUPPORT_EMAILS = new Set([
  'fleur.nguessan@ycubeac.com',
  'porthela.kakou@ycubeac.com',
  'aziz.ouattara@ycubeac.com',
  'adele.creppy@ycubeac.com',
]);

function requireSupport(request, response, next) {
  if (SUPPORT_EMAILS.has(normalizeEmail(request.user?.email || ''))) {
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

module.exports = router;
