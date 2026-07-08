import { useEffect, useMemo, useState } from "react";
import { ClipboardList, History, LayoutDashboard, LogOut, MessageSquare, Settings2 } from "lucide-react";
import logoY3 from "@/assets/logo-y3.png";
import ProfilePanel from "@/components/profile/ProfilePanel";
import MonautoevaluationSupport from "@/components/pages/support/MonautoevaluationSupport";
import Monhistorique from "@/components/pages/support/Monhistorique";
import { getDisplayName } from "@/utils/userPresentation";
import { getSupportSelfEvaluation, saveSupportChiefComments, getReceivedSupportChiefComments } from "@/api/supportEvaluation";

const supportMenu = [
  { key: "overview", label: "Vue support", icon: LayoutDashboard },
  { key: "self-evaluation", label: "Mon auto-évaluation", icon: ClipboardList },
  { key: "history", label: "Historique", icon: History },
  { key: "comments", label: "Commentaires anonymes", icon: MessageSquare },
  { key: "profile", label: "Profil", icon: Settings2 },
];

function VueSupport({ onLogout, onUserUpdate, user }) {
  const [activeSection, setActiveSection] = useState("overview");
  const [commentsTab, setCommentsTab] = useState("sent");

  const [chiefComments, setChiefComments] = useState([]);
  const [commentTargets, setCommentTargets] = useState([]);
  const [chiefTargetValue, setChiefTargetValue] = useState("");
  const [chiefFeedback, setChiefFeedback] = useState(null);
  const [isSavingChief, setIsSavingChief] = useState(false);

  const [receivedComments, setReceivedComments] = useState([]);
  const [isLoadingReceived, setIsLoadingReceived] = useState(false);

  const displayName = getDisplayName(user);
  const profileKey = [user?.id, user?.email, user?.first_name, user?.last_name, user?.grade, user?.department].join("|");

  useEffect(() => {
    getSupportSelfEvaluation()
      .then((data) => {
        setChiefComments(data?.chief_comments || []);
        setCommentTargets(data?.support?.comment_targets || []);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (activeSection !== "comments" || commentsTab !== "received") return;
    setIsLoadingReceived(true);
    getReceivedSupportChiefComments()
      .then((data) => setReceivedComments(data?.received || []))
      .catch(() => {})
      .finally(() => setIsLoadingReceived(false));
  }, [activeSection, commentsTab]);

  function addChiefComment() {
    const recipient = commentTargets.find((t) => t.id === chiefTargetValue);
    if (!recipient) return;
    setChiefComments((prev) =>
      prev.some((item) => item.targetUserId === recipient.id)
        ? prev
        : [...prev, { targetUserId: recipient.id, targetName: recipient.name, targetGrade: recipient.grade, targetDepartment: recipient.department, comment: "" }]
    );
    setChiefTargetValue("");
    setChiefFeedback(null);
  }

  function updateChiefComment(targetUserId, comment) {
    setChiefComments((prev) => prev.map((item) => item.targetUserId === targetUserId ? { ...item, comment } : item));
    setChiefFeedback(null);
  }

  function removeChiefComment(targetUserId) {
    setChiefComments((prev) => prev.filter((item) => item.targetUserId !== targetUserId));
    setChiefFeedback(null);
  }

  async function handleSendChiefComments() {
    const hasUnsent = chiefComments.some((item) => String(item.comment || "").trim() && !item.submittedAt);
    if (!hasUnsent) {
      setChiefFeedback({ tone: "error", message: "Rédigez au moins un commentaire avant d'envoyer." });
      return;
    }
    setIsSavingChief(true);
    setChiefFeedback(null);
    const now = new Date().toISOString();
    const toSend = chiefComments.map((item) =>
      String(item.comment || "").trim() && !item.submittedAt ? { ...item, submittedAt: now } : item
    );
    try {
      const result = await saveSupportChiefComments(toSend);
      setChiefComments(result.chief_comments || toSend);
      setChiefFeedback({ tone: "success", message: "Commentaire(s) envoyé(s) avec succès." });
    } catch (error) {
      setChiefFeedback({ tone: "error", message: error.message || "Envoi impossible." });
    } finally {
      setIsSavingChief(false);
    }
  }

  const pageTitle = useMemo(() => {
    if (activeSection === "self-evaluation") return "MON AUTO-ÉVALUATION SUPPORT";
    if (activeSection === "history") return "HISTORIQUE";
    if (activeSection === "comments") return "COMMENTAIRES ANONYMES";
    if (activeSection === "profile") return "MON PROFIL";
    return "DEPARTEMENT SUPPORT";
  }, [activeSection]);

  const renderContent = () => {
    if (activeSection === "self-evaluation") {
      return <MonautoevaluationSupport user={user} />;
    }

    if (activeSection === "history") {
      return <Monhistorique />;
    }

    if (activeSection === "profile") {
      return <ProfilePanel key={profileKey} user={user} onLogout={onLogout} onUserUpdate={onUserUpdate} />;
    }

    if (activeSection === "comments") {
      const chiefCommentTargetOptions = commentTargets.filter(
        (t, index, list) => t.name && list.findIndex((item) => item.id === t.id) === index
      );

      return (
        <section className="space-y-4">
          <article className="rounded-md bg-white p-5 shadow-sm">
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-[22px] font-bold text-[#0F3A63]">Commentaire anonyme</h3>
                <p className="mt-1 text-[12px] font-semibold text-slate-500">
                  Choisissez une personne et rédigez un commentaire. Cliquez sur{" "}
                  <span className="font-bold text-[#0F3A63]">Envoyer</span> pour le transmettre — il apparaîtra
                  directement chez le destinataire. Un commentaire envoyé ne peut plus être modifié.
                </p>
              </div>
              <span className="rounded-full border border-[#D9E3EE] bg-white px-3 py-1 text-[11px] font-bold text-[#0F4A72]">
                Anonyme · Visible par le destinataire
              </span>
            </div>

            <div className="mb-5 flex gap-2">
              <button
                type="button"
                onClick={() => setCommentsTab("sent")}
                className={`rounded-md px-4 py-1.5 text-[12px] font-bold transition ${
                  commentsTab === "sent"
                    ? "bg-[#0B4C7A] text-white"
                    : "bg-[#EEF2F6] text-[#0F3A63] hover:bg-[#DDE6EE]"
                }`}
              >
                Mes commentaires
              </button>
              <button
                type="button"
                onClick={() => setCommentsTab("received")}
                className={`rounded-md px-4 py-1.5 text-[12px] font-bold transition ${
                  commentsTab === "received"
                    ? "bg-[#0B4C7A] text-white"
                    : "bg-[#EEF2F6] text-[#0F3A63] hover:bg-[#DDE6EE]"
                }`}
              >
                Reçus
                {receivedComments.length > 0 && (
                  <span className="ml-1.5 rounded-full bg-[#76B82A] px-1.5 py-0.5 text-[10px] text-white">
                    {receivedComments.length}
                  </span>
                )}
              </button>
            </div>

            {commentsTab === "sent" && (
              <>
                {chiefCommentTargetOptions.some(
                  (recipient) => !chiefComments.some((item) => String(item.targetUserId || "") === String(recipient.id))
                ) && (
                  <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                    <select
                      value={chiefTargetValue}
                      onChange={(e) => setChiefTargetValue(e.target.value)}
                      className="h-10 w-full rounded-md border border-[#D9E3EE] bg-white px-3 text-sm font-semibold text-[#0F3A63] outline-none"
                    >
                      <option value="">Sélectionner une personne</option>
                      {chiefCommentTargetOptions.map((recipient) => {
                        const alreadyAdded = chiefComments.some((item) => String(item.targetUserId || "") === String(recipient.id));
                        return (
                          <option key={recipient.id} value={recipient.id} disabled={alreadyAdded}>
                            {recipient.department} — {recipient.name} ({recipient.grade})
                            {alreadyAdded ? " · déjà ajouté" : ""}
                          </option>
                        );
                      })}
                    </select>
                    <button
                      type="button"
                      onClick={addChiefComment}
                      disabled={!chiefTargetValue}
                      className="h-10 rounded-md bg-[#0B4C7A] px-5 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Ajouter
                    </button>
                  </div>
                )}

                <div className="mt-5 space-y-4">
                  {chiefComments.length ? (
                    chiefComments.map((item) => {
                      const isSent = Boolean(item.submittedAt);
                      return (
                        <div
                          key={item.targetUserId || item.targetName}
                          className={`rounded-md border p-4 ${isSent ? "border-[#C3DFAA] bg-[#F4FAED]" : "border-[#E3EAF3] bg-[#F8FBFF]"}`}
                        >
                          <div className="mb-3 flex items-start justify-between gap-3">
                            <div>
                              <p className="text-[13px] font-bold text-[#0F3A63]">{item.targetName}</p>
                              <p className="mt-0.5 text-[11px] font-semibold text-slate-500">
                                {item.targetDepartment} — {item.targetGrade}
                              </p>
                            </div>
                            {isSent ? (
                              <span className="rounded-full bg-[#DCECCB] px-3 py-1 text-[10px] font-bold text-[#4E8B1B]">
                                Envoyé
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => removeChiefComment(item.targetUserId)}
                                className="rounded-md bg-slate-100 px-3 py-1 text-[11px] font-bold text-slate-500 hover:bg-slate-200"
                              >
                                Retirer
                              </button>
                            )}
                          </div>
                          {isSent ? (
                            <p className="rounded-md bg-white px-3 py-2 text-[12px] text-slate-700 ring-1 ring-[#C3DFAA]">
                              {item.comment || "—"}
                            </p>
                          ) : (
                            <textarea
                              rows={4}
                              value={item.comment || ""}
                              onChange={(e) => updateChiefComment(item.targetUserId, e.target.value)}
                              placeholder={`Votre commentaire pour ${item.targetName}…`}
                              className="w-full resize-none rounded-md bg-white px-3 py-2 text-[12px] text-slate-700 outline-none ring-1 ring-[#D9E3EE] focus:ring-[#0B4C7A]"
                            />
                          )}
                        </div>
                      );
                    })
                  ) : (
                    <p className="rounded-md bg-[#EEF2F6] px-4 py-4 text-sm font-semibold text-slate-500">
                      Aucune personne sélectionnée pour le moment.
                    </p>
                  )}
                </div>

                {chiefComments.some((item) => !item.submittedAt && String(item.comment || "").trim()) && (
                  <div className="mt-5 flex items-center gap-3">
                    <button
                      type="button"
                      onClick={handleSendChiefComments}
                      disabled={isSavingChief}
                      className="inline-flex items-center gap-2 rounded-md bg-[#76B82A] px-5 py-2 text-[12px] font-bold text-white disabled:opacity-70"
                    >
                      {isSavingChief ? "Envoi…" : "Envoyer"}
                    </button>
                    {chiefFeedback && (
                      <span className={`text-[12px] font-semibold ${chiefFeedback.tone === "error" ? "text-[#B93840]" : "text-[#184D2E]"}`}>
                        {chiefFeedback.message}
                      </span>
                    )}
                  </div>
                )}

                {chiefFeedback && !chiefComments.some((item) => !item.submittedAt && String(item.comment || "").trim()) && (
                  <div className="mt-4">
                    <span className={`text-[12px] font-semibold ${chiefFeedback.tone === "error" ? "text-[#B93840]" : "text-[#184D2E]"}`}>
                      {chiefFeedback.message}
                    </span>
                  </div>
                )}
              </>
            )}

            {commentsTab === "received" && (
              <div className="space-y-3">
                {isLoadingReceived ? (
                  <p className="rounded-md bg-[#EEF2F6] px-4 py-4 text-sm font-semibold text-slate-500">Chargement…</p>
                ) : receivedComments.length > 0 ? (
                  receivedComments.map((item, index) => (
                    <div key={index} className="rounded-md border border-[#C3DFAA] bg-[#F4FAED] p-4">
                      <p className="rounded-md bg-white px-3 py-2 text-[12px] text-slate-700 ring-1 ring-[#C3DFAA]">
                        {item.comment}
                      </p>
                      <p className="mt-2 text-[11px] text-slate-400">
                        Reçu le {new Date(item.submittedAt).toLocaleDateString("fr-FR")}
                      </p>
                    </div>
                  ))
                ) : (
                  <p className="rounded-md bg-[#EEF2F6] px-4 py-4 text-sm font-semibold text-slate-500">
                    Aucun commentaire reçu pour le moment.
                  </p>
                )}
              </div>
            )}
          </article>
        </section>
      );
    }

    return (
      <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {[
          ["Auto-évaluation", "À soumettre directement aux associés"],
          ["Décision", "Évaluation et classement réalisés par les associés"],
          ["Retour RH", "Les taux d'augmentation sont transmis a la RH"],
        ].map(([title, subtitle]) => (
          <article key={title} className="rounded-xl bg-white p-5 shadow-sm">
            <p className="text-lg font-extrabold text-[#0F3A63]">{title}</p>
            <p className="mt-2 text-sm font-semibold text-slate-500">{subtitle}</p>
          </article>
        ))}
      </section>
    );
  };

  return (
    <div className="min-h-screen bg-[#EEF2F6] text-[#0E2B4F]">
      <div className="flex min-h-screen w-full">
        <aside className="min-h-screen w-full max-w-[260px] border-r border-slate-200/80 bg-white px-5 py-6">
          <div className="mb-8">
            <p className="text-4xl font-black tracking-tight text-[#0E4A6B]">SGE</p>
            <img src={logoY3} alt="Y3" className="mt-2 h-16 w-auto object-contain" />
          </div>
          <nav className="space-y-1 text-sm">
            {supportMenu.map((item) => {
              const Icon = item.icon;
              const isActive = activeSection === item.key;
              return (
                <button
                  key={item.key}
                  onClick={() => setActiveSection(item.key)}
                  className={`w-full rounded-md px-3 py-2 text-left ${
                    isActive ? "bg-[#DDE6EE] font-semibold text-[#0E4A6B]" : "text-[#0F3A63] hover:bg-slate-100"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <Icon size={15} />
                    {item.label}
                  </span>
                </button>
              );
            })}
          </nav>
          <button onClick={onLogout} className="mt-10 flex items-center gap-2 text-sm font-semibold text-[#0F3A63]">
            <LogOut size={14} />
            Deconnexion
          </button>
        </aside>

        <main className="flex-1 p-5 md:p-8">
          <header className="mb-6">
            <h1 className="text-3xl font-black tracking-tight text-[#0F3A63]">{pageTitle}</h1>
            <p className="mt-1 text-sm font-semibold text-slate-500">
              {displayName} - Cycle 2025-2026 - Département support
            </p>
          </header>
          {renderContent()}
        </main>
      </div>
    </div>
  );
}

export default VueSupport;
