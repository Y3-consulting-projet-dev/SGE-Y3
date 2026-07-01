export function formatScore(score) {
  return typeof score === "number" ? score.toFixed(1) : "0.0";
}

export function formatCommentDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("fr-FR");
}
