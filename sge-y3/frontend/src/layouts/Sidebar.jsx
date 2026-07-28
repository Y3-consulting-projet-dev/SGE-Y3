import { Link } from "react-router-dom";

function Sidebar() {
  return (
    <div className="w-64 h-screen bg-gray-900 text-white p-4">
      <h2 className="text-xl font-bold mb-6">SGE</h2>

      <nav className="flex flex-col gap-3">
        <Link to="/dashboard">Dashboard</Link>
        <Link to="/users">Utilisateurs</Link>
        <Link to="/cycles">Cycles</Link>
        <Link to="/evaluations">Évaluations</Link>
      </nav>
    </div>
  );
}

export default Sidebar;