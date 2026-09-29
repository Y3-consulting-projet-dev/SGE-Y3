const request = require('supertest');
const app = require('../src/app');
const EvaluationInstance = require('../src/models/EvaluationInstance');
import { creerCollaborateur, tokenPour } from './fixtures.js';
import creerEvaluation from './evaluation.js';

describe('Sécurité — accès aux évaluations', () => {

    it('refuse une requête sans jeton', async () => {
        const reponse = await request(app).get('/api/collaborator/evaluation/me');
        expect(reponse.status).toBe(401);
    });

    it("crée une évaluation pour un assistant", async () => {
        const assistant = await creerCollaborateur();
        const reponse = await request(app)
            .get('/api/collaborator/evaluation/me')
            .set('Authorization', `Bearer ${tokenPour(assistant)}`);
        expect(reponse.status).toBe(200);

        const enBase = await EvaluationInstance.findOne({ evalue_id: assistant._id });
        expect(enBase).not.toBeNull();
        expect(enBase.template_type).toBe('assistant-self-evaluation');
    });
});
