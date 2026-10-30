// Limiteur de requêtes par adresse IP, en mémoire (une seule instance du backend).
// Derrière un proxy, l'IP réelle n'est connue que si TRUST_PROXY est configuré (voir app.js) :
// sans cela, toutes les requêtes partageraient l'IP du proxy et la limite bloquerait tout le monde.

let warnedAboutProxy = false;

function isBehindUntrustedProxy(request) {
  return Boolean(request.headers['x-forwarded-for']) && !process.env.TRUST_PROXY;
}

function createIpRateLimiter({ windowMs, max, message }) {
  const hits = new Map();

  // Nettoyage périodique des fenêtres expirées.
  const cleanup = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of hits) {
      if (entry.resetAt <= now) hits.delete(key);
    }
  }, windowMs);
  cleanup.unref();

  return function ipRateLimiter(request, response, next) {
    if (isBehindUntrustedProxy(request)) {
      if (!warnedAboutProxy) {
        warnedAboutProxy = true;
        console.warn('[rateLimit] Requêtes reçues via un proxy sans TRUST_PROXY : limite par IP désactivée.');
      }
      return next();
    }

    const key = request.ip || request.socket?.remoteAddress || 'inconnue';
    const now = Date.now();
    let entry = hits.get(key);

    if (!entry || entry.resetAt <= now) {
      entry = { count: 0, resetAt: now + windowMs };
      hits.set(key, entry);
    }

    entry.count += 1;

    if (entry.count > max) {
      response.set('Retry-After', String(Math.ceil((entry.resetAt - now) / 1000)));
      return response.status(429).json({ message });
    }

    return next();
  };
}

module.exports = { createIpRateLimiter };
