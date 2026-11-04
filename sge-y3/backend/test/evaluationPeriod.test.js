// Tests de la période évaluée (1er octobre N → 30 septembre N+1) : cycle RH et dates de missions (node:test).
// Base dédiée, distincte de celle des autres fichiers de test (exécutés en parallèle).
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'secret-de-test';
process.env.PASSWORD_RESET_MODE = 'recovery_code';
const TEST_MONGO_URI = process.env.MONGO_URI_PERIOD_TEST || 'mongodb://localhost:27017/sge_y3_period_test';

const { after, before, describe, test } = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');

const { app } = require('../src/app');
const Cycle = require('../src/models/Cycle');
const User = require('../src/models/User');
const { getActiveEvaluationPeriod, loadActiveCycle } = require('../src/utils/activeCycle');
const {
  extractPeriodDates,
  findMissionPeriodError,
  validateCyclePeriod,
  validateMissionPeriod,
} = require('../src/utils/evaluationPeriod');

const PASSWORD = 'MotDePasse#2026';
const PERIOD_2025 = { start_date: '2025-10-01', end_date: '2026-09-30' };
let server;
let baseUrl;
let users;

async function createUser(key, { grade, code_categorie, department }) {
  return User.create({
    email: `${key}@exemple.test`,
    password: Buffer.from(await bcrypt.hash(PASSWORD, 10), 'utf8'),
    name: key,
    first_name: key,
    last_name: key,
    grade,
    code_categorie,
    department,
  });
}

