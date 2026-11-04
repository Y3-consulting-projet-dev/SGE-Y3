// Tests de la liste « Sélectionner un supérieur » des missions d'assistant (node:test).
// Base dédiée, distincte de celle des autres fichiers de test (exécutés en parallèle).
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'secret-de-test';
process.env.PASSWORD_RESET_MODE = 'recovery_code';
const TEST_MONGO_URI = process.env.MONGO_URI_MISSIONS_TEST || 'mongodb://localhost:27017/sge_y3_missions_test';

const { after, before, describe, test } = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');

const { app } = require('../src/app');
const User = require('../src/models/User');
const {
  buildRecipientOptions,
  getMissionDepartmentsForDepartment,
  resolveMissionRecipientsForAssistant,
} = require('../src/controllers/collaboratorEvaluationController');

const PASSWORD = 'MotDePasse#2026';
let server;
let baseUrl;
let users;

async function createUser(key, { grade, code_categorie, department, secondary_departments = [] }) {
  return User.create({
    email: `${key}@exemple.test`,
    password: Buffer.from(await bcrypt.hash(PASSWORD, 10), 'utf8'),
    name: key,
    first_name: key,
    last_name: key,
    grade,
    code_categorie,
    department,
    secondary_departments,
  });
}

const emailsOf = (list) => list.map((user) => user.email).sort();

before(async () => {
  const databaseName = new URL(TEST_MONGO_URI).pathname.replace('/', '');
  assert.ok(databaseName.endsWith('_test'), `Base de test refusée : « ${databaseName} » doit finir par _test.`);
  await mongoose.connect(TEST_MONGO_URI);
  await mongoose.connection.dropDatabase();

  users = {
    assistantEc: await createUser('assistant-ec', { grade: 'Assistant', code_categorie: '8C', department: 'EXPERTISE COMPTABLE' }),
    assistantAudit: await createUser('assistant-audit', { grade: 'Assistant', code_categorie: '8C', department: 'AUDIT' }),
    seniorEc: await createUser('senior-ec', { grade: 'Senior', code_categorie: '9A', department: 'EXPERTISE COMPTABLE' }),
    mixte: await createUser('elise-mixte', { grade: 'Assistant manager', code_categorie: '9B', department: 'AUDIT & EXPERTISE COMPTABLE' }),
    auditAvecSecondaire: await createUser('roxanne-audit', {
      grade: 'Assistant manager',
      code_categorie: '9B',
      department: 'AUDIT',
      secondary_departments: ['EXPERTISE COMPTABLE'],
    }),
    auditSeul: await createUser('senior-audit', { grade: 'Senior', code_categorie: '9A', department: 'AUDIT' }),
    conseil: await createUser('manager-conseil', { grade: 'Manager', code_categorie: '10B', department: 'CONSEIL FINANCIER' }),
    rh: await createUser('rh', { grade: 'Manager', code_categorie: '10B', department: 'RH' }),
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

describe('supérieurs proposés pour les missions d\'assistant', () => {
  test('le département mixte est rattaché à AUDIT et à EXPERTISE COMPTABLE', () => {
    assert.deepEqual(getMissionDepartmentsForDepartment('EXPERTISE COMPTABLE'), ['EXPERTISE COMPTABLE', 'AUDIT & EXPERTISE COMPTABLE']);
    assert.deepEqual(getMissionDepartmentsForDepartment('AUDIT'), ['AUDIT', 'AUDIT & EXPERTISE COMPTABLE']);
    assert.deepEqual(getMissionDepartmentsForDepartment('CONSEIL FINANCIER'), ['CONSEIL FINANCIER']);
  });

  test('assistant d\'EXPERTISE COMPTABLE : son département, le mixte et les départements secondaires', async () => {
    const recipients = await resolveMissionRecipientsForAssistant(users.assistantEc);
    assert.deepEqual(emailsOf(recipients), emailsOf([users.seniorEc, users.mixte, users.auditAvecSecondaire]));
  });

  test('assistant d\'AUDIT : le département mixte est visible dans ce sens aussi', async () => {
    const recipients = await resolveMissionRecipientsForAssistant(users.assistantAudit);
    assert.deepEqual(emailsOf(recipients), emailsOf([users.mixte, users.auditAvecSecondaire, users.auditSeul]));
  });

  test('chaque supérieur n\'apparaît qu\'une fois, sans groupe vide', async () => {
    const recipients = await resolveMissionRecipientsForAssistant(users.assistantEc);
    const groups = buildRecipientOptions(recipients, users.assistantEc, getMissionDepartmentsForDepartment('EXPERTISE COMPTABLE'));
    const ids = groups.flatMap((group) => group.users.map((user) => user.id));
    assert.equal(ids.length, new Set(ids).size, 'supérieur en double');
    assert.equal(ids.length, 3);
    assert.ok(groups.every((group) => group.users.length > 0));
    const roxanne = groups.flatMap((group) => group.users).find((user) => user.email === users.auditAvecSecondaire.email);
    assert.equal(roxanne.department, 'AUDIT', 'le département principal reste affiché');
  });

  test('assistant d\'un autre département : liste inchangée', async () => {
    const assistantConseil = await createUser('assistant-conseil', { grade: 'Assistant', code_categorie: '8C', department: 'CONSEIL FINANCIER' });
    const recipients = await resolveMissionRecipientsForAssistant(assistantConseil);
    assert.deepEqual(emailsOf(recipients), emailsOf([users.conseil]));
  });
});

describe('départements secondaires gérés par la RH', () => {
  async function rhToken() {
    const login = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: users.rh.email, password: PASSWORD }),
    }).then((response) => response.json());
    const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${login.token}` };
    await fetch(`${baseUrl}/api/auth/me/recovery-code`, { method: 'POST', headers });
    const confirmed = await fetch(`${baseUrl}/api/auth/me/recovery-code/confirm`, { method: 'POST', headers }).then((response) =>
      response.json()
    );
    return confirmed.token;
  }

  test('enregistrement normalisé, sans doublon ni département principal', async () => {
    const token = await rhToken();
    const target = users.auditSeul;
    const response = await fetch(`${baseUrl}/api/rh/collaborators/${target._id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        first_name: target.first_name,
        last_name: target.last_name,
        email: target.email,
        grade: target.grade,
        department: 'AUDIT',
        secondary_departments: ['expertise comptable', 'EXPERTISE COMPTABLE', 'AUDIT', ''],
      }),
    });
    const body = await response.json();
    assert.equal(response.status, 200, body.message);
    assert.deepEqual(body.user.secondary_departments, ['EXPERTISE COMPTABLE']);

    const recipients = await resolveMissionRecipientsForAssistant(users.assistantEc);
    assert.ok(emailsOf(recipients).includes(target.email), 'visible pour les assistants du département secondaire');
  });

  test('sans le champ dans la requête, les départements secondaires sont conservés', async () => {
    const token = await rhToken();
    const target = users.auditAvecSecondaire;
    const response = await fetch(`${baseUrl}/api/rh/collaborators/${target._id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        first_name: target.first_name,
        last_name: target.last_name,
        email: target.email,
        grade: target.grade,
        department: target.department,
      }),
    });
    const body = await response.json();
    assert.equal(response.status, 200, body.message);
    assert.deepEqual(body.user.secondary_departments, ['EXPERTISE COMPTABLE']);
  });
});
