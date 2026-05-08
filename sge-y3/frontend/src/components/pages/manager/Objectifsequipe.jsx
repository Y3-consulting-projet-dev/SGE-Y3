import { useEffect, useMemo, useRef, useState } from "react";
import { Target, TrendingDown, Users } from "lucide-react";

const initialObjectives = [
  {
    title: "Certification DSCG",
    collaborator: "Amelie K",
    deadline: "30/06",
    indicator: "Examen passe et valide",
    progress: 65,
    status: "En bonne voie",
  },
  {
    title: "Reduire delais rapports a 48h",
    collaborator: "Orlane K.",
    deadline: "30/04",
    indicator: "Rapports transmis sous 48h",
    progress: 40,
    status: "A surveiller",
  },
  {
    title: "Encadrer 2 juniors",
    collaborator: "Kader K",
    deadline: "31/05",
    indicator: "Deux juniors autonomes sur les travaux confies",
    progress: 100,
    status: "Atteint",
  },
];

const collaborators = ["Amelie K", "Orlane K.", "Kader K", "Habib Bah", "Louise Yao"];
const statuses = ["En bonne voie", "A surveiller", "Atteint", "Brouillon"];

function getStatusClass(status) {
  if (status === "Atteint") return "bg-[#DFECD4] text-[#5E8F2A]";
  if (status === "En bonne voie") return "bg-[#DFECD4] text-[#5E8F2A]";
  if (status === "A surveiller") return "bg-[#F5D5AF] text-[#B56A00]";
  return "bg-slate-100 text-[#0F3A63]";
}

function getBarClass(status) {
  if (status === "Atteint") return "bg-[#79B742]";
  if (status === "A surveiller") return "bg-[#4A3EF0]";
  return "bg-[#5C75C9]";
}

function StatCard({ title, value, subtitle, icon }) {
  return (
    <article className="rounded-lg bg-[#003B63] p-4 text-white shadow-sm">
      <div className="mb-5 flex items-start justify-between">
        <p className="text-xs font-semibold">{title}</p>
        {icon}
      </div>
      <p className="text-2xl font-extrabold">{value}</p>
      <p className="mt-2 text-xs text-[#D8E6F0]">{subtitle}</p>
    </article>
  );
}

