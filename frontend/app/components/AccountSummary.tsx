import React from "react";
import { UserSession } from "../context/AppContext";
import { formatIDR } from "../lib/api";

interface AccountSummaryProps {
  user: UserSession;
}

export function AccountSummary({ user }: AccountSummaryProps) {
  const isAdmin = user.role === "admin";

  return (
    <section className="panels panels--two" aria-label="Account summary">
      <div className="panel">
        <span className="stat-label">Available balance</span>
        <div id="walletBalance" className="reading">
          {formatIDR(user.balance)}
        </div>
        <span className="stat-label stat-meta measured" id="walletAccount">
          Account: {user.accountNumber}
        </span>
      </div>
      <div className="panel">
        <span className="stat-label">Account holder</span>
        <div id="walletFullName" className="measured">
          {user.fullName} ({user.username})
        </div>
        <div>
          <span
            id="walletRole"
            className={`chip ${isAdmin ? "chip--amber" : "chip--cool"}`}
          >
            {user.role}
          </span>
        </div>
      </div>
    </section>
  );
}
