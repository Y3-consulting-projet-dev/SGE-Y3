function normalizeGrade(value) {
  return String(value || '').replace(/\s+/g, ' ').trim().toLowerCase();
}

function normalizeCodeCat(value) {
  return String(value || '').replace(/\s+/g, '').trim().toUpperCase();
}

function requireAssistant(request, response, next) {
  const grade = normalizeGrade(request.user?.grade);
  const cat = normalizeCodeCat(request.user?.code_categorie);
  if (grade !== 'assistant' && !cat.startsWith('8')) {
    return response.status(403).json({
      message: 'Cette fonctionnalité est reservée aux Assistants pour le moment.',
    });
  }

  return next();
}

function requireSenior(request, response, next) {
  const grade = normalizeGrade(request.user?.grade);
  const cat = normalizeCodeCat(request.user?.code_categorie);
  if (grade !== 'senior' && grade !== 'assistant manager' && cat !== '9A' && cat !== '9B') {
    return response.status(403).json({
      message: 'Cette fonctionnalité est reservée aux Seniors et Assistant managers pour le moment.',
    });
  }

  return next();
}

function requireManager(request, response, next) {
  const grade = normalizeGrade(request.user?.grade);
  const cat = normalizeCodeCat(request.user?.code_categorie);
  if (
    grade !== 'assistant manager' &&
    grade !== 'manager' &&
    grade !== 'senior manager' &&
    cat !== '9B' &&
    cat !== '10B' &&
    cat !== '10C'
  ) {
    return response.status(403).json({
      message: 'Cette fonctionnalité est reservée aux Assistant managers, Managers et Senior managers.',
    });
  }

  return next();
}

function requireRh(request, response, next) {
  const department = String(request.user?.department || "").trim().toUpperCase();
  const permissionRole = String(request.auth?.permission_role || "").trim().toLowerCase();

  if (
    department === "RH" ||
    department === "CAPITAL HUMAIN" ||
    permissionRole === "admin" ||
    permissionRole === "rh_assistant"
  ) {
    return next();
  }

  return response.status(403).json({
    message: "Cette fonctionnalité est reservée à la RH.",
  });
}

function requireAssociate(request, response, next) {
  if (request.user?.code_categorie === '11' || request.user?.grade === 'Associé' || request.user?.grade === 'Associe') {
    return next();
  }

  return response.status(403).json({
    message: "Cette fonctionnalité est reservée aux associés.",
  });
}

module.exports = {
  requireAssistant,
  requireAssociate,
  requireManager,
  requireRh,
  requireSenior,
};
