const express = require('express');

const { login, updatePassword, updateProfile } = require('../controllers/authController');
const { requireAuth } = require('../middleware/authMiddleware');

const router = express.Router();

router.post('/login', login);
router.put('/me/profile', requireAuth, updateProfile);
router.put('/me/password', requireAuth, updatePassword);

module.exports = router;
