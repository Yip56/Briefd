import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { articleId?: string; vote?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { articleId, vote } = body;
  if (!articleId || (vote !== "up" && vote !== "down")) {
    return NextResponse.json({ error: "articleId and vote ('up'|'down') are required" }, { status: 400 });
  }

  const { error } = await supabase
    .from("article_feedback")
    .upsert(
      { user_id: user.id, article_id: articleId, vote },
      { onConflict: "user_id,article_id" }
    );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}

// GET handler for email one-click feedback links:
// /api/feedback?articleId=X&vote=up&redirect=https://...
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const params   = request.nextUrl.searchParams;
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
