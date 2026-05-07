import { useState } from "react";
import LoginPage from "@/components/pages/auth/LoginPage";
import ManagerDashboard from "@/components/pages/dashboard/ManagerDashboard";
import CollaboratorDashboard from "@/components/pages/dashboard/CollaboratorDashboard";
import SeniorDashboard from "@/components/pages/dashboard/SeniorDashboard";
import Vuecabinet from "@/components/pages/associé/Vuecabinet";

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userRole, setUserRole] = useState("manager");

  if (isAuthenticated) {
    if (userRole === "collaborator") {
      return <CollaboratorDashboard onLogout={() => setIsAuthenticated(false)} />;
    }
    if (userRole === "senior") {
      return <SeniorDashboard onLogout={() => setIsAuthenticated(false)} />;
    }
    if (userRole === "associate") {
      return <Vuecabinet onLogout={() => setIsAuthenticated(false)} />;
    }
    return <ManagerDashboard onLogout={() => setIsAuthenticated(false)} />;
  }

  return <LoginPage onLoginSuccess={(role) => {
    setUserRole(role || "manager");
    setIsAuthenticated(true);
  }} />;
}

export default App;
