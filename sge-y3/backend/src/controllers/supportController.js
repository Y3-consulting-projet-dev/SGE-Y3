const User = require('../models/User');
const EvaluationInstance = require('../models/EvaluationInstance');
const { buildEvaluationTemplateForUser } = require('../utils/competencyMatrix');
const {
  getEvaluationSummary,
  getOverallAverageScore,
  normalizeSections,
  validateSectionCommentsForSubmit,
  validateSectionsForSubmit,
} = require('../utils/evaluationHelpers');
const { getCurrentCycleLabel } = require('../utils/activeCycle');
const { buildCyclesForInstances, buildPeerReviewComments } = require('../utils/evaluationHistory');

function toPersistenceSections(sections = []) {
  return sections.map((section) => ({
    section_id: section.id || section.section_id,
    title: section.title,
    subtitle: section.subtitle || section.title,
    status: section.status || 'A faire',
    comment: section.comment || '',
    pages: (section.pages || []).map((page) => ({
      page_id: page.page_id,
      title: page.title,
      source_sheet: page.source_sheet || '',
      source_label: page.source_label || '',
      comment: page.comment || '',
      is_custom: Boolean(page.is_custom || page.isCustom),
      themes: (page.themes || []).map((theme) => ({
        theme_id: theme.theme_id,
        code: theme.code,
        label: theme.label,
        statement: theme.statement,
        score: theme.score,
        required: theme.required !== false,
        is_custom: Boolean(theme.is_custom || theme.isCustom),
      })),
    })),
    criteria: (section.criteria || []).map((criterion) => ({
      criterion_id: criterion.criterion_id || '',
      label: criterion.label,
      statement: criterion.statement || '',
      page_id: criterion.page_id || '',
      page_title: criterion.page_title || '',
      source_sheet: criterion.source_sheet || '',
      source_label: criterion.source_label || '',
      theme_code: criterion.theme_code || '',
      score: criterion.score,
      required: criterion.required !== false,
    })),
  }));
}

function cloneSupportSections(user) {
  return buildEvaluationTemplateForUser(user).map((section) => ({
    ...section,
    pages: (section.pages || []).map((page) => ({
      ...page,
      themes: (page.themes || []).map((theme) => ({ ...theme })),
    })),
    criteria: (section.criteria || []).map((criterion) => ({ ...criterion })),
  }));
}

function getPageMatchKey(page = {}) {
  return `${String(page.source_sheet || '').trim()}::${String(page.title || '').trim()}`;
}

function getThemeMatchKey(page = {}, theme = {}) {
  return `${getPageMatchKey(page)}::${String(theme.code || '').trim()}::${String(theme.label || '').trim()}`;
}

function mergeSectionsWithTemplate(savedSections = [], templateSections = []) {
  const normalizedSavedSections = normalizeSections(savedSections || []);
  const savedSectionByTitle = new Map(normalizedSavedSections.map((section) => [section.title, section]));
  const savedPageByKey = new Map();
  const savedThemeByKey = new Map();

  normalizedSavedSections.forEach((section) => {
    (section.pages || []).forEach((page) => {
      savedPageByKey.set(getPageMatchKey(page), page);
      (page.themes || []).forEach((theme) => {
        savedThemeByKey.set(getThemeMatchKey(page, theme), theme);
      });
    });
  });

  return templateSections.map((templateSection) => {
    const savedSection = savedSectionByTitle.get(templateSection.title);
    const templatePageKeys = new Set((templateSection.pages || []).map((page) => getPageMatchKey(page)));
    const customPages = (savedSection?.pages || []).filter(
      (page) => page.is_custom && !templatePageKeys.has(getPageMatchKey(page))
    );

    return {
      ...templateSection,
      comment: savedSection?.comment || templateSection.comment || '',
      pages: [
        ...(templateSection.pages || []).map((templatePage) => {
          const savedPage = savedPageByKey.get(getPageMatchKey(templatePage));
          const templateThemeKeys = new Set(
            (templatePage.themes || []).map((theme) => getThemeMatchKey(templatePage, theme))
          );
          const customThemes = (savedPage?.themes || []).filter(
            (theme) => theme.is_custom && !templateThemeKeys.has(getThemeMatchKey(templatePage, theme))
          );

          return {
            ...templatePage,
            comment: savedPage?.comment || templatePage.comment || '',
            themes: [
              ...(templatePage.themes || []).map((templateTheme) => {
                const savedTheme = savedThemeByKey.get(getThemeMatchKey(templatePage, templateTheme));

                return {
                  ...templateTheme,
                  score: typeof savedTheme?.score === 'number' ? savedTheme.score : templateTheme.score,
                };
              }),
              ...customThemes,
            ],
          };
        }),
        ...customPages,
      ],
    };
  });
}

