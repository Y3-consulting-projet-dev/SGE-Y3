function getStatusClass(status) {
  if (status === "Transmis au Manager") return "bg-[#76B82A] text-white";
  if (status === "En cours") return "bg-[#4B73D9] text-white";
  if (status === "Brouillon") return "bg-slate-200 text-[#0E4A6B]";
  return "bg-slate-100 text-[#0E4A6B]";
}

function Mesassistants({ assistants = [], isLoading, errorMessage, onOpenReview }) {
  if (isLoading) {
    return <section className="rounded-md bg-white p-5 text-sm font-semibold text-slate-500 shadow-sm">Chargement des assistants...</section>;
  }

  if (errorMessage) {
    return <section className="rounded-md bg-white p-5 text-sm font-semibold text-red-600 shadow-sm">{errorMessage}</section>;
  }

  if (!assistants.length) {
    return (
      <section className="rounded-md bg-white p-5 shadow-sm">
        <h2 className="text-xl font-bold text-[#0F3A63]">Mes assistants</h2>
        <p className="mt-3 text-sm font-semibold text-slate-500">Aucun assistant de code catégorie 8C ne partage actuellement votre département.</p>
      </section>
    );
  }

  return (
    <section className="overflow-hidden rounded-md bg-white shadow-sm">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="bg-[#003B63] text-left text-white">
            <th className="px-4 py-4 font-semibold">Assistant</th>
            <th className="px-4 py-4 font-semibold">Grade</th>
            <th className="px-4 py-4 font-semibold">Département</th>
            <th className="px-4 py-4 font-semibold">Statut de l'évaluation</th>
            <th className="px-4 py-4 font-semibold">Dernière sauvegarde</th>
            <th className="px-4 py-4 font-semibold">Action</th>
          </tr>
        </thead>
        <tbody>
          {assistants.map((assistant) => (
            <tr key={assistant.id} className="border-b border-slate-100 text-[#0F3A63] last:border-0">
              <td className="px-4 py-4 font-bold">{assistant.name}</td>
              <td className="px-4 py-4">{assistant.grade}</td>
              <td className="px-4 py-4">{assistant.department}</td>
              <td className="px-4 py-4">
                <span className={`inline-flex rounded-xl px-3 py-1 text-xs font-bold ${getStatusClass(assistant.review_status)}`}>
                  {assistant.review_status}
                </span>
              </td>
              <td className="px-4 py-4">{assistant.last_saved_at ? "Enregistrée" : "Non démarrée"}</td>
              <td className="px-4 py-4">
                <button onClick={() => onOpenReview?.(assistant.id)} className="font-bold text-[#2E5BC8] hover:underline">
                  Evaluer
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

export default Mesassistants;
