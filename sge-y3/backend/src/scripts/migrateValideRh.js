// Migration : remplace le statut 'Valide RH' (sans accent) par 'Validé RH'.
// Usage : node src/scripts/migrateValideRh.js [--dry-run]
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({
  path: path.resolve(__dirname, '../../.env'),
});

const mongoose = require('mongoose');
const connectDB = require('../config/db');
const EvaluationInstance = require('../models/EvaluationInstance');
const ManagerMemberReview = require('../models/ManagerMemberReview');

const OLD_STATUS = 'Valide RH';
const NEW_STATUS = 'Validé RH';
const MODELS = [EvaluationInstance, ManagerMemberReview];

async function main() {
  const dryRun = process.argv.includes('--dry-run');

  await connectDB();
  console.log(dryRun ? 'Mode simulation (--dry-run) : aucune modification.' : 'Mode réel : les documents vont être modifiés.');

  let total = 0;
  for (const Model of MODELS) {
    const label = `${Model.modelName} (${Model.collection.collectionName})`;

    if (dryRun) {
      const count = await Model.countDocuments({ status: OLD_STATUS });
      console.log(`${label} : ${count} document(s) à migrer.`);
      total += count;
      continue;
    }

    // timestamps: false pour ne pas modifier updated_at lors de cette normalisation.
    const result = await Model.updateMany(
      { status: OLD_STATUS },
      { $set: { status: NEW_STATUS } },
      { timestamps: false }
    );
    console.log(`${label} : ${result.matchedCount} trouvé(s), ${result.modifiedCount} modifié(s).`);
    total += result.modifiedCount;
  }

  console.log(dryRun ? `Total à migrer : ${total}.` : `Total modifié : ${total}.`);
}

main()
  .catch((error) => {
    console.error('Echec migration statut Validé RH:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await mongoose.connection.close();
    } catch (error) {
      console.error('Erreur fermeture connexion MongoDB:', error.message);
    }
  });
