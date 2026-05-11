"use client";

import { useEffect, useState, useCallback } from "react";
import { FilterBar } from "./FilterBar";
import { DigestErrorBoundary } from "./DigestErrorBoundary";
import { LoadingDots } from "@/components/ui/LoadingDots";
import { useToast } from "@/components/ui/Toast";
import type { DigestResult, ScoredArticle } from "@/lib/types";
import { clsx } from "clsx";

function formatDateHeader(): string {
  const now = new Date();
  const day = now.toLocaleDateString("en-MY", { weekday: "long" });
  const date = now.toLocaleDateString("en-MY", { day: "numeric", month: "long", year: "numeric" });
  return `${day}, ${date} — Your Morning Briefing`;
}

const IMPACT_COLORS: Record<string, string> = {
  high:   "bg-orange-50 text-orange-600 border border-orange-200",
  medium: "bg-amber-50 text-amber-600 border border-amber-200",
  low:    "bg-gray-50 text-gray-400 border border-gray-200",
};

function ArticleBlock({ article }: { article: ScoredArticle }) {
  const isHigh = article.impactLevel === "high";

  return (
    <div className="py-5">
      {/* Topic pill + impact badge */}
      <div className="flex items-center gap-2 mb-2 flex-wrap">
        {article.topic && (
          <span className="px-2 py-0.5 rounded-full bg-brand-light text-brand text-[10px] font-semibold uppercase tracking-wide">
            {article.topic}
          </span>
        )}
        {isHigh && (
          <span className={clsx("px-2 py-0.5 rounded-full text-[10px] font-semibold", IMPACT_COLORS.high)}>
            High impact
          </span>
        )}
      </div>

      {/* Headline */}
      <a
        href={article.article_url}
        target="_blank"
        rel="noopener noreferrer"
        className="block text-[16px] font-[500] text-gray-900 leading-snug hover:text-brand transition-colors mb-2"
      >
        {article.title}
      </a>

      {/* AI summary */}
      <p className="text-[14px] text-gray-600 leading-[1.8] mb-3">
        {article.aiSummary || article.summary}
      </p>

      {/* Source + read link */}
      <div className="flex items-center gap-3 text-xs text-gray-400">
        {article.source_name && <span>{article.source_name}</span>}
        <a
          href={article.article_url}
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-brand transition-colors"
        >
          Read full article →
        </a>
      </div>
    </div>
  );
}

function DigestFeedInner() {
  const { showToast } = useToast();

  const [digest,      setDigest]      = useState<DigestResult | null>(null);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState<string | null>(null);
  const [activeTopic, setActiveTopic] = useState<string | null>(null);
  const [refreshing,  setRefreshing]  = useState(false);

  const fetchDigest = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const url = isRefresh ? `/api/digest?t=${Date.now()}` : "/api/digest";
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Server error ${res.status}`);
      const data: DigestResult = await res.json();
      setDigest(data);
      setActiveTopic(null);
      if (isRefresh) showToast("Digest refreshed", "success");
    } catch {
      if (isRefresh) {
        showToast("Could not refresh — check your connection", "error");
      } else {
        setError("Failed to load digest");
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [showToast]);

  useEffect(() => { fetchDigest(); }, [fetchDigest]);

  const uniqueTopics = digest
    ? [...new Set(digest.articles.map((a) => a.topic).filter(Boolean))] as string[]
    : [];

  const visible: ScoredArticle[] = digest
    ? activeTopic
      ? digest.articles.filter((a) => a.topic === activeTopic)
      : digest.articles
    : [];

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <LoadingDots />
        <p className="text-sm text-gray-400">Building your digest…</p>
        <p className="text-xs text-gray-300">This takes 15–30 seconds on first load.</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-16">
        <p className="font-serif text-lg text-gray-700 mb-2">Something went wrong</p>
        <p className="text-sm text-gray-400 mb-6">{error}</p>
        <button
          onClick={() => fetchDigest()}
          className="px-5 py-2 bg-brand text-white text-sm font-medium rounded-lg hover:bg-brand-hover transition-colors"
        >
          Try again
        </button>
      </div>
    );
  }

  if (!digest || digest.articles.length === 0) {
    return (
      <div className="text-center py-20">
        <div className="text-4xl mb-4">📭</div>
        <p className="font-serif text-xl text-gray-700 mb-2">No news matched your topics today</p>
        <p className="text-sm text-gray-400 mb-6 max-w-xs mx-auto">
          Try adding more topics or custom keywords in{" "}
          <a href="/settings" className="text-brand underline">Settings</a>.
        </p>
        <button
          onClick={() => fetchDigest(true)}
          disabled={refreshing}
          className="text-sm text-brand underline disabled:opacity-50"
        >
          {refreshing ? "Checking again…" : "Refresh now"}
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl">
      {/* Date header */}
      <div className="mb-6">
        <p className="text-xs text-gray-400 uppercase tracking-widest font-medium mb-1">
          {formatDateHeader()}
        </p>
        <div className="flex items-center justify-between">
          <p className="text-xs text-gray-300">
            {digest.totalScored} articles scored ·{" "}
            {new Date(digest.generatedAt).toLocaleTimeString("en-MY", {
              hour: "2-digit", minute: "2-digit",
            })}
          </p>
          <button
            onClick={() => fetchDigest(true)}
            disabled={refreshing}
            className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-brand transition-colors disabled:opacity-50"
          >
            {refreshing ? <LoadingDots /> : "↻ Refresh"}
          </button>
        </div>
      </div>

      {/* Minimal filter bar */}
      <div className="mb-4">
        <FilterBar topics={uniqueTopics} activeTopic={activeTopic} onSelect={setActiveTopic} />
      </div>

      {/* Refreshing overlay indicator */}
      {refreshing && (
        <div className="flex items-center gap-2 py-2 text-xs text-gray-400 mb-2">
          <LoadingDots />
          <span>Fetching latest articles…</span>
        </div>
      )}

      {/* Articles — newspaper flowing style */}
      <div>
        {visible.map((article, i) => (
          <div key={article.id}>
            <ArticleBlock article={article} />
            {i < visible.length - 1 && (
              <hr className="border-t border-gray-100" />
            )}
          </div>
        ))}
      </div>

      {/* Bottom refresh */}
      <div className="text-center mt-10 pb-4">
        <button
          onClick={() => fetchDigest(true)}
          disabled={refreshing}
          className="px-5 py-2 border border-gray-200 rounded-full text-sm text-gray-500 hover:border-brand hover:text-brand transition-all disabled:opacity-50"
        >
          {refreshing ? <LoadingDots /> : "Refresh digest"}
        </button>
      </div>
    </div>
  );
}

export function DigestFeed() {
  return (
    <DigestErrorBoundary>
      <DigestFeedInner />
    </DigestErrorBoundary>
  );
}
