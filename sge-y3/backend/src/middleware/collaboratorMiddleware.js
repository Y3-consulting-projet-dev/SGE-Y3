function requireAssistant(request, response, next) {
  if (request.user?.grade !== 'Assistant') {
    return response.status(403).json({
      message: 'Cette fonctionnalite est reservee aux Assistants pour le moment.',
    });
  }

  return next();
}

module.exports = {
  requireAssistant,
};
