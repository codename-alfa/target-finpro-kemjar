const express = require('express');
const bcrypt = require('bcryptjs');
const { pool, resetAndSeedDatabase } = require('../db');
const { getMode, setMode } = require('../middleware/securityState');
const { writeAuditLog } = require('../middleware/auditLogger');

const router = express.Router();

router.post('/login', async (req, res) => {
  try {
    const rawUsername = req.body?.username;
    const rawPassword = req.body?.password;

    if (typeof rawUsername !== 'string' || typeof rawPassword !== 'string') {
      return res.status(400).json({ error: 'Bad Request: username and password strings are required.' });
    }

    const username = rawUsername.trim();
    if (!username || !rawPassword) {
      return res.status(400).json({ error: 'Bad Request: username and password cannot be empty.' });
    }

    const { rows } = await pool.query(
      'SELECT id, username, full_name, email, account_number, balance, role, password_hash FROM users WHERE username = $1',
      [username]
    );

    if (rows.length === 0) {
      await writeAuditLog({
        req,
        actor: username,
        statusCode: 401,
        detail: `LOGIN_FAILED: Unknown username '${username}'`
      });
      return res.status(401).json({ error: 'Invalid username or password.' });
    }

    const user = rows[0];
    const match = await bcrypt.compare(rawPassword, user.password_hash);
    if (!match) {
      await writeAuditLog({
        req,
        actor: username,
        statusCode: 401,
        detail: `LOGIN_FAILED: Invalid password for '${username}'`
      });
      return res.status(401).json({ error: 'Invalid username or password.' });
    }

    const sessionUser = {
      id: user.id,
      username: user.username,
      fullName: user.full_name,
      email: user.email,
      accountNumber: user.account_number,
      role: user.role
    };

    await new Promise((resolve, reject) => {
      req.session.regenerate((regenErr) => {
        if (regenErr) return reject(regenErr);
        req.session.user = sessionUser;
        req.session.save((saveErr) => {
          if (saveErr) return reject(saveErr);
          resolve();
        });
      });
    });

    await writeAuditLog({
      req,
      actor: user.username,
      statusCode: 200,
      detail: `LOGIN_SUCCESS: Authenticated as '${user.username}' (role=${user.role})`
    });

    return res.status(200).json({
      message: 'Login successful.',
      securityMode: getMode(),
      user: {
        ...sessionUser,
        balance: Number(user.balance)
      }
    });
  } catch (err) {
    console.error('[LOGIN_ERROR]', err);
    return res.status(500).json({ error: 'Internal server error during login.' });
  }
});

router.post('/logout', async (req, res) => {
  const actor = req.session?.user?.username || 'anonymous';
  req.session.destroy(async (err) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to destroy session.' });
    }
    res.clearCookie('finvault.sid');
    await writeAuditLog({
      req,
      actor,
      statusCode: 200,
      detail: `LOGOUT: Session closed for '${actor}'`
    });
    return res.status(200).json({ message: 'Logged out successfully.' });
  });
});

router.get('/me', async (req, res) => {
  if (!req.session || !req.session.user) {
    return res.status(401).json({
      authenticated: false,
      securityMode: getMode(),
      error: 'Not authenticated.'
    });
  }

  try {
    const { rows } = await pool.query(
      'SELECT id, username, full_name, email, account_number, balance, role, updated_at FROM users WHERE id = $1',
      [req.session.user.id]
    );
    if (rows.length === 0) {
      req.session.destroy(() => {});
      return res.status(401).json({
        authenticated: false,
        securityMode: getMode(),
        error: 'Session user no longer exists.'
      });
    }

    const row = rows[0];
    return res.status(200).json({
      authenticated: true,
      securityMode: getMode(),
      user: {
        id: row.id,
        username: row.username,
        fullName: row.full_name,
        email: row.email,
        accountNumber: row.account_number,
        balance: Number(row.balance),
        role: row.role,
        updatedAt: row.updated_at
      }
    });
  } catch (err) {
    console.error('[ME_ERROR]', err);
    return res.status(500).json({ error: 'Failed to load profile.' });
  }
});

router.get('/admin/status', (req, res) => {
  return res.status(200).json({
    securityMode: getMode(),
    host: process.env.HOST || '0.0.0.0',
    port: Number(process.env.PORT || 5000)
  });
});

router.post('/admin/toggle-mode', async (req, res) => {
  try {
    const requested = req.body?.mode;
    const nextMode = requested
      ? setMode(requested)
      : setMode(getMode() === 'VULNERABLE' ? 'SECURE' : 'VULNERABLE');

    await writeAuditLog({
      req,
      actor: req.session?.user?.username || 'demo-operator',
      statusCode: 200,
      detail: `MODE_SWITCHED: Security mode set to ${nextMode}`
    });

    return res.status(200).json({
      securityMode: nextMode,
      message: `Security mode switched to ${nextMode}.`
    });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

router.post('/admin/reset-demo', async (req, res) => {
  try {
    const summary = await resetAndSeedDatabase();
    await writeAuditLog({
      req,
      actor: req.session?.user?.username || 'demo-operator',
      statusCode: 200,
      detail: `DEMO_DB_RESET: Restored ${summary.seededUsers} accounts and ${summary.seededTransactions} transactions`
    });

    return res.status(200).json({
      message: 'Demo database reset to initial credentials and balances.',
      securityMode: getMode(),
      ...summary
    });
  } catch (err) {
    console.error('[RESET_DEMO_ERROR]', err);
    return res.status(500).json({ error: 'Failed to reset demo database.' });
  }
});

module.exports = router;
