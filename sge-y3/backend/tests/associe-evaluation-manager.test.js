// tests/associe-evaluation-manager.test.js
//
// Couvre la revue par l'Associé des missions manager qui lui sont soumises —
// getAssociateManagerAvailableMissions (associateController.js) ne rend visible à
// l'associé QUE les missions manager au statut "Soumise" dont il est destinataire
// (recipient.can_evaluate !== false). On réutilise le montage déjà validé dans
// tests/manager-auto-evaluation.test.js : le manager crée sa mission, la soumet en
// désignant cet associé comme destinataire (selectedAssociateRecipients) — c'est
// justement l'étape qui, côté manager, exige un associé réel.

const request = require('supertest');
const app = require('../src/app');
const AssociateManagerReview = require('../src/models/AssociateManagerReview');
const { creerCollaborateur, tokenPour } = require('./fixtures');

function creerAssocie(champs = {}) {
  return creerCollaborateur({ grade: 'Associé', code_categorie: '11', ...champs });
}

function creerManager(champs = {}) {
  return creerCollaborateur({ grade: 'Manager', code_categorie: '10B', ...champs });
}

// Un manager dont la mission "manager-mission-1" est déjà soumise, avec CET associé
// comme destinataire — condition nécessaire à getAssociateManagerAvailableMissions().
async function creerManagerAvecMissionSoumiseAAssocie(associe) {
  const manager = await creerManager();

  await request(app)
    .put('/api/manager/self-evaluation')
    .set('Authorization', `Bearer ${tokenPour(manager)}`)
    .send({
      missionEvaluations: [
        { id: 'manager-mission-1', title: 'Mission de conseil stratégique', criteria: [{ id: 'crit-1', label: 'Vision', score: 4 }] },
      ],
    });

  await request(app)
    .post('/api/manager/self-evaluation/missions/submit')
    .set('Authorization', `Bearer ${tokenPour(manager)}`)
    .send({ missionId: 'manager-mission-1', selectedAssociateRecipients: [{ id: associe._id.toString() }] });

  return manager;
}

describe('GET /api/associate/manager-evaluations/:managerId', () => {
  it('synchronise la mission manager soumise dans la revue de l\'associé', async () => {
    const associe = await creerAssocie();
    const manager = await creerManagerAvecMissionSoumiseAAssocie(associe);

    const reponse = await request(app)
      .get(`/api/associate/manager-evaluations/${manager._id}`)
      .set('Authorization', `Bearer ${tokenPour(associe)}`);

    expect(reponse.status).toBe(200);

    const revue = await AssociateManagerReview.findOne({ associate_id: associe._id, manager_id: manager._id });
    expect(revue).not.toBeNull();
    expect(revue.mission_reviews).toHaveLength(1);
    expect(revue.mission_reviews[0].mission_id).toBe('manager-mission-1');
    expect(revue.mission_reviews[0].criteria[0].criterion_id).toBe('crit-1');
    expect(revue.mission_reviews[0].criteria[0].score).toBeNull(); // l'associé n'a pas encore noté
  });

  it('renvoie 404 pour un utilisateur qui n\'est pas manager/RH (pas une cible de revue associé)', async () => {
    const associe = await creerAssocie();
    const assistant = await creerCollaborateur({ grade: 'Assistant', code_categorie: '8C' });

    const reponse = await request(app)
      .get(`/api/associate/manager-evaluations/${assistant._id}`)
      .set('Authorization', `Bearer ${tokenPour(associe)}`);

    expect(reponse.status).toBe(404);
  });
});

describe('PUT /api/associate/manager-evaluations/:managerId', () => {
  it("enregistre la note de l'associé sur la mission manager", async () => {
    const associe = await creerAssocie();
    const manager = await creerManagerAvecMissionSoumiseAAssocie(associe);
    // Le premier GET matérialise la revue et synchronise la mission (comme le ferait
    // l'écran de l'associé avant qu'il ne commence à noter).
    await request(app).get(`/api/associate/manager-evaluations/${manager._id}`).set('Authorization', `Bearer ${tokenPour(associe)}`);

    const reponse = await request(app)
      .put(`/api/associate/manager-evaluations/${manager._id}`)
      .set('Authorization', `Bearer ${tokenPour(associe)}`)
      .send({
        missions: [
          { id: 'manager-mission-1', title: 'Mission de conseil stratégique', criteria: [{ id: 'crit-1', label: 'Vision', sectionTitle: 'Leadership', sectionComment: 'Confirmé par l\'associé.', score: 5 }] },
        ],
        note: 'Manager solide, à confirmer sur la durée.',
      });

    expect(reponse.status).toBe(200);

    const revue = await AssociateManagerReview.findOne({ associate_id: associe._id, manager_id: manager._id });
    expect(revue.mission_reviews[0].criteria[0].score).toBe(5);
    expect(revue.associate_note).toBe('Manager solide, à confirmer sur la durée.');
  });
});

describe('POST /api/associate/manager-evaluations/:managerId/submit-rh', () => {
  it('refuse la transmission tant qu\'un critère de la mission manager n\'a pas de note', async () => {
    const associe = await creerAssocie();
    const manager = await creerManagerAvecMissionSoumiseAAssocie(associe);
    await request(app).get(`/api/associate/manager-evaluations/${manager._id}`).set('Authorization', `Bearer ${tokenPour(associe)}`);

    const reponse = await request(app)
      .post(`/api/associate/manager-evaluations/${manager._id}/submit-rh`)
      .set('Authorization', `Bearer ${tokenPour(associe)}`);

    expect(reponse.status).toBe(400);
  });

  it('transmet la mission manager notée à la RH', async () => {
    // Arrange
    const associe = await creerAssocie();
    const manager = await creerManagerAvecMissionSoumiseAAssocie(associe);
    await request(app)
      .put(`/api/associate/manager-evaluations/${manager._id}`)
      .set('Authorization', `Bearer ${tokenPour(associe)}`)
      .send({
        missions: [
          { id: 'manager-mission-1', title: 'Mission de conseil stratégique', criteria: [{ id: 'crit-1', label: 'Vision', sectionTitle: 'Leadership', sectionComment: 'Confirmé par l\'associé.', score: 5 }] },
        ],
      });

    // Act
    const reponse = await request(app)
      .post(`/api/associate/manager-evaluations/${manager._id}/submit-rh`)
      .set('Authorization', `Bearer ${tokenPour(associe)}`);

    // Assert
    expect(reponse.status).toBe(200);

    const revue = await AssociateManagerReview.findOne({ associate_id: associe._id, manager_id: manager._id });
    expect(revue.status).toBe('Soumis à RH');
    expect(revue.submitted_at).not.toBeNull();
  });
});
