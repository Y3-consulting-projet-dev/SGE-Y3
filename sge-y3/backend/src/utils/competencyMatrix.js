const matrixData = require('../data/competencyMatrix.generated.json');
const { normalizeDepartment, normalizeEmail, normalizeText } = require('./userMapping');
const { readQuestionnaireConfig } = require('./questionnaireConfig');

const SECTION_ORDER = ['SAVOIR FAIRE', 'SAVOIR ETRE'];
const SUPPORT_ROLE_BY_EMAIL = {
  'fleur.nguessan@ycubeac.com': 'Office Manager',
  'aziz.ouattara@ycubeac.com': 'PMO',
  'porthela.kakou@ycubeac.com': 'Responsable IT',
  'adele.creppy@ycubeac.com': 'Comptable Interne Senior',
};

function getSupportCommonGradeKey(user = {}, supportRoleKey = '') {
  const source = normalizeDepartment(`${user.grade || ''} ${user.code_categorie || ''}`);

  if (source.includes('SENIOR') || source.includes('9A')) {
    return 'Senior';
  }

  if (source.includes('ASSISTANT MANAGER') || source.includes('MANAGER') || source.includes('10')) {
    return 'Manager';
  }

  if (source.includes('ASSISTANT') || source.includes('8')) {
    return 'Assistant';
  }

  if (source.includes('ASSOCIE') || source.includes('ASSOCI') || source.includes('11')) {
    return 'AssociÃ©';
  }

  return normalizeDepartment(supportRoleKey).includes('COMPTABLE INTERNE SENIOR') ? 'Senior' : 'Manager';
}

function getGradeColumnKey(grade = '') {
  const normalizedGrade = normalizeText(grade);

  if (['Office Manager', 'PMO', 'Comptable Interne Senior', 'Comptabilité interne senior', 'Responsable IT'].includes(normalizedGrade)) {
    return normalizedGrade;
  }

  if (normalizedGrade === 'Assistant') {
    return 'Assistant';
  }

  if (normalizedGrade === 'Senior') {
    return 'Senior';
  }

  if (
    normalizedGrade === 'Assistant manager' ||
    normalizedGrade === 'Manager' ||
    normalizedGrade === 'Senior manager'
  ) {
    return 'Manager';
  }

  return 'Associé';
}

function getSheetNamesForDepartment(department = '') {
  const normalized = normalizeDepartment(department);

  if (normalized === 'AUDIT') {
    return ['TRONC COMMUN', 'AUDIT'];
  }

  if (normalized === 'EXPERTISE COMPTABLE') {
    return ['TRONC COMMUN', 'EXPERTISE COMPTABLE'];
  }

  if (normalized === 'AUDIT & EXPERTISE COMPTABLE') {
    return ['TRONC COMMUN', 'AUDIT', 'EXPERTISE COMPTABLE'];
  }

  if (normalized === 'CONSEIL FINANCIER') {
    return ['TRONC COMMUN', 'CONSEIL FINANCIER'];
  }

  if (normalized === 'CONSEIL OPERATIONNEL' || normalized === 'CONSULTING') {
    return ['TRONC COMMUN', 'CONSEIL OPERATIONNEL'];
  }

  if (normalized === 'RH' || normalized === 'CAPITAL HUMAIN') {
    return ['TRONC COMMUN', 'CAPITAL HUMAIN'];
  }

  if (normalized === 'SERVICE SUPPORT' || normalized === 'SUPPORT') {
    return ['TRONC COMMUN', 'SERVICE SUPPORT'];
  }

  return ['TRONC COMMUN'];
}

function getStatementForGrade(statements = {}, gradeColumnKey) {
  if (statements[gradeColumnKey]) {
    return statements[gradeColumnKey];
  }

  if (gradeColumnKey === 'Associé') {
    return statements['Associé'] || statements['Associ?'] || '';
  }

  return statements[gradeColumnKey] || '';
}

function getSourceLabel(sheetName) {
  if (sheetName === 'AUDIT') {
    return 'Audit';
  }

  if (sheetName === 'EXPERTISE COMPTABLE') {
    return 'Expertise comptable';
  }

  if (sheetName === 'SERVICE SUPPORT') {
    return 'Service support';
  }

  return sheetName;
}

function createSectionRecord(sectionKey, index, sectionTitle = sectionKey) {
  return {
    id: index + 1,
    title: sectionTitle,
    subtitle: sectionTitle,
    status: 'A faire',
    comment: '',
    pages: [],
    criteria: [],
  };
}

function ensureSection(sectionsMap, orderedSectionKeys, sectionKey, sectionTitle = sectionKey) {
  if (!sectionsMap.has(sectionKey)) {
    orderedSectionKeys.push(sectionKey);
    sectionsMap.set(sectionKey, createSectionRecord(sectionKey, orderedSectionKeys.length - 1, sectionTitle));
  }

  return sectionsMap.get(sectionKey);
}

