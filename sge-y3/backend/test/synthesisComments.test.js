// Commentaires des associés sur les synthèses RH (node:test).
// Base dédiée, distincte de celle des autres fichiers de test (exécutés en parallèle).
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'secret-de-test';
process.env.PASSWORD_RESET_MODE = 'recovery_code';
const TEST_MONGO_URI = process.env.MONGO_URI_SYNTHESIS_TEST || 'mongodb://localhost:27017/sge_y3_synthesis_test';

const { after, before, test } = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');

const { app } = require('../src/app');
const User = require('../src/models/User');
const SynthesisComment = require('../src/models/SynthesisComment');
const { attachSynthesisComments } = require('../src/utils/synthesisComments');
const { getCurrentCycleLabel } = require('../src/utils/activeCycle');

const PASSWORD = 'MotDePasse#2026';
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
    recovery_code_confirmed_at: new Date(),
  });
}

async function tokenFor(user) {
  const login = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: user.email, password: PASSWORD }),
  }).then((response) => response.json());
  return login.token;
}

async function putComment(token, memberId, comment) {
  const response = await fetch(`${baseUrl}/api/associate/syntheses/${memberId}/comment`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ comment }),
  });
  return { status: response.status, body: await response.json() };
}

before(async () => {
  const databaseName = new URL(TEST_MONGO_URI).pathname.replace('/', '');
  assert.ok(databaseName.endsWith('_test'), `Base de test refusée : « ${databaseName} » doit finir par _test.`);
  await mongoose.connect(TEST_MONGO_URI);
  await mongoose.connection.dropDatabase();
  await SynthesisComment.syncIndexes();

  users = {
    associeA: await createUser('associe-a', { grade: 'Associé', code_categorie: '11', department: '' }),
    associeB: await createUser('associe-b', { grade: 'Associé', code_categorie: '11', department: '' }),
    assistant: await createUser('assistant', { grade: 'Assistant', code_categorie: '8C', department: 'AUDIT' }),
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

test('chaque associé enregistre, modifie et supprime son propre commentaire', async () => {
  const tokenA = await tokenFor(users.associeA);
  const tokenB = await tokenFor(users.associeB);
  const memberId = String(users.assistant._id);

  const created = await putComment(tokenA, memberId, '  Très bonne année, à promouvoir.  ');
  assert.equal(created.status, 200, created.body.message);
  assert.equal(created.body.associateComments.length, 1);
  assert.equal(created.body.associateComments[0].comment, 'Très bonne année, à promouvoir.');
  assert.equal(created.body.associateComments[0].isMine, true);

  const other = await putComment(tokenB, memberId, 'Avis partagé.');
  assert.equal(other.status, 200, other.body.message);
  assert.equal(other.body.associateComments.length, 2);
  assert.deepEqual(
    other.body.associateComments.map((item) => [item.authorName, item.isMine]),
    [['associe-a', false], ['associe-b', true]]
  );

  const updated = await putComment(tokenA, memberId, 'Avis mis à jour.');
  assert.equal(updated.status, 200);
  assert.equal(await SynthesisComment.countDocuments({ member_id: memberId }), 2, 'mise à jour, pas de doublon');

  const removed = await putComment(tokenA, memberId, '   ');
  assert.equal(removed.status, 200);
  assert.equal(removed.body.message, 'Commentaire supprimé.');
  assert.deepEqual(removed.body.associateComments.map((item) => item.authorName), ['associe-b']);
});

test('commentaire refusé : collaborateur inconnu, texte trop long, utilisateur non associé', async () => {
  const tokenA = await tokenFor(users.associeA);
  const memberId = String(users.assistant._id);

  assert.equal((await putComment(tokenA, new mongoose.Types.ObjectId().toString(), 'x')).status, 404);
  assert.equal((await putComment(tokenA, 'pas-un-id', 'x')).status, 404);
  assert.equal((await putComment(tokenA, memberId, 'x'.repeat(2001))).status, 400);

  const tokenAssistant = await tokenFor(users.assistant);
  assert.equal((await putComment(tokenAssistant, memberId, 'x')).status, 403);
});

test('les commentaires sont rattachés aux lignes de synthèse (vue RH, sans « isMine »)', async () => {
  const memberId = String(users.assistant._id);
  const [row] = await attachSynthesisComments([{ id: 'r1', memberId }], getCurrentCycleLabel());
  assert.equal(row.id, 'r1');
  assert.ok(row.associateComments.length >= 1);
  assert.ok(row.associateComments.every((item) => item.isMine === false));
});
