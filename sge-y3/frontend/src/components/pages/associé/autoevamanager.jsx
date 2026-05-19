import { useMemo, useState } from "react";
import { Bell, ChevronLeft, ChevronRight } from "lucide-react";
import matrixData from "../../../../../backend/src/data/competencyMatrix.generated.json";

const fallbackManagerMatrixSections = [
  {
    id: "savoir-faire",
    title: "SAVOIR FAIRE",
    pages: [
      {
        id: "orientation-resultats",
        title: "Être orienté résultats",
        themes: [
          {
            id: "vision-strategique",
            code: "A",
            label: "Avoir une vision stratégique",
            statement: "Définit les enjeux généraux de la mission.",
          },
          {
            id: "pilotage-objectifs",
            code: "B",
            label: "Piloter par les objectifs",
            statement:
              "Transmet à ses équipes la culture de l'excellence, prend les bonnes décisions sous pression et sait les communiquer.",
          },
          {
            id: "prise-decision",
            code: "C",
            label: "Savoir prendre des décisions",
            statement: "Analyse rapidement les situations complexes et arbitre avec discernement pour débloquer les situations.",
          },
        ],
      },
      {
        id: "service-client",
        title: "Optimiser le service au client",
        themes: [
          {
            id: "service-qualite",
            code: "A",
            label: "Fournir un service de qualité",
            statement:
              "S'assure que les ressources utilisées sur la mission sont appropriées afin de délivrer un service de qualité dans les délais et le budget impartis.",
          },
          {
            id: "attentes-client",
            code: "B",
            label: "Savoir répondre aux attentes du client",
            statement: "Anticipe et répond aux besoins du client en prenant en compte l'intérêt général du cabinet.",
          },
          {
            id: "relation-confiance",
            code: "C",
            label: "Développer une relation de confiance avec le client",
            statement: "Est pour le client un interlocuteur privilégié apportant une forte valeur ajoutée à long terme.",
          },
        ],
      },
      {
        id: "orientation-solutions",
        title: "Être orienté solutions",
        themes: [
          {
            id: "cadrage-problemes",
            code: "A",
            label: "Identifier et cadrer les problèmes",
            statement: "Explique simplement un problème complexe, recherche ses causes profondes et identifie ses impacts.",
          },
          {
            id: "collecte-donnees",
            code: "B",
            label: "Collecter les données",
            statement: "Supervise la collecte des données et s'assure qu'aucune information pertinente n'a été omise.",
          },
          {
            id: "analyse-problemes",
            code: "C",
            label: "Savoir analyser les problèmes",
            statement: "Développe des approches innovantes d'analyse et sollicite un support si nécessaire.",
          },
          {
            id: "developper-solutions",
            code: "D",
            label: "Développer des solutions",
            statement: "Développe et propose des solutions partageables comme bonnes pratiques.",
          },
        ],
      },
    ],
  },
  {
    id: "savoir-etre",
    title: "SAVOIR ÊTRE",
    pages: [
      {
        id: "leadership-equipe",
        title: "Développer le leadership",
        themes: [
          {
            id: "mobiliser-equipe",
            code: "A",
            label: "Mobiliser l'équipe",
            statement: "Anime l'équipe autour d'objectifs clairs et maintient l'engagement sur toute la durée de la mission.",
          },
          {
            id: "deleguer",
            code: "B",
            label: "Déléguer et responsabiliser",
            statement: "Répartit les responsabilités de manière adaptée et suit l'avancement sans bloquer l'autonomie.",
          },
          {
            id: "feedback",
            code: "C",
            label: "Donner du feedback",
            statement: "Donne des retours réguliers, factuels et utiles au développement des collaborateurs.",
          },
        ],
      },
      {
        id: "communication",
        title: "Communiquer efficacement",
        themes: [
          {
            id: "clarte",
            code: "A",
            label: "Communiquer avec clarté",
            statement: "Adapte sa communication aux interlocuteurs internes et externes, même dans les situations sensibles.",
          },
          {
            id: "coordination",
            code: "B",
            label: "Coordonner les parties prenantes",
            statement: "Assure une coordination fluide entre client, équipe et associés.",
          },
          {
            id: "alerte",
            code: "C",
            label: "Escalader les points critiques",
            statement: "Alerte rapidement sur les risques majeurs et propose des options de décision.",
          },
        ],
      },
    ],
  },
];

