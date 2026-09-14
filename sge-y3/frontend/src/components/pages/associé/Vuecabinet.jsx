import { useEffect, useMemo, useState } from "react";
import {
  ChevronsLeft,
  ChevronsRight,
  CircleHelp,
  FileStack,
  History,
  LayoutDashboard,
  LogOut,
  Settings2,
  UsersRound,
} from "lucide-react";
import SyntheseRH from "@/components/pages/associé/SynthèseRH";
import Autoevamanager from "@/components/pages/associé/autoevamanager";
import AutoevaluationAssocie from "@/components/pages/associé/AutoevaluationAssocie";
import AutoevaluationSupport from "@/components/pages/associé/AutoevaluationSupport";
import Monhistorique from "@/components/pages/associé/Monhistorique";
import HistoriqueCabinet from "@/components/pages/associé/HistoriqueCabinet";
import ComiteEvaluation from "@/components/pages/comite/ComiteEvaluation";
import ProfilePanel from "@/components/profile/ProfilePanel";
import NotificationBell from "@/components/common/NotificationBell";
import logoY3 from "@/assets/logo-y3.png";
import { saveCommitteeDecision } from "@/api/committee";
import { getAssociateOverview } from "@/api/associateOverview";
import { getDisplayName, getInitials } from "@/utils/userPresentation";

const NOTIFICATION_SECTION_MAP = {
  "rh-syntheses": "syntheses-rh",
  "rh-self-eval": "autoeval-managers",
  "rh-mission": "autoeval-managers",
  "manager-mission": "autoeval-managers",
  "assistant-mission": "autoeval-managers",
  "assistant-self-eval": "autoeval-managers",
  "associate-self-eval": "autoeval-associes",
  "support-self-eval": "autoeval-support",
};

// Ces notifications concernent une évaluation reçue directement (mission d'assistant/senior
// avec l'associé en co-destinataire), affichée dans le sous-onglet "Reçues" plutôt que "Managers".
const RECEIVED_EVALUATION_LINKS = new Set(["assistant-mission", "assistant-self-eval"]);

function resolveNotificationSection(link) {
  return NOTIFICATION_SECTION_MAP[link] || "vue-cabinet";
}

const sideMenu = [
  {
    title: "Tableau de bord",
    items: [{ key: "vue-cabinet", label: "Vue cabinet", icon: LayoutDashboard }],
  },
  {
    title: "Évaluations",
    items: [
      { key: "syntheses-rh", label: "Synthèses validées RH", icon: FileStack },
      { key: "committee", label: "Comité d'évaluation", icon: UsersRound },
    ],
  },
  {
    title: "Managers",
    items: [
      { key: "autoeval-managers", label: "Évaluation des collaborateurs", icon: UsersRound },
      { key: "autoeval-associes", label: "Auto-évaluation Associés", icon: UsersRound },
      { key: "autoeval-support", label: "Evaluation support", icon: UsersRound },
    ],
  },
  {
    title: "Historique",
    items: [
      { key: "history", label: "Mon historique", icon: History },
      { key: "cabinet-history", label: "Historique cabinet", icon: History },
    ],
  },
  {
    title: "Compte",
    items: [{ key: "profile", label: "Profil", icon: Settings2 }],
  },
];

const defaultOverview = {
  stats: [
    { title: "Collaborateurs évalués", value: "--", subtitle: "Chargement..." },
    { title: "Synthèses reçues RH", value: "--", subtitle: "Chargement..." },
    { title: "Auto-évaluations Managers", value: "--", subtitle: "Chargement..." },
  ],
  department_scores: [],
};

