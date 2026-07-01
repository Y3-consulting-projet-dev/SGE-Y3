const User = require('../models/User');
const { sendMail } = require('./mailer');

async function notifySubmissionRecipients({ recipientIds = [], excludeUserId = null, submitterName, label, cycleLabel }) {
  try {
    const excludedId = excludeUserId ? String(excludeUserId) : '';
    const ids = [...new Set((recipientIds || []).filter(Boolean).map(String))].filter((id) => id !== excludedId);

    if (!ids.length) {
      return;
    }

    const recipients = await User.find({ _id: { $in: ids }, is_active: true }).select('email name');
    const link = process.env.FRONTEND_URL ? `\n\nConnectez-vous a la plateforme SGE : ${process.env.FRONTEND_URL}` : '';

    await Promise.allSettled(
      recipients
        .filter((recipient) => recipient.email)
        .map((recipient) =>
          sendMail({
            to: recipient.email,
            subject: `SGE - ${submitterName} a soumis ${label}`,
            text: `Bonjour ${recipient.name},\n\n${submitterName} vient de soumettre ${label} (cycle ${cycleLabel}).${link}\n\nCeci est un message automatique, merci de ne pas y repondre.`,
          })
        )
    );
  } catch (error) {
    console.error('[submissionNotifications] Echec de la notification de soumission:', error.message);
  }
}

module.exports = { notifySubmissionRecipients };
