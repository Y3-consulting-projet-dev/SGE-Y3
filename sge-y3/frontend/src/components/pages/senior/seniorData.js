import { BarChart3, CalendarDays, ClipboardCheck, FileText, LayoutDashboard, MessageSquare, Settings2, Target, Users } from "lucide-react";

export const menuGroups = [
  {
    title: "Tableau de bord",
    items: [
      { key: "overview", label: "Vue d'ensemble", icon: LayoutDashboard },
      { key: "comments", label: "Commentaires reçus", icon: MessageSquare },
    ],
  },
  {
    title: "Missions assistants",
    items: [
      { key: "assistants", label: "Mes assistants", icon: Users },
      { key: "goals", label: "Missions communes", icon: Target },
      { key: "reviews", label: "Evaluer par mission", icon: ClipboardCheck },
    ],
  },
  {
    title: "Suivi",
    items: [{ key: "results", label: "Synthèses transmises", icon: FileText }],
  },
  {
    title: "Mon évaluation",
    items: [
      { key: "self-evaluation", label: "Mon auto-évaluation", icon: BarChart3 },
      { key: "calendar", label: "Mon calendrier", icon: CalendarDays },
    ],
  },
  {
    title: "Compte",
    items: [{ key: "profile", label: "Profil", icon: Settings2 }],
  },
];

export const assistantRows = [
  {
    name: "Habib Bah",
    role: "Assistant audit",
    sharedMissions: "SUNU Assurances, Pharma CI",
    readyMissions: "2 / 2",
    evaluationStatus: "Avis a transmettre",
    nextAction: "Justifier l'ecart delais",
  },
  {
    name: "Kader Kone",
    role: "Assistant comptable",
    sharedMissions: "BTP Ivoire",
    readyMissions: "1 / 2",
    evaluationStatus: "En observation",
    nextAction: "Compléter la mission achats",
  },
  {
    name: "Orlane Kone",
    role: "Assistante audit",
    sharedMissions: "Pharma CI, Hotel Laguna",
    readyMissions: "1 / 2",
    evaluationStatus: "Brouillon",
    nextAction: "Ajouter faits observes",
  },
];

export const assistantEvaluations = [
  {
    name: "Habib Bah",
    initials: "HB",
    role: "Assistant audit",
    status: "Avis a transmettre",
    manager: "Diallo S.",
    interview: "24/04/2026",
    missions: [
      {
        title: "Audit des immobilisations - SUNU Assurances",
        period: "Janvier - Mars 2026",
        seniorRole: "Revue des travaux et supervision terrain",
        result: "Travaux finalises",
        context: "Mission realisee ensemble sur le controle des immobilisations et les tests de coherence.",
        facts: [
          "Dossier de travail repris après deux retours Senior.",
          "Pieces justificatives bien classees sur la derniere semaine.",
          "Retard constaté sur la transmission des tests de dépréciation.",
        ],
        criteria: [
          { label: "Preparation des tests demandes par le Senior", assistant: 4, senior: 4 },
          { label: "Qualite des feuilles de travail remises", assistant: 4, senior: 4 },
          { label: "Respect des délais convenus sur la mission", assistant: 4, senior: 2 },
          { label: "Prise en compte des corrections Senior", assistant: 3, senior: 4 },
        ],
      },
      {
        title: "Inventaire physique - Pharma CI",
        period: "Mars 2026",
        seniorRole: "Controle de coherence et validation des ecarts",
        result: "Ecarts documentes",
        context: "Mission courte realisee sur site avec le Senior pour verifier les stocks sensibles.",
        facts: [
          "Bonne presence terrain pendant les comptages.",
          "Ecarts signales rapidement au Senior.",
          "Compte rendu final clair et exploitable.",
        ],
        criteria: [
          { label: "Fiabilite des rapprochements inventaire", assistant: 3, senior: 3 },
          { label: "Communication des alertes au Senior", assistant: 3, senior: 4 },
          { label: "Autonomie pendant les comptages", assistant: 3, senior: 4 },
        ],
      },
    ],
  },
  {
    name: "Kader Kone",
    initials: "KK",
    role: "Assistant comptable",
    status: "En observation",
    manager: "Diallo S.",
    interview: "A planifier",
    missions: [
      {
        title: "Revision fournisseurs - BTP Ivoire",
        period: "Fevrier - Avril 2026",
        seniorRole: "Revue des cycles achats et fournisseurs",
        result: "En cours",
        context: "Mission partagee sur la revision des comptes fournisseurs et le classement des justificatifs.",
        facts: [
          "Classement des factures lance mais encore incomplet.",
          "Points bloquants remontes tardivement.",
          "Bonne compréhension des demandes après cadrage Senior.",
        ],
        criteria: [
          { label: "Classement des pieces justificatives", assistant: 3, senior: 3 },
          { label: "Analyse des comptes fournisseurs", assistant: 3, senior: 2 },
          { label: "Remontee des points bloquants", assistant: 2, senior: 2 },
        ],
      },
      {
        title: "Controle charges externes - BTP Ivoire",
        period: "Avril 2026",
        seniorRole: "Preparation de la revue analytique",
        result: "À compléter",
        context: "Travaux prepares avec le Senior avant validation du dossier de revision.",
        facts: [
          "Justificatifs encore manquants sur trois fournisseurs.",
          "Tableau de variation prepare mais a fiabiliser.",
        ],
        criteria: [
          { label: "Preparation des analyses demandees", assistant: 2, senior: 2 },
          { label: "Fiabilite des rapprochements", assistant: 3, senior: 2 },
          { label: "Respect des consignes Senior", assistant: 3, senior: 3 },
        ],
      },
    ],
  },
  {
    name: "Orlane Kone",
    initials: "OK",
    role: "Assistante audit",
    status: "Brouillon",
    manager: "Diallo S.",
    interview: "26/04/2026",
    missions: [
      {
        title: "Inventaire stocks - Hotel Laguna",
        period: "Mars 2026",
        seniorRole: "Encadrement terrain",
        result: "Travaux controles",
        context: "Mission realisee avec le Senior sur les zones cuisine, cave et economat.",
        facts: [
          "Bonne rigueur pendant les comptages.",
          "Besoin de mieux documenter les anomalies.",
          "Attitude professionnelle avec le client.",
        ],
        criteria: [
          { label: "Rigueur pendant les travaux terrain", assistant: 4, senior: 4 },
          { label: "Documentation des anomalies", assistant: 3, senior: 2 },
          { label: "Communication avec le Senior", assistant: 4, senior: 4 },
        ],
      },
    ],
  },
];

