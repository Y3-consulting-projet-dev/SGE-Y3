// tests/support-auto-evaluation.test.js
//
// Couvre l'auto-évaluation du service Support (template_type 'support-self-evaluation').
// Rôle particulier : requireSupport (défini directement dans supportRoutes.js, pas dans
// collaboratorMiddleware.js comme les autres) n'exige qu'un département SUPPORT ou
// SERVICE SUPPORT — aucune contrainte de grade/code_categorie.
//
// Comme pour l'Associé et la partie "sections" du Manager, le formulaire vient de la
// matrice de compétences (cloneSupportSections) : on utilise donc la technique
// "lire l'état réel via GET, puis le renvoyer complété" pour le test de soumission finale.

const request = require('supertest');
const app = require('../src/app');
const EvaluationInstance = require('../src/models/EvaluationInstance');
const { creerCollaborateur, tokenPour } = require('./fixtures');

function creerSupport(champs = {}) {
  return creerCollaborateur({ department: 'SUPPORT', ...champs });
}

function creerAssocie(champs = {}) {
  return creerCollaborateur({ grade: 'Associé', code_categorie: '11', ...champs });
}

describe('GET /api/support/self-evaluation', () => {
  it("crée automatiquement l'auto-évaluation du support", async () => {
    const support = await creerSupport();

    const reponse = await request(app)
      .get('/api/support/self-evaluation')
      .set('Authorization', `Bearer ${tokenPour(support)}`);

    expect(reponse.status).toBe(200);

    const enBase = await EvaluationInstance.findOne({ evalue_id: support._id });
    expect(enBase).not.toBeNull();
    expect(enBase.template_type).toBe('support-self-evaluation');
  });
});

describe('PUT /api/support/self-evaluation', () => {
  it('refuse un thème personnalisé sans libellé', async () => {
    const support = await creerSupport();

    const reponse = await request(app)
      .put('/api/support/self-evaluation')
      .set('Authorization', `Bearer ${tokenPour(support)}`)
      .send({
        sections: [
          {
            id: 1,
            title: 'Compétences',
            subtitle: 'Compétences',
            status: 'A faire',
            pages: [
              {
                page_id: 'p1',
                title: 'Page 1',
                is_custom: true,
                themes: [{ theme_id: 't1', code: '', label: '', statement: '', score: null, is_custom: true }],
              },
            ],
          },
        ],
      });

    expect(reponse.status).toBe(400);
  });
});

describe('POST /api/support/self-evaluation/submit', () => {
  it("refuse la soumission quand aucun associé n'existe dans le cabinet", async () => {
    const support = await creerSupport();

    const reponse = await request(app)
      .post('/api/support/self-evaluation/submit')
      .set('Authorization', `Bearer ${tokenPour(support)}`);

    expect(reponse.status).toBe(400);
  });

  it('refuse la soumission tant que les questions obligatoires ne sont pas toutes répondues', async () => {
    const support = await creerSupport();
    await creerAssocie();
    await request(app).get('/api/support/self-evaluation').set('Authorization', `Bearer ${tokenPour(support)}`);

    const reponse = await request(app)
      .post('/api/support/self-evaluation/submit')
      .set('Authorization', `Bearer ${tokenPour(support)}`);

    expect(reponse.status).toBe(400);
    expect(reponse.body.missingAnswers).toBeDefined();
  });

  it('accepte la soumission une fois toutes les sections notées et commentées', async () => {
    // Arrange — on relit le référentiel réel généré pour ce support (GET), puis on le
    // renvoie complété (note 5 partout, jamais < 3) avec un commentaire par section.
    const support = await creerSupport();
    const associe = await creerAssocie();
    const etatInitial = await request(app)
      .get('/api/support/self-evaluation')
      .set('Authorization', `Bearer ${tokenPour(support)}`);

    const sectionsCompletees = etatInitial.body.evaluation.sections.map((section) => ({
      ...section,
      comment: 'Auto-évaluation support complète.',
      pages: (section.pages || []).map((page) => ({
        ...page,
        themes: (page.themes || []).map((theme) => ({ ...theme, score: 5 })),
      })),
      criteria: (section.criteria || []).map((criterion) => ({ ...criterion, score: 5 })),
    }));

    await request(app)
      .put('/api/support/self-evaluation')
      .set('Authorization', `Bearer ${tokenPour(support)}`)
      .send({ sections: sectionsCompletees });

    // Act
    const reponse = await request(app)
      .post('/api/support/self-evaluation/submit')
      .set('Authorization', `Bearer ${tokenPour(support)}`);

    // Assert — réponse HTTP
    expect(reponse.status).toBe(200);

    // Assert — en base : transmise à l'associé, seul destinataire possible ici
    const enBase = await EvaluationInstance.findOne({ evalue_id: support._id });
    expect(enBase.status).toBe('Soumis aux Associes');
    expect(enBase.submitted_to_user_ids.map(String)).toContain(String(associe._id));
  });
});
