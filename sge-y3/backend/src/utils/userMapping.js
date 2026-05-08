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
  Associe: '11',
};

const ALLOWED_GRADES = Object.keys(CATEGORY_BY_GRADE);

function normalizeCategory(value = '') {
  return String(value).replace(/\s+/g, '').toUpperCase();
}

function getGradeFromCategory(rawCategory) {
  const category = normalizeCategory(rawCategory);

  if (category.startsWith('8')) {
    return 'Assistant';
  }

  return GRADE_BY_CATEGORY[category] || null;
}

function getRoleFromGrade(grade) {
  return ROLE_BY_GRADE[grade] || 'collaborator';
}

function getCategoryFromGrade(grade) {
  return CATEGORY_BY_GRADE[normalizeText(grade)] || null;
}

function normalizeText(value = '') {
  return String(value).replace(/\s+/g, ' ').trim();
}

function normalizeDepartment(value = '') {
  return normalizeText(value).toUpperCase();
}

function normalizeEmail(value = '') {
  return normalizeText(value).toLowerCase();
}

module.exports = {
  ALLOWED_GRADES,
  CATEGORY_BY_GRADE,
  getGradeFromCategory,
  getCategoryFromGrade,
  getRoleFromGrade,
  normalizeCategory,
  normalizeDepartment,
  normalizeEmail,
  normalizeText,
};
