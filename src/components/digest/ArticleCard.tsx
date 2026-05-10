"use client";

import { useState } from "react";
import type { ScoredArticle, VoteValue } from "@/lib/types";
import { clsx } from "clsx";

interface ArticleCardProps {
  article: ScoredArticle;
}

const IMPACT_BADGE: Record<string, { label: string; className: string }> = {
  high:   { label: "High impact", className: "bg-orange-50 text-orange-600 border border-orange-200" },
  medium: { label: "Medium",      className: "bg-amber-50  text-amber-600  border border-amber-200"  },
  low:    { label: "Low",         className: "bg-gray-50   text-gray-500   border border-gray-200"   },
};

export function ArticleCard({ article }: ArticleCardProps) {
  const [vote,    setVote]    = useState<VoteValue | null>(article.userVote ?? null);
  const [voting,  setVoting]  = useState(false);

  const pubDate = article.published_at
    ? new Date(article.published_at).toLocaleDateString("en-MY", { day: "numeric", month: "short" })
    : null;

  async function handleVote(v: VoteValue) {
    if (voting) return;
    const next = vote === v ? null : v;
    setVote(next);          // optimistic
    setVoting(true);
    try {
      await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          articleId: article.external_id ?? article.id,
          vote: next ?? v,
        }),
      });
    } catch {
      setVote(vote);         // rollback on failure
    } finally {
      setVoting(false);
    }
  }

  const impact = IMPACT_BADGE[article.impactLevel] ?? IMPACT_BADGE.medium;
  const isHigh = article.impactLevel === "high";

  return (
    <div
      className={clsx(
        "bg-white rounded-xl overflow-hidden transition-shadow hover:shadow-sm flex",
        isHigh ? "ring-1 ring-orange-200" : "card-border"
      )}
    >
      {/* Left accent for high-impact */}
      {isHigh && <div className="w-1 shrink-0 bg-orange-400" />}

      <div className="flex-1 p-5">
        {/* Meta row */}
        <div className="flex items-center justify-between gap-2 mb-2.5">
          <div className="flex items-center gap-2 flex-wrap">
            {article.source_name && (
              <span className="text-[10px] font-semibold tracking-widest uppercase text-gray-400">
                {article.source_name}
              </span>
            )}
            {article.topic && (
              <span className="px-2 py-0.5 rounded-full bg-brand-light text-brand text-[10px] font-semibold">
                {article.topic}
              </span>
            )}
          </div>
          <span
            className={clsx(
              "shrink-0 px-2 py-0.5 rounded-full text-[10px] font-semibold",
              impact.className
            )}
          >
            {impact.label}
          </span>
        </div>

        {/* Title */}
        <a
          href={article.article_url}
          target="_blank"
          rel="noopener noreferrer"
          className="block text-[15px] font-medium text-gray-900 leading-snug hover:text-brand transition-colors mb-2"
        >
          {article.title}
        </a>

        {/* AI summary */}
        <p className="text-sm text-gray-500 leading-relaxed line-clamp-3 mb-3.5">
          {article.aiSummary || article.summary}
        </p>

        {/* Footer row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            <VoteButton
              emoji="👍"
              active={vote === "up"}
              disabled={voting}
              onClick={() => handleVote("up")}
              label="Useful"
            />
            <VoteButton
              emoji="👎"
              active={vote === "down"}
              disabled={voting}
              onClick={() => handleVote("down")}
              label="Not relevant"
            />
          </div>
          <div className="flex items-center gap-3">
            {pubDate && <span className="text-xs text-gray-300">{pubDate}</span>}
            <a
              href={article.article_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-brand font-medium hover:underline"
            >
              Read full article →
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

function VoteButton({
  emoji, active, disabled, onClick, label,
}: {
  emoji: string; active: boolean; disabled: boolean; onClick: () => void; label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      className={clsx(
        "px-2.5 py-1 rounded-md text-xs transition-all flex items-center gap-1",
        active
          ? "bg-brand-light text-brand font-semibold"
          : "text-gray-400 hover:bg-gray-100 hover:text-gray-600",
        disabled && "opacity-50 cursor-not-allowed"
      )}
    >
      <span>{emoji}</span>
    </button>
  );
}
