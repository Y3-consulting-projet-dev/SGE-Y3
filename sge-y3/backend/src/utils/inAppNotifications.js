const Notification = require('../models/Notification');

const MESSAGE_TEMPLATES = {
  mission_submitted: ({ submitterName, label }) => `${submitterName} a soumis ${label}.`,
  self_eval_submitted: ({ submitterName, label }) => `${submitterName} a soumis ${label}.`,
  development_submitted: ({ submitterName, label }) => `${submitterName} a soumis ${label}.`,
  transmis: ({ submitterName, label }) => `${submitterName} a transmis ${label}.`,
  rh_synthese_transmise: ({ submitterName, label }) => `${submitterName} a transmis ${label}.`,
  committee_decision: ({ submitterName, label }) => `${submitterName} a transmis ${label}.`,
  self_evaluation_reminder: ({ label }) => label || 'Rappel : merci de finaliser votre auto-evaluation.',
};

async function notifyInAppRecipients({
  recipientIds = [],
  excludeUserId = null,
  submitterName,
  label,
  cycleLabel,
  type,
  actorId = null,
  entityType = '',
  entityId = null,
  targetSection = '',
  messageOverride = '',
}) {
  try {
    const excludedId = excludeUserId ? String(excludeUserId) : '';
    const ids = [...new Set((recipientIds || []).filter(Boolean).map(String))].filter((id) => id !== excludedId);

    if (!ids.length) {
      return;
    }

    const template = MESSAGE_TEMPLATES[type];
    const message = messageOverride || (template ? template({ submitterName, label }) : `${submitterName} a soumis ${label}.`);

    await Notification.insertMany(
      ids.map((recipientId) => ({
        recipient_id: recipientId,
        type,
        message,
        actor_id: actorId,
        actor_name: submitterName,
        cycle_label: cycleLabel,
        entity_type: entityType,
        entity_id: entityId,
        link: targetSection,
      }))
    );
  } catch (error) {
    console.error('[inAppNotifications] Echec de la notification in-app:', error.message);
  }
}

module.exports = { notifyInAppRecipients };
