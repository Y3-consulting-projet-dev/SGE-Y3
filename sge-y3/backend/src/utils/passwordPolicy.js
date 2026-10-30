// Mot de passe attribué aux comptes créés par la RH ou importés : à remplacer à la première connexion.
const DEFAULT_PASSWORD = 'Ycube@c2026';

const PASSWORD_RESET_MODES = ['recovery_code', 'email'];

// « recovery_code » (par défaut) : code de secours personnel ; « email » : lien envoyé par e-mail.
function getPasswordResetMode() {
  const mode = String(process.env.PASSWORD_RESET_MODE || '').trim().toLowerCase();
  return PASSWORD_RESET_MODES.includes(mode) ? mode : 'recovery_code';
}

function isRecoveryCodeMode() {
  return getPasswordResetMode() === 'recovery_code';
}

module.exports = {
  DEFAULT_PASSWORD,
  getPasswordResetMode,
  isRecoveryCodeMode,
};
