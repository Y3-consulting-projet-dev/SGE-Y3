const ASSISTANT_EVALUATION_TEMPLATE = [
  {
    id: 1,
    title: 'Section 1',
    subtitle: 'Savoir-etre',
    status: 'A faire',
    comment: '',
    criteria: [
      { label: 'Ponctualité & fiabilité', score: null, required: true },
      { label: 'Travail en équipe', score: null, required: true },
      { label: 'Communication', score: null, required: true },
      { label: 'Adaptabilité', score: null, required: true },
    ],
  },
  {
    id: 2,
    title: 'Section 2',
    subtitle: 'Compétences tech.',
    status: 'En cours',
    comment: '',
    criteria: [
      { label: 'Maitrise des outils comptables (CEGID, Sage)', score: null, required: true },
      { label: 'Rédaction des rapports d\'audit', score: null, required: true },
      { label: 'Analyse et interprètation des données financières', score: null, required: true },
    ],
  },
  {
    id: 3,
    title: 'Section 3',
    subtitle: 'Objectifs atteints',
    status: 'A faire',
    comment: '',
    criteria: [
      { label: 'Respect des objectifs fixés en début de cycle', score: null, required: true },
      { label: 'Contribution aux livrables de mission', score: null, required: true },
      { label: 'Qualité des résultats obtenus', score: null, required: true },
    ],
  },
  {
    id: 4,
    title: 'Section 4',
    subtitle: 'Evolution souhaitée',
    status: 'A faire',
    comment: '',
    criteria: [
      { label: 'Compétences à développer', score: null, required: true },
      { label: 'Projection professionnelle', score: null, required: true },
      { label: 'Besoins de formation', score: null, required: true },
    ],
  },
];

function cloneAssistantEvaluationTemplate() {
  return ASSISTANT_EVALUATION_TEMPLATE.map((section) => ({
    ...section,
    criteria: section.criteria.map((criterion) => ({ ...criterion })),
  }));
}

module.exports = {
  cloneAssistantEvaluationTemplate,
};
