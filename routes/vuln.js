const express = require('express');
const bcrypt = require('bcryptjs');
const { pool } = require('../db');
const { writeAuditLog } = require('../middleware/auditLogger');

const router = express.Router();

// TOPIC 1 (VULNERABLE): No API Authentication (CWE-306)
// Missing requireAuth/requireAdmin middleware exposes sensitive customer & admin directory.
router.get('/users', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT id, username, full_name, email, account_number, balance, role, updated_at FROM users ORDER BY id ASC'
    );
    await writeAuditLog({
      req,
      actor: req.session?.user?.username || 'unauthenticated',
      statusCode: 200,
      detail: `VULN_NO_API_AUTH: Exposed ${rows.length} user records including admin account`
    });
    return res.status(200).json({
      mode: 'VULNERABLE',
      count: rows.length,
      users: rows.map((u) => ({ ...u, balance: Number(u.balance) }))
    });
  } catch (err) {
    console.error('[VULN_USERS_ERROR]', err);
    return res.status(500).json({ error: 'Database query failed.' });
  }
});

router.get('/users/:id', async (req, res) => {
  const userId = Number.parseInt(req.params.id, 10);
  if (!Number.isInteger(userId) || userId <= 0 || String(userId) !== req.params.id) {
    return res.status(400).json({ error: 'Bad Request: Invalid user ID.' });
  }

  try {
    const { rows } = await pool.query(
      'SELECT id, username, full_name, email, account_number, balance, role, updated_at FROM users WHERE id = $1',
      [userId]
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: 'User not found.' });
    }
    await writeAuditLog({
      req,
      actor: req.session?.user?.username || 'unauthenticated',
      statusCode: 200,
      detail: `VULN_NO_API_AUTH: Exposed profile for user id=${userId} (${rows[0].username})`
    });
    return res.status(200).json({
      mode: 'VULNERABLE',
      user: { ...rows[0], balance: Number(rows[0].balance) }
    });
  } catch (err) {
    console.error('[VULN_USER_BY_ID_ERROR]', err);
    return res.status(500).json({ error: 'Database query failed.' });
  }
});

router.get('/transactions', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT t.id, t.tx_code, t.type, t.amount, t.description, t.created_at,
              u.username, u.full_name, u.account_number
       FROM transactions t
       JOIN users u ON u.id = t.user_id
       ORDER BY t.id DESC`
    );
    await writeAuditLog({
      req,
      actor: req.session?.user?.username || 'unauthenticated',
      statusCode: 200,
      detail: `VULN_NO_API_AUTH: Exposed ${rows.length} ledger transactions without authentication`
    });
    return res.status(200).json({
      mode: 'VULNERABLE',
      count: rows.length,
      transactions: rows.map((tx) => ({ ...tx, amount: Number(tx.amount) }))
    });
  } catch (err) {
    console.error('[VULN_TRANSACTIONS_ERROR]', err);
    return res.status(500).json({ error: 'Database query failed.' });
  }
});

router.get('/audit-logs', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, created_at, security_mode, client_ip, actor_username, http_method, endpoint, status_code, detail
       FROM audit_logs
       ORDER BY id DESC
       LIMIT 50`
    );
    if (req.query.ui_poll !== '1') {
      await writeAuditLog({
        req,
        actor: req.session?.user?.username || 'unauthenticated',
        statusCode: 200,
        detail: `VULN_NO_API_AUTH: Exposed ${rows.length} security audit log entries`
      });
    }
    return res.status(200).json({
      mode: 'VULNERABLE',
      count: rows.length,
      logs: rows
    });
  } catch (err) {
    console.error('[VULN_AUDIT_LOGS_ERROR]', err);
    return res.status(500).json({ error: 'Database query failed.' });
  }
});

// TOPIC 2 (VULNERABLE): Insecure Change Password Feature (CWE-620 + Client-Controlled Target)
// 1. Does not require or verify oldPassword.
// 2. Trusts req.body.username directly instead of binding strictly to req.session.user.id.
router.post('/change-password', async (req, res) => {
  try {
    if (!req.body || typeof req.body !== 'object') {
      return res.status(400).json({ error: 'Bad Request: Request body is required.' });
    }

    if (req.body.username !== undefined && typeof req.body.username !== 'string') {
      return res.status(400).json({ error: 'Bad Request: username must be a string.' });
    }

    const rawUsername = typeof req.body.username === 'string' ? req.body.username.trim() : '';
    const targetUsername = rawUsername || req.session?.user?.username || '';
    const { newPassword, confirmPassword } = req.body;

    if (!targetUsername) {
      return res.status(400).json({ error: 'Bad Request: Target username is required.' });
    }

    if (typeof newPassword !== 'string' || typeof confirmPassword !== 'string' || !newPassword || !confirmPassword) {
      return res.status(400).json({ error: 'Bad Request: newPassword and confirmPassword are required.' });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({ error: 'Bad Request: newPassword and confirmPassword do not match.' });
    }

    const newHash = await bcrypt.hash(newPassword, 10);
    const result = await pool.query(
      'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE username = $2 RETURNING id, username, role',
      [newHash, targetUsername]
    );

    const sessionActor = req.session?.user?.username || 'unauthenticated';

    if (result.rowCount === 0) {
      await writeAuditLog({
        req,
        actor: sessionActor,
        statusCode: 404,
        detail: `VULN_CHANGE_PASSWORD_NOT_FOUND: Attempted password overwrite for unknown user '${targetUsername}'`
      });
      return res.status(404).json({ error: `Not Found: User '${targetUsername}' does not exist.` });
    }

    const updated = result.rows[0];
    await writeAuditLog({
      req,
      actor: sessionActor,
      statusCode: 200,
      detail: `VULN_INSECURE_CHANGE_PASSWORD: Password overwritten for '${updated.username}' without oldPassword check (sessionActor=${sessionActor})`
    });

    return res.status(200).json({
      mode: 'VULNERABLE',
      message: `Password updated for user '${updated.username}' without oldPassword verification.`,
      updatedUser: updated
    });
  } catch (err) {
    console.error('[VULN_CHANGE_PASSWORD_ERROR]', err);
    return res.status(500).json({ error: 'Failed to update password.' });
  }
});

module.exports = router;
