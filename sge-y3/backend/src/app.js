const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

const connectDB = require('./config/db');
const authRoutes = require('./routes/authRoutes');
const collaboratorRoutes = require('./routes/collaboratorRoutes');
const seniorRoutes = require('./routes/seniorRoutes');
const managerRoutes = require('./routes/managerRoutes');
const committeeRoutes = require('./routes/committeeRoutes');
const rhRoutes = require('./routes/rhRoutes');
const associateRoutes = require('./routes/associateRoutes');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(
  cors({
    origin: process.env.FRONTEND_URL || true,
    credentials: true,
    exposedHeaders: ['Content-Disposition', 'Content-Type'],
  })
);
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

app.get('/api/health', (_request, response) => {
  response.json({ status: 'ok' });
});

app.use('/api/auth', authRoutes);
app.use('/api/collaborator', collaboratorRoutes);
app.use('/api/senior', seniorRoutes);
app.use('/api/manager', managerRoutes);
app.use('/api/committee', committeeRoutes);
app.use('/api/rh', rhRoutes);
app.use('/api/associate', associateRoutes);

app.use((error, _request, response, _next) => {
  console.error(error);
  if (error.type === 'entity.too.large') {
    return response.status(413).json({
      message: "Le contenu envoye est trop volumineux pour etre traite.",
    });
  }
  response.status(error.statusCode || 500).json({
    message: error.message || 'Une erreur serveur est survenue.',
  });
});

const startServer = async () => {
  await connectDB();
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Serveur backend demarre sur le port ${PORT}`);
  });
};

startServer();
