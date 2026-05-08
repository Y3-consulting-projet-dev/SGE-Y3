function getSectionProgress(section) {
  const total = section.criteria.length;
  const answered = section.criteria.filter((criterion) => criterion.score !== null && criterion.score !== undefined).length;

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
  const scores = section.criteria.map((criterion) => criterion.score).filter((score) => typeof score === 'number');

  if (!scores.length) {
    return null;
  }

  return Number((scores.reduce((total, score) => total + score, 0) / scores.length).toFixed(1));
}

function getOverallAverageScore(sections = []) {
  const scores = sections.flatMap((section) => section.criteria.map((criterion) => criterion.score)).filter((score) => typeof score === 'number');

  if (!scores.length) {
    return null;
  }

  return Number((scores.reduce((total, score) => total + score, 0) / scores.length).toFixed(1));
}

function normalizeSections(sections = []) {
  return sections.map((section) => {
    const normalizedCriteria = (section.criteria || []).map((criterion) => ({
      label: String(criterion.label || ''),
      score: criterion.score === null || criterion.score === undefined ? null : Number(criterion.score),
      required: criterion.required !== false,
    }));

    const normalizedSection = {
      id: Number(section.id ?? section.section_id),
      section_id: Number(section.section_id ?? section.id),
      title: String(section.title || ''),
      subtitle: String(section.subtitle || ''),
      comment: String(section.comment || ''),
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
    section.criteria.forEach((criterion) => {
      if (criterion.required && (criterion.score === null || criterion.score === undefined)) {
        missingAnswers.push({
          sectionId: section.id,
          sectionTitle: section.title,
          label: criterion.label,
        });
      }
    });
  });

  return missingAnswers;
}

module.exports = {
  getAverageScore,
  getEvaluationSummary,
  getOverallAverageScore,
  getSectionProgress,
  getSectionStatus,
  normalizeSections,
  validateSectionsForSubmit,
};
