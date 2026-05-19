import { useState } from "react";
import { Eye, EyeOff, Power } from "lucide-react";
import { updatePassword, updateProfile } from "@/lib/auth";
import { departmentOptions, getDisplayName, getInitials, gradeOptions } from "@/lib/userPresentation";

function createInfoForm(user) {
  return {
    first_name: user?.first_name || "",
    last_name: user?.last_name || "",
    email: user?.email || "",
    grade: user?.grade || "Assistant",
    department: user?.department || "",
  };
}

function ProfilePanel({ user, onLogout, onUserUpdate }) {
  const [activeTab, setActiveTab] = useState("info");
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    next: false,
    confirm: false,
  });
  const [infoStatus, setInfoStatus] = useState("");
  const [passwordStatus, setPasswordStatus] = useState("");
  const [isSavingInfo, setIsSavingInfo] = useState(false);
  const [isSavingPassword, setIsSavingPassword] = useState(false);
  const [infoForm, setInfoForm] = useState(() => createInfoForm(user));
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  const summaryName = getDisplayName(user);
  const initials = getInitials(user);

  const handleInfoChange = (field, value) => {
    setInfoForm((current) => ({ ...current, [field]: value }));
    setInfoStatus("");
  };

  const handlePasswordChange = (field, value) => {
    setPasswordForm((current) => ({ ...current, [field]: value }));
    setPasswordStatus("");
  };

  const getStatusTone = (message) =>
    message.toLowerCase().includes("incorrect") ||
    message.toLowerCase().includes("invalide") ||
    message.toLowerCase().includes("impossible")
      ? "text-red-600"
      : "text-[#5B9B3A]";

  const resetInfoForm = () => {
    setInfoForm(createInfoForm(user));
    setInfoStatus("");
  };

  const savePersonalInfo = async () => {
    try {
      setIsSavingInfo(true);
      setInfoStatus("");
      const session = await updateProfile(infoForm);
      onUserUpdate?.(session);
      setInfoStatus(session.message || "Profil mis à jour.");
    } catch (error) {
      setInfoStatus(error.message || "Mise à jour impossible.");
    } finally {
      setIsSavingInfo(false);
    }
  };

  const savePassword = async () => {
    try {
      setIsSavingPassword(true);
      setPasswordStatus("");
      const result = await updatePassword(passwordForm);
      setPasswordForm({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
      setPasswordStatus(result.message || "Mot de passe mis à jour.");
    } catch (error) {
      setPasswordStatus(error.message || "Mise à jour impossible.");
    } finally {
      setIsSavingPassword(false);
    }
  };

  return (
    <section className="grid gap-4 lg:grid-cols-[250px_1fr]">
      <aside className="card px-4 py-4">
        <div className="flex items-center gap-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold text-white">
            {initials}
          </div>
          <div>
            <p className="text-lg font-semibold text-[#071B49]">{summaryName}</p>
            <p className="text-sm text-[#6482A6]">{user?.email}</p>
            <span className="mt-2 inline-flex rounded-full bg-[#F2F6EE] px-3 py-1 text-xs text-[#5B8D3E]">
              {user?.grade}
            </span>
          </div>
        </div>

        <div className="mt-6 space-y-3">
          <button
            onClick={() => setActiveTab("info")}
            className={`flex w-full items-center justify-between rounded-[20px] px-4 py-3 text-left text-base ${
              activeTab === "info" ? "bg-[#6DAC55] text-white" : "bg-[#F4F7FB] text-[#13254E]"
            }`}
          >
            <span>Informations personnelles</span>
            <span className="text-sm">1</span>
          </button>

          <button
            onClick={() => setActiveTab("password")}
            className={`flex w-full items-center justify-between rounded-[20px] px-4 py-3 text-left text-base ${
              activeTab === "password" ? "bg-[#6DAC55] text-white" : "bg-[#F4F7FB] text-[#13254E]"
            }`}
          >
            <span>Connexion & mot de passe</span>
            <span className="text-sm">2</span>
          </button>

          <button
            onClick={onLogout}
            className="flex w-full items-center justify-between rounded-[20px] bg-[#151F38] px-4 py-3 text-left text-base text-white"
          >
            <span>Déconnexion</span>
            <Power size={16} />
          </button>
        </div>
      </aside>

      <div className="rounded-[22px] bg-white p-5 shadow-sm">
        {activeTab === "info" ? (
          <>
            <header className="mb-6">
              <h2 className="text-[28px] font-semibold text-[#071B49]">Informations personnelles</h2>
              <p className="mt-1.5 text-base text-[#6882A4]">Profil de votre compte sur l'outil d'évaluation.</p>
            </header>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-base text-[#3E5C81]">Prénoms</span>
                <input
                  value={infoForm.first_name}
                  onChange={(event) => handleInfoChange("first_name", event.target.value)}
                  className="h-12 w-full rounded-[20px] border border-[#D6E1EF] bg-[#F8FBFF] px-4 text-lg text-[#071B49] outline-none"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-base text-[#3E5C81]">Nom</span>
                <input
                  value={infoForm.last_name}
                  onChange={(event) => handleInfoChange("last_name", event.target.value)}
                  className="h-12 w-full rounded-[20px] border border-[#D6E1EF] bg-[#F8FBFF] px-4 text-lg text-[#071B49] outline-none"
                />
              </label>
            </div>

            <label className="mt-4 block">
              <span className="mb-2 block text-base text-[#3E5C81]">Email</span>
              <div className="flex h-12 items-center justify-between rounded-[20px] border border-[#D6E1EF] bg-[#F8FBFF] px-4">
                <input
                  value={infoForm.email}
                  onChange={(event) => handleInfoChange("email", event.target.value)}
                  className="w-full bg-transparent text-lg text-[#071B49] outline-none"
                />
                <span className="ml-3 inline-flex items-center gap-2 rounded-full bg-[#F2F7ED] px-3 py-1 text-xs text-[#5B8D3E]">
                  <span className="h-2 w-2 rounded-full bg-[#76B82A]" />
                  Renseigné
                </span>
              </div>
            </label>

            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-base text-[#3E5C81]">Grade</span>
                <select
                  value={infoForm.grade}
                  onChange={(event) => handleInfoChange("grade", event.target.value)}
                  className="h-12 w-full rounded-[20px] border border-[#D6E1EF] bg-[#F8FBFF] px-4 text-lg text-[#071B49] outline-none"
                >
                  {gradeOptions.map((grade) => (
                    <option key={grade} value={grade}>
                      {grade}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="mb-2 block text-base text-[#3E5C81]">Département</span>
                <select
                  value={infoForm.department}
                  onChange={(event) => handleInfoChange("department", event.target.value)}
                  className="h-12 w-full rounded-[20px] border border-[#D6E1EF] bg-[#F8FBFF] px-4 text-lg text-[#071B49] outline-none"
                >
                  <option value="">Selectionner</option>
                  {departmentOptions.map((department) => (
                    <option key={department} value={department}>
                      {department}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-end gap-3">
              {infoStatus ? <p className={`mr-auto text-sm font-semibold ${getStatusTone(infoStatus)}`}>{infoStatus}</p> : null}
              <button
                onClick={resetInfoForm}
                className="rounded-full border border-[#D6E1EF] px-6 py-2.5 text-base text-[#16335A]"
              >
                Annuler
              </button>
              <button
                onClick={savePersonalInfo}
                disabled={isSavingInfo}
                className="rounded-full bg-[#6DAC55] px-6 py-2.5 text-base font-semibold text-white disabled:opacity-70"
              >
                {isSavingInfo ? "Enregistrement..." : "Enregistrer"}
              </button>
            </div>
          </>
        ) : (
          <>
            <header className="mb-6">
              <h2 className="text-[28px] font-semibold text-[#071B49]">Connexion & mot de passe</h2>
              <p className="mt-1.5 text-base text-[#6882A4]">Sécurité du compte et gestion du mot de passe.</p>
            </header>

            <section className="rounded-[22px] border border-[#E5ECF4] bg-white p-5">
              <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-[22px] font-semibold text-[#071B49]">Changer le mot de passe</h3>
                  <p className="mt-1.5 max-w-4xl text-base text-[#6882A4]">
                    Renseignez votre ancien mot de passe, puis un nouveau mot de passe.
                  </p>
                </div>
                <span className="rounded-full bg-[#F2F7ED] px-3 py-1 text-xs text-[#5B8D3E]">Regles de securite appliquees</span>
              </div>

              <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
                {[
                  ["currentPassword", "Ancien mot de passe", "current"],
                  ["newPassword", "Nouveau mot de passe", "next"],
                  ["confirmPassword", "Confirmer le mot de passe", "confirm"],
                ].map(([field, label, visibilityKey]) => (
                  <label key={field} className="block">
                    <span className="mb-2 block text-base text-[#3E5C81]">{label}</span>
                    <div className="flex h-12 items-center rounded-[20px] border border-[#D6E1EF] bg-[#F8FBFF] px-4">
                      <input
                        type={showPasswords[visibilityKey] ? "text" : "password"}
                        value={passwordForm[field]}
                        onChange={(event) => handlePasswordChange(field, event.target.value)}
                        placeholder={label}
                        className="w-full bg-transparent text-lg text-[#071B49] outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPasswords((current) => ({ ...current, [visibilityKey]: !current[visibilityKey] }))}
                        className="text-[#5B8D3E]"
                      >
                        {showPasswords[visibilityKey] ? <EyeOff size={20} /> : <Eye size={20} />}
                      </button>
                    </div>
                  </label>
                ))}
              </div>

              <div className="mt-6 flex flex-wrap items-center justify-end gap-3">
                {passwordStatus ? (
                  <p className={`mr-auto text-sm font-semibold ${getStatusTone(passwordStatus)}`}>{passwordStatus}</p>
                ) : null}
                <button
                  onClick={() => setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" })}
                  className="rounded-full border border-[#D6E1EF] px-6 py-2.5 text-base text-[#16335A]"
                >
                  Effacer
                </button>
                <button
                  onClick={savePassword}
                  disabled={isSavingPassword}
                  className="rounded-full bg-[#6DAC55] px-6 py-2.5 text-base font-semibold text-white disabled:opacity-70"
                >
                  {isSavingPassword ? "Mise à jour..." : "Modifier le mot de passe"}
                </button>
              </div>
            </section>
          </>
        )}
      </div>
    </section>
  );
}

export default ProfilePanel;
