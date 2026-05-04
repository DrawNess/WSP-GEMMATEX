const SESSION_TTL_MS = 30 * 60 * 1000; // 30 minutos
const CLEANUP_INTERVAL_MS = 10 * 60 * 1000; // limpiar cada 10 minutos

const sessions = new Map();

// Elimina sesiones expiradas periódicamente para evitar memory leak
setInterval(() => {
  const now = Date.now();
  for (const [userId, session] of sessions) {
    if (now - session.lastActivity > SESSION_TTL_MS) {
      sessions.delete(userId);
    }
  }
}, CLEANUP_INTERVAL_MS);

function getSession(userId) {
  const session = sessions.get(userId);
  if (!session) return createSession(userId);

  const now = Date.now();
  if (now - session.lastActivity > SESSION_TTL_MS) {
    return createSession(userId);
  }

  session.lastActivity = now;
  return session;
}

function createSession(userId) {
  const session = {
    state: 'idle',
    categoryId: null,
    categoryName: null,
    subcategoryId: null,
    subcategoryName: null,
    products: [],
    page: 1,
    totalPages: 1,
    lastActivity: Date.now(),
  };
  sessions.set(userId, session);
  return session;
}

function updateSession(userId, data) {
  const session = getSession(userId);
  Object.assign(session, data, { lastActivity: Date.now() });
  sessions.set(userId, session);
  return session;
}

function clearSession(userId) {
  sessions.delete(userId);
}

export default { getSession, updateSession, clearSession };
