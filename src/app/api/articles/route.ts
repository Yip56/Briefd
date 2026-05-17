import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { ScoredArticle, VoteValue } from "@/lib/types";

export async function GET(request: NextRequest) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const topic = request.nextUrl.searchParams.get("topic");

  // Join digest_entries with articles in one query
  let query = supabase
    .from("digest_entries")
    .select(`
      relevance_score,
      impact_level,
      ai_summary,
      shown_at,
      articles (
        id, external_id, title, summary, source_name, source_url,
        article_url, topic, published_at, fetched_at
      )
    `)
    .eq("user_id", user.id)
    .order("relevance_score", { ascending: false })
    .limit(50);

  if (topic) {
    // Filter via the joined articles table
    query = query.eq("articles.topic", topic);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Fetch user's votes to attach userVote
  const { data: feedbackRows } = await supabase
    .from("article_feedback")
    .select("article_id, vote")
    .eq("user_id", user.id);

  const voteMap = new Map<string, VoteValue>();
  for (const row of feedbackRows ?? []) {
    voteMap.set(row.article_id, row.vote as VoteValue);
  }

  const articles: ScoredArticle[] = (data ?? [])
    .filter((row) => row.articles)
    .map((row) => {
      const a = row.articles as unknown as {
        id: string; external_id: string | null; title: string;
        summary: string | null; source_name: string | null; source_url: string | null;
        article_url: string; topic: string | null; published_at: string | null; fetched_at: string;
      };
      return {
        ...a,
        relevanceScore: row.relevance_score,
        impactLevel:    row.impact_level as ScoredArticle["impactLevel"],
        combined:       row.ai_summary ?? "",
        userVote:       voteMap.get(a.id) ?? null,
      };
    });

  return NextResponse.json(articles);
}
