const express = require('express');

const { login, updatePassword, updateProfile, getActiveCycleInfo } = require('../controllers/authController');
const { requireAuth } = require('../middleware/authMiddleware');

const router = express.Router();

router.post('/login', login);
router.get('/active-cycle', requireAuth, getActiveCycleInfo);
router.put('/me/profile', requireAuth, updateProfile);
router.put('/me/password', requireAuth, updatePassword);

module.exports = router;
