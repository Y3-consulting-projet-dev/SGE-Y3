// tests/manager-auto-evaluation.test.js
//
// Couvre la propre auto-évaluation du Manager (template_type 'manager-self-evaluation').
// Différence notable avec l'Assistant et le Senior (voir saveMyManagerEvaluation dans
// managerController.js) : elle accepte À LA FOIS des "sections" (un formulaire classique
// noté par thème, comme pour un membre d'équipe) ET des "missionEvaluations" (comme pour
// un Assistant). Ces tests utilisent la voie "missionEvaluations", parce qu'elle permet de
// fournir des critères entièrement maîtrisés par le test (id, libellé, note) — contrairement
// à POST /self-evaluation/missions (addMyManagerMissionEvaluation), qui génère ses critères
// depuis la matrice de compétences réelle du cabinet et ne se prête donc pas à un test
// unitaire simple et déterministe.
//
// Particularité du Manager : toute mission qu'il rattache à sa propre auto-évaluation doit
// désigner au moins un Associé comme destinataire (resolveAssociateRecipients / erreur
// "Selectionnez au moins un associe..."), aussi bien à la création qu'à la soumission.

const request = require('supertest');
const app = require('../src/app');
const EvaluationInstance = require('../src/models/EvaluationInstance');
const { creerCollaborateur, tokenPour } = require('./fixtures');

function creerManager(champs = {}) {
  return creerCollaborateur({ grade: 'Manager', code_categorie: '10B', ...champs });
}

function creerAssocie(champs = {}) {
  return creerCollaborateur({ grade: 'Associé', code_categorie: '11', ...champs });
}

describe('POST /api/manager/self-evaluation/missions — mission générée depuis le modèle', () => {
  it('refuse une mission sans titre', async () => {
    const manager = await creerManager();

    const reponse = await request(app)
      .post('/api/manager/self-evaluation/missions')
      .set('Authorization', `Bearer ${tokenPour(manager)}`)
      .send({});

    expect(reponse.status).toBe(400);
  });

  it('refuse une mission sans associé destinataire', async () => {
    const manager = await creerManager();

    const reponse = await request(app)
      .post('/api/manager/self-evaluation/missions')
      .set('Authorization', `Bearer ${tokenPour(manager)}`)
      .send({ title: 'Mission de conseil stratégique' }); // pas de selectedAssociateRecipients

    expect(reponse.status).toBe(400);
  });

  it('crée la mission avec des critères tirés de la matrice de compétences', async () => {
    const manager = await creerManager();
    const associe = await creerAssocie();

    const reponse = await request(app)
      .post('/api/manager/self-evaluation/missions')
      .set('Authorization', `Bearer ${tokenPour(manager)}`)
      .send({ title: 'Mission de conseil stratégique', selectedAssociateRecipients: [{ id: associe._id.toString() }] });

    expect(reponse.status).toBe(200);

    const enBase = await EvaluationInstance.findOne({ evalue_id: manager._id });
    expect(enBase.template_type).toBe('manager-self-evaluation');
    expect(enBase.mission_evaluations).toHaveLength(1);
    expect(enBase.mission_evaluations[0].status).toBe('Brouillon');
    // Les critères sont générés par le serveur, pas fournis par le client : leur note
    // démarre donc toujours à null, jamais préremplie.
    expect(enBase.mission_evaluations[0].criteria.length).toBeGreaterThan(0);
    expect(enBase.mission_evaluations[0].criteria[0].score).toBeNull();
  });
});

describe('PUT /api/manager/self-evaluation — mission entièrement maîtrisée par le test', () => {
  function missionValide(overrides = {}) {
    return {
      id: 'manager-mission-1',
      title: 'Mission de conseil stratégique',
      criteria: [
        {
          id: 'crit-1',
          label: 'Vision stratégique',
          sectionTitle: 'Leadership',
          sectionComment: 'Bonne prise de recul sur le dossier.',
          score: 4,
          ...overrides,
        },
      ],
    };
  }

  it('refuse une note hors de l\'intervalle 1-5', async () => {
    const manager = await creerManager();

    const reponse = await request(app)
      .put('/api/manager/self-evaluation')
      .set('Authorization', `Bearer ${tokenPour(manager)}`)
      .send({ missionEvaluations: [missionValide({ score: 6 })] });

    expect(reponse.status).toBe(400);
  });

  it('enregistre la mission en brouillon', async () => {
    const manager = await creerManager();

    const reponse = await request(app)
      .put('/api/manager/self-evaluation')
      .set('Authorization', `Bearer ${tokenPour(manager)}`)
      .send({ missionEvaluations: [missionValide()] });

    expect(reponse.status).toBe(200);

    const enBase = await EvaluationInstance.findOne({ evalue_id: manager._id });
    expect(enBase.mission_evaluations[0].status).toBe('Brouillon');
  });
});

