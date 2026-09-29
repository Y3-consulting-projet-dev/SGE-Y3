// tests/senior-revue-assistants.test.js
//
// Couvre la seconde moitié, et la plus riche, du parcours Senior : l'évaluation
// des Assistants qu'il supervise. C'est un mécanisme différent de l'auto-évaluation
// (tests/senior-auto-evaluation.test.js) : il repose sur son propre modèle,
// SeniorAssistantReview, et non sur EvaluationInstance.
//
// Point-clé à comprendre avant de lire ces tests (vérifié dans
// seniorAssistantController.js) : la liste des missions qu'un senior peut noter
// n'est PAS saisie librement par le senior. Elle est calculée automatiquement
// (fonction syncMissionReviews, appelée à chaque accès à la revue) à partir des
// missions que l'ASSISTANT a lui-même soumises dans sa propre auto-évaluation, et
// dont le senior est destinataire. Un senior ne peut donc noter que des missions
// réellement soumises par un assistant réel de son périmètre.
//
// D'où le scénario "Arrange" commun à la plupart de ces tests :
//   1. un Assistant et un Senior du même département sont créés ;
//   2. l'Assistant ajoute une mission via SA route (/api/collaborator/evaluation/me)
//      en désignant le Senior comme destinataire ;
//   3. l'Assistant soumet cette mission (POST .../missions/submit) ;
//   4. seulement à partir de là, cette mission existe côté Senior, prête à être notée.

const request = require('supertest');
const app = require('../src/app');
const EvaluationInstance = require('../src/models/EvaluationInstance');
const SeniorAssistantReview = require('../src/models/SeniorAssistantReview');
const { creerCollaborateur, tokenPour } = require('./fixtures');

const DEPARTEMENT = 'AUDIT';

function creerSenior(champs = {}) {
  return creerCollaborateur({ grade: 'Senior', code_categorie: '9A', department: DEPARTEMENT, ...champs });
}

function creerAssistant(champs = {}) {
  return creerCollaborateur({ grade: 'Assistant', code_categorie: '8C', department: DEPARTEMENT, ...champs });
}

// Étapes 1 à 4 décrites plus haut : renvoie { assistant, senior } avec, côté
// assistant, une mission "mission-1" déjà soumise et visible par ce senior.
async function creerAssistantAvecMissionSoumiseAuSenior() {
  const assistant = await creerAssistant();
  const senior = await creerSenior();

  await request(app)
    .put('/api/collaborator/evaluation/me')
    .set('Authorization', `Bearer ${tokenPour(assistant)}`)
    .send({
      missionEvaluations: [
        {
          id: 'mission-1',
          title: 'Audit du client Ycube',
          period: '2026',
          criteria: [
            {
              id: 'crit-1',
              label: 'Rigueur',
              sectionTitle: 'Compétences techniques',
              sectionComment: 'Bon respect des délais et des procédures.',
              score: 4,
            },
          ],
          // Le senior doit être un destinataire réel de la mission pour que
          // isAssistantMissionVisibleToSupervisor() la lui rende visible ensuite.
          recipients: [{ id: senior._id.toString(), name: senior.name, department: senior.department }],
        },
      ],
    });

  await request(app)
    .post('/api/collaborator/evaluation/me/missions/submit')
    .set('Authorization', `Bearer ${tokenPour(assistant)}`)
    .send({ missionId: 'mission-1' });

  return { assistant, senior };
}

describe('GET /api/senior/assistants', () => {
  it('liste les assistants du même département que le senior', async () => {
    // Arrange
    const senior = await creerSenior();
    const assistant = await creerAssistant();

    // Act
    const reponse = await request(app)
      .get('/api/senior/assistants')
      .set('Authorization', `Bearer ${tokenPour(senior)}`);

    // Assert
    expect(reponse.status).toBe(200);
    const ids = reponse.body.assistants.map((item) => item.id);
    expect(ids).toContain(String(assistant._id));
  });

  it('ne renvoie aucun assistant d\'un autre département', async () => {
    const senior = await creerSenior({ department: 'AUDIT' });
    await creerAssistant({ department: 'CONSEIL' }); // département différent

    const reponse = await request(app)
      .get('/api/senior/assistants')
      .set('Authorization', `Bearer ${tokenPour(senior)}`);

    expect(reponse.status).toBe(200);
    expect(reponse.body.assistants).toEqual([]);
  });
});

