export const gradeOptions = [
  "Assistant",
  "Senior",
  "Assistant manager",
  "Manager",
  "Senior manager",
  "Associé",
];

export const departmentOptions = [
  "AUDIT",
  "AUDIT & EXPERTISE COMPTABLE",
  "CONSEIL FINANCIER",
  "EXPERTISE COMPTABLE",
  "CAPITAL HUMAIN",
  "RH",
];

export function getInitials(user) {
  const parts = [user?.first_name, user?.last_name]
    .filter(Boolean)
    .join(" ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (!parts.length) {
    return "U";
  }

  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("");
}

export function getDisplayName(user) {
  if (!user) {
    return "Utilisateur";
  }

  return [user.first_name, user.last_name].filter(Boolean).join(" ").trim() || user.name || "Utilisateur";
}
