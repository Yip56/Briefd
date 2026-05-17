import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { updateGeminiProfile } from "@/lib/ai/feedback";

export const dynamic = "force-dynamic";

export async function POST() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  console.log("[Profile] Fetching feedback history...");
  const { data: feedbackRows } = await supabase
    .from("article_feedback")
    .select("vote, reason, free_text, articles(title, topic)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(20);

  console.log("[Profile] Feedback count:", feedbackRows?.length ?? 0);

  if (!feedbackRows || feedbackRows.length === 0) {
    return NextResponse.json(
      { error: "No feedback yet — dislike some articles first, then regenerate." },
      { status: 400 }
    );
  }

  console.log("[Profile] Calling Groq...");
  await updateGeminiProfile(user.id, supabase);

  const { data } = await supabase
    .from("user_algorithm_settings")
    .select("gemini_profile")
    .eq("user_id", user.id)
    .maybeSingle();

  const profile = data?.gemini_profile ?? "";
  console.log("[Profile] Profile generated:", profile.slice(0, 50));

  return NextResponse.json({ gemini_profile: profile });
}
