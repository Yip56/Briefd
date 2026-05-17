"use client";

import { useState } from "react";
import type { ScoredArticle } from "@/lib/types";
import { useToast } from "@/components/ui/Toast";
import { clsx } from "clsx";

export type ArticleVariant = "banner" | "twoCol" | "threeCol" | "list";

interface ArticleCardProps {
  article:  ScoredArticle;
  onRemove?: (id: string) => void;
  variant?: ArticleVariant;
}

const REASON_CHIPS: Record<string, string[]> = {
  "Economy":             ["Already knew this", "Too technical", "Not relevant to me", "Misleading headline", "Other"],
  "Finance & Investing": ["Already knew this", "Too technical", "Not relevant to me", "Misleading headline", "Other"],
  "Malaysian Politics":  ["Too political", "Not relevant to me", "Already knew this", "Biased source", "Other"],
  "Tech & AI":           ["Too technical", "Not relevant to me", "Already knew this", "Too promotional", "Other"],
  "Property":            ["Not in my area", "Not relevant to me", "Already knew this", "Other"],
  "Fuel & Transport":    ["Not relevant to me", "Already knew this", "Already resolved", "Other"],
};

function getReasonChips(topic: string | null): string[] {
  if (!topic) return ["Not relevant to me", "Already knew this", "Too long", "Other"];
  for (const key of Object.keys(REASON_CHIPS)) {
    if (topic.toLowerCase().includes(key.toLowerCase()) || key.toLowerCase().includes(topic.toLowerCase())) {
      return REASON_CHIPS[key];
    }
  }
  return ["Not relevant to me", "Already knew this", "Too long", "Other"];
}


function TopicPill({ topic, isHigh }: { topic?: string | null; isHigh?: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px", flexWrap: "wrap" }}>
      {topic && (
        <span
          style={{
            fontFamily: "var(--font-dm-mono), monospace",
            fontSize: "9px",
            letterSpacing: "0.1em",
            color: "#1D5C3A",
            background: "#e8f5ee",
            padding: "3px 8px",
            textTransform: "uppercase",
          }}
        >
          {topic}
        </span>
      )}
      {isHigh && (
        <span
          style={{
            fontFamily: "var(--font-dm-mono), monospace",
            fontSize: "9px",
            letterSpacing: "0.1em",
            color: "#B5451B",
            background: "#fff0eb",
            border: "1px solid #f5c4b4",
            padding: "3px 8px",
            textTransform: "uppercase",
          }}
        >
          HIGH IMPACT
        </span>
      )}
    </div>
  );
}

