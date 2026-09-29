// tests/securite-evaluations.test.js
const request = require('supertest');
const app = require('../src/app');
const Evaluation = require('../src/models/EvaluationInstance');
import { creerCollaborateur, tokenPour } from './fixtures.js';

describe('Sécurité — accès aux évaluations', () => {

    it('refuse une requête sans jeton', async () => {
        const reponse = await request(app).get('/api/collaborator/evaluation/me');
        expect(reponse.status).toBe(401);
    });

    it("empêche un senior de lire l'évaluation d'un assistant hors de son périmètre", async () => {
        const seniorA = await creerCollaborateur({ grade: 'Senior', code_categorie: '9A', department: 'Audit' });
        const assistantB = await creerCollaborateur({ grade: 'Assistant', code_categorie: '8C', department: 'Conseil' });

        const reponse = await request(app)
            .get(`/api/senior/assistants/${assistantB._id}/evaluation`)
            .set('Authorization', `Bearer ${tokenPour(seniorA)}`);

        expect(reponse.status).toBe(404);
    });

    it("empêche un assistant de valider l'évaluation d'un membre d'équipe (route réservée au manager)", async () => {
        const assistant = await creerCollaborateur();

        const reponse = await request(app)
            .post(`/api/manager/members/${assistant._id}/evaluation/submit`)
            .set('Authorization', `Bearer ${tokenPour(assistant)}`);

        expect(reponse.status).toBe(403);
    });
});
