"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { LoadingDots } from "@/components/ui/LoadingDots";
import type { DigestArchive, ScoredArticle } from "@/lib/types";

function ArticleRow({ article }: { article: ScoredArticle }) {
  const pubDate = article.published_at
    ? new Date(article.published_at).toLocaleDateString("en-MY", { day: "numeric", month: "short" })
    : null;

  return (
    <div className="py-4 border-b border-gray-50 last:border-0">
      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
        {article.topic && (
          <span className="px-2 py-0.5 rounded-full bg-brand-light text-brand text-[10px] font-semibold uppercase tracking-wide">
            {article.topic}
          </span>
        )}
      </div>
      <a
        href={article.article_url}
        target="_blank"
        rel="noopener noreferrer"
        className="block text-[15px] font-medium text-gray-900 hover:text-brand transition-colors leading-snug mb-1.5"
      >
        {article.title}
      </a>
      <p className="text-[13px] text-gray-500 leading-relaxed line-clamp-2 mb-2">
        {(article as ScoredArticle & { aiSummary?: string }).aiSummary || article.summary}
      </p>
      <div className="flex items-center gap-3 text-xs text-gray-300">
        {article.source_name && <span>{article.source_name}</span>}
        {pubDate && <span>{pubDate}</span>}
        <a
          href={article.article_url}
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-brand transition-colors"
        >
          Read →
        </a>
      </div>
    </div>
  );
}

function ArchiveEntry({ archive }: { archive: DigestArchive }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border border-gray-100 rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-gray-50 transition-colors"
      >
        <div>
          <p className="text-[15px] font-medium text-gray-800">
            {archive.label ?? new Date(archive.archived_at).toLocaleDateString("en-MY", {
              weekday: "long", day: "numeric", month: "long",
            })}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">
            {archive.articles.length} article{archive.articles.length !== 1 ? "s" : ""}
          </p>
        </div>
        <span className="text-gray-300 text-sm">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="px-5 pb-2">
          {archive.articles.map((a, i) => (
            <ArticleRow key={a.id ?? i} article={a} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function ArchivePage() {
  const [archives, setArchives] = useState<DigestArchive[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/archives")
      .then((r) => r.json())
      .then((data) => setArchives(Array.isArray(data) ? data : []))
      .catch(() => setError("Failed to load archives"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="max-w-2xl">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="font-serif text-3xl text-brand mb-1">Archive</h1>
          <p className="text-sm text-gray-500">Your past digests, saved each time you refresh.</p>
        </div>
        <Link
          href="/"
          className="text-sm text-gray-400 hover:text-brand transition-colors"
        >
          ← Today
        </Link>
      </div>

      {loading && (
        <div className="flex items-center gap-2 py-8 text-gray-400 text-sm">
          <LoadingDots /> Loading…
        </div>
      )}

      {error && (
        <p className="text-sm text-red-400 py-8">{error}</p>
      )}

      {!loading && !error && archives.length === 0 && (
        <div className="text-center py-20">
          <div className="text-4xl mb-4">🗂️</div>
          <p className="font-serif text-xl text-gray-700 mb-2">No archives yet</p>
          <p className="text-sm text-gray-400 max-w-xs mx-auto">
            Each time you hit &ldquo;Refresh digest&rdquo; on the home page, your current digest is saved here.
          </p>
        </div>
      )}

      {!loading && archives.length > 0 && (
        <div className="space-y-3">
          {archives.map((a) => (
            <ArchiveEntry key={a.id} archive={a} />
          ))}
        </div>
      )}
    </div>
  );
}
