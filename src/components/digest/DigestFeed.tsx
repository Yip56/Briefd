"use client";

import { useEffect, useState, useCallback } from "react";
import { FilterBar } from "./FilterBar";
import { ArticleCard } from "./ArticleCard";
import { DigestErrorBoundary } from "./DigestErrorBoundary";
import { LoadingDots } from "@/components/ui/LoadingDots";
import { useToast } from "@/components/ui/Toast";
import type { DigestResult, ScoredArticle } from "@/lib/types";

function formatDateHeader(): string {
  const now  = new Date();
  const day  = now.toLocaleDateString("en-MY", { weekday: "long" });
  const date = now.toLocaleDateString("en-MY", { day: "numeric", month: "long", year: "numeric" });
  return `${day}, ${date} — Your Morning Briefing`;
}

function DigestFeedInner() {
  const { showToast } = useToast();

  const [digest,      setDigest]      = useState<DigestResult | null>(null);
  const [articles,    setArticles]    = useState<ScoredArticle[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState<string | null>(null);
  const [activeTopic, setActiveTopic] = useState<string | null>(null);
  const [refreshing,  setRefreshing]  = useState(false);

  const fetchDigest = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    setError(null);

    try {
      const url  = isRefresh ? `/api/digest?t=${Date.now()}` : "/api/digest";
      const res  = await fetch(url);
      if (!res.ok) throw new Error(`Server error ${res.status}`);
      const data: DigestResult = await res.json();
      setDigest(data);
      setArticles(data.articles);
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

  function removeArticle(id: string) {
    setArticles((prev) => prev.filter((a) => a.id !== id));
  }

  const uniqueTopics = articles.length > 0
    ? [...new Set(articles.map((a) => a.topic).filter(Boolean))] as string[]
    : [];

  const visible = activeTopic
    ? articles.filter((a) => a.topic === activeTopic)
    : articles;

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

  if (!digest || articles.length === 0) {
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

      {/* Filter bar */}
      <div className="mb-4">
        <FilterBar topics={uniqueTopics} activeTopic={activeTopic} onSelect={setActiveTopic} />
      </div>

      {refreshing && (
        <div className="flex items-center gap-2 py-2 text-xs text-gray-400 mb-2">
          <LoadingDots />
          <span>Fetching latest articles…</span>
        </div>
      )}

      {/* Articles */}
      <div>
        {visible.map((article, i) => (
          <div key={article.id}>
            <ArticleCard article={article} onRemove={removeArticle} />
            {i < visible.length - 1 && <hr className="border-t border-gray-100" />}
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
