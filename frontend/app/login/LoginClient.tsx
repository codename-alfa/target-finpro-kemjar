"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useApp } from "../context/AppContext";
import { apiJson } from "../lib/api";
import { GlobalBanner } from "../components/GlobalBanner";
import { Footer } from "../components/Footer";
import { AuditTable, AuditLogEntry } from "../components/AuditTable";
import { useAsyncResource } from "../hooks/useAsyncResource";

export function LoginClient() {
  const router = useRouter();
  const { syncControlBar, registerRefreshHandler } = useApp();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    data: auditLogs,
    loading: auditLoading,
    error: auditError,
    run: runAudit,
  } = useAsyncResource<AuditLogEntry[]>();

  const loadAuditPreview = useCallback(() => {
    void runAudit<{ logs?: AuditLogEntry[]; error?: string }>(
      () => apiJson("/api/audit-logs?ui_poll=1"),
      (body) => (body.logs || []).slice(0, 8),
      (status) =>
        `Audit log endpoint protected (HTTP ${status}). Sign in as admin to view logs in SECURE mode.`
    );
  }, [runAudit]);

  useEffect(() => {
    loadAuditPreview();
    return registerRefreshHandler(loadAuditPreview);
  }, [loadAuditPreview, registerRefreshHandler]);

  const fillAccount = (demoUsername: string, demoPassword: string) => {
    setUsername(demoUsername);
    setPassword(demoPassword);
    setFeedback(null);
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setFeedback(null);

    try {
      const res = await apiJson<{ user?: { username: string; role: string }; error?: string }>(
        "/api/login",
        {
          method: "POST",
          body: JSON.stringify({ username, password }),
        }
      );

      if (res.ok) {
        await syncControlBar();
        router.push("/dashboard");
        return;
      }

      setFeedback(res.data.error || "Authentication failed.");
      loadAuditPreview();
    } catch {
      setFeedback("Network or server error during sign in.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <main className="container main-content">
        <div className="page-header">
          <div>
            <h1>FinVault E-Wallet Portal</h1>
            <p className="page-header__desc">
              Custom penetration testing target for Topic B20 (No API Authentication and Insecure Change Password Feature).
            </p>
          </div>
        </div>

        <GlobalBanner />

        <section className="panels panels--split" aria-label="Authentication workspace">
          <div className="panel">
            <div className="panel__head">
              <h2>Account sign in</h2>
            </div>
            <p className="panel__sub">
              Authenticate with a seeded customer or administrator account to start a session cookie.
            </p>

            <form id="loginForm" className="form-grid" onSubmit={handleLoginSubmit} noValidate>
              <div className="field">
                <label htmlFor="usernameInput" className="field__label">
                  Username
                </label>
                <input
                  id="usernameInput"
                  name="username"
                  type="text"
                  className="field__input"
                  autoComplete="username"
                  placeholder="danish"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                />
              </div>

              <div className="field">
                <label htmlFor="passwordInput" className="field__label">
                  Password
                </label>
                <input
                  id="passwordInput"
                  name="password"
                  type="password"
                  className="field__input"
                  autoComplete="current-password"
                  placeholder="Enter account password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>

              {feedback && (
                <div id="loginFeedback" className="status-banner status-banner--bad" role="alert">
                  {feedback}
                </div>
              )}

              <div className="actions-row">
                <button
                  id="loginSubmitBtn"
                  type="submit"
                  className="btn btn--primary"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? "Signing in…" : "Sign in"}
                </button>
                <Link href="/dashboard" className="btn">
                  Open dashboard
                </Link>
              </div>
            </form>
          </div>

          <div className="panel panel--deep">
            <div className="panel__head">
              <h2>Seeded test accounts</h2>
            </div>
            <p className="panel__sub">
              Use these accounts to test privilege boundaries and chained Account Takeover.
            </p>

            <div className="credential-list">
              <div className="credential-item">
                <div>
                  <div className="measured">danish (customer)</div>
                  <div className="field__hint measured">DanishPass123</div>
                </div>
                <button
                  type="button"
                  className="btn"
                  onClick={() => fillAccount("danish", "DanishPass123")}
                >
                  Fill customer
                </button>
              </div>
              <div className="credential-item">
                <div>
                  <div className="measured">budi (customer)</div>
                  <div className="field__hint measured">BudiWallet123</div>
                </div>
                <button
                  type="button"
                  className="btn"
                  onClick={() => fillAccount("budi", "BudiWallet123")}
                >
                  Fill budi
                </button>
              </div>
              <div className="credential-item">
                <div>
                  <div className="measured">admin (administrator)</div>
                  <div className="field__hint measured">AdminVault#2026</div>
                </div>
                <button
                  type="button"
                  className="btn"
                  onClick={() => fillAccount("admin", "AdminVault#2026")}
                >
                  Fill admin
                </button>
              </div>
            </div>
          </div>
        </section>

        <section className="panels" aria-label="Security audit preview">
          <div className="panel">
            <div className="panel__head">
              <h2>Live security audit trail</h2>
              <button
                id="refreshLoginAuditBtn"
                type="button"
                className="btn"
                disabled={auditLoading}
                onClick={loadAuditPreview}
              >
                Refresh logs
              </button>
            </div>
            <AuditTable
              logs={auditLogs || []}
              loading={auditLoading}
              errorMessage={auditError}
              emptyMessage="No audit log entries recorded yet."
            />
          </div>
        </section>
      </main>

      <Footer detail="Kelompok 12" />
    </>
  );
}
