"use client";

import React, { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { useApp } from "../context/AppContext";
import { apiJson } from "../lib/api";
import { GlobalBanner } from "../components/GlobalBanner";
import { Footer } from "../components/Footer";
import { AccountSummary } from "../components/AccountSummary";

export function ProfileClient() {
  const { user, securityMode, registerRefreshHandler } = useApp();
  const isSecure = securityMode === "SECURE";

  const [customTarget, setCustomTarget] = useState<string | null>(null);
  const targetUsername = customTarget ?? user?.username ?? "";

  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [lastSubmittedPayload, setLastSubmittedPayload] = useState<Record<string, string> | null>(
    null
  );
  const [lastResponse, setLastResponse] = useState<{ status: number; data: unknown } | null>(null);
  const [feedback, setFeedback] = useState<{ text: string; tone: "ok" | "bad" } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    return registerRefreshHandler(() => {
      setCustomTarget(null);
      setLastSubmittedPayload(null);
    });
  }, [registerRefreshHandler]);

  const outgoingPayload = useMemo(() => {
    const payload: Record<string, string> = {
      username: targetUsername.trim(),
      newPassword,
      confirmPassword,
    };
    if (oldPassword.length > 0) {
      payload.oldPassword = oldPassword;
    }
    return payload;
  }, [targetUsername, oldPassword, newPassword, confirmPassword]);

  const displayedPayload = lastSubmittedPayload ?? outgoingPayload;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setFeedback(null);

    const submittedSnapshot = { ...outgoingPayload };
    setLastSubmittedPayload(submittedSnapshot);

    try {
      const res = await apiJson<{ message?: string; error?: string }>("/api/change-password", {
        method: "POST",
        body: JSON.stringify(submittedSnapshot),
      });

      setLastResponse({ status: res.status, data: res.data });

      if (res.ok) {
        setFeedback({
          text: res.data.message || "Password updated successfully.",
          tone: "ok",
        });
        setOldPassword("");
        setNewPassword("");
        setConfirmPassword("");
      } else {
        setFeedback({
          text: `HTTP ${res.status}: ${res.data.error || "Password update failed."}`,
          tone: "bad",
        });
      }
    } catch {
      setLastResponse({ status: 500, data: { error: "Network or server connection failed." } });
      setFeedback({
        text: "Network or server connection failed.",
        tone: "bad",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <main className="container main-content">
        <div className="page-header">
          <div>
            <h1>Change Account Password</h1>
            <p className="page-header__desc">
              Topic 2 (Insecure Change Password Feature): compare missing current password verification and client-controlled username tampering against full remediation.
            </p>
          </div>
          <div className="actions-row">
            <Link href="/dashboard" className="btn">
              Back to dashboard
            </Link>
          </div>
        </div>

        <GlobalBanner />

        {user ? (
          <AccountSummary user={user} />
        ) : (
          <div className="status-banner status-banner--cool" role="status">
            Not signed in. Password update parameter tampering remains testable in VULNERABLE mode.
          </div>
        )}

        <div
          id="changePassModeBanner"
          className={`status-banner ${isSecure ? "status-banner--ok" : "status-banner--bad"}`}
          role="status"
        >
          {isSecure
            ? "SECURE mode active: Requires valid session, oldPassword verification, >= 8 char policy, and rejects cross-user username tampering (403)."
            : "VULNERABLE mode active: CWE-620 omits oldPassword verification and trusts the client-supplied username parameter directly."}
        </div>

        <section className="panels panels--split" aria-label="Change password workspace">
          <div className="panel">
            <div className="panel__head">
              <h2>Update credentials</h2>
            </div>

            <form id="changePasswordForm" className="form-grid" onSubmit={handleSubmit} noValidate>
              <div className="field">
                <label htmlFor="targetUsernameInput" className="field__label">
                  Target username
                </label>
                <input
                  id="targetUsernameInput"
                  name="username"
                  type="text"
                  className="field__input"
                  placeholder="danish or admin"
                  value={targetUsername}
                  onChange={(e) => {
                    setCustomTarget(e.target.value);
                    setLastSubmittedPayload(null);
                  }}
                  required
                />
                <span id="targetUsernameHint" className="field__hint">
                  {isSecure
                    ? "Server binds updates to your session ID. Tampering this field to another user triggers 403 Forbidden."
                    : "Editable for demo: try changing to “admin” after leaking /api/users to perform Chained Account Takeover."}
                </span>
              </div>

              <div className="field">
                <label htmlFor="oldPasswordInput" className="field__label">
                  Current password
                </label>
                <input
                  id="oldPasswordInput"
                  name="oldPassword"
                  type="password"
                  className="field__input"
                  autoComplete="current-password"
                  placeholder={isSecure ? "Enter current password" : "Leave empty in VULNERABLE mode"}
                  value={oldPassword}
                  onChange={(e) => {
                    setOldPassword(e.target.value);
                    setLastSubmittedPayload(null);
                  }}
                />
                <span id="oldPasswordHint" className="field__hint">
                  {isSecure
                    ? "Required and verified against bcrypt hash in PostgreSQL."
                    : "Ignored by backend in VULNERABLE mode (leave blank to verify CWE-620)."}
                </span>
              </div>

              <div className="field">
                <label htmlFor="newPasswordInput" className="field__label">
                  New password
                </label>
                <input
                  id="newPasswordInput"
                  name="newPassword"
                  type="password"
                  className="field__input"
                  autoComplete="new-password"
                  placeholder="Minimum 8 characters in SECURE mode"
                  value={newPassword}
                  onChange={(e) => {
                    setNewPassword(e.target.value);
                    setLastSubmittedPayload(null);
                  }}
                  required
                />
              </div>

              <div className="field">
                <label htmlFor="confirmPasswordInput" className="field__label">
                  Confirm new password
                </label>
                <input
                  id="confirmPasswordInput"
                  name="confirmPassword"
                  type="password"
                  className="field__input"
                  autoComplete="new-password"
                  placeholder="Repeat new password"
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    setLastSubmittedPayload(null);
                  }}
                  required
                />
              </div>

              {feedback && (
                <div
                  id="changePassFeedback"
                  className={`status-banner status-banner--${feedback.tone}`}
                  role="alert"
                >
                  {feedback.text}
                </div>
              )}

              <div className="actions-row">
                <button
                  id="changePassSubmitBtn"
                  type="submit"
                  className="btn btn--primary"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? "Updating…" : "Update password"}
                </button>
              </div>
            </form>
          </div>

          <div className="panel panel--deep">
            <div className="panel__head">
              <h2>HTTP payload inspector</h2>
            </div>
            <p className="panel__sub">
              Live request and server response for screenshot evidence in Burp Suite, Postman, or browser demos.
            </p>
            <div className="field">
              <span className="field__label">Outgoing request</span>
              <pre id="reqPayloadPreview" className="code-block">
                {`POST /api/change-password\nContent-Type: application/json\n\n${JSON.stringify(displayedPayload, null, 2)}`}
              </pre>
            </div>
            <div className="field">
              <span className="field__label">Server response</span>
              <pre id="resPayloadPreview" className="code-block">
                {lastResponse
                  ? `HTTP ${lastResponse.status}\n\n${JSON.stringify(lastResponse.data, null, 2)}`
                  : "Waiting for submission…"}
              </pre>
            </div>
          </div>
        </section>
      </main>

      <Footer detail="Kelompok 12" />
    </>
  );
}
