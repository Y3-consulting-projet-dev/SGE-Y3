import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  ChevronsLeft,
  ClipboardList,
  History,
  LayoutDashboard,
  LineChart,
  LogOut,
  Settings2,
  Target,
  TrendingUp,
  User,
} from "lucide-react";
import logoY3 from "@/assets/logo-y3.png";
import MonTableauDeBord from "@/components/pages/collaborator/Collaboratordashboard";
import Monautoevaluation from "@/components/pages/collaborator/Monautoevaluation";
import Mesresultats from "@/components/pages/collaborator/Mesresultats";
import Monhistorique from "@/components/pages/collaborator/Monhistorique";
import Mondeveloppement from "@/components/pages/collaborator/Mondeveloppement";
import Calendrier from "@/components/pages/collaborator/Calendrier";
import ProfilePanel from "@/components/profile/ProfilePanel";
import { getDisplayName } from "@/utils/userPresentation";
import { getMyAssistantEvaluation, getMyAssistantResults } from "@/api/collaboratorEvaluation";

const menuGroups = [
  {
    title: "Tableau de bord",
    items: [{ key: "dashboard", label: "Mon espace", icon: LayoutDashboard }],
  },
  {
    title: "Evaluation",
    items: [
      { key: "self-evaluation", label: "Mon auto-évaluation", icon: ClipboardList },
      { key: "calendar", label: "Calendrier", icon: CalendarDays },
      { key: "results", label: "Mes résultats", icon: LineChart },
      { key: "history", label: "Historique", icon: History },
    ],
  },
  {
    title: "Développement",
    items: [
      { key: "development", label: "Mon développement", icon: TrendingUp },
    ],
  },
  {
    title: "Compte",
    items: [{ key: "profile", label: "Profil", icon: Settings2 }],
  },
];

