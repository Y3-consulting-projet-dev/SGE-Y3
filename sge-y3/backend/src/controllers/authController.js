const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const User = require('../models/User');
const { sendMail, isMailerConfigured } = require('../utils/mailer');
const { DEFAULT_PASSWORD, getPasswordResetMode, isRecoveryCodeMode } = require('../utils/passwordPolicy');
const { generateRecoveryCode, hashRecoveryCode, verifyRecoveryCode } = require('../utils/recoveryCode');
const { logSecurityEvent } = require('../utils/securityLog');
const {
  ALLOWED_GRADES,
  getCategoryFromGrade,
  getPermissionRole,
  getRoleFromGrade,
  normalizeDepartment,
  normalizeEmail,
  normalizeText,
} = require('../utils/userMapping');

// Étape obligatoire avant d'accéder à l'application (vérifiée aussi par authMiddleware).
function getSecurityRequirements(user) {
  return {
    recovery_code_required: isRecoveryCodeMode() && !user.recovery_code_confirmed_at,
  };
}

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
      ...getSecurityRequirements(user),
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

  if (newPassword === DEFAULT_PASSWORD) {
    return response.status(400).json({ message: DEFAULT_PASSWORD_REUSED_MESSAGE });
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
const DEFAULT_PASSWORD_REUSED_MESSAGE = 'Le nouveau mot de passe doit être différent du mot de passe par défaut.';
const FEATURE_UNAVAILABLE_MESSAGE = "Cette fonctionnalité n'est pas disponible.";

function hashResetToken(token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex');
}

// Jeton de réinitialisation (haché en base, 1 h, usage unique), commun aux modes e-mail et code de secours.
function issuePasswordResetToken(user) {
  const token = crypto.randomBytes(32).toString('hex');
  user.password_reset_token_hash = hashResetToken(token);
  user.password_reset_expires_at = new Date(Date.now() + PASSWORD_RESET_TTL_MS);
  return token;
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
  // Envoi par e-mail conservé, mais inutilisable tant que le mode « code de secours » est actif.
  if (getPasswordResetMode() !== 'email') {
    return response.status(404).json({ message: FEATURE_UNAVAILABLE_MESSAGE });
  }

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

  const token = issuePasswordResetToken(user);
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

  if (newPassword === DEFAULT_PASSWORD) {
    return response.status(400).json({ message: DEFAULT_PASSWORD_REUSED_MESSAGE });
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

  // Les anciennes sessions sont révoquées ; l'utilisateur est connecté avec une nouvelle session
  // pour pouvoir recevoir aussitôt son nouveau code de secours.
  return response.json({
    message: 'Mot de passe réinitialisé avec succès.',
    ...buildAuthResponse(user),
  });
}

const RECOVERY_INVALID_MESSAGE = 'E-mail ou code de secours incorrect';
const RECOVERY_MAX_FAILED_ATTEMPTS = 5;
const RECOVERY_LOCK_DURATION_MS = 15 * 60 * 1000;

function getAuthConfig(_request, response) {
  return response.json({ passwordResetMode: getPasswordResetMode() });
}

// Vérifie e-mail + code de secours, consomme le code et délivre un jeton de réinitialisation.
// Même message et temps comparable pour un e-mail inconnu, un code faux, un compte sans code ou bloqué.
async function recoverWithCode(request, response) {
  if (!isRecoveryCodeMode()) {
    return response.status(404).json({ message: FEATURE_UNAVAILABLE_MESSAGE });
  }

  const email = normalizeEmail(request.body?.email);
  const code = String(request.body?.code || '');

  if (!email || !code.trim()) {
    return response.status(400).json({ message: 'Veuillez renseigner votre e-mail et votre code de secours.' });
  }

  const user = await User.findOne({ email });
  const now = Date.now();
  const isLocked = Boolean(user?.recovery_locked_until && user.recovery_locked_until.getTime() > now);
  const canRecover = Boolean(user?.is_active && user.recovery_code_hash && !isLocked);

  // Toujours une comparaison bcrypt, avec un hachage fictif si le compte ne peut pas être récupéré.
  const codeMatches = await verifyRecoveryCode(code, canRecover ? user.recovery_code_hash : null);

  if (!canRecover || !codeMatches) {
    if (canRecover) {
      user.recovery_failed_attempts = (user.recovery_failed_attempts || 0) + 1;
      if (user.recovery_failed_attempts >= RECOVERY_MAX_FAILED_ATTEMPTS) {
        user.recovery_failed_attempts = 0;
        user.recovery_locked_until = new Date(now + RECOVERY_LOCK_DURATION_MS);
        await user.save();
        await logSecurityEvent('recovery_locked', { user, request });
      } else {
        await user.save();
      }
    }
    await logSecurityEvent('recovery_failed', { user: user || null, email, request });
    return response.status(400).json({ message: RECOVERY_INVALID_MESSAGE });
  }

  // Code à usage unique : consommé dès qu'il est accepté.
  user.recovery_code_hash = null;
  user.recovery_code_created_at = null;
  user.recovery_code_confirmed_at = null;
  user.recovery_failed_attempts = 0;
  user.recovery_locked_until = null;
  const resetToken = issuePasswordResetToken(user);
  await user.save();
  await logSecurityEvent('recovery_success', { user, request });

  return response.json({ resetToken });
}

async function storeNewRecoveryCode(user) {
  const code = generateRecoveryCode();
  user.recovery_code_hash = await hashRecoveryCode(code);
  user.recovery_code_created_at = new Date();
  return code;
}

// Code initial (première connexion, compte sans code, après réinitialisation) : affiché une seule fois.
async function createRecoveryCode(request, response) {
  const user = request.user;

  if (!isRecoveryCodeMode()) {
    return response.status(404).json({ message: FEATURE_UNAVAILABLE_MESSAGE });
  }

  if (user.recovery_code_confirmed_at) {
    return response.status(409).json({
      message: 'Un code de secours est déjà actif. Utilisez « Générer un nouveau code de secours » depuis votre profil.',
    });
  }

  // Un code généré mais non confirmé (page rechargée) est remplacé : l'ancien devient invalide.
  const code = await storeNewRecoveryCode(user);
  user.recovery_code_confirmed_at = null;
  await user.save();
  await logSecurityEvent('recovery_code_generated', { user, request });

  return response.json({ code, email: user.email, createdAt: user.recovery_code_created_at });
}

async function confirmRecoveryCode(request, response) {
  const user = request.user;

  if (!user.recovery_code_hash) {
    return response.status(400).json({ message: "Aucun code de secours n'a été généré." });
  }

  if (!user.recovery_code_confirmed_at) {
    user.recovery_code_confirmed_at = new Date();
    await user.save();
  }

  return response.json({
    message: 'Code de secours enregistré.',
    ...buildAuthResponse(user),
  });
}

// Régénération volontaire depuis le profil, confirmée par le mot de passe actuel.
async function regenerateRecoveryCode(request, response) {
  const user = request.user;
  const currentPassword = String(request.body?.currentPassword || '');

  if (!isRecoveryCodeMode()) {
    return response.status(404).json({ message: FEATURE_UNAVAILABLE_MESSAGE });
  }

  if (!currentPassword) {
    return response.status(400).json({ message: 'Veuillez saisir votre mot de passe actuel.' });
  }

  const passwordMatches = await bcrypt.compare(currentPassword, user.password.toString('utf8'));
  if (!passwordMatches) {
    return response.status(400).json({ message: 'Mot de passe actuel incorrect.' });
  }

  // L'ancien code est remplacé, donc immédiatement invalide.
  const code = await storeNewRecoveryCode(user);
  user.recovery_code_confirmed_at = new Date();
  user.recovery_failed_attempts = 0;
  user.recovery_locked_until = null;
  await user.save();
  await logSecurityEvent('recovery_code_regenerated', { user, request });

  return response.json({ code, email: user.email, createdAt: user.recovery_code_created_at });
}

module.exports = {
  buildAuthResponse,
  confirmRecoveryCode,
  createRecoveryCode,
  forgotPassword,
  getAuthConfig,
  getSecurityRequirements,
  login,
  recoverWithCode,
  regenerateRecoveryCode,
  resetPassword,
  updatePassword,
  updateProfile,
};
