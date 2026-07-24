export function getProgressToneClass(progress) {
  if (progress < 20) return "text-red-600";
  if (progress < 40) return "text-yellow-600";
  if (progress < 60) return "text-orange-600";
  if (progress < 80) return "text-green-400";
  return "text-green-600";
}

export function getProgressBarClass(progress) {
  if (progress < 20) return "bg-red-600";
  if (progress < 40) return "bg-yellow-600";
  if (progress < 60) return "bg-orange-600";
  if (progress < 80) return "bg-green-400";
  return "bg-green-600";
}

export function clampProgress(progress) {
  return Math.min(Math.max(progress || 0, 0), 100);
}
