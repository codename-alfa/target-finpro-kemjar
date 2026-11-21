const fs = require('fs');
const path = require('path');
const { pool } = require('../db');
const { getMode } = require('./securityState');

const LOG_DIR = path.join(__dirname, '..', 'logs');
const LOG_FILE = path.join(LOG_DIR, 'security_audit.log');

function resolveClientIp(req) {
  const raw = req.ip || req.socket?.remoteAddress || 'unknown';
  return raw.startsWith('::ffff:') ? raw.slice(7) : raw;
}

/**
 * Writes a structured security audit entry to both logs/security_audit.log and PostgreSQL audit_logs.
 */
async function writeAuditLog({ req, actor, statusCode, detail }) {
  const mode = getMode();
  const timestamp = new Date().toISOString();
  const clientIp = resolveClientIp(req);
  const safeActor = actor || 'unauthenticated';
  const method = req.method || 'GET';
  const endpoint = req.originalUrl || req.url || '/';
  const safeDetail = String(detail || '').replace(/[\r\n]+/g, ' ').trim();

  const line = `[${timestamp}] [${mode}] ${method} ${endpoint} | IP=${clientIp} | Actor=${safeActor} | Status=${statusCode} | Detail=${safeDetail}\n`;

  try {
    fs.mkdirSync(LOG_DIR, { recursive: true });
    fs.appendFileSync(LOG_FILE, line, 'utf8');
  } catch (fileErr) {
    console.error('[AUDIT_LOG_FILE_ERROR]', fileErr.message);
  }

  try {
    await pool.query(
      `INSERT INTO audit_logs (security_mode, client_ip, actor_username, http_method, endpoint, status_code, detail)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [mode, clientIp, safeActor, method, endpoint, statusCode, safeDetail]
    );
  } catch (dbErr) {
    console.error('[AUDIT_LOG_DB_ERROR]', dbErr.message);
  }
}

module.exports = {
  LOG_FILE,
  writeAuditLog
};
