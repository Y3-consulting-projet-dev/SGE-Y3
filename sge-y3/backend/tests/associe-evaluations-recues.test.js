// tests/associe-evaluations-recues.test.js
//
// Couvre la revue par l'Associé des évaluations d'Assistants/Seniors qui lui sont
// transmises directement — canAssociateAccessDirectEvaluation (associateController.js)
// donne accès à l'associé dès qu'une mission de l'EvaluationInstance du collaborateur
// le désigne comme destinataire ET que cette mission est soumise. On réutilise donc
// exactement le montage déjà utilisé pour les tests assistant/senior/manager :
// l'assistant crée puis soumet une mission en désignant l'associé comme destinataire.
//
// Point clé pour saveReceivedAssociateEvaluationComment / submitReceivedAssociateEvaluationToRh :
// l'associé fournit lui-même les "sections" de sa revue (peer_review_sections), un champ
// distinct des sections propres au collaborateur — donc entièrement maîtrisable par le
// test, sans dépendre du référentiel de compétences généré.

const request = require('supertest');
const app = require('../src/app');
const EvaluationInstance = require('../src/models/EvaluationInstance');
const { creerCollaborateur, tokenPour } = require('./fixtures');

function creerAssocie(champs = {}) {
  return creerCollaborateur({ grade: 'Associé', code_categorie: '11', ...champs });
}

// Un assistant dont la mission "mission-1", déjà soumise, désigne CET associé comme
// destinataire — condition nécessaire à canAssociateAccessDirectEvaluation().
async function creerAssistantAvecMissionSoumiseAAssocie(associe) {
  const assistant = await creerCollaborateur({ grade: 'Assistant', code_categorie: '8C' });

  await request(app)
    .put('/api/collaborator/evaluation/me')
    .set('Authorization', `Bearer ${tokenPour(assistant)}`)
    .send({
      missionEvaluations: [
        {
          id: 'mission-1',
          title: 'Audit du client Ycube',
          criteria: [{ id: 'crit-1', label: 'Rigueur', sectionTitle: 'Compétences techniques', sectionComment: 'Bon respect des délais.', score: 4 }],
          recipients: [{ id: associe._id.toString(), name: associe.name, department: associe.department }],
        },
      ],
    });

  await request(app)
    .post('/api/collaborator/evaluation/me/missions/submit')
    .set('Authorization', `Bearer ${tokenPour(assistant)}`)
    .send({ missionId: 'mission-1' });

  return assistant;
}

function sectionRevueValide(overrides = {}) {
  return [
    {
      id: 1,
      title: 'Avis de l\'associé',
      subtitle: 'Revue associé',
      status: 'Complete',
      comment: 'Avis favorable, à confirmer.',
      criteria: [{ criterion_id: 'avis-1', label: 'Potentiel', score: 4, ...overrides }],
    },
  ];
}

describe('GET /api/associate/received-evaluations', () => {
  it("liste l'évaluation d'un assistant une fois transmise à l'associé", async () => {
    const associe = await creerAssocie();
    const assistant = await creerAssistantAvecMissionSoumiseAAssocie(associe);
    // La liste par défaut (scope=all) exige que submitted_to_user_ids contienne
    // l'associé, ce que seule la soumission FINALE (pas juste la mission) renseigne.
    await request(app)
      .post('/api/collaborator/evaluation/me/submit')
      .set('Authorization', `Bearer ${tokenPour(assistant)}`);

    const reponse = await request(app)
      .get('/api/associate/received-evaluations')
      .set('Authorization', `Bearer ${tokenPour(associe)}`);

    expect(reponse.status).toBe(200);
    const evalueIds = reponse.body.items.map((item) => item.submitterId || item.evalue_id || item.id);
    expect(JSON.stringify(reponse.body.items)).toContain(String(assistant._id));
  });
});

