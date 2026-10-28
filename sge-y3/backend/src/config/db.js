const mongoose = require('mongoose');

const DEFAULT_DATABASE_NAME = 'test';

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);

    const databaseName = mongoose.connection.name;
    console.log(`✅ MongoDB connecté : ${databaseName}`);

    if (!databaseName || databaseName === DEFAULT_DATABASE_NAME) {
      console.warn(
        '⚠️  MONGO_URI ne précise pas de base de données : MongoDB utilise la base "test" par défaut. ' +
          "Ajoutez le nom de la base dans l'URI, par exemple mongodb://user:pass@mongo:27017/sge_y3?authSource=admin"
      );
    }
  } catch (error) {
    console.error('❌ Erreur MongoDB :', error.message);
    process.exit(1);
  }
};

module.exports = connectDB;
