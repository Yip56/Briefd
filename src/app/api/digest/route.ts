import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildArticleQueue } from "@/lib/queue/buildQueue";
import { geminiQuotaRetryAfter } from "@/lib/ai/summarise";
import { getDailyBudget } from "@/lib/ai/budget";
import { IS_DEMO_MODE } from "@/lib/constants";
import { buildDemoDigest } from "@/lib/demo/buildDemoDigest";
import { DEMO_ARTICLES } from "@/lib/demo/articles";
import type { ImpactLevel, ScoredArticle, VoteValue, QueueStats, DigestResult } from "@/lib/types";

export const dynamic = "force-dynamic";

const BATCH_SIZE = 5;

type SupabaseInstance = Awaited<ReturnType<typeof createClient>>;

type QueueRow = {
  id: string;
  relevance_score: number;
  impact_level: string;
  ai_summary: string | null;
  impact_analysis: string | null;
  topic: string | null;
  position: number;
  articles: {
    id: string;
    external_id: string | null;
    title: string;
    summary: string | null;
    source_name: string | null;
    source_url: string | null;
    article_url: string;
    topic: string | null;
    published_at: string | null;
    fetched_at: string;
    ai_summary: string | null;
    impact_analysis: string | null;
    is_video: boolean | null;
  } | null;
};

function rowToScoredArticle(row: QueueRow, feedbackMap: Record<string, VoteValue>): ScoredArticle | null {
  const art = row.articles;
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
    topic:          row.topic ?? art.topic,
    published_at:   art.published_at,
    fetched_at:     art.fetched_at,
    is_video:       art.is_video ?? false,
    relevanceScore: row.relevance_score,
    impactLevel:    (row.impact_level ?? "medium") as ImpactLevel,
    combined:       row.ai_summary ?? art.ai_summary ?? art.summary ?? "",
    userVote:       feedbackMap[extId] ?? null,
  } satisfies ScoredArticle;
}

async function getQueueCounts(userId: string, supabase: SupabaseInstance) {
  const [totalRes, servedRes] = await Promise.all([
    supabase.from("article_queue").select("id", { count: "exact", head: true }).eq("user_id", userId),
    supabase.from("article_queue").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("served", true),
  ]);
  return { totalQueued: totalRes.count ?? 0, totalServed: servedRes.count ?? 0 };
}

async function fetchUnservedBatch(userId: string, supabase: SupabaseInstance, limit = BATCH_SIZE) {
  const { data } = await supabase
    .from("article_queue")
    .select("id, relevance_score, impact_level, ai_summary, impact_analysis, topic, position, articles(*)")
    .eq("user_id", userId)
    .eq("served", false)
    .order("position", { ascending: true })
    .limit(limit);
  return (data ?? []) as unknown as QueueRow[];
}

async function buildDigestResponse(
  userId: string,
  feedbackMap: Record<string, VoteValue>,
  supabase: SupabaseInstance,
  isDemo = false
): Promise<DigestResult> {
  const [batch, { totalQueued, totalServed }, budget] = await Promise.all([
    fetchUnservedBatch(userId, supabase, BATCH_SIZE),
    getQueueCounts(userId, supabase),
    getDailyBudget(userId, supabase),
  ]);

  const articles = batch.map((row) => rowToScoredArticle(row, feedbackMap)).filter(Boolean) as ScoredArticle[];

  const queueStats: QueueStats = {
    totalQueued,
    totalServed,
    totalRemaining:       totalQueued - totalServed,
    nextRefreshAvailable: totalQueued - totalServed > BATCH_SIZE,
    currentStart:         totalServed + 1,
    currentEnd:           totalServed + articles.length,
  };

  return {
    articles,
    generatedAt:           new Date().toISOString(),
    totalScored:           totalQueued,
    geminiQuotaRetryAfter,
    queueStats,
    isDemo,
    aiBudgetExhausted:     budget.groq.remaining === 0,
  };
}

export async function GET(request: NextRequest) {
  const supabase      = await createClient();
  const refreshParam  = request.nextUrl.searchParams.get("refresh");
  const isRefreshTrue = refreshParam === "true";
  const isRefreshNew  = refreshParam === "new";

  // Determine demo/live mode: cookie overrides global env
  const cookieMode = request.cookies.get("briefd_data_mode")?.value;
  const isDemo     = cookieMode === "live" ? false : cookieMode === "demo" ? true : IS_DEMO_MODE;
  console.log("[Digest] NEXT_PUBLIC_DATA_MODE:", process.env.NEXT_PUBLIC_DATA_MODE);
  console.log("[Digest] DATA_MODE:", process.env.DATA_MODE);
  console.log("[Digest] IS_DEMO_MODE:", IS_DEMO_MODE);
  console.log("[Digest] isDemo (after cookie):", isDemo);

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

  const selectedTopics = topics.filter((t) => t.is_preset).map((t) => t.topic);
  console.log("[Digest] Selected topics:", selectedTopics.join(", ") || "(none)");

  const preferences = { profile, topics };

  // ── Demo mode hard guard — bypass DB queue entirely ───────────────────────
  if (isDemo) {
    console.log("[Demo] Available topics:", [...new Set(DEMO_ARTICLES.map((a) => a.topic))]);
    console.log("[Demo] Filtering for:", selectedTopics);
    const result = buildDemoDigest(selectedTopics, preferences, algorithmSettings);
    return NextResponse.json(result);
  }

  // ── Force-fresh ───────────────────────────────────────────────────────────
  if (isRefreshNew) {
    await supabase
      .from("article_queue")
      .update({ served: true, served_at: new Date().toISOString() })
      .eq("user_id", user.id)
      .eq("served", false);

    await buildArticleQueue(user.id, preferences, algorithmSettings, feedbackMap, clickedUrls, supabase, isDemo);
    return NextResponse.json(await buildDigestResponse(user.id, feedbackMap, supabase, isDemo));
  }

  // ── Refresh=true: archive current batch, advance to next ─────────────────
  if (isRefreshTrue) {
    const currentBatch = await fetchUnservedBatch(user.id, supabase, BATCH_SIZE);

    if (currentBatch.length > 0) {
      const archiveArticles = currentBatch
        .map((row) => rowToScoredArticle(row, feedbackMap))
        .filter(Boolean);

      const label =
        new Date().toLocaleTimeString("en-MY", { hour: "2-digit", minute: "2-digit" }) +
        ` — ${archiveArticles.length} articles`;

      await supabase.from("digest_archives").insert({ user_id: user.id, articles: archiveArticles, label });

      const batchIds = currentBatch.map((r) => r.id);
      await supabase
        .from("article_queue")
        .update({ served: true, served_at: new Date().toISOString() })
        .in("id", batchIds);
    }

    const remaining = await fetchUnservedBatch(user.id, supabase, BATCH_SIZE);
    if (remaining.length < BATCH_SIZE) {
      await buildArticleQueue(user.id, preferences, algorithmSettings, feedbackMap, clickedUrls, supabase, isDemo);
    }

    return NextResponse.json(await buildDigestResponse(user.id, feedbackMap, supabase, isDemo));
  }

  // ── Initial load ──────────────────────────────────────────────────────────
  const unserved = await fetchUnservedBatch(user.id, supabase, BATCH_SIZE);
  if (unserved.length < BATCH_SIZE) {
    await buildArticleQueue(user.id, preferences, algorithmSettings, feedbackMap, clickedUrls, supabase, isDemo);
  }

  return NextResponse.json(await buildDigestResponse(user.id, feedbackMap, supabase, isDemo));
}
