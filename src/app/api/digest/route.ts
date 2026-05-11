import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { fetchAllSources } from "@/lib/sources";
import { buildDigest, type EnrichmentCache } from "@/lib/ai/digest";
import { GEMINI_QUOTA_EXCEEDED, geminiQuotaRetryAfter } from "@/lib/ai/summarise";
import type { ImpactLevel, ScoredArticle, VoteValue } from "@/lib/types";

export const dynamic = "force-dynamic";

// ─── Reconstruct DigestResult from cached digest_entries rows ─────────────────

function buildCachedResult(
  rows: Array<{
    relevance_score: number;
    impact_level: string;
    ai_summary: string | null;
    shown_at: string;
    articles: unknown;
  }>,
  feedbackMap: Record<string, VoteValue>
) {
  const articles: ScoredArticle[] = rows
    .map((e) => {
      const art = e.articles as {
        id: string; external_id: string | null; title: string;
        summary: string | null; source_name: string | null; source_url: string | null;
        article_url: string; topic: string | null; published_at: string | null;
        fetched_at: string; ai_summary: string | null; impact_analysis: string | null;
      } | null;
      if (!art) return null;
      const extId = art.external_id ?? art.id;
      return {
        id:             extId,
        external_id:    art.external_id,
        title:          art.title,
        summary:        art.summary ?? "",
        source_name:    art.source_name,
        source_url:     art.source_url,
        article_url:    art.article_url,
        topic:          art.topic,
        published_at:   art.published_at,
        fetched_at:     art.fetched_at,
        relevanceScore: e.relevance_score,
        impactLevel:    (e.impact_level ?? "medium") as ImpactLevel,
        aiSummary:      e.ai_summary ?? art.ai_summary ?? art.summary ?? "",
        impactAnalysis: art.impact_analysis ?? undefined,
        userVote:       feedbackMap[extId] ?? null,
      } satisfies ScoredArticle;
    })
    .filter(Boolean) as ScoredArticle[];

  articles.sort((a, b) => b.relevanceScore - a.relevanceScore);

  return {
    articles,
    generatedAt: rows[0]?.shown_at ?? new Date().toISOString(),
    totalScored: articles.length,
    geminiQuotaRetryAfter: null,
  };
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const supabase   = await createClient();
  const isRefresh  = request.nextUrl.searchParams.has("t");

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [profileResult, topicsResult, algoResult, clicksResult] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).single(),
    supabase.from("user_topics").select("*").eq("user_id", user.id),
    supabase.from("user_algorithm_settings").select("*").eq("user_id", user.id).maybeSingle(),
    supabase.from("article_clicks").select("article_url").eq("user_id", user.id),
  ]);

  if (profileResult.error || !profileResult.data) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  const profile           = profileResult.data;
  const topics            = topicsResult.data ?? [];
  const algorithmSettings = algoResult.data ?? null;
  const clickedUrls       = new Set((clicksResult.data ?? []).map((r) => r.article_url));

  // ── Build feedbackMap ─────────────────────────────────────────────────────
  const { data: feedbackRows } = await supabase
    .from("article_feedback")
    .select("vote, articles(external_id)")
    .eq("user_id", user.id);

  const feedbackMap: Record<string, VoteValue> = {};
  for (const row of feedbackRows ?? []) {
    const extId = (row.articles as unknown as { external_id: string | null } | null)?.external_id;
    if (extId && (row.vote === "up" || row.vote === "down")) {
      feedbackMap[extId] = row.vote;
    }
  }

  // ── Serve cached digest on initial load ───────────────────────────────────
  if (!isRefresh) {
    const { data: existingEntries } = await supabase
      .from("digest_entries")
      .select("relevance_score, impact_level, ai_summary, shown_at, articles(*)")
      .eq("user_id", user.id)
      .order("relevance_score", { ascending: false });

    if (existingEntries && existingEntries.length > 0) {
      return NextResponse.json(buildCachedResult(existingEntries, feedbackMap));
    }
  }

  // ── Archive existing entries before rebuild ───────────────────────────────
  const { data: existingEntries } = await supabase
    .from("digest_entries")
    .select("article_id, relevance_score, impact_level, ai_summary, shown_at, articles(*)")
    .eq("user_id", user.id);

  if (existingEntries && existingEntries.length > 0) {
    const today = new Date().toLocaleDateString("en-MY", {
      weekday: "long", day: "numeric", month: "long",
    });
    const archiveArticles = existingEntries.map((e) => {
      const art = e.articles as unknown as Record<string, unknown> | null;
      return { ...(art ?? {}), relevanceScore: e.relevance_score, impactLevel: e.impact_level, aiSummary: e.ai_summary ?? "" };
    });
    await supabase.from("digest_archives").insert({
      user_id:  user.id,
      articles: archiveArticles,
      label:    `${today} — ${existingEntries.length} articles`,
    });
    await supabase.from("digest_entries").delete().eq("user_id", user.id);
  }

  // ── Fetch fresh articles ──────────────────────────────────────────────────
  const topicNames  = topics.map((t) => t.topic);
  const rawArticles = await fetchAllSources(topicNames);

  // ── Upsert raw articles early to enable cache lookup ─────────────────────
  const articleRows = rawArticles.map((a) => ({
    external_id:  a.externalId,
    title:        a.title,
    summary:      a.summary,
    source_name:  a.sourceName,
    source_url:   a.sourceUrl,
    article_url:  a.articleUrl,
    topic:        a.topic,
    published_at: a.publishedAt,
  }));

  const { data: upsertedArticles } = await supabase
    .from("articles")
    .upsert(articleRows, { onConflict: "external_id", ignoreDuplicates: false })
    .select("id, external_id, ai_summary, impact_analysis");

  // Build enrichment cache from existing DB values
  const enrichmentCache: EnrichmentCache = new Map(
    (upsertedArticles ?? [])
      .filter((a) => a.ai_summary)
      .map((a) => [a.external_id, { aiSummary: a.ai_summary, impactAnalysis: a.impact_analysis }])
  );

  // Build id map for digest_entries persistence
  const idMap = new Map<string, string>();
  for (const row of upsertedArticles ?? []) {
    if (row.external_id) idMap.set(row.external_id, row.id);
  }

  // ── Score + AI-summarise (uses cache, skips Gemini for known articles) ────
  const preferences = { profile, topics };
  const digest = await buildDigest(
    rawArticles, preferences, feedbackMap,
    algorithmSettings, clickedUrls, enrichmentCache
  );

  // ── Save new Gemini outputs back to articles table ────────────────────────
  const toCache = digest.articles.filter((a) => {
    const extId = a.external_id ?? a.id;
    return !enrichmentCache.get(extId)?.aiSummary;
  });

  for (const article of toCache) {
    await supabase
      .from("articles")
      .update({
        ai_summary:      article.aiSummary ?? null,
        impact_analysis: article.impactAnalysis === GEMINI_QUOTA_EXCEEDED ? null : (article.impactAnalysis ?? null),
      })
      .eq("external_id", article.external_id ?? article.id);
  }

  // ── Persist digest_entries ────────────────────────────────────────────────
  if (digest.articles.length > 0) {
    const entryRows = digest.articles
      .map((a) => {
        const articleId = idMap.get(a.external_id ?? a.id);
        if (!articleId) return null;
        return {
          user_id:         user.id,
          article_id:      articleId,
          relevance_score: a.relevanceScore,
          impact_level:    a.impactLevel,
          ai_summary:      a.aiSummary,
          shown_at:        new Date().toISOString(),
        };
      })
      .filter(Boolean);

    if (entryRows.length > 0) {
      await supabase
        .from("digest_entries")
        .upsert(entryRows as object[], { onConflict: "user_id,article_id" });
    }
  }

  const quotaHit = digest.articles.some((a) => a.impactAnalysis === GEMINI_QUOTA_EXCEEDED);
  return NextResponse.json({
    ...digest,
    geminiQuotaRetryAfter: quotaHit ? geminiQuotaRetryAfter : null,
  });
}
