import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { Resend } from "resend";
import { buildArticleQueue } from "@/lib/queue/buildQueue";
import { buildEmailHtml } from "@/lib/email/templates";
import { APP_NAME, FROM_EMAIL } from "@/lib/constants";
import type { ImpactLevel, ScoredArticle, VoteValue } from "@/lib/types";

const BATCH_SIZE = 10;

function createServiceClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll: () => [], setAll: () => {} } }
  );
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const supabase = createServiceClient();
  const resend   = new Resend(process.env.RESEND_API_KEY);

  const now           = new Date();
  const currentHour   = now.getUTCHours();
  const currentMinute = now.getUTCMinutes();

  const { data: profiles, error } = await supabase
    .from("profiles")
    .select("id, email, occupation, location, life_stage, vehicle, email_digest_enabled, digest_time, digest_frequency")
    .eq("email_digest_enabled", true)
    .limit(200);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const matching = (profiles ?? []).filter((p) => {
    if (!p.digest_time) return false;
    const [h, m] = (p.digest_time as string).split(":").map(Number);
    if (h !== currentHour) return false;
    return Math.abs((m ?? 0) - currentMinute) <= 5;
  });

  const batch = matching.slice(0, BATCH_SIZE);
  let processed = 0;

  for (const profile of batch) {
    try {
      const [topicsResult, feedbackResult, algoResult, clicksResult] = await Promise.all([
        supabase.from("user_topics").select("*").eq("user_id", profile.id),
        supabase.from("article_feedback").select("vote, articles(external_id)").eq("user_id", profile.id),
        supabase.from("user_algorithm_settings").select("*").eq("user_id", profile.id).maybeSingle(),
        supabase.from("article_clicks").select("article_url").eq("user_id", profile.id),
      ]);

      const topics            = topicsResult.data ?? [];
      const algorithmSettings = algoResult.data ?? null;
      const clickedUrls       = new Set((clicksResult.data ?? []).map((r) => r.article_url));

      const feedbackMap: Record<string, VoteValue> = {};
      for (const row of feedbackResult.data ?? []) {
        const extId = (row.articles as unknown as { external_id: string | null } | null)?.external_id;
        if (extId && (row.vote === "up" || row.vote === "down")) {
          feedbackMap[extId] = row.vote as VoteValue;
        }
      }

      const profileObj = {
        ...profile,
        digest_frequency: profile.digest_frequency as "daily" | "weekly",
        created_at: "", updated_at: "",
      };
      const preferences = { profile: profileObj, topics };

      // Build the queue (enriches first 5 immediately)
      await buildArticleQueue(profile.id, preferences, algorithmSettings, feedbackMap, clickedUrls, supabase);

      // Fetch top 5 unserved articles for the email
      const { data: queueRows } = await supabase
        .from("article_queue")
        .select(`
          relevance_score, impact_level, ai_summary, impact_analysis, topic,
          articles (
            id, external_id, title, summary, source_name, source_url,
            article_url, topic, published_at, fetched_at, is_video
          )
        `)
        .eq("user_id", profile.id)
        .eq("served", false)
        .order("position", { ascending: true })
        .limit(5);

      const articles: ScoredArticle[] = (queueRows ?? [])
        .filter((r) => r.articles)
        .map((r) => {
          const a = r.articles as unknown as {
            id: string; external_id: string | null; title: string;
            summary: string | null; source_name: string | null; source_url: string | null;
            article_url: string; topic: string | null; published_at: string | null;
            fetched_at: string; is_video: boolean | null;
          };
          return {
            ...a,
            is_video:       a.is_video ?? false,
            relevanceScore: r.relevance_score,
            impactLevel:    (r.impact_level ?? "medium") as ImpactLevel,
            aiSummary:      r.ai_summary ?? a.summary ?? "",
            impactAnalysis: "",
            userVote:       null,
          };
        });

      if (articles.length > 0) {
        const dayOfWeek = now.toLocaleDateString("en-MY", { weekday: "long" });
        const dateStr   = now.toLocaleDateString("en-MY", { day: "numeric", month: "long" });
        const html      = buildEmailHtml(articles, profile.email);

        const { error: sendError } = await resend.emails.send({
          from:    `${APP_NAME} <${FROM_EMAIL}>`,
          to:      profile.email,
          subject: `Your ${APP_NAME} Digest · ${dayOfWeek}, ${dateStr}`,
          html,
        });

        await supabase.from("email_log").insert({
          user_id:       profile.id,
          status:        sendError ? "failed" : "sent",
          article_count: articles.length,
        });
      }

      processed++;
    } catch (err) {
      console.error(`Cron: failed for user ${profile.id}`, err);
    }
  }

  return NextResponse.json({ processed, matched: matching.length });
}
