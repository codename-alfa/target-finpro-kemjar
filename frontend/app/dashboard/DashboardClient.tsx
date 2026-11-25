"use client";

import React, { useEffect, useCallback } from "react";
import Link from "next/link";
import { useApp } from "../context/AppContext";
import { apiJson, formatIDR } from "../lib/api";
import { GlobalBanner } from "../components/GlobalBanner";
import { Footer } from "../components/Footer";
import { AccountSummary } from "../components/AccountSummary";
import { AuditTable, AuditLogEntry } from "../components/AuditTable";
import { useAsyncResource } from "../hooks/useAsyncResource";

interface Transaction {
  id?: number;
  tx_code: string;
  username: string;
  account_number: string;
  type: string;
  amount: number | string;
  description: string;
}

interface UserDirectoryItem {
  id: number;
  username: string;
  full_name: string;
  account_number: string;
  balance: number | string;
  role: string;
}

function resolveApiChip(
  status: number | null,
  ok: boolean,
  isSecure: boolean,
  isAdmin: boolean,
  unprobedText: string
): { label: string; className: string } {
  if (status === null) {
    return { label: unprobedText, className: "chip chip--cool" };
  }
  if (status === 401 || status === 403) {
    return { label: `HTTP ${status}`, className: "chip chip--secure" };
  }
  if (ok) {
    return {
      label: `HTTP ${status}`,
      className: `chip ${isSecure && isAdmin ? "chip--secure" : "chip--vuln"}`,
    };
  }
  return { label: `HTTP ${status}`, className: "chip chip--vuln" };
}

function resolveErrorBannerClass(status: number | null): string {
  if (status === 401 || status === 403) {
    return "status-banner status-banner--ok";
  }
  return "status-banner status-banner--bad";
}

