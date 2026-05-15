function requireAssistant(request, response, next) {
  if (request.user?.grade !== 'Assistant') {
    return response.status(403).json({
      message: 'Cette fonctionnalite est reservee aux Assistants pour le moment.',
    });
  }

  return next();
}

function requireSenior(request, response, next) {
  if (request.user?.grade !== 'Senior' && request.user?.grade !== 'Assistant manager') {
    return response.status(403).json({
      message: 'Cette fonctionnalite est reservee aux Seniors et Assistant managers pour le moment.',
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
      message: 'Cette fonctionnalite est reservee aux Assistant managers, Managers et Senior managers.',
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
    message: "Cette fonctionnalite est reservee a la RH / Capital Humain.",
  });
}

module.exports = {
  requireAssistant,
  requireManager,
  requireRh,
  requireSenior,
};
