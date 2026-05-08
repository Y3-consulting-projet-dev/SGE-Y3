import { useMemo, useState } from "react";
import {
  Bell,
  CircleHelp,
  FileChartColumnIncreasing,
  FileStack,
  LayoutDashboard,
  LogOut,
  MonitorCheck,
  Settings2,
  UsersRound,
} from "lucide-react";
import SyntheseRH from "@/components/pages/associé/SynthèseRH";
import Prendredecision from "@/components/pages/associé/Prendredecision";
import Autoevamanager from "@/components/pages/associé/autoevamanager";
import Histoireanalytique from "@/components/pages/associé/Histoireanalytique";
import ProfilePanel from "@/components/profile/ProfilePanel";
import logoY3 from "@/assets/logo-y3.png";
import { getDisplayName, getInitials } from "@/lib/userPresentation";

const sideMenu = [
  {
    title: "Tableau de bord",
    items: [{ key: "vue-cabinet", label: "Vue cabinet", icon: LayoutDashboard }],
  },
  {
    title: "Evaluations",
    items: [
      { key: "syntheses-rh", label: "Syntheses validees RH", icon: FileStack },
      { key: "decisions", label: "Decisions en attente", icon: MonitorCheck },
    ],
  },
  {
    title: "Managers",
    items: [{ key: "autoeval-managers", label: "Auto-eval Managers", icon: UsersRound }],
  },
  {
    title: "Reporting",
    items: [{ key: "history", label: "Historique & analytics", icon: FileChartColumnIncreasing }],
  },
  {
    title: "Compte",
    items: [{ key: "profile", label: "Profil", icon: Settings2 }],
  },
];

const summaryCards = [
  { title: "Collaborateurs evalues", value: "18/24", subtitle: "75% du cabinet" },
  { title: "Syntheses recues RH", value: "11", subtitle: "Pretes pour decision" },
  { title: "Decisions en attente", value: "4", subtitle: "Action requise" },
  { title: "Auto-evals Managers", value: "4", subtitle: "A examiner" },
];

const decisionSplit = [
  { label: "Augmentation", count: 3, width: "68%", color: "bg-[#C53B3B]" },
  { label: "Promotion", count: 2, width: "48%", color: "bg-[#4D3AC5]" },
  { label: "Maintien", count: 2, width: "48%", color: "bg-[#4D3AC5]" },
  { label: "Formation obligatoire", count: 1, width: "26%", color: "bg-[#4D3AC5]" },
];

const urgentDecisions = [
  { initials: "RO", name: "Revita OULE", role: "Manager - Auto-eval", score: "4.1 / 5" },
  { initials: "AA", name: "Axelle AMANI", role: "Manager - Auto-eval", score: "4.1 / 5" },
];

const departmentScores = [
  { label: "Audit", score: "4.2", width: "84%" },
  { label: "Comptabilite", score: "3.9", width: "73%" },
  { label: "Conseil Financier", score: "3.5", width: "60%" },
  { label: "Conseil Operationnel", score: "3", width: "44%" },
];

