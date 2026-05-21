import { useEffect, useState } from "react";
import { getRhSyntheses, submitRhSyntheses } from "@/lib/rhOverview";

function SynthesesRH({ readOnly = false }) {
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadSyntheses() {
      try {
        setIsLoading(true);
        setErrorMessage("");
        setFeedbackMessage("");
        const response = await getRhSyntheses();
        if (!cancelled) {
          setData(response);
        }
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(error.message || "Chargement des synthèses RH impossible.");
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    loadSyntheses();
    return () => {
      cancelled = true;
    };
  }, []);

  const rows = data?.items || [];

  async function handleSubmitSyntheses() {
    try {
      setIsSubmitting(true);
      setErrorMessage("");
      setFeedbackMessage("");
      const response = await submitRhSyntheses();
      setData({
        cycle_label: response.cycle_label || data?.cycle_label,
        items: response.items || [],
      });
      setFeedbackMessage(response.message || "Les synthèses ont bien été transmises.");
    } catch (error) {
      setErrorMessage(error.message || "Transmission des synthèses impossible.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading) {
    return <section className="rounded-md bg-white p-5 text-sm font-semibold text-slate-500 shadow-sm">Chargement des synthèses RH...</section>;
  }

  if (errorMessage) {
    return <section className="rounded-md bg-white p-5 text-sm font-semibold text-red-600 shadow-sm">{errorMessage}</section>;
  }

  return (
    <section className="rounded-xl bg-white p-5 shadow-sm">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-extrabold text-[#0F3A63]">Synthèses RH</h2>
          <p className="text-sm font-semibold text-slate-500">Dossiers consolidés et prêts à être transmis.</p>
        </div>
        <button
          type="button"
          onClick={handleSubmitSyntheses}
          disabled={readOnly || !rows.length || isSubmitting}
          className={`rounded-full px-4 py-2 text-xs font-bold ${
            readOnly || !rows.length || isSubmitting ? "cursor-not-allowed bg-slate-200 text-slate-500" : "bg-[#0D496A] text-white"
          }`}
        >
          {readOnly ? "Lecture seule" : isSubmitting ? "Transmission..." : "Transmettre à l'Associé"}
        </button>
      </div>

      {feedbackMessage ? (
        <div className="mb-4 rounded-md bg-[#DCECCB] px-4 py-3 text-sm font-semibold text-[#184D2E]">
          {feedbackMessage}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        {rows.length ? (
          rows.map((row) => (
            <article key={row.id} className="rounded-lg border border-slate-100 bg-[#F8FAFC] p-4">
              <p className="text-xs font-bold uppercase text-slate-400">{row.role}</p>
              <h3 className="mt-1 text-lg font-extrabold text-[#0F3A63]">{row.name}</h3>
              <div className="mt-4 grid grid-cols-2 gap-3 text-sm font-semibold text-[#0F3A63]">
                <div className="rounded-md bg-white px-3 py-2">
                  <p className="text-xs text-slate-500">Score mission</p>
                  <p className="mt-1 font-bold">{typeof row.missionScore === "number" ? row.missionScore : "--"}</p>
                </div>
                <div className="rounded-md bg-white px-3 py-2">
                  <p className="text-xs text-slate-500">Score manager mission</p>
                  <p className="mt-1 font-bold">{typeof row.managerMissionScore === "number" ? row.managerMissionScore : "--"}</p>
                </div>
                <div className="rounded-md bg-white px-3 py-2">
                  <p className="text-xs text-slate-500">Score auto-évaluation</p>
                  <p className="mt-1 font-bold">{typeof row.selfScore === "number" ? row.selfScore : "--"}</p>
                </div>
                <div className="rounded-md bg-white px-3 py-2">
                  <p className="text-xs text-slate-500">Score manager</p>
                  <p className="mt-1 font-bold">{typeof row.managerScore === "number" ? row.managerScore : "--"}</p>
                </div>
              </div>
              <div className="mt-4 flex items-end justify-between">
                <div>
                  <p className="text-xs font-semibold text-slate-500">Manager evaluateur</p>
                  <p className="mt-1 text-sm font-bold text-[#0F4A72]">{row.managerName}</p>
                </div>
                <p className="text-2xl font-black text-[#78B843]">
                  {typeof row.finalScore === "number" ? row.finalScore : "--"}
                </p>
              </div>
              <p className="mt-4 rounded-md bg-white px-3 py-2 text-xs font-bold text-slate-500">
                Décision : RH validée, prête pour transmission
              </p>
            </article>
          ))
        ) : (
          <div className="rounded-lg bg-slate-50 px-4 py-5 text-sm font-semibold text-slate-500 xl:col-span-3">
            Aucune synthèse prête à transmettre pour le moment.
          </div>
        )}
      </div>
    </section>
  );
}

export default SynthesesRH;
