"use client";

import { useState } from "react";
import type { ScoredArticle } from "@/lib/types";
import { GEMINI_QUOTA_EXCEEDED } from "@/lib/ai/summarise";
import { useToast } from "@/components/ui/Toast";
import { clsx } from "clsx";

interface ArticleCardProps {
  article: ScoredArticle;
  onRemove?: (id: string) => void;
}

const REASON_CHIPS: Record<string, string[]> = {
  "Economy":            ["Already knew this", "Too technical", "Not relevant to me", "Misleading headline", "Other"],
  "Finance & Investing":["Already knew this", "Too technical", "Not relevant to me", "Misleading headline", "Other"],
  "Malaysian Politics": ["Too political", "Not relevant to me", "Already knew this", "Biased source", "Other"],
  "Tech & AI":          ["Too technical", "Not relevant to me", "Already knew this", "Too promotional", "Other"],
  "Property":           ["Not in my area", "Not relevant to me", "Already knew this", "Other"],
  "Fuel & Transport":   ["Not relevant to me", "Already knew this", "Already resolved", "Other"],
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

export function ArticleCard({ article, onRemove }: ArticleCardProps) {
  const { showToast }        = useToast();
  const [voted,     setVoted]     = useState<"up" | null>(article.userVote === "up" ? "up" : null);
  const [showPopup, setShowPopup] = useState(false);
  const [reason,    setReason]    = useState<string | null>(null);
  const [freeText,  setFreeText]  = useState("");
  const [submitting,setSubmitting]= useState(false);

  const pubDate = article.published_at
    ? new Date(article.published_at).toLocaleDateString("en-MY", { day: "numeric", month: "short" })
    : null;

  async function handleUpvote() {
    const next = voted === "up" ? null : "up";
    setVoted(next);
    try {
      await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ articleId: article.external_id ?? article.id, vote: "up" }),
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

  const isHigh = article.impactLevel === "high";
  const chips  = getReasonChips(article.topic);

  return (
    <>
      {/* Dislike popup overlay */}
      {showPopup && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4"
          onClick={() => setShowPopup(false)}
        >
          <div
            className="bg-white rounded-xl shadow-xl w-full max-w-sm p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-medium text-gray-900 mb-3 text-[15px]">
              What didn&apos;t work for you?
            </h3>
            <div className="flex flex-wrap gap-2 mb-3">
              {chips.map((chip) => (
                <button
                  key={chip}
                  type="button"
                  onClick={() => setReason(chip)}
                  className={clsx(
                    "px-3 py-1.5 rounded-full text-xs font-medium border transition-colors",
                    reason === chip
                      ? "bg-brand text-white border-brand"
                      : "bg-white text-gray-600 border-gray-200 hover:border-brand hover:text-brand"
                  )}
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
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-brand mb-3"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleDislikeSubmit}
                disabled={!reason || submitting}
                className="flex-1 py-2 bg-brand text-white text-sm font-medium rounded-lg disabled:opacity-40 hover:bg-brand-hover transition-colors"
              >
                {submitting ? "Submitting…" : "Submit feedback"}
              </button>
              <button
                type="button"
                onClick={() => setShowPopup(false)}
                className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Article card */}
      <div className="py-5">
        {/* Topic pill + impact badge */}
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          {article.topic && (
            <span className="px-2 py-0.5 rounded-full bg-brand-light text-brand text-[10px] font-semibold uppercase tracking-wide">
              {article.topic}
            </span>
          )}
          {isHigh && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-orange-50 text-orange-600 border border-orange-200">
              High impact
            </span>
          )}
        </div>

        {/* Headline */}
        <a
          href={article.article_url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={handleReadClick}
          className="block text-[16px] font-[500] text-gray-900 leading-snug hover:text-brand transition-colors mb-2"
        >
          {article.title}
        </a>

        {/* AI summary */}
        <p className="text-[14px] text-gray-600 leading-[1.8] mb-3">
          {article.aiSummary || article.summary}
        </p>

        {/* Impact analysis block */}
        {article.impactAnalysis &&
         article.impactAnalysis !== "Impact analysis unavailable for this article." &&
         article.impactAnalysis !== GEMINI_QUOTA_EXCEEDED && (
          <div
            style={{
              background: "#FDF8ED",
              borderLeft: "2px solid #F0A500",
              padding: "10px 14px",
              borderRadius: "6px",
              marginBottom: "12px",
            }}
          >
            <span
              style={{
                fontSize: "11px",
                fontVariant: "small-caps",
                color: "#B07800",
                fontWeight: 500,
                letterSpacing: "0.04em",
                display: "block",
                marginBottom: "4px",
              }}
            >
              ⚡ Impacts you
            </span>
            <p style={{ fontSize: "13px", fontStyle: "italic", color: "#5C4A00", margin: 0, lineHeight: 1.6 }}>
              {article.impactAnalysis}
            </p>
          </div>
        )}

        {/* Footer row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            {/* Thumbs up */}
            <button
              type="button"
              onClick={handleUpvote}
              title="Useful"
              className={clsx(
                "px-2.5 py-1 rounded-md text-xs transition-all flex items-center gap-1",
                voted === "up"
                  ? "bg-green-100 text-green-600 font-semibold"
                  : "text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              )}
            >
              👍
            </button>
            {/* Thumbs down */}
            <button
              type="button"
              onClick={() => { setReason(null); setFreeText(""); setShowPopup(true); }}
              title="Not relevant"
              className="px-2.5 py-1 rounded-md text-xs text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-all"
            >
              👎
            </button>
          </div>
          <div className="flex items-center gap-3">
            {article.source_name && (
              <span className="text-xs text-gray-300">{article.source_name}</span>
            )}
            {pubDate && <span className="text-xs text-gray-300">{pubDate}</span>}
            <a
              href={article.article_url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={handleReadClick}
              className="text-xs text-brand font-medium hover:underline"
            >
              Read full article →
            </a>
          </div>
        </div>
      </div>
    </>
  );
}
