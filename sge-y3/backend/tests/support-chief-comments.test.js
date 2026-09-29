// tests/support-chief-comments.test.js
//
// Couvre les "chief comments" du service Support : des retours anonymes que le support
// peut laisser sur d'autres collaborateurs (PUT /chief-comments), et que ces
// collaborateurs peuvent ensuite consulter sur eux-mêmes (GET /chief-comments/received).

const request = require('supertest');
const app = require('../src/app');
const EvaluationInstance = require('../src/models/EvaluationInstance');
const { creerCollaborateur, tokenPour } = require('./fixtures');

function creerSupport(champs = {}) {
  return creerCollaborateur({ department: 'SUPPORT', ...champs });
}

describe('PUT /api/support/chief-comments', () => {
  it('enregistre un commentaire ciblant un collaborateur', async () => {
    // Arrange
    const support = await creerSupport();
    const cible = await creerCollaborateur({ grade: 'Assistant', code_categorie: '8C' });

    // Act
    const reponse = await request(app)
      .put('/api/support/chief-comments')
      .set('Authorization', `Bearer ${tokenPour(support)}`)
      .send({
        chiefComments: [
          { targetUserId: cible._id.toString(), targetName: cible.name, comment: 'Très réactif sur les demandes support.' },
        ],
      });

    // Assert — réponse HTTP
    expect(reponse.status).toBe(200);

    // Assert — en base
    const enBase = await EvaluationInstance.findOne({ evalue_id: support._id });
    expect(enBase.chief_comments).toHaveLength(1);
    expect(String(enBase.chief_comments[0].target_user_id)).toBe(String(cible._id));
    expect(enBase.chief_comments[0].comment).toBe('Très réactif sur les demandes support.');
  });

  it('ignore un commentaire sans nom de cible (target_name manquant)', async () => {
    // normalizeChiefComments (supportController.js) filtre sur `item.target_name` :
    // un commentaire sans cible identifiée n'est jamais persisté, même envoyé.
    const support = await creerSupport();

    const reponse = await request(app)
      .put('/api/support/chief-comments')
      .set('Authorization', `Bearer ${tokenPour(support)}`)
      .send({ chiefComments: [{ comment: 'Commentaire orphelin, sans cible.' }] });

    expect(reponse.status).toBe(200);
    const enBase = await EvaluationInstance.findOne({ evalue_id: support._id });
    expect(enBase.chief_comments).toHaveLength(0);
  });
});

describe('GET /api/support/chief-comments/received', () => {
  it("renvoie les commentaires reçus par le collaborateur connecté", async () => {
    // Arrange — un commentaire déjà "envoyé" (submittedAt renseigné : sans lui, le
    // filtre de getReceivedSupportChiefComments ne le compte pas comme reçu).
    const support = await creerSupport();
    // La route de lecture (GET /chief-comments/received) est, comme le reste du
    // routeur, protégée par requireSupport : seul un compte du département SUPPORT
    // peut l'appeler, même pour consulter des commentaires qui le concernent lui-même.
    const cible = await creerSupport();
    await request(app)
      .put('/api/support/chief-comments')
      .set('Authorization', `Bearer ${tokenPour(support)}`)
      .send({
        chiefComments: [
          {
            targetUserId: cible._id.toString(),
            targetName: cible.name,
            comment: 'Très réactif sur les demandes support.',
            submittedAt: new Date().toISOString(),
          },
        ],
      });

    // Act
    const reponse = await request(app)
      .get('/api/support/chief-comments/received')
      .set('Authorization', `Bearer ${tokenPour(cible)}`);

    // Assert
    expect(reponse.status).toBe(200);
    expect(reponse.body.received).toHaveLength(1);
    expect(reponse.body.received[0].comment).toBe('Très réactif sur les demandes support.');
  });
});
