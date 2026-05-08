import { useMemo, useState } from "react";
import { BarChart3, FileBarChart2, FolderKanban, LayoutDashboard, LogOut, Settings2, Users, X } from "lucide-react";
import Monequipe from "@/components/pages/manager/Monequipe";
import Evaluermonequipe from "@/components/pages/manager/Evaluermonequipe";
import Objectifsequipe from "@/components/pages/manager/Objectifsequipe";
import Monautoevaluation from "@/components/pages/manager/Monautoevaluation";
import Rapportsequipe from "@/components/pages/manager/Rapportsequipe";
import ProfilePanel from "@/components/profile/ProfilePanel";
import logoY3 from "@/assets/logo-y3.png";
import { getDisplayName, getInitials } from "@/lib/userPresentation";

const statusBars = [
  { label: "Brouillon", value: 45, count: 2, color: "bg-slate-500" },
  { label: "En cours", value: 55, count: 3, color: "bg-[#3D69B3]" },
  { label: "Soumis a moi", value: 78, count: 1, color: "bg-[#32B3E0]" },
  { label: "Soumis a RH", value: 86, count: 0, color: "bg-[#86C440]" },
];

const requiredActions = [
  { id: "OK", title: "Vérifier l'auto-éval - Kone K.", subtitle: "Senior - Soumise le 18/04", target: "team" },
  { id: 2, title: "Evaluer Traore M.", subtitle: "Collaborateur - Auto-eval recue", target: "team" },
  {
    id: 3,
    title: "Compléter mon auto-évaluation",
    subtitle: "Deadline 25/04 - Pour l'associé",
    target: "self-evaluation",
  },
];

const sidebarSections = [
  { group: "Tableau de bord", items: [{ key: "overview", label: "Vue d'ensemble", icon: LayoutDashboard }] },
  {
    group: "Equipe",
    items: [
      { key: "team", label: "Mon équipe", icon: Users },
      { key: "team-goals", label: "Objectifs d'équipe", icon: FolderKanban },
    ],
  },
  { group: "Mon evaluation", items: [{ key: "self-evaluation", label: "Mon auto-evaluation", icon: BarChart3 }] },
  { group: "Reporting", items: [{ key: "reports", label: "Rapports equipe", icon: FileBarChart2 }] },
  { group: "Compte", items: [{ key: "profile", label: "Profil", icon: Settings2 }] },
];

const availableSections = new Set(["overview", "team", "team-goals", "self-evaluation", "reports", "actions", "profile"]);

const sectionContent = {
  notifications: "Consulte les dernieres notifications et relance les collaborateurs en attente.",
  team: "Visualise la liste des membres, leurs roles et leurs avancements.",
  "team-review": "Vérifie les auto-évaluations soumises avant validation.",
  "team-goals": "Suis les objectifs de l'équipe et ajuste les priorités.",
  "self-evaluation": "Complète ou mets à jour ton auto-évaluation manager.",
  reports: "Génère et exporte les rapports de performance de l'équipe.",
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
        Retour à la vue d'ensemble
      </button>
    </section>
  );
}

