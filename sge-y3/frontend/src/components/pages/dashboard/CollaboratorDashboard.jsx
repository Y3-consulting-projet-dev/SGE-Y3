import { useMemo, useState } from "react";
import {
  ChevronsLeft,
  ClipboardList,
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
import Mesobjectifs from "@/components/pages/collaborator/Mesobjectifs";
import Mondeveloppement from "@/components/pages/collaborator/Mondeveloppement";
import ProfilePanel from "@/components/profile/ProfilePanel";
import { getDisplayName, getInitials } from "@/lib/userPresentation";

const menuGroups = [
  {
    title: "Tableau de bord",
    items: [{ key: "dashboard", label: "Mon espace", icon: LayoutDashboard }],
  },
  {
    title: "Evaluation",
    items: [
      { key: "self-evaluation", label: "Mon auto-evaluation", icon: ClipboardList },
      { key: "results", label: "Mes resultats", icon: LineChart },
    ],
  },
  {
    title: "Developpement",
    items: [
      { key: "goals", label: "Mes objectifs", icon: Target },
      { key: "development", label: "Mon developpement", icon: TrendingUp },
    ],
  },
  {
    title: "Compte",
    items: [{ key: "profile", label: "Profil", icon: Settings2 }],
  },
];

function CollaboratorDashboard({ onLogout, onUserUpdate, user }) {
  const [activeSection, setActiveSection] = useState("dashboard");
  const displayName = getDisplayName(user);
  const profileKey = [user?.id, user?.email, user?.first_name, user?.last_name, user?.grade, user?.department].join("|");
  const initials = getInitials(user);

  const pageTitle = useMemo(() => {
    if (activeSection === "dashboard") return "TABLEAU DE BORD";
    if (activeSection === "self-evaluation") return "MON AUTO-EVALUATION";
    if (activeSection === "results") return "MES RESULTATS";
    if (activeSection === "goals") return "MES OBJECTIFS";
    if (activeSection === "development") return "MON DEVELOPPEMENT";
    if (activeSection === "profile") return "MON PROFIL";
    return "ESPACE COLLABORATEUR";
  }, [activeSection]);

  // const handleHeaderAction = () => {
  //   if (activeSection === "self-evaluation") {
  //     setActiveSection("results");
  //     return;
  //   }
  //   if (activeSection === "results") {
  //     window.print();
  //     return;
  //   }
  //   if (activeSection === "goals") {
  //     setActiveSection("development");
  //     return;
  //   }
  //   if (activeSection === "development") {
  //     setActiveSection("results");
  //     return;
  //   }
  //   setActiveSection("self-evaluation");
  // };

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
            Deconnexion
          </button>
        </aside>

        <main className="relative flex-1 p-4 md:p-6">
          <header className="mb-5 flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-[34px] font-black tracking-tight text-[#0F3A63]">{pageTitle}</h1>
              {activeSection === "dashboard" ? <p className="mt-1 text-sm text-slate-500">{displayName} - {user?.grade}</p> : null}
            </div>
            {activeSection !== "profile" ? (
              <div className="flex items-center gap-4">
                {/* <button
                  onClick={handleHeaderAction}
                  className="rounded-full bg-[#8BC53F] px-4 py-2 text-[11px] font-bold text-white"
                >
                  {activeSection === "self-evaluation"
                    ? "Soumettre"
                    : activeSection === "results"
                      ? "Telecharger mon rapport"
                      : activeSection === "goals"
                        ? "Voir mon plan de dev"
                        : activeSection === "development"
                          ? "Voir mes resultats"
                          : "Completer mon evaluation"}
                </button> */}
                <div className="flex items-center gap-2">
                               <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#1F4A72] text-xs font-bold text-white">{initials}</div>
                               <div className="text-xs">
                                 <p className="font-semibold text-[#73AF2E]">{displayName}</p>
                                 <p className="font-semibold text-[#0F3A63]">{user?.grade}</p>
                               </div>
                             </div>
              </div>

            ) : null}
          </header>

          {activeSection === "dashboard" ? (
            <MonTableauDeBord />
          ) : activeSection === "self-evaluation" ? (
            <Monautoevaluation />
          ) : activeSection === "results" ? (
            <Mesresultats />
          ) : activeSection === "goals" ? (
            <Mesobjectifs />
          ) : activeSection === "development" ? (
            <Mondeveloppement />
          ) : (
            <ProfilePanel key={profileKey} user={user} onLogout={onLogout} onUserUpdate={onUserUpdate} />
          )}
        </main>
      </div>
    </div>
  );
}

export default CollaboratorDashboard;
