// En dev local (npm run dev), VITE_API_URL peut pointer vers le backend en direct
// (ex: http://localhost:5000/api). En production (build servi par nginx dans Docker),
// on passe par le chemin relatif /api, que nginx proxifie vers le service backend.
export const API_BASE_URL = import.meta.env.VITE_API_URL || "/api";