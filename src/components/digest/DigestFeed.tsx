"use client";

import { useEffect, useState, useCallback } from "react";
import { ArticleCard } from "./ArticleCard";
import { FilterBar } from "./FilterBar";
import { DigestErrorBoundary } from "./DigestErrorBoundary";
import { LoadingDots } from "@/components/ui/LoadingDots";
import { useToast } from "@/components/ui/Toast";
import type { DigestResult, ScoredArticle } from "@/lib/types";

function DigestFeedInner() {
  const { showToast } = useToast();

  const [digest,      setDigest]      = useState<DigestResult | null>(null);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState<string | null>(null);
  const [activeTopic, setActiveTopic] = useState<string | null>(null);
  const [refreshing,  setRefreshing]  = useState(false);

  const fetchDigest = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else           setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/digest");
      if (!res.ok) throw new Error(`Server error ${res.status}`);
      const data: DigestResult = await res.json();
      setDigest(data);
      setActiveTopic(null);
      if (isRefresh) showToast("Digest refreshed", "success");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to load digest";
      setError(msg);
      if (isRefresh) showToast(msg, "error");
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
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="font-serif text-2xl text-gray-900">
            {greeting()}, here&apos;s your digest
          </h1>
          <p className="text-xs text-gray-400 mt-0.5">
            {digest.totalScored} articles scored ·{" "}
            {new Date(digest.generatedAt).toLocaleTimeString("en-MY", {
              hour: "2-digit", minute: "2-digit",
            })}
          </p>
        </div>
        <button
          onClick={() => fetchDigest(true)}
          disabled={refreshing}
          className="text-xs text-gray-400 hover:text-brand transition-colors disabled:opacity-50"
        >
          {refreshing ? "Refreshing…" : "↻ Refresh"}
        </button>
      </div>

      {/* Topic filter */}
      <div className="mb-5">
        <FilterBar topics={uniqueTopics} activeTopic={activeTopic} onSelect={setActiveTopic} />
      </div>

      {/* Articles */}
      <div className="space-y-3">
        {visible.map((article) => (
          <ArticleCard key={article.id} article={article} />
        ))}
      </div>

      {/* Bottom refresh */}
      <div className="text-center mt-10 pb-4">
        <button
          onClick={() => fetchDigest(true)}
          disabled={refreshing}
          className="px-5 py-2 border border-gray-200 rounded-full text-sm text-gray-500 hover:border-brand hover:text-brand transition-all disabled:opacity-50"
        >
          {refreshing ? "Refreshing digest…" : "Refresh digest"}
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

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}
