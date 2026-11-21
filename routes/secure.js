const express = require('express');
const bcrypt = require('bcryptjs');
const { pool } = require('../db');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { writeAuditLog } = require('../middleware/auditLogger');

const router = express.Router();

// TOPIC 1 (REMEDIATED): Protected by session authentication (401) and admin RBAC (403)
router.get('/users', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT id, username, full_name, email, account_number, balance, role, updated_at FROM users ORDER BY id ASC'
    );
    await writeAuditLog({
      req,
      actor: req.session.user.username,
      statusCode: 200,
      detail: `SECURE_API_ACCESS: Authorized admin fetched ${rows.length} user records`
    });
    return res.status(200).json({
      mode: 'SECURE',
      count: rows.length,
      users: rows.map((u) => ({ ...u, balance: Number(u.balance) }))
    });
  } catch (err) {
    console.error('[SECURE_USERS_ERROR]', err);
    return res.status(500).json({ error: 'Database query failed.' });
  }
});

router.get('/users/:id', requireAuth, async (req, res) => {
  const userId = Number.parseInt(req.params.id, 10);
  if (!Number.isInteger(userId) || userId <= 0 || String(userId) !== req.params.id) {
    return res.status(400).json({ error: 'Bad Request: Invalid user ID.' });
  }

  const sessionUser = req.session.user;
  if (sessionUser.role !== 'admin' && sessionUser.id !== userId) {
    await writeAuditLog({
      req,
      actor: sessionUser.username,
      statusCode: 403,
      detail: `SECURE_DENIED_IDOR: User '${sessionUser.username}' blocked from reading profile id=${userId}`
    });
    return res.status(403).json({
      mode: 'SECURE',
      error: 'Forbidden: You may only access your own profile.'
    });
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
      actor: sessionUser.username,
      statusCode: 200,
      detail: `SECURE_API_ACCESS: Authorized profile read for user id=${userId}`
    });
    return res.status(200).json({
      mode: 'SECURE',
      user: { ...rows[0], balance: Number(rows[0].balance) }
    });
  } catch (err) {
    console.error('[SECURE_USER_BY_ID_ERROR]', err);
    return res.status(500).json({ error: 'Database query failed.' });
  }
});

router.get('/transactions', requireAuth, async (req, res) => {
  const sessionUser = req.session.user;
  try {
    const isAdmin = sessionUser.role === 'admin';
    const queryText = isAdmin
      ? `SELECT t.id, t.tx_code, t.type, t.amount, t.description, t.created_at,
                u.username, u.full_name, u.account_number
         FROM transactions t
         JOIN users u ON u.id = t.user_id
         ORDER BY t.id DESC`
      : `SELECT t.id, t.tx_code, t.type, t.amount, t.description, t.created_at,
                u.username, u.full_name, u.account_number
         FROM transactions t
         JOIN users u ON u.id = t.user_id
         WHERE t.user_id = $1
         ORDER BY t.id DESC`;

    const { rows } = isAdmin
      ? await pool.query(queryText)
      : await pool.query(queryText, [sessionUser.id]);

    await writeAuditLog({
      req,
      actor: sessionUser.username,
      statusCode: 200,
      detail: `SECURE_API_ACCESS: Returned ${rows.length} scoped transactions for '${sessionUser.username}'`
    });
    return res.status(200).json({
      mode: 'SECURE',
      count: rows.length,
      transactions: rows.map((tx) => ({ ...tx, amount: Number(tx.amount) }))
    });
  } catch (err) {
    console.error('[SECURE_TRANSACTIONS_ERROR]', err);
    return res.status(500).json({ error: 'Database query failed.' });
  }
});

router.get('/audit-logs', requireAuth, requireAdmin, async (req, res) => {
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
        actor: req.session.user.username,
        statusCode: 200,
        detail: `SECURE_API_ACCESS: Authorized admin read ${rows.length} security audit logs`
      });
    }
    return res.status(200).json({
      mode: 'SECURE',
      count: rows.length,
      logs: rows
    });
  } catch (err) {
    console.error('[SECURE_AUDIT_LOGS_ERROR]', err);
    return res.status(500).json({ error: 'Database query failed.' });
  }
});

