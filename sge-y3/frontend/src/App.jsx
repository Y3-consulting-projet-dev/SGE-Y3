import { useState } from "react";
import LoginPage from "@/components/pages/auth/LoginPage";
import ManagerDashboard from "@/components/pages/dashboard/ManagerDashboard";
import CollaboratorDashboard from "@/components/pages/dashboard/CollaboratorDashboard";
import SeniorDashboard from "@/components/pages/dashboard/SeniorDashboard";
import Vuecabinet from "@/components/pages/associé/Vuecabinet";
import VueRH from "@/components/pages/rh/VueRH";
import { clearSession, loadSession, loginUser, saveSession } from "@/lib/auth";

const ASSISTANT_RH_EMAIL = "fatoumata.ouattara@ycubeac.com";
const FULL_RH_EMAILS = ["isabella.beda@ycubeac.com"];

function normalizeDepartment(value = "") {
  return String(value).replace(/\s+/g, " ").trim().toUpperCase();
}

function normalizeEmail(value = "") {
  return String(value).replace(/\s+/g, " ").trim().toLowerCase();
}

function isRhDepartment(value = "") {
  const department = normalizeDepartment(value);
  return department === "RH" || department === "CAPITAL HUMAIN";
}

function getFullName(user) {
  return normalizeDepartment([user?.first_name, user?.last_name, user?.name].filter(Boolean).join(" "));
}

function isFullRh(user) {
  const email = normalizeEmail(user?.email);
  const fullName = getFullName(user);

  return FULL_RH_EMAILS.includes(email) || (fullName.includes("ISABELLA") && fullName.includes("BEDA"));
}

function isAssistantRh(user) {
  const email = normalizeEmail(user?.email);
  const grade = normalizeDepartment(user?.grade);
  const role = normalizeDepartment(user?.role);
  const permissionRole = normalizeDepartment(user?.permission_role);

  if (isFullRh(user)) {
    return false;
  }

  return (
    email === ASSISTANT_RH_EMAIL ||
    (isRhDepartment(user?.department) &&
      (role === "RH-ASSISTANT" || role === "ASSISTANTE RH" || permissionRole === "RH_ASSISTANT" || grade.includes("ASSISTANT")))
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

  if (isAuthenticated) {
    if (userRole === "collaborator") {
      return <CollaboratorDashboard user={currentUser} onLogout={handleLogout} onUserUpdate={handleSessionRefresh} />;
    }

    if (userRole === "senior") {
      return <SeniorDashboard user={currentUser} onLogout={handleLogout} onUserUpdate={handleSessionRefresh} />;
    }

    if (userRole === "associate") {
      return <Vuecabinet user={currentUser} onLogout={handleLogout} onUserUpdate={handleSessionRefresh} />;
    }

    if (userRole === "rh" || userRole === "rh-assistant") {
      return (
        <VueRH
          user={currentUser}
          assistantMode={userRole === "rh-assistant"}
          onLogout={handleLogout}
          onUserUpdate={handleSessionRefresh}
        />
      );
    }

    return <ManagerDashboard user={currentUser} onLogout={handleLogout} onUserUpdate={handleSessionRefresh} />;
  }

  return <LoginPage onLoginSuccess={handleLoginSuccess} />;
}

export default App;