function CollaboratorDashboard({ onLogout, onUserUpdate, user }) {
  const [activeSection, setActiveSection] = useState("dashboard");
  const [evaluationData, setEvaluationData] = useState(null);
  const [evaluationError, setEvaluationError] = useState("");
  const [isLoadingEvaluation, setIsLoadingEvaluation] = useState(true);
  const [resultsData, setResultsData] = useState(null);
  const [resultsError, setResultsError] = useState("");
  const [isLoadingResults, setIsLoadingResults] = useState(true);
  const [missionEvaluations, setMissionEvaluations] = useState([]);
  const displayName = getDisplayName(user);
  const profileKey = [user?.id, user?.email, user?.first_name, user?.last_name, user?.grade, user?.department].join("|");

  async function refreshAssistantResults() {
    if (user?.grade !== "Assistant") {
      setResultsData(null);
      setResultsError("");
      setIsLoadingResults(false);
      return null;
    }

    setIsLoadingResults(true);
    setResultsError("");

    try {
      const resultsResponse = await getMyAssistantResults();
      setResultsData(resultsResponse);
      return resultsResponse;
    } catch (error) {
      setResultsError(error.message || "Chargement des résultats impossible.");
      return null;
    } finally {
      setIsLoadingResults(false);
    }
  }

  function handleEvaluationUpdate(nextEvaluationData) {
    setEvaluationData(nextEvaluationData);
    setMissionEvaluations(nextEvaluationData?.mission_evaluations || []);
    refreshAssistantResults();
  }

  function handleDevelopmentChange(nextDevelopment) {
    setEvaluationData((prev) => prev ? { ...prev, development: nextDevelopment } : prev);
  }

  // Stale-data guard: if evaluationData loaded from an old server response lacks the development field, re-fetch.
  useEffect(() => {
    if (activeSection === "development" && evaluationData && !evaluationData.development && !isLoadingEvaluation) {
      let cancelled = false;
      getMyAssistantEvaluation()
        .then((fresh) => { if (!cancelled) handleEvaluationUpdate(fresh); })
        .catch(() => {});
      return () => { cancelled = true; };
    }
  }, [activeSection, evaluationData, isLoadingEvaluation]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    let cancelled = false;

    async function loadEvaluation() {
      if (user?.grade !== "Assistant") {
        setIsLoadingEvaluation(false);
        setEvaluationData(null);
        setIsLoadingResults(false);
        setResultsData(null);
        return;
      }

      try {
        setIsLoadingEvaluation(true);
        setIsLoadingResults(true);
        setEvaluationError("");
        setResultsError("");
        const [evaluationResponse, resultsResponse] = await Promise.all([
          getMyAssistantEvaluation(),
          getMyAssistantResults(),
        ]);

        if (!cancelled) {
          setEvaluationData(evaluationResponse);
          setMissionEvaluations(evaluationResponse?.mission_evaluations || []);
          setResultsData(resultsResponse);
        }
      } catch (error) {
        if (!cancelled) {
          setEvaluationError(error.message || "Chargement de l'auto-évaluation impossible.");
          setResultsError(error.message || "Chargement des résultats impossible.");
        }
      } finally {
        if (!cancelled) {
          setIsLoadingEvaluation(false);
          setIsLoadingResults(false);
        }
      }
    }

    loadEvaluation();

    return () => {
      cancelled = true;
    };
  }, [user?.grade]);

  const pageTitle = useMemo(() => {
    if (activeSection === "dashboard") return "TABLEAU DE BORD";
    if (activeSection === "self-evaluation") return "MON AUTO-ÉVALUATION";
    if (activeSection === "calendar") return "CALENDRIER";
    if (activeSection === "results") return "MES RÉSULTATS";
    if (activeSection === "history") return "HISTORIQUE";
    if (activeSection === "development") return "MON DÉVELOPPEMENT";
    if (activeSection === "profile") return "MON PROFIL";
    return "ESPACE COLLABORATEUR";
  }, [activeSection]);

  const renderMainContent = () => {
    if (user?.grade !== "Assistant" && activeSection === "dashboard") {
      return (
        <section className="rounded-lg bg-white p-5 shadow-sm">
          <h2 className="text-xl font-bold text-[#0F3A63]">Parcours collaborateur en préparation</h2>
          <p className="mt-3 text-sm text-slate-600">
            Cette première phase est activée uniquement pour les Assistants. Les autres profils collaborateurs seront branchés ensuite.
          </p>
        </section>
      );
    }

    if (activeSection === "dashboard") {
      if (isLoadingEvaluation) {
        return <section className="rounded-lg bg-white p-5 text-sm font-semibold text-slate-500 shadow-sm">Chargement du tableau de bord...</section>;
      }

      if (evaluationError) {
        return <section className="rounded-lg bg-white p-5 text-sm font-semibold text-red-600 shadow-sm">{evaluationError}</section>;
      }

      return <MonTableauDeBord evaluation={evaluationData} onContinue={() => setActiveSection("self-evaluation")} isLoading={isLoadingEvaluation} />;
    }

    if (activeSection === "self-evaluation") {
      if (isLoadingEvaluation) {
        return <section className="rounded-lg bg-white p-5 text-sm font-semibold text-slate-500 shadow-sm">Chargement de l'auto-évaluation...</section>;
      }

      if (evaluationError) {
        return <section className="rounded-lg bg-white p-5 text-sm font-semibold text-red-600 shadow-sm">{evaluationError}</section>;
      }

      return (
        <Monautoevaluation
          key={evaluationData?.evaluation?.id || "assistant-evaluation"}
          evaluationData={evaluationData}
          onEvaluationChange={handleEvaluationUpdate}
          onMissionEvaluationsChange={setMissionEvaluations}
          onSubmitted={handleEvaluationUpdate}
        />
      );
    }

    if (activeSection === "results") {
      return (
        <Mesresultats
          evaluationData={evaluationData}
          missionEvaluations={missionEvaluations}
          resultsData={resultsData}
          isLoading={isLoadingResults}
          errorMessage={resultsError}
        />
      );
    }

    if (activeSection === "calendar") {
      return <Calendrier missionEvaluations={missionEvaluations} resultsData={resultsData} />;
    }

    if (activeSection === "history") {
      return <Monhistorique />;
    }

    if (activeSection === "development") {
      if (isLoadingEvaluation) {
        return <section className="rounded-lg bg-white p-5 text-sm font-semibold text-slate-500 shadow-sm">Chargement du plan de développement...</section>;
      }
      if (evaluationError) {
        return <section className="rounded-lg bg-white p-5 text-sm font-semibold text-red-600 shadow-sm">{evaluationError}</section>;
      }
      if (evaluationData && !evaluationData.development) {
        return <section className="rounded-lg bg-white p-5 text-sm font-semibold text-slate-500 shadow-sm">Chargement du plan de développement...</section>;
      }
      return (
        <Mondeveloppement
          evaluationData={evaluationData}
          onDevelopmentChange={handleDevelopmentChange}
        />
      );
    }

    return <ProfilePanel key={profileKey} user={user} onLogout={onLogout} onUserUpdate={onUserUpdate} />;
  };

  return (
    <div className="min-h-screen bg-[#EBEFF3] text-[#0E2B4F]">
      <div className="flex min-h-screen w-full">
        <aside className="relative min-h-screen w-full max-w-[280px] border-r border-slate-300/70 bg-[#F3F4F6] px-4 py-5">
          <button className="absolute right-3 top-3 z-20 inline-flex h-7 w-7 items-center justify-center rounded-full bg-[#E4E7EB] text-slate-500 shadow-sm">
            <ChevronsLeft size={14} />
          </button>

          <div className="mb-8 flex items-center gap-3">
            <div className="leading-none text-4xl font-black tracking-tight text-[#0E4A6B]">
              SGE
              <img src={logoY3} alt="Y3" className="mt-2 h-20 w-auto scale-x-110 origin-left" />
            </div>
          </div>

          <div className="space-y-5 text-sm">
            {menuGroups.map((group) => (
              <div key={group.title}>
                <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500">{group.title}</p>
                <div className="space-y-1">
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    const isActive = activeSection === item.key;
                    return (
                      <button
                        key={item.key}
                        onClick={() => setActiveSection(item.key)}
                        className={`w-full rounded-md px-3 py-2 text-left text-sm transition ${
                          isActive
                            ? "bg-[#D8E3EC] font-semibold text-[#0E4A6B] shadow-sm"
                            : "text-[#0F3A63] hover:bg-slate-200/70"
                        }`}
                      >
                        <span className="flex items-center gap-2">
                          <Icon size={15} />
                          {item.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          <div className="absolute bottom-16 left-4 right-4 rounded-xl bg-white px-3 py-3 shadow-sm">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#8BC53F] text-xs font-extrabold text-white">
                <User size={15} />
              </div>
              <div>
                <p className="text-xs font-semibold text-[#0F3A63]">{displayName}</p>
                <p className="text-xs text-slate-500">{user?.grade}</p>
              </div>
            </div>
          </div>

          <button
            onClick={onLogout}
            className="absolute bottom-5 left-4 flex items-center gap-2 text-left text-sm font-medium text-[#0F3A63] hover:text-[#0E4A6B]"
          >
            <LogOut size={14} />
            Déconnexion
          </button>
        </aside>

        <main className="relative flex-1 p-4 md:p-6">
          <header className="mb-5 flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-[34px] font-black tracking-tight text-[#0F3A63]">{pageTitle}</h1>
              {activeSection === "dashboard" ? <p className="mt-1 text-sm text-slate-500">{displayName} - {user?.grade}</p> : null}
            </div>
          </header>

          {renderMainContent()}
        </main>
      </div>
    </div>
  );
}

export default CollaboratorDashboard;
