import { useEffect, useMemo, useState } from "react";
import { BarChart3, CalendarDays, FileBarChart2, FolderKanban, LayoutDashboard, LogOut, MessageSquare, Settings2, Users, X } from "lucide-react";
import Monequipe from "@/components/pages/manager/Monequipe";
import Evaluermonequipe from "@/components/pages/manager/Evaluermonequipe";
import Objectifsequipe from "@/components/pages/manager/Objectifsequipe";
import Monautoevaluation from "@/components/pages/manager/Monautoevaluation";
import Rapportsequipe from "@/components/pages/manager/Rapportsequipe";
import CalendrierAssistants from "@/components/pages/collaborator/CalendrierAssistants";
import ProfilePanel from "@/components/profile/ProfilePanel";
import CommentairesRecus from "@/components/CommentairesRecus";
import logoY3 from "@/assets/logo-y3.png";
import { getDisplayName, getInitials } from "@/lib/userPresentation";
import { createManagerMemberMission, getManagerMemberEvaluation, getManagerOverview, getManagerSelfEvaluation } from "@/lib/managerOverview";

const sidebarSections = [
  {
    group: "Tableau de bord",
    items: [
      { key: "overview", label: "Vue d'ensemble", icon: LayoutDashboard },
      { key: "comments", label: "Commentaires reçus", icon: MessageSquare },
    ],
  },
  {
    group: "Equipe",
    items: [
      { key: "team", label: "Mon équipe", icon: Users },
      { key: "team-goals", label: "Objectifs d'équipe", icon: FolderKanban },
    ],
  },
  {
    group: "Mon evaluation",
    items: [
      { key: "self-evaluation", label: "Mon auto-évaluation", icon: BarChart3 },
      { key: "calendar", label: "Mon calendrier", icon: CalendarDays },
    ],
  },
  { group: "Reporting", items: [{ key: "reports", label: "Rapports", icon: FileBarChart2 }] },
  { group: "Compte", items: [{ key: "profile", label: "Profil", icon: Settings2 }] },
];

function formatSubmissionDate(value) {
  if (!value) return "Soumise";
  return `Soumise le ${new Date(value).toLocaleDateString("fr-FR")}`;
}

