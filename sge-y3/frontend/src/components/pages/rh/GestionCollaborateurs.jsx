import { useEffect, useState } from "react";
import {
  createRhCollaborator,
  getRhCollaborators,
  setRhCollaboratorStatus,
  updateRhCollaborator,
} from "@/lib/rhOverview";
import { departmentOptions, gradeOptions } from "@/lib/userPresentation";

const EMPTY_CREATE_FORM = {
  first_name: "",
  last_name: "",
  email: "",
  grade: gradeOptions[0],
  department: "",
};

const STATUS_FILTERS = [
  { value: "active", label: "Actifs" },
  { value: "inactive", label: "Inactifs" },
  { value: "all", label: "Tous" },
];

function GestionCollaborateurs() {
  const [collaborators, setCollaborators] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [statusFilter, setStatusFilter] = useState("active");
  const [searchInput, setSearchInput] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  const [createForm, setCreateForm] = useState(EMPTY_CREATE_FORM);
  const [isCreating, setIsCreating] = useState(false);
  const [createMessage, setCreateMessage] = useState("");
  const [createIsError, setCreateIsError] = useState(false);

  const [editDrafts, setEditDrafts] = useState({});
  const [savingUserId, setSavingUserId] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const [actionIsError, setActionIsError] = useState(false);

  async function reloadCollaborators() {
    const response = await getRhCollaborators({ status: statusFilter, search: searchTerm });
    setCollaborators(response?.collaborators || []);
  }

  useEffect(() => {
    let cancelled = false;

    async function loadCollaborators() {
      try {
        setIsLoading(true);
        setLoadError("");
        setEditDrafts({});
        const response = await getRhCollaborators({ status: statusFilter, search: searchTerm });
        if (!cancelled) {
          setCollaborators(response?.collaborators || []);
        }
      } catch (error) {
        if (!cancelled) {
          setLoadError(error.message || "Chargement des collaborateurs impossible.");
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    loadCollaborators();

    return () => {
      cancelled = true;
    };
  }, [statusFilter, searchTerm]);

  function handleSearchSubmit(event) {
    event.preventDefault();
    setSearchTerm(searchInput.trim());
  }

  function updateCreateField(field, value) {
    setCreateForm((current) => ({ ...current, [field]: value }));
  }

  async function handleCreateSubmit(event) {
    event.preventDefault();
    setCreateMessage("");
    setCreateIsError(false);

    if (!createForm.first_name.trim() || !createForm.last_name.trim() || !createForm.email.trim() || !createForm.department) {
      setCreateIsError(true);
      setCreateMessage("Prenom, nom, email et departement sont requis.");
      return;
    }

    try {
      setIsCreating(true);
      const response = await createRhCollaborator(createForm);
      setCreateMessage(response.message || "Collaborateur cree avec succes.");
      setCreateIsError(false);
      setCreateForm(EMPTY_CREATE_FORM);
      await reloadCollaborators();
    } catch (error) {
      setCreateIsError(true);
      setCreateMessage(error.message || "Creation du collaborateur impossible.");
    } finally {
      setIsCreating(false);
    }
  }

  function getDraft(collaborator) {
    return (
      editDrafts[collaborator.id] || {
        first_name: collaborator.first_name || "",
        last_name: collaborator.last_name || "",
        email: collaborator.email || "",
        grade: collaborator.grade || "",
        department: collaborator.department || "",
      }
    );
  }

  function updateDraftField(collaborator, field, value) {
    setActionMessage("");
    setEditDrafts((current) => ({
      ...current,
      [collaborator.id]: { ...getDraft(collaborator), [field]: value },
    }));
  }

  function hasChanges(collaborator) {
    const draft = getDraft(collaborator);
    return (
      draft.first_name !== (collaborator.first_name || "") ||
      draft.last_name !== (collaborator.last_name || "") ||
      draft.email !== (collaborator.email || "") ||
      draft.grade !== (collaborator.grade || "") ||
      draft.department !== (collaborator.department || "")
    );
  }

  async function handleSave(collaborator) {
    const draft = getDraft(collaborator);

    try {
      setSavingUserId(collaborator.id);
      setActionMessage("");
      const response = await updateRhCollaborator(collaborator.id, draft);
      setActionMessage(response.message || "Collaborateur mis a jour avec succes.");
      setActionIsError(false);
      await reloadCollaborators();
    } catch (error) {
      setActionIsError(true);
      setActionMessage(error.message || "Mise a jour impossible.");
    } finally {
      setSavingUserId("");
    }
  }

  async function handleToggleStatus(collaborator) {
    const nextActive = !collaborator.is_active;

    if (!nextActive) {
      const confirmed = window.confirm(
        `Desactiver le compte de ${collaborator.name} ? Il ne pourra plus se connecter.`
      );
      if (!confirmed) {
        return;
      }
    }

    try {
      setSavingUserId(collaborator.id);
      setActionMessage("");
      const response = await setRhCollaboratorStatus(collaborator.id, nextActive);
      setActionMessage(response.message || "Statut mis a jour.");
      setActionIsError(false);
      await reloadCollaborators();
    } catch (error) {
      setActionIsError(true);
      setActionMessage(error.message || "Changement de statut impossible.");
    } finally {
      setSavingUserId("");
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-xl bg-white p-5 shadow-sm">
        <h2 className="text-xl font-extrabold text-[#0F3A63]">Creer un collaborateur</h2>
        <p className="mt-1 text-sm font-semibold text-slate-500">
          Le mot de passe par defaut sera Ycube@c2026. Le collaborateur pourra le modifier depuis son profil.
        </p>

        <form onSubmit={handleCreateSubmit} className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          <div>
            <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">Prenom</label>
            <input
              value={createForm.first_name}
              onChange={(event) => updateCreateField("first_name", event.target.value)}
              className="h-10 w-full rounded-lg border border-[#D6E1EF] bg-white px-3 text-sm font-semibold text-[#0F3A63] outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">Nom</label>
            <input
              value={createForm.last_name}
              onChange={(event) => updateCreateField("last_name", event.target.value)}
              className="h-10 w-full rounded-lg border border-[#D6E1EF] bg-white px-3 text-sm font-semibold text-[#0F3A63] outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">Email</label>
            <input
              type="email"
              value={createForm.email}
              onChange={(event) => updateCreateField("email", event.target.value)}
              className="h-10 w-full rounded-lg border border-[#D6E1EF] bg-white px-3 text-sm font-semibold text-[#0F3A63] outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">Grade</label>
            <select
              value={createForm.grade}
              onChange={(event) => updateCreateField("grade", event.target.value)}
              className="h-10 w-full rounded-lg border border-[#D6E1EF] bg-white px-3 text-sm font-semibold text-[#0F3A63] outline-none"
            >
              {gradeOptions.map((grade) => (
                <option key={grade} value={grade}>
                  {grade}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">Departement</label>
            <select
              value={createForm.department}
              onChange={(event) => updateCreateField("department", event.target.value)}
              className="h-10 w-full rounded-lg border border-[#D6E1EF] bg-white px-3 text-sm font-semibold text-[#0F3A63] outline-none"
            >
              <option value="">Selectionner</option>
              {departmentOptions.map((department) => (
                <option key={department} value={department}>
                  {department}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <button
              type="submit"
              disabled={isCreating}
              className={`rounded-full px-5 py-2 text-sm font-bold text-white ${
                isCreating ? "cursor-not-allowed bg-slate-300" : "bg-[#8BC53F]"
              }`}
            >
              {isCreating ? "Creation..." : "Creer le collaborateur"}
            </button>
          </div>
        </form>

        {createMessage ? (
          <p className={`mt-3 text-sm font-semibold ${createIsError ? "text-red-600" : "text-[#3F8F2F]"}`}>{createMessage}</p>
        ) : null}
      </section>

      <section className="rounded-xl bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-extrabold text-[#0F3A63]">Collaborateurs</h2>
            <p className="mt-1 text-sm font-semibold text-slate-500">Gestion des comptes collaborateurs.</p>
          </div>

          <form onSubmit={handleSearchSubmit} className="flex items-center gap-2">
            <input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Rechercher un nom ou un email"
              className="h-10 w-64 rounded-lg border border-[#D6E1EF] bg-white px-3 text-sm font-semibold text-[#0F3A63] outline-none placeholder:text-slate-400"
            />
            <button
              type="submit"
              className="rounded-full border border-[#D6E1EF] px-4 py-2 text-xs font-bold text-[#0F3A63]"
            >
              Rechercher
            </button>
          </form>
        </div>

        <div className="mt-4 flex gap-2">
          {STATUS_FILTERS.map((filter) => (
            <button
              key={filter.value}
              type="button"
              onClick={() => setStatusFilter(filter.value)}
              className={`rounded-full px-4 py-2 text-xs font-bold ${
                statusFilter === filter.value ? "bg-[#0D496A] text-white" : "border border-[#D6E1EF] text-[#0F3A63]"
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>

        {actionMessage ? (
          <p className={`mt-3 text-sm font-bold ${actionIsError ? "text-red-600" : "text-[#0F4A72]"}`}>{actionMessage}</p>
        ) : null}

        {isLoading ? (
          <p className="mt-4 text-sm font-semibold text-slate-500">Chargement des collaborateurs...</p>
        ) : loadError ? (
          <p className="mt-4 text-sm font-semibold text-red-600">{loadError}</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[1100px] text-left text-sm">
              <thead className="bg-white text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Prenom</th>
                  <th className="px-4 py-3">Nom</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Grade</th>
                  <th className="px-4 py-3">Departement</th>
                  <th className="px-4 py-3">Statut</th>
                  <th className="px-4 py-3">Action</th>
                </tr>
              </thead>
              <tbody>
                {collaborators.length ? (
                  collaborators.map((collaborator) => {
                    const draft = getDraft(collaborator);
                    const isSaving = savingUserId === collaborator.id;
                    const canSave = hasChanges(collaborator) && !isSaving;

                    return (
                      <tr key={collaborator.id} className="border-b border-slate-100 last:border-0">
                        <td className="px-4 py-3">
                          <input
                            value={draft.first_name}
                            onChange={(event) => updateDraftField(collaborator, "first_name", event.target.value)}
                            className="h-10 w-full min-w-[120px] rounded-lg border border-[#D6E1EF] bg-white px-3 text-sm font-semibold text-[#0F3A63] outline-none"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <input
                            value={draft.last_name}
                            onChange={(event) => updateDraftField(collaborator, "last_name", event.target.value)}
                            className="h-10 w-full min-w-[120px] rounded-lg border border-[#D6E1EF] bg-white px-3 text-sm font-semibold text-[#0F3A63] outline-none"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <input
                            value={draft.email}
                            onChange={(event) => updateDraftField(collaborator, "email", event.target.value)}
                            className="h-10 w-full min-w-[200px] rounded-lg border border-[#D6E1EF] bg-white px-3 text-sm font-semibold text-[#0F3A63] outline-none"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <select
                            value={draft.grade}
                            onChange={(event) => updateDraftField(collaborator, "grade", event.target.value)}
                            className="h-10 w-full min-w-[150px] rounded-lg border border-[#D6E1EF] bg-white px-3 text-sm font-semibold text-[#0F3A63] outline-none"
                          >
                            {gradeOptions.map((grade) => (
                              <option key={grade} value={grade}>
                                {grade}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-4 py-3">
                          <select
                            value={draft.department}
                            onChange={(event) => updateDraftField(collaborator, "department", event.target.value)}
                            className="h-10 w-full min-w-[200px] rounded-lg border border-[#D6E1EF] bg-white px-3 text-sm font-semibold text-[#0F3A63] outline-none"
                          >
                            <option value="">Selectionner</option>
                            {departmentOptions.map((department) => (
                              <option key={department} value={department}>
                                {department}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-4 py-3">
                          {collaborator.is_active ? (
                            <span className="rounded-full bg-[#E7F4DD] px-3 py-1 text-xs font-bold text-[#3F8F2F]">Actif</span>
                          ) : (
                            <span className="rounded-full bg-[#E7EDF3] px-3 py-1 text-xs font-bold text-slate-600">Inactif</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => handleSave(collaborator)}
                              disabled={!canSave}
                              className="rounded-full bg-[#0D496A] px-4 py-2 text-xs font-bold text-white disabled:cursor-not-allowed disabled:bg-slate-300"
                            >
                              {isSaving ? "..." : "Enregistrer"}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleToggleStatus(collaborator)}
                              disabled={isSaving}
                              className="rounded-full border border-[#D6E1EF] px-4 py-2 text-xs font-bold text-[#0F3A63] disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {collaborator.is_active ? "Desactiver" : "Reactiver"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={7} className="px-4 py-6 text-center text-sm font-semibold text-slate-500">
                      Aucun collaborateur trouve.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

export default GestionCollaborateurs;
