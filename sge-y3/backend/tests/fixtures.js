const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../src/models/User');
const { getRoleFromGrade, getPermissionRole } = require('../src/utils/userMapping');
 
let compteur = 0;
 
async function creerCollaborateur(champs = {}) {
  compteur += 1;
  const motDePasseHash = await bcrypt.hash('MotDePasseDeTest123', 10);
  return User.create({
    name: `Collaborateur de test ${compteur}`,
    last_name: `Nom de test ${compteur}`,
    first_name: `Prénom de test ${compteur}`,
    email: `utilisateur${compteur}@cabinet.test`,
    password: Buffer.from(motDePasseHash, 'utf-8'),
    grade: 'Assistant',
    code_categorie: '8C',
    department: 'Département de test',
    is_active: true,
    ...champs,   // tout ce qu'on passe ici écrase les valeurs par défaut
  });
}
 
function tokenPour(collaborateur) {
  return jwt.sign(
    { 
        sub: collaborateur._id.toString(),
        email: collaborateur.email,
        role: getRoleFromGrade(collaborateur.grade),
        permission_role: getPermissionRole(collaborateur),        grade: collaborateur.grade,
        code_categorie: collaborateur.code_categorie,
     },
    process.env.JWT_SECRET || 'secret-de-test'
  );
}
 
module.exports = { creerCollaborateur, tokenPour };
