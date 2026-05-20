function getSectionCriteria(section = {}) {
  if (Array.isArray(section.criteria) && section.criteria.length) {
    return section.criteria;
  }

  return (section.pages || []).flatMap((page) =>
    (page.themes || []).map((theme) => ({
      criterion_id: theme.theme_id || '',
      label: `${theme.code}. ${theme.label}`,
      statement: theme.statement || '',
      page_id: page.page_id || '',
      page_title: page.title || '',
      theme_code: theme.code || '',
      score: theme.score === null || theme.score === undefined ? null : Number(theme.score),
      required: theme.required !== false,
    }))
  );
}

function getSectionProgress(section) {
  const criteria = getSectionCriteria(section);
  const total = criteria.length;
  const answered = criteria.filter((criterion) => criterion.score !== null && criterion.score !== undefined).length;

  if (!total) {
    return 0;
  }

  return Math.round((answered / total) * 100);
}

function getSectionStatus(section) {
  const progress = getSectionProgress(section);

  if (progress === 0) {
    return 'A faire';
  }

  if (progress === 100) {
    return 'Complete';
  }

  return 'En cours';
}

function getAverageScore(section) {
  return getAverageFromScores(getSectionCriteria(section).map((criterion) => criterion.score));
}

function getOverallAverageScore(sections = []) {
  return getAverageFromScores(sections.flatMap((section) => getSectionCriteria(section).map((criterion) => criterion.score)));
}

function getAverageFromScores(scores = []) {
  const numericScores = scores.filter((score) => typeof score === 'number');

  if (!numericScores.length) {
    return null;
  }

  return Number((numericScores.reduce((total, score) => total + score, 0) / numericScores.length).toFixed(1));
}

function normalizeSections(sections = []) {
  return sections.map((section) => {
    const normalizedPages = (section.pages || []).map((page) => ({
      page_id: String(page.page_id || ''),
      title: String(page.title || ''),
      source_sheet: String(page.source_sheet || ''),
      source_label: String(page.source_label || ''),
      comment: String(page.comment || ''),
      themes: (page.themes || []).map((theme) => ({
        theme_id: String(theme.theme_id || ''),
        code: String(theme.code || ''),
        label: String(theme.label || ''),
        statement: String(theme.statement || ''),
        score: theme.score === null || theme.score === undefined ? null : Number(theme.score),
        required: theme.required !== false,
      })),
    }));

    const normalizedCriteria = normalizedPages.length
      ? normalizedPages.flatMap((page) =>
          page.themes.map((theme) => ({
            criterion_id: theme.theme_id,
            label: `${theme.code}. ${theme.label}`,
            statement: theme.statement,
            page_id: page.page_id,
            page_title: page.title,
            source_sheet: page.source_sheet,
            source_label: page.source_label,
            theme_code: theme.code,
            score: theme.score,
            required: theme.required,
          }))
        )
      : (section.criteria || []).map((criterion) => ({
          criterion_id: String(criterion.criterion_id || ''),
          label: String(criterion.label || ''),
          statement: String(criterion.statement || ''),
          page_id: String(criterion.page_id || ''),
          page_title: String(criterion.page_title || ''),
          source_sheet: String(criterion.source_sheet || ''),
          source_label: String(criterion.source_label || ''),
          theme_code: String(criterion.theme_code || ''),
          score: criterion.score === null || criterion.score === undefined ? null : Number(criterion.score),
          required: criterion.required !== false,
        }));

    const normalizedSection = {
      id: Number(section.id ?? section.section_id),
      section_id: Number(section.section_id ?? section.id),
      title: String(section.title || ''),
      subtitle: String(section.subtitle || ''),
      comment: String(section.comment || ''),
      pages: normalizedPages,
      criteria: normalizedCriteria,
    };

    return {
      ...normalizedSection,
      status: getSectionStatus(normalizedSection),
    };
  });
}

function getEvaluationSummary(sections = []) {
  const completedSections = sections.filter((section) => getSectionStatus(section) === 'Complete').length;
  const globalProgress = sections.length
    ? Math.round(sections.reduce((total, section) => total + getSectionProgress(section), 0) / sections.length)
    : 0;

  return {
    completedSections,
    totalSections: sections.length,
    globalProgress,
  };
}

function validateSectionsForSubmit(sections = []) {
  const missingAnswers = [];

  sections.forEach((section) => {
    getSectionCriteria(section).forEach((criterion) => {
      if (criterion.required && (criterion.score === null || criterion.score === undefined)) {
        missingAnswers.push({
          sectionId: section.id,
          sectionTitle: section.title,
          pageTitle: criterion.page_title,
          label: criterion.label,
        });
      }
    });
  });

  return missingAnswers;
}

function validateFinalCommentForSubmit(sections = [], minimumLength = 3) {
  const normalizedMinimumLength = Math.max(Number(minimumLength) || 0, 1);
  const comments = sections.map((section) => String(section.comment || '').trim());

  return comments.some((comment) => comment.length >= normalizedMinimumLength);
}

function validateSectionCommentsForSubmit(sections = [], minimumLength = 3) {
  const normalizedMinimumLength = Math.max(Number(minimumLength) || 0, 1);

  return sections
    .filter((section) => String(section.comment || '').trim().length < normalizedMinimumLength)
    .map((section) => ({
      sectionId: section.id,
      sectionTitle: section.title,
    }));
}

module.exports = {
  getAverageFromScores,
  getAverageScore,
  getEvaluationSummary,
  getOverallAverageScore,
  getSectionCriteria,
  getSectionProgress,
  getSectionStatus,
  normalizeSections,
  validateFinalCommentForSubmit,
  validateSectionCommentsForSubmit,
  validateSectionsForSubmit,
};