function Vuecabinet({ onLogout, onUserUpdate, user }) {
  const [activeSection, setActiveSection] = useState("vue-cabinet");
  const [initialManagerId, setInitialManagerId] = useState("");
  const [initialReceivedId, setInitialReceivedId] = useState("");
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [overview, setOverview] = useState(defaultOverview);
  const [overviewLoading, setOverviewLoading] = useState(true);
  const [overviewError, setOverviewError] = useState("");
  const displayName = getDisplayName(user);
  const initials = getInitials(user);
  const profileKey = [user?.id, user?.email, user?.first_name, user?.last_name, user?.grade, user?.department].join("|");
  const handleTopAction = (label) => window.alert(`${label} bientôt disponible.`);

  const pageTitle = useMemo(() => {
    if (activeSection === "syntheses-rh") return "Synthèses validées RH";
    if (activeSection === "committee") return "Comité d'évaluation";
    if (activeSection === "autoeval-managers") return "Évaluation des collaborateurs";
    if (activeSection === "autoeval-associes") return "Auto-évaluation Associés";
    if (activeSection === "autoeval-support") return "Evaluation Support";
    if (activeSection === "history") return "Mon historique";
    if (activeSection === "cabinet-history") return "Historique cabinet";
    if (activeSection === "profile") return "Mon profil";
    return "Vue cabinet";
  }, [activeSection]);

  useEffect(() => {
    if (activeSection !== "vue-cabinet") {
      return undefined;
    }

    let isMounted = true;

    async function loadOverview() {
      setOverviewLoading(true);
      setOverviewError("");

      try {
        const data = await getAssociateOverview();

        if (!isMounted) {
          return;
        }

        setOverview({
          ...defaultOverview,
          ...data,
          stats:
            Array.isArray(data?.stats) && data.stats.length
              ? data.stats.filter((card) => card.title !== "Décisions en attente")
              : defaultOverview.stats,
          department_scores: Array.isArray(data?.department_scores) ? data.department_scores : [],
        });
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setOverview(defaultOverview);
        setOverviewError(error.message || "Chargement impossible.");
      } finally {
        if (isMounted) {
          setOverviewLoading(false);
        }
      }
    }

    loadOverview();

    return () => {
      isMounted = false;
    };
  }, [activeSection]);

  return (
    <div className="min-h-screen bg-[#EDF1F5] text-[#0F3A63]">
      <div className="flex min-h-screen">
        <aside
          className={`relative w-full border-r border-slate-200 bg-[#F5F7FA] px-4 py-6 transition-all duration-200 ${
            isSidebarCollapsed ? "max-w-[88px]" : "max-w-[248px]"
          }`}
        >
          <button
            onClick={() => setIsSidebarCollapsed((value) => !value)}
            className="absolute right-3 top-3 z-20 inline-flex h-7 w-7 items-center justify-center rounded-full bg-[#E4E7EB] text-slate-500 shadow-sm hover:bg-slate-300/70"
            aria-label={isSidebarCollapsed ? "Déplier le menu" : "Replier le menu"}
            title={isSidebarCollapsed ? "Déplier le menu" : "Replier le menu"}
          >
            {isSidebarCollapsed ? <ChevronsRight size={14} /> : <ChevronsLeft size={14} />}
          </button>

          <div className={`mb-10 flex items-center ${isSidebarCollapsed ? "justify-center" : "gap-2"}`}>
            <img src={logoY3} alt="Y3" className={isSidebarCollapsed ? "h-10 w-auto object-contain" : "h-16 w-auto object-contain"} />
            {isSidebarCollapsed ? null : (
              <p className="text-xs font-bold leading-tight text-[#0F3A63]">Système de gestion des évaluations</p>
            )}
          </div>

          <nav className="space-y-6">
            {sideMenu.map((group) => (
              <div key={group.title}>
                {isSidebarCollapsed ? null : (
                  <p className="mb-2 text-xs font-medium text-slate-500">{group.title}</p>
                )}
                <div className="space-y-1">
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    const isActive = activeSection === item.key;
                    return (
                      <button
                        key={item.key}
                        onClick={() => setActiveSection(item.key)}
                        title={isSidebarCollapsed ? item.label : undefined}
                        className={`w-full rounded-md px-2 py-2 text-left text-sm ${
                          isActive ? "bg-[#C9D8E6] font-semibold text-[#0E4A6B]" : "text-[#0F3A63] hover:bg-slate-200/60"
                        }`}
                      >
                        <span className={`flex items-center gap-2 ${isSidebarCollapsed ? "justify-center" : ""}`}>
                          <Icon size={14} />
                          {isSidebarCollapsed ? null : item.label}
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
            title={isSidebarCollapsed ? "Déconnexion" : undefined}
            className={`mt-16 flex items-center gap-2 text-sm font-semibold text-[#0F3A63] hover:text-[#0E4A6B] ${
              isSidebarCollapsed ? "justify-center" : ""
            }`}
          >
            <LogOut size={14} />
            {isSidebarCollapsed ? null : "Déconnexion"}
          </button>
        </aside>

        <main className="flex-1 p-6 md:p-9">
          {activeSection === "vue-cabinet" ? (
            <>
              <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h1 className="text-3xl font-black tracking-tight text-[#0F3A63]">{pageTitle}</h1>
                  <p className="text-sm text-slate-500">
                    {displayName} - {user?.grade} - {overview.cycle_label || "Cycle 2025-2026"} - Synthèse globale
                  </p>
                </div>

                <div className="flex items-center gap-5">
                  <NotificationBell
                    onNavigate={(notification) => {
                      const section = resolveNotificationSection(notification.link);
                      setActiveSection(section);
                      if (section !== "autoeval-managers") {
                        return;
                      }
                      if (RECEIVED_EVALUATION_LINKS.has(notification.link) && notification.entity_id) {
                        setInitialReceivedId(String(notification.entity_id));
                      } else if (notification.actor_id) {
                        setInitialManagerId(String(notification.actor_id));
                      }
                    }}
                  />
                  <button onClick={() => handleTopAction("Aide")} className="text-slate-500 hover:text-[#0F3A63]">
                    <CircleHelp size={18} />
                  </button>
                  <div className="flex items-center gap-2">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#1F4A72] text-xs font-bold text-white">{initials}</div>
                    <div className="text-xs">
                      <p className="font-semibold text-[#73AF2E]">{displayName}</p>
                      <p className="font-semibold text-[#0F3A63]">{user?.grade}</p>
                    </div>
                  </div>
                </div>
              </header>

              <section className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                {overview.stats.map((card) => (
                  <article key={card.title} className="rounded-lg bg-[#0D496A] p-4 text-white">
                    <p className="text-sm font-semibold">{card.title}</p>
                    <p className="mt-2 text-2xl font-extrabold leading-none">{card.value}</p>
                    <p className="mt-2 text-xs text-slate-200">{card.subtitle}</p>
                  </article>
                ))}
              </section>

              {overviewError ? (
                <section className="mb-8 rounded-xl border border-[#E3C9C9] bg-[#FFF4F4] px-4 py-3 text-sm font-semibold text-[#9F2D2D]">
                  {overviewError}
                </section>
              ) : null}

              <section className="rounded-xl bg-white p-5 shadow-sm xl:max-w-[56%]">
                <h2 className="mb-4 text-2xl font-extrabold text-[#0F3A63]">Score moyen par département</h2>
                {overview.department_scores.length ? (
                  <div className="space-y-4">
                    {overview.department_scores.map((item) => (
                      <div key={item.label} className="grid grid-cols-[1fr_1.2fr_auto] items-center gap-4">
                        <p className="text-sm font-semibold">{item.label}</p>
                        <div className="h-3 rounded-full bg-slate-200">
                          <div className="h-3 rounded-full bg-[#C53B3B]" style={{ width: item.width }} />
                        </div>
                        <p className="text-sm font-semibold">{typeof item.score === "number" ? item.score.toFixed(1) : "--"}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm font-semibold text-slate-500">
                    {overviewLoading ? "Chargement des moyennes..." : "Aucune moyenne disponible pour le moment."}
                  </p>
                )}
              </section>
            </>
          ) : activeSection === "syntheses-rh" ? (
            <SyntheseRH />
          ) : activeSection === "committee" ? (
            <ComiteEvaluation
              actorLabel="Les associés"
              classifiableLabel="Managers et RH à ajouter au classement"
              lockPrimaryClassification
              participantScope="none"
              secondaryParticipantScope="leadership"
              rateEnabled
              showCommitteeMembers={false}
              initialDecisionScope="rh-final"
              editableDecisionScope="associate-final"
              submitLabel="Envoyer les taux d'augmentation à la RH"
              submittedLabel="Taux d'augmentation envoyés à la RH"
              successMessage="Les classements et les taux d'augmentation ont été transmis à la RH."
              onSubmit={(decisions) => saveCommitteeDecision({ scope: "associate-final", cycle_label: "Cycle 2025-2026", decisions })}
              workflowText="Les assistants, seniors, assistants managers et membres du service support classés par la RH restent dans leurs bulles. Les associés ajoutent ensuite uniquement la RH et les managers / senior managers, saisissent leur taux, puis envoient le tout à la RH."
            />
          ) : activeSection === "autoeval-managers" ? (
            <Autoevamanager initialManagerId={initialManagerId} initialReceivedId={initialReceivedId} />
          ) : activeSection === "autoeval-associes" ? (
            <AutoevaluationAssocie />
          ) : activeSection === "autoeval-support" ? (
            <AutoevaluationSupport />
          ) : activeSection === "history" ? (
            <Monhistorique />
          ) : activeSection === "cabinet-history" ? (
            <HistoriqueCabinet />
          ) : activeSection === "profile" ? (
            <ProfilePanel key={profileKey} user={user} onLogout={onLogout} onUserUpdate={onUserUpdate} />
          ) : (
            <section className="rounded-xl bg-white p-6 shadow-sm">
              <h2 className="text-2xl font-extrabold text-[#0F3A63]">{pageTitle}</h2>
              <p className="mt-3 text-sm text-slate-600">
                Cette section sera disponible prochainement. Les données principales sont déjà disponibles dans les autres vues.
              </p>
            </section>
          )}
        </main>
      </div>
    </div>
  );
}

export default Vuecabinet;
