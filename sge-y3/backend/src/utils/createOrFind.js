/**
 * Création idempotente face aux requêtes concurrentes.
 *
 * Les contrôleurs suivent le schéma « findOne puis create » pour les documents
 * uniques (une auto-évaluation par cycle et par personne, une revue par binôme).
 * Si deux requêtes arrivent en même temps (tableau de bord qui charge plusieurs
 * endpoints en parallèle, Senior et Assistant qui ouvrent leur page au même
 * moment, double clic...), les deux ne trouvent rien puis les deux insèrent :
 * l'index unique rejette la seconde avec une erreur E11000 remontée en 500.
 *
 * Cette fonction conserve le comportement voulu sans jamais exposer l'erreur :
 * si l'insertion échoue parce qu'un document identique vient d'être créé par
 * une autre requête, on relit et renvoie ce document.
 *
 * @param {import('mongoose').Model} Model
 * @param {object} filter filtre identifiant le document unique (celui du findOne)
 * @param {object} document champs à insérer
 * @returns {Promise<object>} le document existant ou nouvellement créé
 */
async function createOrFind(Model, filter, document) {
  try {
    return await Model.create(document);
  } catch (error) {
    if (error && error.code === 11000) {
      const existing = await Model.findOne(filter);

      if (existing) {
        return existing;
      }
    }

    throw error;
  }
}

module.exports = {
  createOrFind,
};
