"use client";

import React from "react";
import { useApp } from "../context/AppContext";

export function GlobalBanner() {
  const { globalBanner } = useApp();

  if (!globalBanner) return null;

  return (
    <div
      id="globalBanner"
      className={`status-banner status-banner--${globalBanner.tone}`}
      role="status"
      aria-live="polite"
    >
      {globalBanner.text}
    </div>
  );
}