function buildThemeRecord(targetSection, theme, themeIndex, gradeColumnKey) {
  const statement = getStatementForGrade(theme.statements, gradeColumnKey);

  if (!theme.label || !statement) {
    return null;
  }

  return {
    theme_id: `${targetSection.id}-${targetSection.pages.length + 1}-${themeIndex + 1}`,
    code: theme.code,
    label: theme.label,
    statement,
    score: null,
    required: true,
  };
}

function appendPageToSection(targetSection, page, sheetName, gradeColumnKey) {
  const pageThemes = (page.themes || [])
    .map((theme, themeIndex) => buildThemeRecord(targetSection, theme, themeIndex, gradeColumnKey))
    .filter(Boolean);

  if (!pageThemes.length) {
    return;
  }

  const pageId = `${targetSection.id}-${targetSection.pages.length + 1}`;
  targetSection.pages.push({
    page_id: pageId,
    title: page.title,
    source_sheet: sheetName,
    source_label: getSourceLabel(sheetName),
    comment: '',
    themes: pageThemes,
  });
}

function applyCustomQuestionnaire(sectionsMap, orderedSectionKeys, sheetNames, getGradeColumnKeyForSheet) {
  const config = readQuestionnaireConfig();

  (config.customPages || []).forEach((page) => {
    if (!sheetNames.includes(page.source_sheet)) {
      return;
    }

    const targetSection = ensureSection(
      sectionsMap,
      orderedSectionKeys,
      page.section_key,
      page.section_title || page.section_key
    );

    appendPageToSection(targetSection, page, page.source_sheet, getGradeColumnKeyForSheet(page.source_sheet));
  });

  (config.pageAdditions || []).forEach((addition) => {
    if (!sheetNames.includes(addition.source_sheet)) {
      return;
    }

    const targetSection = sectionsMap.get(addition.section_key);
    if (!targetSection) {
      return;
    }

    const targetPage = (targetSection.pages || []).find(
      (page) => page.source_sheet === addition.source_sheet && normalizeText(page.title) === normalizeText(addition.page_title)
    );

    if (!targetPage) {
      return;
    }

    const nextStartIndex = targetPage.themes.length;
    const additionThemes = (addition.themes || [])
      .map((theme, themeIndex) => {
        const statement = getStatementForGrade(theme.statements, getGradeColumnKeyForSheet(addition.source_sheet));

        if (!theme.label || !statement) {
          return null;
        }

        return {
          theme_id: `${targetPage.page_id}-${nextStartIndex + themeIndex + 1}`,
          code: theme.code,
          label: theme.label,
          statement,
          score: null,
          required: true,
        };
      })
      .filter(Boolean);

    if (additionThemes.length) {
      targetPage.themes = [...targetPage.themes, ...additionThemes];
    }
  });
}

function buildEvaluationTemplateForUser(user = {}) {
  const supportRoleKey = SUPPORT_ROLE_BY_EMAIL[normalizeEmail(user.email || '')];
  const gradeColumnKey = supportRoleKey || getGradeColumnKey(user.grade);
  const supportCommonGradeKey = getSupportCommonGradeKey(user, supportRoleKey);
  const sheetNames = supportRoleKey ? ['TRONC COMMUN', 'SERVICE SUPPORT'] : getSheetNamesForDepartment(user.department);
  const getGradeColumnKeyForSheet = (sheetName) =>
    supportRoleKey && sheetName === 'TRONC COMMUN' ? supportCommonGradeKey : gradeColumnKey;
  const orderedSectionKeys = [...SECTION_ORDER];

  const sectionsMap = new Map(
    orderedSectionKeys.map((sectionKey, index) => [
      sectionKey,
      createSectionRecord(sectionKey, index, sectionKey),
    ])
  );

  sheetNames.forEach((sheetName) => {
    const sheetSections = matrixData[sheetName] || [];

    sheetSections.forEach((section) => {
      const targetSection = sectionsMap.get(section.key);

      if (!targetSection) {
        return;
      }

      section.pages.forEach((page) => {
        appendPageToSection(targetSection, page, sheetName, getGradeColumnKeyForSheet(sheetName));
      });
    });
  });

  applyCustomQuestionnaire(sectionsMap, orderedSectionKeys, sheetNames, getGradeColumnKeyForSheet);

  return orderedSectionKeys.map((sectionKey) => {
    const section = sectionsMap.get(sectionKey);

    return {
      ...section,
      criteria: section.pages.flatMap((page) =>
        page.themes.map((theme) => ({
          criterion_id: theme.theme_id,
          label: `${theme.code}. ${theme.label}`,
          score: theme.score,
          required: theme.required,
          statement: theme.statement,
          page_id: page.page_id,
          page_title: page.title,
          theme_code: theme.code,
        }))
      ),
    };
  });
}

module.exports = {
  buildEvaluationTemplateForUser,
  getGradeColumnKey,
  getSheetNamesForDepartment,
};
