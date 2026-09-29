// tests/associe-auto-evaluation.test.js
//
// Couvre la propre auto-évaluation de l'Associé (template_type 'associate-self-evaluation').
// C'est un formulaire "sections" classique, généré depuis la matrice de compétences
// (cloneSectionsForAssociate) — comme pour l'évaluation "sections" d'un membre par son
// manager (tests/manager-revue-membres.test.js), on utilise donc la technique "lire l'état
// réel via GET, puis le renvoyer complété" pour le test de soumission finale, plutôt que
// de deviner le contenu du référentiel.
//
// Particularité de l'Associé : sa propre évaluation doit être transmise à un AUTRE
// associé (resolveOtherAssociates) — il ne peut jamais se la transmettre à lui-même,
// et la soumission échoue explicitement s'il est le seul associé du cabinet.

const request = require('supertest');
const app = require('../src/app');
const EvaluationInstance = require('../src/models/EvaluationInstance');
const { creerCollaborateur, tokenPour } = require('./fixtures');

function creerAssocie(champs = {}) {
  return creerCollaborateur({ grade: 'Associé', code_categorie: '11', ...champs });
}

describe('GET /api/associate/self-evaluation', () => {
  it("crée automatiquement l'auto-évaluation de l'associé", async () => {
    const associe = await creerAssocie();

    const reponse = await request(app)
      .get('/api/associate/self-evaluation')
      .set('Authorization', `Bearer ${tokenPour(associe)}`);

    expect(reponse.status).toBe(200);

    const enBase = await EvaluationInstance.findOne({ evalue_id: associe._id });
    expect(enBase).not.toBeNull();
    expect(enBase.template_type).toBe('associate-self-evaluation');
  });
});

describe('POST /api/associate/self-evaluation/submit', () => {
  it("refuse la soumission quand aucun autre associé n'existe dans le cabinet", async () => {
    const seulAssocie = await creerAssocie();

    const reponse = await request(app)
      .post('/api/associate/self-evaluation/submit')
      .set('Authorization', `Bearer ${tokenPour(seulAssocie)}`);

    expect(reponse.status).toBe(400);
  });

  it('refuse la soumission tant que les questions obligatoires ne sont pas toutes répondues', async () => {
    // La revue est créée avec le vrai référentiel dès le premier GET — une soumission
    // immédiate, sans rien avoir rempli, doit donc échouer.
    const associe = await creerAssocie();
    await creerAssocie(); // un second associé, sinon on tombe sur le cas précédent
    await request(app).get('/api/associate/self-evaluation').set('Authorization', `Bearer ${tokenPour(associe)}`);

    const reponse = await request(app)
      .post('/api/associate/self-evaluation/submit')
      .set('Authorization', `Bearer ${tokenPour(associe)}`);

    expect(reponse.status).toBe(400);
    expect(reponse.body.missingAnswers).toBeDefined();
  });

  it('accepte la soumission une fois toutes les sections notées et commentées', async () => {
    // Arrange — on relit le référentiel réel généré pour cet associé (GET), puis on
    // le renvoie complété (note 5 partout, jamais < 3, pour ne jamais déclencher une
    // règle de justification supplémentaire) avec un commentaire par section.
    const associe = await creerAssocie();
    const autreAssocie = await creerAssocie();
    const etatInitial = await request(app)
      .get('/api/associate/self-evaluation')
      .set('Authorization', `Bearer ${tokenPour(associe)}`);

    const sectionsCompletees = etatInitial.body.evaluation.sections.map((section) => ({
      ...section,
      comment: 'Auto-évaluation complète et commentée.',
      pages: (section.pages || []).map((page) => ({
        ...page,
        themes: (page.themes || []).map((theme) => ({ ...theme, score: 5 })),
      })),
      criteria: (section.criteria || []).map((criterion) => ({ ...criterion, score: 5 })),
    }));

    await request(app)
      .put('/api/associate/self-evaluation')
      .set('Authorization', `Bearer ${tokenPour(associe)}`)
      .send({ sections: sectionsCompletees });

    // Act
    const reponse = await request(app)
      .post('/api/associate/self-evaluation/submit')
      .set('Authorization', `Bearer ${tokenPour(associe)}`);

    // Assert — réponse HTTP
    expect(reponse.status).toBe(200);

    // Assert — en base : transmise à un des autres associés du cabinet (il n'y en a
    // qu'un seul disponible ici, donc c'est forcément lui).
    const enBase = await EvaluationInstance.findOne({ evalue_id: associe._id });
    expect(enBase.status).toBe('Soumis aux Associes');
    expect(enBase.submitted_to_user_ids.map(String)).toContain(String(autreAssocie._id));
  });
});