async function tokenFor(user) {
  const login = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: user.email, password: PASSWORD }),
  }).then((response) => response.json());
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${login.token}` };
  await fetch(`${baseUrl}/api/auth/me/recovery-code`, { method: 'POST', headers });
  const confirmed = await fetch(`${baseUrl}/api/auth/me/recovery-code/confirm`, { method: 'POST', headers }).then(
    (response) => response.json()
  );
  return confirmed.token;
}

async function call(method, path, token, body) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: response.status, body: await response.json().catch(() => ({})) };
}

before(async () => {
  const databaseName = new URL(TEST_MONGO_URI).pathname.replace('/', '');
  assert.ok(databaseName.endsWith('_test'), `Base de test refusée : « ${databaseName} » doit finir par _test.`);
  await mongoose.connect(TEST_MONGO_URI);
  await mongoose.connection.dropDatabase();

  users = {
    rh: await createUser('rh', { grade: 'Manager', code_categorie: '10B', department: 'RH' }),
    assistant: await createUser('assistant', { grade: 'Assistant', code_categorie: '8C', department: 'AUDIT' }),
    senior: await createUser('senior', { grade: 'Senior', code_categorie: '9A', department: 'AUDIT' }),
  };

  await new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', resolve);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
});

describe('règle de la période évaluée', () => {
  test('seule la période 1er octobre N → 30 septembre N+1 est acceptée', () => {
    assert.deepEqual(validateCyclePeriod('2025-10-01', '2026-09-30').period, {
      ...PERIOD_2025,
      label: 'Cycle 2025-2026',
    });
    assert.ok(validateCyclePeriod('2026-10-01', '2027-09-30').period, 'exercice suivant accepté');

    for (const [start, end] of [
      ['2025-06-01', '2026-06-01'],
      ['2025-10-01', '2026-09-29'],
      ['2025-10-02', '2026-09-30'],
      ['2025-10-01', '2027-09-30'],
      ['2025-01-01', '2025-12-31'],
      ['', ''],
      ['2025-02-31', '2026-09-30'],
    ]) {
      assert.ok(validateCyclePeriod(start, end).message, `${start} → ${end} doit être refusé`);
    }
  });

  test('lecture des dates dans le texte de période des missions', () => {
    assert.deepEqual(extractPeriodDates('Du 01-10-2025 au 15-11-2025'), ['2025-10-01', '2025-11-15']);
    assert.deepEqual(extractPeriodDates('À partir du 2026-01-05'), ['2026-01-05']);
    assert.deepEqual(extractPeriodDates('Jusqu\'au 30/09/2026'), ['2026-09-30']);
    assert.deepEqual(extractPeriodDates('Période non renseignée'), []);
    assert.equal(extractPeriodDates('Du 31-02-2026 au 01-03-2026'), null);
  });

  test('dates de mission : bornes incluses, hors période refusée', () => {
    assert.equal(validateMissionPeriod('Du 01-10-2025 au 30-09-2026', PERIOD_2025), '');
    assert.match(validateMissionPeriod('Période non renseignée', PERIOD_2025), /date de début et la date de fin/);
    assert.match(validateMissionPeriod('', PERIOD_2025), /date de début et la date de fin/);
    assert.match(validateMissionPeriod('À partir du 01-10-2025', PERIOD_2025), /date de début et la date de fin/);
    assert.match(validateMissionPeriod('Du 31-10-2025 au 01-10-2025', PERIOD_2025), /postérieure ou égale/);
    assert.match(validateMissionPeriod('Du 30-09-2025 au 15-10-2025', PERIOD_2025), /1er octobre 2025 au 30 septembre 2026/);
    assert.ok(validateMissionPeriod('Du 15-09-2026 au 01-10-2026', PERIOD_2025));
    assert.ok(validateMissionPeriod('Du 31-02-2026 au 01-03-2026', PERIOD_2025));
  });

  test('une mission déjà enregistrée avec d\'anciennes dates ne bloque pas l\'enregistrement', () => {
    const previous = [{ mission_id: 'ancienne', period: 'Du 01-06-2025 au 30-06-2025' }];
    assert.equal(findMissionPeriodError(previous, previous, PERIOD_2025), '');
    assert.ok(
      findMissionPeriodError([{ mission_id: 'ancienne', period: 'Du 01-06-2025 au 30-07-2025' }], previous, PERIOD_2025),
      'période modifiée : contrôlée'
    );
    assert.ok(
      findMissionPeriodError([...previous, { mission_id: 'nouvelle', period: 'Du 01-06-2025 au 30-06-2025' }], previous, PERIOD_2025),
      'nouvelle mission : contrôlée'
    );
  });
});

describe('cycle actif', () => {
  test('le cycle 2025-2026 existant est ramené au 1er octobre 2025 → 30 septembre 2026', async () => {
    await Cycle.create({
      label: 'Cycle 2025-2026',
      start_date: new Date('2025-06-01'),
      end_date: new Date('2026-06-01'),
      is_active: true,
    });

    await loadActiveCycle();

    assert.deepEqual(getActiveEvaluationPeriod(), { label: 'Cycle 2025-2026', ...PERIOD_2025 });
    const stored = await Cycle.findOne({ label: 'Cycle 2025-2026' });
    assert.equal(stored.start_date.toISOString().slice(0, 10), '2025-10-01');
    assert.equal(stored.end_date.toISOString().slice(0, 10), '2026-09-30');
    assert.equal(await Cycle.countDocuments(), 1, 'aucun cycle en double');
  });

  test('la période est exposée aux utilisateurs connectés', async () => {
    const token = await tokenFor(users.assistant);
    const { status, body } = await call('GET', '/api/cycles/active', token);
    assert.equal(status, 200);
    assert.deepEqual(body.period, { label: 'Cycle 2025-2026', ...PERIOD_2025 });
  });

  test('la RH ne peut pas lancer un cycle avec d\'autres dates', async () => {
    const token = await tokenFor(users.rh);
    const refused = await call('POST', '/api/rh/cycles', token, { start_date: '2026-06-01', end_date: '2027-06-01' });
    assert.equal(refused.status, 400);
    assert.match(refused.body.message, /1er octobre au 30 septembre/);
    assert.equal(await Cycle.countDocuments(), 1);
  });
});

describe('dates de missions refusées par le serveur', () => {
  test('auto-évaluation assistant : mission hors période refusée, mission dans la période acceptée', async () => {
    const token = await tokenFor(users.assistant);
    const loaded = await call('GET', '/api/collaborator/evaluation/me', token);
    assert.equal(loaded.status, 200, loaded.body.message);

    const mission = (period) => ({
      id: `mission-${period.length}`,
      title: 'Audit client',
      period,
      department: 'AUDIT',
      createdByRole: 'self',
      recipients: [],
      criteria: [],
      comment: '',
    });

    const refused = await call('PUT', '/api/collaborator/evaluation/me', token, {
      missionEvaluations: [mission('Du 01-06-2025 au 30-06-2025')],
    });
    assert.equal(refused.status, 400);
    assert.match(refused.body.message, /période évaluée, du 1er octobre 2025 au 30 septembre 2026/);

    const accepted = await call('PUT', '/api/collaborator/evaluation/me', token, {
      missionEvaluations: [mission('Du 01-10-2025 au 31-10-2025')],
    });
    assert.equal(accepted.status, 200, accepted.body.message);
  });
});
