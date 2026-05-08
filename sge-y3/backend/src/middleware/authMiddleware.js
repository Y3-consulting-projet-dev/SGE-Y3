const jwt = require('jsonwebtoken');

const User = require('../models/User');

async function requireAuth(request, response, next) {
  const header = request.headers.authorization || '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return response.status(401).json({
      message: 'Authentification requise.',
    });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(payload.sub);

    if (!user || !user.is_active) {
      return response.status(401).json({
        message: 'Session invalide.',
      });
    }

    request.user = user;
    request.auth = payload;
    return next();
  } catch (_error) {
    return response.status(401).json({
      message: 'Session invalide.',
    });
  }
}

module.exports = {
  requireAuth,
};
