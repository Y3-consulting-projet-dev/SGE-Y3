const dotenv = require('dotenv');
const connectDB = require('./config/db');
const { loadActiveCycle } = require('./utils/activeCycle');
const app = require('./app');

dotenv.config();

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  await connectDB();
  await loadActiveCycle();
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Serveur backend démarre sur le port ${PORT}`);
  });
};

startServer();