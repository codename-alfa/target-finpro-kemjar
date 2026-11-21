require('dotenv').config();
const path = require('path');
const express = require('express');
const session = require('express-session');
const { initDatabase } = require('./db');
const { getMode } = require('./middleware/securityState');
const authRoutes = require('./routes/authRoutes');
const vulnRouter = require('./routes/vuln');
const secureRouter = require('./routes/secure');

const PORT = Number(process.env.PORT || 5000);
const HOST = process.env.HOST || '0.0.0.0';

const app = express();

app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: true, limit: '100kb' }));

app.use((err, req, res, next) => {
  if (err && err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Bad Request: Malformed JSON payload.' });
  }
  return next(err);
});

app.use(
  session({
    name: 'finvault.sid',
    secret: process.env.SESSION_SECRET || 'finvault-kemjar-b20-secret',
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: false,
      maxAge: 2 * 60 * 60 * 1000
    }
  })
);

// Stage 2: Enumeration breadcrumbs for nmap http-robots.txt, ffuf/gobuster, and OWASP ZAP
app.get('/robots.txt', (req, res) => {
  res.type('text/plain').send(
    [
      'User-agent: *',
      'Disallow: /api/',
      'Disallow: /api/users',
      'Disallow: /api/transactions',
      'Disallow: /api/audit-logs',
      'Disallow: /change-password'
    ].join('\n')
  );
});

app.get('/api', (req, res) => {
  return res.status(200).json({
    service: 'FinVault E-Wallet Portal API',
    securityMode: getMode(),
    endpoints: [
      'POST /api/login',
      'POST /api/logout',
      'GET /api/me',
      'GET /api/users',
      'GET /api/users/:id',
      'GET /api/transactions',
      'GET /api/audit-logs',
      'POST /api/change-password',
      'GET /api/admin/status',
      'POST /api/admin/toggle-mode',
      'POST /api/admin/reset-demo'
    ]
  });
});

app.use('/api', authRoutes);
app.use('/api', (req, res, next) => {
  const activeRouter = getMode() === 'SECURE' ? secureRouter : vulnRouter;
  return activeRouter(req, res, next);
});

const publicDir = path.join(__dirname, 'public');
app.use(express.static(publicDir));

app.get('/', (req, res) => {
  return res.sendFile(path.join(publicDir, 'login.html'));
});

app.get('/login', (req, res) => {
  return res.sendFile(path.join(publicDir, 'login.html'));
});

app.get('/dashboard', (req, res) => {
  return res.sendFile(path.join(publicDir, 'dashboard.html'));
});

app.get('/change-password', (req, res) => {
  return res.sendFile(path.join(publicDir, 'change-password.html'));
});

async function startServer(port = PORT, host = HOST) {
  await initDatabase();
  return new Promise((resolve) => {
    const server = app.listen(port, host, () => {
      console.log(`FinVault Portal running at http://${host}:${port} [mode=${getMode()}]`);
      resolve(server);
    });
  });
}

if (require.main === module) {
  startServer().catch((err) => {
    console.error('[STARTUP_ERROR]', err);
    process.exit(1);
  });
}

module.exports = {
  app,
  startServer
};
