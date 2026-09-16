import { useEffect, useState } from "react";
import { getRhOverview, sendSelfEvaluationReminder } from "@/api/rhOverview";

function TableauRH({ onOpen, readOnly }) {
  const [overviewData, setOverviewData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [isSendingReminder, setIsSendingReminder] = useState(false);
  const [reminderFeedback, setReminderFeedback] = useState(null);

  async function handleSendReminder() {
    setIsSendingReminder(true);
    setReminderFeedback(null);

    try {
      const response = await sendSelfEvaluationReminder();
      setReminderFeedback({ tone: "success", message: response.message });
    } catch (error) {
      setReminderFeedback({ tone: "error", message: error.message || "Envoi du rappel impossible." });
    } finally {
      setIsSendingReminder(false);
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function loadOverview() {
      try {
        setIsLoading(true);
        setErrorMessage("");
        const response = await getRhOverview();

        if (!cancelled) {
          setOverviewData(response);
        }
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(error.message || "Chargement de la vue RH impossible.");
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    loadOverview();

    return () => {
      cancelled = true;
    };
  }, []);

  const rhStats = overviewData?.stats || [];
  const priorityRows = overviewData?.priority_rows || [];
  const calibrationRows = overviewData?.department_averages || [];

  if (isLoading) {
    return <section className="rounded-md bg-white p-5 text-sm font-semibold text-slate-500 shadow-sm">Chargement de la vue d'ensemble RH...</section>;
  }

  if (errorMessage) {
    return <section className="rounded-md bg-white p-5 text-sm font-semibold text-red-600 shadow-sm">{errorMessage}</section>;
  }

  return (
    <div className="space-y-6">
      {!readOnly ? (
        <section className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white p-4 shadow-sm">
          <div>
            <h2 className="text-sm font-extrabold text-[#0F3A63]">Rappel d'échéance</h2>
            <p className="text-xs font-semibold text-slate-500">
              Envoyer un rappel (notification + email) à tous ceux qui n'ont pas encore soumis leur auto-évaluation.
            </p>
          </div>
          <button
            type="button"
            onClick={handleSendReminder}
            disabled={isSendingReminder}
            className="rounded-full bg-[#8BC53F] px-5 py-2 text-xs font-bold text-white disabled:opacity-70"
          >
            {isSendingReminder ? "Envoi..." : "Envoyer un rappel"}
          </button>
          {reminderFeedback ? (
            <p
              className={`w-full text-xs font-semibold ${
                reminderFeedback.tone === "error" ? "text-[#B93840]" : "text-[#4E8B1B]"
              }`}
            >
              {reminderFeedback.message}
            </p>
          ) : null}
        </section>
      ) : null}

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {rhStats.map((card) => (
          <article key={card.title} className="rounded-lg bg-[#0D496A] p-4 text-white">
            <p className="text-sm font-semibold">{card.title}</p>
            <p className="mt-2 text-2xl font-extrabold leading-none">{card.value}</p>
            <p className="mt-2 text-xs text-slate-200">{card.subtitle}</p>
          </article>
        ))}
      </section>

      <section className="grid grid-cols-1 gap-5 xl:grid-cols-[1.2fr_1fr]">
        <article className="rounded-xl bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-4">
            <h2 className="text-xl font-extrabold text-[#0F3A63]">Validations prioritaires</h2>
            <button onClick={() => onOpen?.("validations")} className="rounded-full bg-[#8BC53F] px-4 py-2 text-xs font-bold text-white">
              Voir tout
            </button>
          </div>
          <div className="space-y-3">
            {priorityRows.length ? (
              priorityRows.map((row) => (
                <div key={row.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-slate-50 p-3">
                  <div>
                    <p className="text-sm font-extrabold text-[#0F3A63]">{row.name}</p>
                    <p className="text-xs font-semibold text-slate-500">
                      {row.role} - {row.manager}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-semibold text-slate-500">{row.status}</p>
                    <p className="text-lg font-black text-[#C53B3B]">{typeof row.score === "number" ? `${row.score}/5` : "--"}</p>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-lg bg-slate-50 p-4 text-sm font-semibold text-slate-500">
                Aucune validation prioritaire pour le moment.
              </div>
            )}
          </div>
        </article>

        <article className="rounded-xl bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-4">
            <h2 className="text-xl font-extrabold text-[#0F3A63]">Moyenne par département</h2>
            <button onClick={() => onOpen?.("department-evaluations")} className="rounded-full bg-[#0D496A] px-4 py-2 text-xs font-bold text-white">
              Voir les évaluations
            </button>
          </div>
          <div className="space-y-4">
            {calibrationRows.length ? (
              calibrationRows.map((item) => (
                <div key={item.department}>
                  <div className="mb-1 flex items-center justify-between text-sm font-bold text-[#0F4A72]">
                    <p>{item.department}</p>
                    <p>{item.average}</p>
                  </div>
                  <div className="h-2 rounded-full bg-slate-200">
                    <div className="h-2 rounded-full bg-[#4E75C7]" style={{ width: item.width }} />
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-lg bg-slate-50 p-4 text-sm font-semibold text-slate-500">
                Aucune moyenne disponible par département.
              </div>
            )}
          </div>
        </article>
      </section>
    </div>
  );
}

export default TableauRH;