async function resolveAssociates() {
  return User.find({
    is_active: true,
    $or: [{ code_categorie: '11' }, { grade: 'Associé' }, { grade: 'Associe' }],
  }).select('_id name grade department email');
}

async function resolveCommentTargetsForSupport(user) {
  const userIdStr = String(user._id);
  const all = await User.find({ is_active: true })
    .sort({ last_name: 1, first_name: 1 })
    .select('_id name first_name last_name grade department code_categorie');
  return all
    .filter((u) => String(u._id) !== userIdStr)
    .map((u) => ({
      id: u._id.toString(),
      name: u.name,
      first_name: u.first_name,
      last_name: u.last_name,
      grade: u.grade,
      department: u.department,
      code_categorie: u.code_categorie,
    }));
}

function normalizeChiefComments(items = []) {
  return items
    .map((item) => ({
      target_user_id: item.target_user_id || item.targetUserId || null,
      target_name: String(item.target_name || item.targetName || '').trim(),
      target_grade: String(item.target_grade || item.targetGrade || '').trim(),
      target_department: String(item.target_department || item.targetDepartment || '').trim(),
      comment: String(item.comment || '').trim(),
      submitted_at: item.submitted_at || item.submittedAt || null,
    }))
    .filter((item) => item.target_name);
}

function formatChiefComments(items = []) {
  return normalizeChiefComments(items).map((item) => ({
    targetUserId: item.target_user_id ? String(item.target_user_id) : '',
    targetName: item.target_name,
    targetGrade: item.target_grade,
    targetDepartment: item.target_department,
    comment: item.comment,
    submittedAt: item.submitted_at || null,
  }));
}

async function getOrCreateSupportSelfEvaluation(user) {
  let instance = await EvaluationInstance.findOne({
    cycle_label: getCurrentCycleLabel(),
    evalue_id: user._id,
    template_type: 'support-self-evaluation',
  });

  const templateSections = cloneSupportSections(user);

  if (!instance) {
    instance = await EvaluationInstance.create({
      cycle_label: getCurrentCycleLabel(),
      evalue_id: user._id,
      status: 'En cours',
      template_type: 'support-self-evaluation',
      submitted_to_role: 'associate',
      sections: toPersistenceSections(templateSections),
      last_saved_at: new Date(),
    });
  } else {
    const syncedSections = mergeSectionsWithTemplate(instance.sections || [], templateSections);
    instance.sections = toPersistenceSections(normalizeSections(syncedSections));
    instance.last_saved_at = new Date();
    await instance.save();
  }

  return instance;
}

function formatAssociate(recipient) {
  return {
    id: recipient._id.toString(),
    name: recipient.name,
    grade: recipient.grade,
    department: recipient.department,
    email: recipient.email,
  };
}

function buildSupportSelfPayload(instance, user, recipients = [], commentTargets = []) {
  const sections = normalizeSections(instance.sections || []);
  const submittedToIds = new Set((instance.submitted_to_user_ids || []).map((id) => String(id)));
  const submittedToRecipients =
    instance.status === 'Soumis aux Associes'
      ? recipients.filter((recipient) => submittedToIds.has(String(recipient._id)))
      : [];

  return {
    cycle_label: getCurrentCycleLabel(),
    evaluation: {
      id: instance._id.toString(),
      status: instance.status,
      submitted_at: instance.submitted_at,
      last_saved_at: instance.last_saved_at,
      sections,
      submitted_to: submittedToRecipients.map(formatAssociate),
      available_associates: recipients.map(formatAssociate),
    },
    summary: {
      ...getEvaluationSummary(sections),
      overallAverage: getOverallAverageScore(sections),
    },
    support: {
      id: user._id.toString(),
      name: user.name,
      first_name: user.first_name,
      last_name: user.last_name,
      grade: user.grade,
      department: user.department,
      email: user.email,
      comment_targets: commentTargets,
    },
    chief_comments: formatChiefComments(instance.chief_comments || []),
  };
}

