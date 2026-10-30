const express = require('express');

const { forgotPassword, login, resetPassword, updatePassword, updateProfile } = require('../controllers/authController');
const { requireAuth } = require('../middleware/authMiddleware');
const { createIpRateLimiter } = require('../utils/rateLimit');

const router = express.Router();

const FIFTEEN_MINUTES_MS = 15 * 60 * 1000;
const passwordResetLimiter = createIpRateLimiter({
  windowMs: FIFTEEN_MINUTES_MS,
  max: 10,
  message: 'Trop de demandes de réinitialisation depuis cette adresse. Veuillez réessayer dans 15 minutes.',
});

router.post('/login', login);
router.post('/forgot-password', passwordResetLimiter, forgotPassword);
router.post('/reset-password', passwordResetLimiter, resetPassword);
router.put('/me/profile', requireAuth, updateProfile);
router.put('/me/password', requireAuth, updatePassword);

module.exports = router;