describe('GET /api/senior/assistants/:assistantId/evaluation', () => {
  it("crée la revue et y fait apparaître la mission soumise par l'assistant, prête à être notée", async () => {
    // Arrange — la mission "mission-1" a déjà été soumise par l'assistant au senior
    const { assistant, senior } = await creerAssistantAvecMissionSoumiseAuSenior();

    // Act
    const reponse = await request(app)
      .get(`/api/senior/assistants/${assistant._id}/evaluation`)
      .set('Authorization', `Bearer ${tokenPour(senior)}`);

    // Assert — réponse HTTP
    expect(reponse.status).toBe(200);

    // Assert — en base : syncMissionReviews doit avoir créé un SeniorAssistantReview
    // reprenant la mission de l'assistant, avec les mêmes critères mais des notes
    // à null (le senior n'a encore rien noté) : c'est la garantie que le senior
    // note indépendamment de l'assistant, sur les mêmes critères.
    const revue = await SeniorAssistantReview.findOne({ senior_id: senior._id, assistant_id: assistant._id });
    expect(revue).not.toBeNull();
    expect(revue.mission_reviews).toHaveLength(1);
    expect(revue.mission_reviews[0].mission_id).toBe('mission-1');
    expect(revue.mission_reviews[0].criteria[0].criterion_id).toBe('crit-1');
    expect(revue.mission_reviews[0].criteria[0].score).toBeNull();
  });
});

describe('POST /api/senior/assistants/:assistantId/evaluation/missions — mission assignée par le senior', () => {
  it('refuse une mission sans titre', async () => {
    const { assistant, senior } = await creerAssistantAvecMissionSoumiseAuSenior();

    const reponse = await request(app)
      .post(`/api/senior/assistants/${assistant._id}/evaluation/missions`)
      .set('Authorization', `Bearer ${tokenPour(senior)}`)
      .send({});

    expect(reponse.status).toBe(400);
  });

  it('ajoute une mission à la fois dans l\'auto-évaluation de l\'assistant et dans la revue du senior', async () => {
    // Arrange
    const assistant = await creerAssistant();
    const senior = await creerSenior();

    // Act — le senior assigne lui-même une nouvelle mission à l'assistant
    const reponse = await request(app)
      .post(`/api/senior/assistants/${assistant._id}/evaluation/missions`)
      .set('Authorization', `Bearer ${tokenPour(senior)}`)
      .send({ title: 'Mission imposée par le senior', period: '2026' });

    // Assert — réponse HTTP
    expect(reponse.status).toBe(200);

    // Assert — en base, côté assistant : la mission apparaît dans SON évaluation,
    // avec created_by_role 'senior' (elle n'a pas été créée par l'assistant lui-même).
    const evaluationAssistant = await EvaluationInstance.findOne({ evalue_id: assistant._id });
    expect(evaluationAssistant.mission_evaluations).toHaveLength(1);
    expect(evaluationAssistant.mission_evaluations[0].created_by_role).toBe('senior');
    expect(evaluationAssistant.mission_evaluations[0].title).toBe('Mission imposée par le senior');

    // Assert — en base, côté senior : la même mission apparaît aussi dans sa revue,
    // avec origin 'senior-assigned', prête à être suivie même avant que l'assistant
    // ne l'ait soumise de son côté.
    const revue = await SeniorAssistantReview.findOne({ senior_id: senior._id, assistant_id: assistant._id });
    expect(revue.mission_reviews).toHaveLength(1);
    expect(revue.mission_reviews[0].origin).toBe('senior-assigned');
  });
});

