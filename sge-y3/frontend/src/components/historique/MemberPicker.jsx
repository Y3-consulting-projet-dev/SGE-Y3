function MemberPicker({ members = [], selectedId, onSelect }) {
  if (!members.length) {
    return (
      <div className="rounded-md bg-white p-6 text-center shadow-sm">
        <p className="text-[14px] font-bold text-[#0F3A63]">Aucun collaborateur disponible</p>
        <p className="mt-2 text-[12px] font-semibold text-slate-500">
          Aucun membre d'équipe n'a été identifié pour ce cycle.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-md bg-white p-4 shadow-sm">
      <h3 className="mb-3 text-[14px] font-bold text-[#0F3A63]">Sélectionner un collaborateur</h3>
      <div className="flex flex-wrap gap-2">
        {members.map((member) => (
          <button
            key={member.id}
            type="button"
            onClick={() => onSelect(member.id)}
            className={`rounded-md px-4 py-2 text-left text-[12px] font-bold transition ${
              member.id === selectedId
                ? "bg-[#0F3A63] text-white"
                : "bg-slate-100 text-[#0F3A63] hover:bg-slate-200"
            }`}
          >
            <span className="block">{member.name}</span>
            <span className={`block text-[10px] font-medium ${member.id === selectedId ? "text-slate-200" : "text-slate-500"}`}>
              {member.grade}{member.department ? ` - ${member.department}` : ""}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

export default MemberPicker;
