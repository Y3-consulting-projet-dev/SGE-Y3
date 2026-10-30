const SecurityEvent = require('../models/SecurityEvent');

// Enregistre un événement (compte, date, IP) sans jamais inclure le code de secours.
// Un échec d'écriture du journal ne doit pas bloquer l'utilisateur.
async function logSecurityEvent(type, { user = null, email = '', request = null } = {}) {
  const ip = request?.ip || request?.socket?.remoteAddress || '';
  const accountEmail = user?.email || email || '';

  console.info(`[securite] ${type} compte=${accountEmail || 'inconnu'} ip=${ip || 'inconnue'}`);

  try {
    await SecurityEvent.create({
      type,
      user_id: user?._id || null,
      email: accountEmail,
      ip,
    });
  } catch (error) {
    console.error('[securite] Echec de l\'écriture du journal :', error.message);
  }
}

module.exports = { logSecurityEvent };
