// tests/manager-revue-membres.test.js
//
// Couvre la revue par un Manager des membres de son équipe (Assistants ET Seniors :
// getMemberForManager accepte code_categorie '8C', '9A' et '9B' — un manager encadre
// les deux grades, contrairement au Senior qui ne supervise que des Assistants).
//
// Comme pour le Senior (voir tests/senior-revue-assistants.test.js), le modèle est
// ManagerMemberReview et non EvaluationInstance, et la liste des missions que le manager
// peut noter est recalculée automatiquement (syncManagerMissionReviews) à partir des
// missions que le MEMBRE a lui-même soumises, avec ce manager comme destinataire.
//
// Différence importante avec le Senior : la revue d'un manager a DEUX circuits parallèles
// et indépendants, chacun avec sa propre route de sauvegarde/soumission :
//   - un circuit "par mission" (PUT .../evaluation/missions, POST .../missions/:id/submit),
//     dont les critères viennent de la mission soumise par le membre — entièrement
//     maîtrisables par le test, comme pour le Senior ;
//   - un circuit "sections" classique (PUT .../evaluation, POST .../evaluation/submit),
//     dont le template est généré depuis la matrice de compétences réelle. Pour le tester
//     jusqu'au succès sans connaître le contenu de cette matrice, ces tests relisent
//     d'abord l'état réel via GET, puis renvoient exactement les mêmes sections avec des
//     notes complétées — la même technique "lire, puis écrire" qu'utiliserait le frontend.

const request = require('supertest');
const app = require('../src/app');
const EvaluationInstance = require('../src/models/EvaluationInstance');
const ManagerMemberReview = require('../src/models/ManagerMemberReview');
const { creerCollaborateur, tokenPour } = require('./fixtures');

const DEPARTEMENT = 'AUDIT';

function creerManager(champs = {}) {
  return creerCollaborateur({ grade: 'Manager', code_categorie: '10B', department: DEPARTEMENT, ...champs });
}

function creerAssistant(champs = {}) {
  return creerCollaborateur({ grade: 'Assistant', code_categorie: '8C', department: DEPARTEMENT, ...champs });
}

// Un assistant qui a déjà soumis "mission-1" en désignant ce manager comme destinataire :
// c'est la condition nécessaire pour que syncManagerMissionReviews la rende visible côté manager.
async function creerAssistantAvecMissionSoumiseAuManager() {
  const assistant = await creerAssistant();
  const manager = await creerManager();

  await request(app)
    .put('/api/collaborator/evaluation/me')
    .set('Authorization', `Bearer ${tokenPour(assistant)}`)
    .send({
      missionEvaluations: [
        {
          id: 'mission-1',
          title: 'Audit du client Ycube',
          criteria: [
            {
              id: 'crit-1',
              label: 'Rigueur',
              sectionTitle: 'Compétences techniques',
              sectionComment: 'Bon respect des délais et des procédures.',
              score: 4,
            },
          ],
          recipients: [{ id: manager._id.toString(), name: manager.name, department: manager.department }],
        },
      ],
    });

  await request(app)
    .post('/api/collaborator/evaluation/me/missions/submit')
    .set('Authorization', `Bearer ${tokenPour(assistant)}`)
    .send({ missionId: 'mission-1' });

  return { assistant, manager };
}

describe('GET /api/manager/members/:memberId/evaluation', () => {
  it("crée la revue et y synchronise la mission soumise par l'assistant", async () => {
    const { assistant, manager } = await creerAssistantAvecMissionSoumiseAuManager();

    const reponse = await request(app)
      .get(`/api/manager/members/${assistant._id}/evaluation`)
      .set('Authorization', `Bearer ${tokenPour(manager)}`);

    expect(reponse.status).toBe(200);

    const revue = await ManagerMemberReview.findOne({ manager_id: manager._id, member_id: assistant._id });
    expect(revue).not.toBeNull();
    expect(revue.mission_reviews).toHaveLength(1);
    expect(revue.mission_reviews[0].mission_id).toBe('mission-1');
    expect(revue.mission_reviews[0].criteria[0].score).toBeNull(); // le manager n'a encore rien noté
  });
});

