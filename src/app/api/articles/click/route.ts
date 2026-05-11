import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { articleUrl?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { articleUrl } = body;
  if (!articleUrl) return NextResponse.json({ error: "articleUrl is required" }, { status: 400 });

  await supabase
    .from("article_clicks")
    .upsert(
      { user_id: user.id, article_url: articleUrl },
      { onConflict: "user_id,article_url" }
    );

  return NextResponse.json({ success: true });
}
