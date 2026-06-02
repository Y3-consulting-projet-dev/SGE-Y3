import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  getAssociateManagerEvaluation,
  getAssociateManagerEvaluations,
  saveAssociateManagerEvaluation,
} from "@/lib/associateOverview";
import { clampProgress, getProgressBarClass, getProgressToneClass } from "@/lib/progressPresentation";

function formatScore(score) {
  return typeof score === "number" ? `${score.toFixed(1)}/5` : "--";
}

function scoreTone(score) {
  if (typeof score !== "number") return "text-[#0F3A63]";
  if (score >= 4) return "text-[#78B843]";
  if (score < 3) return "text-[#C53B3B]";
  return "text-[#0F3A63]";
}

function buildMissionsPayload(missions = []) {
  return missions.map((mission) => ({
    id: mission.id,
    title: mission.title,
    period: mission.period,
    department: mission.department,
    average: mission.average,
    comment: mission.comment || "",
    criteria: (mission.criteria || []).map((criterion) => ({
      id: criterion.id,
      sectionTitle: criterion.sectionTitle,
      pageTitle: criterion.pageTitle,
      sourceSheet: criterion.sourceSheet,
      sourceLabel: criterion.sourceLabel,
      themeCode: criterion.themeCode,
      label: criterion.label,
      statement: criterion.statement,
      score: criterion.score,
    })),
  }));
}

function getAverage(scores = []) {
  const numericScores = scores.filter((score) => typeof score === "number");
  if (!numericScores.length) return null;
  return numericScores.reduce((total, score) => total + score, 0) / numericScores.length;
}

function getMissionAverage(mission) {
  return getAverage((mission?.criteria || []).map((criterion) => criterion.score));
}

function getMissionProgress(mission) {
  const criteria = mission?.criteria || [];
  if (!criteria.length) return 0;
  const completed = criteria.filter((criterion) => typeof criterion.score === "number").length;
  return Math.round((completed / criteria.length) * 100);
}

function getMissionsAverage(missions = []) {
  return getAverage(missions.map((mission) => getMissionAverage(mission)));
}

