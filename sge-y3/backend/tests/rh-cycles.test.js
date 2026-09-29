// tests/rh-cycles.test.js
//
// Couvre la gestion des cycles d'évaluation par la RH. Point notable vérifié dans
// createRhCycle (rhController.js) : créer un nouveau cycle désactive tous les
// cycles actifs existants puis appelle activateCycle(), qui met à jour le cache en
// mémoire lu par getCurrentCycleLabel() — utilisé par toutes les routes d'évaluation
// du projet (cf. tests/assistant-*, senior-*, manager-*). Un cycle nouvellement créé
// devient donc immédiatement "le" cycle courant pour toute requête suivante, y
// compris dans la même suite de tests.

const request = require('supertest');
const app = require('../src/app');
const Cycle = require('../src/models/Cycle');
const { getCurrentCycleLabel } = require('../src/utils/activeCycle');
const { creerCollaborateur, tokenPour } = require('./fixtures');

function creerRh(champs = {}) {
  return creerCollaborateur({ department: 'RH', ...champs });
}

describe('GET /api/rh/cycles', () => {
  it('liste les cycles existants', async () => {
    const rh = await creerRh();
    await Cycle.create({ label: 'Cycle 2020-2021', start_date: new Date('2020-06-01'), end_date: new Date('2021-06-01') });

    const reponse = await request(app)
      .get('/api/rh/cycles')
      .set('Authorization', `Bearer ${tokenPour(rh)}`);

    expect(reponse.status).toBe(200);
    const labels = reponse.body.cycles.map((cycle) => cycle.label);
    expect(labels).toContain('Cycle 2020-2021');
  });
});

describe('POST /api/rh/cycles', () => {
  it('refuse des dates invalides', async () => {
    const rh = await creerRh();

    const reponse = await request(app)
      .post('/api/rh/cycles')
      .set('Authorization', `Bearer ${tokenPour(rh)}`)
      .send({ start_date: 'pas-une-date', end_date: '2027-06-01' });

    expect(reponse.status).toBe(400);
  });

  it('refuse une date de début postérieure à la date de fin', async () => {
    const rh = await creerRh();

    const reponse = await request(app)
      .post('/api/rh/cycles')
      .set('Authorization', `Bearer ${tokenPour(rh)}`)
      .send({ start_date: '2028-06-01', end_date: '2027-06-01' });

    expect(reponse.status).toBe(400);
  });

  it('crée le cycle, le désigne actif, et le fait devenir le cycle courant du reste de l\'application', async () => {
    // Arrange
    const rh = await creerRh();

    // Act
    const reponse = await request(app)
      .post('/api/rh/cycles')
      .set('Authorization', `Bearer ${tokenPour(rh)}`)
      .send({ start_date: '2027-06-01', end_date: '2028-06-01' });

    // Assert — réponse HTTP : le libellé est dérivé des années des dates fournies
    expect(reponse.status).toBe(201);
    expect(reponse.body.cycle.label).toBe('Cycle 2027-2028');

    // Assert — en base
    const enBase = await Cycle.findOne({ label: 'Cycle 2027-2028' });
    expect(enBase.is_active).toBe(true);

    // Assert — effet de bord global : le cache en mémoire lu par tout le reste de
    // l'application (activeCycle.js) pointe maintenant vers ce nouveau cycle.
    expect(getCurrentCycleLabel()).toBe('Cycle 2027-2028');
  });

  it('refuse un libellé de cycle déjà existant', async () => {
    const rh = await creerRh();
    await request(app)
      .post('/api/rh/cycles')
      .set('Authorization', `Bearer ${tokenPour(rh)}`)
      .send({ start_date: '2029-06-01', end_date: '2030-06-01' });

    const reponse = await request(app)
      .post('/api/rh/cycles')
      .set('Authorization', `Bearer ${tokenPour(rh)}`)
      .send({ start_date: '2029-06-01', end_date: '2030-06-01' }); // mêmes années => même libellé

    expect(reponse.status).toBe(409);
  });
});
