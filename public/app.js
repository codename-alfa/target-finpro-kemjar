(function () {
  function formatIDR(amount) {
    const num = Number(amount || 0);
    return 'Rp ' + num.toLocaleString('id-ID');
  }

  function formatTime(iso) {
    if (!iso) return '-';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return String(iso);
    return d.toISOString().replace('T', ' ').slice(0, 19) + 'Z';
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  async function apiJson(url, options = {}) {
    const res = await fetch(url, {
      credentials: 'same-origin',
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {})
      },
      ...options
    });
    let data = {};
    try {
      data = await res.json();
    } catch (_) {
      data = {};
    }
    return { status: res.status, ok: res.ok, data };
  }

  function renderModeBadge(mode) {
    const badge = document.getElementById('modeBadge');
    const toggleBtn = document.getElementById('toggleModeBtn');
    if (!badge) return;
    const isSecure = mode === 'SECURE';
    badge.textContent = isSecure ? 'Mode: SECURE' : 'Mode: VULNERABLE';
    badge.className = 'chip ' + (isSecure ? 'chip--secure' : 'chip--vuln');
    if (toggleBtn) {
      toggleBtn.textContent = isSecure ? 'Switch to VULNERABLE' : 'Switch to SECURE';
    }
  }

  function showGlobalMessage(text, tone = 'cool') {
    const el = document.getElementById('globalBanner');
    if (!el) return;
    el.hidden = false;
    el.className = 'status-banner status-banner--' + tone;
    el.textContent = text;
  }

  async function syncControlBar() {
    const statusRes = await apiJson('/api/admin/status');
    if (statusRes.ok) {
      renderModeBadge(statusRes.data.securityMode);
    }
    const meRes = await apiJson('/api/me');
    const logoutBtn = document.getElementById('logoutBtn');
    const sessionChip = document.getElementById('sessionChip');
    if (meRes.ok && meRes.data.authenticated) {
      if (logoutBtn) logoutBtn.hidden = false;
      if (sessionChip) {
        sessionChip.hidden = false;
        sessionChip.textContent = meRes.data.user.username + ' (' + meRes.data.user.role + ')';
      }
      return { securityMode: meRes.data.securityMode, user: meRes.data.user };
    }
    if (logoutBtn) logoutBtn.hidden = true;
    if (sessionChip) sessionChip.hidden = true;
    return { securityMode: statusRes.data?.securityMode || 'VULNERABLE', user: null };
  }

  function wireControlBar(onStateChange) {
    const toggleBtn = document.getElementById('toggleModeBtn');
    const resetBtn = document.getElementById('resetDbBtn');
    const logoutBtn = document.getElementById('logoutBtn');

    if (toggleBtn) {
      toggleBtn.addEventListener('click', async () => {
        toggleBtn.disabled = true;
        const res = await apiJson('/api/admin/toggle-mode', { method: 'POST', body: '{}' });
        toggleBtn.disabled = false;
        if (res.ok) {
          renderModeBadge(res.data.securityMode);
          showGlobalMessage('Security mode changed to ' + res.data.securityMode + '.', res.data.securityMode === 'SECURE' ? 'ok' : 'bad');
          if (typeof onStateChange === 'function') onStateChange();
        } else {
          showGlobalMessage(res.data.error || 'Failed to switch security mode.', 'bad');
        }
      });
    }

    if (resetBtn) {
      resetBtn.addEventListener('click', async () => {
        resetBtn.disabled = true;
        const res = await apiJson('/api/admin/reset-demo', { method: 'POST', body: '{}' });
        resetBtn.disabled = false;
        if (res.ok) {
          showGlobalMessage('Demo database reset to initial seeded credentials and balances.', 'ok');
          if (typeof onStateChange === 'function') onStateChange();
        } else {
          showGlobalMessage(res.data.error || 'Failed to reset demo database.', 'bad');
        }
      });
    }

    if (logoutBtn) {
      logoutBtn.addEventListener('click', async () => {
        logoutBtn.disabled = true;
        await apiJson('/api/logout', { method: 'POST', body: '{}' });
        window.location.href = '/login';
      });
    }
  }

  function renderAuditRows(tbody, logs) {
    if (!logs || logs.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" class="empty-state">No audit log entries recorded yet.</td></tr>';
      return;
    }
    tbody.innerHTML = logs.map((entry) => {
      const rowClass = entry.security_mode === 'SECURE' ? 'row--secure' : 'row--vuln';
      const chipClass = entry.security_mode === 'SECURE' ? 'chip--secure' : 'chip--vuln';
      return (
        '<tr class="' + rowClass + '">' +
          '<td class="measured">' + escapeHtml(formatTime(entry.created_at)) + '</td>' +
          '<td><span class="chip ' + chipClass + '">' + escapeHtml(entry.security_mode) + '</span></td>' +
          '<td class="measured">' + escapeHtml(entry.http_method + ' ' + entry.endpoint) + '</td>' +
          '<td class="measured">' + escapeHtml(entry.actor_username) + ' (' + escapeHtml(entry.status_code) + ')</td>' +
          '<td class="measured">' + escapeHtml(entry.detail) + '</td>' +
        '</tr>'
      );
    }).join('');
  }

  async function initLoginPage() {
    await syncControlBar();
    const form = document.getElementById('loginForm');
    const feedback = document.getElementById('loginFeedback');
    const auditBody = document.getElementById('loginAuditBody');
    const refreshAuditBtn = document.getElementById('refreshLoginAuditBtn');

    async function loadAuditPreview() {
      if (!auditBody) return;
      const res = await apiJson('/api/audit-logs?ui_poll=1');
      if (res.ok) {
        renderAuditRows(auditBody, (res.data.logs || []).slice(0, 8));
      } else {
        auditBody.innerHTML = '<tr><td colspan="5" class="empty-state">Audit log endpoint protected (' + res.status + '). Sign in as admin to view logs in SECURE mode.</td></tr>';
      }
    }

    wireControlBar(loadAuditPreview);
    await loadAuditPreview();

    if (refreshAuditBtn) {
      refreshAuditBtn.addEventListener('click', loadAuditPreview);
    }

    document.querySelectorAll('[data-fill-user]').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.getElementById('usernameInput').value = btn.getAttribute('data-fill-user');
        document.getElementById('passwordInput').value = btn.getAttribute('data-fill-pass');
        feedback.hidden = true;
      });
    });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const submitBtn = document.getElementById('loginSubmitBtn');
      const username = document.getElementById('usernameInput').value;
      const password = document.getElementById('passwordInput').value;
      submitBtn.disabled = true;
      feedback.hidden = true;

      const res = await apiJson('/api/login', {
        method: 'POST',
        body: JSON.stringify({ username, password })
      });
      submitBtn.disabled = false;

      if (res.ok) {
        window.location.href = '/dashboard';
        return;
      }

      feedback.hidden = false;
      feedback.className = 'status-banner status-banner--bad';
      feedback.textContent = res.data.error || 'Authentication failed.';
      await loadAuditPreview();
    });
  }

  async function initDashboardPage() {
    const state = await syncControlBar();

    async function refreshAll() {
      const latest = await syncControlBar();
      const profileStatus = document.getElementById('profileStatus');
      const balanceEl = document.getElementById('walletBalance');
      const acctEl = document.getElementById('walletAccount');
      const roleChip = document.getElementById('walletRole');
      const userNameEl = document.getElementById('walletFullName');

      if (latest.user) {
        profileStatus.hidden = true;
        balanceEl.textContent = formatIDR(latest.user.balance);
        acctEl.textContent = latest.user.accountNumber;
        roleChip.textContent = latest.user.role;
        userNameEl.textContent = latest.user.fullName + ' (' + latest.user.username + ')';
      } else {
        profileStatus.hidden = false;
        profileStatus.className = 'status-banner status-banner--cool';
        profileStatus.textContent = 'Not signed in. API endpoints below remain directly observable in VULNERABLE mode for Stage 3 testing.';
        balanceEl.textContent = 'Rp 0';
        acctEl.textContent = 'No active session';
        roleChip.textContent = 'anonymous';
        userNameEl.textContent = 'Guest visitor';
      }

      await Promise.all([loadTransactions(), loadUsersDirectory(), loadAuditLogs()]);
    }

    async function loadTransactions() {
      const box = document.getElementById('txStateContainer');
      box.innerHTML = '<div class="panel"><div class="skeleton-line"></div><div class="skeleton-line"></div></div>';
      const res = await apiJson('/api/transactions');
      if (!res.ok) {
        box.innerHTML =
          '<div class="status-banner status-banner--bad">HTTP ' + res.status + ': ' + escapeHtml(res.data.error || 'Failed to load transactions') + '</div>';
        return;
      }
      const rows = res.data.transactions || [];
      if (rows.length === 0) {
        box.innerHTML = '<div class="empty-state">No ledger transactions found for this scope.</div>';
        return;
      }
      box.innerHTML =
        '<div class="table-scroll"><table class="data-table"><thead><tr>' +
          '<th>Transaction ID</th><th>Account</th><th>Type</th><th>Amount</th><th>Description</th>' +
        '</tr></thead><tbody>' +
        rows.map((tx) => {
          const typeChip = tx.type === 'CREDIT' ? 'chip--secure' : 'chip--amber';
          return (
            '<tr>' +
              '<td class="measured">' + escapeHtml(tx.tx_code) + '</td>' +
              '<td class="measured">' + escapeHtml(tx.username + ' (' + tx.account_number + ')') + '</td>' +
              '<td><span class="chip ' + typeChip + '">' + escapeHtml(tx.type) + '</span></td>' +
              '<td class="measured">' + escapeHtml(formatIDR(tx.amount)) + '</td>' +
              '<td>' + escapeHtml(tx.description) + '</td>' +
            '</tr>'
          );
        }).join('') +
        '</tbody></table></div>';
    }

    async function loadUsersDirectory() {
      const box = document.getElementById('usersStateContainer');
      const statusChip = document.getElementById('usersApiChip');
      box.innerHTML = '<div class="panel"><div class="skeleton-line"></div><div class="skeleton-line"></div></div>';
      const res = await apiJson('/api/users');
      if (statusChip) {
        statusChip.textContent = 'HTTP ' + res.status;
        statusChip.className = 'chip ' + (res.ok ? 'chip--vuln' : 'chip--secure');
      }
      if (!res.ok) {
        box.innerHTML =
          '<div class="status-banner status-banner--ok">Access blocked with HTTP ' + res.status + ': ' + escapeHtml(res.data.error) + '</div>';
        return;
      }
      const users = res.data.users || [];
      if (users.length === 0) {
        box.innerHTML = '<div class="empty-state">No accounts found.</div>';
        return;
      }
      box.innerHTML =
        '<div class="table-scroll"><table class="data-table"><thead><tr>' +
          '<th>ID</th><th>Username</th><th>Full name</th><th>Account number</th><th>Balance</th><th>Role</th>' +
        '</tr></thead><tbody>' +
        users.map((u) => (
          '<tr>' +
            '<td class="measured">' + escapeHtml(u.id) + '</td>' +
            '<td class="measured">' + escapeHtml(u.username) + '</td>' +
            '<td>' + escapeHtml(u.full_name) + '</td>' +
            '<td class="measured">' + escapeHtml(u.account_number) + '</td>' +
            '<td class="measured">' + escapeHtml(formatIDR(u.balance)) + '</td>' +
            '<td><span class="chip ' + (u.role === 'admin' ? 'chip--amber' : 'chip--cool') + '">' + escapeHtml(u.role) + '</span></td>' +
          '</tr>'
        )).join('') +
        '</tbody></table></div>';
    }

    async function loadAuditLogs() {
      const box = document.getElementById('auditStateContainer');
      const statusChip = document.getElementById('auditApiChip');
      const res = await apiJson('/api/audit-logs?ui_poll=1');
      if (statusChip) {
        statusChip.textContent = 'HTTP ' + res.status;
        statusChip.className = 'chip ' + (res.ok ? 'chip--cool' : 'chip--secure');
      }
      if (!res.ok) {
        box.innerHTML =
          '<div class="status-banner status-banner--ok">Audit endpoint blocked with HTTP ' + res.status + ': ' + escapeHtml(res.data.error) + '</div>';
        return;
      }
      box.innerHTML =
        '<div class="table-scroll"><table class="data-table"><thead><tr>' +
          '<th>Timestamp</th><th>Mode</th><th>Request</th><th>Actor (Status)</th><th>Detail</th>' +
        '</tr></thead><tbody id="dashboardAuditTbody"></tbody></table></div>';
      renderAuditRows(document.getElementById('dashboardAuditTbody'), res.data.logs || []);
    }

    wireControlBar(refreshAll);
    const probeUsersBtn = document.getElementById('probeUsersBtn');
    const refreshAuditBtn = document.getElementById('refreshAuditBtn');
    if (probeUsersBtn) probeUsersBtn.addEventListener('click', async () => { await loadUsersDirectory(); await loadAuditLogs(); });
    if (refreshAuditBtn) refreshAuditBtn.addEventListener('click', loadAuditLogs);

    if (state.securityMode) {
      await refreshAll();
    }
  }

  async function initChangePasswordPage() {
    const form = document.getElementById('changePasswordForm');
    const targetInput = document.getElementById('targetUsernameInput');
    const oldPassInput = document.getElementById('oldPasswordInput');
    const oldPassHint = document.getElementById('oldPasswordHint');
    const targetHint = document.getElementById('targetUsernameHint');
    const modeExplainer = document.getElementById('changePassModeBanner');
    const feedback = document.getElementById('changePassFeedback');
    const reqPreview = document.getElementById('reqPayloadPreview');
    const resPreview = document.getElementById('resPayloadPreview');

    async function syncFormBehavior() {
      const state = await syncControlBar();
      if (state.user && !targetInput.value) {
        targetInput.value = state.user.username;
      }
      if (state.securityMode === 'SECURE') {
        modeExplainer.className = 'status-banner status-banner--ok';
        modeExplainer.textContent = 'SECURE mode active: Requires valid session, oldPassword verification, >= 8 char policy, and rejects cross-user username tampering (403).';
        oldPassHint.textContent = 'Required and verified against bcrypt hash in PostgreSQL.';
        targetHint.textContent = 'Server binds updates to your session ID. Tampering this field to another user triggers 403 Forbidden.';
      } else {
        modeExplainer.className = 'status-banner status-banner--bad';
        modeExplainer.textContent = 'VULNERABLE mode active: CWE-620 omits oldPassword verification and trusts the client-supplied username parameter directly.';
        oldPassHint.textContent = 'Ignored by backend in VULNERABLE mode (leave blank to verify CWE-620).';
        targetHint.textContent = 'Editable for demo: try changing to "admin" after leaking /api/users to perform Chained Account Takeover.';
      }
      updateRequestPreview();
    }

    function buildPayload() {
      const payload = {
        username: targetInput.value.trim(),
        newPassword: document.getElementById('newPasswordInput').value,
        confirmPassword: document.getElementById('confirmPasswordInput').value
      };
      if (oldPassInput.value.length > 0) {
        payload.oldPassword = oldPassInput.value;
      }
      return payload;
    }

    function updateRequestPreview() {
      const payload = buildPayload();
      reqPreview.textContent = 'POST /api/change-password\nContent-Type: application/json\n\n' + JSON.stringify(payload, null, 2);
    }

    wireControlBar(syncFormBehavior);
    await syncFormBehavior();

    form.addEventListener('input', updateRequestPreview);

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const submitBtn = document.getElementById('changePassSubmitBtn');
      const payload = buildPayload();
      submitBtn.disabled = true;
      feedback.hidden = true;

      const res = await apiJson('/api/change-password', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      submitBtn.disabled = false;

      resPreview.textContent = 'HTTP ' + res.status + '\n\n' + JSON.stringify(res.data, null, 2);
      feedback.hidden = false;
      feedback.className = 'status-banner ' + (res.ok ? 'status-banner--ok' : 'status-banner--bad');
      feedback.textContent = res.ok
        ? (res.data.message || 'Password updated.')
        : ('HTTP ' + res.status + ': ' + (res.data.error || 'Password update failed.'));
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    const page = document.body.getAttribute('data-page');
    if (page === 'login') initLoginPage();
    else if (page === 'dashboard') initDashboardPage();
    else if (page === 'change-password') initChangePasswordPage();
  });
})();
