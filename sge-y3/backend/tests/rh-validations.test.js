// tests/rh-validations.test.js
//
// Couvre la porte de validation RH (POST /api/rh/validations/confirm) : l'action qui
// fait passer une évaluation soumise au statut "Valide RH", le jalon central du cycle
// (cf. l'enum de statuts documenté dans CLAUDE.md). On construit ici directement un
// ManagerMemberReview déjà "Soumis à la RH" plutôt que de rejouer tout le parcours
// Assistant → Senior/Manager → RH : ce fichier teste spécifiquement l'action de
// validation elle-même, pas la chaîne qui y mène (déjà couverte par
// tests/manager-revue-membres.test.js).
//
// Piège évité en écrivant ce fichier : rhController.js écrit `status = 'Valide RH'`
// (sans accent) sur un ManagerMemberReview, alors que le tableau `enum` déclaré dans
// ManagerMemberReview.js (ligne ~101) ne liste que 'Validé RH' (avec accent). Ça
// ressemble à un bug au premier coup d'œil — mais ManagerMemberReview.js pousse
// ensuite explicitement (lignes ~125-139) toutes les variantes accentuées ET non
// accentuées utilisées ailleurs dans le code (`Soumis a RH` / `Soumis à la RH`,
// `Valide RH` / `Validé RH`, etc.) dans `enumValues` au chargement du modèle : c'est
// un correctif volontaire déjà en place pour tolérer cette incohérence orthographique
// entre les différents contrôleurs. Le statut réellement persisté est donc bien
// 'Valide RH' (sans accent, telle que rhController.js l'écrit), pas une erreur.

const request = require('supertest');
const app = require('../src/app');
const ManagerMemberReview = require('../src/models/ManagerMemberReview');
const { getCurrentCycleLabel } = require('../src/utils/activeCycle');
const { creerCollaborateur, tokenPour } = require('./fixtures');

function creerRh(champs = {}) {
  return creerCollaborateur({ department: 'RH', ...champs });
}

// Un ManagerMemberReview déjà soumis à CE RH, prêt à être validé.
async function creerRevueSoumiseARh(rh) {
  const manager = await creerCollaborateur({ grade: 'Manager', code_categorie: '10B' });
  const membre = await creerCollaborateur({ grade: 'Assistant', code_categorie: '8C' });

  return ManagerMemberReview.create({
    cycle_label: getCurrentCycleLabel(),
    manager_id: manager._id,
    member_id: membre._id,
    status: 'Soumis à la RH',
    submitted_to_user_ids: [rh._id],
  });
}

describe('POST /api/rh/validations/confirm', () => {
  it("refuse une confirmation sans évaluation sélectionnée", async () => {
    const rh = await creerRh();

    const reponse = await request(app)
      .post('/api/rh/validations/confirm')
      .set('Authorization', `Bearer ${tokenPour(rh)}`)
      .send({ reviewIds: [] });

    expect(reponse.status).toBe(400);
  });

  it('valide la revue manager sélectionnée et la fait passer au statut "Valide RH"', async () => {
    // Arrange
    const rh = await creerRh();
    const revue = await creerRevueSoumiseARh(rh);

    // Act
    const reponse = await request(app)
      .post('/api/rh/validations/confirm')
      .set('Authorization', `Bearer ${tokenPour(rh)}`)
      .send({ reviewIds: [revue._id.toString()] });

    // Assert — réponse HTTP
    expect(reponse.status).toBe(200);

    // Assert — en base
    const revueEnBase = await ManagerMemberReview.findById(revue._id);
    expect(revueEnBase.status).toBe('Valide RH');
    expect(revueEnBase.rh_validated_at).not.toBeNull();
  });

  it("n'importe quel membre de la RH peut valider une revue soumise à un autre membre de la RH", async () => {
    // Ce n'est pas un oubli de sécurité : resolveRhQueueUserIds() (rhController.js)
    // résout TOUS les comptes du département RH/CAPITAL HUMAIN, pas seulement
    // l'utilisateur courant — la file de validation est une boîte d'équipe partagée,
    // pas une boîte personnelle. Un second membre RH doit donc pouvoir agir sur une
    // revue transmise à un premier membre RH.
    const rh = await creerRh();
    const autreRh = await creerRh();
    const revue = await creerRevueSoumiseARh(autreRh); // soumise à un AUTRE membre RH

    const reponse = await request(app)
      .post('/api/rh/validations/confirm')
      .set('Authorization', `Bearer ${tokenPour(rh)}`)
      .send({ reviewIds: [revue._id.toString()] });

    expect(reponse.status).toBe(200);
    const revueEnBase = await ManagerMemberReview.findById(revue._id);
    expect(revueEnBase.status).toBe('Valide RH');
  });

  it("n'affecte pas une revue d'un autre cycle, même si elle est dans la bonne file RH", async () => {
    // Sécurité par le cycle : validateRhSelection filtre explicitement sur
    // `cycle_label: getCurrentCycleLabel()`. Une revue d'un cycle clos ne doit
    // jamais pouvoir être "validée" rétroactivement par une confirmation du cycle
    // en cours, même si son statut et ses destinataires correspondraient sinon.
    const rh = await creerRh();
    const manager = await creerCollaborateur({ grade: 'Manager', code_categorie: '10B' });
    const membre = await creerCollaborateur({ grade: 'Assistant', code_categorie: '8C' });
    const revueAncienCycle = await ManagerMemberReview.create({
      cycle_label: 'Cycle 2024-2025', // différent du cycle courant
      manager_id: manager._id,
      member_id: membre._id,
      status: 'Soumis à la RH',
      submitted_to_user_ids: [rh._id],
    });

    const reponse = await request(app)
      .post('/api/rh/validations/confirm')
      .set('Authorization', `Bearer ${tokenPour(rh)}`)
      .send({ reviewIds: [revueAncienCycle._id.toString()] });

    // La requête « réussit » techniquement (aucune ligne ne correspond aux filtres,
    // donc rien à faire), mais le statut de la revue de l'ancien cycle ne doit pas bouger.
    expect(reponse.status).toBe(200);
    const revueEnBase = await ManagerMemberReview.findById(revueAncienCycle._id);
    expect(revueEnBase.status).toBe('Soumis à la RH');
  });
});