function slugify(value = "") {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

function formatSourceLabel(sourceSheet = "") {
  if (sourceSheet === "TRONC COMMUN") return "Tronc commun";
  if (sourceSheet === "EXPERTISE COMPTABLE") return "Expertise comptable";
  if (sourceSheet === "CONSEIL OPERATIONNEL") return "Conseil opérationnel";
  if (sourceSheet === "CONSEIL FINANCIER") return "Conseil financier";
  if (sourceSheet === "CAPITAL HUMAIN") return "Capital humain";
  if (sourceSheet === "AUDIT") return "Audit";
  return sourceSheet;
}

function buildManagerMatrixSections() {
  const sections = Object.entries(matrixData || {}).flatMap(([sourceSheet, sourceSections]) =>
    (sourceSections || []).map((section, sectionIndex) => {
      const sourceLabel = formatSourceLabel(sourceSheet);
      const sectionTitle = section.title || section.key || `Section ${sectionIndex + 1}`;
      const pages = (section.pages || [])
        .map((page, pageIndex) => {
          const themes = (page.themes || [])
            .filter((theme) => theme.statements?.Manager)
            .map((theme, themeIndex) => ({
              id: `${slugify(sourceSheet)}-${slugify(sectionTitle)}-${slugify(page.title)}-${slugify(theme.code || themeIndex)}`,
              code: theme.code || String.fromCharCode(65 + themeIndex),
              label: theme.label,
              statement: theme.statements.Manager,
            }));

          return {
            id: `${slugify(sourceSheet)}-${slugify(sectionTitle)}-${slugify(page.title || pageIndex)}`,
            title: page.title || `Titre ${pageIndex + 1}`,
            sourceLabel,
            themes,
          };
        })
        .filter((page) => page.themes.length);

      return {
        id: `${slugify(sourceSheet)}-${slugify(sectionTitle)}`,
        title: sourceSheet === "TRONC COMMUN" ? sectionTitle : `${sourceLabel} - ${sectionTitle}`,
        sourceLabel,
        pages,
      };
    })
  );

  const completeSections = sections.filter((section) => section.pages.length);
  return completeSections.length ? completeSections : fallbackManagerMatrixSections;
}

const managerMatrixSections = buildManagerMatrixSections();

const managers = [
  {
    id: "revita-oule",
    name: "Révita Oulé",
    role: "Manager Conseil opérationnel",
    status: "Décision en attente",
    missions: [
      {
        id: "organisation-finance",
        title: "Réorganisation de la fonction finance",
        client: "Client Alpha",
        period: "Septembre - Décembre 2025",
        selfAverage: 4.0,
        comment: "Mission exigeante avec une forte coordination client. Les livrables ont été remis dans les délais.",
      },
      {
        id: "processus-achats",
        title: "Optimisation des processus achats",
        client: "Client Delta",
        period: "Janvier - Mars 2026",
        selfAverage: 3.6,
        comment: "Bonne mobilisation de l'équipe, avec quelques ajustements nécessaires sur le suivi des jalons.",
      },
    ],
  },
  {
    id: "augustin-kpantche",
    name: "Augustin KPANTCHE",
    role: "Manager Conseil financier",
    status: "Décision en attente",
    missions: [
      {
        id: "business-plan",
        title: "Business plan et levée de fonds",
        client: "Client Horizon",
        period: "Octobre 2025 - Février 2026",
        selfAverage: 4.2,
        comment: "Mission structurante avec une bonne qualité d'analyse financière et une relation client solide.",
      },
      {
        id: "valorisation",
        title: "Valorisation d'entreprise",
        client: "Client Nova",
        period: "Mars - Avril 2026",
        selfAverage: 4.0,
        comment: "Très bonne maîtrise technique. La restitution client peut encore gagner en clarté.",
      },
    ],
  },
  {
    id: "stephane-gnahoua",
    name: "Stéphane GNAHOUA",
    role: "Manager Expertise comptable",
    status: "Décision en attente",
    missions: [
      {
        id: "cloture-annuelle",
        title: "Clôture annuelle et revue comptable",
        client: "Client Atlas",
        period: "Novembre 2025 - Janvier 2026",
        selfAverage: 3.8,
        comment: "Bonne sécurisation du dossier, avec un effort particulier sur la revue des comptes sensibles.",
      },
      {
        id: "reporting-groupe",
        title: "Reporting groupe mensuel",
        client: "Client Baobab",
        period: "Février - Avril 2026",
        selfAverage: 3.8,
        comment: "Mission récurrente bien tenue. Les délais de remontée sont désormais mieux anticipés.",
      },
    ],
  },
  {
    id: "axelle-amani",
    name: "Axelle AMANI",
    role: "Manager Audit",
    status: "Décision en attente",
    missions: [
      {
        id: "audit-statutaire",
        title: "Audit statutaire",
        client: "Client Émergence",
        period: "Septembre 2025 - Mars 2026",
        selfAverage: 4.2,
        comment: "Très bonne conduite de mission, avec une supervision régulière des points d'audit critiques.",
      },
      {
        id: "revue-controle-interne",
        title: "Revue du contrôle interne",
        client: "Client Ivoire",
        period: "Avril 2026",
        selfAverage: 4.0,
        comment: "Bonne interaction client. L'encadrement des juniors doit rester plus formalisé.",
      },
    ],
  },
  {
    id: "stephanie-taki",
    name: "Stéphanie TAKI",
    role: "Manager Audit",
    status: "Décision en attente",
    missions: [
      {
        id: "audit-banque",
        title: "Audit secteur banque",
        client: "Client Capital",
        period: "Décembre 2025 - Avril 2026",
        selfAverage: 4.2,
        comment: "Mission complexe bien pilotée, avec une forte exigence technique sur les cycles sensibles.",
      },
      {
        id: "mission-speciale",
        title: "Mission spéciale de revue",
        client: "Client Kora",
        period: "Mars - Mai 2026",
        selfAverage: 3.8,
        comment: "Les travaux ont été bien conduits malgré un calendrier contraint.",
      },
    ],
  },
];

function createEvaluationSections(defaultScore = 3) {
  return managerMatrixSections.map((section) => ({
    ...section,
    pages: section.pages.map((page) => ({
      ...page,
      comment: "",
      themes: page.themes.map((theme) => ({
        ...theme,
        score: defaultScore,
      })),
    })),
  }));
}

function createInitialEvaluations() {
  return Object.fromEntries(
    managers.flatMap((manager) =>
      manager.missions.map((mission) => [
        `${manager.id}:${mission.id}`,
        {
          sections: createEvaluationSections(Math.round(mission.selfAverage || 3)),
          saved: false,
        },
      ])
    )
  );
}

function getThemeScores(sections = []) {
  return sections.flatMap((section) => section.pages.flatMap((page) => page.themes.map((theme) => theme.score))).filter(Number.isFinite);
}

function getAverage(scores = []) {
  if (!scores.length) return "0.0";
  return (scores.reduce((total, score) => total + score, 0) / scores.length).toFixed(1);
}

function getPageProgress(page) {
  const themes = page?.themes || [];
  if (!themes.length) return 0;
  const answered = themes.filter((theme) => Number.isFinite(theme.score)).length;
  return Math.round((answered / themes.length) * 100);
}

function getSectionProgress(section) {
  const pages = section?.pages || [];
  const themes = pages.flatMap((page) => page.themes || []);
  if (!themes.length) return 0;
  const answered = themes.filter((theme) => Number.isFinite(theme.score)).length;
  return Math.round((answered / themes.length) * 100);
}

function getPageAverage(page) {
  return getAverage((page?.themes || []).map((theme) => theme.score).filter(Number.isFinite));
}

function ScoreSelector({ selected, onSelect }) {
  return (
    <div className="flex overflow-hidden rounded-md border border-slate-200">
      {[1, 2, 3, 4, 5].map((value) => (
        <button
          key={value}
          type="button"
          onClick={() => onSelect(value)}
          className={`h-8 w-10 border-r border-slate-200 text-xs font-bold last:border-r-0 ${
            value === selected ? "bg-[#0C4B6C] text-white" : "bg-slate-100 text-[#0F3A63]"
          }`}
        >
          {value}
        </button>
      ))}
    </div>
  );
}

function Autoevamanager() {
  const [activeManagerId, setActiveManagerId] = useState(managers[0].id);
  const [activeMissionId, setActiveMissionId] = useState(managers[0].missions[0].id);
  const [activeTab, setActiveTab] = useState("auto");
  const [evaluations, setEvaluations] = useState(() => createInitialEvaluations());
  const [annotations, setAnnotations] = useState({});
  const [activeSectionId, setActiveSectionId] = useState(managerMatrixSections[0].id);
  const [pageIndexes, setPageIndexes] = useState({});
  const [status, setStatus] = useState("");

  const activeManager = managers.find((manager) => manager.id === activeManagerId) || managers[0];
  const activeMission = activeManager.missions.find((mission) => mission.id === activeMissionId) || activeManager.missions[0];
  const evaluationKey = `${activeManager.id}:${activeMission.id}`;
  const activeEvaluation = evaluations[evaluationKey];
  const activeSection = activeEvaluation.sections.find((section) => section.id === activeSectionId) || activeEvaluation.sections[0];
  const activePageIndex = pageIndexes[`${evaluationKey}:${activeSection.id}`] || 0;
  const activePage = activeSection.pages[activePageIndex] || activeSection.pages[0];
  const associateAverage = getAverage(getThemeScores(activeEvaluation.sections));
  const completedEvaluations = Object.values(evaluations).filter((evaluation) => evaluation.saved).length;
  const totalMissions = managers.reduce((total, manager) => total + manager.missions.length, 0);
  const isFirstPage = activeEvaluation.sections[0].id === activeSection.id && activePageIndex === 0;
  const isLastPage =
    activeEvaluation.sections[activeEvaluation.sections.length - 1].id === activeSection.id &&
    activePageIndex === activeSection.pages.length - 1;

  const kpis = useMemo(
    () => [
      { title: "Managers à évaluer", value: String(managers.length), subtitle: "Par mission" },
      { title: "Missions évaluées", value: `${completedEvaluations}/${totalMissions}`, subtitle: "Évaluations associées" },
      { title: "Décisions prises", value: "0", subtitle: "En attente du comité" },
    ],
    [completedEvaluations, totalMissions]
  );

  function setActivePageIndex(sectionId, index) {
    setPageIndexes((current) => ({ ...current, [`${evaluationKey}:${sectionId}`]: index }));
  }

  function selectManager(managerId) {
    const nextManager = managers.find((manager) => manager.id === managerId) || managers[0];
    setActiveManagerId(nextManager.id);
    setActiveMissionId(nextManager.missions[0].id);
    setActiveSectionId(managerMatrixSections[0].id);
    setActiveTab("auto");
    setStatus("");
  }

  function selectMission(missionId) {
    setActiveMissionId(missionId);
    setActiveSectionId(managerMatrixSections[0].id);
    setActiveTab("auto");
    setStatus("");
  }

  function updateTheme(themeId, score) {
    setEvaluations((current) => ({
      ...current,
      [evaluationKey]: {
        ...current[evaluationKey],
        saved: false,
        sections: current[evaluationKey].sections.map((section) =>
          section.id !== activeSection.id
            ? section
            : {
                ...section,
                pages: section.pages.map((page, index) =>
                  index !== activePageIndex
                    ? page
                    : {
                        ...page,
                        themes: page.themes.map((theme) => (theme.id === themeId ? { ...theme, score } : theme)),
                      }
                ),
              }
        ),
      },
    }));
    setStatus("");
  }

  function updatePageComment(comment) {
    setEvaluations((current) => ({
      ...current,
      [evaluationKey]: {
        ...current[evaluationKey],
        saved: false,
        sections: current[evaluationKey].sections.map((section) =>
          section.id !== activeSection.id
            ? section
            : {
                ...section,
                pages: section.pages.map((page, index) => (index === activePageIndex ? { ...page, comment } : page)),
              }
        ),
      },
    }));
    setStatus("");
  }

  function goToPage(direction) {
    const nextPageIndex = activePageIndex + direction;
    if (nextPageIndex >= 0 && nextPageIndex < activeSection.pages.length) {
      setActivePageIndex(activeSection.id, nextPageIndex);
      return;
    }

    const sectionIndex = activeEvaluation.sections.findIndex((section) => section.id === activeSection.id);
    const nextSection = activeEvaluation.sections[sectionIndex + direction];
    if (!nextSection) return;

    setActiveSectionId(nextSection.id);
    setActivePageIndex(nextSection.id, direction > 0 ? 0 : nextSection.pages.length - 1);
  }

  function saveEvaluation() {
    setEvaluations((current) => ({
      ...current,
      [evaluationKey]: {
        ...current[evaluationKey],
        saved: true,
      },
    }));
    setStatus(`Évaluation enregistrée pour la mission "${activeMission.title}".`);
  }

  function saveAnnotation() {
    setStatus("Annotation associée enregistrée.");
  }

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-black tracking-tight text-[#0F3A63]">Auto-évaluations des Managers</h1>
        <div className="flex items-center gap-3">
          <button onClick={() => window.alert("Notifications bientôt disponibles.")} className="rounded-full p-2 text-slate-500 hover:bg-slate-200/70">
            <Bell size={15} />
          </button>
          <button onClick={() => window.alert("Ouverture des synthèses RH...")} className="rounded-full bg-[#7DBA45] px-4 py-2 text-xs font-bold text-white hover:bg-[#71AB3D]">
            Voir les synthèses RH
          </button>
        </div>
      </header>

      <section className="rounded-sm border-l-4 border-[#77B944] bg-[#DCECD8] px-3 py-2 text-sm font-bold text-[#1F4B2D]">
        Les associés évaluent chaque manager mission par mission avec les questions de la matrice destinées aux managers.
      </section>

      <section className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {kpis.map((item) => (
          <article key={item.title} className="rounded-lg bg-[#0D496A] p-4 text-white">
            <p className="text-sm font-semibold">{item.title}</p>
            <p className="mt-3 text-2xl font-extrabold leading-none">{item.value}</p>
            <p className="mt-3 text-sm font-semibold text-slate-100">{item.subtitle}</p>
          </article>
        ))}
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-[0.85fr_1.6fr]">
        <aside className="space-y-3 rounded-lg bg-white p-3 shadow-sm">
          <p className="text-sm font-extrabold text-[#0F4A72]">Managers</p>
          {managers.map((manager) => {
            const managerCompleted = manager.missions.filter((mission) => evaluations[`${manager.id}:${mission.id}`]?.saved).length;
            const isActive = manager.id === activeManager.id;

            return (
              <button
                key={manager.id}
                type="button"
                onClick={() => selectManager(manager.id)}
                className={`w-full rounded-md border p-3 text-left transition ${
                  isActive ? "border-[#76B82A] bg-[#EEF6E8]" : "border-slate-100 bg-slate-50 hover:bg-white"
                }`}
              >
                <p className="text-sm font-black text-[#0F3A63]">{manager.name}</p>
                <p className="mt-1 text-xs font-semibold text-slate-500">{manager.role}</p>
                <p className="mt-2 text-xs font-bold text-[#76B82A]">
                  {managerCompleted}/{manager.missions.length} mission(s) évaluée(s)
                </p>
              </button>
            );
          })}
        </aside>

        <section className="rounded-lg bg-[#D4DADF] p-3">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold text-slate-500">Cycle 2025-2026</p>
              <h2 className="text-xl font-black text-[#0F3A63]">{activeManager.name}</h2>
              <p className="text-sm font-semibold text-[#0F4A72]">{activeManager.role}</p>
            </div>
            <span className="rounded-full bg-[#E5EFE1] px-4 py-1 text-sm font-semibold text-[#F24A4A]">
              {activeManager.status}
            </span>
          </div>

          <div className="mb-3 flex flex-wrap gap-2">
            {activeManager.missions.map((mission) => (
              <button
                key={mission.id}
                type="button"
                onClick={() => selectMission(mission.id)}
                className={`rounded-full px-4 py-2 text-xs font-bold transition ${
                  activeMission.id === mission.id ? "bg-[#0C4B6C] text-white" : "bg-white text-[#0F3A63] hover:bg-[#F4F8FB]"
                }`}
              >
                {mission.title}
              </button>
            ))}
          </div>

          <div className="mb-3 flex flex-wrap items-center gap-8 text-sm font-semibold text-[#0F3A63]">
            <button onClick={() => setActiveTab("auto")} className={`${activeTab === "auto" ? "border-b-2 border-[#F34B4B]" : ""} pb-1 font-bold`}>
              Auto-évaluation mission
            </button>
            <button onClick={() => setActiveTab("evaluation")} className={`${activeTab === "evaluation" ? "border-b-2 border-[#F34B4B]" : ""} pb-1`}>
              Évaluation associée
            </button>
            <button onClick={() => setActiveTab("annotation")} className={`${activeTab === "annotation" ? "border-b-2 border-[#F34B4B]" : ""} pb-1`}>
              Annotation
            </button>
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.5fr_0.95fr]">
            <article className="rounded-lg bg-white p-4 shadow-sm">
              {activeTab === "evaluation" ? (
                <>
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-extrabold text-[#0F4A72]">Évaluation associée par mission</p>
                      <p className="mt-1 text-sm font-semibold text-slate-500">
                        {activeMission.client} - {activeMission.period}
                      </p>
                    </div>
                    <span className="rounded-full bg-[#DDECD8] px-3 py-1 text-xs font-bold text-[#78B843]">
                      Moyenne {associateAverage} / 5
                    </span>
                  </div>

                  <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-[0.8fr_1.2fr]">
                    <div className="space-y-2">
                      {activeEvaluation.sections.map((section) => (
                        <button
                          key={section.id}
                          type="button"
                          onClick={() => setActiveSectionId(section.id)}
                          className={`w-full rounded-md border px-3 py-2 text-left text-xs font-bold ${
                            activeSection.id === section.id ? "border-[#76B82A] bg-[#EEF6E8] text-[#0F3A63]" : "border-slate-100 bg-slate-50 text-slate-500"
                          }`}
                        >
                          <span>{section.title}</span>
                          <span className="float-right">{getSectionProgress(section)}%</span>
                        </button>
                      ))}
                    </div>
                    <div className="rounded-md bg-[#F8FAFC] p-3">
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <div>
                          <p className="text-xs font-bold uppercase text-slate-500">{activeSection.title}</p>
                          <p className="text-sm font-black text-[#0F3A63]">{activePage.title}</p>
                        </div>
                        <span className="text-xs font-bold text-[#0F3A63]">
                          Titre {activePageIndex + 1}/{activeSection.pages.length}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {activeSection.pages.map((page, index) => (
                          <button
                            key={page.id}
                            type="button"
                            onClick={() => setActivePageIndex(activeSection.id, index)}
                            className={`rounded-md px-3 py-2 text-left text-xs font-bold ${
                              index === activePageIndex ? "bg-[#0C4B6C] text-white" : "bg-white text-[#0F3A63]"
                            }`}
                          >
                            <span>Titre {index + 1}</span>
                            <span className="ml-2 text-[10px] opacity-80">{getPageProgress(page)}%</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-5">
                    {activePage.themes.map((theme) => (
                      <div key={theme.id} className="rounded-md border border-slate-100 bg-white p-3">
                        <div className="mb-3">
                          <p className="text-sm font-bold text-[#0F3A63]">
                            {theme.code}. {theme.label}
                          </p>
                          <p className="mt-1 text-xs leading-5 text-slate-500">{theme.statement}</p>
                        </div>
                        <ScoreSelector selected={theme.score} onSelect={(score) => updateTheme(theme.id, score)} />
                      </div>
                    ))}
                  </div>

                  <div className="mt-5">
                    <p className="mb-2 text-xs font-bold text-[#0F4A72]">Commentaire du titre</p>
                    <textarea
                      value={activePage.comment}
                      onChange={(event) => updatePageComment(event.target.value)}
                      placeholder="Appréciation associée sur ce titre de matrice..."
                      className="min-h-[86px] w-full resize-none rounded-md bg-slate-100 px-3 py-3 text-sm text-slate-600 outline-none placeholder:text-slate-500"
                    />
                  </div>

                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => goToPage(-1)}
                      disabled={isFirstPage}
                      className="inline-flex items-center gap-2 rounded-md bg-slate-200 px-4 py-2 text-xs font-bold text-slate-600 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <ChevronLeft size={14} />
                      Précédent
                    </button>
                    <div className="flex flex-wrap items-center gap-2">
                      {!isLastPage ? (
                        <button type="button" onClick={() => goToPage(1)} className="inline-flex items-center gap-2 rounded-md bg-[#0C4B6C] px-4 py-2 text-xs font-bold text-white">
                          Suivant
                          <ChevronRight size={14} />
                        </button>
                      ) : null}
                      <button onClick={saveEvaluation} className="rounded-md bg-[#76B82A] px-5 py-2 text-xs font-bold text-white">
                        Enregistrer la mission
                      </button>
                    </div>
                  </div>
                </>
              ) : activeTab === "annotation" ? (
                <>
                  <p className="mb-3 text-sm font-extrabold text-[#0F4A72]">Annotation globale de l'associé</p>
                  <textarea
                    value={annotations[activeManager.id] || ""}
                    onChange={(event) => {
                      setAnnotations((current) => ({ ...current, [activeManager.id]: event.target.value }));
                      setStatus("");
                    }}
                    placeholder="Lecture globale de l'auto-évaluation du manager..."
                    className="min-h-[260px] w-full resize-none rounded-lg bg-slate-100 px-3 py-4 text-sm text-slate-600 outline-none placeholder:text-slate-500"
                  />
                  <button onClick={saveAnnotation} className="mt-4 rounded-md bg-[#0C4B6C] px-5 py-2 text-sm font-bold text-white">
                    Enregistrer l'annotation
                  </button>
                </>
              ) : (
                <>
                  <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-extrabold text-[#0F4A72]">Auto-évaluation du manager sur la mission</p>
                      <h3 className="mt-1 text-xl font-black text-[#0F3A63]">{activeMission.title}</h3>
                      <p className="mt-1 text-sm font-semibold text-slate-500">
                        {activeMission.client} - {activeMission.period}
                      </p>
                    </div>
                    <span className="rounded-full bg-[#DDECD8] px-3 py-1 text-xs font-bold text-[#78B843]">
                      Auto-note {activeMission.selfAverage} / 5
                    </span>
                  </div>
                  <p className="text-sm leading-6 text-slate-600">"{activeMission.comment}"</p>
                  <div className="mt-5 rounded-md bg-[#F8FAFC] p-3">
                    <p className="text-xs font-bold uppercase text-slate-500">Matrice utilisée pour l'évaluation associée</p>
                    <p className="mt-1 text-sm font-semibold text-[#0F3A63]">
                      {managerMatrixSections.length} sections, {managerMatrixSections.reduce((total, section) => total + section.pages.length, 0)} titres,{" "}
                      {managerMatrixSections.reduce(
                        (total, section) => total + section.pages.reduce((pageTotal, page) => pageTotal + page.themes.length, 0),
                        0
                      )}{" "}
                      questions niveau Manager.
                    </p>
                  </div>
                </>
              )}
            </article>

            <article className="rounded-lg bg-white p-3 shadow-sm">
              <p className="mb-3 text-sm font-extrabold text-[#0F4A72]">Synthèse mission</p>
              <div className="rounded-md bg-[#F4F7FA] p-3">
                <p className="text-xs font-bold uppercase text-slate-500">Mission active</p>
                <p className="mt-1 text-sm font-black text-[#0F3A63]">{activeMission.title}</p>
                <p className="mt-1 text-xs font-semibold text-slate-500">{activeMission.client}</p>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2">
                <div className="rounded-md bg-[#EEF6E8] p-3">
                  <p className="text-xs font-bold text-[#4E8B1B]">Auto-note</p>
                  <p className="mt-2 text-xl font-black text-[#0F3A63]">{activeMission.selfAverage}</p>
                </div>
                <div className="rounded-md bg-[#E7F1F8] p-3">
                  <p className="text-xs font-bold text-[#0B4C7A]">Note associée</p>
                  <p className="mt-2 text-xl font-black text-[#0F3A63]">{associateAverage}</p>
                </div>
              </div>

              {activeEvaluation.saved ? (
                <div className="mt-3 rounded-md bg-[#DDECD8] px-3 py-2">
                  <p className="text-xs font-bold text-[#78B843]">Évaluation sauvegardée</p>
                  <p className="mt-1 text-sm font-semibold text-[#0F3A63]">Mission évaluée par l'associé.</p>
                </div>
              ) : (
                <div className="mt-3 rounded-md bg-[#FFF4E5] px-3 py-2">
                  <p className="text-xs font-bold text-[#B56B00]">Évaluation non sauvegardée</p>
                  <p className="mt-1 text-sm font-semibold text-[#0F3A63]">Passez par l'onglet Évaluation associée.</p>
                </div>
              )}

              <div className="mt-4 flex flex-col gap-2">
                <button onClick={() => setActiveTab("evaluation")} className="rounded-md bg-[#0C4B6C] px-5 py-2 text-sm font-bold text-white">
                  Évaluer cette mission
                </button>
                <button onClick={() => setStatus("Décision envoyée vers validation finale.")} className="rounded-md bg-[#0C4B6C] px-5 py-2 text-sm font-bold text-white">
                  Décider
                </button>
              </div>

              {status ? <p className="mt-3 text-xs font-semibold text-[#0F4A72]">{status}</p> : null}
            </article>
          </div>
        </section>
      </section>
    </div>
  );
}

export default Autoevamanager;
