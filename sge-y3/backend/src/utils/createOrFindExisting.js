// Crée un document protégé par un index unique ; si une requête parallèle l'a créé juste avant
// (erreur E11000, ex. deux chargements simultanés à la première connexion), renvoie celui qui existe.
async function createOrFindExisting(Model, doc) {
  try {
    return await Model.create(doc);
  } catch (error) {
    if (error?.code !== 11000 || !error.keyValue) {
      throw error;
    }

    const existing = await Model.findOne(error.keyValue);

    if (!existing) {
      throw error;
    }

    return existing;
  }
}

module.exports = { createOrFindExisting };
