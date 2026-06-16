import { useEffect, useRef, useState } from "react";

function MemberSearchSelect({ members = [], selectedId, onSelect }) {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
        setQuery("");
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

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

  const selectedMember = members.find((member) => member.id === selectedId) || null;
  const normalizedQuery = query.trim().toLowerCase();
  const filteredMembers = normalizedQuery
    ? members.filter((member) =>
        [member.name, member.grade, member.department]
          .filter(Boolean)
          .some((value) => value.toLowerCase().includes(normalizedQuery))
      )
    : members;

  function handleSelect(memberId) {
    onSelect(memberId);
    setQuery("");
    setIsOpen(false);
  }

  return (
    <div ref={containerRef} className="relative rounded-md bg-white p-4 shadow-sm">
      <h3 className="mb-3 text-[14px] font-bold text-[#0F3A63]">Sélectionner un collaborateur</h3>
      <input
        type="text"
        value={
          isOpen
            ? query
            : selectedMember
              ? `${selectedMember.name}${selectedMember.grade ? ` - ${selectedMember.grade}` : ""}`
              : ""
        }
        onFocus={() => setIsOpen(true)}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Rechercher un collaborateur..."
        className="w-full rounded-md border border-slate-200 px-3 py-2 text-[12px] font-semibold text-[#0F3A63] outline-none focus:border-[#0F3A63]"
      />
      {isOpen ? (
        <div className="absolute left-4 right-4 z-10 mt-1 max-h-64 overflow-y-auto rounded-md border border-slate-200 bg-white shadow-lg">
          {filteredMembers.length ? (
            filteredMembers.map((member) => (
              <button
                key={member.id}
                type="button"
                onClick={() => handleSelect(member.id)}
                className={`block w-full px-3 py-2 text-left text-[12px] font-bold transition ${
                  member.id === selectedId ? "bg-[#0F3A63] text-white" : "text-[#0F3A63] hover:bg-slate-100"
                }`}
              >
                <span className="block">{member.name}</span>
                <span className={`block text-[10px] font-medium ${member.id === selectedId ? "text-slate-200" : "text-slate-500"}`}>
                  {member.grade}{member.department ? ` - ${member.department}` : ""}
                </span>
              </button>
            ))
          ) : (
            <p className="px-3 py-2 text-[12px] font-semibold text-slate-500">Aucun résultat.</p>
          )}
        </div>
      ) : null}
    </div>
  );
}

export default MemberSearchSelect;
