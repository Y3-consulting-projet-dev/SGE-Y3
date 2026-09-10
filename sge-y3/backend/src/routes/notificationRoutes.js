const express = require('express');

const {
  listMyNotifications,
  getUnreadCount,
  markOneRead,
  markAllRead,
} = require('../controllers/notificationController');
const { requireAuth } = require('../middleware/authMiddleware');

const router = express.Router();

router.get('/', requireAuth, listMyNotifications);
router.get('/unread-count', requireAuth, getUnreadCount);
router.patch('/read-all', requireAuth, markAllRead);
router.patch('/:id/read', requireAuth, markOneRead);

module.exports = router;