describe('PUT /api/manager/members/:memberId/evaluation/missions — notation par mission', () => {
  it('refuse une requête sans missionReviews', async () => {
    const { assistant, manager } = await creerAssistantAvecMissionSoumiseAuManager();

    const reponse = await request(app)
      .put(`/api/manager/members/${assistant._id}/evaluation/missions`)
      .set('Authorization', `Bearer ${tokenPour(manager)}`)
      .send({});

    expect(reponse.status).toBe(400);
  });

  it('refuse une note hors de l\'intervalle 1-5', async () => {
    const { assistant, manager } = await creerAssistantAvecMissionSoumiseAuManager();

    const reponse = await request(app)
      .put(`/api/manager/members/${assistant._id}/evaluation/missions`)
      .set('Authorization', `Bearer ${tokenPour(manager)}`)
      .send({ missionReviews: [{ id: 'mission-1', criteria: [{ id: 'crit-1', label: 'Rigueur', score: 7 }] }] });

    expect(reponse.status).toBe(400);
  });

  it('enregistre la note du manager sur le critère de la mission soumise', async () => {
    const { assistant, manager } = await creerAssistantAvecMissionSoumiseAuManager();

    const reponse = await request(app)
      .put(`/api/manager/members/${assistant._id}/evaluation/missions`)
      .set('Authorization', `Bearer ${tokenPour(manager)}`)
      .send({
        missionReviews: [
          {
            id: 'mission-1',
            title: 'Audit du client Ycube',
            criteria: [{ id: 'crit-1', label: 'Rigueur', sectionTitle: 'Compétences techniques', sectionComment: 'Confirmé par le manager.', score: 5 }],
          },
        ],
      });

    expect(reponse.status).toBe(200);

    const revue = await ManagerMemberReview.findOne({ manager_id: manager._id, member_id: assistant._id });
    expect(revue.mission_reviews[0].criteria[0].score).toBe(5);
  });
});

describe('POST /api/manager/members/:memberId/evaluation/missions/:missionId/submit', () => {
  async function creerRevueNotee(overrides = {}) {
    const { assistant, manager } = await creerAssistantAvecMissionSoumiseAuManager();
    await request(app)
      .put(`/api/manager/members/${assistant._id}/evaluation/missions`)
      .set('Authorization', `Bearer ${tokenPour(manager)}`)
      .send({
        missionReviews: [
          {
            id: 'mission-1',
            title: 'Audit du client Ycube',
            criteria: [{ id: 'crit-1', label: 'Rigueur', sectionTitle: 'Compétences techniques', sectionComment: 'Confirmé par le manager.', score: 5, ...overrides }],
          },
        ],
      });
    return { assistant, manager };
  }

  it('refuse la soumission tant qu\'un critère n\'a pas de note', async () => {
    const { assistant, manager } = await creerRevueNotee({ score: null });

    const reponse = await request(app)
      .post(`/api/manager/members/${assistant._id}/evaluation/missions/mission-1/submit`)
      .set('Authorization', `Bearer ${tokenPour(manager)}`)
      .send({});

    expect(reponse.status).toBe(400);
  });

  it('transmet la mission notée à la RH', async () => {
    const { assistant, manager } = await creerRevueNotee();

    const reponse = await request(app)
      .post(`/api/manager/members/${assistant._id}/evaluation/missions/mission-1/submit`)
      .set('Authorization', `Bearer ${tokenPour(manager)}`)
      .send({});

    expect(reponse.status).toBe(200);

    const revue = await ManagerMemberReview.findOne({ manager_id: manager._id, member_id: assistant._id });
    expect(revue.mission_reviews[0].status).toBe('Soumise à la RH');
    // Contrairement au Senior (statut "Transmise", en attente du Manager), la mission
    // notée par le Manager part directement vers la RH : il n'y a pas d'échelon
    // intermédiaire au-dessus de lui pour ce circuit.
    expect(revue.status).toBe('Soumis à la RH');
  });
});