function ManagerDashboard({ onLogout, onUserUpdate, user }) {
  const [activeSection, setActiveSection] = useState("overview");
  const [searchTerm, setSearchTerm] = useState("");
  const [evaluationMember, setEvaluationMember] = useState(null);
  const [evaluationStatus, setEvaluationStatus] = useState("");
  const [evaluationHistory, setEvaluationHistory] = useState([]);
  const [relanceMessage, setRelanceMessage] = useState("");
  const [isMemberModalOpen, setIsMemberModalOpen] = useState(false);
  const [createGoalSignal, setCreateGoalSignal] = useState(0);
  const [memberStatus, setMemberStatus] = useState("");
  const [extraTeamMembers, setExtraTeamMembers] = useState([]);
  const [memberForm, setMemberForm] = useState({
    name: "",
    role: "",
    seniority: "",
    status: "Brouillon",
  });
  const canOpenSection = (sectionKey) => availableSections.has(sectionKey);
  const goToSection = (sectionKey) => {
    if (canOpenSection(sectionKey)) setActiveSection(sectionKey);
  };

  const pageTitle = useMemo(() => {
    if (activeSection === "overview") return "VUE D'ENSEMBLE";
    if (activeSection === "team") return "MON EQUIPE";
    if (activeSection === "team-goals") return "OBJECTIFS EQUIPE";
    if (activeSection === "self-evaluation") return "MON AUTO-ÉVALUATION";
    if (activeSection === "reports") return "RAPPORTS EQUIPE";
    if (activeSection === "actions") return "ACTIONS REQUISES";
    if (activeSection === "profile") return "MON PROFIL";
    return "WORKFLOW MANAGER";
  }, [activeSection]);

  const showOverview = activeSection === "overview";
  const displayName = getDisplayName(user);
  const initials = getInitials(user);
  const profileKey = [user?.id, user?.email, user?.first_name, user?.last_name, user?.grade, user?.department].join("|");

  const openEvaluation = (member) => {
    setEvaluationMember(member);
    setEvaluationStatus("");
  };

  const relanceMember = (member) => {
    setRelanceMessage(`Relance envoyée a ${member.name} pour finaliser son évaluation.`);
  };

  const handleMemberFieldChange = (field, value) => {
    setMemberForm((form) => ({ ...form, [field]: value }));
    setMemberStatus("");
  };

  const saveMember = () => {
    const name = memberForm.name.trim();
    const role = memberForm.role.trim();
    const seniority = memberForm.seniority.trim();

    if (!name || !role || !seniority) {
      setMemberStatus("missing");
      return;
    }

    setExtraTeamMembers((members) => [
      ...members,
      {
        name,
        role,
        seniority,
        status: memberForm.status,
        score: "",
        action: "Voir",
        actionTarget: "team",
      },
    ]);
    setMemberForm({ name: "", role: "", seniority: "", status: "Brouillon" });
    setMemberStatus("saved");
    setIsMemberModalOpen(false);
  };

  const saveEvaluation = (nextStatus) => {
    if (!evaluationMember) return;

    const now = new Date();
    const savedAt = now.toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });

    setEvaluationHistory((history) => [
      {
        id: `${evaluationMember.name}-${Date.now()}`,
        collaborator: evaluationMember.name,
        role: evaluationMember.role,
        score: evaluationMember.score || "À compléter",
        status: nextStatus,
        savedAt,
      },
      ...history,
    ]);
    setEvaluationStatus(nextStatus);
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
              {showOverview ? <p className="mt-1 text-sm text-slate-500">{displayName} - {user?.grade}</p> : null}
            </div>
            {activeSection === "team" ? (
              <div className="flex items-center gap-3">
                <button
                  disabled
                  className="text-sm font-semibold text-[#0F3A63] underline-offset-4 hover:underline"
                >
                  Notifications
                </button>
                <button
                  onClick={() => {
                    setIsMemberModalOpen(true);
                    setMemberStatus("");
                  }}
                  className="rounded-full bg-[#8BC53F] px-5 py-2 text-sm font-semibold text-white"
                >
                  Enregistrer un membre
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
                <button
                  onClick={() => setCreateGoalSignal((value) => value + 1)}
                  className="rounded-full bg-[#8BC53F] px-5 py-2 text-sm font-semibold text-white"
                >
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
                  Soumettre à la RH
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
            ) : activeSection === "profile" ? null : (
              <div className="flex items-center gap-3">
                <button
                  disabled
                  className="text-sm font-semibold text-[#0F3A63] underline-offset-4 hover:underline"
                >
                  Notifications
                </button>
                <button
                  onClick={() => setActiveSection("team")}
                  className="rounded-full bg-[#8BC53F] px-5 py-2 text-sm font-semibold text-[#0B2F4F]"
                >
                  Ouvrir l'équipe
                </button>
              </div>
            )}
          </header>

          {showOverview ? (
            <>
              <div className="mb-7 border-l-4 border-[#7CB342] bg-[#DCECCB] px-4 py-3 text-sm font-semibold text-[#184D2E]">
                Mon auto-évaluation est en attente - à soumettre avant le 25/04/2026.
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
                    <p className="text-sm">Auto-évals recues</p>
                    <p className="text-2xl font-extrabold">3/5</p>
                  </div>
                  <p className="text-sm text-slate-200">2 en attente</p>
                </article>

                <button
                  onClick={() => goToSection("team")}
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
                  <h2 className="mb-5 text-sm font-semibold text-[#0F3A63]">Statut des évaluations</h2>
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

              <section className="mt-6 rounded-xl bg-white p-5 shadow-sm">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <h2 className="text-sm font-semibold text-[#0F3A63]">Historique des évaluations Manager</h2>
                  <span className="rounded-full bg-[#DCECCB] px-3 py-1 text-xs font-bold text-[#4E8B1B]">
                    {evaluationHistory.length} enregistrement(s)
                  </span>
                </div>

                {evaluationHistory.length ? (
                  <div className="overflow-hidden rounded-md border border-slate-100">
                    <table className="w-full border-collapse text-sm">
                      <thead>
                        <tr className="bg-[#003B63] text-left text-white">
                          <th className="px-4 py-3 font-semibold">Collaborateur</th>
                          <th className="px-4 py-3 font-semibold">Role</th>
                          <th className="px-4 py-3 font-semibold">Score</th>
                          <th className="px-4 py-3 font-semibold">Statut</th>
                          <th className="px-4 py-3 font-semibold">Date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {evaluationHistory.map((item) => (
                          <tr key={item.id} className="border-b border-slate-100 text-[#0F3A63] last:border-0">
                            <td className="px-4 py-3 font-bold">{item.collaborator}</td>
                            <td className="px-4 py-3">{item.role}</td>
                            <td className="px-4 py-3 font-semibold text-[#76B82A]">{item.score}</td>
                            <td className="px-4 py-3">
                              <span
                                className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${
                                  item.status === "sent" ? "bg-[#76B82A] text-white" : "bg-slate-100 text-[#0F3A63]"
                                }`}
                              >
                                {item.status === "sent" ? "Transmise à la RH" : "Enregistrée"}
                              </span>
                            </td>
                            <td className="px-4 py-3">{item.savedAt}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="rounded-lg bg-slate-50 p-4 text-sm font-semibold text-slate-500">
                    Aucune évaluation sauvegardée pour le moment. Les évaluations apparaîtront ici après enregistrement.
                  </p>
                )}
              </section>
            </>
          ) : activeSection === "team" ? (
            <Monequipe
              searchTerm={searchTerm}
              onSearchChange={setSearchTerm}
              onAction={goToSection}
              onEvaluate={openEvaluation}
              onRelance={relanceMember}
              relanceMessage={relanceMessage}
              extraMembers={extraTeamMembers}
            />
          ) : activeSection === "team-goals" ? (
            <Objectifsequipe createSignal={createGoalSignal} />
          ) : activeSection === "self-evaluation" ? (
            <Monautoevaluation />
          ) : activeSection === "reports" ? (
            <Rapportsequipe />
          ) : activeSection === "profile" ? (
            <ProfilePanel key={profileKey} user={user} onLogout={onLogout} onUserUpdate={onUserUpdate} />
          ) : (
            <SectionPanel
              title={
                (activeSection === "actions" ? "Actions requises" : null) ||
                sidebarSections.flatMap((group) => group.items).find((item) => item.key === activeSection)?.label ||
                "Section Workflow"
              }
              description={sectionContent[activeSection] || "Section en préparation. Le workflow est déjà branché."}
              onBack={() => setActiveSection("overview")}
            />
          )}
        </main>
      </div>

      {evaluationMember ? (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-[#0B1F33]/60 px-4 py-6"
          onClick={() => setEvaluationMember(null)}
        >
          <section
            className="w-full max-w-6xl rounded-lg bg-[#EEF2F6] p-5 shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <header className="mb-5 flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-4">
              <div>
                <p className="text-xs font-bold text-[#79B742]">Evaluation Manager</p>
                <h2 className="text-2xl font-black text-[#0F3A63]">{evaluationMember.name}</h2>
                <p className="text-sm font-semibold text-slate-500">
                  {evaluationMember.role} - {evaluationMember.status} - Score auto-eval {evaluationMember.score || "-"}
                </p>
              </div>
              <button
                onClick={() => setEvaluationMember(null)}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-[#0F3A63] shadow-sm hover:bg-slate-100"
                aria-label="Fermer la modal"
              >
                <X size={18} />
              </button>
            </header>

            <Evaluermonequipe member={evaluationMember} />

            <footer className="mt-5 flex flex-wrap items-center justify-end gap-3 border-t border-slate-200 pt-4">
              <button
                onClick={() => saveEvaluation("saved")}
                className="rounded-md bg-slate-200 px-5 py-2 text-sm font-bold text-[#0F3A63]"
              >
                Enregistrer
              </button>
              <button
                onClick={() => saveEvaluation("sent")}
                className="rounded-md bg-[#76B82A] px-5 py-2 text-sm font-bold text-white"
              >
                Transmettre à la RH
              </button>
              {evaluationStatus ? (
                <p className="w-full text-right text-xs font-bold text-[#76B82A]">
                  {evaluationStatus === "sent" ? "Évaluation transmise à la RH." : "Évaluation enregistrée."}
                </p>
              ) : null}
            </footer>
          </section>
        </div>
      ) : null}

      {isMemberModalOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-[#0B1F33]/60 px-4 py-8"
          onClick={() => setIsMemberModalOpen(false)}
        >
          <section
            className="w-full max-w-xl rounded-lg bg-white p-5 shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <header className="mb-5 flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
              <div>
                <p className="text-xs font-bold text-[#79B742]">Equipe</p>
                <h2 className="text-2xl font-black text-[#0F3A63]">Enregistrer un membre</h2>
              </div>
              <button
                onClick={() => setIsMemberModalOpen(false)}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-[#0F3A63] hover:bg-slate-200"
                aria-label="Fermer le formulaire"
              >
                <X size={18} />
              </button>
            </header>

            <div className="grid grid-cols-1 gap-4">
              <div>
                <label htmlFor="member-name" className="mb-2 block text-xs font-bold text-[#0F3A63]">
                  Nom du collaborateur
                </label>
                <input
                  id="member-name"
                  value={memberForm.name}
                  onChange={(event) => handleMemberFieldChange("name", event.target.value)}
                  className="h-11 w-full rounded-md border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-[#0F3A63] outline-none"
                  placeholder="Ex: Aminata Konan"
                />
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label htmlFor="member-role" className="mb-2 block text-xs font-bold text-[#0F3A63]">
                    Role
                  </label>
                  <input
                    id="member-role"
                    value={memberForm.role}
                    onChange={(event) => handleMemberFieldChange("role", event.target.value)}
                    className="h-11 w-full rounded-md border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-[#0F3A63] outline-none"
                    placeholder="Ex: collaborateur"
                  />
                </div>

                <div>
                  <label htmlFor="member-seniority" className="mb-2 block text-xs font-bold text-[#0F3A63]">
                    Anciennete
                  </label>
                  <input
                    id="member-seniority"
                    value={memberForm.seniority}
                    onChange={(event) => handleMemberFieldChange("seniority", event.target.value)}
                    className="h-11 w-full rounded-md border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-[#0F3A63] outline-none"
                    placeholder="Ex: 1 an"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="member-status" className="mb-2 block text-xs font-bold text-[#0F3A63]">
                  Statut de l'évaluation
                </label>
                <select
                  id="member-status"
                  value={memberForm.status}
                  onChange={(event) => handleMemberFieldChange("status", event.target.value)}
                  className="h-11 w-full rounded-md border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-[#0F3A63] outline-none"
                >
                  <option value="Brouillon">Brouillon</option>
                  <option value="En cours">En cours</option>
                  <option value="Soumise">Soumise</option>
                </select>
              </div>
            </div>

            <footer className="mt-5 flex flex-wrap items-center justify-end gap-3 border-t border-slate-100 pt-4">
              <button
                onClick={() => setIsMemberModalOpen(false)}
                className="rounded-md bg-slate-200 px-5 py-2 text-sm font-bold text-[#0F3A63]"
              >
                Annuler
              </button>
              <button onClick={saveMember} className="rounded-md bg-[#76B82A] px-5 py-2 text-sm font-bold text-white">
                Enregistrer le membre
              </button>
              {memberStatus === "missing" ? (
                <p className="w-full text-right text-xs font-bold text-[#A4252F]">
                  Renseignez le nom, le rôle et l'ancienneté avant d'enregistrer.
                </p>
              ) : null}
            </footer>
          </section>
        </div>
      ) : null}
    </div>
  );
}

export default ManagerDashboard;