export const priorityActions = [
  { title: "Finaliser l'avis Senior - Habib Bah", subtitle: "Mission SUNU Assurances : ecart delais", target: "reviews" },
  { title: "Compléter l'observation - Kader Kone", subtitle: "Mission BTP Ivoire encore incomplète", target: "reviews" },
  { title: "Compléter mon auto-évaluation", subtitle: "Partie leadership Senior à 60%", target: "self-evaluation" },
];

export const seniorSelfEvaluation = {
  name: "Yasmine KOUAME",
  role: "Senior",
  cycle: "Cycle 2025-2026",
  status: "En cours",
  progress: 60,
  managerRecipient: "Diallo S.",
  sections: [
    {
      title: "Mes compétences techniques",
      status: "Complete",
      criteria: [
        { label: "Je maîtrise les dossiers qui me sont confiés", score: 4 },
        { label: "Je produis des revues fiables et exploitables", score: 4 },
        { label: "J'identifie les risques importants sur mes missions", score: 3 },
      ],
      comment: "J'ai progresse sur la revue des dossiers et l'identification des risques, avec un besoin de mieux anticiper certains points complexes.",
    },
    {
      title: "Mon organisation et mes resultats",
      status: "En cours",
      criteria: [
        { label: "Je respecte les delais de revue fixes avec le Manager", score: 3 },
        { label: "Je priorise correctement mes dossiers", score: 3 },
        { label: "Je transmets des synthèses claires au Manager", score: 4 },
      ],
      comment: "",
    },
    {
      title: "Mon comportement professionnel",
      status: "À compléter",
      criteria: [
        { label: "Je communique clairement avec l'équipe", score: null },
        { label: "Je demande de l'aide au bon moment", score: null },
        { label: "Je garde une posture professionnelle avec les clients", score: null },
      ],
      comment: "",
    },
    {
      title: "Mon développement",
      status: "À compléter",
      criteria: [
        { label: "Je développe mes compétences techniques", score: null },
        { label: "Je prends du recul sur mes axes d'amelioration", score: null },
        { label: "Je me prépare à prendre plus de responsabilités", score: null },
      ],
      comment: "",
    },
  ],
};
