import { useMemo, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, Download, X } from "lucide-react";

const monthFormatter = new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" });
const dayFormatter = new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
const weekDays = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
const missionColorsByRole = {
  senior:  { bg: "#D5DBEE", hover: "#BCC5E4", text: "#00114F", accent: "#001871" },
  manager: { bg: "#EAFAD0", hover: "#D9F5B5", text: "#2A5C08", accent: "#78BE20" },
  self:    { bg: "#DCEEFA", hover: "#C3E4F6", text: "#1A5272", accent: "#62B5E5" },
};

const calendarLegend = [
  { label: "Assignée par Senior", color: missionColorsByRole.senior },
  { label: "Assignée par Manager", color: missionColorsByRole.manager },
  { label: "Assistant", color: missionColorsByRole.self },
];

function toDate(value) {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function toIsoDate(date) {
  if (!date) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseFrenchDate(value) {
  const [day, month, year] = String(value || "").split("-");
  if (!day || !month || !year) return "";
  return `${year}-${month}-${day}`;
}

function getDatesFromPeriod(period = "") {
  const matches = String(period).match(/\d{2}-\d{2}-\d{4}/g) || [];
  return {
    startDate: matches[0] ? parseFrenchDate(matches[0]) : "",
    endDate: matches[1] ? parseFrenchDate(matches[1]) : matches[0] ? parseFrenchDate(matches[0]) : "",
  };
}

function getMissionDates(mission) {
  const parsed = getDatesFromPeriod(mission?.period);
  return {
    startDate: mission?.startDate || mission?.start_date || parsed.startDate,
    endDate: mission?.endDate || mission?.end_date || parsed.endDate || mission?.startDate || parsed.startDate,
  };
}

function getMissionProgress(mission) {
  const criteria = mission?.criteria || [];
  if (!criteria.length) return 0;
  const answered = criteria.filter((criterion) => criterion.score !== null && criterion.score !== undefined).length;
  return Math.round((answered / criteria.length) * 100);
}

function getMissionAverage(mission) {
  const scores = (mission?.criteria || []).map((criterion) => criterion.score).filter((score) => typeof score === "number");
  if (!scores.length) return "--";
  return (scores.reduce((total, score) => total + score, 0) / scores.length).toFixed(1);
}

function getMissionColor(mission) {
  if (mission?.createdByRole === "senior") return missionColorsByRole.senior;
  if (mission?.createdByRole === "manager") return missionColorsByRole.manager;
  return missionColorsByRole.self;
}

function escapeXml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function getMissionComments(mission) {
  const comments = [];
  const sectionComments = new Map();

  (mission?.criteria || []).forEach((criterion) => {
    const comment = String(criterion.sectionComment || criterion.section_comment || "").trim();
    const sectionTitle = criterion.sectionTitle || criterion.section_title || "Section";
    if (comment && !sectionComments.has(sectionTitle)) {
      sectionComments.set(sectionTitle, comment);
    }
  });

  sectionComments.forEach((comment, sectionTitle) => {
    comments.push({ title: sectionTitle, comment });
  });

  if (String(mission?.comment || "").trim()) {
    comments.push({ title: "Commentaire général", comment: mission.comment });
  }

  return comments;
}

function getMissionGroups(mission) {
  const groups = new Map();

  (mission?.criteria || []).forEach((criterion) => {
    const sectionTitle = criterion.sectionTitle || criterion.section_title || "Section";
    const pageTitle = criterion.pageTitle || criterion.page_title || "Titre";
    const key = `${sectionTitle}::${pageTitle}`;

    if (!groups.has(key)) {
      groups.set(key, {
        key,
        sectionTitle,
        pageTitle,
        criteria: [],
      });
    }

    groups.get(key).criteria.push(criterion);
  });

  return Array.from(groups.values());
}

function buildExportRows(missions = [], managerComments = []) {
  return missions.flatMap((mission) => {
    const { startDate, endDate } = getMissionDates(mission);
    const comments = getMissionComments(mission).map((item) => `${item.title}: ${item.comment}`).join(" | ");
    const managerCommentText = managerComments.map((item) => `${item.authorName || "Manager"}: ${item.comment}`).join(" | ");

    return (mission.criteria || []).map((criterion) => ({
      mission: mission.title,
      department: mission.department || "",
      startDate: startDate ? dayFormatter.format(toDate(startDate)) : "",
      endDate: endDate ? dayFormatter.format(toDate(endDate)) : "",
      status: mission.status || "",
      average: getMissionAverage(mission),
      section: criterion.sectionTitle || criterion.section_title || "",
      title: criterion.pageTitle || criterion.page_title || "",
      criterion: `${criterion.themeCode || criterion.theme_code || ""} ${criterion.label || ""}`.trim(),
      score: typeof criterion.score === "number" ? criterion.score : "",
      assistantComments: comments,
      managerComments: managerCommentText,
    }));
  });
}

function downloadExcelFile(missions = [], managerComments = [], fileName = "resultats-missions.xls") {
  const rows = buildExportRows(missions, managerComments);
  const columns = [
    { header: "Mission", key: "mission" },
    { header: "Département", key: "department" },
    { header: "Date de début", key: "startDate" },
    { header: "Date de fin", key: "endDate" },
    { header: "Statut", key: "status" },
    { header: "Moyenne", key: "average" },
    { header: "Section", key: "section" },
    { header: "Titre", key: "title" },
    { header: "Critère", key: "criterion" },
    { header: "Note", key: "score" },
    { header: "Commentaires assistant", key: "assistantComments" },
    { header: "Commentaires manager", key: "managerComments" },
  ];
  const sourceRows = rows.length ? rows : [{ mission: "Aucune mission évaluée" }];
  const worksheetRows = [
    columns.map((column) => `<Cell ss:StyleID="Header"><Data ss:Type="String">${escapeXml(column.header)}</Data></Cell>`).join(""),
    ...sourceRows.map((row) =>
      columns
        .map((column) => {
          const value = row[column.key] ?? "";
          const type = typeof value === "number" ? "Number" : "String";
          return `<Cell><Data ss:Type="${type}">${escapeXml(value)}</Data></Cell>`;
        })
        .join("")
    ),
  ];

  const workbook = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
  xmlns:o="urn:schemas-microsoft-com:office:office"
  xmlns:x="urn:schemas-microsoft-com:office:excel"
  xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
  <Styles>
    <Style ss:ID="Header">
      <Font ss:Bold="1" ss:Color="#FFFFFF"/>
      <Interior ss:Color="#0F3A63" ss:Pattern="Solid"/>
    </Style>
  </Styles>
  <Worksheet ss:Name="Résultats missions">
    <Table>
      ${columns.map(() => '<Column ss:Width="140"/>').join("")}
      ${worksheetRows.map((row) => `<Row>${row}</Row>`).join("")}
    </Table>
  </Worksheet>
</Workbook>`;

  const blob = new Blob([workbook], { type: "application/vnd.ms-excel;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function isEvaluatedMission(mission) {
  if (mission?.createdByRole === "senior" || mission?.createdByRole === "manager") {
    return true;
  }
  return mission?.status === "Soumise" || getMissionProgress(mission) === 100;
}

function getCalendarDays(monthDate) {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const firstWeekDay = (firstDay.getDay() + 6) % 7;
  const start = new Date(year, month, 1 - firstWeekDay);

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return date;
  });
}

function isMissionOnDate(mission, date) {
  const { startDate, endDate } = getMissionDates(mission);
  const start = toDate(startDate);
  const end = toDate(endDate || startDate);
  if (!start || !end) return false;

  const current = toDate(toIsoDate(date));
  return current >= start && current <= end;
}

function getMissionAssignmentLabel(mission) {
  if (mission?.createdByRole === "senior") {
    return `Assignée par ${mission?.assignedByName || "le Senior"}`;
  }
  if (mission?.createdByRole === "manager") {
    return `Assignée par ${mission?.assignedByName || "le Manager"}`;
  }
  return null;
}

function MissionDetailModal({ mission, managerComments = [], exportFileName = "resultats-missions.xls", onClose }) {
  if (!mission) return null;

  const { startDate, endDate } = getMissionDates(mission);
  const comments = getMissionComments(mission);
  const groups = getMissionGroups(mission);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4 py-6">
      <article className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-lg bg-white shadow-xl">
        <header className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-200 bg-white px-5 py-4">
          <div>
            <p className="text-xs font-bold uppercase text-slate-400">Détail mission</p>
            <h2 className="mt-1 text-2xl font-black text-[#0F3A63]">{mission.title}</h2>
            <p className="mt-1 text-sm font-semibold text-slate-500">{mission.department || "Département non renseigné"}</p>
            {getMissionAssignmentLabel(mission) ? (
              <span className="mt-2 inline-flex rounded-full bg-[#E8F3D6] px-2.5 py-1 text-[11px] font-bold text-[#4E8B1B]">
                {getMissionAssignmentLabel(mission)}
              </span>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => downloadExcelFile([mission], managerComments, exportFileName)}
              className="inline-flex items-center gap-2 rounded-md bg-[#76B82A] px-4 py-2 text-xs font-bold text-white hover:bg-[#6EAD28]"
            >
              <Download size={15} />
              Exporter
            </button>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200"
              aria-label="Fermer"
            >
              <X size={18} />
            </button>
          </div>
        </header>

        <div className="space-y-5 px-5 py-5">
          <section className="grid grid-cols-1 gap-3 md:grid-cols-4">
            <div className="rounded-md bg-[#003B63] p-4 text-white">
              <p className="text-xs font-bold">Date de début</p>
              <p className="mt-2 text-lg font-black text-[#86EFAC]">{startDate ? dayFormatter.format(toDate(startDate)) : "--"}</p>
            </div>
            <div className="rounded-md bg-[#003B63] p-4 text-white">
              <p className="text-xs font-bold">Date de fin</p>
              <p className="mt-2 text-lg font-black text-[#86EFAC]">{endDate ? dayFormatter.format(toDate(endDate)) : "--"}</p>
            </div>
            <div className="rounded-md bg-[#003B63] p-4 text-white">
              <p className="text-xs font-bold">Moyenne</p>
              <p className="mt-2 text-lg font-black text-[#86EFAC]">{getMissionAverage(mission)} / 5</p>
            </div>
            <div className="rounded-md bg-[#003B63] p-4 text-white">
              <p className="text-xs font-bold">Statut</p>
              <p className="mt-2 text-lg font-black text-[#86EFAC]">{mission.status || "Evaluée"}</p>
            </div>
          </section>

          <section className="rounded-md border border-slate-200 bg-[#F8FAFC] p-4">
            <h3 className="text-sm font-black text-[#0F3A63]">Notes par titre</h3>
            <div className="mt-3 space-y-3">
              {groups.map((group) => (
                <div key={group.key} className="rounded-md bg-white p-3">
                  <p className="text-xs font-bold uppercase text-slate-400">{group.sectionTitle}</p>
                  <p className="mt-1 text-sm font-bold text-[#0F3A63]">{group.pageTitle}</p>
                  <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
                    {group.criteria.map((criterion) => (
                      <div key={criterion.id || criterion.criterion_id} className="rounded-md border border-slate-100 bg-slate-50 px-3 py-2">
                        <div className="flex items-start justify-between gap-3">
                          <p className="text-xs font-semibold text-slate-600">
                            {criterion.themeCode || criterion.theme_code ? `${criterion.themeCode || criterion.theme_code}. ` : ""}
                            {criterion.label}
                          </p>
                          <span className="rounded bg-[#DCECCB] px-2 py-0.5 text-xs font-black text-[#4E8B1B]">
                            {typeof criterion.score === "number" ? criterion.score : "--"}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <article className="rounded-md border border-slate-200 bg-white p-4">
              <h3 className="text-sm font-black text-[#0F3A63]">Commentaires de l'assistant</h3>
              <div className="mt-3 space-y-3">
                {comments.length ? (
                  comments.map((item) => (
                    <div key={`${item.title}-${item.comment}`} className="rounded-md bg-slate-100 p-3">
                      <p className="text-xs font-bold text-[#0F3A63]">{item.title}</p>
                      <p className="mt-1 text-xs leading-5 text-slate-600">{item.comment}</p>
                    </div>
                  ))
                ) : (
                  <p className="rounded-md bg-slate-100 p-3 text-xs font-semibold text-slate-500">Aucun commentaire renseigné.</p>
                )}
              </div>
            </article>

            <article className="rounded-md border border-slate-200 bg-white p-4">
              <h3 className="text-sm font-black text-[#0F3A63]">Commentaires manager</h3>
              <div className="mt-3 space-y-3">
                {managerComments.length ? (
                  managerComments.map((item, index) => (
                    <div key={`${item.managerId || index}-${item.submittedAt || index}`} className="rounded-md bg-slate-100 p-3">
                      <p className="text-xs leading-5 text-slate-600">{item.comment}</p>
                      <p className="mt-2 text-xs font-bold text-[#0F3A63]">{item.authorName || "Manager"}</p>
                    </div>
                  ))
                ) : (
                  <p className="rounded-md bg-slate-100 p-3 text-xs font-semibold text-slate-500">Aucun commentaire manager disponible.</p>
                )}
              </div>
            </article>
          </section>
        </div>
      </article>
    </div>
  );
}

function Calendrier({
  missionEvaluations = [],
  resultsData,
  title = "Calendrier",
  eyebrow = "Missions évaluées",
  emptyMessage = "Aucune mission évaluée pour le moment.",
  exportFileName = "resultats-missions.xls",
}) {
  const evaluatedMissions = useMemo(
    () =>
      missionEvaluations.filter(isEvaluatedMission).map((mission) => ({
        ...mission,
        calendarColor: getMissionColor(mission),
      })),
    [missionEvaluations]
  );
  const firstMissionDate = evaluatedMissions.map((mission) => toDate(getMissionDates(mission).startDate)).find(Boolean);
  const [monthDate, setMonthDate] = useState(() => firstMissionDate || new Date());
  const [selectedMission, setSelectedMission] = useState(null);
  const calendarDays = useMemo(() => getCalendarDays(monthDate), [monthDate]);
  const managerComments = resultsData?.managerComments || [];

  function goToMonth(offset) {
    setMonthDate((current) => new Date(current.getFullYear(), current.getMonth() + offset, 1));
  }

  return (
    <section className="space-y-5">
      <article className="rounded-md bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase text-slate-400">{eyebrow}</p>
            <h2 className="mt-1 text-2xl font-black text-[#0F3A63]">{title}</h2>
            <div className="mt-2 flex flex-wrap gap-3">
              {calendarLegend.map((item) => (
                <span key={item.label} className="inline-flex items-center gap-1.5">
                  <span className="inline-block h-3 w-3 rounded-full" style={{ backgroundColor: item.color.accent }} />
                  <span className="text-[11px] font-semibold text-slate-500">{item.label}</span>
                </span>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => goToMonth(-1)} className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-slate-100 text-[#0F3A63]">
                <ChevronLeft size={16} />
              </button>
              <p className="min-w-44 text-center text-sm font-black capitalize text-[#0F3A63]">{monthFormatter.format(monthDate)}</p>
              <button type="button" onClick={() => goToMonth(1)} className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-slate-100 text-[#0F3A63]">
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </div>
      </article>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-[1.5fr_0.8fr]">
        <article className="rounded-md bg-white p-4 shadow-sm">
          <div className="grid grid-cols-7 gap-2 text-center text-xs font-black uppercase text-slate-400">
            {weekDays.map((day) => (
              <span key={day}>{day}</span>
            ))}
          </div>

          <div className="mt-2 grid grid-cols-7 gap-2">
            {calendarDays.map((date) => {
              const isoDate = toIsoDate(date);
              const isCurrentMonth = date.getMonth() === monthDate.getMonth();
              const missionsForDay = evaluatedMissions.filter((mission) => isMissionOnDate(mission, date));

              return (
                <div
                  key={isoDate}
                  className={`min-h-28 rounded-md border p-2 ${
                    isCurrentMonth ? "border-slate-200 bg-[#F8FAFC]" : "border-slate-100 bg-slate-50 text-slate-300"
                  }`}
                >
                  <p className={`text-xs font-black ${isCurrentMonth ? "text-[#0F3A63]" : "text-slate-300"}`}>{date.getDate()}</p>
                  <div className="mt-2 space-y-1">
                    {missionsForDay.slice(0, 3).map((mission) => (
                      <button
                        key={`${mission.id}-${isoDate}`}
                        type="button"
                        onClick={() => setSelectedMission(mission)}
                        className="block w-full rounded-full px-2 py-1 text-left text-[10px] font-bold shadow-sm transition"
                        style={{
                          backgroundColor: mission.calendarColor?.bg,
                          color: mission.calendarColor?.text,
                        }}
                        onMouseEnter={(event) => {
                          event.currentTarget.style.backgroundColor = mission.calendarColor?.hover;
                        }}
                        onMouseLeave={(event) => {
                          event.currentTarget.style.backgroundColor = mission.calendarColor?.bg;
                        }}
                      >
                        <span className="line-clamp-1">{mission.title}</span>
                      </button>
                    ))}
                    {missionsForDay.length > 3 ? <p className="text-[10px] font-bold text-slate-400">+{missionsForDay.length - 3}</p> : null}
                  </div>
                </div>
              );
            })}
          </div>
        </article>

        <aside className="rounded-md bg-white p-4 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <CalendarDays size={18} className="text-[#76B82A]" />
            <h3 className="text-lg font-black text-[#0F3A63]">Liste des missions</h3>
          </div>

          <div className="space-y-3">
            {evaluatedMissions.length ? (
              evaluatedMissions.map((mission) => {
                const { startDate, endDate } = getMissionDates(mission);
                return (
                  <button
                    key={mission.id}
                    type="button"
                    onClick={() => setSelectedMission(mission)}
                    className="w-full rounded-md border border-slate-100 bg-[#F8FAFC] p-3 text-left hover:bg-slate-100"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm font-black text-[#0F3A63]">{mission.title}</p>
                      <span
                        className="rounded px-2 py-0.5 text-xs font-black"
                        style={{
                          backgroundColor: mission.calendarColor?.bg,
                          color: mission.calendarColor?.text,
                        }}
                      >
                        {getMissionAverage(mission)}
                      </span>
                    </div>
                    <p className="mt-1 text-xs font-semibold text-slate-500">
                      {startDate ? dayFormatter.format(toDate(startDate)) : "--"} - {endDate ? dayFormatter.format(toDate(endDate)) : "--"}
                    </p>
                    <p className="mt-1 text-xs font-bold text-[#0F4A72]">{mission.department || "Département non renseigné"}</p>
                    {getMissionAssignmentLabel(mission) ? (
                      <span className="mt-1.5 inline-flex rounded-full bg-[#E8F3D6] px-2 py-0.5 text-[10px] font-bold text-[#4E8B1B]">
                        {getMissionAssignmentLabel(mission)}
                      </span>
                    ) : null}
                  </button>
                );
              })
            ) : (
              <p className="rounded-md bg-slate-100 p-3 text-sm font-semibold text-slate-500">{emptyMessage}</p>
            )}
          </div>
        </aside>
      </section>

      <MissionDetailModal
        mission={selectedMission}
        managerComments={managerComments}
        exportFileName={exportFileName}
        onClose={() => setSelectedMission(null)}
      />
    </section>
  );
}

export default Calendrier;
