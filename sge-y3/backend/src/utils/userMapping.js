const GRADE_BY_CATEGORY = {
  '9A': 'Senior',
  '9B': 'Assistant manager',
  '10B': 'Manager',
  '10C': 'Senior manager',
  '11': 'Associé',
};

const ROLE_BY_GRADE = {
  Assistant: 'collaborator',
  Senior: 'senior',
  'Assistant manager': 'manager',
  Manager: 'manager',
  'Senior manager': 'manager',
  Associé: 'associate',
};

const CATEGORY_BY_GRADE = {
  Assistant: '8C',
  Senior: '9A',
  'Assistant manager': '9B',
  Manager: '10B',
  'Senior manager': '10C',
  Associé: '11',
};

const ALLOWED_GRADES = Object.keys(CATEGORY_BY_GRADE);
const ASSISTANT_RH_EMAIL = 'fatoumata.ouattara@ycubeac.com';
const FULL_RH_EMAILS = ['isabella.beda@ycubeac.com'];

function normalizeText(value = '') {
  return String(value).replace(/\s+/g, ' ').trim();
}

function normalizeDepartment(value = '') {
  return normalizeText(value).toUpperCase();
}

function normalizeCategory(value = '') {
  return String(value).replace(/\s+/g, '').toUpperCase();
}

function normalizeEmail(value = '') {
  return normalizeText(value).toLowerCase();
}

function getGradeFromCategory(rawCategory) {
  const category = normalizeCategory(rawCategory);

  if (category.startsWith('8')) {
    return 'Assistant';
  }

  return GRADE_BY_CATEGORY[category] || null;
}

function getCategoryFromGrade(grade) {
  return CATEGORY_BY_GRADE[normalizeText(grade)] || null;
}

function getRoleFromGrade(grade) {
  return ROLE_BY_GRADE[normalizeText(grade)] || 'collaborator';
}

function getFullName(user = {}) {
  return normalizeDepartment([user.first_name, user.last_name, user.name].filter(Boolean).join(' '));
}

function isFullRh(user = {}) {
  const email = normalizeEmail(user.email || '');
  const fullName = getFullName(user);
  return FULL_RH_EMAILS.includes(email) || (fullName.includes('ISABELLA') && fullName.includes('BEDA'));
}

function getPermissionRole(user = {}) {
  const grade = normalizeText(user.grade || '');
  const department = normalizeDepartment(user.department || '');
  const email = normalizeEmail(user.email || '');

  if (isFullRh(user)) {
    return 'admin';
  }

  if (email === ASSISTANT_RH_EMAIL || ((department === 'RH' || department === 'CAPITAL HUMAIN') && grade === 'Assistant')) {
    return 'rh_assistant';
  }

  if (grade === 'Associé' || department === 'RH' || department === 'CAPITAL HUMAIN') {
    return 'admin';
  }

  if (grade === 'Assistant manager' || grade === 'Manager' || grade === 'Senior manager') {
    return 'manager';
  }

  if (grade === 'Assistant' || grade === 'Senior') {
    return 'collaborator';
  }

  return 'collaborator';
}

module.exports = {
  ALLOWED_GRADES,
  ASSISTANT_RH_EMAIL,
  CATEGORY_BY_GRADE,
  getCategoryFromGrade,
  getGradeFromCategory,
  getPermissionRole,
  getRoleFromGrade,
  isFullRh,
  normalizeCategory,
  normalizeDepartment,
  normalizeEmail,
  normalizeText,
};
