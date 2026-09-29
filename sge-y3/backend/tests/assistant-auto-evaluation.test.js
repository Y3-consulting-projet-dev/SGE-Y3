const request = require('supertest');
const app = require('../src/app');
const EvaluationInstance = require('../src/models/EvaluationInstance');
const { creerCollaborateur, tokenPour } = require('./fixtures');

function missionValide(overrides = {}) {
  return {
    id: 'mission-1',
    title: 'Audit Mission TEST',
    period: '2026',
    criteria: [
      {
        id: 'crit-1',
        label: 'Rigueur',
        sectionTitle: 'Compétences techniques',
        sectionComment: 'Bon respect des délais et des procédures.',
        score: 4,
        ...overrides,
      },
    ],
  };
}

describe('GET /api/collaborator/evaluation/me', () => {
  it("crée automatiquement l'évaluation au tout premier accès de l'assistant", async () => {
    const assistant = await creerCollaborateur();

    const reponse = await request(app)
      .get('/api/collaborator/evaluation/me')
      .set('Authorization', `Bearer ${tokenPour(assistant)}`);

    expect(reponse.status).toBe(200);

    const enBase = await EvaluationInstance.findOne({ evalue_id: assistant._id });
    expect(enBase).not.toBeNull();
    expect(enBase.template_type).toBe('assistant-self-evaluation');
    expect(enBase.status).toBe('En cours'); // valeur par défaut du schéma
  });

  it('ne crée jamais de doublon : le deuxième accès retrouve la même évaluation', async () => {
    
    const assistant = await creerCollaborateur();

    await request(app).get('/api/collaborator/evaluation/me').set('Authorization', `Bearer ${tokenPour(assistant)}`);
    await request(app).get('/api/collaborator/evaluation/me').set('Authorization', `Bearer ${tokenPour(assistant)}`);

    const nombreEvaluations = await EvaluationInstance.countDocuments({ evalue_id: assistant._id });
    expect(nombreEvaluations).toBe(1);
  });
});

describe('PUT /api/collaborator/evaluation/me ; sauvegarde d\'une mission', () => {
  it('ajoute une mission avec une note valide et la persiste en base', async () => {

    const assistant = await creerCollaborateur();

    const reponse = await request(app)
      .put('/api/collaborator/evaluation/me')
      .set('Authorization', `Bearer ${tokenPour(assistant)}`)
      .send({ missionEvaluations: [missionValide()] });

    expect(reponse.status).toBe(200);

    const enBase = await EvaluationInstance.findOne({ evalue_id: assistant._id });
    expect(enBase.mission_evaluations).toHaveLength(1);
    expect(enBase.mission_evaluations[0].status).toBe('Brouillon');
    expect(enBase.mission_evaluations[0].criteria[0].score).toBe(4);
  });

  it('refuse une note en dehors de l\'intervalle 1-5', async () => {
    const assistant = await creerCollaborateur();
    const mission = missionValide({ score: 8 });

    const reponse = await request(app)
      .put('/api/collaborator/evaluation/me')
      .set('Authorization', `Bearer ${tokenPour(assistant)}`)
      .send({ missionEvaluations: [mission] });

    expect(reponse.status).toBe(400);
  });

  it('rattache un destinataire uniquement s\'il correspond à un utilisateur réel du même département', async () => {

    const assistant = await creerCollaborateur({ department: 'AUDIT' });
    const manager = await creerCollaborateur({ grade: 'Manager', code_categorie: '10B', department: 'AUDIT' });
    const mission = missionValide();
    mission.recipients = [{ id: manager._id.toString(), name: manager.name, department: manager.department }];

    await request(app)
      .put('/api/collaborator/evaluation/me')
      .set('Authorization', `Bearer ${tokenPour(assistant)}`)
      .send({ missionEvaluations: [mission] });

    const enBase = await EvaluationInstance.findOne({ evalue_id: assistant._id });
    const idsDestinataires = enBase.mission_evaluations[0].recipients.map((recipient) => String(recipient.user_id));
    expect(idsDestinataires).toContain(String(manager._id));
  });
});

