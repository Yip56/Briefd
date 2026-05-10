import { NextResponse } from "next/server";
import { Resend } from "resend";
import { createClient } from "@/lib/supabase/server";
import { renderDigestEmailHtml } from "@/lib/email/templates";
import { APP_NAME, FROM_EMAIL } from "@/lib/constants";
import type { ScoredArticle } from "@/lib/types";

export async function POST() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // ── 1. Fetch profile (need email + enabled flag) ──────────────────────────────
  const { data: profile } = await supabase
    .from("profiles")
    .select("email, email_digest_enabled")
    .eq("id", user.id)
    .single();

  if (!profile?.email_digest_enabled) {
    return NextResponse.json({ error: "Email digest disabled" }, { status: 400 });
  }

  // ── 2. Fetch latest digest entries ───────────────────────────────────────────
  const { data: entries, error: entriesError } = await supabase
    .from("digest_entries")
    .select(`
      relevance_score, impact_level, ai_summary,
      articles (
        id, external_id, title, summary, source_name, source_url,
        article_url, topic, published_at, fetched_at
      )
    `)
    .eq("user_id", user.id)
    .order("relevance_score", { ascending: false })
    .limit(10);

  if (entriesError) return NextResponse.json({ error: entriesError.message }, { status: 500 });

  const articles: ScoredArticle[] = (entries ?? [])
    .filter((e) => e.articles)
    .map((e) => {
      const a = e.articles as unknown as {
        id: string; external_id: string | null; title: string;
        summary: string | null; source_name: string | null; source_url: string | null;
        article_url: string; topic: string | null; published_at: string | null; fetched_at: string;
      };
      return {
        ...a,
        relevanceScore: e.relevance_score,
        impactLevel:    e.impact_level as ScoredArticle["impactLevel"],
        aiSummary:      e.ai_summary ?? "",
        userVote:       null,
      };
    });

  if (articles.length === 0) {
    return NextResponse.json({ error: "No articles to send" }, { status: 400 });
  }

  // ── 3. Render + send ─────────────────────────────────────────────────────────
  const resend = new Resend(process.env.RESEND_API_KEY);
  const html = renderDigestEmailHtml(articles, profile.email);

  const { data: sendData, error: sendError } = await resend.emails.send({
    from: `${APP_NAME} <${FROM_EMAIL}>`,
    to:   profile.email,
    subject: `Your ${APP_NAME} digest — ${new Date().toLocaleDateString("en-MY", { weekday: "long", day: "numeric", month: "long" })}`,
    html,
  });

  if (sendError) return NextResponse.json({ error: sendError.message }, { status: 500 });

  // ── 4. Log ────────────────────────────────────────────────────────────────────
  await supabase.from("email_log").insert({
    user_id:       user.id,
    status:        "sent",
    article_count: articles.length,
  });

  return NextResponse.json({ success: true, messageId: sendData?.id });
}
