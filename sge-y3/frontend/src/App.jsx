import { lazy, Suspense, useState } from "react";
import LoginPage from "@/components/pages/auth/LoginPage";
import { clearSession, loadSession, loginUser, saveSession } from "@/api/auth";

const ManagerDashboard = lazy(() => import("@/components/pages/dashboard/ManagerDashboard"));
const CollaboratorDashboard = lazy(() => import("@/components/pages/dashboard/CollaboratorDashboard"));
const SeniorDashboard = lazy(() => import("@/components/pages/dashboard/SeniorDashboard"));
const Vuecabinet = lazy(() => import("@/components/pages/associé/Vuecabinet"));
const VueRH = lazy(() => import("@/components/pages/rh/VueRH"));
const VueSupport = lazy(() => import("@/components/pages/support/VueSupport"));

function normalizeDepartment(value = "") {
  return String(value).replace(/\s+/g, " ").trim().toUpperCase();
}

function isRhDepartment(value = "") {
  const department = normalizeDepartment(value);
  return department === "RH" || department === "CAPITAL HUMAIN";
}

function isSupportUser(user) {
  const dept = normalizeDepartment(user?.department);
  return dept === "SUPPORT" || dept === "SERVICE SUPPORT";
}

function getFullName(user) {
  return normalizeDepartment([user?.first_name, user?.last_name, user?.name].filter(Boolean).join(" "));
}

function isFullRh(user) {
  const fullName = getFullName(user);
  return fullName.includes("ISABELLA") && fullName.includes("BEDA");
}

function isAssistantRh(user) {
  const grade = normalizeDepartment(user?.grade);
  const role = normalizeDepartment(user?.role);
  const permissionRole = normalizeDepartment(user?.permission_role);

  if (isFullRh(user)) {
    return false;
  }

  return (
    isRhDepartment(user?.department) &&
    (role === "RH-ASSISTANT" || role === "ASSISTANTE RH" || permissionRole === "RH_ASSISTANT" || grade.includes("ASSISTANT"))
  );
}

function getDashboardRole(user) {
  const department = normalizeDepartment(user?.department);
  const grade = normalizeDepartment(user?.grade);

  if (isAssistantRh(user)) {
    return "rh-assistant";
  }

  if (user?.permission_role === "admin" && isRhDepartment(department)) {
    return "rh";
  }

  if (user?.role === "associate") {
    return "associate";
  }

  if (isSupportUser(user)) {
    return "support";
  }

  if (grade === "SENIOR" || grade === "ASSISTANT MANAGER") {
    return "senior";
  }

  return user?.role || "manager";
}

function getInitialAuthState() {
  const session = loadSession();

  if (!session?.user?.role) {
    return {
      isAuthenticated: false,
      userRole: "manager",
      currentUser: null,
    };
  }

  return {
    isAuthenticated: true,
    userRole: getDashboardRole(session.user),
    currentUser: session.user,
  };
}

function LoadingView() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#EBEFF3] text-sm font-bold text-[#0F3A63]">
      Chargement de l'espace...
    </div>
  );
}

function App() {
  const [authState, setAuthState] = useState(getInitialAuthState);

  const { isAuthenticated, userRole, currentUser } = authState;

  const handleLogout = () => {
    clearSession();
    setAuthState({
      isAuthenticated: false,
      userRole: "manager",
      currentUser: null,
    });
  };

  const applySession = (session) => {
    saveSession(session);
    setAuthState({
      isAuthenticated: true,
      userRole: getDashboardRole(session.user),
      currentUser: session.user,
    });
  };

  const handleLoginSuccess = async (credentials) => {
    const session = await loginUser(credentials);
    applySession(session);
  };

  const handleSessionRefresh = (session) => {
    applySession(session);
  };

  if (!isAuthenticated) {
    return <LoginPage onLoginSuccess={handleLoginSuccess} />;
  }

  let dashboard = <ManagerDashboard user={currentUser} onLogout={handleLogout} onUserUpdate={handleSessionRefresh} />;

  if (userRole === "collaborator") {
    dashboard = <CollaboratorDashboard user={currentUser} onLogout={handleLogout} onUserUpdate={handleSessionRefresh} />;
  } else if (userRole === "senior") {
    dashboard = <SeniorDashboard user={currentUser} onLogout={handleLogout} onUserUpdate={handleSessionRefresh} />;
  } else if (userRole === "associate") {
    dashboard = <Vuecabinet user={currentUser} onLogout={handleLogout} onUserUpdate={handleSessionRefresh} />;
  } else if (userRole === "support") {
    dashboard = <VueSupport user={currentUser} onLogout={handleLogout} onUserUpdate={handleSessionRefresh} />;
  } else if (userRole === "rh" || userRole === "rh-assistant") {
    dashboard = (
      <VueRH
        user={currentUser}
        assistantMode={userRole === "rh-assistant"}
        onLogout={handleLogout}
        onUserUpdate={handleSessionRefresh}
      />
    );
  }

  return <Suspense fallback={<LoadingView />}>{dashboard}</Suspense>;
}

export default App;
