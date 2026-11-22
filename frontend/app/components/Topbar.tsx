"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useApp } from "../context/AppContext";

export function Topbar() {
  const pathname = usePathname();
  const { user, logout, isActionLoading } = useApp();

  const isNavVisible = pathname.startsWith("/dashboard") || pathname.startsWith("/profile");

  if (!isNavVisible) {
    return null;
  }

  return (
    <header className="sticky top-0 z-50 bg-[#07090e] border-b border-[#1f2430]">
      <div className="container mx-auto px-6 h-16 flex items-center justify-between">
        {/* Brand */}
        <Link
          href={user ? "/dashboard" : "/login"}
          className="flex items-center gap-2 text-white font-semibold text-lg tracking-tight hover:opacity-90 transition-opacity"
        >
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#f59e0b"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="2" y="5" width="20" height="14" rx="2"></rect>
            <line x1="2" y1="10" x2="22" y2="10"></line>
            <circle cx="16" cy="15" r="1" fill="#f59e0b"></circle>
          </svg>
          <span>FinVault</span>
        </Link>

        {/* Navigation links & Logout */}
        <div className="flex items-center gap-6">
          <nav className="flex items-center gap-6">
            <Link
              href="/dashboard"
              className={`text-sm font-medium transition-colors ${
                pathname === "/dashboard"
                  ? "text-white font-semibold"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              Dashboard
            </Link>
            <Link
              href="/profile"
              className={`text-sm font-medium transition-colors ${
                pathname === "/profile"
                  ? "text-white font-semibold"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              Profile
            </Link>
          </nav>

          {user && (
            <div className="flex items-center gap-3 pl-4 border-l border-[#1f2430]">
              <span className="text-xs text-zinc-400 font-mono hidden sm:inline">
                {user.username} ({user.role})
              </span>
              <button
                type="button"
                disabled={isActionLoading}
                onClick={logout}
                className="px-3 py-1.5 text-xs font-medium text-red-400 border border-red-500/30 rounded-lg hover:bg-red-500/10 transition-colors disabled:opacity-50"
              >
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
