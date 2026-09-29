// tests/assistant-resultats-historique.test.js
//
// Couvre les routes de lecture du parcours Assistant : les résultats du cycle en
// cours (et leur export PDF) et l'historique des cycles précédents.
//
// Ce sont des routes de lecture seule : il n'y a rien à vérifier en base après
// coup, on se concentre sur le contenu et le code de la réponse HTTP.

const request = require('supertest');
const app = require('../src/app');
const EvaluationInstance = require('../src/models/EvaluationInstance');
const { getCurrentCycleLabel } = require('../src/utils/activeCycle');
const { creerCollaborateur, tokenPour } = require('./fixtures');

describe('GET /api/collaborator/results/me', () => {
  it('renvoie un résultat exploitable même sans aucune mission évaluée', async () => {
    // Arrange — un assistant tout neuf : aucune EvaluationInstance en base pour lui.
    const assistant = await creerCollaborateur();

    // Act
    const reponse = await request(app)
      .get('/api/collaborator/results/me')
      .set('Authorization', `Bearer ${tokenPour(assistant)}`);

    // Assert — comme /evaluation/me, cette route crée l'évaluation à la volée si
    // besoin (getOrCreateAssistantEvaluation) : elle ne doit jamais planter sur un
    // profil neuf. C'est exactement le cas qui se produira pour chaque nouvel
    // assistant du cabinet au tout premier jour du cycle.
    expect(reponse.status).toBe(200);
    expect(reponse.body.kpis).toBeDefined();
    expect(reponse.body.missionScores).toEqual([]);
  });
});

describe('GET /api/collaborator/results/me/download', () => {
  it('renvoie un PDF téléchargeable', async () => {
    // Arrange
    const assistant = await creerCollaborateur();

    // Act
    const reponse = await request(app)
      .get('/api/collaborator/results/me/download')
      .set('Authorization', `Bearer ${tokenPour(assistant)}`);

    // Assert — on vérifie le contrat HTTP (type de contenu + téléchargement forcé),
    // pas le contenu binaire du PDF lui-même : ce serait fragile et peu lisible.
    expect(reponse.status).toBe(200);
    expect(reponse.headers['content-type']).toBe('application/pdf');
    expect(reponse.headers['content-disposition']).toContain('attachment');
  });
});

describe('GET /api/collaborator/evaluation/history', () => {
  it('liste les cycles passés mais exclut toujours le cycle en cours', async () => {
    // Arrange — deux évaluations pour le même assistant :
    //  - une pour le cycle courant, créée par le premier appel à /evaluation/me ;
    //  - une pour un cycle déjà clos, insérée directement en base.
    const assistant = await creerCollaborateur();
    await request(app)
      .get('/api/collaborator/evaluation/me')
      .set('Authorization', `Bearer ${tokenPour(assistant)}`);

    await EvaluationInstance.create({
      cycle_label: 'Cycle 2024-2025', // un cycle clos, différent du cycle courant
      evalue_id: assistant._id,
      template_type: 'assistant-self-evaluation',
      status: 'Cloture',
    });

    // Act
    const reponse = await request(app)
      .get('/api/collaborator/evaluation/history')
      .set('Authorization', `Bearer ${tokenPour(assistant)}`);

    // Assert — la route filtre explicitement `cycle_label: { $ne: getCurrentCycleLabel() }`
    // (voir getMyAssistantEvaluationHistory) : seul le cycle clos doit apparaître,
    // jamais celui en cours, même si les deux existent en base pour cet assistant.
    expect(reponse.status).toBe(200);
    expect(reponse.body.cycles).toHaveLength(1);
    expect(reponse.body.cycles[0].cycle_label).toBe('Cycle 2024-2025');
    expect(reponse.body.cycles[0].cycle_label).not.toBe(getCurrentCycleLabel());
  });

  it("renvoie une liste vide pour un assistant qui n'a encore aucun cycle clos", async () => {
    // Arrange — un assistant qui n'a que l'évaluation du cycle en cours
    const assistant = await creerCollaborateur();
    await request(app)
      .get('/api/collaborator/evaluation/me')
      .set('Authorization', `Bearer ${tokenPour(assistant)}`);

    // Act
    const reponse = await request(app)
      .get('/api/collaborator/evaluation/history')
      .set('Authorization', `Bearer ${tokenPour(assistant)}`);

    // Assert
    expect(reponse.status).toBe(200);
    expect(reponse.body.cycles).toEqual([]);
  });
});
