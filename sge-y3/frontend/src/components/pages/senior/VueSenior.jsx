import { useEffect, useMemo, useState } from "react";
import { LogOut } from "lucide-react";
import logoY3 from "@/assets/logo-y3.png";
import { menuGroups } from "@/components/pages/senior/seniorData";
import Vueensemble from "@/components/pages/senior/Vueensemble";
import Mesassistants from "@/components/pages/senior/Mesassistants";
import Evaluerassistants from "@/components/pages/senior/Evaluerassistants";
import MesresultatsSenior from "@/components/pages/senior/MesresultatsSenior";
import MesobjectifsSenior from "@/components/pages/senior/MesobjectifsSenior";
import MonautoevaluationSenior from "@/components/pages/senior/MonautoevaluationSenior";
import Monhistorique from "@/components/pages/senior/Monhistorique";
import HistoriqueAssistants from "@/components/pages/senior/HistoriqueAssistants";
import CalendrierAssistants from "@/components/pages/collaborator/CalendrierAssistants";
import ProfilePanel from "@/components/profile/ProfilePanel";
import CommentairesRecus from "@/components/CommentairesRecus";
import { getDisplayName, getInitials } from "@/lib/userPresentation";
import { addSeniorAssistantMission, getSeniorAssistantEvaluation, getSeniorAssistants, getSeniorCommonMissions, getSeniorOverview } from "@/lib/seniorAssistants";
import { getMySeniorEvaluation } from "@/lib/seniorEvaluation";