describe('POST /api/manager/self-evaluation/missions/submit puis /submit — soumission finale', () => {
  it('refuse la soumission d\'une mission incomplète', async () => {
    const manager = await creerManager();
    await request(app)
      .put('/api/manager/self-evaluation')
      .set('Authorization', `Bearer ${tokenPour(manager)}`)
      .send({
        missionEvaluations: [
          { id: 'manager-mission-1', title: 'Mission', criteria: [{ id: 'crit-1', label: 'Vision', score: null }] },
        ],
      });

    const reponse = await request(app)
      .post('/api/manager/self-evaluation/missions/submit')
      .set('Authorization', `Bearer ${tokenPour(manager)}`)
      .send({ missionId: 'manager-mission-1' });

    expect(reponse.status).toBe(400);
  });

  it('refuse la soumission de la mission sans associé destinataire sélectionné', async () => {
    const manager = await creerManager();
    await request(app)
      .put('/api/manager/self-evaluation')
      .set('Authorization', `Bearer ${tokenPour(manager)}`)
      .send({
        missionEvaluations: [
          { id: 'manager-mission-1', title: 'Mission', criteria: [{ id: 'crit-1', label: 'Vision', score: 4 }] },
        ],
      });

    const reponse = await request(app)
      .post('/api/manager/self-evaluation/missions/submit')
      .set('Authorization', `Bearer ${tokenPour(manager)}`)
      .send({ missionId: 'manager-mission-1' }); // pas de selectedAssociateRecipients

    expect(reponse.status).toBe(400);
  });

  it('soumet la mission à un associé puis termine la soumission finale', async () => {
    // Arrange — mission complète, avec un associé réel désigné à la soumission
    const manager = await creerManager();
    const associe = await creerAssocie();
    await request(app)
      .put('/api/manager/self-evaluation')
      .set('Authorization', `Bearer ${tokenPour(manager)}`)
      .send({
        missionEvaluations: [
          { id: 'manager-mission-1', title: 'Mission', criteria: [{ id: 'crit-1', label: 'Vision', score: 4 }] },
        ],
      });

    const reponseMission = await request(app)
      .post('/api/manager/self-evaluation/missions/submit')
      .set('Authorization', `Bearer ${tokenPour(manager)}`)
      .send({ missionId: 'manager-mission-1', selectedAssociateRecipients: [{ id: associe._id.toString() }] });

    expect(reponseMission.status).toBe(200);

    // Act — soumission finale de l'auto-évaluation manager
    const reponseFinale = await request(app)
      .post('/api/manager/self-evaluation/submit')
      .set('Authorization', `Bearer ${tokenPour(manager)}`);

    // Assert
    expect(reponseFinale.status).toBe(200);

    const enBase = await EvaluationInstance.findOne({ evalue_id: manager._id });
    expect(enBase.mission_evaluations[0].status).toBe('Soumise');
    // Contrairement à l'Assistant (statut "Soumis aux Managers"), l'auto-évaluation du
    // Manager va directement à la RH — il n'y a personne au-dessus de lui dans ce circuit
    // avant l'associé, qui valide au niveau de la mission et non du statut global.
    // (Anciennement, cette assertion révélait un bug réel : le contrôleur écrivait
    // 'Soumis à la RH', une valeur absente de l'enum d'EvaluationInstance.status, qui
    // n'accepte que 'Soumis a RH' sans accent — corrigé depuis dans managerController.js.)
    expect(enBase.status).toBe('Soumis a RH');
  });
});
