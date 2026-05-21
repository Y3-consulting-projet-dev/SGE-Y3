import { useMemo, useState } from "react";
import { Bell, CircleHelp, LogOut, UserRound } from "lucide-react";
import logoY3 from "@/assets/logo-y3.png";
import { rhMenuGroups } from "@/components/pages/rh/rhData";
import TableauRH from "@/components/pages/rh/TableauRH";
import ValidationsRH from "@/components/pages/rh/ValidationsRH";
import MonautoevaluationAssistanteRH from "@/components/pages/rh/MonautoevaluationAssistanteRH";
import MonautoevaluationRH from "@/components/pages/rh/MonautoevaluationRH";
import QuestionnaireRH from "@/components/pages/rh/QuestionnaireRH";
import SynthesesRH from "@/components/pages/rh/SynthesesRH";
import CalibrationRH from "@/components/pages/rh/CalibrationRH";
import EvaluationsDepartementRH from "@/components/pages/rh/EvaluationsDepartementRH";
import PopulationRH from "@/components/pages/rh/PopulationRH";
import RapportsRH from "@/components/pages/rh/RapportsRH";
import EvaluationAssistanteRH from "@/components/pages/rh/EvaluationAssistanteRH";
import ComiteEvaluation from "@/components/pages/comite/ComiteEvaluation";
import DecisionAssociesRH from "@/components/pages/comite/DecisionAssociesRH";
import ProfilePanel from "@/components/profile/ProfilePanel";
import { saveCommitteeDecision } from "@/lib/committee";
import { getDisplayName } from "@/lib/userPresentation";

function VueRH({ assistantMode = false, onLogout, onUserUpdate, user }) {
  const [activeSection, setActiveSection] = useState("overview");
  const [selectedAssistantRh, setSelectedAssistantRh] = useState(null);
  const displayName = getDisplayName(user);
  const profileKey = [user?.id, user?.email, user?.first_name, user?.last_name, user?.grade, user?.department].join("|");

  const pageTitle = useMemo(() => {
    if (activeSection === "validations") return "VALIDATIONS RH";
    if (activeSection === "self-evaluation-rh") return assistantMode ? "MON AUTO-ÉVALUATION ASSISTANTE RH" : "MON AUTO-ÉVALUATION RH";
    if (activeSection === "questionnaire") return "SECTIONS & QUESTIONS";
    if (activeSection === "assistant-rh-review") return "EVALUATION ASSISTANTE RH";
    if (activeSection === "syntheses") return "SYNTHÈSES À TRANSMETTRE";
    if (activeSection === "calibration") return "CALIBRATION";
    if (activeSection === "department-evaluations") return "ÉVALUATIONS PAR DÉPARTEMENT";
    if (activeSection === "population") return "ÉQUIPE";
    if (activeSection === "reports") return "RAPPORTS RH";
    if (activeSection === "committee") return "COMITÉ D'ÉVALUATION";
    if (activeSection === "profile") return "MON PROFIL";
    return "TABLEAU DE BORD RH";
  }, [activeSection, assistantMode]);

  const renderContent = () => {
    if (activeSection === "overview") {
      return <TableauRH onOpen={setActiveSection} readOnly={assistantMode} />;
    }

    if (activeSection === "validations") {
      return (
        <ValidationsRH
          readOnly={assistantMode}
          onOpenAssistantEvaluation={(row) => {
            setSelectedAssistantRh(row);
            setActiveSection("assistant-rh-review");
          }}
        />
      );
    }

    if (activeSection === "self-evaluation-rh") {
      return assistantMode ? <MonautoevaluationAssistanteRH /> : <MonautoevaluationRH />;
    }

    if (activeSection === "questionnaire") {
      return <QuestionnaireRH assistantMode={assistantMode} />;
    }

    if (activeSection === "syntheses") {
      return <SynthesesRH readOnly={assistantMode} />;
    }

    if (activeSection === "calibration") {
      return <CalibrationRH readOnly={assistantMode} />;
    }

    if (activeSection === "department-evaluations") {
      return <EvaluationsDepartementRH readOnly={assistantMode} />;
    }

    if (activeSection === "population") {
      return <PopulationRH readOnly={assistantMode} />;
    }

    if (activeSection === "reports") {
      return <RapportsRH readOnly={false} />;
    }

    if (activeSection === "assistant-rh-review") {
      return (
        <EvaluationAssistanteRH
          memberId={selectedAssistantRh?.memberId}
          onBack={() => setActiveSection("validations")}
          onSubmitted={() => setActiveSection("validations")}
        />
      );
    }

    if (activeSection === "profile") {
      return <ProfilePanel key={profileKey} user={user} onLogout={onLogout} onUserUpdate={onUserUpdate} />;
    }

    if (activeSection === "committee") {
      return (
        <div className="space-y-6">
          <ComiteEvaluation
            readOnly={assistantMode}
            primaryUnclassified
            initialDecisionScope="rh-final"
            onSubmit={(decisions) => saveCommitteeDecision({ scope: "rh-final", cycle_label: "Cycle 2025-2026", decisions })}
            submitLabel="Transmettre aux associés"
            submittedLabel="Transmis aux associés"
            successMessage="Classement des assistants, seniors et assistants managers transmis aux associés."
            workflowText="La RH classe les assistants, seniors et assistants managers, puis transmet le classement aux associés pour décision du taux d'augmentation."
          />
          <DecisionAssociesRH />
          <DecisionAssociesRH
            emptyMessage="Aucune décision support des associés n'a encore été envoyée à la RH."
            scope="support-final"
            title="Décisions support reçues"
            subtitle="La RH visualise ici le classement et les taux d'augmentation du département support envoyés par les associés."
          />
        </div>
      );
    }

    return <TableauRH onOpen={setActiveSection} readOnly={assistantMode} />;
  };

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
                <p className="text-xs font-bold text-[#0F3A63]">{displayName}</p>
                <p className="text-xs text-slate-500">{assistantMode ? "Assistante RH" : user?.grade || user?.department || "RH"}</p>
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
              <p className="mt-1 text-sm font-semibold text-slate-500">
                {assistantMode ? "Cycle 2025-2026 - Consultation RH et gestion des questions" : "Cycle 2025-2026 - Pilotage des évaluations"}
              </p>
            </div>
            <div className="flex items-center gap-4">
              {/* <button onClick={() => window.alert("Notifications RH bientôt disponibles.")} className="text-slate-500 hover:text-[#0F3A63]">
                <Bell size={18} />
              </button>
              <button onClick={() => window.alert("Aide RH bientôt disponible.")} className="text-slate-500 hover:text-[#0F3A63]">
                <CircleHelp size={18} />
              </button> */}
              {assistantMode ? (
                <span className="rounded-full bg-[#E7EDF3] px-4 py-2 text-xs font-bold text-[#0F4A72]">
                  {activeSection === "reports" ? "Accès total" : "Accès restreint"}
                </span>
              ) : activeSection !== "profile" ? (
                <button
                  onClick={() => setActiveSection(activeSection === "overview" ? "validations" : "overview")}
                  className="rounded-full bg-[#8BC53F] px-5 py-2 text-sm font-bold text-white"
                >
                  {activeSection === "overview" ? "Traiter validations" : "Retour dashboard"}
                </button>
              ) : null}
            </div>
          </header>

          {renderContent()}
        </main>
      </div>
    </div>
  );
}

export default VueRH;
