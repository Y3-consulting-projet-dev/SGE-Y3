import { useEffect, useState } from "react";
import { getRhAnonymousCommentRecipients, getRhCollaboratorAnonymousComments, getRhReceivedComments } from "@/api/rhOverview";
import CommentairesRecus from "@/components/common/CommentairesRecus";
import MemberSearchSelect from "@/components/historique/MemberSearchSelect";

const TABS = [
  { key: "recus", label: "Commentaire reçu" },
  { key: "collaborateur", label: "Commentaire collaborateur" },
];

function CommentaireRecuTab() {
  const [comments, setComments] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setIsLoading(true);
        setErrorMessage("");
        const response = await getRhReceivedComments();
        if (!cancelled) {
          setComments(response?.received || []);
        }
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(error.message || "Chargement des commentaires impossible.");
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  if (errorMessage) {
    return <section className="rounded-xl bg-white p-5 text-sm font-semibold text-red-600 shadow-sm">{errorMessage}</section>;
  }

  return <CommentairesRecus comments={comments} isLoading={isLoading} />;
}

function CommentaireCollaborateurTab() {
  const [members, setMembers] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [isLoadingMembers, setIsLoadingMembers] = useState(true);
  const [membersError, setMembersError] = useState("");

  const [comments, setComments] = useState([]);
  const [isLoadingComments, setIsLoadingComments] = useState(false);
  const [commentsError, setCommentsError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadMembers() {
      try {
        setIsLoadingMembers(true);
        setMembersError("");
        const response = await getRhAnonymousCommentRecipients();
        if (!cancelled) {
          setMembers(response?.recipients || []);
        }
      } catch (error) {
        if (!cancelled) {
          setMembersError(error.message || "Chargement des collaborateurs impossible.");
        }
      } finally {
        if (!cancelled) {
          setIsLoadingMembers(false);
        }
      }
    }

    loadMembers();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    let cancelled = false;

    async function loadComments() {
      try {
        setIsLoadingComments(true);
        setCommentsError("");
        const response = await getRhCollaboratorAnonymousComments(selectedId);
        if (!cancelled) {
          setComments(response?.received || []);
        }
      } catch (error) {
        if (!cancelled) {
          setCommentsError(error.message || "Chargement des commentaires anonymes impossible.");
        }
      } finally {
        if (!cancelled) {
          setIsLoadingComments(false);
        }
      }
    }

    loadComments();
    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  if (isLoadingMembers) {
    return <div className="rounded-md bg-white p-4 text-sm font-semibold text-slate-500 shadow-sm">Chargement des collaborateurs...</div>;
  }

  if (membersError) {
    return <div className="rounded-md bg-white p-4 text-sm font-semibold text-red-600 shadow-sm">{membersError}</div>;
  }

  const selectedMember = members.find((member) => member.id === selectedId) || null;

  return (
    <div className="space-y-4">
      <MemberSearchSelect members={members} selectedId={selectedId} onSelect={setSelectedId} />

      {selectedMember ? (
        <article className="rounded-xl bg-white p-5 shadow-sm">
          <p className="text-xs font-bold uppercase text-slate-400">Collaborateur sélectionné</p>
          <h3 className="mt-1 text-xl font-black text-[#0F3A63]">{selectedMember.name}</h3>
          <p className="text-sm font-semibold text-slate-500">
            {selectedMember.grade}{selectedMember.department ? ` - ${selectedMember.department}` : ""}
          </p>
          {!isLoadingComments && !commentsError ? (
            <p className="mt-2 text-sm font-semibold text-[#0F4A72]">
              {comments.length > 0
                ? `A reçu ${comments.length} commentaire${comments.length > 1 ? "s" : ""} anonyme${comments.length > 1 ? "s" : ""} pour ce cycle.`
                : "N'a reçu aucun commentaire anonyme pour ce cycle."}
            </p>
          ) : null}

          <div className="mt-4">
            {commentsError ? (
              <p className="text-sm font-semibold text-red-600">{commentsError}</p>
            ) : (
              <CommentairesRecus comments={comments} isLoading={isLoadingComments} />
            )}
          </div>
        </article>
      ) : null}
    </div>
  );
}

function CommentairesAnonymesRH() {
  const [activeTab, setActiveTab] = useState("recus");

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={`rounded-full px-4 py-2 text-xs font-bold ${
              activeTab === tab.key ? "bg-[#0D496A] text-white" : "bg-[#E7EDF3] text-[#0F3A63]"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "recus" ? <CommentaireRecuTab /> : <CommentaireCollaborateurTab />}
    </section>
  );
}

export default CommentairesAnonymesRH;
