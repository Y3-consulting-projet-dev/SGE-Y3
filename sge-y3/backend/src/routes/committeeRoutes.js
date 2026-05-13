const express = require('express');

const { getLatestCommitteeDecision, listCommitteeParticipants, saveCommitteeDecision } = require('../controllers/committeeController');
const { requireAuth } = require('../middleware/authMiddleware');

const router = express.Router();

router.get('/participants', requireAuth, listCommitteeParticipants);
router.get('/decisions/latest', requireAuth, getLatestCommitteeDecision);
router.post('/decisions', requireAuth, saveCommitteeDecision);

module.exports = router;
