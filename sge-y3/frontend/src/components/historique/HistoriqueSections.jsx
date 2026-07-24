import { formatCommentDate } from "@/utils/historiqueUtils";

function HistoriqueSections({ cycle }) {
  return (
    <>
      <article className="rounded-md bg-white p-4 shadow-sm">
        <h3 className="mb-4 text-[18px] font-bold text-[#0F3A63]">Sections évaluées</h3>
        <div className="space-y-4">
          {cycle.sectionScores?.length ? (
            cycle.sectionScores.map((item) => (
              <div key={item.sectionId}>
                <div className="mb-1 flex items-center justify-between gap-3 text-[13px] font-semibold text-[#0F3A63]">
                  <p>{item.title}</p>
                  <span>{typeof item.score === "number" ? item.score.toFixed(1) : "--"}</span>
                </div>
                <div className="h-1.5 rounded-full bg-slate-300">
                  <div className="h-1.5 rounded-full bg-[#76B82A]" style={{ width: `${item.percent || 0}%` }} />
                </div>
              </div>
            ))
          ) : (
            <p className="text-[12px] font-semibold text-slate-500">Aucune section évaluée pour ce cycle.</p>
          )}
        </div>
      </article>

      <article className="rounded-md bg-white p-4 shadow-sm">
        <h3 className="mb-3 text-[18px] font-bold text-[#0F3A63]">Commentaires reçus</h3>
        <div className="space-y-3">
          {cycle.comments?.length ? (
            cycle.comments.map((item, index) => (
              <div key={`${item.authorName}-${index}`} className="rounded-md bg-slate-100 p-4">
                <p className="text-[12px] text-slate-600">{item.comment}</p>
                <p className="mt-8 text-[12px] font-semibold text-[#0F3A63]">
                  {item.authorName}{item.authorGrade ? ` - ${item.authorGrade}` : ""}
                  {formatCommentDate(item.submittedAt) ? ` - ${formatCommentDate(item.submittedAt)}` : ""}
                </p>
              </div>
            ))
          ) : (
            <div className="rounded-md bg-slate-100 p-4">
              <p className="text-[12px] text-slate-600">Aucun commentaire enregistré pour ce cycle.</p>
            </div>
          )}
        </div>
      </article>
    </>
  );
}

export default HistoriqueSections;
