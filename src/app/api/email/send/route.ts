import { NextResponse } from "next/server";
import { Resend } from "resend";
import { createClient } from "@/lib/supabase/server";
import { buildEmailHtml } from "@/lib/email/templates";
import { APP_NAME } from "@/lib/constants";
import type { ImpactLevel, ScoredArticle } from "@/lib/types";

const FROM_EMAIL = "Briefd <onboarding@resend.dev>";

export async function POST() {
  try {
    if (!process.env.RESEND_API_KEY) {
      console.error("[email/send] RESEND_API_KEY is not configured");
      return NextResponse.json({ error: "RESEND_API_KEY not configured" }, { status: 400 });
    }

    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: profile } = await supabase
      .from("profiles")
      .select("email, email_digest_enabled")
      .eq("id", user.id)
      .single();

    if (!profile?.email_digest_enabled) {
      return NextResponse.json({ error: "Email digest disabled" }, { status: 400 });
    }

    if (!profile?.email) {
      console.error("[email/send] No email on file for user", user.id);
      return NextResponse.json({ error: "No email on file for user" }, { status: 400 });
    }

    const maskedEmail = profile.email.slice(0, 3) + "***";
    console.log("[email/send] Sending to:", maskedEmail);

    const { data: queueRows, error: queueError } = await supabase
      .from("article_queue")
      .select(`
        relevance_score, impact_level, ai_summary, impact_analysis, topic,
        articles (
          id, external_id, title, summary, source_name, source_url,
          article_url, topic, published_at, fetched_at, is_video
        )
      `)
      .eq("user_id", user.id)
      .eq("served", false)
      .order("position", { ascending: true })
      .limit(5);

    if (queueError) {
      console.error("[email/send] Queue fetch error:", queueError);
      return NextResponse.json({ error: queueError.message }, { status: 500 });
    }

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

    if (articles.length === 0) {
      return NextResponse.json(
        { error: "No digest articles found. Generate a digest first." },
        { status: 400 }
      );
    }

    console.log("[email/send] Article count:", articles.length);

    const resend = new Resend(process.env.RESEND_API_KEY);
    const now        = new Date();
    const dayOfWeek  = now.toLocaleDateString("en-MY", { weekday: "long" });
    const dateStr    = now.toLocaleDateString("en-MY", { day: "numeric", month: "long" });
    const html       = buildEmailHtml(articles, profile.email);

    const { data: sendData, error: sendError } = await resend.emails.send({
      from:    FROM_EMAIL,
      to:      profile.email,
      subject: `Your ${APP_NAME} Digest · ${dayOfWeek}, ${dateStr}`,
      html,
    });

    if (sendError) {
      console.error("[email/send] Resend error:", sendError);
      return NextResponse.json({ error: sendError.message }, { status: 500 });
    }

    console.log("[email/send] Sent successfully, messageId:", sendData?.id);

    await supabase.from("email_log").insert({
      user_id:       user.id,
      status:        "sent",
      article_count: articles.length,
    });

    return NextResponse.json({ success: true, messageId: sendData?.id });
  } catch (err: unknown) {
    const error = err as Error;
    console.error("[email/send] Unexpected error:", error?.message, error?.stack);
    return NextResponse.json({ error: error?.message ?? "Unexpected error" }, { status: 500 });
  }
}
