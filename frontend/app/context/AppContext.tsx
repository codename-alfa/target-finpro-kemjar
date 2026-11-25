"use client";

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { apiJson } from "../lib/api";

export type SecurityMode = "VULNERABLE" | "SECURE";
export type BannerTone = "ok" | "bad" | "cool";

export interface UserSession {
  id: number;
  username: string;
  fullName: string;
  role: string;
  balance: number;
  accountNumber: string;
}

interface BannerMessage {
  text: string;
  tone: BannerTone;
}

interface AppContextType {
  securityMode: SecurityMode;
  user: UserSession | null;
  globalBanner: BannerMessage | null;
  isLoading: boolean;
  isActionLoading: boolean;
  showGlobalMessage: (text: string, tone?: BannerTone) => void;
  syncControlBar: () => Promise<{ securityMode: SecurityMode; user: UserSession | null }>;
  toggleMode: () => Promise<void>;
  resetDb: () => Promise<void>;
  logout: () => Promise<void>;
  registerRefreshHandler: (handler: () => void) => () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [securityMode, setSecurityMode] = useState<SecurityMode>("VULNERABLE");
  const [user, setUser] = useState<UserSession | null>(null);
  const [globalBanner, setGlobalBanner] = useState<BannerMessage | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isActionLoading, setIsActionLoading] = useState<boolean>(false);

  const refreshHandlers = useRef<Set<() => void>>(new Set());

  const registerRefreshHandler = useCallback((handler: () => void) => {
    refreshHandlers.current.add(handler);
    return () => {
      refreshHandlers.current.delete(handler);
    };
  }, []);

  const triggerRefreshHandlers = useCallback(() => {
    refreshHandlers.current.forEach((fn) => {
      try {
        fn();
      } catch (err) {
        console.error("Refresh handler error:", err);
      }
    });
  }, []);

  const showGlobalMessage = useCallback((text: string, tone: BannerTone = "cool") => {
    setGlobalBanner({ text, tone });
  }, []);

  const syncControlBar = useCallback(async () => {
    try {
      const statusRes = await apiJson<{ securityMode: SecurityMode }>("/api/admin/status");
      let currentMode: SecurityMode = "VULNERABLE";
      if (statusRes.ok && statusRes.data?.securityMode) {
        currentMode = statusRes.data.securityMode;
        setSecurityMode(currentMode);
      }

      const meRes = await apiJson<{
        authenticated: boolean;
        securityMode?: SecurityMode;
        user?: UserSession;
      }>("/api/me");

      let currentUser: UserSession | null = null;
      if (meRes.ok && meRes.data?.authenticated && meRes.data.user) {
        currentUser = meRes.data.user;
        setUser(currentUser);
        if (meRes.data.securityMode) {
          currentMode = meRes.data.securityMode;
          setSecurityMode(currentMode);
        }
      } else {
        setUser(null);
      }

      return { securityMode: currentMode, user: currentUser };
    } catch {
      setUser(null);
      showGlobalMessage("Cannot reach Express backend API on port 5000.", "bad");
      return { securityMode: "VULNERABLE" as SecurityMode, user: null };
    } finally {
      setIsLoading(false);
    }
  }, [showGlobalMessage]);

  const toggleMode = useCallback(async () => {
    setIsActionLoading(true);
    try {
      const res = await apiJson<{ securityMode: SecurityMode; message: string; error?: string }>(
        "/api/admin/toggle-mode",
        { method: "POST", body: "{}" }
      );
      if (res.ok && res.data?.securityMode) {
        setSecurityMode(res.data.securityMode);
        showGlobalMessage(
          `Security mode changed to ${res.data.securityMode}.`,
          res.data.securityMode === "SECURE" ? "ok" : "bad"
        );
        triggerRefreshHandlers();
      } else {
        showGlobalMessage(res.data?.error || "Failed to switch security mode.", "bad");
      }
    } catch {
      showGlobalMessage("Network error while switching security mode.", "bad");
    } finally {
      setIsActionLoading(false);
    }
  }, [showGlobalMessage, triggerRefreshHandlers]);

  const resetDb = useCallback(async () => {
    setIsActionLoading(true);
    try {
      const res = await apiJson<{ message: string; error?: string }>(
        "/api/admin/reset-demo",
        { method: "POST", body: "{}" }
      );
      if (res.ok) {
        showGlobalMessage("Demo database reset to initial seeded credentials and balances.", "ok");
        await syncControlBar();
        triggerRefreshHandlers();
      } else {
        showGlobalMessage(res.data?.error || "Failed to reset demo database.", "bad");
      }
    } catch {
      showGlobalMessage("Network error while resetting demo database.", "bad");
    } finally {
      setIsActionLoading(false);
    }
  }, [showGlobalMessage, syncControlBar, triggerRefreshHandlers]);

  const logout = useCallback(async () => {
    setIsActionLoading(true);
    try {
      await apiJson("/api/logout", { method: "POST", body: "{}" });
    } catch {
      showGlobalMessage("Backend unreachable during sign out; local session cleared.", "bad");
    } finally {
      setUser(null);
      setIsActionLoading(false);
      router.push("/login");
    }
  }, [router, showGlobalMessage]);

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => {
      if (active) {
        void syncControlBar();
      }
    });
    return () => {
      active = false;
    };
  }, [syncControlBar]);

  return (
    <AppContext.Provider
      value={{
        securityMode,
        user,
        globalBanner,
        isLoading,
        isActionLoading,
        showGlobalMessage,
        syncControlBar,
        toggleMode,
        resetDb,
        logout,
        registerRefreshHandler,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error("useApp must be used within an AppProvider");
  }
  return context;
}
