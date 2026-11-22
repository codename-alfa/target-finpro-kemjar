"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useApp } from "../context/AppContext";
import { apiJson } from "../lib/api";

export function LoginClient() {
  const router = useRouter();
  const { syncControlBar } = useApp();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setFeedback(null);

    try {
      const res = await apiJson<{ user?: { username: string; role: string }; error?: string }>("/api/login", {
        method: "POST",
        body: JSON.stringify({ username, password }),
      });

      if (res.ok) {
        await syncControlBar();
        router.push("/dashboard");
        return;
      }

      setFeedback(res.data.error || "Authentication failed.");
    } catch {
      setFeedback("Network or server error during sign in.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#07090e] flex items-center justify-center p-4 sm:p-6 lg:p-8 w-full">
      {/* Container utama */}
      <div className="w-full max-w-4xl bg-[#0d1117] border border-[#21262d] rounded-[28px] p-8 sm:p-12 shadow-2xl flex flex-col md:flex-row items-center gap-8 lg:gap-12">
        {/* Kolom Kiri: Branding & Header */}
        <div className="w-full md:w-1/2 flex flex-col justify-center">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-amber-500/35 bg-amber-500/10 text-amber-500 text-xs font-medium w-fit mb-6">
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="2" y="5" width="20" height="14" rx="2"></rect>
              <line x1="2" y1="10" x2="22" y2="10"></line>
            </svg>
            <span>FinVault E-Wallet</span>
          </div>

          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white tracking-tight leading-tight">
            Manage Your
          </h1>
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-[#fbbf24] tracking-tight leading-tight mb-6">
            Finances Securely
          </h2>
          <p className="text-[#8b949e] text-sm sm:text-base leading-relaxed max-w-sm">
            Sign in to your FinVault portal to monitor balances, track real-time transactions, and manage your digital wallet.
          </p>
        </div>

        {/* Kolom Kanan: Card Form Login FinVault */}
        <div className="w-full md:w-1/2 bg-[#f59e0b] rounded-[20px] p-6 sm:p-8 shadow-lg text-black flex flex-col justify-center">
          <form onSubmit={handleLoginSubmit} noValidate className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="usernameInput"
                className="block text-xs font-bold uppercase tracking-wider text-[#3d2700]"
              >
                Username
              </label>
              <input
                id="usernameInput"
                name="username"
                type="text"
                autoComplete="username"
                placeholder="Enter your username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                className="w-full px-4 py-3 rounded-xl bg-[#fbbf24] text-[#1c1200] placeholder-[#7a5c00] font-medium border border-[#d97706] focus:outline-none focus:ring-2 focus:ring-black/40 text-sm transition-all"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="passwordInput"
                className="block text-xs font-bold uppercase tracking-wider text-[#3d2700]"
              >
                Password
              </label>
              <input
                id="passwordInput"
                name="password"
                type="password"
                autoComplete="current-password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full px-4 py-3 rounded-xl bg-[#fbbf24] text-[#1c1200] placeholder-[#7a5c00] font-medium border border-[#d97706] focus:outline-none focus:ring-2 focus:ring-black/40 text-sm transition-all"
              />
            </div>

            {feedback && (
              <div
                id="loginFeedback"
                className="p-2.5 rounded-lg bg-black/85 text-red-300 text-xs font-medium border border-red-500/40"
                role="alert"
              >
                {feedback}
              </div>
            )}

            <div className="pt-2">
              <button
                id="loginSubmitBtn"
                type="submit"
                disabled={isSubmitting}
                className="w-fit px-7 py-3 rounded-full bg-black hover:bg-[#1a1a1a] text-white font-semibold text-sm inline-flex items-center justify-center gap-2 shadow-md transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="-rotate-45"
                >
                  <line x1="22" y1="2" x2="11" y2="13"></line>
                  <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                </svg>
                <span>{isSubmitting ? "Signing in…" : "Sign In"}</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </main>
  );
}
