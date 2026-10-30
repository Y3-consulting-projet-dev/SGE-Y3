// Tests du code de secours (node:test). Base dédiée : MONGO_URI_TEST, par défaut sge_y3_test.
// Lancement : npm test (MongoDB doit être démarré).
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'secret-de-test';
process.env.PASSWORD_RESET_MODE = 'recovery_code';
process.env.SMTP_HOST = '';
const TEST_MONGO_URI = process.env.MONGO_URI_TEST || 'mongodb://localhost:27017/sge_y3_test';

const { after, before, describe, test } = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');

const { app } = require('../src/app');
const User = require('../src/models/User');
const SecurityEvent = require('../src/models/SecurityEvent');
const { DEFAULT_PASSWORD } = require('../src/utils/passwordPolicy');
const { generateRecoveryCode, normalizeRecoveryCode } = require('../src/utils/recoveryCode');

const INVALID_MESSAGE = 'E-mail ou code de secours incorrect';
const PASSWORD = 'MotDePasse#2026';
let server;
let baseUrl;
let userCounter = 0;
const loggedLines = [];
const originalConsoleInfo = console.info;

async function call(method, path, { body, token } = {}) {
  // X-Forwarded-For sans TRUST_PROXY : la limite par IP est ignorée, pour isoler la limite par compte.
  const headers = { 'Content-Type': 'application/json', 'X-Forwarded-For': '198.51.100.1' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const startedAt = performance.now();
  const response = await fetch(`${baseUrl}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const durationMs = performance.now() - startedAt;
  return { status: response.status, body: await response.json().catch(() => ({})), durationMs };
}

async function createUser({ password = PASSWORD } = {}) {
  userCounter += 1;
  return User.create({
    email: `test${userCounter}@exemple.test`,
    password: Buffer.from(await bcrypt.hash(password, 10), 'utf8'),
    name: `Test ${userCounter}`,
    first_name: 'Test',
    last_name: String(userCounter),
    grade: 'Assistant',
    code_categorie: '8C',
  });
}

async function login(email, password = PASSWORD) {
  const result = await call('POST', '/api/auth/login', { body: { email, password } });
  assert.equal(result.status, 200, `connexion de ${email}`);
  return result.body;
}

// Compte avec un code de secours confirmé ; renvoie le code en clair et une session valide.
async function createUserWithCode() {
  const user = await createUser();
  const session = await login(user.email);
  const created = await call('POST', '/api/auth/me/recovery-code', { token: session.token });
  assert.equal(created.status, 200);
  const confirmed = await call('POST', '/api/auth/me/recovery-code/confirm', { token: session.token });
  assert.equal(confirmed.status, 200);
  return { user, code: created.body.code, token: confirmed.body.token };
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

before(async () => {
  const databaseName = new URL(TEST_MONGO_URI).pathname.replace('/', '');
  assert.ok(databaseName.endsWith('_test'), `Base de test refusée : « ${databaseName} » doit finir par _test.`);
  await mongoose.connect(TEST_MONGO_URI);
  await mongoose.connection.dropDatabase();
  console.info = (...args) => loggedLines.push(args.join(' '));
  await new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', resolve);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  console.info = originalConsoleInfo;
  await new Promise((resolve) => server.close(resolve));
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
});

describe('format du code de secours', () => {
  test('16 caractères en 4 groupes, sans caractères ambigus', () => {
    for (let index = 0; index < 500; index += 1) {
      const code = generateRecoveryCode();
      assert.match(code, /^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/);
      assert.doesNotMatch(code, /[01OIL]/);
    }
  });

  test('saisie tolérante : minuscules, espaces, sans tirets', () => {
    assert.equal(normalizeRecoveryCode(' k7qm 2xpa9rtf-w4hc '), 'K7QM2XPA9RTFW4HC');
    assert.equal(normalizeRecoveryCode('K7QM-2XPA-9RTF-W4HC'), 'K7QM2XPA9RTFW4HC');
  });
});

describe('étapes obligatoires', () => {
  test('mot de passe par défaut : accès autorisé, changement facultatif', async () => {
    const user = await createUser({ password: DEFAULT_PASSWORD });
    const session = await login(user.email, DEFAULT_PASSWORD);
    assert.equal(session.user.must_change_password, undefined);
    assert.equal(session.user.recovery_code_required, true);

    await call('POST', '/api/auth/me/recovery-code', { token: session.token });
    const confirmed = await call('POST', '/api/auth/me/recovery-code/confirm', { token: session.token });
    const allowed = await call('PUT', '/api/auth/me/profile', { token: confirmed.body.token, body: {} });
    assert.notEqual(allowed.status, 403, 'le mot de passe par défaut ne bloque pas l\'accès');

    const sameAsDefault = await call('PUT', '/api/auth/me/password', {
      token: confirmed.body.token,
      body: { currentPassword: DEFAULT_PASSWORD, newPassword: DEFAULT_PASSWORD, confirmPassword: DEFAULT_PASSWORD },
    });
    assert.equal(sameAsDefault.status, 400, 'le mot de passe par défaut ne peut pas être choisi comme nouveau mot de passe');
  });

  test('compte sans code : accès bloqué tant que le code n\'est pas confirmé', async () => {
    const user = await createUser();
    const session = await login(user.email);
    assert.equal(session.user.recovery_code_required, true);

    const blocked = await call('PUT', '/api/auth/me/profile', { token: session.token, body: {} });
    assert.equal(blocked.status, 403);
    assert.equal(blocked.body.code, 'RECOVERY_CODE_REQUIRED');

    await call('POST', '/api/auth/me/recovery-code', { token: session.token });
    const confirmed = await call('POST', '/api/auth/me/recovery-code/confirm', { token: session.token });
    assert.equal(confirmed.body.user.recovery_code_required, false);

    const allowed = await call('PUT', '/api/auth/me/profile', { token: confirmed.body.token, body: {} });
    assert.notEqual(allowed.status, 403);
  });

  test('le code n\'est stocké que haché', async () => {
    const { user, code } = await createUserWithCode();
    const stored = await User.findById(user._id).lean();
    assert.ok(stored.recovery_code_hash.startsWith('$2'));
    assert.ok(!JSON.stringify(stored).includes(normalizeRecoveryCode(code)));
    assert.ok(!JSON.stringify(stored).includes(code));
  });
});

describe('mot de passe oublié avec code de secours', () => {
  test('réinitialisation réussie, puis échec si le même code est réutilisé', async () => {
    const { user, code } = await createUserWithCode();
    const sloppyInput = ` ${normalizeRecoveryCode(code).toLowerCase().slice(0, 8)} ${normalizeRecoveryCode(code).toLowerCase().slice(8)} `;

    const recovered = await call('POST', '/api/auth/recover', { body: { email: user.email.toUpperCase(), code: sloppyInput } });
    assert.equal(recovered.status, 200);
    assert.ok(recovered.body.resetToken);

    const reset = await call('POST', '/api/auth/reset-password', {
      body: { token: recovered.body.resetToken, newPassword: 'Nouveau#2026a', confirmPassword: 'Nouveau#2026a' },
    });
    assert.equal(reset.status, 200);
    assert.ok(reset.body.token, 'connexion directe après réinitialisation');
    assert.equal(reset.body.user.recovery_code_required, true, 'un nouveau code doit être généré');

    const reused = await call('POST', '/api/auth/recover', { body: { email: user.email, code } });
    assert.equal(reused.status, 400);
    assert.equal(reused.body.message, INVALID_MESSAGE);

    const tokenReused = await call('POST', '/api/auth/reset-password', {
      body: { token: recovered.body.resetToken, newPassword: 'Encore#2026a', confirmPassword: 'Encore#2026a' },
    });
    assert.equal(tokenReused.status, 400, 'le jeton de réinitialisation reste à usage unique');
  });

  test('sessions fermées après réinitialisation', async () => {
    const { user, code, token: oldToken } = await createUserWithCode();
    await wait(1100);
    const recovered = await call('POST', '/api/auth/recover', { body: { email: user.email, code } });
    await call('POST', '/api/auth/reset-password', {
      body: { token: recovered.body.resetToken, newPassword: 'Nouveau#2026b', confirmPassword: 'Nouveau#2026b' },
    });

    const withOldSession = await call('PUT', '/api/auth/me/profile', { token: oldToken, body: {} });
    assert.equal(withOldSession.status, 401);
    assert.equal(withOldSession.body.code, 'SESSION_REVOKED');
  });

  test('message identique pour un e-mail inconnu et pour un code faux', async () => {
    const { user } = await createUserWithCode();
    const unknownEmail = await call('POST', '/api/auth/recover', {
      body: { email: 'personne@exemple.test', code: generateRecoveryCode() },
    });
    const wrongCode = await call('POST', '/api/auth/recover', { body: { email: user.email, code: generateRecoveryCode() } });
    const noCodeUser = await createUser();
    const accountWithoutCode = await call('POST', '/api/auth/recover', {
      body: { email: noCodeUser.email, code: generateRecoveryCode() },
    });

    for (const result of [unknownEmail, wrongCode, accountWithoutCode]) {
      assert.equal(result.status, 400);
      assert.deepEqual(result.body, { message: INVALID_MESSAGE });
    }
    // Une comparaison bcrypt est faite dans tous les cas : durées du même ordre de grandeur.
    const durations = [unknownEmail, wrongCode, accountWithoutCode].map((result) => result.durationMs);
    assert.ok(Math.min(...durations) > Math.max(...durations) / 3, `durées trop différentes : ${durations.map(Math.round)}`);
  });

  test('blocage du compte après 5 échecs, même avec le bon code', async () => {
    const { user, code } = await createUserWithCode();
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const failed = await call('POST', '/api/auth/recover', { body: { email: user.email, code: generateRecoveryCode() } });
      assert.equal(failed.status, 400);
    }

    const withCorrectCode = await call('POST', '/api/auth/recover', { body: { email: user.email, code } });
    assert.equal(withCorrectCode.status, 400);
    assert.deepEqual(withCorrectCode.body, { message: INVALID_MESSAGE }, 'le blocage ne doit pas être révélé');

    const stored = await User.findById(user._id);
    assert.ok(stored.recovery_locked_until > new Date(Date.now() + 14 * 60 * 1000));
    assert.ok(await SecurityEvent.exists({ user_id: user._id, type: 'recovery_locked' }));

    // Fin du blocage : le bon code fonctionne de nouveau.
    stored.recovery_locked_until = new Date(Date.now() - 1000);
    await stored.save();
    const afterLock = await call('POST', '/api/auth/recover', { body: { email: user.email, code } });
    assert.equal(afterLock.status, 200);
  });

  test('l\'ancien code ne fonctionne plus après régénération', async () => {
    const { user, code: oldCode, token } = await createUserWithCode();

    const wrongPassword = await call('POST', '/api/auth/me/recovery-code/regenerate', {
      token,
      body: { currentPassword: 'mauvais-mot-de-passe' },
    });
    assert.equal(wrongPassword.status, 400);

    const regenerated = await call('POST', '/api/auth/me/recovery-code/regenerate', {
      token,
      body: { currentPassword: PASSWORD },
    });
    assert.equal(regenerated.status, 200);
    assert.notEqual(regenerated.body.code, oldCode);

    const withOldCode = await call('POST', '/api/auth/recover', { body: { email: user.email, code: oldCode } });
    assert.equal(withOldCode.status, 400);
    const withNewCode = await call('POST', '/api/auth/recover', { body: { email: user.email, code: regenerated.body.code } });
    assert.equal(withNewCode.status, 200);
  });

  test('la route d\'envoi par e-mail est inactive en mode « recovery_code »', async () => {
    const { user } = await createUserWithCode();
    const result = await call('POST', '/api/auth/forgot-password', { body: { email: user.email } });
    assert.equal(result.status, 404);
    const stored = await User.findById(user._id);
    assert.equal(stored.password_reset_token_hash, null);

    const config = await call('GET', '/api/auth/config');
    assert.deepEqual(config.body, { passwordResetMode: 'recovery_code' });
  });
});

describe('journalisation', () => {
  test('succès, échecs et régénérations journalisés, sans jamais le code', async () => {
    const { user, code, token } = await createUserWithCode();
    await call('POST', '/api/auth/recover', { body: { email: user.email, code: generateRecoveryCode() } });
    const regenerated = await call('POST', '/api/auth/me/recovery-code/regenerate', { token, body: { currentPassword: PASSWORD } });
    await call('POST', '/api/auth/recover', { body: { email: user.email, code: regenerated.body.code } });

    const events = await SecurityEvent.find({ user_id: user._id }).lean();
    const types = events.map((event) => event.type);
    for (const type of ['recovery_code_generated', 'recovery_failed', 'recovery_code_regenerated', 'recovery_success']) {
      assert.ok(types.includes(type), `événement ${type} manquant`);
    }
    for (const event of events) {
      assert.ok(event.created_at instanceof Date);
      assert.ok(event.ip, 'IP enregistrée');
    }

    const everything = JSON.stringify(await SecurityEvent.find().lean()) + loggedLines.join('\n');
    for (const secret of [code, regenerated.body.code]) {
      assert.ok(!everything.includes(secret), 'code présent dans le journal');
      assert.ok(!everything.includes(normalizeRecoveryCode(secret)), 'code présent dans le journal');
    }
  });
});
