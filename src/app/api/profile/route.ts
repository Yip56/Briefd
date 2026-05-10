import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [profileResult, topicsResult] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).single(),
    supabase.from("user_topics").select("*").eq("user_id", user.id).order("created_at"),
  ]);

  if (profileResult.error) return NextResponse.json({ error: "Profile not found" }, { status: 404 });

  return NextResponse.json({
    profile: profileResult.data,
    topics:  topicsResult.data ?? [],
  });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: {
    occupation?: string;
    location?: string;
    life_stage?: string;
    vehicle?: string;
    digest_time?: string;
    digest_frequency?: string;
    email_digest_enabled?: boolean;
    topics?: string[];
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { topics, ...profileFields } = body;

  // ── Upsert profile ────────────────────────────────────────────────────────────
  const { error: profileError } = await supabase
    .from("profiles")
    .upsert({ id: user.id, ...profileFields, updated_at: new Date().toISOString() })
    .eq("id", user.id);

  if (profileError) return NextResponse.json({ error: profileError.message }, { status: 500 });

  // ── Replace topics atomically ─────────────────────────────────────────────────
  if (Array.isArray(topics)) {
    await supabase.from("user_topics").delete().eq("user_id", user.id);

    if (topics.length > 0) {
      const topicRows = topics.map((topic) => ({
        user_id:   user.id,
        topic,
        is_preset: true, // client can override if needed
        weight:    1.0,
      }));
      const { error: topicsError } = await supabase.from("user_topics").insert(topicRows);
      if (topicsError) return NextResponse.json({ error: topicsError.message }, { status: 500 });
    }
  }

  return NextResponse.json({ success: true });
}
