// tests/assistant-plan-developpement.test.js
//
// Couvre le plan de développement de l'assistant (souhaits d'évolution + demandes
// de formation) : sauvegarde en brouillon puis envoi à un Manager.
//
// Important : ce circuit est indépendant de l'auto-évaluation par missions.
// Il vit dans les mêmes documents EvaluationInstance mais suit ses propres champs
// (development_wishes, development_training_requests, development_status...) et son
// propre statut, qui ne vaut que 'Brouillon' ou 'Soumis au Manager' (cf. l'enum du
// schéma) — à ne pas confondre avec le statut global de l'évaluation.

const request = require('supertest');
const app = require('../src/app');
const EvaluationInstance = require('../src/models/EvaluationInstance');
const { creerCollaborateur, tokenPour } = require('./fixtures');

describe('PUT /api/collaborator/development/me', () => {
  it('enregistre les souhaits et les demandes de formation en brouillon', async () => {
    // Arrange
    const assistant = await creerCollaborateur();

    // Act
    const reponse = await request(app)
      .put('/api/collaborator/development/me')
      .set('Authorization', `Bearer ${tokenPour(assistant)}`)
      .send({
        wishes: 'Évoluer vers un poste de Senior',
        trainingRequests: ['Excel avancé', 'Prise de parole en public'],
      });

    // Assert — réponse HTTP
    expect(reponse.status).toBe(200);

    // Assert — en base
    const enBase = await EvaluationInstance.findOne({ evalue_id: assistant._id });
    expect(enBase.development_wishes).toBe('Évoluer vers un poste de Senior');
    expect(enBase.development_training_requests).toEqual(['Excel avancé', 'Prise de parole en public']);
    // Tant que rien n'a été envoyé au Manager, le plan reste un brouillon modifiable.
    expect(enBase.development_status).toBe('Brouillon');
  });
});

describe('POST /api/collaborator/development/me/submit', () => {
  it('refuse l\'envoi sans manager sélectionné', async () => {
    // Arrange — un plan renseigné, mais aucun destinataire choisi dans la requête
    const assistant = await creerCollaborateur();
    await request(app)
      .put('/api/collaborator/development/me')
      .set('Authorization', `Bearer ${tokenPour(assistant)}`)
      .send({ wishes: 'Évoluer vers un poste de Senior' });

    // Act
    const reponse = await request(app)
      .post('/api/collaborator/development/me/submit')
      .set('Authorization', `Bearer ${tokenPour(assistant)}`)
      .send({});

    // Assert — le contrôleur exige managerId avant même de regarder le contenu du plan
    expect(reponse.status).toBe(400);
  });

  it('refuse un identifiant qui ne correspond à aucun Manager réel', async () => {
    // Le contrôleur revérifie toujours le destinataire en base (code_categorie
    // 10B/10C) : un ID d'utilisateur qui existe mais n'est pas Manager doit être
    // rejeté, même s'il "a l'air" valide côté client.
    const assistant = await creerCollaborateur();
    await request(app)
      .put('/api/collaborator/development/me')
      .set('Authorization', `Bearer ${tokenPour(assistant)}`)
      .send({ wishes: 'Évoluer vers un poste de Senior' });

    const reponse = await request(app)
      .post('/api/collaborator/development/me/submit')
      .set('Authorization', `Bearer ${tokenPour(assistant)}`)
      .send({ managerId: assistant._id.toString() }); // un ID réel, mais celui de l'assistant lui-même

    expect(reponse.status).toBe(400);
  });

  it('refuse l\'envoi si le plan est vide (ni souhaits, ni formation demandée)', async () => {
    // Arrange — un manager valide, mais aucune sauvegarde préalable du plan
    const assistant = await creerCollaborateur();
    const manager = await creerCollaborateur({ grade: 'Manager', code_categorie: '10B' });

    // Act
    const reponse = await request(app)
      .post('/api/collaborator/development/me/submit')
      .set('Authorization', `Bearer ${tokenPour(assistant)}`)
      .send({ managerId: manager._id.toString() });

    // Assert — envoyer un plan vide n'aurait aucun sens pour le manager qui le reçoit
    expect(reponse.status).toBe(400);
  });

  it('envoie le plan au manager choisi et passe le statut à "Soumis au Manager"', async () => {
    // Arrange
    const assistant = await creerCollaborateur();
    const manager = await creerCollaborateur({ grade: 'Manager', code_categorie: '10B' });
    await request(app)
      .put('/api/collaborator/development/me')
      .set('Authorization', `Bearer ${tokenPour(assistant)}`)
      .send({ wishes: 'Évoluer vers un poste de Senior' });

    // Act
    const reponse = await request(app)
      .post('/api/collaborator/development/me/submit')
      .set('Authorization', `Bearer ${tokenPour(assistant)}`)
      .send({ managerId: manager._id.toString() });

    // Assert — réponse HTTP
    expect(reponse.status).toBe(200);

    // Assert — en base : le plan doit être marqué comme envoyé, horodaté, et
    // pointer vers le bon destinataire (pas juste "un" manager quelconque).
    const enBase = await EvaluationInstance.findOne({ evalue_id: assistant._id });
    expect(enBase.development_status).toBe('Soumis au Manager');
    expect(String(enBase.development_submitted_to_user_id)).toBe(String(manager._id));
    expect(enBase.development_submitted_at).not.toBeNull();
  });

  it('refuse un second envoi une fois le plan déjà transmis', async () => {
    // Arrange — un premier envoi qui réussit
    const assistant = await creerCollaborateur();
    const manager = await creerCollaborateur({ grade: 'Manager', code_categorie: '10B' });
    await request(app)
      .put('/api/collaborator/development/me')
      .set('Authorization', `Bearer ${tokenPour(assistant)}`)
      .send({ wishes: 'Évoluer vers un poste de Senior' });
    await request(app)
      .post('/api/collaborator/development/me/submit')
      .set('Authorization', `Bearer ${tokenPour(assistant)}`)
      .send({ managerId: manager._id.toString() });

    // Act — un deuxième envoi, sur un plan déjà au statut "Soumis au Manager"
    const reponse = await request(app)
      .post('/api/collaborator/development/me/submit')
      .set('Authorization', `Bearer ${tokenPour(assistant)}`)
      .send({ managerId: manager._id.toString() });

    // Assert — évite qu'un double clic (ou un rejeu de requête) ne renvoie deux
    // notifications au manager pour le même plan.
    expect(reponse.status).toBe(400);
  });
});
