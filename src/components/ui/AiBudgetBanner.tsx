"use client";

import { useState } from "react";

export function AiBudgetBanner() {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  return (
    <div
      style={{
        marginBottom: "12px",
        display: "flex",
        alignItems: "flex-start",
        gap: "10px",
        padding: "12px 14px",
        background: "#FDF8ED",
        borderLeft: "3px solid #C9972A",
        fontFamily: "var(--font-source-serif), Georgia, serif",
        fontSize: "13px",
        color: "#5C4A00",
      }}
    >
      <span style={{ flexShrink: 0 }}>⚠️</span>
      <span style={{ flex: 1 }}>
        <strong>AI daily limit reached</strong> — digest still works with cached summaries.
        Resets at 12:00 AM MYT (UTC+8).{" "}
        <a
          href="/settings#ai-usage"
          style={{ color: "#C9972A", textDecoration: "underline" }}
        >
          View usage
        </a>
      </span>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        aria-label="Dismiss"
        style={{
          flexShrink: 0,
          background: "none",
          border: "none",
          cursor: "pointer",
          color: "#9C8240",
          fontSize: "14px",
          lineHeight: 1,
          padding: "0 2px",
        }}
      >
        ✕
      </button>
    </div>
  );
}
