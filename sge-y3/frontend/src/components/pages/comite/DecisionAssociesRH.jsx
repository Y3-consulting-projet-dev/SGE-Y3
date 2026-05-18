import { useEffect, useState } from "react";
import { committeeLevels } from "@/components/pages/comite/comiteData";
import { getLatestCommitteeDecision } from "@/lib/committee";

function formatDate(value) {
  if (!value) return "";
  return new Date(value).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function DecisionAssociesRH({
  emptyMessage = "Aucune décision des associés n'a encore été envoyée à la RH.",
  scope = "associate-final",
  subtitle = "La RH visualise ici les classements et taux d'augmentation envoyés par les associés. La vue se met à jour automatiquement.",
  title = "Décisions et taux reçus",
}) {
  const [decision, setDecision] = useState(null);
  const [selectedLevelKey, setSelectedLevelKey] = useState(committeeLevels[0].key);
  const [status, setStatus] = useState("");
  const selectedLevel = committeeLevels.find((level) => level.key === selectedLevelKey) || committeeLevels[0];
  const selectedPeople = decision?.decisions?.[selectedLevel.key] || [];

  useEffect(() => {
    let ignore = false;

    const loadDecision = () => {
      getLatestCommitteeDecision(scope)
        .then((data) => {
          if (ignore) return;
          setDecision(data.decision || null);
          setStatus("");
        })
        .catch(() => {
          if (!ignore) setStatus("Aucune décision associée chargée pour le moment.");
        });
    };

    loadDecision();
    const refreshTimer = window.setInterval(loadDecision, 5000);

    return () => {
      ignore = true;
      window.clearInterval(refreshTimer);
    };
  }, [scope]);

  return (
    <section className="rounded-xl bg-white p-5 shadow-sm">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase text-slate-400">Retour des associés</p>
          <h2 className="text-xl font-extrabold text-[#0F3A63]">{title}</h2>
          <p className="mt-1 text-sm font-semibold text-slate-500">{subtitle}</p>
        </div>
        {decision?.submitted_at ? (
          <span className="rounded-full bg-[#DDECCF] px-3 py-1 text-xs font-bold text-[#4E8B1B]">
            Reçu le {formatDate(decision.submitted_at)}
          </span>
        ) : null}
      </div>

      {!decision ? (
        <p className="rounded-lg bg-[#F8FAFC] px-4 py-3 text-sm font-semibold text-slate-500">
          {status || emptyMessage}
        </p>
      ) : (
        <article className={`rounded-[24px] border p-4 ${selectedLevel.tone}`}>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase opacity-75">Catégorie</p>
              <h3 className="text-lg font-black">
                {selectedLevel.label} - {selectedLevel.title}
              </h3>
            </div>
            <select
              value={selectedLevelKey}
              onChange={(event) => setSelectedLevelKey(event.target.value)}
              className="h-10 rounded-full border border-white/70 bg-white px-4 text-sm font-black text-[#0F3A63] outline-none"
            >
              {committeeLevels.map((level) => (
                <option key={level.key} value={level.key}>
                  {level.title}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            {selectedPeople.length ? (
              selectedPeople.map((person) => (
                <div key={person.id || person.name} className="flex items-center justify-between gap-3 rounded-lg bg-white px-3 py-2">
                  <div>
                    <p className="text-sm font-extrabold text-[#0F3A63]">{person.name}</p>
                    <p className="text-xs font-semibold text-slate-500">{person.role}</p>
                  </div>
                  <span className="rounded-full bg-[#E7EDF3] px-3 py-1 text-xs font-black text-[#0F4A72]">
                    {person.increaseRate || 0}%
                  </span>
                </div>
              ))
            ) : (
              <p className="rounded-lg bg-white/70 px-3 py-3 text-sm font-bold opacity-70">
                Aucune personne dans cette catégorie.
              </p>
            )}
          </div>
        </article>
      )}
    </section>
  );
}

export default DecisionAssociesRH;
