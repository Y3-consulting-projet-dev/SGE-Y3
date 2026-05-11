import { useState } from "react";
import LoginPage from "@/components/pages/auth/LoginPage";
import ManagerDashboard from "@/components/pages/dashboard/ManagerDashboard";
import CollaboratorDashboard from "@/components/pages/dashboard/CollaboratorDashboard";
import SeniorDashboard from "@/components/pages/dashboard/SeniorDashboard";
import Vuecabinet from "@/components/pages/associé/Vuecabinet";
import VueRH from "@/components/pages/rh/VueRH";
import { clearSession, loadSession, loginUser, saveSession } from "@/lib/auth";

function normalizeDepartment(value = "") {
  return String(value).replace(/\s+/g, " ").trim().toUpperCase();
}

function getDashboardRole(user) {
  const department = normalizeDepartment(user?.department);

  if (user?.permission_role === "admin" && (department === "RH" || department === "CAPITAL HUMAIN")) {
    return "rh";
  }

  if (user?.role === "associate") {
    return "associate";
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

    if (userRole === "rh") {
      return <VueRH user={currentUser} onLogout={handleLogout} onUserUpdate={handleSessionRefresh} />;
    }

    return <ManagerDashboard user={currentUser} onLogout={handleLogout} onUserUpdate={handleSessionRefresh} />;
  }

  return <LoginPage onLoginSuccess={handleLoginSuccess} />;
}

export default App;
