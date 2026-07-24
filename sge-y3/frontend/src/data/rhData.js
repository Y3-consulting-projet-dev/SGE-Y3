import { BarChart3, CalendarRange, ClipboardCheck, ClipboardList, FileText, History, LayoutDashboard, MessageSquare, Scale, Settings2, Table2, UsersRound } from "lucide-react";

export const rhMenuGroups = [
  {
    title: "Tableau de bord",
    items: [{ key: "overview", label: "Vue RH", icon: LayoutDashboard }],
  },
  {
    title: "Évaluation",
    items: [
      { key: "validations", label: "Validations RH", icon: ClipboardCheck },
      { key: "self-evaluation-rh", label: "Mon auto-évaluation", icon: ClipboardList },
      { key: "history", label: "Mon historique", icon: History },
      { key: "questionnaire", label: "Sections & questions", icon: ClipboardList },
      { key: "syntheses", label: "Synthèses à transmettre", icon: FileText },
      { key: "calibration", label: "Calibration", icon: Scale },
    ],
  },
  {
    title: "Suivi cabinet",
    items: [
      { key: "department-evaluations", label: "Évaluations par département", icon: Table2 },
      { key: "population", label: "Équipe", icon: UsersRound },
      { key: "team-history", label: "Historique collaborateurs", icon: History },
      { key: "reports", label: "Rapports", icon: BarChart3 },
    ],
  },
  {
    title: "Comite",
    items: [{ key: "committee", label: "Comité d'évaluation", icon: UsersRound }],
  },
  {
    title: "Administration",
    items: [
      { key: "collaborators", label: "Gestion des collaborateurs", icon: UsersRound },
      { key: "cycles", label: "Gestion des cycles", icon: CalendarRange },
    ],
  },
  {
    title: "Commentaires",
    items: [{ key: "received-comments", label: "Commentaires anonymes", icon: MessageSquare }],
  },
  {
    title: "Compte",
    items: [{ key: "profile", label: "Profil", icon: Settings2 }],
  },
];

export const rhStats = [
  { title: "Évaluations reçues", value: "18/24", subtitle: "75% du Cycle 2025-2026" },
  { title: "À valider RH", value: "6", subtitle: "Dont 2 prioritaires" },
  { title: "Synthèses prêtes", value: "11", subtitle: "Transmission Associé" },
  { title: "Entretiens planifiés", value: "9", subtitle: "Cette semaine" },
];

export const initialQuestionSections = [
  {
    id: "leadership",
    title: "Leadership & management",
    audience: "Managers",
    questions: [
      "Anime l'équipe avec clarté et disponibilité.",
      "Prend des décisions adaptées aux priorités du cabinet.",
    ],
  },
  {
    id: "technical",
    title: "Compétences techniques",
    audience: "Tous collaborateurs",
    questions: [
      "Maîtrise les méthodologies et livrables attendus.",
      "Produit des analyses fiables et exploitables.",
    ],
  },
  {
    id: "performance",
    title: "Pilotage & performance",
    audience: "Managers et Seniors",
    questions: [
      "Suit les objectifs dans les délais convenus.",
      "Alerte rapidement en cas de risque ou de blocage.",
    ],
  },
];

export const validationRows = [
  {
    name: "Amelie Kouadio",
    role: "Collaboratrice audit",
    manager: "Diallo S.",
    score: "3.8",
    status: "À valider",
    priority: "Normal",
    nextAction: "Vérifier les commentaires manager",
  },
  {
    name: "Habib Bah",
    role: "Assistant audit",
    manager: "Diallo S.",
    score: "3.2",
    status: "Écart à arbitrer",
    priority: "Prioritaire",
    nextAction: "Analyser l'écart auto-éval / senior",
  },
  {
    name: "Revita Oule",
    role: "Manager",
    manager: "Yves Dodo",
    score: "4.1",
    status: "Prêt Associé",
    priority: "Normal",
    nextAction: "Transmettre la synthèse",
  },
  {
    name: "Kader Kone",
    role: "Assistant comptable",
    manager: "Diallo S.",
    score: "2.9",
    status: "À compléter",
    priority: "Prioritaire",
    nextAction: "Demander des faits observables",
  },
];

export const syntheseRows = [
  {
    collaborator: "Revita Oule",
    role: "Manager",
    score: "4.1",
    recommendation: "Promotion Manager Senior",
    decisionOwner: "Associé",
  },
  {
    collaborator: "Axelle Amani",
    role: "Manager",
    score: "4.0",
    recommendation: "Augmentation +6%",
    decisionOwner: "Associé",
  },
  {
    collaborator: "Amelie Kouadio",
    role: "Collaboratrice audit",
    score: "3.8",
    recommendation: "Maintien avec objectifs",
    decisionOwner: "Manager",
  },
];

