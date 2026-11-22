"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useApp } from "../context/AppContext";
import { apiJson, formatIDR } from "../lib/api";
import { GlobalBanner } from "../components/GlobalBanner";
import { Footer } from "../components/Footer";
import { AuditTable, AuditLogEntry } from "../components/AuditTable";

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

export function DashboardClient() {
  const { user, securityMode, toggleMode, resetDb, isActionLoading, syncControlBar, registerRefreshHandler } = useApp();
  const isAdmin = user?.role === "admin";
  const isAnonymous = !user;
  const isSecure = securityMode === "SECURE";

  // Transactions state
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [txLoading, setTxLoading] = useState(true);
  const [txError, setTxError] = useState<string | null>(null);

  // Users Directory state (admin only)
  const [users, setUsers] = useState<UserDirectoryItem[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [usersStatus, setUsersStatus] = useState<number>(200);
  const [usersOk, setUsersOk] = useState<boolean>(true);
  const [usersError, setUsersError] = useState<string | null>(null);

  // Audit Logs state (admin only)
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [auditLoading, setAuditLoading] = useState(true);
  const [auditStatus, setAuditStatus] = useState<number>(200);
  const [auditOk, setAuditOk] = useState<boolean>(true);
  const [auditError, setAuditError] = useState<string | null>(null);

  const fetchTransactions = useCallback(() => {
    apiJson<{ transactions?: Transaction[]; error?: string }>("/api/transactions")
      .then((res) => {
        if (res.ok) {
          setTransactions(res.data.transactions || []);
          setTxError(null);
        } else {
          setTxError(`HTTP ${res.status}: ${res.data.error || "Failed to load transactions"}`);
        }
      })
      .catch(() => {
        setTxError("Network error while loading transactions.");
      })
      .finally(() => {
        setTxLoading(false);
      });
  }, []);

  const fetchUsersDirectory = useCallback(() => {
    apiJson<{ users?: UserDirectoryItem[]; error?: string }>("/api/users")
      .then((res) => {
        setUsersStatus(res.status);
        setUsersOk(res.ok);
        if (res.ok) {
          setUsers(res.data.users || []);
          setUsersError(null);
        } else {
          setUsersError(`Access blocked with HTTP ${res.status}: ${res.data.error || "Access Denied"}`);
        }
      })
      .catch(() => {
        setUsersStatus(500);
        setUsersOk(false);
        setUsersError("Network error while querying users directory.");
      })
      .finally(() => {
        setUsersLoading(false);
      });
  }, []);

  const fetchAuditLogs = useCallback(() => {
    apiJson<{ logs?: AuditLogEntry[]; error?: string }>("/api/audit-logs?ui_poll=1")
      .then((res) => {
        setAuditStatus(res.status);
        setAuditOk(res.ok);
        if (res.ok) {
          setAuditLogs(res.data.logs || []);
          setAuditError(null);
        } else {
          setAuditError(`Audit endpoint blocked with HTTP ${res.status}: ${res.data.error || "Access Denied"}`);
        }
      })
      .catch(() => {
        setAuditStatus(500);
        setAuditOk(false);
        setAuditError("Network error while querying audit logs.");
      })
      .finally(() => {
        setAuditLoading(false);
      });
  }, []);

  const loadUsersDirectory = useCallback(() => {
    setUsersLoading(true);
    setUsersError(null);
    fetchUsersDirectory();
  }, [fetchUsersDirectory]);

  const loadAuditLogs = useCallback(() => {
    setAuditLoading(true);
    setAuditError(null);
    fetchAuditLogs();
  }, [fetchAuditLogs]);

  const triggerRefreshAll = useCallback(() => {
    syncControlBar();
    fetchTransactions();
    fetchUsersDirectory();
    fetchAuditLogs();
  }, [syncControlBar, fetchTransactions, fetchUsersDirectory, fetchAuditLogs]);

  useEffect(() => {
    triggerRefreshAll();
    const unregister = registerRefreshHandler(() => {
      triggerRefreshAll();
    });
    return unregister;
  }, [triggerRefreshAll, registerRefreshHandler]);

  return (
    <>
      <main className="container main-content">
        <div className="page-header">
          <div>
            <h1>Dashboard</h1>
            <p className="page-header__desc">
              {isAdmin
                ? "Administrator Security Console: ledger, user accounts, and audit log monitor."
                : "Welcome to your FinVault e-wallet overview."}
            </p>
          </div>
          {isAdmin && (
            <div className="actions-row">
              <Link href="/profile" className="btn btn--primary">
                Change password
              </Link>
            </div>
          )}
        </div>

        <GlobalBanner />

        {/* Jika ANONYMOUS: Berikan pemberitahuan login saja */}
        {isAnonymous && (
          <div className="panel text-center py-12">
            <h2 className="text-xl font-bold mb-2">Anda Belum Masuk</h2>
            <p className="text-zinc-400 text-sm mb-6">
              Silakan login terlebih dahulu untuk mengakses akun e-wallet Anda.
            </p>
            <div>
              <Link href="/login" className="btn btn--primary">
                Menuju Halaman Login
              </Link>
            </div>
          </div>
        )}

        {/* Jika CUSTOMER: Cukup menampilkan balance dan account holder saja */}
        {!isAnonymous && !isAdmin && (
          <section className="panels panels--two" aria-label="Customer Account Summary">
            <div className="panel">
              <span className="stat-label">Available balance</span>
              <div id="walletBalance" className="reading text-amber-400">
                {formatIDR(user?.balance ?? 0)}
              </div>
              <span className="stat-label stat-meta measured" id="walletAccount">
                No. Rekening: {user ? user.accountNumber : "-"}
              </span>
            </div>
            <div className="panel">
              <span className="stat-label">Account holder</span>
              <div id="walletFullName" className="reading text-xl font-medium">
                {user ? `${user.fullName} (${user.username})` : "-"}
              </div>
              <div>
                <span id="walletRole" className="chip chip--cool">
                  {user ? user.role : "customer"}
                </span>
              </div>
            </div>
          </section>
        )}

        {/* Jika ADMIN: Tampilkan kontrol mode + reset, balance, holder, ledger, user directory, dan audit trail */}
        {isAdmin && (
          <>
            {/* Panel Khusus Admin: Kontrol Mode Keamanan dan Reset Database */}
            <section className="panels">
              <div className="panel bg-[#0f121a] border border-[#1f2430]">
                <div className="panel__head">
                  <div>
                    <h2 className="text-base font-semibold">Security Mode &amp; Demo Controls</h2>
                    <p className="panel__sub">
                      Kelola konfigurasi pengujian keamanan dan reset database demo.
                    </p>
                  </div>
                  <div className="actions-row">
                    <span
                      id="modeBadge"
                      className={`chip ${isSecure ? "chip--secure" : "chip--vuln"}`}
                    >
                      Mode: {securityMode}
                    </span>
                    <button
                      id="toggleModeBtn"
                      type="button"
                      className="btn"
                      disabled={isActionLoading}
                      onClick={toggleMode}
                    >
                      {isSecure ? "Switch to VULNERABLE" : "Switch to SECURE"}
                    </button>
                    <button
                      id="resetDbBtn"
                      type="button"
                      className="btn"
                      disabled={isActionLoading}
                      onClick={resetDb}
                    >
                      Reset demo database
                    </button>
                  </div>
                </div>
              </div>
            </section>

            {/* Account Summary Admin */}
            <section className="panels panels--two" aria-label="Account summary">
              <div className="panel">
                <span className="stat-label">Available balance</span>
                <div id="walletBalance" className="reading text-amber-400">
                  {formatIDR(user?.balance ?? 0)}
                </div>
                <span className="stat-label stat-meta measured" id="walletAccount">
                  No. Rekening: {user ? user.accountNumber : "-"}
                </span>
              </div>
              <div className="panel">
                <span className="stat-label">Account holder</span>
                <div id="walletFullName" className="reading text-xl font-medium">
                  {user ? `${user.fullName} (${user.username})` : "-"}
                </div>
                <div>
                  <span id="walletRole" className="chip chip--amber">
                    {user ? user.role : "admin"}
                  </span>
                </div>
              </div>
            </section>

            {/* Transaction Ledger Admin */}
            <section className="panels" aria-label="Transaction ledger">
              <div className="panel">
                <div className="panel__head">
                  <h2>Transaction Ledger</h2>
                </div>
                <div id="txStateContainer">
                  {txLoading ? (
                    <div className="panel">
                      <div className="skeleton-line" />
                      <div className="skeleton-line" />
                    </div>
                  ) : txError ? (
                    <div className="status-banner status-banner--bad">{txError}</div>
                  ) : transactions.length === 0 ? (
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
                          {transactions.map((tx, idx) => {
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

            {/* Customer Directory Admin */}
            <section className="panels" aria-label="Customer directory">
              <div className="panel">
                <div className="panel__head">
                  <h2>Customer Directory</h2>
                  <div className="actions-row">
                    <span
                      id="usersApiChip"
                      className={`chip ${usersOk ? "chip--vuln" : "chip--secure"}`}
                    >
                      HTTP {usersStatus}
                    </span>
                    <button
                      id="probeUsersBtn"
                      type="button"
                      className="btn"
                      onClick={() => {
                        loadUsersDirectory();
                        loadAuditLogs();
                      }}
                    >
                      Probe Users
                    </button>
                  </div>
                </div>
                <div id="usersStateContainer">
                  {usersLoading ? (
                    <div className="panel">
                      <div className="skeleton-line" />
                      <div className="skeleton-line" />
                    </div>
                  ) : !usersOk && usersError ? (
                    <div className="status-banner status-banner--ok">{usersError}</div>
                  ) : users.length === 0 ? (
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
                          {users.map((u) => (
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

            {/* Security Audit Trail Admin */}
            <section className="panels" aria-label="Security audit trail">
              <div className="panel panel--deep">
                <div className="panel__head">
                  <h2>Security Audit Trail</h2>
                  <div className="actions-row">
                    <span
                      id="auditApiChip"
                      className={`chip ${auditOk ? "chip--cool" : "chip--secure"}`}
                    >
                      HTTP {auditStatus}
                    </span>
                    <button
                      id="refreshAuditBtn"
                      type="button"
                      className="btn"
                      onClick={loadAuditLogs}
                    >
                      Refresh audit log
                    </button>
                  </div>
                </div>
                <div id="auditStateContainer">
                  <AuditTable
                    logs={auditLogs}
                    loading={auditLoading}
                    errorMessage={auditError}
                    emptyMessage="No audit log entries recorded yet."
                  />
                </div>
              </div>
            </section>
          </>
        )}
      </main>

      <Footer detail="Kelompok 12" />
    </>
  );
}
