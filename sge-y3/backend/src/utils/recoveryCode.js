const crypto = require('crypto');
const bcrypt = require('bcryptjs');

// Sans caractères ambigus : ni 0/O, ni 1/I/L.
const RECOVERY_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const RECOVERY_CODE_LENGTH = 16;
const RECOVERY_CODE_GROUP_SIZE = 4;
const BCRYPT_ROUNDS = 10;

// Hachage d'un code fictif : comparé quand le compte est inconnu, sans code ou bloqué,
// pour que le temps de réponse ne révèle pas l'existence du compte.
const DUMMY_RECOVERY_CODE_HASH = bcrypt.hashSync('ZZZZZZZZZZZZZZZZ', BCRYPT_ROUNDS);

function formatRecoveryCode(normalizedCode) {
  const groups = normalizedCode.match(new RegExp(`.{1,${RECOVERY_CODE_GROUP_SIZE}}`, 'g')) || [];
  return groups.join('-');
}

function generateRecoveryCode() {
  let code = '';
  for (let index = 0; index < RECOVERY_CODE_LENGTH; index += 1) {
    code += RECOVERY_CODE_ALPHABET[crypto.randomInt(RECOVERY_CODE_ALPHABET.length)];
  }
  return formatRecoveryCode(code);
}

// Tolère minuscules, espaces et tirets absents : « k7qm 2xpa9rtf-w4hc » -> « K7QM2XPA9RTFW4HC ».
function normalizeRecoveryCode(value) {
  return String(value || '')
    .toUpperCase()
    .replace(/[\s-]+/g, '');
}

async function hashRecoveryCode(code) {
  return bcrypt.hash(normalizeRecoveryCode(code), BCRYPT_ROUNDS);
}

async function verifyRecoveryCode(code, hash) {
  return bcrypt.compare(normalizeRecoveryCode(code), hash || DUMMY_RECOVERY_CODE_HASH);
}

module.exports = {
  DUMMY_RECOVERY_CODE_HASH,
  RECOVERY_CODE_ALPHABET,
  generateRecoveryCode,
  hashRecoveryCode,
  normalizeRecoveryCode,
  verifyRecoveryCode,
};
