"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { FilterBar } from "./FilterBar";
import { ArticleCard } from "./ArticleCard";
import { DigestSkeleton } from "./DigestSkeleton";
import { DigestErrorBoundary } from "./DigestErrorBoundary";
import { useToast } from "@/components/ui/Toast";
import type { DigestResult, ScoredArticle, DigestArchive } from "@/lib/types";
import { GEMINI_QUOTA_EXCEEDED } from "@/lib/constants";

// ─── Date helpers ─────────────────────────────────────────────────────────────

function formatDigestDate(): string {
  const now = new Date();
  const day  = now.toLocaleDateString("en-MY", { weekday: "long" }).toUpperCase();
  const d    = now.getDate();
  const mon  = now.toLocaleDateString("en-MY", { month: "long" }).toUpperCase();
  const yr   = now.getFullYear();
  return `${day} · ${d} ${mon} ${yr}`;
}

// ─── Newspaper grid ───────────────────────────────────────────────────────────

function NewspaperGrid({
  articles,
  onRemove,
}: {
  articles: ScoredArticle[];
  onRemove: (id: string) => void;
}) {
  if (articles.length === 0) return null;

  const banner    = articles[0];
  const twoCol    = articles.slice(1, 3);
  const threeCol  = articles.slice(3, 6);
  const listItems = articles.slice(6);

  return (
    <div>
      {/* Banner article */}
      <div className="animate-fadeUp-1">
        <ArticleCard article={banner} onRemove={onRemove} variant="banner" />
        <div style={{ borderBottom: "3px solid #0F0E0C", marginBottom: "28px" }} />
      </div>

      {/* 2-column */}
      {twoCol.length > 0 && (
        <div
          className="animate-fadeUp-2"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: 0,
            marginBottom: "4px",
          }}
        >
          {twoCol.map((a, i) => (
            <div
              key={a.id}
              style={{
                paddingRight: i === 0 ? "28px" : undefined,
                paddingLeft:  i === 1 ? "28px" : undefined,
                borderRight:  i === 0 && twoCol.length > 1 ? "1px solid rgba(0,0,0,0.12)" : undefined,
              }}
            >
              <ArticleCard article={a} onRemove={onRemove} variant="twoCol" />
            </div>
          ))}
        </div>
      )}

      {/* 3-column */}
      {threeCol.length > 0 && (
        <div
          className="animate-fadeUp-3"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 0,
            borderTop: "1px solid rgba(0,0,0,0.12)",
            paddingTop: "20px",
            marginBottom: "4px",
          }}
        >
          {threeCol.map((a, i) => (
            <div
              key={a.id}
              style={{
                paddingRight: i < 2 ? "20px" : undefined,
                paddingLeft:  i > 0 ? "20px" : undefined,
                borderRight:  i < threeCol.length - 1 ? "1px solid rgba(0,0,0,0.12)" : undefined,
              }}
            >
              <ArticleCard article={a} onRemove={onRemove} variant="threeCol" />
            </div>
          ))}
        </div>
      )}

      {/* List */}
      {listItems.length > 0 && (
        <div
          className="animate-fadeUp-4"
          style={{ borderTop: "1px solid rgba(0,0,0,0.12)", paddingTop: "4px" }}
        >
          {listItems.map((a, i) => (
            <div key={a.id}>
              <ArticleCard article={a} onRemove={onRemove} variant="list" />
              {i < listItems.length - 1 && (
                <div style={{ borderBottom: "1px solid rgba(0,0,0,0.08)" }} />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Past digests accordion ───────────────────────────────────────────────────

function ArchiveArticleRow({ article }: { article: ScoredArticle }) {
  const pubDate = article.published_at
    ? new Date(article.published_at).toLocaleDateString("en-MY", { day: "numeric", month: "short" })
    : null;

  return (
    <div style={{ padding: "12px 0", borderBottom: "1px solid rgba(0,0,0,0.08)" }}>
      {article.topic && (
        <span
          style={{
            display: "inline-block",
            fontFamily: "var(--font-dm-mono), monospace",
            fontSize: "9px",
            letterSpacing: "0.1em",
            color: "#5C5750",
            background: "#F0ECE4",
            padding: "2px 6px",
            textTransform: "uppercase",
            marginBottom: "4px",
          }}
        >
          {article.topic}
        </span>
      )}
      <a
        href={article.article_url}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          display: "block",
          fontFamily: "var(--font-playfair), Georgia, serif",
          fontSize: "14px",
          fontWeight: 600,
          color: "#0F0E0C",
          marginBottom: "4px",
          textDecoration: "none",
          transition: "color 0.15s",
          lineHeight: 1.35,
        }}
        className="hover:text-[#1D5C3A]"
      >
        {article.title}
      </a>
      <p
        style={{
          fontFamily: "var(--font-source-serif), Georgia, serif",
          fontSize: "12px",
          color: "#9C9890",
          lineHeight: 1.6,
          marginBottom: "4px",
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
        }}
      >
        {article.aiSummary || article.summary}
      </p>
      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        {article.source_name && (
          <span style={{ fontFamily: "var(--font-dm-mono), monospace", fontSize: "9px", color: "#9C9890" }}>
            {article.source_name}
          </span>
        )}
        {pubDate && (
          <span style={{ fontFamily: "var(--font-dm-mono), monospace", fontSize: "9px", color: "#9C9890" }}>
            {pubDate}
          </span>
        )}
        <a
          href={article.article_url}
          target="_blank"
          rel="noopener noreferrer"
          style={{ fontFamily: "var(--font-dm-mono), monospace", fontSize: "9px", color: "#1D5C3A" }}
        >
          Read →
        </a>
      </div>
    </div>
  );
}

function ArchiveEntry({ archive }: { archive: DigestArchive }) {
  const [open, setOpen] = useState(false);
  const label = archive.label ??
    new Date(archive.archived_at).toLocaleTimeString("en-MY", { hour: "2-digit", minute: "2-digit" });

  return (
    <div style={{ border: "1px solid rgba(0,0,0,0.1)", marginBottom: "6px" }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "12px 16px",
          background: open ? "#F0ECE4" : "transparent",
          border: "none",
          cursor: "pointer",
          transition: "background 0.15s",
        }}
      >
        <span
          style={{
            fontFamily: "var(--font-dm-mono), monospace",
            fontSize: "11px",
            letterSpacing: "0.06em",
            color: "#5C5750",
          }}
        >
          {label.toUpperCase()}
        </span>
        <span style={{ fontFamily: "var(--font-dm-mono), monospace", fontSize: "10px", color: "#9C9890" }}>
          {open ? "▲" : "▼"}
        </span>
      </button>
      {open && (
        <div style={{ padding: "0 16px", background: "#F7F4EF" }}>
          {archive.articles.map((a, i) => (
            <ArchiveArticleRow key={a.id ?? i} article={a} />
          ))}
        </div>
      )}
    </div>
  );
}

function PastDigests() {
  const [archives, setArchives] = useState<DigestArchive[]>([]);
  const [showAll,  setShowAll]  = useState(false);
  const [loading,  setLoading]  = useState(true);
  const [open,     setOpen]     = useState(false);

  useEffect(() => {
    fetch("/api/archives")
      .then((r) => r.json())
      .then((d) => setArchives(Array.isArray(d) ? d : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (!loading && archives.length === 0) return null;

  const visible = showAll ? archives : archives.slice(0, 5);

  return (
    <div style={{ marginTop: "40px", paddingTop: "20px", borderTop: "1px solid rgba(0,0,0,0.1)" }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          fontFamily: "var(--font-dm-mono), monospace",
          fontSize: "10px",
          letterSpacing: "0.1em",
          color: "#9C9890",
          background: "none",
          border: "none",
          cursor: "pointer",
          textTransform: "uppercase",
          marginBottom: "16px",
          transition: "color 0.15s",
        }}
        className="hover:text-[#5C5750]"
      >
        <span>{open ? "▲" : "▼"}</span>
        <span>PAST DIGESTS {archives.length > 0 ? `(${archives.length})` : ""}</span>
      </button>

      {open && (
        <div>
          {loading && (
            <div
              style={{
                fontFamily: "var(--font-dm-mono), monospace",
                fontSize: "10px",
                color: "#9C9890",
                padding: "16px 0",
                letterSpacing: "0.08em",
              }}
            >
              LOADING ARCHIVES…
            </div>
          )}
          {visible.map((a) => (
            <ArchiveEntry key={a.id} archive={a} />
          ))}
          {!showAll && archives.length > 5 && (
            <button
              type="button"
              onClick={() => setShowAll(true)}
              style={{
                width: "100%",
                padding: "8px",
                fontFamily: "var(--font-dm-mono), monospace",
                fontSize: "10px",
                letterSpacing: "0.08em",
                color: "#9C9890",
                background: "none",
                border: "none",
                cursor: "pointer",
                textTransform: "uppercase",
                transition: "color 0.15s",
              }}
              className="hover:text-[#1D5C3A]"
            >
              LOAD {archives.length - 5} MORE →
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Empty / finished state ───────────────────────────────────────────────────

function EmptyState({ onRefresh, refreshing }: { onRefresh: () => void; refreshing: boolean }) {
  return (
    <div style={{ textAlign: "center", padding: "80px 0" }}>
      <p style={{ fontFamily: "var(--font-playfair), Georgia, serif", fontSize: "24px", color: "#0F0E0C", marginBottom: "8px" }}>
        No articles matched today
      </p>
      <p style={{ fontFamily: "var(--font-source-serif), Georgia, serif", fontSize: "15px", color: "#9C9890", marginBottom: "24px" }}>
        Try adding more topics or keywords in{" "}
        <a href="/settings" style={{ color: "#1D5C3A" }}>Settings</a>.
      </p>
      <button
        onClick={onRefresh}
        disabled={refreshing}
        style={{
          fontFamily: "var(--font-dm-mono), monospace",
          fontSize: "11px",
          letterSpacing: "0.08em",
          color: "#1D5C3A",
          background: "none",
          border: "1px solid #1D5C3A",
          padding: "8px 20px",
          cursor: "pointer",
          opacity: refreshing ? 0.5 : 1,
        }}
      >
        {refreshing ? "CHECKING…" : "REFRESH NOW"}
      </button>
    </div>
  );
}

// ─── Main feed ────────────────────────────────────────────────────────────────

function DigestFeedInner() {
  const { showToast } = useToast();

  const [digest,            setDigest]            = useState<DigestResult | null>(null);
  const [articles,          setArticles]          = useState<ScoredArticle[]>([]);
  const [loading,           setLoading]           = useState(true);
  const [error,             setError]             = useState<string | null>(null);
  const [activeTopic,       setActiveTopic]       = useState<string | null>(null);
  const [impactFilter,      setImpactFilter]      = useState(false);
  const [refreshing,        setRefreshing]        = useState(false);
  const [refreshMessage,    setRefreshMessage]    = useState<string | null>(null);
  const [showRefreshBanner, setShowRefreshBanner] = useState(false);
  const [dateStr,           setDateStr]           = useState("");
  const [queueDone,         setQueueDone]         = useState(false);
  const confettiFiredRef    = useRef(false);
  const refreshesLeftRef    = useRef(999); // mirrors the refreshesLeft value shown in UI; 999 = not yet loaded
  const savedArticlesRef    = useRef<ScoredArticle[]>([]); // last articles shown, for restoring on celebration

  useEffect(() => { setDateStr(formatDigestDate()); }, []);

  useEffect(() => {
    if (!queueDone || confettiFiredRef.current) return;
    confettiFiredRef.current = true;
    import("canvas-confetti").then(({ default: confetti }) => {
      const burst = (opts: Parameters<typeof confetti>[0]) =>
        confetti({ spread: 70, startVelocity: 45, ticks: 200, ...opts });
      burst({ particleCount: 80, origin: { x: 0.3, y: 0.6 }, colors: ["#1D5C3A", "#0F0E0C", "#C9972A", "#F0ECE4"] });
      setTimeout(() => burst({ particleCount: 60, origin: { x: 0.7, y: 0.6 }, colors: ["#1D5C3A", "#0F0E0C", "#C9972A", "#F0ECE4"] }), 150);
      setTimeout(() => burst({ particleCount: 40, origin: { x: 0.5, y: 0.5 }, colors: ["#1D5C3A", "#C9972A"] }), 350);
    });
  }, [queueDone]);

  // rebuild=true bypasses celebration and always shows fresh articles (Rebuild Queue button)
  const fetchDigest = useCallback(async (isRefresh = false, rebuild = false) => {
    // Capture before the async gap — refs are always current
    // Trigger celebration when the user refreshes from a batch the UI already showed as "0 refreshes left"
    const showCelebration  = isRefresh && !rebuild && refreshesLeftRef.current === 0 && savedArticlesRef.current.length > 0;
    const articlesToRestore = savedArticlesRef.current;

    if (isRefresh) {
      setRefreshing(true);
      setRefreshMessage("Archiving current digest…");
    } else {
      setLoading(true);
    }
    setError(null);
    setShowRefreshBanner(false);

    try {
      const url = isRefresh ? "/api/digest?refresh=true" : "/api/digest";
      if (isRefresh) {
        await new Promise((r) => setTimeout(r, 600));
        setRefreshMessage(showCelebration ? "Wrapping up…" : "Loading next articles…");
      }
      const res  = await fetch(url);
      if (!res.ok) throw new Error(`Server error ${res.status}`);
      const data: DigestResult = await res.json();

      setDigest(data);
      setActiveTopic(null);
      setImpactFilter(false);

      if (data.articles.length === 0 && (showCelebration || !isRefresh)) {
        // Queue exhausted — show last archived batch with celebration
        let lastArticles = articlesToRestore;
        if (lastArticles.length === 0) {
          // Initial load: savedRef not yet populated, pull from archives API
          try {
            const archRes  = await fetch("/api/archives");
            const archives: DigestArchive[] = await archRes.json();
            if (Array.isArray(archives) && archives.length > 0) {
              lastArticles = archives[0].articles;
            }
          } catch { /* leave empty */ }
        }
        savedArticlesRef.current = lastArticles;
        setArticles(lastArticles);
        setQueueDone(true);
        if (isRefresh) showToast("You've read everything today!", "success");
      } else {
        savedArticlesRef.current = data.articles;
        setArticles(data.articles);
        setQueueDone(false);
        confettiFiredRef.current = false;
        if (isRefresh) {
          setShowRefreshBanner(true);
          showToast("Digest refreshed", "success");
        }
      }
    } catch {
      if (isRefresh) {
        showToast("Could not refresh — check your connection", "error");
      } else {
        setError("Failed to load digest");
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
      setRefreshMessage(null);
    }
  }, [showToast]);

  useEffect(() => { fetchDigest(); }, [fetchDigest]);

  function removeArticle(id: string) {
    setArticles((prev) => prev.filter((a) => a.id !== id));
  }

  const uniqueTopics     = [...new Set(articles.map((a) => a.topic).filter(Boolean))] as string[];
  const highImpactCount  = articles.filter((a) => a.impactLevel === "high").length;

  const visible = articles
    .filter((a) => activeTopic === null || a.topic === activeTopic)
    .filter((a) => !impactFilter || a.impactLevel === "high");

  // ── Loading ──────────────────────────────────────────────────────────────
  if (loading) {
    return <DigestSkeleton />;
  }

  // ── Error ────────────────────────────────────────────────────────────────
  if (error) {
    return (
      <div style={{ textAlign: "center", padding: "64px 0" }}>
        <p style={{ fontFamily: "var(--font-playfair), Georgia, serif", fontSize: "20px", color: "#0F0E0C", marginBottom: "8px" }}>
          Something went wrong
        </p>
        <p style={{ fontFamily: "var(--font-source-serif), Georgia, serif", fontSize: "15px", color: "#9C9890", marginBottom: "24px" }}>
          {error}
        </p>
        <button
          onClick={() => fetchDigest()}
          style={{
            padding: "10px 24px",
            background: "#0F0E0C",
            color: "#F7F4EF",
            fontFamily: "var(--font-dm-mono), monospace",
            fontSize: "12px",
            letterSpacing: "0.06em",
            border: "none",
            cursor: "pointer",
            transition: "background 0.15s",
          }}
          className="hover:bg-[#1D5C3A]"
        >
          TRY AGAIN
        </button>
      </div>
    );
  }

  // ── Empty (no articles at all, not the queue-exhausted case) ─────────────
  if (!digest || (articles.length === 0 && !queueDone)) {
    return <EmptyState onRefresh={() => fetchDigest(true)} refreshing={refreshing} />;
  }

  const { queueStats } = digest;

  const BATCH = 5;
  const refreshesLeft = queueStats
    ? Math.max(0, Math.floor((queueStats.totalRemaining - articles.length) / BATCH))
    : 0;

  // Keep ref in sync with what the user sees — read by fetchDigest before async gap
  refreshesLeftRef.current = refreshesLeft;

  return (
    <div>
      {/* ── Masthead header ── */}
      <div className="animate-fadeScaleIn" style={{ borderTop: "3px solid #0F0E0C", marginBottom: "0" }}>
        {/* Row 1: date | BRIEFD | edition */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "10px 0",
          }}
        >
          <span
            style={{
              fontFamily: "var(--font-dm-mono), monospace",
              fontSize: "10px",
              letterSpacing: "0.1em",
              color: "#5C5750",
              textTransform: "uppercase",
            }}
          >
            {dateStr}
          </span>
          <span
            style={{
              fontFamily: "var(--font-playfair), Georgia, serif",
              fontSize: "28px",
              fontWeight: 800,
              letterSpacing: "0.12em",
              color: "#0F0E0C",
              textTransform: "uppercase",
            }}
          >
            BRIEFD
          </span>
          <span
            style={{
              fontFamily: "var(--font-dm-mono), monospace",
              fontSize: "10px",
              letterSpacing: "0.1em",
              color: "#5C5750",
              textTransform: "uppercase",
            }}
          >
            PERSONAL EDITION
          </span>
        </div>

        {/* Thin rule */}
        <div style={{ borderTop: "1px solid rgba(0,0,0,0.15)", margin: "0 0 10px" }} />

        {/* Row 2: filter bar */}
        <div className="animate-slideFromLeft" style={{ marginBottom: "10px", overflowX: "auto" }}>
          <FilterBar
            topics={uniqueTopics}
            activeTopic={activeTopic}
            onSelect={setActiveTopic}
            highImpactCount={highImpactCount}
            impactFilter={impactFilter}
            onToggleImpact={() => setImpactFilter((v) => !v)}
          />
        </div>

        {/* Thick bottom rule */}
        <div style={{ borderBottom: "2px solid #0F0E0C", marginBottom: "24px" }} />
      </div>

      {/* ── Demo mode banner ── */}
      {digest?.isDemo && (
        <div
          style={{
            marginBottom: "12px",
            display: "flex",
            alignItems: "center",
            gap: "10px",
            padding: "10px 14px",
            background: "#F0FAF4",
            borderLeft: "3px solid #16A34A",
            fontFamily: "var(--font-source-serif), Georgia, serif",
            fontSize: "13px",
            color: "#166534",
          }}
        >
          <span>📋</span>
          <span>
            <strong>Demo mode</strong> — showing sample articles.{" "}
            <a href="/settings" style={{ color: "#16A34A", textDecoration: "underline" }}>
              Switch to Live in Settings.
            </a>
          </span>
        </div>
      )}

      {/* ── Banners / meta ── */}
      {articles.some((a) => a.impactAnalysis === GEMINI_QUOTA_EXCEEDED) && (
        <div
          style={{
            marginBottom: "16px",
            display: "flex",
            alignItems: "flex-start",
            gap: "10px",
            padding: "12px 16px",
            background: "#FDF8ED",
            borderLeft: "3px solid #C9972A",
          }}
        >
          <span>⚡</span>
          <div style={{ fontFamily: "var(--font-source-serif), Georgia, serif", fontSize: "13px", color: "#5C4A00" }}>
            <strong>Impact analysis paused</strong>
            {" — "}your Gemini API quota is exceeded.{" "}
            {digest?.geminiQuotaRetryAfter && (
              <span>
                Resets on{" "}
                <strong>
                  {new Date(digest.geminiQuotaRetryAfter).toLocaleDateString("en-MY", {
                    day: "numeric", month: "long", year: "numeric",
                  })}
                </strong>
                .{" "}
              </span>
            )}
            Top up at{" "}
            <a href="https://aistudio.google.com/billing" target="_blank" rel="noopener noreferrer" style={{ color: "#C9972A", textDecoration: "underline" }}>
              aistudio.google.com/billing
            </a>.
          </div>
        </div>
      )}

      {showRefreshBanner && queueStats && (
        <div
          style={{
            marginBottom: "16px",
            padding: "8px 14px",
            background: "#F0ECE4",
            fontFamily: "var(--font-dm-mono), monospace",
            fontSize: "10px",
            letterSpacing: "0.08em",
            color: "#5C5750",
            textTransform: "uppercase",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "6px",
          }}
        >
          <span>DIGEST REFRESHED — ARTICLES {queueStats.currentStart}–{queueStats.currentEnd} OF {queueStats.totalQueued}</span>
          {refreshesLeft === 0 && !queueStats.nextRefreshAvailable ? (
            <span style={{ color: "#C9972A" }}>⚡ NO MORE REFRESHES TODAY</span>
          ) : refreshesLeft <= 1 ? (
            <span style={{ color: "#C9972A" }}>⚡ {refreshesLeft === 0 ? "LAST" : `${refreshesLeft}`} REFRESH REMAINING</span>
          ) : (
            <span style={{ color: "#9C9890" }}>{refreshesLeft} REFRESHES REMAINING</span>
          )}
        </div>
      )}

      {queueStats && (
        <div style={{ marginBottom: "12px" }}>
          <p
            style={{
              fontFamily: "var(--font-dm-mono), monospace",
              fontSize: "9px",
              letterSpacing: "0.08em",
              color: "#9C9890",
              textTransform: "uppercase",
              marginBottom: refreshesLeft <= 1 ? "6px" : "0",
            }}
          >
            {queueStats.currentEnd} of {queueStats.totalQueued} articles shown
            {refreshesLeft > 0
              ? ` · ${refreshesLeft} refresh${refreshesLeft === 1 ? "" : "es"} remaining`
              : queueStats.nextRefreshAvailable
              ? " · Refresh for next 5 →"
              : " · Queue exhausted"}
          </p>
          {refreshesLeft === 0 && queueStats.nextRefreshAvailable && (
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "4px 10px",
                background: "#FDF8ED",
                border: "1px solid #C9972A",
                fontFamily: "var(--font-dm-mono), monospace",
                fontSize: "9px",
                letterSpacing: "0.08em",
                color: "#5C4A00",
                textTransform: "uppercase",
              }}
            >
              ⚡ Last refresh available — your queue is almost empty
            </div>
          )}
          {refreshesLeft === 1 && (
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "4px 10px",
                background: "#FDF8ED",
                border: "1px solid #C9972A",
                fontFamily: "var(--font-dm-mono), monospace",
                fontSize: "9px",
                letterSpacing: "0.08em",
                color: "#5C4A00",
                textTransform: "uppercase",
              }}
            >
              ⚡ 1 refresh left — queue rebuilds automatically when empty
            </div>
          )}
        </div>
      )}

      {refreshing && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            marginBottom: "12px",
            fontFamily: "var(--font-dm-mono), monospace",
            fontSize: "10px",
            letterSpacing: "0.08em",
            color: "#9C9890",
            textTransform: "uppercase",
          }}
        >
          <span className="animate-pulse">◈</span>
          <span>{refreshMessage ?? "FETCHING LATEST ARTICLES…"}</span>
        </div>
      )}

      {/* ── Newspaper grid ── */}
      {visible.length === 0 && impactFilter ? (
        <p style={{ padding: "32px 0", textAlign: "center", fontFamily: "var(--font-source-serif), Georgia, serif", fontSize: "15px", color: "#9C9890" }}>
          No high impact articles{activeTopic ? ` in ${activeTopic}` : ""} right now.{" "}
          <button
            type="button"
            onClick={() => { setActiveTopic(null); setImpactFilter(false); }}
            style={{ color: "#1D5C3A", background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}
          >
            Show all
          </button>
        </p>
      ) : (
        <NewspaperGrid articles={visible} onRemove={removeArticle} />
      )}

      {/* ── Refresh footer / celebration ── */}
      {queueDone ? (
        <div
          style={{
            textAlign: "center",
            marginTop: "48px",
            paddingBottom: "16px",
            borderTop: "1px solid rgba(0,0,0,0.08)",
            paddingTop: "40px",
          }}
        >
          <p style={{ fontFamily: "var(--font-dm-mono), monospace", fontSize: "28px", marginBottom: "12px" }}>🎉</p>
          <p style={{ fontFamily: "var(--font-playfair), Georgia, serif", fontSize: "22px", color: "#0F0E0C", marginBottom: "6px" }}>
            You&apos;ve read everything for today
          </p>
          <p style={{ fontFamily: "var(--font-source-serif), Georgia, serif", fontSize: "14px", color: "#9C9890", marginBottom: "6px" }}>
            Your queue is empty — it will be rebuilt on your next refresh.
          </p>
          {digest?.queueStats && (
            <p style={{ fontFamily: "var(--font-dm-mono), monospace", fontSize: "10px", color: "#9C9890", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "24px" }}>
              {digest.queueStats.totalServed} articles read today
            </p>
          )}
          <button
            onClick={() => fetchDigest(true, true)}
            disabled={refreshing}
            style={{
              padding: "10px 28px",
              fontFamily: "var(--font-dm-mono), monospace",
              fontSize: "11px",
              letterSpacing: "0.1em",
              color: refreshing ? "#9C9890" : "#1D5C3A",
              background: "transparent",
              border: "1px solid #1D5C3A",
              cursor: refreshing ? "not-allowed" : "pointer",
              textTransform: "uppercase",
              transition: "all 0.15s",
            }}
          >
            {refreshing ? "REBUILDING…" : "↻ REBUILD QUEUE"}
          </button>
        </div>
      ) : (
        <div style={{ textAlign: "center", marginTop: "40px", paddingBottom: "16px" }}>
          <button
            onClick={() => fetchDigest(true)}
            disabled={refreshing}
            style={{
              padding: "10px 28px",
              fontFamily: "var(--font-dm-mono), monospace",
              fontSize: "11px",
              letterSpacing: "0.1em",
              color: refreshing ? "#9C9890" : "#0F0E0C",
              background: "transparent",
              border: "1px solid rgba(0,0,0,0.2)",
              cursor: refreshing ? "not-allowed" : "pointer",
              textTransform: "uppercase",
              transition: "all 0.15s",
            }}
            className={refreshing ? "" : "hover:border-[#1D5C3A] hover:text-[#1D5C3A]"}
          >
            {refreshing ? "REFRESHING…" : "↻ REFRESH DIGEST"}
          </button>
        </div>
      )}

      {/* ── Past digests ── */}
      <PastDigests />
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