function Objectifsequipe({ createSignal = 0 }) {
  const formRef = useRef(null);
  const titleInputRef = useRef(null);
  const [objectives, setObjectives] = useState(initialObjectives);
  const [memberFilter, setMemberFilter] = useState("Tous les membres");
  const [statusFilter, setStatusFilter] = useState("Tous les statuts");
  const [saveStatus, setSaveStatus] = useState("");
  const [form, setForm] = useState({
    collaborator: "Orlane K.",
    indicator: "",
    title: "",
    deadline: "",
    status: "Brouillon",
  });

  useEffect(() => {
    if (createSignal > 0) {
      formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      titleInputRef.current?.focus();
    }
  }, [createSignal]);

  const filteredObjectives = useMemo(
    () =>
      objectives.filter((item) => {
        const matchesMember = memberFilter === "Tous les membres" || item.collaborator === memberFilter;
        const matchesStatus = statusFilter === "Tous les statuts" || item.status === statusFilter;
        return matchesMember && matchesStatus;
      }),
    [objectives, memberFilter, statusFilter]
  );

  const averageProgress = Math.round(
    objectives.reduce((total, objective) => total + objective.progress, 0) / Math.max(objectives.length, 1)
  );

  const updateForm = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
    setSaveStatus("");
  };

  const saveObjective = () => {
    const title = form.title.trim();
    const indicator = form.indicator.trim();
    const deadline = form.deadline.trim();

    if (!title || !indicator || !deadline) {
      setSaveStatus("missing");
      return;
    }

    setObjectives((items) => [
      ...items,
      {
        title,
        collaborator: form.collaborator,
        deadline,
        indicator,
        progress: 0,
        status: form.status,
      },
    ]);
    setForm({ collaborator: "Orlane K.", indicator: "", title: "", deadline: "", status: "Brouillon" });
    setSaveStatus("saved");
  };

  return (
    <div className="space-y-5">
      <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <StatCard
          title="Objectifs actifs"
          value={objectives.length}
          subtitle={`${filteredObjectives.length} affiches selon les filtres`}
          icon={<Users size={18} className="text-[#DCEAF5]" />}
        />
        <StatCard
          title="Taux d'atteinte moyen"
          value={`${averageProgress}%`}
          subtitle="-5% vs trimestre precedent"
          icon={<TrendingDown size={18} className="text-[#F15C5C]" />}
        />
      </section>

      <section className="rounded-md bg-white p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-bold text-[#0F3A63]">Objectifs par collaborateur</h2>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={memberFilter}
              onChange={(event) => setMemberFilter(event.target.value)}
              className="h-9 rounded-md border border-slate-200 bg-[#8BC53F] px-3 text-xs font-semibold text-white outline-none"
            >
              <option>Tous les membres</option>
              {collaborators.map((collaborator) => (
                <option key={collaborator}>{collaborator}</option>
              ))}
            </select>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="h-9 rounded-md border border-slate-200 bg-[#8BC53F] px-3 text-xs font-semibold text-white outline-none"
            >
              <option>Tous les statuts</option>
              {statuses.map((status) => (
                <option key={status}>{status}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="overflow-hidden rounded-md border border-slate-100">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-[#003B63] text-left text-white">
                <th className="px-4 py-3 font-semibold">Objectif</th>
                <th className="px-4 py-3 font-semibold">Collaborateur</th>
                <th className="px-4 py-3 font-semibold">Echeance</th>
                <th className="px-4 py-3 font-semibold">Progression</th>
                <th className="px-4 py-3 font-semibold">Statut</th>
              </tr>
            </thead>
            <tbody>
              {filteredObjectives.map((item) => (
                <tr key={`${item.title}-${item.collaborator}`} className="border-b border-slate-100 text-[#0F3A63] last:border-0">
                  <td className="px-4 py-4">
                    <p className="font-semibold">{item.title}</p>
                    <p className="mt-1 text-xs text-slate-500">{item.indicator}</p>
                  </td>
                  <td className="px-4 py-4">{item.collaborator}</td>
                  <td className="px-4 py-4">{item.deadline}</td>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-3">
                      <div className="h-2 w-full max-w-[140px] rounded-full bg-slate-200">
                        <div className={`h-2 rounded-full ${getBarClass(item.status)}`} style={{ width: `${item.progress}%` }} />
                      </div>
                      <span className="min-w-10 text-xs font-semibold">{item.progress}%</span>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <span className={`inline-flex rounded-lg px-3 py-1 text-xs font-semibold ${getStatusClass(item.status)}`}>
                      {item.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section ref={formRef} className="rounded-md bg-white p-4 shadow-sm">
        <h2 className="mb-4 text-sm font-bold text-[#0F3A63]">Creer un objectif SMART</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <label className="space-y-2">
            <span className="text-xs font-semibold text-[#0F3A63]">Collaborateur</span>
            <select
              value={form.collaborator}
              onChange={(event) => updateForm("collaborator", event.target.value)}
              className="h-11 w-full rounded-md border border-slate-200 bg-slate-50 px-3 text-sm text-[#0F3A63] outline-none"
            >
              {collaborators.map((collaborator) => (
                <option key={collaborator}>{collaborator}</option>
              ))}
            </select>
          </label>

          <label className="space-y-2">
            <span className="text-xs font-semibold text-[#0F3A63]">Indicateur de reussite</span>
            <input
              type="text"
              value={form.indicator}
              onChange={(event) => updateForm("indicator", event.target.value)}
              placeholder="EX: examen passe et valide"
              className="h-11 w-full rounded-md border border-slate-200 bg-slate-50 px-3 text-sm text-[#0F3A63] outline-none placeholder:text-slate-400"
            />
          </label>

          <label className="space-y-2">
            <span className="text-xs font-semibold text-[#0F3A63]">Intitule de l'objectif</span>
            <input
              ref={titleInputRef}
              type="text"
              value={form.title}
              onChange={(event) => updateForm("title", event.target.value)}
              placeholder="EX: Certification DSCG avant juin 2026"
              className="h-11 w-full rounded-md border border-slate-200 bg-slate-50 px-3 text-sm text-[#0F3A63] outline-none placeholder:text-slate-400"
            />
          </label>

          <label className="space-y-2">
            <span className="text-xs font-semibold text-[#0F3A63]">Date cible</span>
            <input
              type="text"
              value={form.deadline}
              onChange={(event) => updateForm("deadline", event.target.value)}
              placeholder="JJ/MM/AAAA"
              className="h-11 w-full rounded-md border border-slate-200 bg-slate-50 px-3 text-sm text-[#0F3A63] outline-none placeholder:text-slate-400"
            />
          </label>

          <label className="space-y-2 md:col-span-2">
            <span className="text-xs font-semibold text-[#0F3A63]">Statut initial</span>
            <select
              value={form.status}
              onChange={(event) => updateForm("status", event.target.value)}
              className="h-11 w-full rounded-md border border-slate-200 bg-slate-50 px-3 text-sm text-[#0F3A63] outline-none"
            >
              {statuses.map((status) => (
                <option key={status}>{status}</option>
              ))}
            </select>
          </label>
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-end gap-3">
          <button
            onClick={saveObjective}
            className="inline-flex items-center gap-2 rounded-full bg-[#8BC53F] px-5 py-2 text-sm font-semibold text-white"
          >
            <Target size={16} />
            Enregistrer l'objectif
          </button>
          {saveStatus ? (
            <p className={`w-full text-right text-xs font-bold ${saveStatus === "missing" ? "text-[#A4252F]" : "text-[#76B82A]"}`}>
              {saveStatus === "missing" ? "Renseignez l'objectif, l'indicateur et la date cible." : "Objectif enregistré dans le tableau."}
            </p>
          ) : null}
        </div>
      </section>
    </div>
  );
}

export default Objectifsequipe;
