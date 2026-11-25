import React from "react";
import { formatTime } from "../lib/api";

export interface AuditLogEntry {
  id?: number;
  created_at?: string;
  security_mode?: string;
  http_method?: string;
  endpoint?: string;
  actor_username?: string;
  status_code?: number | string;
  detail?: string;
}

interface AuditTableProps {
  logs: AuditLogEntry[];
  loading?: boolean;
  errorMessage?: string | null;
  emptyMessage?: string;
}

export function AuditTable({
  logs,
  loading = false,
  errorMessage = null,
  emptyMessage = "No audit log entries recorded yet.",
}: AuditTableProps) {
  return (
    <div className="table-scroll">
      <table className="data-table">
        <thead>
          <tr>
            <th>Timestamp</th>
            <th>Mode</th>
            <th>Request</th>
            <th>Actor (Status)</th>
            <th>Detail</th>
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr>
              <td colSpan={5} className="empty-state">
                Loading recent security audit entries…
              </td>
            </tr>
          ) : errorMessage ? (
            <tr>
              <td colSpan={5} className="empty-state">
                {errorMessage}
              </td>
            </tr>
          ) : logs.length === 0 ? (
            <tr>
              <td colSpan={5} className="empty-state">
                {emptyMessage}
              </td>
            </tr>
          ) : (
            logs.map((entry, idx) => {
              const isSecure = entry.security_mode === "SECURE";
              const rowClass = isSecure ? "row--secure" : "row--vuln";
              const chipClass = isSecure ? "chip--secure" : "chip--vuln";
              return (
                <tr key={entry.id ?? idx} className={rowClass}>
                  <td className="measured">{formatTime(entry.created_at)}</td>
                  <td>
                    <span className={`chip ${chipClass}`}>
                      {entry.security_mode || "-"}
                    </span>
                  </td>
                  <td className="measured">
                    {entry.http_method} {entry.endpoint}
                  </td>
                  <td className="measured">
                    {entry.actor_username || "anonymous"} ({entry.status_code})
                  </td>
                  <td className="measured">{entry.detail || "-"}</td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
