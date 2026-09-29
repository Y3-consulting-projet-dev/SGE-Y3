const Evaluation = require('../src/models/EvaluationInstance');

let compteur = 0;

async function creerEvaluation(champs = {}) {
  compteur += 1;
  return Evaluation.create({
    cycle_label: '2023-2024',
    evalue_id: `evalue${compteur}`,
    status: 'En cours',
    template_type: 'assistant-self-evaluation',
    submitted_to_role: 'admin',
    submitted_to_user_ids: [],
    submitted_to_names: [],
    submitted_to_managers: [],
    mission_evaluations: [],
    chief_comments: [],
    development_wishes: '',
    developement_training_requests: [],
    development_status: 'Brouillon',
    development_submitted_at: null,
    development_submitted_to_user_id: null,
    development_submitted_to_name: '',
    development_training_decision: '',
    developement_training_manager_comment: '',
    development_training_decision_at: null,
    section: [],
    rh_validation_selected: false,
    rh_validation_selected_at: null,
    rh_validated_at: null,
    peer_review_comment: '',
    peer_review_sections: [],
    peer_review_comment_by_user_id: null,
    peer_review_comment_by_name: '',
    peer_review_saved_at: null,
    submitted_at: null,
    last_saved_at: null,
    ...champs,   // tout ce qu'on passe ici écrase les valeurs par défaut
  });
}

module.exports = { creerEvaluation };