export function ArticleCard({ article, onRemove, variant = "list" }: ArticleCardProps) {
  const { showToast }          = useToast();
  const [voted,      setVoted]      = useState<"up" | null>(article.userVote === "up" ? "up" : null);
  const [showPopup,  setShowPopup]  = useState(false);
  const [reason,     setReason]     = useState<string | null>(null);
  const [freeText,   setFreeText]   = useState("");
  const [submitting, setSubmitting] = useState(false);

  const pubDate = article.published_at
    ? new Date(article.published_at).toLocaleDateString("en-MY", { day: "numeric", month: "short" })
    : null;

  const isHigh    = article.impactLevel === "high";
  const isVideo   = article.is_video === true || (article.external_id ?? "").startsWith("yt_");
  const chips     = getReasonChips(article.topic);
  const readLabel = isVideo ? "WATCH VIDEO →" : "READ FULL ARTICLE →";
  const readLabelShort = isVideo ? "Watch →" : "Read →";
  const combined = article.combined || article.summary || "";
  const safeText = /[.!?]$/.test(combined.trimEnd()) ? combined : combined + "...";

  async function handleUpvote() {
    const next = voted === "up" ? null : "up";
    setVoted(next);
    try {
      await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
        articleId:    article.external_id ?? article.id,
        vote:         "up",
        articleTitle: article.title,
        articleTopic: article.topic,
        articleUrl:   article.article_url,
        sourceName:   article.source_name ?? "",
        summary:      article.summary ?? "",
        publishedAt:  article.published_at ?? "",
      }),
      });
    } catch {
      setVoted(voted);
    }
  }

  async function handleDislikeSubmit() {
    if (!reason) return;
    setSubmitting(true);
    try {
      await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          articleId:    article.external_id ?? article.id,
          vote:         "down",
          reason,
          freeText,
          articleTopic: article.topic,
          articleTitle: article.title,
          articleUrl:   article.article_url,
          sourceName:   article.source_name ?? "",
          summary:      article.summary ?? "",
          publishedAt:  article.published_at ?? "",
        }),
      });
      setShowPopup(false);
      showToast("Got it — we'll show less of this", "success");
      onRemove?.(article.id);
    } catch {
      showToast("Failed to submit feedback", "error");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleReadClick(e: React.MouseEvent<HTMLAnchorElement>) {
    e.preventDefault();
    const url = article.article_url;
    try {
      await fetch("/api/articles/click", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ articleUrl: url }),
      });
    } catch {
      // non-critical
    }
    window.open(url, "_blank", "noopener,noreferrer");
  }

  const popup = showPopup && (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4"
      onClick={() => setShowPopup(false)}
    >
      <div
        className="bg-white shadow-xl w-full max-w-sm p-5"
        style={{ border: "1px solid rgba(0,0,0,0.15)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3
          style={{
            fontFamily: "var(--font-playfair), Georgia, serif",
            fontSize: "18px",
            color: "#0F0E0C",
            marginBottom: "16px",
          }}
        >
          What didn&apos;t work for you?
        </h3>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "12px" }}>
          {chips.map((chip) => (
            <button
              key={chip}
              type="button"
              onClick={() => setReason(chip)}
              style={{
                fontFamily: "var(--font-dm-mono), monospace",
                fontSize: "11px",
                letterSpacing: "0.04em",
                padding: "6px 12px",
                border: reason === chip ? "1px solid #1D5C3A" : "1px solid rgba(0,0,0,0.15)",
                background: reason === chip ? "#1D5C3A" : "transparent",
                color: reason === chip ? "#fff" : "#5C5750",
                cursor: "pointer",
                transition: "all 0.15s",
              }}
            >
              {chip}
            </button>
          ))}
        </div>
        <textarea
          value={freeText}
          onChange={(e) => setFreeText(e.target.value)}
          placeholder="Anything else? (optional)"
          rows={2}
          style={{
            width: "100%",
            fontFamily: "var(--font-source-serif), Georgia, serif",
            fontSize: "14px",
            border: "1px solid rgba(0,0,0,0.15)",
            padding: "8px 12px",
            resize: "none",
            outline: "none",
            marginBottom: "12px",
            background: "#F7F4EF",
          }}
        />
        <div style={{ display: "flex", gap: "8px" }}>
          <button
            type="button"
            onClick={handleDislikeSubmit}
            disabled={!reason || submitting}
            style={{
              flex: 1,
              padding: "10px",
              background: "#1D5C3A",
              color: "#fff",
              fontFamily: "var(--font-dm-mono), monospace",
              fontSize: "12px",
              letterSpacing: "0.06em",
              border: "none",
              cursor: !reason || submitting ? "not-allowed" : "pointer",
              opacity: !reason || submitting ? 0.5 : 1,
              transition: "opacity 0.15s",
            }}
          >
            {submitting ? "SUBMITTING…" : "SUBMIT FEEDBACK"}
          </button>
          <button
            type="button"
            onClick={() => setShowPopup(false)}
            style={{
              padding: "10px 16px",
              background: "transparent",
              color: "#9C9890",
              fontFamily: "var(--font-dm-mono), monospace",
              fontSize: "12px",
              border: "1px solid rgba(0,0,0,0.1)",
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );

  const feedbackRow = (
    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "8px" }}>
      <button
        type="button"
        onClick={handleUpvote}
        title="Useful"
        className={clsx(
          "transition-all text-xs px-2 py-1",
          voted === "up" ? "bg-green-100 text-green-700" : "text-[#9C9890] hover:text-[#5C5750]"
        )}
      >
        👍
      </button>
      <button
        type="button"
        onClick={() => { setReason(null); setFreeText(""); setShowPopup(true); }}
        title="Not relevant"
        className="text-xs px-2 py-1 text-[#9C9890] hover:text-[#5C5750] transition-all"
      >
        👎
      </button>
    </div>
  );

  // ── BANNER variant ─────────────────────────────────────────────────────────
  if (variant === "banner") {
    return (
      <>
        {popup}
        <div style={{ paddingBottom: "24px" }}>
          <TopicPill topic={article.topic} isHigh={isHigh} />
          <a
            href={article.article_url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={handleReadClick}
            style={{
              display: "block",
              fontFamily: "var(--font-playfair), Georgia, serif",
              fontSize: "clamp(22px, 3vw, 28px)",
              fontWeight: 700,
              color: "#0F0E0C",
              lineHeight: 1.25,
              marginBottom: "12px",
              textDecoration: "none",
              transition: "color 0.15s",
            }}
            className="hover:text-[#1D5C3A]"
          >
            {article.title}
          </a>
          <p
            style={{
              fontFamily: "var(--font-source-serif), Georgia, serif",
              fontSize: "16px",
              color: "#5C5750",
              lineHeight: 1.75,
              marginBottom: "16px",
            }}
          >
            {safeText}{isHigh ? " ⚡" : ""}
          </p>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              {article.source_name && (
                <span style={{ fontFamily: "var(--font-dm-mono), monospace", fontSize: "10px", color: "#9C9890" }}>
                  {isVideo ? "🎬 " : ""}{article.source_name}
                </span>
              )}
              {pubDate && (
                <span style={{ fontFamily: "var(--font-dm-mono), monospace", fontSize: "10px", color: "#9C9890" }}>
                  {pubDate}
                </span>
              )}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              {feedbackRow}
              <a
                href={article.article_url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={handleReadClick}
                className="read-link"
                style={{
                  fontFamily: "var(--font-dm-mono), monospace",
                  fontSize: "11px",
                  letterSpacing: "0.06em",
                  color: "#1D5C3A",
                  fontWeight: 500,
                }}
              >
                {readLabel}
              </a>
            </div>
          </div>
        </div>
      </>
    );
  }

  // ── TWOCOL variant ─────────────────────────────────────────────────────────
  if (variant === "twoCol") {
    return (
      <>
        {popup}
        <div style={{ paddingTop: "4px", paddingBottom: "20px" }}>
          <TopicPill topic={article.topic} isHigh={isHigh} />
          <a
            href={article.article_url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={handleReadClick}
            style={{
              display: "block",
              fontFamily: "var(--font-playfair), Georgia, serif",
              fontSize: "20px",
              fontWeight: 700,
              color: "#0F0E0C",
              lineHeight: 1.3,
              marginBottom: "10px",
              textDecoration: "none",
              transition: "color 0.15s",
            }}
            className="hover:text-[#1D5C3A]"
          >
            {article.title}
          </a>
          <p
            style={{
              fontFamily: "var(--font-source-serif), Georgia, serif",
              fontSize: "14px",
              color: "#5C5750",
              lineHeight: 1.7,
              marginBottom: "12px",
            }}
          >
            {safeText}{isHigh ? " ⚡" : ""}
          </p>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              {article.source_name && (
                <span style={{ fontFamily: "var(--font-dm-mono), monospace", fontSize: "10px", color: "#9C9890" }}>
                  {isVideo ? "🎬 " : ""}{article.source_name}
                </span>
              )}
              {pubDate && (
                <span style={{ fontFamily: "var(--font-dm-mono), monospace", fontSize: "10px", color: "#9C9890" }}>
                  {pubDate}
                </span>
              )}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              {feedbackRow}
              <a
                href={article.article_url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={handleReadClick}
                className="read-link"
                style={{
                  fontFamily: "var(--font-dm-mono), monospace",
                  fontSize: "10px",
                  letterSpacing: "0.06em",
                  color: "#1D5C3A",
                }}
              >
                {readLabelShort}
              </a>
            </div>
          </div>
        </div>
      </>
    );
  }

  // ── THREECOL variant ───────────────────────────────────────────────────────
  if (variant === "threeCol") {
    return (
      <>
        {popup}
        <div style={{ paddingTop: "4px", paddingBottom: "20px" }}>
          <TopicPill topic={article.topic} isHigh={isHigh} />
          <a
            href={article.article_url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={handleReadClick}
            style={{
              display: "block",
              fontFamily: "var(--font-playfair), Georgia, serif",
              fontSize: "18px",
              fontWeight: 700,
              color: "#0F0E0C",
              lineHeight: 1.3,
              marginBottom: "8px",
              textDecoration: "none",
              transition: "color 0.15s",
            }}
            className="hover:text-[#1D5C3A]"
          >
            {article.title}
          </a>
          <p
            style={{
              fontFamily: "var(--font-source-serif), Georgia, serif",
              fontSize: "13px",
              color: "#5C5750",
              lineHeight: 1.65,
              marginBottom: "10px",
              display: "-webkit-box",
              WebkitLineClamp: 3,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {safeText}{isHigh ? " ⚡" : ""}
          </p>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            {article.source_name && (
              <span style={{ fontFamily: "var(--font-dm-mono), monospace", fontSize: "9px", color: "#9C9890" }}>
                {isVideo ? "🎬 " : ""}{article.source_name}
              </span>
            )}
            {feedbackRow}
            <a
              href={article.article_url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={handleReadClick}
              className="read-link"
              style={{
                fontFamily: "var(--font-dm-mono), monospace",
                fontSize: "10px",
                letterSpacing: "0.04em",
                color: "#1D5C3A",
                marginLeft: "auto",
              }}
            >
              {readLabelShort}
            </a>
          </div>
        </div>
      </>
    );
  }

  // ── LIST variant (default) ─────────────────────────────────────────────────
  return (
    <>
      {popup}
      <div style={{ padding: "14px 0" }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: "10px", flexWrap: "wrap" }}>
          {article.topic && (
            <span
              style={{
                fontFamily: "var(--font-dm-mono), monospace",
                fontSize: "9px",
                letterSpacing: "0.1em",
                color: "#1D5C3A",
                background: "#e8f5ee",
                padding: "3px 8px",
                textTransform: "uppercase",
                flexShrink: 0,
                marginTop: "2px",
              }}
            >
              {article.topic}
            </span>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <a
              href={article.article_url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={handleReadClick}
              style={{
                display: "block",
                fontFamily: "var(--font-playfair), Georgia, serif",
                fontSize: "15px",
                fontWeight: 700,
                color: "#0F0E0C",
                lineHeight: 1.3,
                marginBottom: "4px",
                textDecoration: "none",
                transition: "color 0.15s",
              }}
              className="hover:text-[#1D5C3A]"
            >
              {article.title}
            </a>
            <p
              style={{
                fontFamily: "var(--font-source-serif), Georgia, serif",
                fontSize: "13px",
                color: "#5C5750",
                lineHeight: 1.6,
              }}
            >
              {safeText}{isHigh ? " ⚡" : ""}
            </p>
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              flexShrink: 0,
              marginTop: "2px",
            }}
          >
            {feedbackRow}
            {article.source_name && (
              <span style={{ fontFamily: "var(--font-dm-mono), monospace", fontSize: "9px", color: "#9C9890" }}>
                {isVideo ? "🎬 " : ""}{article.source_name}
              </span>
            )}
            <a
              href={article.article_url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={handleReadClick}
              className="read-link"
              style={{
                fontFamily: "var(--font-dm-mono), monospace",
                fontSize: "10px",
                color: "#1D5C3A",
              }}
            >
              {readLabelShort}
            </a>
          </div>
        </div>
      </div>
    </>
  );
}
