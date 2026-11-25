require('dotenv').config();
const fs = require('fs');
const http = require('http');
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

function createApp() {
  const app = express();
  app.set('trust proxy', 1);

  const apiSession = session({
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
  });

  app.use('/api', express.json({ limit: '100kb' }));
  app.use('/api', express.urlencoded({ extended: true, limit: '100kb' }));
  app.use('/api', (err, req, res, next) => {
    if (err && err.type === 'entity.parse.failed') {
      return res.status(400).json({ error: 'Bad Request: Malformed JSON payload.' });
    }
    if (err && err.type === 'entity.too.large') {
      return res.status(413).json({ error: 'Payload Too Large: Maximum request body size is 100kb.' });
    }
    return next(err);
  });
  app.use('/api', apiSession);

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
  app.all('/robots.txt', (req, res) => {
    return res.status(405).type('text/plain').send('Method Not Allowed');
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
  app.use('/api', (req, res) => {
    return res.status(404).json({ error: 'Not Found: Unknown API endpoint.' });
  });

  return app;
}

async function startServer(port = PORT, host = HOST, options = {}) {
  const withFrontend = options.withFrontend ?? (process.env.DISABLE_NEXT !== 'true');
  const app = createApp();
  const httpServer = http.createServer(app);
  let nextApp = null;

  if (withFrontend) {
    const frontendDir = path.join(__dirname, 'frontend');
    const hasBuild = fs.existsSync(path.join(frontendDir, '.next', 'BUILD_ID'));
    const dev = process.env.NEXT_DEV === 'true' || !hasBuild;

    process.env.UNIFIED_SERVER = 'true';
    process.env.NODE_ENV = dev ? 'development' : 'production';

    const nextModulePath = require.resolve('next', { paths: [frontendDir] });
    const next = require(nextModulePath);
    const nextHostname = host === '0.0.0.0' ? 'localhost' : host;

    nextApp = next({ dev, dir: frontendDir, hostname: nextHostname, port, httpServer });
    await nextApp.prepare();
    const handle = nextApp.getRequestHandler();

    app.use((req, res, nextFn) => {
      Promise.resolve(handle(req, res)).catch(nextFn);
    });

    const originalClose = httpServer.close.bind(httpServer);
    httpServer.close = (cb) => {
      const currentNext = nextApp;
      nextApp = null;
      if (currentNext) {
        void currentNext.close().finally(() => originalClose(cb));
        return httpServer;
      }
      return originalClose(cb);
    };
  } else {
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
  }

  await initDatabase();
  return new Promise((resolve, reject) => {
    httpServer.once('error', reject);
    httpServer.listen(port, host, () => {
      httpServer.removeListener('error', reject);
      console.log(
        `FinVault Portal running at http://${host}:${port} [mode=${getMode()}, frontend=${withFrontend ? 'next' : 'static'}]`
      );
      resolve(httpServer);
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
  app: createApp(),
  createApp,
  startServer
};