describe('PUT /api/manager/members/:memberId/evaluation — évaluation "sections" du membre', () => {
  it('refuse une requête sans sections', async () => {
    const { assistant, manager } = await creerAssistantAvecMissionSoumiseAuManager();

    const reponse = await request(app)
      .put(`/api/manager/members/${assistant._id}/evaluation`)
      .set('Authorization', `Bearer ${tokenPour(manager)}`)
      .send({});

    expect(reponse.status).toBe(400);
  });

  it('accepte une sauvegarde partielle (pas besoin de tout compléter pour enregistrer)', async () => {
    // Arrange — une section minimale, syntaxiquement valide, sans lien avec le vrai
    // référentiel de compétences : PUT (sauvegarde) n'exige pas l'exhaustivité,
    // contrairement à POST .../submit testé plus bas.
    const { assistant, manager } = await creerAssistantAvecMissionSoumiseAuManager();

    const reponse = await request(app)
      .put(`/api/manager/members/${assistant._id}/evaluation`)
      .set('Authorization', `Bearer ${tokenPour(manager)}`)
      .send({
        sections: [
          {
            id: 1,
            title: 'Compétences générales',
            subtitle: 'Évaluation générale',
            comment: '',
            criteria: [{ criterion_id: 'c1', label: 'Ponctualité', score: 4 }],
          },
        ],
      });

    expect(reponse.status).toBe(200);

    const revue = await ManagerMemberReview.findOne({ manager_id: manager._id, member_id: assistant._id });
    expect(revue.status).toBe('En cours');
  });
});

describe('POST /api/manager/members/:memberId/evaluation/submit — soumission de l\'évaluation "sections"', () => {
  it('refuse la soumission tant que les questions obligatoires du référentiel ne sont pas toutes répondues', async () => {
    // La revue est créée avec le vrai template de compétences (via getOrCreateManagerMemberReview),
    // dès le premier accès — donc une soumission immédiate, sans avoir rien rempli, doit
    // échouer : c'est la preuve que la validation regarde vraiment le contenu, pas juste
    // qu'une sauvegarde a eu lieu.
    const { assistant, manager } = await creerAssistantAvecMissionSoumiseAuManager();
    await request(app).get(`/api/manager/members/${assistant._id}/evaluation`).set('Authorization', `Bearer ${tokenPour(manager)}`);

    const reponse = await request(app)
      .post(`/api/manager/members/${assistant._id}/evaluation/submit`)
      .set('Authorization', `Bearer ${tokenPour(manager)}`);

    expect(reponse.status).toBe(400);
    expect(reponse.body.missingAnswers).toBeDefined();
  });

  it('accepte la soumission une fois toutes les sections du référentiel notées et commentées', async () => {
    // Arrange — on relit l'état réel du référentiel généré pour ce membre (GET), puis on
    // le renvoie tel quel en complétant chaque note à 5 (pour ne jamais déclencher la
    // règle "note < 3 => commentaire de page obligatoire") et chaque commentaire de
    // section. C'est la seule façon fiable de compléter un référentiel dont le contenu
    // exact nous est inconnu, sans en supposer la structure.
    const { assistant, manager } = await creerAssistantAvecMissionSoumiseAuManager();
    const etatInitial = await request(app)
      .get(`/api/manager/members/${assistant._id}/evaluation`)
      .set('Authorization', `Bearer ${tokenPour(manager)}`);

    const sectionsCompletees = etatInitial.body.review.sections.map((section) => ({
      ...section,
      comment: 'Section revue et validée par le manager.',
      pages: (section.pages || []).map((page) => ({
        ...page,
        themes: (page.themes || []).map((theme) => ({ ...theme, score: 5 })),
      })),
      // Certaines sections n'ont pas de pages/thèmes et portent directement des critères ;
      // on les complète aussi, au cas où le référentiel de ce grade prenne cette forme.
      criteria: (section.criteria || []).map((criterion) => ({ ...criterion, score: 5 })),
    }));

    // Act
    const reponse = await request(app)
      .put(`/api/manager/members/${assistant._id}/evaluation`)
      .set('Authorization', `Bearer ${tokenPour(manager)}`)
      .send({ sections: sectionsCompletees });
    expect(reponse.status).toBe(200);

    const reponseFinale = await request(app)
      .post(`/api/manager/members/${assistant._id}/evaluation/submit`)
      .set('Authorization', `Bearer ${tokenPour(manager)}`);

    // Assert
    expect(reponseFinale.status).toBe(200);

    const revue = await ManagerMemberReview.findOne({ manager_id: manager._id, member_id: assistant._id });
    expect(revue.status).toBe('Soumis à la RH');
    expect(revue.submitted_at).not.toBeNull();
  });
});

