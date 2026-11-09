// Première connexion : plusieurs chargements simultanés ne doivent pas provoquer d'erreur E11000 (node:test).
// Base dédiée, distincte de celle des autres fichiers de test (exécutés en parallèle).
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'secret-de-test';
process.env.PASSWORD_RESET_MODE = 'recovery_code';
const TEST_MONGO_URI = process.env.MONGO_URI_CONCURRENT_TEST || 'mongodb://localhost:27017/sge_y3_concurrent_test';

const { after, before, test } = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');

const { app } = require('../src/app');
const EvaluationInstance = require('../src/models/EvaluationInstance');
const User = require('../src/models/User');
const { createOrFindExisting } = require('../src/utils/createOrFindExisting');

const PASSWORD = 'MotDePasse#2026';
let server;
let baseUrl;

before(async () => {
  const databaseName = new URL(TEST_MONGO_URI).pathname.replace('/', '');
  assert.ok(databaseName.endsWith('_test'), `Base de test refusée : « ${databaseName} » doit finir par _test.`);
  await mongoose.connect(TEST_MONGO_URI);
  await mongoose.connection.dropDatabase();
  await EvaluationInstance.syncIndexes();

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

test('createOrFindExisting renvoie le document déjà créé au lieu de l\'erreur E11000', async () => {
  const doc = { cycle_label: 'Cycle 2025-2026', evalue_id: new mongoose.Types.ObjectId(), template_type: 'assistant-self-evaluation' };
  const results = await Promise.all(Array.from({ length: 5 }, () => createOrFindExisting(EvaluationInstance, { ...doc })));
  assert.equal(new Set(results.map((item) => String(item._id))).size, 1);
  assert.equal(await EvaluationInstance.countDocuments({ evalue_id: doc.evalue_id }), 1);
});

test('chargements simultanés de l\'auto-évaluation à la première connexion d\'un assistant', async () => {
  const assistant = await User.create({
    email: 'assistant@exemple.test',
    password: Buffer.from(await bcrypt.hash(PASSWORD, 10), 'utf8'),
    name: 'assistant',
    first_name: 'assistant',
    last_name: 'assistant',
    grade: 'Assistant',
    code_categorie: '8C',
    department: 'AUDIT',
    recovery_code_confirmed_at: new Date(),
  });
  const login = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: assistant.email, password: PASSWORD }),
  }).then((response) => response.json());

  const responses = await Promise.all(
    Array.from({ length: 6 }, () =>
      fetch(`${baseUrl}/api/collaborator/evaluation/me`, { headers: { Authorization: `Bearer ${login.token}` } })
    )
  );
  const bodies = await Promise.all(responses.map((response) => response.json()));

  responses.forEach((response, index) => assert.equal(response.status, 200, bodies[index].message));
  assert.equal(await EvaluationInstance.countDocuments({ evalue_id: assistant._id }), 1);
});