export function DashboardClient() {
  const { user, securityMode, isLoading, registerRefreshHandler } = useApp();
  const isAdmin = user?.role === "admin";
  const isAnonymous = !user;
  const isSecure = securityMode === "SECURE";

  const {
    data: txData,
    loading: txLoading,
    status: txStatus,
    error: txError,
    run: runTx,
    reset: resetTx,
  } = useAsyncResource<Transaction[]>();
  const {
    data: usersData,
    loading: usersLoading,
    status: usersStatus,
    ok: usersOk,
    error: usersError,
    run: runUsers,
    reset: resetUsers,
  } = useAsyncResource<UserDirectoryItem[]>(null);
  const {
    data: auditData,
    loading: auditLoading,
    status: auditStatus,
    ok: auditOk,
    error: auditError,
    run: runAudit,
    reset: resetAudit,
  } = useAsyncResource<AuditLogEntry[]>(null);

  const loadTransactions = useCallback(() => {
    void runTx<{ transactions?: Transaction[]; error?: string }>(
      () => apiJson("/api/transactions"),
      (body) => body.transactions || [],
      (status, body) => `HTTP ${status}: ${body.error || "Failed to load transactions"}`
    );
  }, [runTx]);

  const loadUsersDirectory = useCallback(() => {
    return runUsers<{ users?: UserDirectoryItem[]; error?: string }>(
      () => apiJson("/api/users"),
      (body) => body.users || [],
      (status, body) => `Access blocked with HTTP ${status}: ${body.error || "Access Denied"}`
    );
  }, [runUsers]);

  const loadAuditLogs = useCallback(
    (uiPoll = true) => {
      const path = uiPoll ? "/api/audit-logs?ui_poll=1" : "/api/audit-logs";
      void runAudit<{ logs?: AuditLogEntry[]; error?: string }>(
        () => apiJson(path),
        (body) => body.logs || [],
        (status, body) => `Audit endpoint blocked with HTTP ${status}: ${body.error || "Access Denied"}`
      );
    },
    [runAudit]
  );

  const syncDashboardData = useCallback(() => {
    if (isLoading) return;
    if (user) {
      loadTransactions();
    } else {
      resetTx(null);
    }

    if (isAdmin) {
      loadUsersDirectory();
      loadAuditLogs(true);
    } else {
      resetUsers(null);
      resetAudit(null);
    }
  }, [
    isLoading,
    user,
    isAdmin,
    loadTransactions,
    loadUsersDirectory,
    loadAuditLogs,
    resetTx,
    resetUsers,
    resetAudit,
  ]);

  useEffect(() => {
    syncDashboardData();
    return registerRefreshHandler(syncDashboardData);
  }, [syncDashboardData, registerRefreshHandler]);

  const usersChip = resolveApiChip(usersStatus, usersOk, isSecure, isAdmin, "Not probed");
  const auditChip = resolveApiChip(auditStatus, auditOk, isSecure, isAdmin, "Not probed");

  return (
    <>
      <main className="container main-content">
        <div className="page-header">
          <div>
            <h1>Wallet &amp; API Security Console</h1>
            <p className="page-header__desc">
              {isAdmin
                ? "Administrator Security Console: ledger, user directory exposure (/api/users), and audit log monitor."
                : "Inspect your e-wallet balance, transaction ledger, and test API access boundaries."}
            </p>
          </div>
          <div className="actions-row">
            <Link href="/change-password" className="btn btn--primary">
              Change password
            </Link>
          </div>
        </div>

        <GlobalBanner />

        {isAnonymous ? (
          <div className="status-banner status-banner--cool" role="status">
            Not signed in. Sign in to view your wallet ledger, or use Probe GET /api/users below to test unauthenticated API exposure in {securityMode} mode.{" "}
            <Link href="/login">Go to Sign in</Link>.
          </div>
        ) : (
          <AccountSummary user={user} />
        )}

        {!isAnonymous && (
          <section className="panels" aria-label="Transaction ledger">
            <div className="panel">
              <div className="panel__head">
                <h2>Transaction ledger (/api/transactions)</h2>
                <button
                  type="button"
                  className="btn"
                  disabled={txLoading}
                  onClick={loadTransactions}
                >
                  Refresh transactions
                </button>
              </div>
              <div id="txStateContainer">
                {txLoading ? (
                  <div className="panel">
                    <div className="skeleton-line" />
                    <div className="skeleton-line" />
                  </div>
                ) : txError ? (
                  <div className={resolveErrorBannerClass(txStatus)}>
                    {txError}
                  </div>
                ) : !txData || txData.length === 0 ? (
                  <div className="empty-state">No ledger transactions found for this scope.</div>
                ) : (
                  <div className="table-scroll">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Transaction ID</th>
                          <th>Account</th>
                          <th>Type</th>
                          <th>Amount</th>
                          <th>Description</th>
                        </tr>
                      </thead>
                      <tbody>
                        {txData.map((tx, idx) => {
                          const typeChip = tx.type === "CREDIT" ? "chip--secure" : "chip--amber";
                          return (
                            <tr key={tx.id ?? idx}>
                              <td className="measured">{tx.tx_code}</td>
                              <td className="measured">
                                {tx.username} ({tx.account_number})
                              </td>
                              <td>
                                <span className={`chip ${typeChip}`}>{tx.type}</span>
                              </td>
                              <td className="measured">{formatIDR(tx.amount)}</td>
                              <td>{tx.description}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </section>
        )}

        <section className="panels" aria-label="Customer directory API">
          <div className="panel">
            <div className="panel__head">
              <h2>Customer directory (/api/users)</h2>
              <div className="actions-row">
                <span id="usersApiChip" className={usersChip.className}>
                  {usersChip.label}
                </span>
                <button
                  id="probeUsersBtn"
                  type="button"
                  className="btn"
                  disabled={usersLoading}
                  onClick={async () => {
                    await loadUsersDirectory();
                    if (isAdmin) loadAuditLogs(true);
                  }}
                >
                  Probe GET /api/users
                </button>
              </div>
            </div>
            <p className="panel__sub">
              Topic 1 (No API Authentication): returns all accounts including administrator metadata in VULNERABLE mode without login, or blocks with 401/403 in SECURE mode.
            </p>
            <div id="usersStateContainer">
              {usersLoading ? (
                <div className="panel">
                  <div className="skeleton-line" />
                  <div className="skeleton-line" />
                </div>
              ) : usersStatus === null ? (
                <div className="empty-state">
                  Not probed yet. Click Probe GET /api/users to inspect API access for your current session.
                </div>
              ) : !usersOk && usersError ? (
                <div className={resolveErrorBannerClass(usersStatus)}>
                  {usersError}
                </div>
              ) : !usersData || usersData.length === 0 ? (
                <div className="empty-state">No accounts found.</div>
              ) : (
                <div className="table-scroll">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>ID</th>
                        <th>Username</th>
                        <th>Full name</th>
                        <th>Account number</th>
                        <th>Balance</th>
                        <th>Role</th>
                      </tr>
                    </thead>
                    <tbody>
                      {usersData.map((u) => (
                        <tr key={u.id}>
                          <td className="measured">{u.id}</td>
                          <td className="measured">{u.username}</td>
                          <td>{u.full_name}</td>
                          <td className="measured">{u.account_number}</td>
                          <td className="measured">{formatIDR(u.balance)}</td>
                          <td>
                            <span
                              className={`chip ${u.role === "admin" ? "chip--amber" : "chip--cool"}`}
                            >
                              {u.role}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="panels" aria-label="Security audit trail">
          <div className="panel panel--deep">
            <div className="panel__head">
              <h2>Security audit trail (/api/audit-logs)</h2>
              <div className="actions-row">
                <span id="auditApiChip" className={auditChip.className}>
                  {auditChip.label}
                </span>
                <button
                  id="refreshAuditBtn"
                  type="button"
                  className="btn"
                  disabled={auditLoading}
                  onClick={() => loadAuditLogs(isAdmin)}
                >
                  Refresh audit log
                </button>
              </div>
            </div>
            <div id="auditStateContainer">
              {auditStatus === null && !auditLoading ? (
                <div className="empty-state">
                  Not loaded automatically for non-admin sessions. Click Refresh audit log to probe /api/audit-logs.
                </div>
              ) : !auditOk && auditError ? (
                <div className={resolveErrorBannerClass(auditStatus)}>
                  {auditError}
                </div>
              ) : (
                <AuditTable
                  logs={auditData || []}
                  loading={auditLoading}
                  errorMessage={null}
                  emptyMessage="No audit log entries recorded yet."
                />
              )}
            </div>
          </div>
        </section>
      </main>

      <Footer detail="Kelompok 12" />
    </>
  );
}