function Vuecabinet({ onLogout, onUserUpdate, user }) {
  const [activeSection, setActiveSection] = useState("vue-cabinet");
  const [selectedDecision, setSelectedDecision] = useState(null);
  const displayName = getDisplayName(user);
  const initials = getInitials(user);
  const profileKey = [user?.id, user?.email, user?.first_name, user?.last_name, user?.grade, user?.department].join("|");
  const handleTopAction = (label) => window.alert(`${label} bientot disponible.`);

  const pageTitle = useMemo(() => {
    if (activeSection === "syntheses-rh") return "Syntheses validees RH";
    if (activeSection === "decisions") return "Decisions en attente";
    if (activeSection === "autoeval-managers") return "Auto-eval Managers";
    if (activeSection === "history") return "Historique & analytics";
    if (activeSection === "profile") return "Mon profil";
    return "Vue cabinet";
  }, [activeSection]);

  return (
    <div className="min-h-screen bg-[#EDF1F5] text-[#0F3A63]">
      <div className="flex min-h-screen">
        <aside className="w-full max-w-[248px] border-r border-slate-200 bg-[#F5F7FA] px-4 py-6">
          <div className="mb-10">
            <p className="text-4xl font-black tracking-tight text-[#0E4A6B]">SGE</p>
            <img src={logoY3} alt="Y3" className="mt-2 h-16 w-auto object-contain" />
          </div>

          <nav className="space-y-6">
            {sideMenu.map((group) => (
              <div key={group.title}>
                <p className="mb-2 text-xs font-medium text-slate-500">{group.title}</p>
                <div className="space-y-1">
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    const isActive = activeSection === item.key;
                    return (
                      <button
                        key={item.key}
                        onClick={() => setActiveSection(item.key)}
                        className={`w-full rounded-md px-2 py-2 text-left text-sm ${
                          isActive ? "bg-[#C9D8E6] font-semibold text-[#0E4A6B]" : "text-[#0F3A63] hover:bg-slate-200/60"
                        }`}
                      >
                        <span className="flex items-center gap-2">
                          <Icon size={14} />
                          {item.label}
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
            className="mt-16 flex items-center gap-2 text-sm font-semibold text-[#0F3A63] hover:text-[#0E4A6B]"
          >
            <LogOut size={14} />
            Deconnexion
          </button>
        </aside>

        <main className="flex-1 p-6 md:p-9">
          {activeSection === "vue-cabinet" ? (
            <>
              <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h1 className="text-3xl font-black tracking-tight text-[#0F3A63]">{pageTitle}</h1>
                  <p className="text-sm text-slate-500">
                    {displayName} - {user?.grade} - Cycle 2026 - Synthese globale
                  </p>
                </div>

                <div className="flex items-center gap-5">
                  <button onClick={() => handleTopAction("Notifications")} className="text-slate-500 hover:text-[#0F3A63]">
                    <Bell size={18} />
                  </button>
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

              <section className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                {summaryCards.map((card) => (
                  <article key={card.title} className="rounded-lg bg-[#0D496A] p-4 text-white">
                    <p className="text-sm font-semibold">{card.title}</p>
                    <p className="mt-2 text-2xl font-extrabold leading-none">{card.value}</p>
                    <p className="mt-2 text-xs text-slate-200">{card.subtitle}</p>
                  </article>
                ))}
              </section>

              <section className="mb-8 grid grid-cols-1 gap-5 xl:grid-cols-2">
                <article className="rounded-xl bg-white p-5 shadow-sm">
                  <h2 className="mb-4 text-2xl font-extrabold text-[#0F3A63]">Repartition des decisions prises</h2>
                  <div className="space-y-4">
                    {decisionSplit.map((item) => (
                      <div key={item.label} className="grid grid-cols-[1fr_1.2fr_auto] items-center gap-4">
                        <p className="text-sm font-semibold">{item.label}</p>
                        <div className="h-3 rounded-full bg-slate-200">
                          <div className={`h-3 rounded-full ${item.color}`} style={{ width: item.width }} />
                        </div>
                        <p className="text-sm font-semibold">{item.count}</p>
                      </div>
                    ))}
                  </div>
                  <p className="mt-5 text-xs font-semibold text-slate-500">7 decisions prises sur 11 syntheses</p>
                </article>

                <article className="rounded-xl bg-white p-5 shadow-sm">
                  <h2 className="mb-4 text-2xl font-extrabold text-[#0F3A63]">Decisions urgentes</h2>
                  <div className="space-y-4">
                    {urgentDecisions.map((item) => (
                      <div key={item.name} className="flex flex-wrap items-center justify-between gap-4 rounded-lg bg-slate-50 p-3">
                        <div className="flex items-center gap-3">
                          <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-slate-300 text-sm font-bold text-slate-600">
                            {item.initials}
                          </span>
                          <div>
                            <p className="text-lg font-extrabold text-[#0F3A63]">{item.name}</p>
                            <p className="text-sm font-semibold text-[#1E5580]">{item.role}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div>
                            <p className="text-sm font-semibold text-slate-500">Score RH valide</p>
                            <p className="text-2xl font-extrabold leading-none text-[#79B742]">{item.score}</p>
                          </div>
                          <button
                            onClick={() => {
                              setSelectedDecision(item);
                              setActiveSection("decisions");
                            }}
                            className="rounded-lg bg-[#7EB83E] px-5 py-3 text-sm font-extrabold text-white hover:bg-[#70A436]"
                          >
                            Decider
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </article>
              </section>

              <section className="rounded-xl bg-white p-5 shadow-sm xl:max-w-[56%]">
                <h2 className="mb-4 text-2xl font-extrabold text-[#0F3A63]">Score moyen par departement</h2>
                <div className="space-y-4">
                  {departmentScores.map((item) => (
                    <div key={item.label} className="grid grid-cols-[1fr_1.2fr_auto] items-center gap-4">
                      <p className="text-sm font-semibold">{item.label}</p>
                      <div className="h-3 rounded-full bg-slate-200">
                        <div className="h-3 rounded-full bg-[#C53B3B]" style={{ width: item.width }} />
                      </div>
                      <p className="text-sm font-semibold">{item.score}</p>
                    </div>
                  ))}
                </div>
              </section>
            </>
          ) : activeSection === "syntheses-rh" ? (
            <SyntheseRH />
          ) : activeSection === "decisions" ? (
            <Prendredecision candidate={selectedDecision} />
          ) : activeSection === "autoeval-managers" ? (
            <Autoevamanager />
          ) : activeSection === "history" ? (
            <Histoireanalytique />
          ) : activeSection === "profile" ? (
            <ProfilePanel key={profileKey} user={user} onLogout={onLogout} onUserUpdate={onUserUpdate} />
          ) : (
            <section className="rounded-xl bg-white p-6 shadow-sm">
              <h2 className="text-2xl font-extrabold text-[#0F3A63]">{pageTitle}</h2>
              <p className="mt-3 text-sm text-slate-600">
                Cette section sera disponible prochainement. Les donnees principales sont deja disponibles dans les autres vues.
              </p>
            </section>
          )}
        </main>
      </div>
    </div>
  );
}

export default Vuecabinet;