describe('POST /api/collaborator/evaluation/me/missions/submit — soumission d\'une mission', () => {
  // Prépare un assistant avec une mission déjà enregistrée (via PUT), prête à être
  // soumise. `overrides` permet à chaque test de casser un point précis de la mission.
  async function creerAssistantAvecMission(overrides = {}) {
    const assistant = await creerCollaborateur();
    await request(app)
      .put('/api/collaborator/evaluation/me')
      .set('Authorization', `Bearer ${tokenPour(assistant)}`)
      .send({ missionEvaluations: [missionValide(overrides)] });
    return assistant;
  }

  it('refuse une soumission sans identifiant de mission', async () => {
    const assistant = await creerCollaborateur();

    const reponse = await request(app)
      .post('/api/collaborator/evaluation/me/missions/submit')
      .set('Authorization', `Bearer ${tokenPour(assistant)}`)
      .send({});

    expect(reponse.status).toBe(400);
  });

  it('renvoie 404 pour un identifiant de mission qui n\'existe pas', async () => {
    const assistant = await creerAssistantAvecMission();

    const reponse = await request(app)
      .post('/api/collaborator/evaluation/me/missions/submit')
      .set('Authorization', `Bearer ${tokenPour(assistant)}`)
      .send({ missionId: 'mission-qui-n-existe-pas' });

    expect(reponse.status).toBe(404);
  });

  it('refuse la soumission si un critère de la mission n\'a pas encore de note', async () => {
    // score: null => critère "incomplet" au sens du contrôleur (hasIncompleteCriterion)
    const assistant = await creerAssistantAvecMission({ score: null });

    const reponse = await request(app)
      .post('/api/collaborator/evaluation/me/missions/submit')
      .set('Authorization', `Bearer ${tokenPour(assistant)}`)
      .send({ missionId: 'mission-1' });

    expect(reponse.status).toBe(400);
  });

  it('refuse la soumission si le commentaire de section fait moins de 3 caractères', async () => {
    const assistant = await creerAssistantAvecMission({ sectionComment: 'ok' }); // 2 caractères, < 3

    const reponse = await request(app)
      .post('/api/collaborator/evaluation/me/missions/submit')
      .set('Authorization', `Bearer ${tokenPour(assistant)}`)
      .send({ missionId: 'mission-1' });

    expect(reponse.status).toBe(400);
  });

  it('accepte la soumission d\'une mission complète et passe son statut à "Soumise"', async () => {
    // Arrange
    const assistant = await creerAssistantAvecMission();

    // Act
    const reponse = await request(app)
      .post('/api/collaborator/evaluation/me/missions/submit')
      .set('Authorization', `Bearer ${tokenPour(assistant)}`)
      .send({ missionId: 'mission-1' });

    // Assert — réponse HTTP
    expect(reponse.status).toBe(200);

    // Assert — en base : c'est la garantie que la mission ne pourra plus être
    // modifiée comme un brouillon, et qu'elle est bien datée.
    const enBase = await EvaluationInstance.findOne({ evalue_id: assistant._id });
    expect(enBase.mission_evaluations[0].status).toBe('Soumise');
    expect(enBase.mission_evaluations[0].submitted_at).not.toBeNull();
  });
});

describe('POST /api/collaborator/evaluation/me/submit — soumission finale', () => {
  it('refuse la soumission finale si aucune mission n\'a été ajoutée', async () => {
    const assistant = await creerCollaborateur();

    const reponse = await request(app)
      .post('/api/collaborator/evaluation/me/submit')
      .set('Authorization', `Bearer ${tokenPour(assistant)}`);

    expect(reponse.status).toBe(400);
  });

  it('refuse la soumission finale tant qu\'une mission reste en brouillon', async () => {
    // Arrange — une mission enregistrée (PUT) mais jamais soumise individuellement
    const assistant = await creerCollaborateur();
    await request(app)
      .put('/api/collaborator/evaluation/me')
      .set('Authorization', `Bearer ${tokenPour(assistant)}`)
      .send({ missionEvaluations: [missionValide()] });

    // Act — on tente directement la soumission finale, en sautant l'étape
    // "soumettre chaque mission individuellement"
    const reponse = await request(app)
      .post('/api/collaborator/evaluation/me/submit')
      .set('Authorization', `Bearer ${tokenPour(assistant)}`);

    // Assert — le contrôleur doit détecter la mission encore "en attente"
    // (pendingMissions) et refuser, avec le détail des missions concernées.
    expect(reponse.status).toBe(400);
    expect(reponse.body.pendingMissions).toBeDefined();
  });

  it('accepte la soumission finale une fois toutes les missions soumises', async () => {
    // Arrange — cycle complet : ajout de la mission (PUT), puis soumission
    // individuelle de cette mission (POST missions/submit)
    const assistant = await creerCollaborateur();
    await request(app)
      .put('/api/collaborator/evaluation/me')
      .set('Authorization', `Bearer ${tokenPour(assistant)}`)
      .send({ missionEvaluations: [missionValide()] });
    await request(app)
      .post('/api/collaborator/evaluation/me/missions/submit')
      .set('Authorization', `Bearer ${tokenPour(assistant)}`)
      .send({ missionId: 'mission-1' });

    // Act
    const reponse = await request(app)
      .post('/api/collaborator/evaluation/me/submit')
      .set('Authorization', `Bearer ${tokenPour(assistant)}`);

    // Assert — réponse HTTP
    expect(reponse.status).toBe(200);

    // Assert — en base : le statut global de l'évaluation change, ce qui la fait
    // sortir du périmètre "en cours" de l'assistant pour entrer dans le circuit
    // de validation Manager (cf. l'enum de statuts du schéma).
    const enBase = await EvaluationInstance.findOne({ evalue_id: assistant._id });
    expect(enBase.status).toBe('Soumis aux Managers');
    expect(enBase.submitted_at).not.toBeNull();
  });
});