describe('PUT /api/manager/members/:memberId/training-decision — décision sur une demande de formation', () => {
  it('refuse une décision qui n\'est ni "Accepté" ni "Refusé"', async () => {
    const { assistant, manager } = await creerAssistantAvecMissionSoumiseAuManager();

    const reponse = await request(app)
      .put(`/api/manager/members/${assistant._id}/training-decision`)
      .set('Authorization', `Bearer ${tokenPour(manager)}`)
      .send({ decision: 'Peut-être' });

    expect(reponse.status).toBe(400);
  });

  it("refuse tant que l'assistant n'a pas transmis son plan de développement", async () => {
    const { assistant, manager } = await creerAssistantAvecMissionSoumiseAuManager();
    // L'assistant a une auto-évaluation (créée plus haut) mais n'a jamais soumis de plan.

    const reponse = await request(app)
      .put(`/api/manager/members/${assistant._id}/training-decision`)
      .set('Authorization', `Bearer ${tokenPour(manager)}`)
      .send({ decision: 'Accepté' });

    expect(reponse.status).toBe(400);
  });

  it("accepte la décision une fois le plan de développement soumis à ce manager", async () => {
    // Arrange — l'assistant soumet son plan de développement à CE manager précisément
    // (tests/assistant-plan-developpement.test.js couvre cette route en détail)
    const { assistant, manager } = await creerAssistantAvecMissionSoumiseAuManager();
    await request(app)
      .put('/api/collaborator/development/me')
      .set('Authorization', `Bearer ${tokenPour(assistant)}`)
      .send({ wishes: 'Se former à la fiscalité internationale', trainingRequests: ['Fiscalité internationale'] });
    await request(app)
      .post('/api/collaborator/development/me/submit')
      .set('Authorization', `Bearer ${tokenPour(assistant)}`)
      .send({ managerId: manager._id.toString() });

    // Act
    const reponse = await request(app)
      .put(`/api/manager/members/${assistant._id}/training-decision`)
      .set('Authorization', `Bearer ${tokenPour(manager)}`)
      .send({ decision: 'Accepté', comment: 'Formation pertinente pour la montée en compétence.' });

    // Assert — réponse HTTP
    expect(reponse.status).toBe(200);

    // Assert — en base, côté auto-évaluation de l'assistant : c'est lui qui verra
    // la décision, pas la revue du manager.
    const evaluationAssistant = await EvaluationInstance.findOne({ evalue_id: assistant._id });
    expect(evaluationAssistant.development_training_decision).toBe('Accepté');
    expect(evaluationAssistant.development_training_manager_comment).toBe('Formation pertinente pour la montée en compétence.');
  });
});
