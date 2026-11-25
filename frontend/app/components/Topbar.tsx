"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useApp } from "../context/AppContext";

export function Topbar() {
  const pathname = usePathname();
  const { user, securityMode, toggleMode, resetDb, logout, isActionLoading } = useApp();
  const isSecure = securityMode === "SECURE";
  const isChangePasswordActive =
    pathname.startsWith("/change-password") || pathname.startsWith("/profile");

  return (
    <header className="topbar">
      <div className="container topbar__inner">
        <div className="brand-group">
          <Link href={user ? "/dashboard" : "/login"} className="wordmark">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              aria-hidden="true"
            >
              <rect x="3" y="5" width="18" height="14" rx="2" />
              <path d="M3 10h18" />
              <circle cx="16" cy="14.5" r="1.25" fill="currentColor" />
            </svg>
            <span>FinVault</span>
          </Link>

          <nav className="nav-links" aria-label="Primary navigation">
            <Link
              href="/login"
              className="nav-link"
              aria-current={pathname === "/login" ? "page" : undefined}
            >
              Sign in
            </Link>
            <Link
              href="/dashboard"
              className="nav-link"
              aria-current={pathname.startsWith("/dashboard") ? "page" : undefined}
            >
              Dashboard
            </Link>
            <Link
              href="/change-password"
              className="nav-link"
              aria-current={isChangePasswordActive ? "page" : undefined}
            >
              Change password
            </Link>
          </nav>
        </div>

        <div className="control-bar">
          {user && (
            <span id="sessionChip" className="chip chip--cool">
              {user.username} ({user.role})
            </span>
          )}
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
            onClick={() => void toggleMode()}
          >
            {isSecure ? "Switch to VULNERABLE" : "Switch to SECURE"}
          </button>
          <button
            id="resetDbBtn"
            type="button"
            className="btn"
            disabled={isActionLoading}
            onClick={() => void resetDb()}
          >
            Reset demo database
          </button>
          {user && (
            <button
              id="logoutBtn"
              type="button"
              className="btn btn--danger"
              disabled={isActionLoading}
              onClick={() => void logout()}
            >
              Sign out
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
