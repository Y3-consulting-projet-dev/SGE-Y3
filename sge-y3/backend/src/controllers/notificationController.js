const Notification = require('../models/Notification');

async function listMyNotifications(request, response) {
  try {
    const limit = Math.min(Number(request.query.limit) || 20, 100);
    const notifications = await Notification.find({ recipient_id: request.user._id })
      .sort({ created_at: -1 })
      .limit(limit);
    response.json({ notifications });
  } catch (error) {
    console.error('[notificationController] listMyNotifications:', error.message);
    response.status(500).json({ message: 'Impossible de récupérer les notifications.' });
  }
}

async function getUnreadCount(request, response) {
  try {
    const count = await Notification.countDocuments({ recipient_id: request.user._id, is_read: false });
    response.json({ count });
  } catch (error) {
    console.error('[notificationController] getUnreadCount:', error.message);
    response.status(500).json({ message: 'Impossible de récupérer le compteur de notifications.' });
  }
}

async function markOneRead(request, response) {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: request.params.id, recipient_id: request.user._id },
      { is_read: true, read_at: new Date() },
      { new: true }
    );

    if (!notification) {
      return response.status(404).json({ message: 'Notification introuvable.' });
    }

    response.json({ notification });
  } catch (error) {
    console.error('[notificationController] markOneRead:', error.message);
    response.status(500).json({ message: 'Impossible de marquer la notification comme lue.' });
  }
}

async function markAllRead(request, response) {
  try {
    await Notification.updateMany(
      { recipient_id: request.user._id, is_read: false },
      { is_read: true, read_at: new Date() }
    );
    response.json({ message: 'Notifications marquées comme lues.' });
  } catch (error) {
    console.error('[notificationController] markAllRead:', error.message);
    response.status(500).json({ message: 'Impossible de marquer les notifications comme lues.' });
  }
}

module.exports = { listMyNotifications, getUnreadCount, markOneRead, markAllRead };
