// tests/health.test.js
const request = require('supertest');
const app = require('../src/app');
 
describe('GET /api/health', () => {
  it('répond 200 avec un statut ok', async () => {
    const reponse = await request(app).get('/api/health');
 
    expect(reponse.status).toBe(200);
    expect(reponse.body.status).toBe('ok');
  });
});