module.exports = {
  async getSupportSelfEvaluation(request, response) {
    const [instance, recipients, commentTargets] = await Promise.all([
      getOrCreateSupportSelfEvaluation(request.user),
      resolveAssociates(),
      resolveCommentTargetsForSupport(request.user),
    ]);

    return response.json(buildSupportSelfPayload(instance, request.user, recipients, commentTargets));
  },

  async saveSupportSelfEvaluation(request, response) {
    const [instance, recipients, commentTargets] = await Promise.all([
      getOrCreateSupportSelfEvaluation(request.user),
      resolveAssociates(),
      resolveCommentTargetsForSupport(request.user),
    ]);

    const rawSections = Array.isArray(request.body?.sections) ? request.body.sections : [];
    if (rawSections.length) {
      const sections = normalizeSections(rawSections);

      for (const section of sections) {
        for (const page of section.pages || []) {
          for (const theme of page.themes || []) {
            if ((theme.is_custom || page.is_custom) && !theme.label) {
              return response.status(400).json({
                message: 'Le libellé de la compétence ajoutée est requis.',
              });
            }
          }
        }
      }

      instance.sections = toPersistenceSections(sections);
    }

    instance.status = instance.status === 'Soumis aux Associes' ? instance.status : 'En cours';
    instance.last_saved_at = new Date();
    await instance.save();

    return response.json({
      message: 'Auto-évaluation support enregistrée.',
      ...buildSupportSelfPayload(instance, request.user, recipients, commentTargets),
    });
  },

  async saveSupportChiefComments(request, response) {
    const rawItems = Array.isArray(request.body?.chiefComments) ? request.body.chiefComments : [];
    const instance = await getOrCreateSupportSelfEvaluation(request.user);
    instance.chief_comments = normalizeChiefComments(rawItems);
    instance.last_saved_at = new Date();
    await instance.save();
    return response.json({
      message: 'Commentaires enregistrés.',
      chief_comments: formatChiefComments(instance.chief_comments),
    });
  },

  async getReceivedSupportChiefComments(request, response) {
    const userId = String(request.user._id);
    const instances = await EvaluationInstance.find({
      cycle_label: CURRENT_CYCLE_LABEL,
      'chief_comments.target_user_id': request.user._id,
    }).select('chief_comments');

    const received = [];
    for (const instance of instances) {
      for (const comment of instance.chief_comments || []) {
        if (
          String(comment.target_user_id) === userId &&
          comment.submitted_at &&
          String(comment.comment || '').trim()
        ) {
          received.push({
            comment: String(comment.comment).trim(),
            submittedAt: comment.submitted_at,
          });
        }
      }
    }

    received.sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));
    return response.json({ received });
  },

  async submitSupportSelfEvaluation(request, response) {
    const [instance, recipients] = await Promise.all([
      getOrCreateSupportSelfEvaluation(request.user),
      resolveAssociates(),
    ]);

    if (!recipients.length) {
      return response.status(400).json({ message: "Aucun associé destinataire n'est disponible." });
    }

    const selectedAssociateIds = Array.isArray(request.body?.selectedAssociateIds)
      ? request.body.selectedAssociateIds.map((id) => String(id || '').trim()).filter(Boolean)
      : [];

    if (!selectedAssociateIds.length) {
      return response.status(400).json({
        message: "Sélectionnez au moins un associé destinataire avant de soumettre.",
      });
    }

    const selectedRecipients = recipients.filter((recipient) =>
      selectedAssociateIds.includes(String(recipient._id))
    );

    if (!selectedRecipients.length) {
      return response.status(400).json({ message: "Les associés sélectionnés sont introuvables." });
    }

    const sections = normalizeSections(instance.sections || []);
    const missingAnswers = validateSectionsForSubmit(sections);
    if (missingAnswers.length) {
      return response.status(400).json({
        message: 'Toutes les questions doivent être renseignées avant la soumission.',
        missingAnswers,
      });
    }

    const missingSectionComments = validateSectionCommentsForSubmit(sections, 3);
    if (missingSectionComments.length) {
      return response.status(400).json({
        message: "Un commentaire d'au moins 3 caractères est obligatoire pour chaque section avant la soumission.",
        missingSectionComments,
      });
    }

    instance.submitted_to_role = 'associate';
    instance.submitted_to_user_ids = selectedRecipients.map((recipient) => recipient._id);
    instance.submitted_to_names = selectedRecipients.map((recipient) => recipient.name);
    instance.status = 'Soumis aux Associes';
    instance.submitted_at = new Date();
    instance.last_saved_at = new Date();
    await instance.save();

    return response.json({
      message: `Auto-évaluation support soumise à ${selectedRecipients.map((recipient) => recipient.name).join(', ')}.`,
      ...buildSupportSelfPayload(instance, request.user, recipients),
    });
  },

  async getMySupportEvaluationHistory(request, response) {
    const instances = await EvaluationInstance.find({
      evalue_id: request.user._id,
      template_type: 'support-self-evaluation',
      cycle_label: { $ne: getCurrentCycleLabel() },
    }).sort({ cycle_label: -1 });

    const cycles = await buildCyclesForInstances(instances, 'sections', (_cycleLabel, instance) =>
      Promise.resolve(buildPeerReviewComments(instance))
    );

    return response.json({ cycles });
  },
};
