// tests/senior-auto-evaluation.test.js
//
// Couvre la première moitié du parcours Senior : sa PROPRE auto-évaluation.
// C'est exactement le même mécanisme que pour l'Assistant (template_type
// 'senior-self-evaluation', toujours "par missions", mêmes fonctions de
// contrôleur dans collaboratorEvaluationController.js), seule la route change
// de préfixe (/api/senior au lieu de /api/collaborator) et le grade exigé par
// le garde d'accès (requireSenior au lieu de requireAssistant).
//
// Voir tests/assistant-auto-evaluation.test.js pour le détail des règles de
// validation (elles sont partagées par les deux parcours, donc pas réexpliquées
// ligne à ligne ici).

const request = require('supertest');
const app = require('../src/app');
const EvaluationInstance = require('../src/models/EvaluationInstance');
const { creerCollaborateur, tokenPour } = require('./fixtures');

function creerSenior(champs = {}) {
  return creerCollaborateur({ grade: 'Senior', code_categorie: '9A', ...champs });
}

function missionValide(overrides = {}) {
  return {
    id: 'mission-1',
    title: 'Mission de conseil client',
    period: '2026',
    criteria: [
      {
        id: 'crit-1',
        label: 'Autonomie',
        sectionTitle: 'Compétences techniques',
        sectionComment: 'Bonne autonomie sur ce dossier.',
        score: 4,
        ...overrides,
      },
    ],
  };
}

describe('GET /api/senior/evaluation/me', () => {
  it("crée automatiquement l'auto-évaluation du senior, distincte de celle d'un assistant", async () => {
    // Arrange
    const senior = await creerSenior();

    // Act
    const reponse = await request(app)
      .get('/api/senior/evaluation/me')
      .set('Authorization', `Bearer ${tokenPour(senior)}`);

    // Assert
    expect(reponse.status).toBe(200);

    const enBase = await EvaluationInstance.findOne({ evalue_id: senior._id });
    expect(enBase).not.toBeNull();
    // C'est ce champ qui distingue une auto-évaluation de senior de celle d'un
    // assistant — les deux partagent le même modèle Mongoose.
    expect(enBase.template_type).toBe('senior-self-evaluation');
  });
});

describe('PUT /api/senior/evaluation/me', () => {
  it('refuse une note hors de l\'intervalle 1-5, comme pour un assistant', async () => {
    const senior = await creerSenior();

    const reponse = await request(app)
      .put('/api/senior/evaluation/me')
      .set('Authorization', `Bearer ${tokenPour(senior)}`)
      .send({ missionEvaluations: [missionValide({ score: 0 })] });

    expect(reponse.status).toBe(400);
  });

  it('enregistre une mission valide en brouillon', async () => {
    const senior = await creerSenior();

    const reponse = await request(app)
      .put('/api/senior/evaluation/me')
      .set('Authorization', `Bearer ${tokenPour(senior)}`)
      .send({ missionEvaluations: [missionValide()] });

    expect(reponse.status).toBe(200);

    const enBase = await EvaluationInstance.findOne({ evalue_id: senior._id });
    expect(enBase.mission_evaluations[0].status).toBe('Brouillon');
  });
});

describe('POST /api/senior/evaluation/me/missions/submit puis /api/senior/evaluation/me/submit', () => {
  it('soumet une mission puis la soumission finale, avec le même circuit de statuts que pour un assistant', async () => {
    // Arrange
    const senior = await creerSenior();
    await request(app)
      .put('/api/senior/evaluation/me')
      .set('Authorization', `Bearer ${tokenPour(senior)}`)
      .send({ missionEvaluations: [missionValide()] });

    // Act — soumission de la mission individuelle
    const reponseMission = await request(app)
      .post('/api/senior/evaluation/me/missions/submit')
      .set('Authorization', `Bearer ${tokenPour(senior)}`)
      .send({ missionId: 'mission-1' });

    expect(reponseMission.status).toBe(200);

    // Act — soumission finale de l'auto-évaluation
    const reponseFinale = await request(app)
      .post('/api/senior/evaluation/me/submit')
      .set('Authorization', `Bearer ${tokenPour(senior)}`);

    // Assert
    expect(reponseFinale.status).toBe(200);

    const enBase = await EvaluationInstance.findOne({ evalue_id: senior._id });
    expect(enBase.mission_evaluations[0].status).toBe('Soumise');
    expect(enBase.status).toBe('Soumis aux Managers');
  });
});
