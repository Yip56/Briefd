import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { extractAvoidanceKeywords, updateGeminiProfile } from "@/lib/ai/feedback";

export async function POST(request: NextRequest) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: {
    articleId?: string;
    vote?: string;
    reason?: string;
    freeText?: string;
    articleTopic?: string;
    articleTitle?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { articleId, vote, reason, freeText, articleTopic, articleTitle } = body;
  if (!articleId || (vote !== "up" && vote !== "down")) {
    return NextResponse.json({ error: "articleId and vote ('up'|'down') are required" }, { status: 400 });
  }

  const { error } = await supabase
    .from("article_feedback")
    .upsert(
      {
        user_id:    user.id,
        article_id: articleId,
        vote,
        reason:     reason ?? null,
        free_text:  freeText ?? null,
      },
      { onConflict: "user_id,article_id" }
    );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // For down votes: extract avoidance keywords and update algorithm settings
  if (vote === "down" && (reason || freeText || articleTopic)) {
    try {
      const keywords = await extractAvoidanceKeywords(
        articleTitle ?? "",
        reason ?? "",
        freeText ?? "",
        articleTopic ?? ""
      );

      if (keywords.length > 0) {
        const { data: existing } = await supabase
          .from("user_algorithm_settings")
          .select("avoidance_keywords")
          .eq("user_id", user.id)
          .maybeSingle();

        const current: Array<{ keyword: string; points: number }> =
          (existing?.avoidance_keywords as Array<{ keyword: string; points: number }>) ?? [];

        const existingSet = new Set(current.map((k) => k.keyword.toLowerCase()));
        const toAdd = keywords
          .filter((k) => !existingSet.has(k.toLowerCase()))
          .map((k) => ({ keyword: k, points: 15 }));

        if (toAdd.length > 0) {
          await supabase
            .from("user_algorithm_settings")
            .upsert(
              {
                user_id:             user.id,
                avoidance_keywords:  [...current, ...toAdd],
                updated_at:          new Date().toISOString(),
              },
              { onConflict: "user_id" }
            );
        }
      }
    } catch {
      // non-critical: ignore keyword extraction errors
    }

    // Fire-and-forget profile update
    updateGeminiProfile(user.id, supabase).catch(() => {});
  }

  return NextResponse.json({ success: true, removedArticleId: articleId });
}

// GET handler for email one-click feedback links:
// /api/feedback?articleId=X&vote=up&redirect=https://...
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const params    = request.nextUrl.searchParams;
  const articleId = params.get("articleId");
  const vote      = params.get("vote");
  const redirect  = params.get("redirect") ?? "/";

  if (user && articleId && (vote === "up" || vote === "down")) {
    await supabase
      .from("article_feedback")
      .upsert(
        { user_id: user.id, article_id: articleId, vote },
        { onConflict: "user_id,article_id" }
      );
  }

  return NextResponse.redirect(redirect.startsWith("http") ? redirect : "/");
}
