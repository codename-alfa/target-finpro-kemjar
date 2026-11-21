const { writeAuditLog } = require('./auditLogger');

/**
 * Requires an active authenticated session (returns 401 Unauthorized otherwise).
 */
async function requireAuth(req, res, next) {
  if (req.session && req.session.user) {
    return next();
  }
  await writeAuditLog({
    req,
    actor: 'unauthenticated',
    statusCode: 401,
    detail: 'SECURE_DENIED_UNAUTH: Authentication required'
  });
  return res.status(401).json({
    mode: 'SECURE',
    error: 'Unauthorized: Authentication required.'
  });
}

/**
 * Requires administrator role after requireAuth (returns 403 Forbidden otherwise).
 */
async function requireAdmin(req, res, next) {
  if (req.session?.user?.role === 'admin') {
    return next();
  }
  await writeAuditLog({
    req,
    actor: req.session?.user?.username || 'unauthenticated',
    statusCode: 403,
    detail: 'SECURE_DENIED_FORBIDDEN: Administrator role required'
  });
  return res.status(403).json({
    mode: 'SECURE',
    error: 'Forbidden: Administrator role required.'
  });
}

module.exports = {
  requireAuth,
  requireAdmin
};