function Autoevamanager() {
  const [listData, setListData] = useState(null);
  const [detailData, setDetailData] = useState(null);
  const [selectedManagerId, setSelectedManagerId] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [status, setStatus] = useState("");
  const [associateMissions, setAssociateMissions] = useState([]);
  const [selectedMissionId, setSelectedMissionId] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadManagers() {
      try {
        setIsLoading(true);
        setErrorMessage("");
        const response = await getAssociateManagerEvaluations();

        if (cancelled) return;
        setListData(response);
        setSelectedManagerId(response?.items?.[0]?.id || "");
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(error.message || "Chargement des managers impossible.");
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    loadManagers();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!selectedManagerId) {
      return;
    }

    let cancelled = false;

    async function loadDetail() {
      try {
        setIsDetailLoading(true);
        setErrorMessage("");
        setStatus("");
        const response = await getAssociateManagerEvaluation(selectedManagerId);

        if (cancelled) return;
        const nextMissions = buildMissionsPayload(response?.associate_review?.missions || []);
        setDetailData(response);
        setAssociateMissions(nextMissions);
        setSelectedMissionId(nextMissions[0]?.id || "");
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(error.message || "Chargement du détail impossible.");
        }
      } finally {
        if (!cancelled) {
          setIsDetailLoading(false);
        }
      }
    }

    loadDetail();
    return () => {
      cancelled = true;
    };
  }, [selectedManagerId]);

  const items = useMemo(() => listData?.items || [], [listData?.items]);
  const selectedManager = items.find((item) => item.id === selectedManagerId) || null;
  const selfMissions = detailData?.self_evaluation?.missions || [];

  const currentMissionIndex = Math.max(0, associateMissions.findIndex((mission) => mission.id === selectedMissionId));
  const currentMission = associateMissions[currentMissionIndex] || null;
  const currentSelfMission = selfMissions[currentMissionIndex] || null;
  const currentMissionProgress = getMissionProgress(currentMission);

  const kpis = useMemo(() => {
    const total = items.length;
    const withMissions = items.filter((item) => item.missionsCount > 0).length;

    return [
      { title: "Managers / senior managers", value: `${total}`, subtitle: "Tous les profils actifs de la base" },
      { title: "Missions à évaluer", value: `${withMissions}/${total || 0}`, subtitle: "Managers avec missions transmises" },
    ];
  }, [items]);

  const setMissionCriterionScore = (criterionId, score) => {
    setAssociateMissions((currentMissions) =>
      currentMissions.map((mission) =>
        mission.id !== selectedMissionId
          ? mission
          : {
              ...mission,
              criteria: (mission.criteria || []).map((criterion) =>
                criterion.id === criterionId ? { ...criterion, score } : criterion
              ),
            }
      )
    );
    setStatus("");
  };

  const saveEvaluation = async () => {
    if (!selectedManagerId) return;

    try {
      const response = await saveAssociateManagerEvaluation(selectedManagerId, {
        missions: associateMissions,
      });

      const nextMissions = buildMissionsPayload(response?.associate_review?.missions || []);

      setDetailData(response);
      setAssociateMissions(nextMissions);
      setStatus("Évaluation associé enregistrée.");
      setListData((current) => ({
        ...current,
        items: (current?.items || []).map((item) =>
          item.id === selectedManagerId
            ? {
                ...item,
                associateMissionScore: getMissionsAverage(nextMissions),
              }
            : item
        ),
      }));
    } catch (error) {
      setStatus(error.message || "Enregistrement impossible.");
    }
  };

  if (isLoading) {
    return (
      <section className="rounded-md bg-white p-5 text-sm font-semibold text-slate-500 shadow-sm">
        Chargement des managers...
      </section>
    );
  }

  if (errorMessage && !items.length && !detailData) {
    return (
      <section className="rounded-md bg-white p-5 text-sm font-semibold text-red-600 shadow-sm">
        {errorMessage}
      </section>
    );
  }

  return (
    <div className="space-y-4">
      <header className="space-y-2">
        <h1 className="text-xl font-black tracking-tight text-[#0F3A63]">Évaluations par mission des managers</h1>
        <p className="text-xs font-semibold text-slate-500">
          L'associé évalue ici les managers et senior managers uniquement sur les missions transmises.
        </p>
      </header>

      <section className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {kpis.map((item) => (
          <article key={item.title} className="rounded-lg bg-[#0D496A] p-4 text-white">
            <p className="text-xs font-semibold">{item.title}</p>
            <p className="mt-3 text-xl font-extrabold leading-none">{item.value}</p>
            <p className="mt-3 text-xs font-semibold text-slate-100">{item.subtitle}</p>
          </article>
        ))}
      </section>

      <section className="rounded-lg bg-white p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[380px_1fr]">
          <aside className="rounded-xl bg-[#F4F7FB] p-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-base font-extrabold text-[#0F3A63]">Sélection du manager</h2>
              <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-[#0F4A72]">
                {items.length} profil(s)
              </span>
            </div>

            <label className="mt-4 block text-sm font-bold text-[#0F3A63]">
              Filtrer / sélectionner
              <select
                value={selectedManagerId}
                onChange={(event) => setSelectedManagerId(event.target.value)}
                className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-3 text-sm font-semibold text-[#0F3A63] outline-none"
              >
                {items.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} - {item.department}
                  </option>
                ))}
              </select>
            </label>

            {selectedManager ? (
              <div className="mt-4 rounded-xl border border-[#8BC43F] bg-[#F1F8E8] p-4">
                <p className="text-base font-extrabold text-[#0F3A63]">{selectedManager.name}</p>
                <p className="mt-1 text-xs font-semibold text-slate-500">
                  {selectedManager.grade} - {selectedManager.department}
                </p>

                <div className="mt-4 grid grid-cols-1 gap-3">
                  <div className="rounded-lg bg-white p-3">
                    <p className="text-xs font-bold text-[#0F4A72]">Missions</p>
                    <p className={`mt-2 text-lg font-black ${scoreTone(selectedManager.associateMissionScore)}`}>
                      {formatScore(selectedManager.associateMissionScore)}
                    </p>
                  </div>
                </div>

                <div className="mt-4 space-y-2 text-xs font-semibold">
                  <p className={selectedManager.missionsCount ? "text-[#78B843]" : "text-slate-500"}>
                    {selectedManager.missionsCount ? `${selectedManager.missionsCount} mission(s) à évaluer` : "Aucune mission transmise à l'associé pour l'instant"}
                  </p>
                </div>
              </div>
            ) : null}
          </aside>

          <div className="rounded-xl bg-[#D4DADF] p-3">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-sm font-extrabold text-[#0F3A63]">Évaluation par mission</h2>

              {selectedManager ? (
                <span className="rounded-full bg-[#E5EFE1] px-4 py-1 text-xs font-semibold text-[#0F4A72]">
                  {selectedManager.name}
                </span>
              ) : null}
            </div>

            {errorMessage && items.length ? (
              <div className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-600">{errorMessage}</div>
            ) : null}

            {isDetailLoading ? (
              <section className="rounded-lg bg-white p-5 text-sm font-semibold text-slate-500">
                Chargement du détail manager...
              </section>
            ) : (
              <section className="grid grid-cols-1 gap-4 xl:grid-cols-[320px_1fr]">
                <aside className="rounded-lg bg-white p-3 shadow-sm">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-extrabold text-[#0F4A72]">Missions à évaluer</p>
                    <span className="rounded-full bg-[#F4F7FB] px-3 py-1 text-xs font-bold text-[#0F4A72]">
                      {associateMissions.length} mission(s)
                    </span>
                  </div>

                  <div className="mt-3 space-y-2">
                    {associateMissions.length ? (
                      associateMissions.map((mission, index) => {
                        const missionProgress = getMissionProgress(mission);

                        return (
                          <button
                            key={mission.id}
                            onClick={() => setSelectedMissionId(mission.id)}
                            className={`w-full rounded-lg border p-3 text-left ${
                              selectedMissionId === mission.id ? "border-[#76B82A] bg-[#EEF6E8]" : "border-slate-200 bg-white"
                            }`}
                          >
                            <div className="flex items-center justify-between gap-3">
                              <p className="text-sm font-extrabold text-[#0F3A63]">{mission.title}</p>
                              <span className="text-xs font-bold text-slate-500">{index + 1}</span>
                            </div>
                            <p className="mt-1 text-xs font-semibold text-slate-500">
                              {mission.period} - {mission.department}
                            </p>
                            <p className={`mt-2 text-xs font-bold ${scoreTone(getMissionAverage(mission))}`}>
                              Associé : {formatScore(getMissionAverage(mission))}
                            </p>
                            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-200">
                              <div
                                className={`h-full rounded-full ${getProgressBarClass(missionProgress)}`}
                                style={{ width: `${clampProgress(missionProgress)}%` }}
                              />
                            </div>
                            <p className={`mt-1 text-xs font-bold ${getProgressToneClass(missionProgress)}`}>
                              {missionProgress}% complétée
                            </p>
                          </button>
                        );
                      })
                    ) : (
                      <p className="text-sm font-semibold text-slate-500">
                        Aucune mission transmise à l'associé pour ce manager.
                      </p>
                    )}
                  </div>
                </aside>

                <article className="rounded-lg bg-white p-4 shadow-sm">
                  {currentMission ? (
                    <>
                      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="text-xs font-bold uppercase text-slate-400">Mission sélectionnée</p>
                          <h3 className="text-lg font-black text-[#0F3A63]">{currentMission.title}</h3>
                          <p className="mt-1 text-xs font-semibold text-slate-500">
                            {currentMission.period} - {currentMission.department}
                          </p>
                        </div>

                        <div className="flex items-center gap-2 rounded-full bg-[#F4F7FB] px-3 py-2 text-sm font-bold text-[#0F4A72]">
                          <button
                            onClick={() => setSelectedMissionId(associateMissions[Math.max(currentMissionIndex - 1, 0)]?.id || selectedMissionId)}
                            disabled={currentMissionIndex === 0}
                            className="rounded-full p-1 disabled:opacity-30"
                          >
                            <ChevronLeft size={16} />
                          </button>
                          <span>
                            Mission {currentMissionIndex + 1} / {associateMissions.length}
                          </span>
                          <button
                            onClick={() =>
                              setSelectedMissionId(
                                associateMissions[Math.min(currentMissionIndex + 1, associateMissions.length - 1)]?.id || selectedMissionId
                              )
                            }
                            disabled={currentMissionIndex >= associateMissions.length - 1}
                            className="rounded-full p-1 disabled:opacity-30"
                          >
                            <ChevronRight size={16} />
                          </button>
                        </div>
                      </div>

                      <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-3">
                        <div className="rounded-xl bg-[#F7FAFC] p-3">
                          <p className="text-xs font-bold uppercase text-slate-400">Auto-évaluation manager</p>
                          <p className={`mt-2 text-xl font-black ${scoreTone(currentSelfMission?.average)}`}>
                            {formatScore(currentSelfMission?.average)}
                          </p>
                        </div>
                        <div className="rounded-xl bg-[#F7FAFC] p-3">
                          <p className="text-xs font-bold uppercase text-slate-400">Score associé</p>
                          <p className={`mt-2 text-xl font-black ${scoreTone(getMissionAverage(currentMission))}`}>
                            {formatScore(getMissionAverage(currentMission))}
                          </p>
                        </div>
                        <div className="rounded-xl bg-[#F7FAFC] p-3">
                          <p className="text-xs font-bold uppercase text-slate-400">Progression</p>
                          <p className={`mt-2 text-xl font-black ${getProgressToneClass(currentMissionProgress)}`}>
                            {currentMissionProgress}%
                          </p>
                          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200">
                            <div
                              className={`h-full rounded-full ${getProgressBarClass(currentMissionProgress)}`}
                              style={{ width: `${clampProgress(currentMissionProgress)}%` }}
                            />
                          </div>
                        </div>
                      </div>

                      <div className="space-y-3">
                        {(currentMission.criteria || []).map((criterion, index) => {
                          const managerCriterion = (currentSelfMission?.criteria || [])[index];

                          return (
                            <div key={criterion.id || index} className="rounded-lg bg-[#F8FAFC] p-3">
                              <div className="mb-2">
                                <p className="text-sm font-bold leading-snug text-[#0F3A63]">{criterion.label}</p>
                                {criterion.pageTitle ? <p className="mt-1 text-xs font-semibold text-slate-500">{criterion.pageTitle}</p> : null}
                              </div>

                              <p className="text-xs leading-6 text-slate-500">{criterion.statement}</p>

                              <p className="mt-3 text-xs font-bold text-[#78B843]">
                                Manager : {managerCriterion?.score ?? "--"}/5
                              </p>

                              <div className="mt-3 flex overflow-hidden rounded-md border border-slate-200">
                                {[1, 2, 3, 4, 5].map((value) => (
                                  <button
                                    key={`${criterion.id}-${value}`}
                                    onClick={() => setMissionCriterionScore(criterion.id, value)}
                                    className={`h-9 w-10 border-r border-slate-200 text-sm font-bold last:border-r-0 ${
                                      value === criterion.score ? "bg-[#0C4B6C] text-white" : "bg-white text-[#0F3A63]"
                                    }`}
                                  >
                                    {value}
                                  </button>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      <div className="mt-4 rounded-xl bg-[#F7FAFC] p-4">
                        <p className="mb-2 text-sm font-bold text-[#0F4A72]">Commentaire mission associé</p>
                        <textarea
                          value={currentMission.comment || ""}
                          onChange={(event) => {
                            const nextComment = event.target.value;
                            setAssociateMissions((currentMissions) =>
                              currentMissions.map((mission) =>
                                mission.id === currentMission.id ? { ...mission, comment: nextComment } : mission
                              )
                            );
                            setStatus("");
                          }}
                          className="min-h-[120px] w-full resize-none rounded-lg bg-[#ECEFF3] px-3 py-3 text-sm text-slate-700 outline-none"
                        />
                        <button onClick={saveEvaluation} className="mt-4 rounded-md bg-[#0C4B6C] px-5 py-2 text-sm font-bold text-white">
                          Enregistrer
                        </button>
                        {status ? <p className="mt-2 text-xs font-semibold text-[#0F4A72]">{status}</p> : null}
                      </div>
                    </>
                  ) : (
                    <p className="rounded-lg bg-white p-4 text-sm font-semibold text-slate-500">
                      Aucune mission disponible pour cette évaluation.
                    </p>
                  )}
                </article>
              </section>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

export default Autoevamanager;
