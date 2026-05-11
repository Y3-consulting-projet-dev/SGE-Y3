const matrixData = require('../data/competencyMatrix.generated.json');
const { normalizeDepartment, normalizeText } = require('./userMapping');

const SECTION_ORDER = ['SAVOIR FAIRE', 'SAVOIR ETRE'];

function getGradeColumnKey(grade = '') {
  const normalizedGrade = normalizeText(grade);

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

  return ['TRONC COMMUN'];
}

function getStatementForGrade(statements = {}, gradeColumnKey) {
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

  return sheetName;
}

function buildEvaluationTemplateForUser(user = {}) {
  const gradeColumnKey = getGradeColumnKey(user.grade);
  const sheetNames = getSheetNamesForDepartment(user.department);

  const sectionsMap = new Map(
    SECTION_ORDER.map((sectionKey, index) => [
      sectionKey,
      {
        id: index + 1,
        title: sectionKey,
        subtitle: sectionKey,
        status: 'A faire',
        comment: '',
        pages: [],
        criteria: [],
      },
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
        const pageThemes = page.themes
          .map((theme, themeIndex) => {
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
          })
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
      });
    });
  });

  return SECTION_ORDER.map((sectionKey) => {
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
