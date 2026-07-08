function CommentairesRecus({ comments = [], isLoading = false }) {
  if (isLoading) {
    return (
      <section className="rounded-xl bg-white p-6 text-sm text-slate-500 shadow-sm">
        Chargement des commentaires...
      </section>
    );
  }

  return (
    <>
      <div className="mb-6 border-l-4 border-[#7CB342] bg-[#DCECCB] px-4 py-3 text-sm text-[#184D2E]">
        Ces commentaires ont été rédigés anonymement par vos collaborateurs dans le cadre du cycle d'évaluation en cours.
        Leur identité ne vous est pas communiquée.
      </div>

      {comments.length === 0 ? (
        <section className="rounded-xl bg-white p-10 text-center shadow-sm">
          <p className="text-sm font-semibold text-slate-500">Aucun commentaire anonyme reçu pour ce cycle.</p>
        </section>
      ) : (
        <div className="space-y-4">
          {comments.map((item, index) => (
            <article key={index} className="rounded-xl bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-6">
                <p className="text-sm leading-relaxed text-slate-700">{item.comment}</p>
                {item.submittedAt && (
                  <time className="shrink-0 text-xs text-slate-400">
                    {new Date(item.submittedAt).toLocaleDateString("fr-FR", {
                      day: "2-digit",
                      month: "long",
                      year: "numeric",
                    })}
                  </time>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </>
  );
}

export default CommentairesRecus;
