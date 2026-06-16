import { useMemo, useState } from "react";
import { ClipboardList, History, LayoutDashboard, LogOut, Settings2 } from "lucide-react";
import logoY3 from "@/assets/logo-y3.png";
import ProfilePanel from "@/components/profile/ProfilePanel";
import MonautoevaluationSupport from "@/components/pages/support/MonautoevaluationSupport";
import Monhistorique from "@/components/pages/support/Monhistorique";
import { getDisplayName } from "@/lib/userPresentation";

const supportMenu = [
  { key: "overview", label: "Vue support", icon: LayoutDashboard },
  { key: "self-evaluation", label: "Mon auto-évaluation", icon: ClipboardList },
  { key: "history", label: "Historique", icon: History },
  { key: "profile", label: "Profil", icon: Settings2 },
];

function VueSupport({ onLogout, onUserUpdate, user }) {
  const [activeSection, setActiveSection] = useState("overview");
  const displayName = getDisplayName(user);
  const profileKey = [user?.id, user?.email, user?.first_name, user?.last_name, user?.grade, user?.department].join("|");

  const pageTitle = useMemo(() => {
    if (activeSection === "self-evaluation") return "MON AUTO-ÉVALUATION SUPPORT";
    if (activeSection === "history") return "HISTORIQUE";
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