describe('PUT /api/senior/assistants/:assistantId/evaluation — notation par le senior', () => {
  it('refuse une requête sans sections ni missionReviews', async () => {
    const { assistant, senior } = await creerAssistantAvecMissionSoumiseAuSenior();

    const reponse = await request(app)
      .put(`/api/senior/assistants/${assistant._id}/evaluation`)
      .set('Authorization', `Bearer ${tokenPour(senior)}`)
      .send({});

    expect(reponse.status).toBe(400);
  });

  it('refuse une note hors de l\'intervalle 1-5', async () => {
    const { assistant, senior } = await creerAssistantAvecMissionSoumiseAuSenior();

    const reponse = await request(app)
      .put(`/api/senior/assistants/${assistant._id}/evaluation`)
      .set('Authorization', `Bearer ${tokenPour(senior)}`)
      .send({
        missionReviews: [
          {
            id: 'mission-1',
            criteria: [{ id: 'crit-1', label: 'Rigueur', score: 9 }], // hors de [1, 5]
          },
        ],
      });

    expect(reponse.status).toBe(400);
  });

  it('enregistre la note du senior sur le critère de la mission soumise par l\'assistant', async () => {
    // Arrange — on réutilise l'id de mission ("mission-1") et l'id de critère
    // ("crit-1") choisis par l'assistant : syncMissionReviews les a recopiés tels
    // quels dans la revue du senior (vérifié dans le test GET .../evaluation ci-dessus).
    const { assistant, senior } = await creerAssistantAvecMissionSoumiseAuSenior();

    // Act
    const reponse = await request(app)
      .put(`/api/senior/assistants/${assistant._id}/evaluation`)
      .set('Authorization', `Bearer ${tokenPour(senior)}`)
      .send({
        missionReviews: [
          {
            id: 'mission-1',
            title: 'Audit du client Ycube',
            criteria: [
              {
                id: 'crit-1',
                label: 'Rigueur',
                sectionTitle: 'Compétences techniques',
                sectionComment: 'Le senior confirme la rigueur observée.',
                score: 4,
              },
            ],
          },
        ],
      });

    // Assert — réponse HTTP
    expect(reponse.status).toBe(200);

    // Assert — en base : la note du senior est bien celle qu'il a lui-même
    // saisie, indépendante de celle de l'assistant.
    const revue = await SeniorAssistantReview.findOne({ senior_id: senior._id, assistant_id: assistant._id });
    expect(revue.mission_reviews[0].criteria[0].score).toBe(4);
    expect(revue.status).toBe('En cours');
  });
});

describe('POST /api/senior/assistants/:assistantId/evaluation/missions/submit — transmission d\'une mission notée', () => {
  // Prépare une revue où la mission "mission-1" est déjà notée par le senior,
  // prête à être transmise. `overrides` permet de casser un point précis.
  async function creerRevueNotee(overrides = {}) {
    const { assistant, senior } = await creerAssistantAvecMissionSoumiseAuSenior();
    await request(app)
      .put(`/api/senior/assistants/${assistant._id}/evaluation`)
      .set('Authorization', `Bearer ${tokenPour(senior)}`)
      .send({
        missionReviews: [
          {
            id: 'mission-1',
            title: 'Audit du client Ycube', // requis par le schéma SeniorAssistantReview
            criteria: [
              {
                id: 'crit-1',
                label: 'Rigueur',
                sectionTitle: 'Compétences techniques',
                sectionComment: 'Le senior confirme la rigueur observée.',
                score: 4,
                ...overrides,
              },
            ],
          },
        ],
      });
    return { assistant, senior };
  }

  it('refuse la transmission si un critère n\'a pas encore de note', async () => {
    const { assistant, senior } = await creerRevueNotee({ score: null });

    const reponse = await request(app)
      .post(`/api/senior/assistants/${assistant._id}/evaluation/missions/submit`)
      .set('Authorization', `Bearer ${tokenPour(senior)}`)
      .send({ missionId: 'mission-1' });

    expect(reponse.status).toBe(400);
  });

  it('refuse la transmission si le commentaire de section fait moins de 3 caractères', async () => {
    const { assistant, senior } = await creerRevueNotee({ sectionComment: 'ok' });

    const reponse = await request(app)
      .post(`/api/senior/assistants/${assistant._id}/evaluation/missions/submit`)
      .set('Authorization', `Bearer ${tokenPour(senior)}`)
      .send({ missionId: 'mission-1' });

    expect(reponse.status).toBe(400);
  });

  it('transmet la mission notée et passe son statut à "Transmise"', async () => {
    // Arrange
    const { assistant, senior } = await creerRevueNotee();

    // Act
    const reponse = await request(app)
      .post(`/api/senior/assistants/${assistant._id}/evaluation/missions/submit`)
      .set('Authorization', `Bearer ${tokenPour(senior)}`)
      .send({ missionId: 'mission-1' });

    // Assert
    expect(reponse.status).toBe(200);

    const revue = await SeniorAssistantReview.findOne({ senior_id: senior._id, assistant_id: assistant._id });
    expect(revue.mission_reviews[0].status).toBe('Transmise');
    expect(revue.mission_reviews[0].submitted_at).not.toBeNull();
  });
});

