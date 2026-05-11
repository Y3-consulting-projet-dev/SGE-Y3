const express = require('express');

const { listCommitteeParticipants } = require('../controllers/committeeController');
const { requireAuth } = require('../middleware/authMiddleware');

const router = express.Router();

router.get('/participants', requireAuth, listCommitteeParticipants);

module.exports = router;