function ManagerDashboard({ onLogout, onUserUpdate, user }) {
  const [activeSection, setActiveSection] = useState("overview");
  const [searchTerm, setSearchTerm] = useState("");
  const [relanceMessage, setRelanceMessage] = useState("");
  const [createGoalSignal, setCreateGoalSignal] = useState(0);
  const [selectedMember, setSelectedMember] = useState(null);
  const [overviewData, setOverviewData] = useState(null);
  const [overviewError, setOverviewError] = useState("");
  const [isLoadingOverview, setIsLoadingOverview] = useState(true);
  const [selfEvaluationData, setSelfEvaluationData] = useState(null);
  const [selfEvaluationError, setSelfEvaluationError] = useState("");
  const [isLoadingSelfEvaluation, setIsLoadingSelfEvaluation] = useState(false);

  const displayName = getDisplayName(user);
  const initials = getInitials(user);
  const profileKey = [user?.id, user?.email, user?.first_name, user?.last_name, user?.grade, user?.department].join("|");

  const pageTitle = useMemo(() => {
    if (activeSection === "overview") return "VUE D'ENSEMBLE";
    if (activeSection === "team") return "MON EQUIPE";
    if (activeSection === "team-goals") return "OBJECTIFS D'EQUIPE";
    if (activeSection === "self-evaluation") return "MON AUTO-EVALUATION";
    if (activeSection === "calendar") return "MON CALENDRIER";
    if (activeSection === "reports") return "RAPPORTS";
    if (activeSection === "profile") return "MON PROFIL";
    if (activeSection === "comments") return "COMMENTAIRES RECUS";
    return "WORKFLOW MANAGER";
  }, [activeSection]);

  useEffect(() => {
    let cancelled = false;

    async function loadOverview() {
      try {
        setIsLoadingOverview(true);
        setOverviewError("");
        const response = await getManagerOverview();

        if (!cancelled) {
          setOverviewData(response);
        }
      } catch (error) {
        if (!cancelled) {
          setOverviewError(error.message || "Chargement de la vue manager impossible.");
        }
      } finally {
        if (!cancelled) {
          setIsLoadingOverview(false);
        }
      }
    }

    loadOverview();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (activeSection !== "calendar") {
      return undefined;
    }

    let cancelled = false;

    async function loadSelfEvaluation() {
      try {
        setIsLoadingSelfEvaluation(true);
        setSelfEvaluationError("");
        const response = await getManagerSelfEvaluation();

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

  const summary = overviewData?.summary || {};
  const members = overviewData?.members || [];
  const assistantMembers = members.filter((member) => member.code_categorie === "8C" || member.grade === "Assistant");
  const pendingEvaluations = overviewData?.pendingEvaluations || [];
  const memberSummaryText = isLoadingOverview
    ? "Chargement..."
    : `${summary.assistantsCount || 0} Assistant(s), ${summary.seniorsCount || 0} Senior(s), ${summary.assistantManagersCount || 0} Assistant manager(s)`;

  const pendingSummaryText = isLoadingOverview
    ? "Chargement..."
    : pendingEvaluations.length
      ? pendingEvaluations.slice(0, 2).map((evaluation) => evaluation.grade).join(", ")
      : "Aucune évaluation globale en attente";

  const relanceMember = (member) => {
    setRelanceMessage(`Relance envoyée à ${member.name} pour finaliser son évaluation.`);
  };

  const openMemberEvaluation = (member) => {
    const resolvedMember = members.find((item) => item.id === member?.id) || member;

    setSelectedMember({
      ...resolvedMember,
      role: resolvedMember?.role || resolvedMember?.grade,
      status: resolvedMember?.status || resolvedMember?.evaluationStatus || "En attente",
    });
  };

  const renderOverview = () => {
    if (overviewError) {
      return <section className="rounded-lg bg-white p-5 text-sm font-semibold text-red-600 shadow-sm">{overviewError}</section>;
    }

    return (
      <>
        <div className="mb-7 border-l-4 border-[#7CB342] bg-[#DCECCB] px-4 py-3 text-sm font-semibold text-[#184D2E]">
          {isLoadingOverview
            ? "Chargement de la vue d'ensemble..."
            : summary.selfEvaluationStatus === "Soumis aux Managers" || summary.selfEvaluationStatus === "Soumis au Manager"
              ? "Mon auto-évaluation a déjà été soumise."
              : "Mon auto-évaluation est en attente."}
        </div>


        <section className="mb-7 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <button
            type="button"
            onClick={() => setActiveSection("team")}
            className="rounded-lg bg-[#003B63] p-5 text-left text-white transition hover:bg-[#0B4C7A]"
          >
            <div className="mb-4 flex items-start justify-between">
              <p className="text-sm">Membres</p>
              <p className="text-2xl font-extrabold">{isLoadingOverview ? "..." : summary.totalMembers || 0}</p>
            </div>
            <p className="text-sm text-slate-200">{memberSummaryText}</p>
          </button>

          <article className="rounded-lg bg-[#003B63] p-5 text-left text-white">
            <div className="mb-4 flex items-start justify-between">
              <p className="text-sm">Auto-évaluations reçues</p>
              <p className="text-2xl font-extrabold">
                {isLoadingOverview ? "..." : `${summary.receivedSelfEvaluationsCount || 0}/${summary.totalMembers || 0}`}
              </p>
            </div>
            <p className="text-sm text-slate-200">
              {isLoadingOverview ? "Chargement..." : `${summary.pendingSelfEvaluationsCount || 0} en attente`}
            </p>
          </article>

          <button
            type="button"
            onClick={() => setActiveSection("team")}
            className="rounded-lg bg-[#003B63] p-5 text-left text-white transition hover:bg-[#0B4C7A]"
          >
            <div className="mb-4 flex items-start justify-between">
              <p className="text-sm">Evaluations à donner</p>
              <p className="text-2xl font-extrabold text-[#F34D4D]">{isLoadingOverview ? "..." : summary.pendingEvaluationsCount || 0}</p>
            </div>
            <p className="text-sm text-slate-200">{pendingSummaryText}</p>
          </button>

          <button
            type="button"
            onClick={() => setActiveSection("self-evaluation")}
            className="rounded-lg bg-[#003B63] p-5 text-left text-white transition hover:bg-[#0B4C7A]"
          >
            <p className="mb-4 text-sm">Mon auto-évaluation</p>
            <p className="text-base font-bold text-[#F34D4D]">{isLoadingOverview ? "Chargement..." : summary.selfEvaluationStatus || "En attente"}</p>
          </button>
        </section>

        <section className="grid grid-cols-1 gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <article className="rounded-xl bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-sm font-semibold text-[#0F3A63]">Evaluations globales en attente</h2>
              <span className="rounded-full bg-[#DCECCB] px-3 py-1 text-xs font-bold text-[#4E8B1B]">
                {isLoadingOverview ? "..." : `${pendingEvaluations.length} évaluation(s)`}
              </span>
            </div>

            {pendingEvaluations.length ? (
              <div className="space-y-3">
                {pendingEvaluations.map((evaluation) => (
                  <button
                    key={evaluation.id}
                    type="button"
                    onClick={() => openMemberEvaluation(evaluation)}
                    className="w-full rounded-lg bg-[#DFECD4] p-3 text-left transition hover:bg-[#D1E6C0]"
                  >
                    <p className="text-sm font-semibold text-[#0F3A63]">{evaluation.name}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {evaluation.grade} - {evaluation.department}
                    </p>
                    <p className="mt-2 text-xs font-semibold text-[#0F3A63]">{formatSubmissionDate(evaluation.submittedAt)}</p>
                  </button>
                ))}
              </div>
            ) : (
              <p className="rounded-lg bg-slate-50 p-4 text-sm font-semibold text-slate-500">
                Aucune Evaluation globale en attente pour le moment.
              </p>
            )}
          </article>

          <article className="rounded-xl bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-sm font-semibold text-[#0F3A63]">Périmetre manager</h2>
            <div className="space-y-3 text-sm text-slate-600">
              <p>
                Cette vue prend en compte les assistants, seniors et assistants managers du même département.
              </p>
              <p>
                Si vous êtes en AUDIT, vous récupérez aussi les profils en AUDIT & EXPERTISE COMPTABLE. Même logique pour EXPERTISE COMPTABLE.
              </p>
              <p>
                Les cartes du haut montrent uniquement les auto-évaluations globales soumises à votre compte manager.
              </p>
            </div>
          </article>
        </section>
      </>
    );
  };

  return (
    <div className="min-h-screen bg-[#EEF2F6] text-[#0E2B4F]">
      <div className="flex min-h-screen w-full">
        <aside className="min-h-screen w-full max-w-[260px] border-r border-slate-200/80 bg-white px-5 py-6">
          <div className="mb-8 flex items-center gap-3">
            <div className="leading-none text-4xl font-black tracking-tight text-[#0E4A6B]">
              SGE
              <img src={logoY3} alt="Y3" className="mt-2 h-20 w-auto scale-x-110 origin-left" />
            </div>
          </div>

          <nav className="space-y-5 text-sm">
            {sidebarSections.map((section) => (
              <div key={section.group}>
                <p className="mb-2 text-xs font-medium text-slate-500">{section.group}</p>
                <div className="space-y-1">
                  {section.items.map((item) => {
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
                          <Icon size={14} />
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

            <div className="mb-6 rounded-2xl bg-[#F5F8FB] p-4 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#0F3A63] text-sm font-bold text-white">
                  {initials}
                </div>
                <div>
                  <p className="text-sm font-bold text-[#0F3A63]">{displayName}</p>
                  <p className="text-xs text-slate-500">{user?.grade}</p>
                </div>
              </div>
            </div>

            <button
              onClick={onLogout}
              className="flex items-center gap-2 pt-6 text-left font-medium text-[#0F3A63] hover:text-[#0E4A6B]"
            >
              <LogOut size={14} />
              Déconnexion
            </button>
          </nav>
        </aside>

        <main className="flex-1 p-5 md:p-8">
          <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-black tracking-tight text-[#0F3A63]">{pageTitle}</h1>
              {activeSection === "overview" ? <p className="mt-1 text-sm text-slate-500">{displayName} - {user?.grade}</p> : null}
            </div>

            {activeSection === "team-goals" ? (
              <button
                onClick={() => setCreateGoalSignal((value) => value + 1)}
                className="rounded-full bg-[#8BC53F] px-5 py-2 text-sm font-semibold text-white"
              >
                Créer un objectif
              </button>
            ) : activeSection === "overview" ? (
              <button
                onClick={() => setActiveSection("team")}
                className="rounded-full bg-[#8BC53F] px-5 py-2 text-sm font-semibold text-[#0B2F4F]"
              >
                Ouvrir l'équipe
              </button>
            ) : null}
          </header>

          {activeSection === "overview" ? (
            renderOverview()
          ) : activeSection === "team" ? (
            <Monequipe
              searchTerm={searchTerm}
              onSearchChange={setSearchTerm}
              onAction={setActiveSection}
              onEvaluate={openMemberEvaluation}
              onRelance={relanceMember}
              relanceMessage={relanceMessage}
              members={members}
              extraMembers={[]}
            />
          ) : activeSection === "team-goals" ? (
            <Objectifsequipe createSignal={createGoalSignal} />
          ) : activeSection === "self-evaluation" ? (
            <Monautoevaluation />
          ) : activeSection === "calendar" ? (
            isLoadingSelfEvaluation ? (
              <section className="rounded-lg bg-white p-5 text-sm font-semibold text-slate-500 shadow-sm">Chargement de mon calendrier...</section>
            ) : selfEvaluationError ? (
              <section className="rounded-lg bg-white p-5 text-sm font-semibold text-red-600 shadow-sm">{selfEvaluationError}</section>
            ) : (
              <CalendrierAssistants
                assistants={assistantMembers}
                ownMissionEvaluations={selfEvaluationData?.mission_evaluations || []}
                ownTitle="Mon calendrier"
                ownEyebrow="Mes missions manager évaluées"
                ownEmptyMessage="Aucune mission manager évaluée pour le moment."
                ownExportFileName="resultats-mission-manager.xls"
                emptyAssistantsMessage="Aucun assistant rattaché à ce Manager."
                exportFileNamePrefix="resultats-mission-assistant-manager"
                fetchAssistantEvaluation={getManagerMemberEvaluation}
                assignMission={createManagerMemberMission}
                assignLabel="Membre de l'équipe"
              />
            )
          ) : activeSection === "reports" ? (
            <Rapportsequipe />
          ) : activeSection === "comments" ? (
            <CommentairesRecus
              comments={overviewData?.anonymousComments || []}
              isLoading={isLoadingOverview}
            />
          ) : (
            <ProfilePanel key={profileKey} user={user} onLogout={onLogout} onUserUpdate={onUserUpdate} />
          )}
        </main>
      </div>

      {selectedMember ? (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-[#0B1F33]/60 px-4 py-6"
          onClick={() => setSelectedMember(null)}
        >
          <section
            className="w-full max-w-6xl rounded-lg bg-[#EEF2F6] p-5 shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <header className="mb-5 flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-4">
              <div>
                <p className="text-xs font-bold text-[#79B742]">Evaluation Manager</p>
                <h2 className="text-2xl font-black text-[#0F3A63]">{selectedMember.name}</h2>
                <p className="text-sm font-semibold text-slate-500">
                  {selectedMember.role || selectedMember.grade} - {selectedMember.status || "En attente"}
                </p>
              </div>
              <button
                onClick={() => setSelectedMember(null)}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-[#0F3A63] shadow-sm hover:bg-slate-100"
                aria-label="Fermer la modal"
              >
                <X size={18} />
              </button>
            </header>

            <Evaluermonequipe member={selectedMember} />
          </section>
        </div>
      ) : null}
    </div>
  );
}

export default ManagerDashboard;