// TOPIC 2 (REMEDIATED): Defense-in-Depth Change Password
// 1. Requires authenticated session (requireAuth).
// 2. Rejects cross-account username tampering (403) and binds UPDATE strictly to req.session.user.id.
// 3. Requires and verifies oldPassword via bcrypt.compare.
// 4. Enforces password policy (>= 8 chars, newPassword !== oldPassword) and regenerates session.
router.post('/change-password', requireAuth, async (req, res) => {
  const sessionUser = req.session.user;

  try {
    if (!req.body || typeof req.body !== 'object') {
      return res.status(400).json({ mode: 'SECURE', error: 'Bad Request: Request body is required.' });
    }

    if (req.body.username !== undefined && typeof req.body.username !== 'string') {
      return res.status(400).json({ mode: 'SECURE', error: 'Bad Request: username must be a string.' });
    }

    const tamperedUsername = typeof req.body.username === 'string' ? req.body.username.trim() : '';
    if (tamperedUsername && tamperedUsername !== sessionUser.username) {
      await writeAuditLog({
        req,
        actor: sessionUser.username,
        statusCode: 403,
        detail: `SECURE_BLOCKED_ATO: Blocked attempt to change password for '${tamperedUsername}' from session '${sessionUser.username}'`
      });
      return res.status(403).json({
        mode: 'SECURE',
        error: 'Forbidden: Cannot modify password for another user account.'
      });
    }

    const { oldPassword, newPassword, confirmPassword } = req.body;
    if (typeof oldPassword !== 'string' || !oldPassword) {
      await writeAuditLog({
        req,
        actor: sessionUser.username,
        statusCode: 400,
        detail: 'SECURE_REJECTED_MISSING_OLDPASS: Missing current password (oldPassword)'
      });
      return res.status(400).json({
        mode: 'SECURE',
        error: 'Bad Request: Current password (oldPassword) is required.'
      });
    }

    if (typeof newPassword !== 'string' || typeof confirmPassword !== 'string' || !newPassword || !confirmPassword) {
      return res.status(400).json({
        mode: 'SECURE',
        error: 'Bad Request: newPassword and confirmPassword are required.'
      });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({
        mode: 'SECURE',
        error: 'Bad Request: New password must be at least 8 characters long.'
      });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({
        mode: 'SECURE',
        error: 'Bad Request: newPassword and confirmPassword do not match.'
      });
    }

    if (newPassword === oldPassword) {
      return res.status(400).json({
        mode: 'SECURE',
        error: 'Bad Request: New password must differ from current password.'
      });
    }

    const { rows } = await pool.query(
      'SELECT id, username, full_name, email, account_number, role, password_hash FROM users WHERE id = $1',
      [sessionUser.id]
    );
    if (rows.length === 0) {
      return res.status(401).json({ mode: 'SECURE', error: 'Unauthorized: Account not found.' });
    }

    const dbUser = rows[0];
    const oldMatches = await bcrypt.compare(oldPassword, dbUser.password_hash);
    if (!oldMatches) {
      await writeAuditLog({
        req,
        actor: sessionUser.username,
        statusCode: 401,
        detail: `SECURE_INVALID_OLD_PASSWORD: Incorrect oldPassword provided for '${sessionUser.username}'`
      });
      return res.status(401).json({
        mode: 'SECURE',
        error: 'Unauthorized: Current password (oldPassword) is incorrect.'
      });
    }

    const newHash = await bcrypt.hash(newPassword, 10);
    await pool.query(
      'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2',
      [newHash, dbUser.id]
    );

    const preservedUser = {
      id: dbUser.id,
      username: dbUser.username,
      fullName: dbUser.full_name,
      email: dbUser.email,
      accountNumber: dbUser.account_number,
      role: dbUser.role
    };

    await new Promise((resolve, reject) => {
      req.session.regenerate((regenErr) => {
        if (regenErr) return reject(regenErr);
        req.session.user = preservedUser;
        req.session.save((saveErr) => {
          if (saveErr) return reject(saveErr);
          resolve();
        });
      });
    });

    await writeAuditLog({
      req,
      actor: dbUser.username,
      statusCode: 200,
      detail: `SECURE_PASSWORD_UPDATED: Password updated after oldPassword check and session rotated for '${dbUser.username}'`
    });

    return res.status(200).json({
      mode: 'SECURE',
      message: 'Password updated securely. Active session rotated.',
      updatedUser: { id: dbUser.id, username: dbUser.username, role: dbUser.role }
    });
  } catch (err) {
    console.error('[SECURE_CHANGE_PASSWORD_ERROR]', err);
    return res.status(500).json({ error: 'Failed to update password.' });
  }
});

module.exports = router;
