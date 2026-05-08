import { useMemo, useState } from "react";
import { Bell, CircleHelp, LogOut, UserRound } from "lucide-react";
import logoY3 from "@/assets/logo-y3.png";
import { rhMenuGroups } from "@/components/pages/rh/rhData";
import TableauRH from "@/components/pages/rh/TableauRH";
import ValidationsRH from "@/components/pages/rh/ValidationsRH";
import QuestionnaireRH from "@/components/pages/rh/QuestionnaireRH";
import SynthesesRH from "@/components/pages/rh/SynthesesRH";
import CalibrationRH from "@/components/pages/rh/CalibrationRH";
import EvaluationsDepartementRH from "@/components/pages/rh/EvaluationsDepartementRH";
import PopulationRH from "@/components/pages/rh/PopulationRH";
import RapportsRH from "@/components/pages/rh/RapportsRH";

function VueRH({ onLogout }) {
  const [activeSection, setActiveSection] = useState("overview");

  const pageTitle = useMemo(() => {
    if (activeSection === "validations") return "VALIDATIONS RH";
    if (activeSection === "questionnaire") return "SECTIONS & QUESTIONS";
    if (activeSection === "syntheses") return "SYNTHÈSES À TRANSMETTRE";
    if (activeSection === "calibration") return "CALIBRATION";
    if (activeSection === "department-evaluations") return "ÉVALUATIONS PAR DÉPARTEMENT";
    if (activeSection === "population") return "ÉQUIPE";
    if (activeSection === "reports") return "RAPPORTS RH";
    return "TABLEAU DE BORD RH";
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
            {rhMenuGroups.map((group) => (
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
                <p className="text-xs font-bold text-[#0F3A63]">Isabella Beda</p>
                <p className="text-xs text-slate-500">Responsable RH</p>
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
            <div>
              <h1 className="text-3xl font-black tracking-tight text-[#0F3A63]">{pageTitle}</h1>
              <p className="mt-1 text-sm font-semibold text-slate-500">Cycle 2026 - Pilotage des évaluations</p>
            </div>
            <div className="flex items-center gap-4">
              <button onClick={() => window.alert("Notifications RH bientôt disponibles.")} className="text-slate-500 hover:text-[#0F3A63]">
                <Bell size={18} />
              </button>
              <button onClick={() => window.alert("Aide RH bientôt disponible.")} className="text-slate-500 hover:text-[#0F3A63]">
                <CircleHelp size={18} />
              </button>
              <button
                onClick={() => setActiveSection(activeSection === "overview" ? "validations" : "overview")}
                className="rounded-full bg-[#8BC53F] px-5 py-2 text-sm font-bold text-white"
              >
                {activeSection === "overview" ? "Traiter validations" : "Retour dashboard"}
              </button>
            </div>
          </header>

          {activeSection === "overview" ? (
            <TableauRH onOpen={setActiveSection} />
          ) : activeSection === "validations" ? (
            <ValidationsRH />
          ) : activeSection === "questionnaire" ? (
            <QuestionnaireRH />
          ) : activeSection === "syntheses" ? (
            <SynthesesRH />
          ) : activeSection === "calibration" ? (
            <CalibrationRH />
          ) : activeSection === "department-evaluations" ? (
            <EvaluationsDepartementRH />
          ) : activeSection === "population" ? (
            <PopulationRH />
          ) : (
            <RapportsRH />
          )}
        </main>
      </div>
    </div>
  );
}

export default VueRH;