export const calibrationRows = [
  { department: "Audit", average: "4.2", evaluated: "8/10", risk: "Tendance haute", width: "84%" },
  { department: "Expertise comptable", average: "3.9", evaluated: "5/6", risk: "Stable", width: "73%" },
  { department: "Conseil financier", average: "3.5", evaluated: "3/5", risk: "À harmoniser", width: "60%" },
  { department: "Conseil opérationnel", average: "3.0", evaluated: "2/3", risk: "Sous-documentation", width: "44%" },
];

export const departmentEvaluationGroups = [
  {
    department: "Audit",
    manager: "Diallo S.",
    average: "4.2",
    completed: "8/10",
    teams: [
      {
        name: "Équipe Audit",
        lead: "Revita Oule",
        members: [
          { name: "Amelie Kouadio", role: "Collaboratrice audit", evaluator: "Diallo S.", selfScore: "4.0", managerScore: "3.8", finalScore: "3.8", status: "À valider RH" },
          { name: "Habib Bah", role: "Assistant audit", evaluator: "Yasmine Kouame", selfScore: "4.0", managerScore: "3.2", finalScore: "3.2", status: "Écart à arbitrer" },
          { name: "Orlane Kone", role: "Assistante audit", evaluator: "Yasmine Kouame", selfScore: "3.5", managerScore: "3.6", finalScore: "3.6", status: "Validé RH" },
          { name: "Louise Yao", role: "Collaboratrice audit", evaluator: "Axelle Amani", selfScore: "4.1", managerScore: "4.0", finalScore: "4.0", status: "Prêt Associé" },
          { name: "Moussa Traore", role: "Assistant audit", evaluator: "Axelle Amani", selfScore: "3.7", managerScore: "3.9", finalScore: "3.9", status: "Validé RH" },
        ],
      },
    ],
  },
  {
    department: "Expertise comptable",
    manager: "Nadia Kouassi",
    average: "3.9",
    completed: "5/6",
    teams: [
      {
        name: "Équipe Révision",
        lead: "Nadia Kouassi",
        members: [
          { name: "Kader Kone", role: "Assistant comptable", evaluator: "Nadia Kouassi", selfScore: "3.4", managerScore: "2.9", finalScore: "2.9", status: "À compléter" },
          { name: "Fatou Diarra", role: "Collaboratrice comptable", evaluator: "Nadia Kouassi", selfScore: "4.0", managerScore: "4.1", finalScore: "4.1", status: "Validé RH" },
        ],
      },
    ],
  },
  {
    department: "Conseil Financier",
    manager: "Ismael Bamba",
    average: "3.5",
    completed: "3/5",
    teams: [
      {
        name: "Équipe Transactions",
        lead: "Ismael Bamba",
        members: [
          { name: "Sarah Diomande", role: "Consultante junior", evaluator: "Ismael Bamba", selfScore: "3.8", managerScore: "3.5", finalScore: "3.5", status: "À valider RH" },
          { name: "Kevin Toure", role: "Analyste financier", evaluator: "Ismael Bamba", selfScore: "3.2", managerScore: "3.4", finalScore: "3.4", status: "Validé RH" },
        ],
      },
    ],
  },
  {
    department: "Conseil opérationnel",
    manager: "Awa Soro",
    average: "3.0",
    completed: "2/3",
    teams: [
      {
        name: "Équipe Organisation",
        lead: "Awa Soro",
        members: [
          { name: "Jean Kouame", role: "Consultant opérationnel", evaluator: "Awa Soro", selfScore: "3.1", managerScore: "3.0", finalScore: "3.0", status: "Sous revue RH" },
          { name: "Mireille Nguessan", role: "Consultante junior", evaluator: "Awa Soro", selfScore: "2.8", managerScore: "3.0", finalScore: "3.0", status: "Validé RH" },
        ],
      },
    ],
  },
];

export const populationRows = [
  { group: "Managers", total: 4, completed: 4, missing: 0 },
  { group: "Seniors", total: 6, completed: 5, missing: 1 },
  { group: "Collaborateurs", total: 9, completed: 6, missing: 3 },
  { group: "Assistants", total: 5, completed: 3, missing: 2 },
];

export const reportRows = [
  { title: "Synthèse Cycle 2025-2026", format: "PDF", owner: "RH", status: "Prêt" },
  { title: "Export des évaluations validées", format: "XLSX", owner: "RH", status: "À générer" },
  { title: "Suivi des décisions Associé", format: "PDF", owner: "Associé", status: "En attente" },
];
