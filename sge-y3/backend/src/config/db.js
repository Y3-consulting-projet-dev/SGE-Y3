const mongoose = require('mongoose');

const DEFAULT_MONGO_URI = 'mongodb://localhost:27017/sge_y3';

const connectDB = async () => {
  try {
    const mongoUri = process.env.MONGO_URI || DEFAULT_MONGO_URI;
    await mongoose.connect(mongoUri);
    console.log('✅ MongoDB connecté : sge_y3');
  } catch (error) {
    console.error('❌ Erreur MongoDB :', error.message);
    process.exit(1);
  }
};

module.exports = connectDB;