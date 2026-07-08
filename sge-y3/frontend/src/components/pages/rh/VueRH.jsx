import { useEffect, useMemo, useState } from "react";
import { BarChart2, LogOut, UserRound } from "lucide-react";
import logoY3 from "@/assets/logo-y3.png";
import { rhMenuGroups } from "@/data/rhData";
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
import Monhistorique from "@/components/pages/rh/Monhistorique";
import HistoriqueEquipe from "@/components/pages/rh/HistoriqueEquipe";
import GestionCycles from "@/components/pages/rh/GestionCycles";
import GestionCollaborateurs from "@/components/pages/rh/GestionCollaborateurs";
import ComiteEvaluation from "@/components/pages/comite/ComiteEvaluation";
import ProfilePanel from "@/components/profile/ProfilePanel";
import { saveCommitteeDecision } from "@/api/committee";
import { getDisplayName } from "@/utils/userPresentation";
import { getRhReceivedComments, getAssistantRhEvaluationResult } from "@/api/rhOverview";

function VueRH({ assistantMode = false, onLogout, onUserUpdate, user }) {
  const [activeSection, setActiveSection] = useState("overview");
  const [selectedAssistantRh, setSelectedAssistantRh] = useState(null);
  const [receivedComments, setReceivedComments] = useState([]);
  const [isLoadingReceived, setIsLoadingReceived] = useState(false);
  const [evaluationResult, setEvaluationResult] = useState(null);
  const [isLoadingResult, setIsLoadingResult] = useState(false);
  const [evaluationResultError, setEvaluationResultError] = useState("");
  const displayName = getDisplayName(user);

  useEffect(() => {
    if (activeSection !== "received-comments") return;
    setIsLoadingReceived(true);
    getRhReceivedComments()
      .then((data) => setReceivedComments(data?.received || []))
      .catch(() => {})
      .finally(() => setIsLoadingReceived(false));
  }, [activeSection]);

  useEffect(() => {
    if (!assistantMode || activeSection !== "my-results") return;
    setIsLoadingResult(true);
    setEvaluationResultError("");
    getAssistantRhEvaluationResult()
      .then((data) => setEvaluationResult(data?.result || null))
      .catch((err) => setEvaluationResultError(err.message || "Erreur lors du chargement des résultats."))
      .finally(() => setIsLoadingResult(false));
  }, [assistantMode, activeSection]);
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
    if (activeSection === "history") return "MON HISTORIQUE";
    if (activeSection === "team-history") return "HISTORIQUE COLLABORATEURS";
    if (activeSection === "reports") return "RAPPORTS RH";
    if (activeSection === "committee") return "COMITÉ D'ÉVALUATION";
    if (activeSection === "collaborators") return "GESTION DES COLLABORATEURS";
    if (activeSection === "cycles") return "GESTION DES CYCLES";
    if (activeSection === "received-comments") return "COMMENTAIRES REÇUS";
    if (activeSection === "my-results") return "MES RÉSULTATS";
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

    if (activeSection === "history") {
      return <Monhistorique />;
    }

    if (activeSection === "team-history") {
      return <HistoriqueEquipe />;
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

    if (activeSection === "cycles") {
      return <GestionCycles />;
    }

    if (activeSection === "collaborators") {
      return <GestionCollaborateurs />;
    }

    if (activeSection === "my-results") {
      const result = evaluationResult;
      const overallAverage = result ? (typeof result.overallAverage === "number" ? result.overallAverage : null) : null;
      const overallPercent = overallAverage ? Math.round((overallAverage / 5) * 100) : 0;
      const sectionComments = result ? (result.sectionScores || []).filter((s) => s.comment) : [];

      return (
        <div className="space-y-4">
          <p className="text-[12px] font-semibold text-slate-500">
            Cycle 2025-2026 - Notes attribuées par la RH à l'issue de l'évaluation de votre auto-évaluation
          </p>

          {isLoadingResult ? (
            <div className="rounded-md bg-white p-4 text-sm font-semibold text-slate-500 shadow-sm">Chargement des résultats...</div>
          ) : evaluationResultError ? (
            <div className="rounded-md bg-white p-4 text-sm font-semibold text-red-600 shadow-sm">{evaluationResultError}</div>
          ) : !result ? (
            <div className="rounded-md bg-white p-4 text-sm font-semibold text-slate-500 shadow-sm">
              La RH n'a pas encore complété votre évaluation pour ce cycle.
            </div>
          ) : (
            <>
              <section className="grid grid-cols-1 gap-3 md:grid-cols-3">
                {[
                  {
                    title: "Score global",
                    value: overallAverage !== null ? `${overallAverage.toFixed(1)}/5` : "--/5",
                    subtitle: "Moyenne de toutes les sections notées",
                  },
                  {
                    title: "Statut évaluation",
                    value: result.status || "En cours",
                    subtitle: result.submitted_at
                      ? `Soumis le ${new Date(result.submitted_at).toLocaleDateString("fr-FR")}`
                      : "Calcul provisoire",
                  },
                  {
                    title: "Sections évaluées",
                    value: `${result.sectionScores?.length ?? 0}`,
                    subtitle: result.reviewer
                      ? `Par ${result.reviewer.name || "la RH"} - ${result.reviewer.department || "RH"}`
                      : "Par la RH",
                  },
                ].map((card) => (
                  <article key={card.title} className="rounded-md bg-[#003B63] px-4 py-3 text-white">
                    <h2 className="mb-4 text-[12px] font-bold">{card.title}</h2>
                    <p className="text-[18px] font-bold text-[#7BC443]">{card.value}</p>
                    <p className="mt-3 text-[12px] font-semibold text-slate-200">{card.subtitle}</p>
                  </article>
                ))}
              </section>

              <section className="flex justify-between gap-4">
                <article className="w-[53%] rounded-md bg-white p-4 shadow-sm">
                  <div className="mb-4">
                    <h3 className="text-[18px] font-bold text-[#0F3A63]">Synthèse par section</h3>
                    <p className="mt-1 text-[12px] font-semibold text-slate-500">
                      Sections évaluées, scores et titres associés.
                    </p>
                  </div>
                  <div className="space-y-4">
                    {(result.sectionScores || []).map((section) => {
                      const pct = typeof section.average === "number" ? Math.round((section.average / 5) * 100) : 0;
                      return (
                        <div key={section.sectionId}>
                          <div className="mb-1 flex items-start justify-between gap-3 text-[13px] font-semibold text-[#0F3A63]">
                            <div>
                              <p>{section.title}</p>
                              {(section.pages || []).map((page, i) => (
                                <p key={i} className="mt-0.5 text-[11px] font-medium text-slate-500">
                                  {page.title} — {typeof page.average === "number" ? page.average.toFixed(1) : "--"}/5
                                </p>
                              ))}
                            </div>
                            <span className="shrink-0">{typeof section.average === "number" ? section.average.toFixed(1) : "--"}</span>
                          </div>
                          <div className="h-1.5 rounded-full bg-slate-300">
                            <div className="h-1.5 rounded-full bg-[#76B82A]" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })}
                    <div>
                      <div className="mb-1 flex items-center justify-between text-[13px] font-bold text-[#0F3A63]">
                        <p className="text-[16px]">Score global moyen</p>
                        <span className="text-[#76B82A]">{overallAverage !== null ? `${overallAverage.toFixed(1)} / 5` : "-- / 5"}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-slate-300">
                        <div className="h-1.5 rounded-full bg-[#76B82A]" style={{ width: `${overallPercent}%` }} />
                      </div>
                    </div>
                  </div>
                </article>

                <article className="w-[45%] rounded-md bg-white p-4 shadow-sm">
                  <h3 className="mb-3 text-[22px] font-bold leading-tight text-[#0F3A63]">Commentaire de la RH</h3>
                  <div className="space-y-3">
                    {sectionComments.length ? (
                      sectionComments.map((section) => (
                        <div key={section.sectionId} className="rounded-md bg-slate-100 p-4">
                          <p className="text-[11px] font-bold text-[#0F3A63]">{section.title}</p>
                          <p className="mt-2 text-[12px] text-slate-600">{section.comment}</p>
                        </div>
                      ))
                    ) : (
                      <div className="rounded-md bg-slate-100 p-4">
                        <p className="text-[12px] text-slate-600">
                          Les commentaires de la RH apparaîtront ici lorsqu'ils seront disponibles après le circuit de validation.
                        </p>
                      </div>
                    )}
                  </div>
                </article>
              </section>
            </>
          )}
        </div>
      );
    }

    if (activeSection === "received-comments") {
      return (
        <section className="space-y-4">
          <article className="rounded-md bg-white p-5 shadow-sm">
            <div className="mb-1 flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-[22px] font-bold text-[#0F3A63]">Commentaires anonymes reçus</h3>
                <p className="mt-1 text-[12px] font-semibold text-slate-500">
                  Ces commentaires ont été rédigés anonymement par des collaborateurs et vous sont destinés. L'identité des auteurs n'est pas divulguée.
                </p>
              </div>
              <span className="rounded-full border border-[#D9E3EE] bg-white px-3 py-1 text-[11px] font-bold text-[#0F4A72]">
                Anonyme · Confidentiel
              </span>
            </div>

            <div className="mt-5 space-y-3">
              {isLoadingReceived ? (
                <p className="rounded-md bg-[#EEF2F6] px-4 py-4 text-sm font-semibold text-slate-500">Chargement…</p>
              ) : receivedComments.length > 0 ? (
                receivedComments.map((item, index) => (
                  <div key={index} className="rounded-md border border-[#C3DFAA] bg-[#F4FAED] p-4">
                    <p className="rounded-md bg-white px-3 py-2 text-[12px] text-slate-700 ring-1 ring-[#C3DFAA]">
                      {item.comment}
                    </p>
                    <p className="mt-2 text-[11px] text-slate-400">
                      Reçu le {new Date(item.submittedAt).toLocaleDateString("fr-FR")}
                    </p>
                  </div>
                ))
              ) : (
                <p className="rounded-md bg-[#EEF2F6] px-4 py-4 text-sm font-semibold text-slate-500">
                  Aucun commentaire reçu pour le moment.
                </p>
              )}
            </div>
          </article>
        </section>
      );
    }

    if (activeSection === "profile") {
      return <ProfilePanel key={profileKey} user={user} onLogout={onLogout} onUserUpdate={onUserUpdate} />;
    }

    if (activeSection === "committee") {
      return (
        <ComiteEvaluation
          readOnly={assistantMode}
          initialDecisionScope="rh-final"
          onSubmit={(decisions) => saveCommitteeDecision({ scope: "rh-final", cycle_label: "Cycle 2025-2026", decisions })}
          submitLabel="Transmettre aux associés"
          submittedLabel="Transmis aux associés"
          successMessage="Classement des assistants, seniors et assistants managers transmis aux associés."
          workflowText="La RH classe les assistants, seniors et assistants managers, puis transmet le classement aux associés pour décision du taux d'augmentation."
        />
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
            {assistantMode && (
              <div>
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">Mes résultats</p>
                <div className="space-y-1">
                  <button
                    onClick={() => setActiveSection("my-results")}
                    className={`w-full rounded-md px-3 py-2 text-left transition ${
                      activeSection === "my-results" ? "bg-[#DDE6EE] font-semibold text-[#0E4A6B]" : "text-[#0F3A63] hover:bg-slate-100"
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <BarChart2 size={15} />
                      Mes résultats
                    </span>
                  </button>
                </div>
              </div>
            )}
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
