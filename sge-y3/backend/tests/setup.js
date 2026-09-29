process.env.JWT_SECRET = 'secret-de-test';

const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
 
let mongod;
 
// Une fois, avant tous les tests du fichier
beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
});
 
// Après CHAQUE test : on vide toutes les collections
afterEach(async () => {
  const collections = mongoose.connection.collections;
  for (const nom of Object.keys(collections)) {
    await collections[nom].deleteMany({});
  }
});
 
// Une fois, après tous les tests : on ferme proprement
afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});
