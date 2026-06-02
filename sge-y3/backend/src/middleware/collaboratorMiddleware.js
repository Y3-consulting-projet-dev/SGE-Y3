function requireAssistant(request, response, next) {
  if (request.user?.grade !== 'Assistant') {
    return response.status(403).json({
      message: 'Cette fonctionnalité est reservée aux Assistants pour le moment.',
    });
  }

  return next();
}

function requireSenior(request, response, next) {
  if (request.user?.grade !== 'Senior' && request.user?.grade !== 'Assistant manager') {
    return response.status(403).json({
      message: 'Cette fonctionnalité est reservée aux Seniors et Assistant managers pour le moment.',
    });
  }

  return next();
}

function requireManager(request, response, next) {
  if (
    request.user?.grade !== 'Assistant manager' &&
    request.user?.grade !== 'Manager' &&
    request.user?.grade !== 'Senior manager'
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
