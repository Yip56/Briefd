import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { fetchAllSources } from "@/lib/sources";
import { buildDigest } from "@/lib/ai/digest";
import type { VoteValue } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createClient();

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

  const profile          = profileResult.data;
  const topics           = topicsResult.data ?? [];
  const algorithmSettings = algoResult.data ?? null;
  const clickedUrls      = new Set((clicksResult.data ?? []).map((r) => r.article_url));

  // ── Archive existing digest_entries before building new ones ─────────────────
  const { data: existingEntries } = await supabase
    .from("digest_entries")
    .select("article_id, relevance_score, impact_level, ai_summary, shown_at, articles(*)")
    .eq("user_id", user.id);

  if (existingEntries && existingEntries.length > 0) {
    const today = new Date().toLocaleDateString("en-MY", {
      weekday: "long", day: "numeric", month: "long",
    });
    const label = `${today} — ${existingEntries.length} articles`;

    const archiveArticles = existingEntries.map((e) => {
      const art = e.articles as unknown as Record<string, unknown> | null;
      return {
        ...(art ?? {}),
        relevanceScore: e.relevance_score,
        impactLevel:    e.impact_level,
        aiSummary:      e.ai_summary ?? "",
      };
    });

    await supabase.from("digest_archives").insert({
      user_id:    user.id,
      articles:   archiveArticles,
      label,
    });

    await supabase.from("digest_entries").delete().eq("user_id", user.id);
  }

  // ── Build feedbackMap from prior votes ───────────────────────────────────────
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

  // ── Fetch articles from all sources ─────────────────────────────────────────
  const topicNames  = topics.map((t) => t.topic);
  const rawArticles = await fetchAllSources(topicNames);

  // ── Score + AI-summarise ─────────────────────────────────────────────────────
  const preferences = { profile, topics };
  const digest = await buildDigest(rawArticles, preferences, feedbackMap, algorithmSettings, clickedUrls);

  // ── Persist: upsert articles then digest_entries ─────────────────────────────
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