describe('PUT /api/associate/received-evaluations/:evaluationId/comment', () => {
  it('refuse une revue sans sections', async () => {
    const associe = await creerAssocie();
    const assistant = await creerAssistantAvecMissionSoumiseAAssocie(associe);
    const instance = await EvaluationInstance.findOne({ evalue_id: assistant._id });

    const reponse = await request(app)
      .put(`/api/associate/received-evaluations/${instance._id}/comment`)
      .set('Authorization', `Bearer ${tokenPour(associe)}`)
      .send({});

    expect(reponse.status).toBe(400);
  });

  it("renvoie 404 pour une évaluation qui n'a pas été transmise à cet associé", async () => {
    const associe = await creerAssocie();
    const autreAssocie = await creerAssocie();
    const assistant = await creerAssistantAvecMissionSoumiseAAssocie(autreAssocie); // transmise à un AUTRE associé
    const instance = await EvaluationInstance.findOne({ evalue_id: assistant._id });

    const reponse = await request(app)
      .put(`/api/associate/received-evaluations/${instance._id}/comment`)
      .set('Authorization', `Bearer ${tokenPour(associe)}`)
      .send({ sections: sectionRevueValide() });

    expect(reponse.status).toBe(404);
  });

  it("enregistre l'avis de l'associé sur l'évaluation de l'assistant", async () => {
    const associe = await creerAssocie();
    const assistant = await creerAssistantAvecMissionSoumiseAAssocie(associe);
    const instance = await EvaluationInstance.findOne({ evalue_id: assistant._id });

    const reponse = await request(app)
      .put(`/api/associate/received-evaluations/${instance._id}/comment`)
      .set('Authorization', `Bearer ${tokenPour(associe)}`)
      .send({ sections: sectionRevueValide(), comment: 'Excellent potentiel, à suivre de près.' });

    expect(reponse.status).toBe(200);

    const enBase = await EvaluationInstance.findById(instance._id);
    expect(enBase.peer_review_comment).toBe('Excellent potentiel, à suivre de près.');
    expect(String(enBase.peer_review_comment_by_user_id)).toBe(String(associe._id));
    expect(enBase.peer_review_sections[0].criteria[0].score).toBe(4);
  });
});

describe('POST /api/associate/received-evaluations/:evaluationId/submit-rh', () => {
  it("refuse la transmission à la RH tant que l'avis de l'associé n'a pas été enregistré", async () => {
    const associe = await creerAssocie();
    const assistant = await creerAssistantAvecMissionSoumiseAAssocie(associe);
    const instance = await EvaluationInstance.findOne({ evalue_id: assistant._id });

    const reponse = await request(app)
      .post(`/api/associate/received-evaluations/${instance._id}/submit-rh`)
      .set('Authorization', `Bearer ${tokenPour(associe)}`);

    expect(reponse.status).toBe(400);
  });

  it("transmet l'évaluation à la RH une fois l'avis de l'associé enregistré", async () => {
    // Arrange — un RH doit exister pour que la transmission ait un destinataire
    const rh = await creerCollaborateur({ department: 'RH' });
    const associe = await creerAssocie();
    const assistant = await creerAssistantAvecMissionSoumiseAAssocie(associe);
    const instance = await EvaluationInstance.findOne({ evalue_id: assistant._id });

    await request(app)
      .put(`/api/associate/received-evaluations/${instance._id}/comment`)
      .set('Authorization', `Bearer ${tokenPour(associe)}`)
      .send({ sections: sectionRevueValide(), comment: 'Excellent potentiel, à suivre de près.' });

    // Act
    const reponse = await request(app)
      .post(`/api/associate/received-evaluations/${instance._id}/submit-rh`)
      .set('Authorization', `Bearer ${tokenPour(associe)}`);

    // Assert — réponse HTTP
    expect(reponse.status).toBe(200);

    // Assert — en base
    const enBase = await EvaluationInstance.findById(instance._id);
    expect(enBase.status).toBe('Soumis a RH');
    expect(enBase.submitted_to_user_ids.map(String)).toContain(String(rh._id));
  });
});
