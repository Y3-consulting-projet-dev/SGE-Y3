// tests/rh-gestion-collaborateurs.test.js
//
// Couvre la gestion des comptes collaborateurs par la RH : création, liste,
// modification et activation/désactivation. C'est la partie la plus autonome du
// parcours RH (rhCollaboratorController.js, un fichier à part, sans dépendance au
// reste du cycle d'évaluation), et la seule qui crée/modifie des comptes User.
//
// Point d'accès à deux niveaux, à distinguer dans les tests :
//   - requireAuth + requireRh (middleware de route) : accepte un `département` RH/
//     CAPITAL HUMAIN, OU un `permission_role` admin/rh_assistant (donc, entre autres,
//     n'importe quel Associé, cf. getPermissionRole dans userMapping.js) ;
//   - ensureRhDepartmentAccess (vérification interne à ce contrôleur) : n'accepte
//     QUE le département RH/CAPITAL HUMAIN. Un Associé passe donc le premier garde,
//     mais se fait bloquer par le second — un bon test de "sécurité en profondeur".

const request = require('supertest');
const app = require('../src/app');
const User = require('../src/models/User');
const { creerCollaborateur, tokenPour } = require('./fixtures');

function creerRh(champs = {}) {
  return creerCollaborateur({ department: 'RH', ...champs });
}

function creerAssocie(champs = {}) {
  return creerCollaborateur({ grade: 'Associé', code_categorie: '11', department: 'DIRECTION', ...champs });
}

describe('POST /api/rh/collaborators', () => {
  it("refuse un Associé (passe requireRh via permission_role, mais pas le département RH)", async () => {
    const associe = await creerAssocie();

    const reponse = await request(app)
      .post('/api/rh/collaborators')
      .set('Authorization', `Bearer ${tokenPour(associe)}`)
      .send({ first_name: 'Awa', last_name: 'Koné', email: 'awa.kone@cabinet.test', grade: 'Assistant', department: 'AUDIT' });

    expect(reponse.status).toBe(403);
  });

  it('refuse un champ requis manquant', async () => {
    const rh = await creerRh();

    const reponse = await request(app)
      .post('/api/rh/collaborators')
      .set('Authorization', `Bearer ${tokenPour(rh)}`)
      .send({ first_name: 'Awa', last_name: 'Koné', email: 'awa.kone@cabinet.test', grade: 'Assistant' }); // pas de département

    expect(reponse.status).toBe(400);
  });

  it('refuse un grade qui ne figure pas dans le référentiel', async () => {
    const rh = await creerRh();

    const reponse = await request(app)
      .post('/api/rh/collaborators')
      .set('Authorization', `Bearer ${tokenPour(rh)}`)
      .send({ first_name: 'Awa', last_name: 'Koné', email: 'awa.kone@cabinet.test', grade: 'Stagiaire', department: 'AUDIT' });

    expect(reponse.status).toBe(400);
  });

  it('crée le collaborateur avec le mot de passe par défaut du cabinet', async () => {
    // Arrange
    const rh = await creerRh();

    // Act
    const reponse = await request(app)
      .post('/api/rh/collaborators')
      .set('Authorization', `Bearer ${tokenPour(rh)}`)
      .send({ first_name: 'Awa', last_name: 'Koné', email: 'awa.kone@cabinet.test', grade: 'Assistant', department: 'AUDIT' });

    // Assert — réponse HTTP
    expect(reponse.status).toBe(201);
    // toSafeObject() ne doit jamais exposer le mot de passe, même haché.
    expect(reponse.body.user.password).toBeUndefined();

    // Assert — en base : le grade détermine automatiquement le code_categorie
    // (getCategoryFromGrade), et le compte est actif par défaut.
    const enBase = await User.findOne({ email: 'awa.kone@cabinet.test' });
    expect(enBase).not.toBeNull();
    expect(enBase.code_categorie).toBe('8C');
    expect(enBase.is_active).toBe(true);
  });

  it('refuse un email déjà utilisé par un autre compte', async () => {
    const rh = await creerRh();
    const existant = await creerCollaborateur();

    const reponse = await request(app)
      .post('/api/rh/collaborators')
      .set('Authorization', `Bearer ${tokenPour(rh)}`)
      .send({ first_name: 'Awa', last_name: 'Koné', email: existant.email, grade: 'Assistant', department: 'AUDIT' });

    expect(reponse.status).toBe(409);
  });
});

describe('GET /api/rh/collaborators', () => {
  it('filtre par défaut sur les comptes actifs uniquement', async () => {
    const rh = await creerRh();
    const actif = await creerCollaborateur({ is_active: true });
    const inactif = await creerCollaborateur({ is_active: false });

    const reponse = await request(app)
      .get('/api/rh/collaborators')
      .set('Authorization', `Bearer ${tokenPour(rh)}`);

    expect(reponse.status).toBe(200);
    const ids = reponse.body.collaborators.map((collaborateur) => collaborateur.id);
    expect(ids).toContain(String(actif._id));
    expect(ids).not.toContain(String(inactif._id));
  });
});

describe('PUT /api/rh/collaborators/:userId', () => {
  it('met à jour le profil et recalcule le code_categorie si le grade change', async () => {
    const rh = await creerRh();
    const collaborateur = await creerCollaborateur({ grade: 'Assistant', code_categorie: '8C' });

    const reponse = await request(app)
      .put(`/api/rh/collaborators/${collaborateur._id}`)
      .set('Authorization', `Bearer ${tokenPour(rh)}`)
      .send({
        first_name: collaborateur.first_name,
        last_name: collaborateur.last_name,
        email: collaborateur.email,
        grade: 'Senior',
        department: collaborateur.department,
      });

    expect(reponse.status).toBe(200);

    const enBase = await User.findById(collaborateur._id);
    expect(enBase.grade).toBe('Senior');
    expect(enBase.code_categorie).toBe('9A');
  });

  it('renvoie 404 pour un collaborateur inexistant', async () => {
    const rh = await creerRh();
    const idInexistant = '507f1f77bcf86cd799439011';

    const reponse = await request(app)
      .put(`/api/rh/collaborators/${idInexistant}`)
      .set('Authorization', `Bearer ${tokenPour(rh)}`)
      .send({ first_name: 'A', last_name: 'B', email: 'ab@cabinet.test', grade: 'Assistant', department: 'AUDIT' });

    expect(reponse.status).toBe(404);
  });
});

describe('PATCH /api/rh/collaborators/:userId/status', () => {
  it('désactive un compte', async () => {
    const rh = await creerRh();
    const collaborateur = await creerCollaborateur({ is_active: true });

    const reponse = await request(app)
      .patch(`/api/rh/collaborators/${collaborateur._id}/status`)
      .set('Authorization', `Bearer ${tokenPour(rh)}`)
      .send({ is_active: false });

    expect(reponse.status).toBe(200);

    const enBase = await User.findById(collaborateur._id);
    expect(enBase.is_active).toBe(false);
  });

  it('refuse qu\'un utilisateur RH désactive son propre compte', async () => {
    const rh = await creerRh();

    const reponse = await request(app)
      .patch(`/api/rh/collaborators/${rh._id}/status`)
      .set('Authorization', `Bearer ${tokenPour(rh)}`)
      .send({ is_active: false });

    expect(reponse.status).toBe(400);
  });
});