function VueSenior({ onLogout, onUserUpdate, user }) {
  const [activeSection, setActiveSection] = useState("overview");
  const [assistants, setAssistants] = useState([]);
  const [commonMissions, setCommonMissions] = useState([]);
  const [overviewData, setOverviewData] = useState(null);
  const [selectedAssistantId, setSelectedAssistantId] = useState("");
  const [assistantsError, setAssistantsError] = useState("");
  const [isLoadingAssistants, setIsLoadingAssistants] = useState(true);
  const [selfEvaluationData, setSelfEvaluationData] = useState(null);
  const [selfEvaluationError, setSelfEvaluationError] = useState("");
  const [isLoadingSelfEvaluation, setIsLoadingSelfEvaluation] = useState(false);
  const displayName = getDisplayName(user);
  const profileKey = [user?.id, user?.email, user?.first_name, user?.last_name, user?.grade, user?.department].join("|");
  const initials = getInitials(user);

  async function refreshSeniorData() {
    setIsLoadingAssistants(true);
    setAssistantsError("");

    try {
      const [assistantsResponse, missionsResponse, overviewResponse] = await Promise.all([
        getSeniorAssistants(),
        getSeniorCommonMissions(),
        getSeniorOverview(),
      ]);

      setAssistants(assistantsResponse.assistants || []);
      setSelectedAssistantId((current) => current || assistantsResponse.assistants?.[0]?.id || "");
      setCommonMissions(missionsResponse.missions || []);
      setOverviewData(overviewResponse);
    } catch (error) {
      setAssistantsError(error.message || "Chargement des assistants impossible.");
    } finally {
      setIsLoadingAssistants(false);
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function loadAssistants() {
      try {
        setIsLoadingAssistants(true);
        setAssistantsError("");
        const [assistantsResponse, missionsResponse, overviewResponse] = await Promise.all([
          getSeniorAssistants(),
          getSeniorCommonMissions(),
          getSeniorOverview(),
        ]);

        if (cancelled) return;

        setAssistants(assistantsResponse.assistants || []);
        setSelectedAssistantId((current) => current || assistantsResponse.assistants?.[0]?.id || "");
        setCommonMissions(missionsResponse.missions || []);
        setOverviewData(overviewResponse);
      } catch (error) {
        if (!cancelled) {
          setAssistantsError(error.message || "Chargement des assistants impossible.");
        }
      } finally {
        if (!cancelled) {
          setIsLoadingAssistants(false);
        }
      }
    }

    loadAssistants();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (activeSection === "overview" || activeSection === "goals" || activeSection === "reviews" || activeSection === "results") {
      const timeoutId = setTimeout(() => {
        void refreshSeniorData();
      }, 0);

      return () => clearTimeout(timeoutId);
    }

    return undefined;
  }, [activeSection]);

  useEffect(() => {
    if (activeSection !== "calendar") {
      return undefined;
    }

    let cancelled = false;

    async function loadSelfEvaluation() {
      try {
        setIsLoadingSelfEvaluation(true);
        setSelfEvaluationError("");
        const response = await getMySeniorEvaluation();

        if (!cancelled) {
          setSelfEvaluationData(response);
        }
      } catch (error) {
        if (!cancelled) {
          setSelfEvaluationError(error.message || "Chargement de mon calendrier impossible.");
        }
      } finally {
        if (!cancelled) {
          setIsLoadingSelfEvaluation(false);
        }
      }
    }

    loadSelfEvaluation();

    return () => {
      cancelled = true;
    };
  }, [activeSection]);

  const pageTitle = useMemo(() => {
    if (activeSection === "assistants") return "MES ASSISTANTS";
    if (activeSection === "reviews") return "EVALUER ASSISTANTS";
    if (activeSection === "results") return "SYNTHESES TRANSMISES";
    if (activeSection === "goals") return "MISSIONS COMMUNES";
    if (activeSection === "self-evaluation") return "MON AUTO-EVALUATION";
    if (activeSection === "calendar") return "MON CALENDRIER";
    if (activeSection === "history") return "HISTORIQUE";
    if (activeSection === "assistants-history") return "HISTORIQUE ASSISTANTS";
    if (activeSection === "profile") return "MON PROFIL";
    if (activeSection === "comments") return "COMMENTAIRES RECUS";
    return "TABLEAU DE BORD SENIOR";
  }, [activeSection]);

  function openAssistantReview(assistantId) {
    if (assistantId) {
      setSelectedAssistantId(assistantId);
    }
    setActiveSection("reviews");
  }

  return (
    <div className="min-h-screen bg-[#EEF2F6] text-[#0E2B4F]">
      <div className="flex min-h-screen w-full">
        <aside className="min-h-screen w-full max-w-[270px] border-r border-slate-200/80 bg-white px-5 py-6">
          <div className="mb-8">
            <p className="text-4xl font-black tracking-tight text-[#0E4A6B]">SGE</p>
            <img src={logoY3} alt="Y3" className="mt-2 h-20 w-auto scale-x-110 origin-left" />
          </div>

          <nav className="space-y-5 text-sm">
            {menuGroups.map((group) => (
              <div key={group.title}>
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">{group.title}</p>
                <div className="space-y-1">
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    const isActive = activeSection === item.key;
                    const badge = item.key === "comments" ? (overviewData?.anonymousComments || []).length : 0;
                    return (
                      <button
                        key={item.key}
                        onClick={() => setActiveSection(item.key)}
                        className={`w-full rounded-md px-3 py-2 text-left transition ${
                          isActive ? "bg-[#DDE6EE] font-semibold text-[#0E4A6B]" : "text-[#0F3A63] hover:bg-slate-100"
                        }`}
                      >
                        <span className="flex items-center gap-2">
                          <Icon size={15} />
                          {item.label}
                          {badge > 0 && (
                            <span className="ml-auto rounded-full bg-[#7CB342] px-2 py-0.5 text-xs font-bold text-white">
                              {badge}
                            </span>
                          )}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>

          <button
            onClick={onLogout}
            className="mt-6 flex items-center gap-2 text-left text-sm font-medium text-[#0F3A63] hover:text-[#0E4A6B]"
          >
            <LogOut size={14} />
            Déconnexion
          </button>
        </aside>

        <main className="flex-1 p-5 md:p-8">
          <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-black tracking-tight text-[#0F3A63]">{pageTitle}</h1>
              {activeSection === "overview" ? <p className="mt-1 text-sm text-slate-500">{displayName} - {user?.grade}</p> : null}
            </div>

            <div className="flex items-center gap-5">
              <div className="flex items-center gap-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#1F4A72] text-xs font-bold text-white">{initials}</div>
                <div className="text-xs">
                  <p className="font-semibold text-[#73AF2E]">{displayName}</p>
                  <p className="font-semibold text-[#0F3A63]">{user?.grade}</p>
                </div>
              </div>
            </div>
          </header>

          {activeSection === "overview" ? (
            <Vueensemble
              onOpen={setActiveSection}
              onOpenReview={openAssistantReview}
              overviewData={overviewData}
              isLoading={isLoadingAssistants}
              errorMessage={assistantsError}
            />
          ) : activeSection === "assistants" ? (
            <Mesassistants
              assistants={assistants}
              isLoading={isLoadingAssistants}
              errorMessage={assistantsError}
              onOpenReview={(assistantId) => {
                setSelectedAssistantId(assistantId);
                setActiveSection("reviews");
              }}
            />
          ) : activeSection === "reviews" ? (
            <Evaluerassistants
              assistants={assistants}
              isLoadingAssistants={isLoadingAssistants}
              assistantsError={assistantsError}
              selectedAssistantId={selectedAssistantId}
              onAssistantChange={setSelectedAssistantId}
            />
          ) : activeSection === "results" ? (
            <MesresultatsSenior />
          ) : activeSection === "goals" ? (
            <MesobjectifsSenior missions={commonMissions} isLoading={isLoadingAssistants} errorMessage={assistantsError} />
          ) : activeSection === "self-evaluation" ? (
            <MonautoevaluationSenior user={user} />
          ) : activeSection === "calendar" ? (
            isLoadingSelfEvaluation ? (
              <section className="rounded-lg bg-white p-5 text-sm font-semibold text-slate-500 shadow-sm">Chargement de mon calendrier...</section>
            ) : selfEvaluationError ? (
              <section className="rounded-lg bg-white p-5 text-sm font-semibold text-red-600 shadow-sm">{selfEvaluationError}</section>
            ) : (
              <CalendrierAssistants
                assistants={assistants}
                ownMissionEvaluations={selfEvaluationData?.mission_evaluations || []}
                ownTitle="Mon calendrier"
                ownEyebrow="Mes missions senior évaluées"
                ownEmptyMessage="Aucune mission senior évaluée pour le moment."
                ownExportFileName="resultats-mission-senior.xls"
                emptyAssistantsMessage="Aucun assistant rattaché à ce Senior."
                exportFileNamePrefix="resultats-mission-assistant-senior"
                fetchAssistantEvaluation={getSeniorAssistantEvaluation}
                assignMission={addSeniorAssistantMission}
                assignLabel="Assistant"
              />
            )
          ) : activeSection === "history" ? (
            <Monhistorique />
          ) : activeSection === "assistants-history" ? (
            <HistoriqueAssistants
              assistants={assistants}
              isLoading={isLoadingAssistants}
              errorMessage={assistantsError}
            />
          ) : activeSection === "comments" ? (
            <CommentairesRecus
              comments={overviewData?.anonymousComments || []}
              isLoading={isLoadingAssistants}
            />
          ) : activeSection === "profile" ? (
            <ProfilePanel key={profileKey} user={user} onLogout={onLogout} onUserUpdate={onUserUpdate} />
          ) : (
            <Vueensemble
              onOpen={setActiveSection}
              onOpenReview={openAssistantReview}
              overviewData={overviewData}
              isLoading={isLoadingAssistants}
              errorMessage={assistantsError}
            />
          )}
        </main>
      </div>
    </div>
  );
}

export default VueSenior;
