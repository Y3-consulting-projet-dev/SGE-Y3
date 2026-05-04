import { useMemo, useState } from "react";
import { BarChart3, ClipboardCheck, FileBarChart2, FolderKanban, LayoutDashboard, LogOut, Users } from "lucide-react";
import Monequipe from "@/components/pages/Monequipe";
import Evaluermonequipe from "@/components/pages/Evaluermonequipe";
import Objectifsequipe from "@/components/pages/Objectifsequipe";
import Monautoevaluation from "@/components/pages/Monautoevaluation";
import Rapportsequipe from "@/components/pages/Rapportsequipe";
import logoY3 from "@/assets/logo-y3.png";

const statusBars = [
  { label: "Brouillon", value: 45, count: 2, color: "bg-slate-500" },
  { label: "En cours", value: 55, count: 3, color: "bg-[#3D69B3]" },
  { label: "Soumis a moi", value: 78, count: 1, color: "bg-[#32B3E0]" },
  { label: "Soumis a RH", value: 86, count: 0, color: "bg-[#86C440]" },
];

const requiredActions = [
  { id: "OK", title: "Verifier auto-eval - Kone K.", subtitle: "Senior - Soumise le 18/04", target: "team-review" },
  { id: 2, title: "Evaluer Traore M.", subtitle: "Collaborateur - Auto-eval recue", target: "team-evaluate" },
  {
    id: 3,
    title: "Completer mon auto-evaluation",
    subtitle: "Deadline 25/04 - Pour l'associe",
    target: "self-evaluation",
  },
];

const sidebarSections = [
  { group: "Tableau de bord", items: [{ key: "overview", label: "Vue d'ensemble", icon: LayoutDashboard }] },
  {
    group: "Equipe",
    items: [
      { key: "team", label: "Mon equipe", icon: Users },
      { key: "team-evaluate", label: "Evaluer mon equipe", icon: ClipboardCheck },
      { key: "team-goals", label: "Objectifs equipe", icon: FolderKanban },
    ],
  },
  { group: "Mon evaluation", items: [{ key: "self-evaluation", label: "Mon auto-evaluation", icon: BarChart3 }] },
  { group: "Reporting", items: [{ key: "reports", label: "Rapports equipe", icon: FileBarChart2 }] },
];

const availableSections = new Set(["overview", "team", "team-evaluate", "team-goals", "self-evaluation", "reports", "actions"]);

const sectionContent = {
  notifications: "Consulte les dernieres notifications et relance les collaborateurs en attente.",
  team: "Visualise la liste des membres, leurs roles et leurs avancements.",
  "team-evaluate": "Demarre ou reprends les evaluations de ton equipe.",
  "team-review": "Verifie les auto-evaluations soumises avant validation.",
  "team-goals": "Suis les objectifs de l'equipe et ajuste les priorites.",
  "self-evaluation": "Complete ou mets a jour ton auto-evaluation manager.",
  reports: "Genere et exporte les rapports de performance de l'equipe.",
  actions: "Retrouve toutes les actions prioritaires du workflow.",
};

function SectionPanel({ title, description, onBack }) {
  return (
    <section className="rounded-xl bg-white p-8 shadow-sm">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Workflow</p>
      <h2 className="mb-4 text-2xl font-extrabold text-[#0F3A63]">{title}</h2>
      <p className="mb-6 max-w-[680px] text-sm text-slate-600">{description}</p>
      <button
        onClick={onBack}
        className="rounded-lg bg-[#003B63] px-5 py-2 text-sm font-semibold text-white hover:bg-[#0B4C7A]"
      >
        Retour a la vue d'ensemble
      </button>
    </section>
  );
}

