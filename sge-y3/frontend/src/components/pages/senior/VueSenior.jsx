import { useMemo, useState } from "react";
import { LogOut, UserRound } from "lucide-react";
import logoY3 from "@/assets/logo-y3.png";
import { menuGroups } from "@/components/pages/senior/seniorData";
import Vueensemble from "@/components/pages/senior/Vueensemble";
import Mesassistants from "@/components/pages/senior/Mesassistants";
import Evaluerassistants from "@/components/pages/senior/Evaluerassistants";
import MesresultatsSenior from "@/components/pages/senior/MesresultatsSenior";
import MesobjectifsSenior from "@/components/pages/senior/MesobjectifsSenior";
import MonautoevaluationSenior from "@/components/pages/senior/MonautoevaluationSenior";
import ProfilePanel from "@/components/profile/ProfilePanel";
import { getDisplayName, getInitials } from "@/lib/userPresentation";

function VueSenior({ onLogout, onUserUpdate, user }) {
  const [activeSection, setActiveSection] = useState("overview");
  const displayName = getDisplayName(user);
  const profileKey = [user?.id, user?.email, user?.first_name, user?.last_name, user?.grade, user?.department].join("|");
  const initials = getInitials(user);

  const pageTitle = useMemo(() => {
    if (activeSection === "assistants") return "MES ASSISTANTS";
    if (activeSection === "reviews") return "EVALUER ASSISTANTS";
    if (activeSection === "results") return "SYNTHESES TRANSMISES";
    if (activeSection === "goals") return "MISSIONS COMMUNES";
    if (activeSection === "self-evaluation") return "MON AUTO-EVALUATION";
    if (activeSection === "profile") return "MON PROFIL";
    return "TABLEAU DE BORD SENIOR";
  }, [activeSection]);

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
            <Vueensemble onOpen={setActiveSection} />
          ) : activeSection === "assistants" ? (
            <Mesassistants onOpenReview={() => setActiveSection("reviews")} />
          ) : activeSection === "reviews" ? (
            <Evaluerassistants />
          ) : activeSection === "results" ? (
            <MesresultatsSenior />
          ) : activeSection === "goals" ? (
            <MesobjectifsSenior />
          ) : activeSection === "self-evaluation" ? (
            <MonautoevaluationSenior />
          ) : activeSection === "profile" ? (
            <ProfilePanel key={profileKey} user={user} onLogout={onLogout} onUserUpdate={onUserUpdate} />
          ) : (
            <Vueensemble onOpen={setActiveSection} />
          )}
        </main>
      </div>
    </div>
  );
}

export default VueSenior;
