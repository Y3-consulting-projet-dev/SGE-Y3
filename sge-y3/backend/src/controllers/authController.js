const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const User = require('../models/User');
const {
  ALLOWED_GRADES,
  getCategoryFromGrade,
  getPermissionRole,
  getRoleFromGrade,
  normalizeDepartment,
  normalizeEmail,
  normalizeText,
} = require('../utils/userMapping');

function buildAuthResponse(user) {
  const role = getRoleFromGrade(user.grade);
  const permissionRole = getPermissionRole(user);

  const token = jwt.sign(
    {
      sub: user._id.toString(),
      email: user.email,
      role,
      permission_role: permissionRole,
      grade: user.grade,
      code_categorie: user.code_categorie,
    },
    process.env.JWT_SECRET,
    {
      expiresIn: process.env.JWT_EXPIRES_IN || '24h',
    }
  );

  return {
    token,
    user: {
      ...user.toSafeObject(),
      role,
      permission_role: permissionRole,
    },
  };
}

function canEditGradeAndDepartment(user) {
  const department = normalizeDepartment(user?.department);
  return department === 'RH' || department === 'CAPITAL HUMAIN';
}

async function login(request, response) {
  const email = normalizeEmail(request.body?.email);
  const password = String(request.body?.password || '');

  if (!email || !password) {
    return response.status(400).json({
      message: 'Email et mot de passe sont requis.',
    });
  }

  const user = await User.findOne({ email });

  if (!user || !user.is_active) {
    return response.status(401).json({
      message: 'Identifiants invalides.',
    });
  }

  const passwordHash = user.password.toString('utf8');
  const passwordMatches = await bcrypt.compare(password, passwordHash);

  if (!passwordMatches) {
    return response.status(401).json({
      message: 'Identifiants invalides.',
    });
  }

  return response.json(buildAuthResponse(user));
}

async function updateProfile(request, response) {
  const currentUser = request.user;
  const firstName = normalizeText(request.body?.first_name);
  const lastName = normalizeText(request.body?.last_name);
  const email = normalizeEmail(request.body?.email);
  const canEditCareerInfo = canEditGradeAndDepartment(currentUser);
  const grade = canEditCareerInfo ? normalizeText(request.body?.grade) : currentUser.grade;
  const department = canEditCareerInfo ? normalizeDepartment(request.body?.department) : currentUser.department;

  if (!firstName || !lastName || !email || !grade) {
    return response.status(400).json({
      message: 'Prenom, nom, email et grade sont requis.',
    });
  }

  if (!ALLOWED_GRADES.includes(grade)) {
    return response.status(400).json({
      message: 'Grade invalide.',
    });
  }

  const duplicatedEmail = await User.findOne({
    email,
    _id: { $ne: currentUser._id },
  });

  if (duplicatedEmail) {
    return response.status(409).json({
      message: 'Cet email est deja utilise.',
    });
  }

  currentUser.first_name = firstName;
  currentUser.last_name = lastName;
  currentUser.name = `${firstName} ${lastName}`.trim();
  currentUser.email = email;
  currentUser.grade = grade;
  currentUser.code_categorie = getCategoryFromGrade(grade);
  currentUser.department = department;

  await currentUser.save();

  return response.json({
    message: 'Profil mis a jour avec succes.',
    ...buildAuthResponse(currentUser),
  });
}

async function updatePassword(request, response) {
  const currentUser = request.user;
  const currentPassword = String(request.body?.currentPassword || '');
  const newPassword = String(request.body?.newPassword || '');
  const confirmPassword = String(request.body?.confirmPassword || '');

  if (!currentPassword || !newPassword || !confirmPassword) {
    return response.status(400).json({
      message: 'Tous les champs du mot de passe sont requis.',
    });
  }

  if (newPassword !== confirmPassword) {
    return response.status(400).json({
      message: 'La confirmation du nouveau mot de passe ne correspond pas.',
    });
  }

  if (newPassword.length < 8) {
    return response.status(400).json({
      message: 'Le nouveau mot de passe doit contenir au moins 8 caracteres.',
    });
  }

  const oldHash = currentUser.password.toString('utf8');
  const isCurrentPasswordValid = await bcrypt.compare(currentPassword, oldHash);

  if (!isCurrentPasswordValid) {
    return response.status(400).json({
      message: 'Ancien mot de passe incorrect.',
    });
  }

  currentUser.password = Buffer.from(await bcrypt.hash(newPassword, 10), 'utf8');
  await currentUser.save();

  return response.json({
    message: 'Mot de passe mis a jour avec succes.',
  });
}

module.exports = {
  buildAuthResponse,
  login,
  updatePassword,
  updateProfile,
};
