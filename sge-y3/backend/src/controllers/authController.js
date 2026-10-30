const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const User = require('../models/User');
const { sendMail, isMailerConfigured } = require('../utils/mailer');
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

  if (canEditCareerInfo && !ALLOWED_GRADES.includes(grade)) {
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
  currentUser.password_changed_at = new Date();
  await currentUser.save();

  // Les autres sessions sont révoquées ; celle-ci reçoit un nouveau jeton.
  return response.json({
    message: 'Mot de passe mis a jour avec succes.',
    ...buildAuthResponse(currentUser),
  });
}

const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000;
const PASSWORD_RESET_COOLDOWN_MS = 60 * 1000;
const FORGOT_PASSWORD_MESSAGE =
  'Si un compte actif correspond à cet email, un lien de réinitialisation vient de vous être envoyé. Il est valable 1 heure.';

function hashResetToken(token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex');
}

// Le lien pointe vers la première origine de FRONTEND_URL ; il n'est jamais déduit de la requête.
function getPasswordResetBaseUrl() {
  const [firstUrl] = String(process.env.FRONTEND_URL || '')
    .split(',')
    .map((url) => url.trim())
    .filter(Boolean);
  return firstUrl ? firstUrl.replace(/\/+$/, '') : '';
}

async function forgotPassword(request, response) {
  const email = normalizeEmail(request.body?.email);

  if (!email) {
    return response.status(400).json({
      message: "L'email est requis.",
    });
  }

  // Même réponse que le compte existe ou non, pour ne pas révéler les emails enregistrés.
  const user = await User.findOne({ email });
  const now = Date.now();
  const recentlyRequested =
    user?.password_reset_requested_at && now - user.password_reset_requested_at.getTime() < PASSWORD_RESET_COOLDOWN_MS;

  if (!user || !user.is_active || recentlyRequested) {
    return response.json({ message: FORGOT_PASSWORD_MESSAGE });
  }

  const baseUrl = getPasswordResetBaseUrl();
  if (!baseUrl) {
    console.error('[auth] FRONTEND_URL non configuré : impossible de construire le lien de réinitialisation.');
    return response.json({ message: FORGOT_PASSWORD_MESSAGE });
  }

  const token = crypto.randomBytes(32).toString('hex');
  user.password_reset_token_hash = hashResetToken(token);
  user.password_reset_expires_at = new Date(now + PASSWORD_RESET_TTL_MS);
  user.password_reset_requested_at = new Date(now);
  await user.save();

  const resetUrl = `${baseUrl}/?reset_token=${token}`;

  if (!isMailerConfigured() && process.env.NODE_ENV !== 'production') {
    console.info(`[auth] SMTP non configuré - lien de réinitialisation pour ${user.email} : ${resetUrl}`);
  }

  sendMail({
    to: user.email,
    subject: 'SGE - Réinitialisation de votre mot de passe',
    text: `Bonjour ${user.name},\n\nUne réinitialisation du mot de passe de votre compte SGE a été demandée.\nPour choisir un nouveau mot de passe, ouvrez ce lien (valable 1 heure, utilisable une seule fois) :\n\n${resetUrl}\n\nSi vous n'êtes pas à l'origine de cette demande, ignorez ce message : votre mot de passe actuel reste inchangé.\n\nCeci est un message automatique, merci de ne pas y répondre.`,
  });

  return response.json({ message: FORGOT_PASSWORD_MESSAGE });
}

async function resetPassword(request, response) {
  const token = String(request.body?.token || '').trim();
  const newPassword = String(request.body?.newPassword || '');
  const confirmPassword = String(request.body?.confirmPassword || '');

  if (!token || !newPassword || !confirmPassword) {
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

  const user = await User.findOne({
    password_reset_token_hash: hashResetToken(token),
    password_reset_expires_at: { $gt: new Date() },
    is_active: true,
  });

  if (!user) {
    return response.status(400).json({
      message: 'Ce lien de réinitialisation est invalide ou a expiré. Veuillez refaire une demande.',
    });
  }

  user.password = Buffer.from(await bcrypt.hash(newPassword, 10), 'utf8');
  user.password_reset_token_hash = null;
  user.password_reset_expires_at = null;
  user.password_changed_at = new Date();
  await user.save();

  return response.json({
    message: 'Mot de passe réinitialisé avec succès. Vous pouvez maintenant vous connecter.',
  });
}

module.exports = {
  buildAuthResponse,
  forgotPassword,
  login,
  resetPassword,
  updatePassword,
  updateProfile,
};