describe('POST /api/senior/assistants/:assistantId/evaluation/submit — soumission finale de la revue', () => {
  it('refuse la soumission finale tant qu\'aucune mission n\'a été soumise par l\'assistant', async () => {
    // Arrange — un assistant du périmètre du senior, mais qui n'a encore rien soumis
    const senior = await creerSenior();
    const assistant = await creerAssistant();

    const reponse = await request(app)
      .post(`/api/senior/assistants/${assistant._id}/evaluation/submit`)
      .set('Authorization', `Bearer ${tokenPour(senior)}`);

    expect(reponse.status).toBe(400);
  });

  it('refuse la soumission finale tant qu\'une mission notée n\'a pas été transmise individuellement', async () => {
    // Arrange — mission soumise par l'assistant, notée par le senior, mais jamais
    // transmise via POST .../missions/submit
    const { assistant, senior } = await creerAssistantAvecMissionSoumiseAuSenior();
    await request(app)
      .put(`/api/senior/assistants/${assistant._id}/evaluation`)
      .set('Authorization', `Bearer ${tokenPour(senior)}`)
      .send({
        missionReviews: [
          { id: 'mission-1', title: 'Audit du client Ycube', criteria: [{ id: 'crit-1', label: 'Rigueur', sectionTitle: 'Compétences techniques', sectionComment: 'Bon travail.', score: 4 }] },
        ],
      });

    const reponse = await request(app)
      .post(`/api/senior/assistants/${assistant._id}/evaluation/submit`)
      .set('Authorization', `Bearer ${tokenPour(senior)}`);

    expect(reponse.status).toBe(400);
    expect(reponse.body.pendingMissionIds).toContain('mission-1');
  });

  it('accepte la soumission finale une fois la mission notée et transmise', async () => {
    // Arrange — cycle complet : mission soumise par l'assistant, notée puis
    // transmise individuellement par le senior
    const { assistant, senior } = await creerAssistantAvecMissionSoumiseAuSenior();
    await request(app)
      .put(`/api/senior/assistants/${assistant._id}/evaluation`)
      .set('Authorization', `Bearer ${tokenPour(senior)}`)
      .send({
        missionReviews: [
          { id: 'mission-1', title: 'Audit du client Ycube', criteria: [{ id: 'crit-1', label: 'Rigueur', sectionTitle: 'Compétences techniques', sectionComment: 'Bon travail.', score: 4 }] },
        ],
      });
    await request(app)
      .post(`/api/senior/assistants/${assistant._id}/evaluation/missions/submit`)
      .set('Authorization', `Bearer ${tokenPour(senior)}`)
      .send({ missionId: 'mission-1' });

    // Act
    const reponse = await request(app)
      .post(`/api/senior/assistants/${assistant._id}/evaluation/submit`)
      .set('Authorization', `Bearer ${tokenPour(senior)}`);

    // Assert — réponse HTTP
    expect(reponse.status).toBe(200);

    // Assert — en base : la revue quitte le périmètre du senior pour entrer dans
    // le circuit de validation Manager.
    const revue = await SeniorAssistantReview.findOne({ senior_id: senior._id, assistant_id: assistant._id });
    expect(revue.status).toBe('Transmis au Manager');
    expect(revue.submitted_at).not.toBeNull();
  });
});
