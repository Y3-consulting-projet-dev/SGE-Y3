const { buildEvaluationTemplateForUser } = require('./competencyMatrix');

function cloneSeniorEvaluationTemplate(user = {}) {
  return buildEvaluationTemplateForUser(user).map((section) => ({
    ...section,
    pages: section.pages.map((page) => ({
      ...page,
      themes: page.themes.map((theme) => ({ ...theme })),
    })),
    criteria: section.criteria.map((criterion) => ({ ...criterion })),
  }));
}

module.exports = {
  cloneSeniorEvaluationTemplate,
};
