const jwt = require('jsonwebtoken');

const User = require('../models/User');
const { isRecoveryCodeMode } = require('../utils/passwordPolicy');

// Routes accessibles tant que le code de secours n'a pas été conservé.
const RECOVERY_CODE_ROUTES = ['/api/auth/me/password', '/api/auth/me/recovery-code', '/api/auth/me/recovery-code/confirm'];

function getPendingSecurityStep(user, path) {
  if (isRecoveryCodeMode() && !user.recovery_code_confirmed_at && !RECOVERY_CODE_ROUTES.includes(path)) {
    return {
      code: 'RECOVERY_CODE_REQUIRED',
      message: 'Vous devez conserver votre code de secours avant de continuer.',
    };
  }

  return null;
}

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

    // iat est en secondes : un jeton émis dans la même seconde que le changement reste valide.
    const passwordChangedAtSeconds = user.password_changed_at
      ? Math.floor(user.password_changed_at.getTime() / 1000)
      : 0;
    if (passwordChangedAtSeconds && payload.iat < passwordChangedAtSeconds) {
      return response.status(401).json({
        message: 'Votre mot de passe a été modifié. Veuillez vous reconnecter.',
        code: 'SESSION_REVOKED',
      });
    }

    const pendingStep = getPendingSecurityStep(user, `${request.baseUrl}${request.path}`.replace(/\/+$/, ''));
    if (pendingStep) {
      return response.status(403).json(pendingStep);
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