function ManagerDashboard({ onLogout }) {
  const [activeSection, setActiveSection] = useState("overview");
  const [searchTerm, setSearchTerm] = useState("");
  const canOpenSection = (sectionKey) => availableSections.has(sectionKey);
  const goToSection = (sectionKey) => {
    if (canOpenSection(sectionKey)) setActiveSection(sectionKey);
  };

  const pageTitle = useMemo(() => {
    if (activeSection === "overview") return "VUE D'ENSEMBLE";
    if (activeSection === "team") return "MON EQUIPE";
    if (activeSection === "team-evaluate") return "EVALUER MON EQUIPE";
    if (activeSection === "team-goals") return "OBJECTIFS EQUIPE";
    if (activeSection === "self-evaluation") return "MON AUTO-EVALUATION";
    if (activeSection === "reports") return "RAPPORTS EQUIPE";
    if (activeSection === "actions") return "ACTIONS REQUISES";
    return "WORKFLOW MANAGER";
  }, [activeSection]);

  const showOverview = activeSection === "overview";

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
                    const isActive = activeSection === item.key;
                    const Icon = item.icon;
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
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}

            <button
              onClick={onLogout}
              className="flex items-center gap-2 pt-6 text-left font-medium text-[#0F3A63] hover:text-[#0E4A6B]"
            >
              <LogOut size={14} />
              Deconnexion
            </button>
          </nav>
        </aside>

        <main className="flex-1 p-5 md:p-8">
          <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
            <h1 className="text-3xl font-black tracking-tight text-[#0F3A63]">{pageTitle}</h1>
            {activeSection === "team" ? (
              <div className="flex items-center gap-3">
                <button
                  disabled
                  className="text-sm font-semibold text-[#0F3A63] underline-offset-4 hover:underline"
                >
                  Notifications
                </button>
                <button className="rounded-full bg-[#8BC53F] px-5 py-2 text-sm font-semibold text-white">
                  Ajouter un membre
                </button>
              </div>
            ) : activeSection === "team-evaluate" ? (
              <div className="flex items-center gap-3">
                <button
                  disabled
                  className="text-sm font-semibold text-[#0F3A63] underline-offset-4 hover:underline"
                >
                  Notifications
                </button>
                <button className="rounded-full bg-[#8BC53F] px-5 py-2 text-sm font-semibold text-white">
                  Soumettre a la RH
                </button>
              </div>
            ) : activeSection === "team-goals" ? (
              <div className="flex items-center gap-3">
                <button
                  disabled
                  className="text-sm font-semibold text-[#0F3A63] underline-offset-4 hover:underline"
                >
                  Notifications
                </button>
                <button className="rounded-full bg-[#8BC53F] px-5 py-2 text-sm font-semibold text-white">
                  Creer un objectif
                </button>
              </div>
            ) : activeSection === "self-evaluation" ? (
              <div className="flex items-center gap-3">
                <button
                  disabled
                  className="text-sm font-semibold text-[#0F3A63] underline-offset-4 hover:underline"
                >
                  Notifications
                </button>
                <button className="rounded-full bg-[#8BC53F] px-5 py-2 text-sm font-semibold text-white">
                  Soumettre a la RH
                </button>
              </div>
            ) : activeSection === "reports" ? (
              <div className="flex items-center gap-3">
                <button
                  disabled
                  className="text-sm font-semibold text-[#0F3A63] underline-offset-4 hover:underline"
                >
                  Notifications
                </button>
                <button className="rounded-full bg-[#8BC53F] px-5 py-2 text-sm font-semibold text-white">
                  Exporter PDF
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <button
                  disabled
                  className="text-sm font-semibold text-[#0F3A63] underline-offset-4 hover:underline"
                >
                  Notifications
                </button>
                <button
                  onClick={() => setActiveSection("team-evaluate")}
                  className="rounded-full bg-[#8BC53F] px-5 py-2 text-sm font-semibold text-[#0B2F4F]"
                >
                  Evaluer l'equipe
                </button>
              </div>
            )}
          </header>

          {showOverview ? (
            <>
              <div className="mb-7 border-l-4 border-[#7CB342] bg-[#DCECCB] px-4 py-3 text-sm font-semibold text-[#184D2E]">
                Mon auto-evaluation est en attente - a soumettre avant le 25/04/2026.
              </div>

              <section className="mb-7 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                <button
                  onClick={() => goToSection("team")}
                  className="rounded-lg bg-[#003B63] p-5 text-left text-white transition hover:bg-[#0B4C7A]"
                >
                  <div className="mb-4 flex items-start justify-between">
                    <p className="text-sm">Membres</p>
                    <p className="text-2xl font-extrabold">5</p>
                  </div>
                  <p className="text-sm text-slate-200">2 Seniors, 3 Collabs</p>
                </button>

                <article className="rounded-lg bg-[#003B63] p-5 text-left text-white">
                  <div className="mb-4 flex items-start justify-between">
                    <p className="text-sm">Auto-evals recues</p>
                    <p className="text-2xl font-extrabold">3/5</p>
                  </div>
                  <p className="text-sm text-slate-200">2 en attente</p>
                </article>

                <button
                  onClick={() => goToSection("team-evaluate")}
                  className="rounded-lg bg-[#003B63] p-5 text-left text-white transition hover:bg-[#0B4C7A]"
                >
                  <div className="mb-4 flex items-start justify-between">
                    <p className="text-sm">Evals a donner</p>
                    <p className="text-2xl font-extrabold text-[#F34D4D]">2</p>
                  </div>
                  <p className="text-sm text-slate-200">dont 1 Senior</p>
                </button>

                <button
                  onClick={() => goToSection("self-evaluation")}
                  className="rounded-lg bg-[#003B63] p-5 text-left text-white transition hover:bg-[#0B4C7A]"
                >
                  <p className="mb-4 text-sm">Mon auto-eval</p>
                  <p className="text-base font-bold text-[#F34D4D]">En attente</p>
                </button>
              </section>

              <section className="grid grid-cols-1 gap-6 xl:grid-cols-3">
                <div className="rounded-xl bg-white p-5 shadow-sm xl:col-span-2">
                  <h2 className="mb-5 text-sm font-semibold text-[#0F3A63]">Statut des evaluations</h2>
                  <div className="space-y-4">
                    {statusBars.map((item) => (
                      <div key={item.label} className="block w-full text-left">
                        <div className="mb-2 flex items-center justify-between text-sm text-[#0F3A63]">
                          <p>{item.label}</p>
                          <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-slate-200 px-2 text-xs font-bold">
                            {item.count}
                          </span>
                        </div>
                        <div className="h-3 rounded-full bg-slate-200">
                          <div className={`h-3 rounded-full ${item.color}`} style={{ width: `${item.value}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-xl bg-white p-5 shadow-sm">
                  <h2 className="mb-4 text-sm font-semibold text-[#0F3A63]">Actions requises</h2>

                  <div className="space-y-3">
                    {requiredActions.map((action) => (
                      <button
                        key={action.title}
                        onClick={() => goToSection(action.target)}
                        disabled={!canOpenSection(action.target)}
                        className={`w-full rounded-lg bg-[#DFECD4] p-3 text-left transition ${
                          canOpenSection(action.target) ? "hover:bg-[#D1E6C0]" : "cursor-default opacity-80"
                        }`}
                      >
                        <div className="mb-1 flex items-start gap-2">
                          <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[#1A93CA] px-1 text-xs font-bold text-white">
                            {action.id}
                          </span>
                          <p className="text-sm font-semibold text-[#0F3A63]">{action.title}</p>
                        </div>
                        <p className="pl-7 text-xs text-slate-500">{action.subtitle}</p>
                      </button>
                    ))}
                  </div>

                  <button
                    onClick={() => goToSection("actions")}
                    className="mt-5 w-full rounded-lg bg-[#003B63] py-3 text-sm font-semibold text-white transition hover:bg-[#0B4C7A]"
                  >
                    Voir toutes les actions
                  </button>
                </div>
              </section>
            </>
          ) : activeSection === "team" ? (
            <Monequipe searchTerm={searchTerm} onSearchChange={setSearchTerm} onAction={goToSection} />
          ) : activeSection === "team-evaluate" ? (
            <Evaluermonequipe />
          ) : activeSection === "team-goals" ? (
            <Objectifsequipe />
          ) : activeSection === "self-evaluation" ? (
            <Monautoevaluation />
          ) : activeSection === "reports" ? (
            <Rapportsequipe />
          ) : (
            <SectionPanel
              title={
                (activeSection === "actions" ? "Actions requises" : null) ||
                sidebarSections.flatMap((group) => group.items).find((item) => item.key === activeSection)?.label ||
                "Section Workflow"
              }
              description={sectionContent[activeSection] || "Section en preparation. Le workflow est deja branché."}
              onBack={() => setActiveSection("overview")}
            />
          )}
        </main>
      </div>
    </div>
  );
}

export default ManagerDashboard;
