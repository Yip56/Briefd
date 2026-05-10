import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { fetchAllSources } from "@/lib/sources";
import { buildDigest } from "@/lib/ai/digest";
import type { VoteValue } from "@/lib/types";

export const revalidate = 3600;

export async function GET() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // ── 1. Fetch user profile + topics ──────────────────────────────────────────
  const [profileResult, topicsResult] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).single(),
    supabase.from("user_topics").select("*").eq("user_id", user.id),
  ]);

  if (profileResult.error || !profileResult.data) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  const profile = profileResult.data;
  const topics  = topicsResult.data ?? [];

  // ── 2. Build feedbackMap from prior votes ────────────────────────────────────
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

  // ── 3. Fetch articles from all sources ───────────────────────────────────────
  const topicNames = topics.map((t) => t.topic);
  const rawArticles = await fetchAllSources(topicNames);

  // ── 4. Score + AI-summarise ──────────────────────────────────────────────────
  const preferences = { profile, topics };
  const digest = await buildDigest(rawArticles, preferences, feedbackMap);

  // ── 5. Persist: upsert articles then digest_entries ──────────────────────────
  if (digest.articles.length > 0) {
    const articleRows = digest.articles.map((a) => ({
      external_id:  a.external_id,
      title:        a.title,
      summary:      a.summary,
      source_name:  a.source_name,
      source_url:   a.source_url,
      article_url:  a.article_url,
      topic:        a.topic,
      published_at: a.published_at,
    }));

    const { data: upsertedArticles } = await supabase
      .from("articles")
      .upsert(articleRows, { onConflict: "external_id", ignoreDuplicates: false })
      .select("id, external_id");

    // Map external_id → DB uuid
    const idMap = new Map<string, string>();
    for (const row of upsertedArticles ?? []) {
      if (row.external_id) idMap.set(row.external_id, row.id);
    }

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

  return NextResponse.json(digest);
}
