import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { Resend } from "resend";
import { fetchAllSources } from "@/lib/sources";
import { buildDigest } from "@/lib/ai/digest";
import { renderDigestEmailHtml } from "@/lib/email/templates";
import { APP_NAME, FROM_EMAIL } from "@/lib/constants";
import type { VoteValue } from "@/lib/types";

const BATCH_SIZE = 10;

// Service-role client bypasses RLS — safe for server-only cron use
function createServiceClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll: () => [], setAll: () => {} } }
  );
}

export async function GET(request: NextRequest) {
  // ── Auth: verify cron secret ──────────────────────────────────────────────────
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const supabase = createServiceClient();
  const resend   = new Resend(process.env.RESEND_API_KEY);

  // ── Find users whose digest_time is within 5 min of current UTC time ──────────
  const now = new Date();
  const currentHour   = now.getUTCHours();
  const currentMinute = now.getUTCMinutes();

  const { data: profiles, error } = await supabase
    .from("profiles")
    .select("id, email, occupation, location, life_stage, vehicle, email_digest_enabled, digest_time, digest_frequency")
    .eq("email_digest_enabled", true)
    .limit(200); // safety cap; filter by time in JS

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const matching = (profiles ?? []).filter((p) => {
    if (!p.digest_time) return false;
    // digest_time is stored as "HH:MM:SS"
    const [h, m] = (p.digest_time as string).split(":").map(Number);
    if (h !== currentHour) return false;
    return Math.abs((m ?? 0) - currentMinute) <= 5;
  });

  const batch = matching.slice(0, BATCH_SIZE);
  let processed = 0;

  for (const profile of batch) {
    try {
      // Fetch topics for this user
      const [topicsResult, feedbackResult] = await Promise.all([
        supabase.from("user_topics").select("*").eq("user_id", profile.id),
        supabase
          .from("article_feedback")
          .select("vote, articles(external_id)")
          .eq("user_id", profile.id),
      ]);

      const topics = topicsResult.data ?? [];
      const topicNames = topics.map((t) => t.topic);

      const feedbackMap: Record<string, VoteValue> = {};
      for (const row of feedbackResult.data ?? []) {
        const extId = (row.articles as unknown as { external_id: string | null } | null)?.external_id;
        if (extId && (row.vote === "up" || row.vote === "down")) {
          feedbackMap[extId] = row.vote as VoteValue;
        }
      }

      const rawArticles = await fetchAllSources(topicNames);
      const preferences = { profile: { ...profile, digest_frequency: profile.digest_frequency as "daily" | "weekly", created_at: "", updated_at: "" }, topics };
      const digest      = await buildDigest(rawArticles, preferences, feedbackMap);

      // Persist digest entries
      if (digest.articles.length > 0) {
        const articleRows = digest.articles.map((a) => ({
          external_id: a.external_id, title: a.title, summary: a.summary,
          source_name: a.source_name, source_url: a.source_url,
          article_url: a.article_url, topic: a.topic, published_at: a.published_at,
        }));

        const { data: upserted } = await supabase
          .from("articles")
          .upsert(articleRows, { onConflict: "external_id" })
          .select("id, external_id");

        const idMap = new Map<string, string>();
        for (const row of upserted ?? []) {
          if (row.external_id) idMap.set(row.external_id, row.id);
        }

        const entryRows = digest.articles
          .map((a) => {
            const articleId = idMap.get(a.external_id ?? a.id);
            if (!articleId) return null;
            return { user_id: profile.id, article_id: articleId, relevance_score: a.relevanceScore, impact_level: a.impactLevel, ai_summary: a.aiSummary };
          })
          .filter(Boolean);

        if (entryRows.length > 0) {
          await supabase.from("digest_entries").upsert(entryRows as object[], { onConflict: "user_id,article_id" });
        }
      }

      // Send email if enabled
      if (profile.email_digest_enabled && digest.articles.length > 0) {
        const html = renderDigestEmailHtml(digest.articles, profile.email);
        const { error: sendError } = await resend.emails.send({
          from:    `${APP_NAME} <${FROM_EMAIL}>`,
          to:      profile.email,
          subject: `Your ${APP_NAME} digest — ${now.toLocaleDateString("en-MY", { weekday: "long", day: "numeric", month: "long" })}`,
          html,
        });

        await supabase.from("email_log").insert({
          user_id:       profile.id,
          status:        sendError ? "failed" : "sent",
          article_count: digest.articles.length,
        });
      }

      processed++;
    } catch (err) {
      console.error(`Cron: failed for user ${profile.id}`, err);
      // Continue processing other users
    }
  }

  return NextResponse.json({ processed, matched: matching.length });
}
