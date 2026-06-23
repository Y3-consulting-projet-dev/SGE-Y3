const bcrypt = require('bcryptjs');

const User = require('../models/User');
const {
  ALLOWED_GRADES,
  getCategoryFromGrade,
  normalizeDepartment,
  normalizeEmail,
  normalizeText,
} = require('../utils/userMapping');

const DEFAULT_PASSWORD = 'Ycube@c2026';
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DUPLICATE_EMAIL_MESSAGE = 'Cet email est deja utilise.';

function isRhDepartment(department = '') {
  return normalizeDepartment(department) === 'RH' || normalizeDepartment(department) === 'CAPITAL HUMAIN';
}

function ensureRhDepartmentAccess(request, response) {
  if (!isRhDepartment(request.user?.department)) {
    response.status(403).json({
      message: 'Seule la RH / Capital Humain peut gerer les comptes collaborateurs.',
    });
    return false;
  }

  return true;
}

function escapeRegExp(value = '') {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function readCollaboratorPayload(request) {
  return {
    firstName: normalizeText(request.body?.first_name),
    lastName: normalizeText(request.body?.last_name),
    email: normalizeEmail(request.body?.email),
    grade: normalizeText(request.body?.grade),
    department: normalizeDepartment(request.body?.department),
  };
}

function validateCollaboratorPayload({ firstName, lastName, email, grade, department }, response) {
  if (!firstName || !lastName || !email || !grade || !department) {
    response.status(400).json({
      message: 'Prenom, nom, email, grade et departement sont requis.',
    });
    return false;
  }

  if (!ALLOWED_GRADES.includes(grade)) {
    response.status(400).json({
      message: 'Grade invalide.',
    });
    return false;
  }

  if (!EMAIL_REGEX.test(email)) {
    response.status(400).json({
      message: 'Email invalide.',
    });
    return false;
  }

  return true;
}

async function listCollaborators(request, response) {
  const { search, department, grade, status } = request.query || {};
  const filter = {};

  if (status === 'inactive') {
    filter.is_active = false;
  } else if (status !== 'all') {
    filter.is_active = true;
  }

  if (department) {
    filter.department = normalizeDepartment(department);
  }

  if (grade && ALLOWED_GRADES.includes(normalizeText(grade))) {
    filter.grade = normalizeText(grade);
  }

  if (search) {
    const regex = new RegExp(escapeRegExp(String(search).trim()), 'i');
    filter.$or = [{ name: regex }, { email: regex }, { first_name: regex }, { last_name: regex }];
  }

  const collaborators = await User.find(filter).sort({ last_name: 1, first_name: 1 });

  return response.json({
    collaborators: collaborators.map((collaborator) => collaborator.toSafeObject()),
  });
}

async function createCollaborator(request, response) {
  if (!ensureRhDepartmentAccess(request, response)) {
    return undefined;
  }

  const payload = readCollaboratorPayload(request);

  if (!validateCollaboratorPayload(payload, response)) {
    return undefined;
  }

  const { firstName, lastName, email, grade, department } = payload;
  const existingUser = await User.findOne({ email });

  if (existingUser) {
    return response.status(409).json({ message: DUPLICATE_EMAIL_MESSAGE });
  }

  const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 10);

  try {
    const newUser = await User.create({
      email,
      password: Buffer.from(passwordHash, 'utf8'),
      name: `${firstName} ${lastName}`.trim(),
      first_name: firstName,
      last_name: lastName,
      grade,
      department,
      is_active: true,
      code_categorie: getCategoryFromGrade(grade),
    });

    return response.status(201).json({
      message: 'Collaborateur cree avec succes.',
      user: newUser.toSafeObject(),
    });
  } catch (error) {
    if (error?.code === 11000) {
      return response.status(409).json({ message: DUPLICATE_EMAIL_MESSAGE });
    }

    throw error;
  }
}

async function updateCollaborator(request, response) {
  if (!ensureRhDepartmentAccess(request, response)) {
    return undefined;
  }

  const targetUser = await User.findById(request.params.userId);

  if (!targetUser) {
    return response.status(404).json({ message: 'Collaborateur introuvable.' });
  }

  const payload = readCollaboratorPayload(request);

  if (!validateCollaboratorPayload(payload, response)) {
    return undefined;
  }

  const { firstName, lastName, email, grade, department } = payload;
  const duplicatedEmail = await User.findOne({ email, _id: { $ne: targetUser._id } });

  if (duplicatedEmail) {
    return response.status(409).json({ message: DUPLICATE_EMAIL_MESSAGE });
  }

  targetUser.first_name = firstName;
  targetUser.last_name = lastName;
  targetUser.name = `${firstName} ${lastName}`.trim();
  targetUser.email = email;
  targetUser.grade = grade;
  targetUser.code_categorie = getCategoryFromGrade(grade);
  targetUser.department = department;

  try {
    await targetUser.save();
  } catch (error) {
    if (error?.code === 11000) {
      return response.status(409).json({ message: DUPLICATE_EMAIL_MESSAGE });
    }

    throw error;
  }

  return response.json({
    message: 'Collaborateur mis a jour avec succes.',
    user: targetUser.toSafeObject(),
  });
}

async function setCollaboratorActiveStatus(request, response) {
  if (!ensureRhDepartmentAccess(request, response)) {
    return undefined;
  }

  const targetUser = await User.findById(request.params.userId);

  if (!targetUser) {
    return response.status(404).json({ message: 'Collaborateur introuvable.' });
  }

  const nextActive = request.body?.is_active;

  if (typeof nextActive !== 'boolean') {
    return response.status(400).json({ message: 'Le statut actif doit etre vrai ou faux.' });
  }

  if (String(targetUser._id) === String(request.user._id) && nextActive === false) {
    return response.status(400).json({ message: 'Vous ne pouvez pas desactiver votre propre compte.' });
  }

  targetUser.is_active = nextActive;
  await targetUser.save();

  return response.json({
    message: nextActive ? 'Collaborateur reactive avec succes.' : 'Collaborateur desactive avec succes.',
    user: targetUser.toSafeObject(),
  });
}

module.exports = {
  createCollaborator,
  listCollaborators,
  setCollaboratorActiveStatus,
  updateCollaborator,
};
