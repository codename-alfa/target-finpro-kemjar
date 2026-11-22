"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { useApp } from "../context/AppContext";
import { apiJson, formatIDR } from "../lib/api";
import { GlobalBanner } from "../components/GlobalBanner";
import { Footer } from "../components/Footer";

export function ProfileClient() {
  const { user, securityMode } = useApp();
  const isSecure = securityMode === "SECURE";

  const targetUsername = user?.username || "";

  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [feedback, setFeedback] = useState<{ text: string; tone: "ok" | "bad" } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const outgoingPayload = useMemo(() => {
    const payload: Record<string, string> = {
      username: targetUsername.trim(),
      newPassword,
      confirmPassword,
    };
    if (isSecure && oldPassword.length > 0) {
      payload.oldPassword = oldPassword;
    }
    return payload;
  }, [isSecure, targetUsername, oldPassword, newPassword, confirmPassword]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setFeedback(null);

    try {
      const res = await apiJson<{ message?: string; error?: string }>(
        "/api/change-password",
        {
          method: "POST",
          body: JSON.stringify(outgoingPayload),
        }
      );

      if (res.ok) {
        setFeedback({
          text: res.data.message || "Password updated successfully.",
          tone: "ok",
        });
      } else {
        setFeedback({
          text: `HTTP ${res.status}: ${res.data.error || "Password update failed."}`,
          tone: "bad",
        });
      }
    } catch {
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
            <h1>User Profile &amp; Settings</h1>
            <p className="page-header__desc">
              Manage your FinVault account security credentials and change password.
            </p>
          </div>
          <div className="actions-row">
            <Link href="/dashboard" className="btn">
              Back to dashboard
            </Link>
          </div>
        </div>

        <GlobalBanner />

        {/* Info Profil Akun User */}
        {user ? (
          <section className="panels panels--two" aria-label="Profile Details">
            <div className="panel">
              <span className="stat-label">User Information</span>
              <div className="reading text-xl font-medium">{user.fullName}</div>
              <div className="measured text-zinc-400">Username: @{user.username}</div>
              <div>
                <span className={`chip ${user.role === "admin" ? "chip--amber" : "chip--cool"}`}>
                  Role: {user.role}
                </span>
              </div>
            </div>
            <div className="panel">
              <span className="stat-label">Account Details</span>
              <div className="reading text-xl font-mono text-amber-400">
                {formatIDR(user.balance)}
              </div>
              <div className="measured text-zinc-400">No. Rekening: {user.accountNumber}</div>
            </div>
          </section>
        ) : (
          <div className="status-banner status-banner--cool">
            Not signed in. Password update parameter tampering remains testable for demonstration.
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

        {/* Section Change Password Workspace */}
        <section className="panels" aria-label="Change password workspace">
          <div className="panel">
            <div className="panel__head">
              <h2>Change Password</h2>
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
                  placeholder="Not signed in"
                  value={targetUsername}
                  readOnly
                  disabled
                />
                <span id="targetUsernameHint" className="field__hint">
                  Fixed to your currently signed-in account.
                </span>
              </div>

              {isSecure && (
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
                    placeholder="Enter current password"
                    value={oldPassword}
                    onChange={(e) => setOldPassword(e.target.value)}
                    required
                  />
                  <span id="oldPasswordHint" className="field__hint">
                    Required and verified against bcrypt hash in PostgreSQL.
                  </span>
                </div>
              )}

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
                  onChange={(e) => setNewPassword(e.target.value)}
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
                  onChange={(e) => setConfirmPassword(e.target.value)}
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
        </section>
      </main>

      <Footer detail="Kelompok 12" />
    </>
  );
}
