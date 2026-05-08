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

function VueSenior({ onLogout }) {
  const [activeSection, setActiveSection] = useState("overview");

  const pageTitle = useMemo(() => {
    if (activeSection === "assistants") return "MES ASSISTANTS";
    if (activeSection === "reviews") return "EVALUER ASSISTANTS";
    if (activeSection === "results") return "SYNTHESES TRANSMISES";
    if (activeSection === "goals") return "MISSIONS COMMUNES";
    if (activeSection === "self-evaluation") return "MON AUTO-ÉVALUATION";
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

          <div className="mt-10 rounded-xl bg-[#F3F4F6] px-3 py-3 shadow-sm">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#8BC53F] text-white">
                <UserRound size={15} />
              </div>
              <div>
                <p className="text-xs font-bold text-[#0F3A63]">Yasmine KOUAME</p>
                <p className="text-xs text-slate-500">Senior</p>
              </div>
            </div>
          </div>

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
            <h1 className="text-3xl font-black tracking-tight text-[#0F3A63]">{pageTitle}</h1>
            <button
              onClick={() => setActiveSection(activeSection === "overview" ? "reviews" : "overview")}
              className="rounded-full bg-[#8BC53F] px-5 py-2 text-sm font-bold text-white"
            >
              {activeSection === "overview" ? "Evaluer assistants" : "Retour dashboard"}
            </button>
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
          ) : (
            <Vueensemble onOpen={setActiveSection} />
          )}
        </main>
      </div>
    </div>
  );
}

export default VueSenior;
