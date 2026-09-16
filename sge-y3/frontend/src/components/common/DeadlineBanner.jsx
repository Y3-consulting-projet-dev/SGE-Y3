import { getDeadlineBannerState } from "@/hooks/useActiveCycle";

function DeadlineBanner({ isSubmitted, submittedMessage, endDate }) {
  if (isSubmitted) {
    return (
      <div className="rounded-sm bg-[#BFE2B9] px-3 py-2 text-[11px] font-semibold text-[#114F35]">
        {submittedMessage || "Auto-évaluation soumise. En attente de traitement."}
      </div>
    );
  }

  const { message } = getDeadlineBannerState(endDate);

  return <div className="rounded-sm bg-[#BFE2B9] px-3 py-2 text-[11px] font-semibold text-[#114F35]">{message}</div>;
}

export default DeadlineBanner;
