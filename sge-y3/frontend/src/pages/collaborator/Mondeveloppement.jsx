import { useEffect, useRef, useState } from "react";
import { saveMyDevelopmentPlan, submitMyDevelopmentPlan } from "@/api/collaboratorEvaluation";

function Mondeveloppement({ evaluationData, onDevelopmentChange }) {
  const development = evaluationData?.development || {};
  const managers = evaluationData?.assignee?.submitted_to_users || [];
  const isSubmitted = development.status === "Soumis au Manager";

  const [wishes, setWishes] = useState(development.wishes || "");
  const [trainingRequests, setTrainingRequests] = useState(() => development.trainingRequests || []);
  const [newTraining, setNewTraining] = useState("");
  const [selectedManagerId, setSelectedManagerId] = useState(() => {
    if (development.submittedToUserId) return development.submittedToUserId;
    if (managers.length === 1) return managers[0].id;
    return "";
  });
  const [isSaving, setIsSaving] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUpdatingTrainings, setIsUpdatingTrainings] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [feedbackType, setFeedbackType] = useState("success");
  const inputRef = useRef(null);

  useEffect(() => {
    setWishes(development.wishes || "");
    setTrainingRequests(development.trainingRequests || []);
    if (development.submittedToUserId) {
      setSelectedManagerId(development.submittedToUserId);
    } else if (managers.length === 1) {
      setSelectedManagerId(managers[0].id);
    }
  }, [evaluationData]);

  function addTraining() {
    const trimmed = newTraining.trim();
    if (!trimmed) return;
    if (!trainingRequests.includes(trimmed)) {
      setTrainingRequests((prev) => [...prev, trimmed]);
    }
    setNewTraining("");
    setFeedback("");
    inputRef.current?.focus();
  }

  function removeTraining(index) {
    setTrainingRequests((prev) => prev.filter((_, i) => i !== index));
    setFeedback("");
  }

  async function handleUpdateTrainings() {
    if (isUpdatingTrainings) return;
    const managerId = managers.length === 1 ? managers[0].id : selectedManagerId;
    if (!managerId) {
      setFeedback("Veuillez sélectionner un Manager avant de mettre à jour.");
      setFeedbackType("error");
      return;
    }
    setIsUpdatingTrainings(true);
    setFeedback("");
    try {
      const result = await saveMyDevelopmentPlan({ wishes, trainingRequests, managerId });
      onDevelopmentChange?.(result.development);
      setFeedback("Formations mises à jour.");
      setFeedbackType("success");
    } catch (error) {
      setFeedback(error.message || "Mise à jour impossible.");
      setFeedbackType("error");
    } finally {
      setIsUpdatingTrainings(false);
    }
  }

  async function handleSave() {
    if (isSaving || isSubmitted) return;
    setIsSaving(true);
    setFeedback("");
    try {
      const result = await saveMyDevelopmentPlan({ wishes, trainingRequests });
      onDevelopmentChange?.(result.development);
      setFeedback("Plan enregistré.");
      setFeedbackType("success");
    } catch (error) {
      setFeedback(error.message || "Enregistrement impossible.");
      setFeedbackType("error");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSubmit() {
    if (isSubmitting || isSubmitted) return;
    if (!selectedManagerId) {
      setFeedback("Veuillez sélectionner un Manager avant d'envoyer.");
      setFeedbackType("error");
      return;
    }
    setIsSubmitting(true);
    setFeedback("");
    try {
      await saveMyDevelopmentPlan({ wishes, trainingRequests });
      const result = await submitMyDevelopmentPlan(selectedManagerId);
      onDevelopmentChange?.(result.development);
      setFeedback(result.message || "Plan envoyé au Manager.");
      setFeedbackType("success");
    } catch (error) {
      setFeedback(error.message || "Envoi impossible.");
      setFeedbackType("error");
    } finally {
      setIsSubmitting(false);
    }
  }

  const hasContent = wishes.trim().length > 0 || trainingRequests.length > 0;

  return (
    <div className="space-y-4">
      {/* Statut */}
      <div className="flex flex-wrap items-center gap-3">
        <span
          className={`rounded-full px-3 py-1 text-[11px] font-bold ${
            isSubmitted ? "bg-[#DCECCB] text-[#2A5C08]" : "bg-slate-100 text-slate-500"
          }`}
        >
          {isSubmitted ? "Soumis au Manager" : "Brouillon"}
        </span>
        {isSubmitted && development.submittedToName && (
          <span className="text-[11px] font-semibold text-slate-500">
            → {development.submittedToName}
          </span>
        )}
        {isSubmitted && development.submittedAt && (
          <span className="text-[11px] text-slate-400">
            le {new Date(development.submittedAt).toLocaleDateString("fr-FR")}
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.2fr_1fr]">
        {/* Souhaits d'évolution */}
        <article className="rounded-md bg-white p-4 shadow-sm">
          <h2 className="mb-2 text-[20px] font-bold text-[#0F3A63]">Mes souhaits d'évolution</h2>
          <p className="mb-3 text-[12px] font-semibold text-slate-500">
            Décrivez vos ambitions professionnelles, vos objectifs de carrière et les compétences que vous
            souhaitez développer. Ces informations seront visibles par votre Manager.
          </p>
          <textarea
            rows={8}
            value={wishes}
            onChange={(e) => {
              if (!isSubmitted) {
                setWishes(e.target.value);
                setFeedback("");
              }
            }}
            readOnly={isSubmitted}
            placeholder={
              isSubmitted
                ? ""
                : "Ex : Évoluer vers un poste de Senior d'ici 2027. Je souhaite me spécialiser en audit des groupes consolidés..."
            }
            className={`w-full resize-none rounded-md px-3 py-2 text-[12px] text-[#0F3A63] outline-none ${
              isSubmitted
                ? "cursor-default bg-slate-100"
                : "bg-slate-100 focus:ring-1 focus:ring-[#001871]"
            }`}
          />
        </article>

        {/* Demandes de formation — toujours éditable */}
        <article className="rounded-md bg-white p-4 shadow-sm">
          <h2 className="mb-2 text-[20px] font-bold text-[#0F3A63]">Demandes de formation</h2>
          <p className="mb-3 text-[12px] font-semibold text-slate-500">
            Ajoutez les formations que vous souhaitez suivre. Votre Manager pourra les valider et les planifier.
          </p>

          {/* Décision du manager visible par le collaborateur */}
          {isSubmitted && (() => {
            const decision = development.trainingDecision || "En attente";
            if (decision === "En attente") return null;
            return (
              <div className={`mb-3 rounded-md border px-3 py-2 ${decision === "Accepté" ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"}`}>
                <p className="text-[12px] font-bold text-[#0F3A63]">
                  Décision du Manager :{" "}
                  <span className={decision === "Accepté" ? "text-[#2A5C08]" : "text-red-700"}>
                    {decision}
                  </span>
                </p>
                {development.trainingManagerComment && (
                  <p className="mt-1 text-[12px] font-semibold text-slate-600">
                    {development.trainingManagerComment}
                  </p>
                )}
                {development.trainingDecidedAt && (
                  <p className="mt-1 text-[11px] text-slate-400">
                    Le {new Date(development.trainingDecidedAt).toLocaleDateString("fr-FR")}
                  </p>
                )}
              </div>
            );
          })()}

          <div className="mb-3 flex gap-2">
            <input
              ref={inputRef}
              type="text"
              value={newTraining}
              onChange={(e) => setNewTraining(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addTraining()}
              placeholder="Ex : Formation CEGID avancé, Normes IFRS..."
              className="flex-1 rounded-md bg-slate-100 px-3 py-2 text-[12px] text-[#0F3A63] outline-none focus:ring-1 focus:ring-[#001871]"
            />
            <button
              type="button"
              onClick={addTraining}
              disabled={!newTraining.trim()}
              className="rounded-md bg-[#001871] px-4 py-2 text-[12px] font-bold text-white hover:opacity-90 disabled:opacity-40"
            >
              Ajouter
            </button>
          </div>

          {trainingRequests.length === 0 ? (
            <p className="text-[12px] font-semibold italic text-slate-400">
              Aucune formation ajoutée pour l'instant.
            </p>
          ) : (
            <ul className="space-y-2">
              {trainingRequests.map((item, index) => (
                <li
                  key={index}
                  className="flex items-center justify-between gap-2 rounded-md border border-[#D5DBEE] bg-[#F0F3FA] px-3 py-2"
                >
                  <span className="text-[12px] font-semibold text-[#0F3A63]">{item}</span>
                  <button
                    type="button"
                    onClick={() => removeTraining(index)}
                    className="shrink-0 rounded-md bg-slate-200 px-2 py-0.5 text-[11px] font-bold text-slate-500 hover:bg-slate-300"
                  >
                    Retirer
                  </button>
                </li>
              ))}
            </ul>
          )}

        </article>
      </div>

      {/* Bloc d'actions — toujours visible */}
      <div className="rounded-md bg-white p-4 shadow-sm space-y-3">
        <div>
          <label className="mb-1 block text-[13px] font-bold text-[#0F3A63]">
            Envoyer à
          </label>
          {managers.length === 0 ? (
            <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] font-semibold text-amber-700">
              Aucun manager trouvé pour votre département. Contactez l'administration RH.
            </p>
          ) : managers.length === 1 ? (
            <div className="rounded-md bg-slate-100 px-3 py-2 text-[12px] font-semibold text-[#0F3A63]">
              {managers[0].name}
              <span className="ml-2 text-[11px] font-normal text-slate-500">
                {managers[0].grade} · {managers[0].department}
              </span>
            </div>
          ) : (
            <select
              value={selectedManagerId}
              onChange={(e) => { setSelectedManagerId(e.target.value); setFeedback(""); }}
              className="w-full rounded-md bg-slate-100 px-3 py-2 text-[12px] font-semibold text-[#0F3A63] outline-none focus:ring-1 focus:ring-[#001871]"
            >
              <option value="">— Choisir un Manager —</option>
              {managers.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} · {m.grade} · {m.department}
                </option>
              ))}
            </select>
          )}
        </div>

        {feedback && (
          <p className={`text-[12px] font-semibold ${feedbackType === "success" ? "text-[#76B82A]" : "text-red-600"}`}>
            {feedback}
          </p>
        )}

        <div className="flex flex-wrap gap-3">
          {!isSubmitted && (
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving || isSubmitting || managers.length === 0}
              className="rounded-md bg-slate-200 px-5 py-2 text-[13px] font-bold text-[#0F3A63] hover:bg-slate-300 disabled:opacity-50"
            >
              {isSaving ? "Enregistrement..." : "Enregistrer"}
            </button>
          )}
          <button
            type="button"
            onClick={isSubmitted ? handleUpdateTrainings : handleSubmit}
            disabled={
              isSaving ||
              isSubmitting ||
              isUpdatingTrainings ||
              managers.length === 0 ||
              (!selectedManagerId && managers.length > 1) ||
              (!isSubmitted && !hasContent)
            }
            className="rounded-md bg-[#001871] px-5 py-2 text-[13px] font-bold text-white hover:opacity-90 disabled:opacity-50"
          >
            {(isSubmitting || isUpdatingTrainings) ? "Envoi en cours..." : "Envoyer au Manager"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default Mondeveloppement;
