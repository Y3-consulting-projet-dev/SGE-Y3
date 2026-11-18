import { formatSelfEvaluationDate } from "@/api/evaluationPeriod";

// Bandeau des pages d'auto-évaluation : période close (lecture seule) ou date de clôture programmée.
function SelfEvaluationLockBanner({ lock }) {
  if (lock?.isClosed) {
    const date = formatSelfEvaluationDate(lock.deadline);

    return (
      <div role="status" className="mb-4 rounded-lg border border-[#F3C2C5] bg-[#FDE8E8] px-4 py-3 text-sm font-semibold text-[#9B2C33]">
        La période d'auto-évaluation est close{date ? ` depuis le ${date}` : ""}. Votre auto-évaluation est consultable mais ne
        peut plus être modifiée.
      </div>
    );
  }

  if (lock?.scheduledDeadline) {
    return (
      <div role="status" className="mb-4 rounded-lg bg-[#F1F5F9] px-4 py-2 text-xs font-semibold text-slate-600">
        Les auto-évaluations seront closes le {formatSelfEvaluationDate(lock.scheduledDeadline)} à 00:00.
      </div>
    );
  }

  return null;
}

export default SelfEvaluationLockBanner;
