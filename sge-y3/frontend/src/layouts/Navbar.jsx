function Navbar() {
  return (
    <div className="h-16 bg-white shadow flex items-center px-6 justify-between">
      <h1 className="font-semibold">Dashboard</h1>
      <button className="bg-red-500 text-white px-3 py-1 rounded">
        Logout
      </button>
    </div>
  );
}

export default Navbar;