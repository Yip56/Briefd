import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServerClient } from "@supabase/ssr";

function createServiceClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll: () => [], setAll: () => {} } }
  );
}

export async function GET() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [profileResult, topicsResult] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).single(),
    supabase.from("user_topics").select("*").eq("user_id", user.id).order("weight", { ascending: false }),
  ]);

  if (profileResult.error) return NextResponse.json({ error: "Profile not found" }, { status: 404 });

  return NextResponse.json({
    profile: profileResult.data,
    topics:  topicsResult.data ?? [],
  });
}

type TopicInput = string | { topic: string; weight?: number; is_preset?: boolean };

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
    topics?: TopicInput[];
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { topics, ...profileFields } = body;
  const db = createServiceClient();

  // ── Upsert profile ────────────────────────────────────────────────────────────
  const { error: profileError } = await db
    .from("profiles")
    .upsert({
      id: user.id,
      email: user.email,
      ...profileFields,
      updated_at: new Date().toISOString(),
    });

  if (profileError) return NextResponse.json({ error: profileError.message }, { status: 500 });

  // ── Replace topics atomically ─────────────────────────────────────────────────
  if (Array.isArray(topics)) {
    await db.from("user_topics").delete().eq("user_id", user.id);

    if (topics.length > 0) {
      const topicRows = topics.map((t: TopicInput) => {
        if (typeof t === "string") {
          return { user_id: user.id, topic: t, is_preset: true, weight: 1.0 };
        }
        return {
          user_id:  user.id,
          topic:    t.topic,
          is_preset: t.is_preset ?? true,
          weight:   t.weight ?? 1.0,
        };
      });
      const { error: topicsError } = await db.from("user_topics").insert(topicRows);
      if (topicsError) return NextResponse.json({ error: topicsError.message }, { status: 500 });
    }
  }

  return NextResponse.json({ success: true });
}
